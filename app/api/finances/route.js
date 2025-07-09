// API route for finance stats and goal management for the logged-in craftsman
// GET    /api/finances            – return current year stats + goal
// POST   /api/finances            – upsert yearly revenue goal (body: { goal_amount })

import { NextResponse } from 'next/server';
import {
  createSupabaseClient,
  getUserFromRequest,
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess,
  camelToSnake
} from '../../../lib/api-utils';

const ROUTE_NAME = 'Finances API';
const supabase = createSupabaseClient(ROUTE_NAME);

// ---------- READ (stats + goal) ----------
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);

    // Default period: current year. (Could extend later for ?period=all)
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError({ message: 'Craftsman profile not found' }, 'Craftsman profile not found', 404, ROUTE_NAME);
    }

    // ---------- Fetch yearly goal ----------
    console.log(`${ROUTE_NAME} - Fetching goal for craftsman ID: ${craftsmanId}`);
    const { data: goalData, error: goalError } = await supabase
      .from('finances')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .eq('goal_period', 'year')
      .single();

    console.log(`${ROUTE_NAME} - Goal data:`, goalData || 'No goal found');
    if (goalError) {
      if (goalError.code === 'PGRST116') { // ignore not-found
        console.log(`${ROUTE_NAME} - No goal found for craftsman (normal, not an error)`);
      } else {
        console.error(`${ROUTE_NAME} - Goal fetch error:`, goalError);
        return handleApiError(goalError, 'Failed to fetch goal', 500, ROUTE_NAME);
      }
    }

    // ---------- Fetch invoices for current year ----------
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('created_at,status,total_amount')
      .eq('craftsman_id', craftsmanId)
      .gte('created_at', startOfYear)
      .lte('created_at', endOfYear);

    if (invError) {
      console.error(`${ROUTE_NAME} – invoices fetch error`, invError);
      return handleApiError(invError, 'Failed to fetch invoices', 500, ROUTE_NAME);
    }

    // ---------- Aggregate per month ----------
    const monthlyPaid = Array(12).fill(0);
    const monthlyOpen = Array(12).fill(0);

    invoices?.forEach(inv => {
      const monthIdx = new Date(inv.created_at).getMonth(); // 0-based
      const amt = Number(inv.total_amount) || 0;
      if (inv.status === 'paid') monthlyPaid[monthIdx] += amt;
      else monthlyOpen[monthIdx] += amt;
    });

    // Convert to cumulative
    for (let i = 1; i < 12; i++) {
      monthlyPaid[i] += monthlyPaid[i - 1];
      monthlyOpen[i] += monthlyOpen[i - 1];
    }

    const totalRevenue = monthlyPaid[11] || 0;
    const totalOpen = monthlyOpen[11] || 0;

    const payload = {
      goal: goalData || null,
      totalRevenue,
      totalOpen,
      monthly: {
        paid: monthlyPaid,
        open: monthlyOpen
      }
    };

    return handleApiSuccess(payload, 'Finance stats retrieved successfully');
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}

// ---------- UPSERT GOAL ----------
export async function POST(req) {
  try {
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);

    const body = await req.json();
    const goalAmount = parseFloat(body.goal_amount);
    if (isNaN(goalAmount) || goalAmount <= 0) {
      return handleApiError({ message: 'Invalid goal amount' }, 'Invalid goal amount', 400, ROUTE_NAME);
    }

    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return handleApiError({ message: 'Craftsman profile not found' }, 'Craftsman profile not found', 404, ROUTE_NAME);
    }

    const insertBody = camelToSnake({
      craftsman_id: craftsmanId,
      goal_amount: goalAmount.toFixed(2),
      goal_period: 'year',
      updated_at: new Date().toISOString()
    });

    const { data, error } = await supabase
      .from('finances')
      .upsert(insertBody, { onConflict: 'craftsman_id,goal_period', ignoreDuplicates: false })
      .select('*')
      .single();

    if (error) {
      console.error(`${ROUTE_NAME} – upsert error`, error);
      return handleApiError(error, 'Failed to save goal', 500, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - Goal saved successfully:`, data);
    
    // Return full finance stats including the updated goal for consistency
    // This matches the GET response structure, making frontend handling easier
    return handleApiSuccess({
      goal: data,
      totalRevenue: 0, // Default values since we don't have the stats in this context
      totalOpen: 0,
      monthly: {
        paid: Array(12).fill(0),
        open: Array(12).fill(0)
      }
    }, 'Goal saved', 201);
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}
