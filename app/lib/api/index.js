import { createClient } from '@supabase/supabase-js';

// Re-usable Supabase client (browser-side only). We cannot use React hooks here,
// so we query the session directly from Supabase to retrieve the JWT that the
// authenticated pages already have. This lets the old API helpers work without
// relying on `localStorage`.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  // Falling back to anon key is fine – we only need it to initialise the client
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: true } }
);

async function authedFetch(input, init = {}) {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  return fetch(input, { ...init, headers });
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
  async create(payload = {}) {
    const res = await authedFetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
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
  async get(id) {
    const res = await authedFetch(`/api/quotes/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  // alias expected by some legacy pages
  getById: (...args) => quotesAPI.get(...args)
};

// Empty exports kept for type safety / future implementation
export const craftsmenAPI = {};
export const financesAPI = {};
