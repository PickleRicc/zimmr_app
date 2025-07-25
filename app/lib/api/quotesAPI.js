// Front-end helper functions for interacting with /api/quotes endpoints
// These thin wrappers make component code cleaner and pave the way for SSR calls later.

import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import pdfGenerator from '../../../lib/utils/pdfGenerator';

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
    const response = await res.json();
    
    // Handle the new standardized API response format
    return response.data || response;
  },

  async get(id) {
    const res = await fetch(`/api/quotes/${id}`, {
      headers: { ...defaultHeaders() }
    });
    if (!res.ok) throw new Error(await res.text());
    const response = await res.json();
    
    // Handle the new standardized API response format
    return response.data || response;
  },

  async create(data) {
    // CRITICAL: Ensure materials array is explicitly included
    const quoteData = {
      ...data,
      // Make sure materials are properly formatted and included
      materials: Array.isArray(data.materials) ? data.materials : [],
      total_materials_price: parseFloat(data.total_materials_price || 0).toFixed(2),
    };
    
    console.log('Creating quote with materials data:', quoteData.materials);
    
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...defaultHeaders() },
      body: JSON.stringify(quoteData)
    });
    if (!res.ok) throw new Error(await res.text());
    const response = await res.json();
    
    // Handle the new standardized API response format
    return response.data || response;
  },

  async update(id, data) {
    // CRITICAL: Ensure materials array is explicitly included in updates too
    const quoteData = {
      ...data,
      // Make sure materials are properly formatted and included
      materials: Array.isArray(data.materials) ? data.materials : [],
      total_materials_price: parseFloat(data.total_materials_price || 0).toFixed(2),
    };
    
    console.log('Updating quote with materials data:', quoteData.materials);
    
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...defaultHeaders()
      },
      body: JSON.stringify(quoteData)
    });
    if (!res.ok) throw new Error(await res.text());
    const response = await res.json();
    
    // Handle the new standardized API response format
    return response.data || response;
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
      console.log('Generating quote PDF via quotesAPI...');
      
      // CRITICAL FIX: Log materials data for debugging
      console.log('========= MATERIALS DATA DEBUG (Quote API) =========');
      console.log('Quote.materials:', quote.materials);
      console.log('Materials valid array?', Array.isArray(quote.materials));
      console.log('Materials length:', Array.isArray(quote.materials) ? quote.materials.length : 0);
      console.log('Total materials price:', quote.total_materials_price);
      console.log('========= END MATERIALS DEBUG =========');
      
      // CRITICAL FIX: Use setTimeout to prevent DOM conflicts during React rendering
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            // Use the correct quote PDF generator with static import
            await pdfGenerator.generateQuotePdf(quote, craftsmanData);
            console.log('Quote PDF generated successfully via quotesAPI');
            resolve(true);
          } catch (error) {
            console.error('Error generating PDF:', error);
            reject(error);
          }
        }, 100); // Small delay to let React finish current render cycle
      });
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
    const response = await res.json();
    
    // Handle the new standardized API response format
    return response.data || response;
  },

};
