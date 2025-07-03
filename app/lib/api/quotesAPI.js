// Front-end helper functions for interacting with /api/quotes endpoints
// These thin wrappers make component code cleaner and pave the way for SSR calls later.

import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';

// This API should now be used with authedFetch from the useAuthedFetch hook
// For backwards compatibility, we'll also allow direct calls with default headers
const defaultHeaders = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const quotesAPI = {
  // Alias used by legacy UI – maps to list
  getAll: (...args) => quotesAPI.list(...args),
  async list(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`/api/quotes${qs}`, {
      headers: { ...defaultHeaders() }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async get(id) {
    const res = await fetch(`/api/quotes/${id}`, {
      headers: { ...defaultHeaders() }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async create(payload) {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...defaultHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async update(id, payload) {
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...defaultHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async remove(id) {
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'DELETE',
      headers: { ...defaultHeaders() }
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  // ---------- Extensions used in UI but not yet fully backed server-side ----------
  async generatePdf(quote, craftsmanData = {}) {
    // For now call client-side util until server endpoint is built
    if (typeof window !== 'undefined') {
      const { generateInvoicePdf } = await import('../../../lib/utils/pdfGenerator');
      await generateInvoicePdf({ ...quote, craftsmanData });
      return true;
    }
    throw new Error('PDF generation not available on server');
  },

  async convertToInvoice(quoteId, craftsmanId) {
    // Placeholder – will call dedicated endpoint once implemented
    const res = await fetch(`/api/quotes/${quoteId}?convert_to_invoice=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...defaultHeaders() },
      body: JSON.stringify(craftsmanId ? { craftsman_id: craftsmanId } : {})
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

};
