import { createClient } from '@supabase/supabase-js';

// Hardcoded values as fallback for dev/production if env vars fail
const FALLBACK_SUPABASE_URL = 'https://xnsymruxpuxjmfqajdjg.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhuc3ltcnV4cHV4am1mcWFqZGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODQwMzYsImV4cCI6MjA2NjQ2MDAzNn0.U2k-zp0Pz5OVW3bX4rgdTT2m0MP4ANMbS-6GU43FUZY';

// Re-usable Supabase client (browser-side only). We cannot use React hooks here,
// so we query the session directly from Supabase to retrieve the JWT that the
// authenticated pages already have. This lets the old API helpers work without
// relying on `localStorage`.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL,
  // Falling back to anon key is fine – we only need it to initialise the client
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY,
  { auth: { persistSession: true } }
);

async function authedFetch(input, init = {}) {
  try {
    // Get the session in a more reliable way
    const { data, error } = await supabase.auth.getSession();
    
    // Debug logs to help identify auth issues
    console.log('Auth fetch - Session retrieval:', {
      hasSession: !!data?.session,
      hasAccessToken: !!data?.session?.access_token,
      error: error?.message
    });
    
    const token = data?.session?.access_token;
    
    // Log the request being made (without showing the full token)
    console.log(`Auth fetch - ${init.method || 'GET'} request to ${input}`, {
      hasAuthHeader: !!token,
      tokenPrefix: token ? token.substring(0, 10) + '...' : 'none'
    });
    
    const headers = {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    
    return fetch(input, { ...init, headers });
  } catch (err) {
    console.error('Error in authedFetch:', err);
    // Still try the fetch without auth as fallback
    return fetch(input, { ...init });
  }
}

function toQuery(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
  ).toString();
  return qs ? `?${qs}` : '';
}

export const customersAPI = {
  async getAll(params = {}) {
    const res = await authedFetch(`/api/customers${toQuery(params)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async getById(id) {
    console.log(`Fetching customer ${id}`);
    try {
      const res = await authedFetch(`/api/customers?id=${id}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error fetching customer ${id}:`, errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const customer = responseData.data || responseData;
      console.log(`Successfully fetched customer ${id}`);
      return customer;
    } catch (error) {
      console.error(`Exception in customersAPI.getById(${id}):`, error);
      throw error;
    }
  },
  async update(id, payload = {}) {
    console.log(`Updating customer ${id} with payload:`, payload);
    try {
      const res = await authedFetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload })
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error updating customer ${id}:`, errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const customer = responseData.data || responseData;
      console.log(`Successfully updated customer ${id}`);
      return customer;
    } catch (error) {
      console.error(`Exception in customersAPI.update(${id}):`, error);
      throw error;
    }
  }
};

export const appointmentsAPI = {
  async getAll(params = {}) {
    const res = await authedFetch(`/api/appointments${toQuery(params)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

export const invoicesAPI = {
  async getAll(params = {}) {
    console.log('Fetching all invoices with params:', params);
    try {
      const res = await authedFetch(`/api/invoices${toQuery(params)}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error fetching invoices:', errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const invoicesArray = responseData.data || responseData;
      console.log('Successfully fetched invoices:', invoicesArray.length || 0);
      return invoicesArray;
    } catch (error) {
      console.error('Exception in invoicesAPI.getAll:', error);
      throw error;
    }
  },
  async get(id) {
    console.log(`Fetching invoice ${id}`);
    try {
      const res = await authedFetch(`/api/invoices/${id}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error fetching invoice ${id}:`, errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const invoice = responseData.data || responseData;
      console.log(`Successfully fetched invoice ${id}`);
      return invoice;
    } catch (error) {
      console.error(`Exception in invoicesAPI.get(${id}):`, error);
      throw error;
    }
  },
  // alias expected by some legacy pages
  getById: (...args) => invoicesAPI.get(...args),
  async create(payload = {}) {
    console.log('Creating invoice with payload:', payload);
    try {
      const res = await authedFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error creating invoice:', errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const invoice = responseData.data || responseData.invoice || responseData;
      console.log('Successfully created invoice:', invoice.id || 'unknown');
      return invoice;
    } catch (error) {
      console.error('Exception in invoicesAPI.create:', error);
      throw error;
    }
  },
  async update(id, payload = {}) {
    console.log(`Updating invoice ${id} with payload:`, payload);
    try {
      const res = await authedFetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error updating invoice ${id}:`, errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const invoice = responseData.data || responseData;
      console.log(`Successfully updated invoice ${id}`);
      return invoice;
    } catch (error) {
      console.error(`Exception in invoicesAPI.update(${id}):`, error);
      throw error;
    }
  },
  async generatePdf(invoice, craftsmanData = {}) {
    // Client-side PDF generation placeholder – keeps legacy calls working
    if (typeof window !== 'undefined') {
      const { generateInvoicePdf } = await import('../../../lib/utils/pdfGenerator');
      await generateInvoicePdf({ ...invoice, craftsmanData });
      return true;
    }
    throw new Error('PDF generation only available client-side');
  }
};

export const quotesAPI = {
  async getAll(params = {}) {
    console.log('Fetching all quotes with params:', params);
    try {
      const res = await authedFetch(`/api/quotes${toQuery(params)}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error fetching quotes:', errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const quotesArray = responseData.data || responseData;
      console.log('Successfully fetched quotes:', quotesArray.length || 0);
      return quotesArray;
    } catch (error) {
      console.error('Exception in quotesAPI.getAll:', error);
      throw error;
    }
  },
  async get(id) {
    console.log(`Fetching quote ${id}`);
    try {
      const res = await authedFetch(`/api/quotes/${id}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error fetching quote ${id}:`, errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const quote = responseData.data || responseData;
      console.log(`Successfully fetched quote ${id}`);
      return quote;
    } catch (error) {
      console.error(`Exception in quotesAPI.get(${id}):`, error);
      throw error;
    }
  },
  // alias expected by some legacy pages
  getById: (...args) => quotesAPI.get(...args),
  
  async create(payload = {}) {
    console.log('Creating quote with payload:', payload);
    try {
      const res = await authedFetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error creating quote:', errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const quote = responseData.data || responseData;
      console.log('Successfully created quote:', quote.id || 'unknown');
      return quote;
    } catch (error) {
      console.error('Exception in quotesAPI.create:', error);
      throw error;
    }
  },
  
  async update(id, payload = {}) {
    console.log(`Updating quote ${id} with payload:`, payload);
    try {
      const res = await authedFetch(`/api/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error updating quote ${id}:`, errorText);
        throw new Error(errorText);
      }
      const responseData = await res.json();
      // Handle both standardized response format and legacy format
      const quote = responseData.data || responseData;
      console.log(`Successfully updated quote ${id}`);
      return quote;
    } catch (error) {
      console.error(`Exception in quotesAPI.update(${id}):`, error);
      throw error;
    }
  }
};

// Empty exports kept for type safety / future implementation
export const craftsmenAPI = {};
export const financesAPI = {};
export const spacesAPI = {
  async getAll(params = {}) {
    const res = await authedFetch(`/api/spaces${toQuery(params)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async create(payload = {}) {
    const res = await authedFetch('/api/spaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async get(id) {
    const res = await authedFetch(`/api/spaces/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getById: (...args) => spacesAPI.get(...args)
};
