/**
 * Shared utilities for API routes
 * This file contains helper functions for authentication, Supabase client creation,
 * and craftsman ID retrieval used across API routes.
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Creates and returns a Supabase client with proper credentials
 * @param {string} routeName - Name of the API route for logging
 * @returns {Object} Supabase client
 */
export function createSupabaseClient(routeName = 'API') {
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasAnonKey = !!process.env.SUPABASE_ANON_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  console.log(`${routeName} - Supabase client initialization:`, { 
    hasUrl: !!supabaseUrl, 
    hasServiceRoleKey, 
    hasAnonKey,
    url: supabaseUrl
  });
  
  // Prioritize service role key for server operations
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false }
    }
  );
}

/**
 * Gets the authenticated user from a request
 * @param {Object} req - Next.js request object
 * @param {Object} supabase - Supabase client
 * @param {string} routeName - Name of the API route for logging
 * @returns {Object|null} User object or null if not authenticated
 */
export async function getUserFromRequest(req, supabase, routeName = 'API') {
  try {
    // Log the request to help debug authentication issues
    console.log(`${routeName} - Request Headers:`, {
      authorization: req.headers.get('authorization') ? 'Present (not shown)' : 'Missing',
      'content-type': req.headers.get('content-type'),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });
    
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      console.log(`${routeName} - No auth token provided in request`);
      return null;
    }
    
    console.log(`${routeName} - Validating auth token (first 10 chars): ${token.substring(0, 10)}...`);
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error(`${routeName} - Auth token validation failed:`, {
        message: error.message,
        status: error.status,
        code: error.code
      });
      return null;
    }
    
    if (!data || !data.user) {
      console.error(`${routeName} - Auth response missing user data:`, {
        hasData: !!data,
        hasUser: !!(data?.user)
      });
      return null;
    }
    
    console.log(`${routeName} - User authenticated successfully:`, {
      userId: data.user.id,
      email: data.user.email,
      hasMetadata: !!(data.user.user_metadata)
    });
    return data.user;
  } catch (err) {
    console.error(`${routeName} - Error in authentication process:`, {
      message: err.message,
      stack: err.stack
    });
    return null;
  }
}

/**
 * Gets or creates a craftsman ID for a user
 * @param {Object} user - Authenticated user object
 * @param {Object} supabase - Supabase client
 * @param {string} routeName - Name of the API route for logging
 * @returns {string} Craftsman ID
 * @throws {Error} If unable to get or create craftsman
 */
export async function getOrCreateCraftsmanId(user, supabase, routeName = 'API') {
  try {
    console.log(`${routeName} - Attempting to get or create craftsman for user:`, {
      userId: user.id,
      email: user.email,
      hasMetadata: !!(user.user_metadata),
      metadata: user.user_metadata
    });
    
    // First, try to find existing craftsman with multiple retry attempts
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount <= maxRetries) {
      console.log(`${routeName} - Find attempt ${retryCount + 1}/${maxRetries + 1}`);
      
      const { data: rows, error: findError } = await supabase
        .from('craftsmen')
        .select('id, name, created_at, user_id, phone, specialty, availability_hours')
        .eq('user_id', user.id);
      
      // Handle multiple records by taking the first one
      const row = rows && rows.length > 0 ? rows[0] : null;
      
      if (findError) {
        console.log(`${routeName} - Find attempt ${retryCount + 1} failed:`, {
          message: findError.message,
          code: findError.code,
          details: findError.details
        });
      }
        
      if (row) {
        console.log(`${routeName} - Found existing craftsman:`, {
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          totalFound: rows?.length || 0
        });
        return row.id;
      }
      
      retryCount++;
      if (retryCount <= maxRetries) {
        const delay = retryCount * 300; // Increasing delay
        console.log(`${routeName} - Retrying find in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log(`${routeName} - No existing craftsman found after ${maxRetries + 1} attempts, creating new one...`);
    
    // Prepare craftsman data with better defaults
    const userName = user.user_metadata?.full_name || 
                    user.user_metadata?.name || 
                    user.email?.split('@')[0] || 
                    'New User';
    
    const craftsmanData = { 
      user_id: user.id, 
      name: userName,
      phone: user.user_metadata?.phone || null,
      specialty: user.user_metadata?.specialty || null,
      availability_hours: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`${routeName} - Craftsman data for insert:`, craftsmanData);
    
    // Try to create the craftsman with service role privileges
    const { data: created, error: createErr } = await supabase
      .from('craftsmen')
      .insert(craftsmanData)
      .select('id, name')
      .single();
      
    if (createErr) {
      console.error(`${routeName} - Error creating craftsman:`, {
        message: createErr.message,
        code: createErr.code,
        details: createErr.details,
        hint: createErr.hint
      });
      
      // Check if it's an RLS policy violation
      const isRLSError = createErr.message && (
        createErr.message.includes('violates row-level security policy') ||
        createErr.message.includes('insufficient_privilege') ||
        createErr.code === 'PGRST116'
      );
      
      if (isRLSError) {
        console.log(`${routeName} - RLS policy violation detected - checking for race condition`);
        
        // Wait a bit and check one more time if record was created by another request
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: existingRows, error: finalFindError } = await supabase
          .from('craftsmen')
          .select('id, name')
          .eq('user_id', user.id);
        
        const existingRow = existingRows && existingRows.length > 0 ? existingRows[0] : null;
          
        if (existingRow) {
          console.log(`${routeName} - Found craftsman after RLS error (race condition):`, existingRow);
          return existingRow.id;
        }
        
        console.log(`${routeName} - Still no craftsman found, final find error:`, finalFindError?.message);
      }
      
      // Try using RPC function as a fallback
      try {
        console.log(`${routeName} - Attempting to create craftsman via RPC function`);
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_craftsman_for_user', {
          user_id_param: user.id,
          name_param: userName,
          phone_param: user.user_metadata?.phone || null,
          specialty_param: user.user_metadata?.specialty || null
        });
        
        if (rpcError) {
          console.error(`${routeName} - RPC function error:`, {
            message: rpcError.message,
            code: rpcError.code,
            details: rpcError.details
          });
        } else if (rpcResult) {
          console.log(`${routeName} - Created craftsman via RPC function:`, rpcResult);
          return rpcResult;
        }
      } catch (rpcErr) {
        console.error(`${routeName} - Exception in RPC call:`, rpcErr);
      }
      
      // If all creation attempts fail, provide detailed error information
      const errorMessage = `Failed to create craftsman record. Original error: ${createErr.message}. ` +
                          `This might be due to database permissions or RLS policies. ` +
                          `User ID: ${user.id}, Email: ${user.email}`;
      
      console.error(`${routeName} - All craftsman creation attempts failed`);
      throw new Error(errorMessage);
    }
    
    console.log(`${routeName} - Successfully created new craftsman:`, {
      id: created.id,
      name: created.name
    });
    return created.id;
    
  } catch (err) {
    console.error(`${routeName} - Error in getOrCreateCraftsmanId:`, {
      message: err.message,
      stack: err.stack,
      userId: user?.id,
      userEmail: user?.email
    });
    
    // Provide a more helpful error message
    const helpfulMessage = `Authentication setup incomplete for user ${user?.email || user?.id}. ` +
                          `Unable to create or retrieve craftsman profile. ` +
                          `Please contact support or check database permissions.`;
    
    throw new Error(helpfulMessage);
  }
}

/**
 * Standardized error response handler for API routes
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default error message
 * @param {number} statusCode - HTTP status code
 * @param {string} routeName - Name of the API route for logging
 * @returns {NextResponse} Standardized error response
 */
export function handleApiError(error, defaultMessage = 'Server error', statusCode = 500, routeName = 'API') {
  console.error(`${routeName} - Error:`, error.message || error);
  
  // Ensure status code is valid (200-599)
  const validStatusCode = Math.max(200, Math.min(599, Math.abs(statusCode) || 500));
  
  return NextResponse.json({
    error: error.message || defaultMessage,
    status: 'error'
  }, { status: validStatusCode });
}

/**
 * Standardized success response handler for API routes
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @returns {NextResponse} Standardized success response
 */
export function handleApiSuccess(data, message = 'Success', statusCode = 200) {
  return NextResponse.json({
    data,
    message,
    status: 'success'
  }, { status: statusCode });
}

/**
 * Helper function to convert camelCase to snake_case
 * @param {Object} obj - Object to convert
 * @returns {Object} Converted object with snake_case keys
 */
export const camelToSnake = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/([A-Z])/g, '_$1').toLowerCase(), v])
  );
