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
    
    console.log(`${routeName} - Validating auth token...`);
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error(`${routeName} - Auth token validation failed:`, error.message);
      return null;
    }
    
    if (!data || !data.user) {
      console.error(`${routeName} - Auth response missing user data`);
      return null;
    }
    
    console.log(`${routeName} - User authenticated successfully:`, data.user.id);
    return data.user;
  } catch (err) {
    console.error(`${routeName} - Error in authentication process:`, err.message);
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
    console.log(`${routeName} - Attempting to get or create craftsman for user:`, user.id);
    console.log(`${routeName} - User metadata:`, JSON.stringify(user.user_metadata || {}));
    
    // First, try to find existing craftsman - check multiple times with delay if needed
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      const { data: row, error: findError } = await supabase
        .from('craftsmen')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (findError) {
        console.log(`${routeName} - Find attempt ${retryCount + 1} failed:`, findError.message);
      }
        
      if (row) {
        console.log(`${routeName} - Found existing craftsman:`, row.id);
        return row.id;
      }
      
      // Only retry finding if we haven't reached max retries yet
      if (retryCount < maxRetries) {
        console.log(`${routeName} - Craftsman not found, retry attempt ${retryCount + 1}`);
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retrying
        retryCount++;
      } else {
        break;
      }
    }
    
    console.log(`${routeName} - Creating new craftsman with service role key, user_id:`, user.id);
    
    // Add all required fields that might be needed by RLS policies
    const craftsmanData = { 
      user_id: user.id, 
      name: user.user_metadata?.full_name || user.email || 'New User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: true
    };
    
    console.log(`${routeName} - Craftsman data for insert:`, JSON.stringify(craftsmanData));
    
    // Try to create the craftsman
    const { data: created, error: createErr } = await supabase
      .from('craftsmen')
      .insert(craftsmanData)
      .select('id')
      .single();
      
    if (createErr) {
      console.error(`${routeName} - Error creating craftsman:`, createErr.message);
      console.error(`${routeName} - Error details:`, JSON.stringify(createErr));
      
      // If RLS error, make one final attempt to find an existing record
      // It might have been created in parallel by another request
      if (createErr.message && createErr.message.includes('violates row-level security policy')) {
        console.log(`${routeName} - RLS policy violation - checking one more time for existing craftsman`);
        const { data: existingRow } = await supabase
          .from('craftsmen')
          .select('id')
          .eq('user_id', user.id)
          .single();
          
        if (existingRow) {
          console.log(`${routeName} - Found craftsman on final retry:`, existingRow.id);
          return existingRow.id;
        }
      }
      
      // If we still can't find it, we need to use RPC to create the craftsman
      // as a last resort to bypass RLS
      try {
        console.log(`${routeName} - Attempting to create craftsman via RPC function`);
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_craftsman_for_user', {
          user_id_param: user.id,
          name_param: user.user_metadata?.full_name || user.email || 'New User'
        });
        
        if (rpcError) {
          console.error(`${routeName} - RPC function error:`, rpcError);
          throw rpcError;
        }
        
        if (rpcResult) {
          console.log(`${routeName} - Created craftsman via RPC function:`, rpcResult);
          return rpcResult;
        }
      } catch (rpcErr) {
        console.error(`${routeName} - Failed to create craftsman via RPC:`, rpcErr);
      }
      
      // If all else fails, throw the original error
      throw createErr;
    }
    
    console.log(`${routeName} - Successfully created new craftsman:`, created.id);
    return created.id;
  } catch (err) {
    console.error(`${routeName} - Error in getOrCreateCraftsmanId:`, err);
    throw new Error('Failed to retrieve craftsman profile: ' + err.message);
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
  return NextResponse.json({ 
    error: error.message || defaultMessage,
    status: 'error'
  }, { status: statusCode });
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
