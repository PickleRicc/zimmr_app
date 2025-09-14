'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
import { invoicesAPI } from '../lib/api';
import Header from '../components/Header';
import Footer from '../components/Footer';

import { useRequireAuth } from '../../lib/utils/useRequireAuth';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [pdfLoading, setPdfLoading] = useState(false);
  const [processingInvoiceId, setProcessingInvoiceId] = useState(null);
  // activeTab removed - only showing invoices
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateId, setStatusUpdateId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [success, setSuccess] = useState('');

  
  const fetcher = useAuthedFetch();
  const { user, loading: authLoading } = useRequireAuth();

  // fetch invoices when authentication state is ready
  useEffect(() => {
    if (!authLoading && user) {
      fetchInvoices();
    }
  }, [authLoading, user]);

  // recompute filtered list when invoices or filter inputs change
  useEffect(() => {
    let filtered = invoices.filter(inv => inv.type === 'invoice');

    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv => (
        inv.customer_name && inv.customer_name.toLowerCase().includes(term)
      ) || (
        inv.invoice_number && inv.invoice_number.toLowerCase().includes(term)
      ));
    }

    setFilteredInvoices(filtered);
  }, [invoices, statusFilter, searchTerm]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      // Fetch invoices with customer data included
      const res = await fetcher('/api/invoices?include_customer=true');
      if (!res.ok) throw new Error(await res.text());
      const responseData = await res.json();
      console.log('Fetched invoices response:', responseData);
      
      // Handle both standardized response format and legacy format
      const invoicesArray = responseData.data || responseData;
      
      // Add customer_name field from customer data for display
      const invoicesWithCustomerNames = invoicesArray.map(invoice => ({
        ...invoice,
        customer_name: invoice.customer ? `${invoice.customer.first_name} ${invoice.customer.last_name}`.trim() : null
      }));
      
      console.log('Processed invoices array:', invoicesWithCustomerNames);
      setInvoices(invoicesWithCustomerNames);
      setError(null);
      
      // Display success message if available in API response
      if (responseData.message && responseData.status === 'success') {
        setSuccess(responseData.message);
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Fehler beim Laden von Rechnungen. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  // Use German-style invoice PDF generator
  const handleGeneratePdf = async (invoice) => {
    try {
      setPdfLoading(true);
      setProcessingInvoiceId(invoice.id);
      
      // Get craftsman data from localStorage if available
      const craftsmanData = {
        name: localStorage.getItem('userName') || 'ZIMMR Craftsman',
        email: localStorage.getItem('userEmail') || '',
        phone: localStorage.getItem('userPhone') || '',
        address: localStorage.getItem('userAddress') || '',
        // Add tax and banking information for German invoices
        tax_id: localStorage.getItem('userTaxId') || '',
        iban: localStorage.getItem('userIban') || '',
        bic: localStorage.getItem('userBic') || '',
        bank_name: localStorage.getItem('userBank') || 'Bank',
        owner_name: localStorage.getItem('userName') || ''
      };
      
      // Make sure we pass the full invoice object properly
      await invoicesAPI.generatePdf(invoice, craftsmanData);
      console.log('German-style invoice PDF generated successfully');
      
    } catch (err) {
      console.error('Error generating German PDF:', err);
      alert('Fehler beim Erstellen des PDFs. Bitte versuchen Sie es erneut.');
    } finally {
      setPdfLoading(false);
      setProcessingInvoiceId(null);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (invoiceId, newStatus) => {
    if (updatingStatus) return;
    
    try {
      setUpdatingStatus(true);
      setStatusUpdateId(invoiceId);
      
      // Call API to update invoice status
      const res = await fetcher(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      // Parse response to get updated data
      const responseData = res.ok ? await res.json() : null;
      console.log('Status update response:', responseData);
      
      // Get the updated invoice data from the response if available
      const updatedInvoice = responseData?.data || responseData;
      
      // Update local state to reflect the change, using updated data from API if available
      setInvoices(invoices.map(invoice => 
        invoice.id === invoiceId 
          ? { ...invoice, ...updatedInvoice, status: newStatus } 
          : invoice
      ));
      
      // Display success message if provided in response
      if (responseData?.status === 'success' && responseData?.message) {
        setSuccess(responseData.message);
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(''), 5000);
      }
      
    } catch (err) {
      console.error('Error updating invoice status:', err);
      
      // Try to extract error message from standardized response format
      let errorMessage = 'Fehler beim Aktualisieren des Rechnungsstatus. Bitte versuchen Sie es erneut.';
      try {
        if (err.response) {
          const errorData = await err.response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      
      // Show error message in the UI instead of an alert
      setError(errorMessage);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setUpdatingStatus(false);
      setStatusUpdateId(null);
    }
  };

  // Invoice deletion handler
  const handleDelete = async (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!confirm('Sind Sie sicher, dass Sie diese Rechnung löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.')) {
      return;
    }
    
    try {
      setDeletingId(id);

      // delete on server
      const res = await fetcher(`/api/invoices/${id}`, { method: 'DELETE' });
      const responseData = res.ok ? await res.json() : null;
      console.log('Delete response:', responseData);

      const invoice = invoices.find(inv => inv.id === id);
      const customerName = invoice?.customer_name || 'Kunde';

      // Display success message from API if available, otherwise use default
      const successMessage = responseData?.message || `Rechnung für ${customerName} erfolgreich gelöscht`;
      setSuccess(successMessage);
      
      // Refresh invoices list
      await fetchInvoices();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error deleting invoice:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      
      // Try to extract error message from standardized response format
      let errorMessage = `Fehler beim Löschen der Rechnung: ${err.message}`;
      try {
        if (err.response) {
          const errorData = await err.response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      
      setError(errorMessage);
      
      // Clear error message after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-900/30 text-green-400';
      case 'overdue':
        return 'bg-red-900/30 text-red-400 animate-pulse';
      case 'pending':
        return 'bg-blue-900/30 text-blue-400';
      case 'cancelled':
        return 'bg-gray-900/30 text-gray-400';
      case 'draft':
        return 'bg-yellow-900/30 text-yellow-400';
      default:
        return 'bg-blue-900/30 text-blue-400';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Add event listener for focus to refresh data when returning to the page
  const handleFocus = () => {
    fetchInvoices();
  };

  useEffect(() => {
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Add event listener for visibility change to refresh data when tab becomes visible
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      fetchInvoices();
    }
  };

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <>
      <Header title="Rechnungen" />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          {error && (
            <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100/10 border border-green-200/20 text-green-400 p-4 rounded-lg mb-6">
              {success}
            </div>
          )}
          
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
              <h1 className="text-2xl font-bold text-white">Rechnungen</h1>
              <Link 
                href="/invoices/new" 
                className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Neue Rechnung
              </Link>
            </div>
            
            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Rechnungen suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 pl-10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30 w-full sm:w-auto"
              >
                <option value="all">Alle Status</option>
                <option value="pending">Ausstehend</option>
                <option value="paid">Bezahlt</option>
                <option value="overdue">Überfällig</option>
                <option value="cancelled">Storniert</option>
              </select>
            </div>
            
            {loading ? (
              <div className="flex justify-center my-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                {searchTerm || statusFilter !== 'all' ? (
                  <div>
                    <p className="text-white/70 text-lg mb-3">Keine Rechnungen entsprechen Ihren Suchkriterien</p>
                    <button
                      onClick={() => {setSearchTerm(''); setStatusFilter('all');}}
                      className="text-[#ffcb00] hover:underline"
                    >
                      Filter zurücksetzen
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-white/70 text-lg mb-4">Sie haben noch keine Rechnungen</p>
                    <Link
                      href="/invoices/new"
                      className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg shadow text-sm font-medium inline-flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                      Erste Rechnung erstellen
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInvoices.map((invoice) => (
                  <div key={invoice.id} className="bg-white/5 rounded-lg p-5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusBadgeClass(invoice.status)}`}></span>
                          <h3 className="text-white font-medium text-lg">{invoice.invoice_number || `Rechnung #${invoice.id}`}</h3>
                        </div>
                        <p className="text-white/60 mt-1">{invoice.customer_name || 'Unbekannter Kunde'}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-xl font-semibold">€{parseFloat(invoice.total_amount).toFixed(2)}</div>
                        <span className={`text-sm px-2 py-0.5 rounded ${getStatusBadgeClass(invoice.status)}`}>
                          {invoice.status === 'paid' ? 'Bezahlt' : 
                           invoice.status === 'overdue' ? 'Überfällig' : 
                           invoice.status === 'pending' ? 'Ausstehend' : 
                           invoice.status === 'cancelled' ? 'Storniert' : 
                           invoice.status === 'draft' ? 'Entwurf' : 'Ausstehend'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                      <div className="text-white/60">
                        <span className="text-white/40">Ausstellungsdatum:</span>
                        <div>{formatDate(invoice.issue_date || invoice.created_at)}</div>
                      </div>
                      <div className="text-white/60">
                        <span className="text-white/40">Fälligkeitsdatum:</span>
                        <div>{formatDate(invoice.due_date)}</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3 border-t border-white/10">
                      <Link 
                        href={`/invoices/${invoice.id}`}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        Details anzeigen
                      </Link>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative flex-grow">
                          <select
                            value={invoice.status || 'pending'}
                            onChange={(e) => handleStatusUpdate(invoice.id, e.target.value)}
                            disabled={updatingStatus && statusUpdateId === invoice.id}
                            className="w-full px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer appearance-none pr-8"
                            aria-label="Rechnungsstatus aktualisieren"
                          >
                            <option value="pending" className="bg-[#121212]">Status: Ausstehend</option>
                            <option value="paid" className="bg-[#121212]">Status: Bezahlt</option>
                            <option value="overdue" className="bg-[#121212]">Status: Überfällig</option>
                            <option value="cancelled" className="bg-[#121212]">Status: Storniert</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-white">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                          </div>
                          {updatingStatus && statusUpdateId === invoice.id && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-4 w-4 border-2 border-[#ffcb00] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleGeneratePdf(invoice)}
                          disabled={pdfLoading && processingInvoiceId === invoice.id}
                          className={`px-3 py-1.5 flex-grow sm:flex-grow-0 ${pdfLoading && processingInvoiceId === invoice.id ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed' : 'bg-[#ffcb00] hover:bg-[#e6b800] text-black cursor-pointer'} text-sm font-medium rounded-lg transition-colors flex items-center justify-center`}
                        >
                          {pdfLoading && processingInvoiceId === invoice.id ? (
                            <>
                              <span className="mr-2 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                              Verarbeitung...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              PDF herunterladen
                            </>
                          )}
                        </button>
                        <button
                          onClick={(e) => handleDelete(invoice.id, e)}
                          disabled={deletingId === invoice.id}
                          className="px-3 py-1.5 flex-grow sm:flex-grow-0 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                        >
                          {deletingId === invoice.id ? (
                            <>
                              <span className="mr-2 h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>
                              Löschen...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                              Löschen
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}
