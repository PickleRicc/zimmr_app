
// Client-side helper functions to interact with the /api/finances endpoint
// Provides getFinanceStats() and setFinanceGoal()
import { supabase } from '../migrations/utils/supabase-client';

async function getAuthToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

export async function getFinanceStats() {
  const token = await getAuthToken();
  if (!token) {
    console.warn('Auth token not available yet, cannot fetch finance stats');
    return {
      monthly: { paid: [], open: [] },
      totalRevenue: 0,
      totalOpen: 0,
      goal: null
    };
  }
  
  console.log('Fetching finance stats with auth token');
  const res = await fetch('/api/finances', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    console.error(`Failed to get finance stats: ${res.status}`);
    throw new Error(`Failed to get finance stats: ${res.status}`);
  }
  
  const response = await res.json();
  console.log('Finance stats received:', response);
  // Extract the actual data from the API response structure
  return response.data;
}

export async function setFinanceGoal(goalAmount) {
  const token = await getAuthToken();
  if (!token) {
    console.warn('Auth token not available yet, cannot set finance goal');
    return null;
  }
  
  console.log(`Setting finance goal: ${goalAmount}`);
  const res = await fetch('/api/finances', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ goal_amount: goalAmount })
  });

  if (!res.ok) {
    console.error(`Failed to set finance goal: ${res.status}`);
    throw new Error(`Failed to set finance goal: ${res.status}`);
  }
  
  const response = await res.json();
  console.log('Finance goal set response:', response);
  // Extract the actual data from the API response structure
  return response.data;
}
