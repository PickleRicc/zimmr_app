'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { quotesAPI } from '../lib/api/quotesAPI';
import Header from '../components/Header';
import Footer from '../components/Footer';

import { useRouter } from 'next/navigation';
import { useRequireAuth } from '../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';

export default function QuotesPage() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [pdfLoading, setPdfLoading] = useState(false);
    const [processingQuoteId, setProcessingQuoteId] = useState(null);
  // Status filter removed for quotes
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredQuotes, setFilteredQuotes] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateId, setStatusUpdateId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [success, setSuccess] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const [craftsmanData, setCraftsmanData] = useState(null);

  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const fetcher = useAuthedFetch();

  // fetch quotes and craftsman data when authentication state is ready
  useEffect(() => {
    if (!authLoading && user) {
      console.log('Auth ready, fetching data. User:', user.email);
      // Small delay to ensure auth token is fully loaded
      const timer = setTimeout(() => {
        fetchQuotes();
        fetchCraftsmanData();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!authLoading && !user) {
      console.error('No user found after auth loading completed');
      setError('Nicht angemeldet. Bitte melden Sie sich an.');
    }
  }, [authLoading, user]);

  const fetchCraftsmanData = async () => {
    try {
      const response = await fetcher('/api/craftsmen');
      if (!response.ok) {
        throw new Error(`Failed to fetch craftsman data: ${response.statusText}`);
      }
      const data = await response.json();
      setCraftsmanData(data.data || data);
    } catch (err) {
      console.error('Error fetching craftsman data:', err);
    }
  };
    
    
 
      // trigger once auth ready
  

  

  useEffect(() => {
    if (quotes.length > 0) {
      let filtered = [...quotes];
      
      // Filter by search term (customer name or quote ID)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(quote => 
          (quote.customer_name && quote.customer_name.toLowerCase().includes(term)) || 
          (quote.id && String(quote.id).includes(term))
        );
      }
      
      setFilteredQuotes(filtered);
    } else {
      setFilteredQuotes([]);
    }
  }, [quotes, searchTerm]);

  // Add event listener for focus to refresh data when returning to the page
  useEffect(() => {
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const handleFocus = () => {
    if (!authLoading && user) {
      console.log('Window focused, refreshing quotes data');
      fetchQuotes();
    }
  };
  
  // Add event listener for visibility change to refresh data when tab becomes visible
  const handleVisibilityChange = () => {
    if (!document.hidden && !authLoading && user) {
      console.log('Tab became visible, refreshing quotes data');
      fetchQuotes();
    }
  };

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      
      // First fetch quotes with the authenticated fetcher
      const response = await fetcher('/api/quotes?include_customer=true').then(r=>r.json());
      console.log('Fetched quotes response:', response);
      
      // Handle the new standardized API response format
      const quotesData = response.data || response;
      
      // Get unique customer IDs to avoid duplicate API calls
      const uniqueCustomerIds = [...new Set(
        quotesData
          .filter(quote => quote.customer_id)
          .map(quote => quote.customer_id)
      )];
      
      console.log('Unique customer IDs to fetch:', uniqueCustomerIds);
      
      // Fetch all customers at once to avoid API loops
      const customersMap = new Map();
      
      if (uniqueCustomerIds.length > 0) {
        try {
          // Fetch all customers in parallel but limit to avoid overwhelming the API
          const customerPromises = uniqueCustomerIds.map(async (customerId) => {
            try {
              const customerResponse = await fetcher(`/api/customers?id=${customerId}`);
              if (customerResponse.ok) {
                const customerData = await customerResponse.json();
                const customer = customerData.data || customerData;
                return { customerId, customer };
              } else {
                console.error(`Customer fetch failed for ${customerId} with status:`, customerResponse.status);
                return { customerId, customer: null };
              }
            } catch (error) {
              console.error(`Error fetching customer ${customerId}:`, error);
              return { customerId, customer: null };
            }
          });
          
          const customerResults = await Promise.all(customerPromises);
          
          // Build customers map
          customerResults.forEach(({ customerId, customer }) => {
            customersMap.set(customerId, customer);
          });
          
          console.log('Fetched customers:', customersMap.size);
        } catch (error) {
          console.error('Error fetching customers:', error);
        }
      }
      
      // Now map quotes with their customer data - ensure stable object references
      const quotesWithCustomers = quotesData.map(quote => {
        const baseQuote = {
          ...quote,
          // Ensure ID is always present and stable
          id: quote.id || `temp-${Date.now()}-${Math.random()}`,
          customer: null,
          customer_name: null
        };
        
        if (quote.customer_id && customersMap.has(quote.customer_id)) {
          const customer = customersMap.get(quote.customer_id);
          baseQuote.customer = customer;
          baseQuote.customer_name = customer ?
            ([customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || customer.name || null)
            : null;
        }
        
        return baseQuote;
      });
      
      // Set quotes state once with complete data to prevent DOM reconciliation issues
      setQuotes(quotesWithCustomers);
      console.log('Quotes with customer data set:', quotesWithCustomers.length);
      setError(null);
    } catch (err) {
      console.error('Error fetching quotes:', err);
      setError('Fehler beimladen von Angeboten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  const handleGeneratePdf = async (quote) => {
    try {
      setPdfLoading(true);
      setProcessingQuoteId(quote.id);

      // SOLUTION 1: Fetch complete quote data with customer information using authenticated fetcher
      console.log('Fetching complete quote data with customer info for PDF generation...');
      
      // Use the authenticated fetcher directly instead of quotesAPI.get to avoid auth issues
      const response = await fetcher(`/api/quotes/${quote.id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch quote: ${response.status}`);
      }
      const responseData = await response.json();
      const quoteData = responseData.data || responseData;
      
      // Fetch customer data separately using the authenticated fetcher
      let completeQuote = { ...quoteData };
      if (quoteData.customer_id) {
        try {
          // Fix: Use query parameter format instead of path parameter
          const customerResponse = await fetcher(`/api/customers?id=${quoteData.customer_id}`);
          if (customerResponse.ok) {
            const customerData = await customerResponse.json();
            const customer = customerData.data || customerData;
            
            console.log('Customer data fetched:', customer);
            
            completeQuote = {
              ...quoteData,
              customer: customer,
              customer_name: customer ?
                ([customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || customer.name || null)
                : null,
              customer_address: customer?.address || quoteData.location || null
            };
            
            console.log('Complete quote with customer data:', {
              customer_name: completeQuote.customer_name,
              customer_address: completeQuote.customer_address,
              customer: completeQuote.customer
            });
          } else {
            console.error('Customer fetch failed with status:', customerResponse.status);
          }
        } catch (customerError) {
          console.error('Error fetching customer data:', customerError);
        }
      }
      
      console.log('Complete quote data fetched:', completeQuote);

      // Use fetched craftsman data (includes pdf_settings)
      if (!craftsmanData) {
        console.error('Craftsman data not loaded yet');
        alert('Bitte warten Sie, bis die Profildaten geladen sind.');
        return;
      }

      console.log('Craftsman data with pdf_settings:', craftsmanData);
      
      // Import PDF generator and call directly
      const pdfModule = await import('../../lib/utils/pdfGenerator');
      const pdfGenerator = pdfModule.default || pdfModule;
      
      // Generate PDF with full data
      await pdfGenerator.generateQuotePdf(completeQuote, craftsmanData);
      console.log('German-style quote PDF generated successfully');

    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Fehler beim Erstellen des PDFs. Bitte versuchen Sie es später erneut.');

      // Clear error after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setPdfLoading(false);
      setProcessingQuoteId(null);
    }
  };

  const handleStatusUpdate = async (quoteId, newStatus) => {
    try {
      setUpdatingStatus(true);
      setStatusUpdateId(quoteId);

      // Update the quote status
      await quotesAPI.update(quoteId, { status: newStatus });

      // Refresh quotes data
      fetchQuotes();

      setSuccess(`Angebotsstatus erfolgreich auf ${newStatus} aktualisiert`);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Error updating quote status:', err);
      setError('Fehler beim Aktualisieren des Angebotsstatus. Bitte versuchen Sie es später erneut.');

      // Clear error message after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setUpdatingStatus(false);
      setStatusUpdateId(null);
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();

    // Confirm before deleting
    if (!window.confirm('Sind Sie sicher, dass Sie dieses Angebot löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      setDeletingId(id);

      // Delete the quote
      await quotesAPI.remove(id);

      // Remove the deleted quote from state
      setQuotes(prevQuotes => prevQuotes.filter(quote => quote.id !== id));

      setSuccess('Angebot erfolgreich gelöscht');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Error deleting quote:', err);
      setError('Fehler beim Löschen des Angebots. Bitte versuchen Sie es später erneut.');

      // Clear error message after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleConvertToInvoice = async (quoteId) => {
    try {
      setConverting(true);
      setConvertingId(quoteId);

      // Convert quote to invoice using the dedicated API method
      const response = await quotesAPI.convertToInvoice(quoteId);

      console.log('Angebot erfolgreich in Rechnung umgewandelt:', response);

      // Show success message
      setSuccess('Angebot erfolgreich in Rechnung umgewandelt');

      // Refresh quotes data to remove the converted quote
      fetchQuotes();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);

      // Redirect to the new invoice page if a new invoice was created
      if (response && response.newInvoice && response.newInvoice.id) {
        router.push(`/invoices/${response.newInvoice.id}`);
      }
    } catch (err) {
      console.error('Error converting quote to invoice:', err);
      setError('Fehler beim Umwandeln des Angebots in eine Rechnung. Bitte versuchen Sie es später erneut.');

      // Clear error message after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setConverting(false);
      setConvertingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-700/20 text-yellow-400';
      case 'approved':
        return 'bg-green-700/20 text-green-400';
      case 'rejected':
        return 'bg-red-700/20 text-red-400';
      case 'expired':
        return 'bg-gray-700/20 text-gray-400';
      default:
        return 'bg-blue-700/20 text-blue-400';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      <Header title="Angebote" />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          <div className="bg-white/5 rounded-lg border border-white/10 p-6 mb-8">
            {/* Header with title and new quote button */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
              <h1 className="text-2xl font-bold text-white">Angebote</h1>
              <Link 
                href="/quotes/new" 
                className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Neues Angebot
              </Link>
            </div>

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
            
            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Angebote suchen..."
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
            </div>

            {/* Loading, empty state, or quote list */}
            {loading ? (
              <div className="flex justify-center my-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
              </div>
            ) : filteredQuotes.length === 0 ? (
              <div className="text-center py-12">
                {searchTerm ? (
                  <div>
                    <p className="text-white/70 text-lg mb-3">Keine Angebote entsprechen Ihren Suchkriterien</p>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-[#ffcb00] hover:underline"
                    >
                      Suche zurücksetzen
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-white/70 text-lg mb-4">Sie haben noch keine Angebote</p>
                    <Link
                      href="/quotes/new"
                      className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg shadow text-sm font-medium inline-flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                      Erstes Angebot erstellen
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredQuotes.map((quote, index) => (
                  <div key={`quote-${quote.id}-${index}`} className="bg-white/5 rounded-lg overflow-hidden border border-white/10">
                    <div className="p-5">
                      <div className="flex justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-lg text-white">
                            {quote.customer_name || 'Kein Kundenname'}{' '}
                            <span className="text-sm text-white/60">(Angebot {quote.quote_number_formatted || quote.quote_number || `#${String(quote.id).substring(0, 8)}`})</span>
                          </h3>
                        </div>
                        
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(quote.status)}`}>
                            {quote.status === 'pending' ? 'Ausstehend' : 
                             quote.status === 'accepted' ? 'Akzeptiert' : 
                             quote.status === 'rejected' ? 'Abgelehnt' : 
                             quote.status === 'expired' ? 'Abgelaufen' : 
                             quote.status ? quote.status.charAt(0).toUpperCase() + quote.status.slice(1) : 'Unbekannt'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-white/70 mb-3">
                        {quote.description || 'Keine Beschreibung verfügbar'}
                      </div>
                      
                      <div className="font-medium text-xl text-[#ffcb00] mb-4">
                        €{typeof quote.total_amount === 'number' ? quote.total_amount.toFixed(2) : 
                           parseFloat(quote.total_amount) ? parseFloat(quote.total_amount).toFixed(2) : '0.00'}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-4 text-sm mb-4">
                        <div>
                          <span className="text-white/40">Erstellt:</span>
                          <div className="text-white/70">{formatDate(quote.created_at)}</div>
                        </div>
                        <div>
                          <span className="text-white/40">Gültig bis:</span>
                          <div className="text-white/70">{formatDate(quote.due_date)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-between gap-2 p-4 border-t border-white/10">
                      <Link 
                        href={`/quotes/${quote.id}`}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        Details anzeigen
                      </Link>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/invoices/new?quote_id=${quote.id}`}
                          className="px-3 py-1.5 flex-grow sm:flex-grow-0 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                          </svg>
                          Rechnung erstellen
                        </Link>
                        
                        <button
                          onClick={() => handleGeneratePdf(quote)}
                          disabled={pdfLoading && processingQuoteId === quote.id}
                          className={`px-3 py-1.5 flex-grow sm:flex-grow-0 ${pdfLoading && processingQuoteId === quote.id ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed' : 'bg-[#ffcb00] hover:bg-[#e6b800] text-black cursor-pointer'} text-sm font-medium rounded-lg transition-colors flex items-center justify-center`}
                        >
                          {pdfLoading && processingQuoteId === quote.id ? (
                            <>
                              <span className="mr-2 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                              Verarbeitung...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              PDF herunterladen
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={(e) => handleDelete(quote.id, e)}
                          disabled={deletingId === quote.id}
                          className="px-3 py-1.5 flex-grow sm:flex-grow-0 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                        >
                          {deletingId === quote.id ? (
                            <>
                              <span className="mr-2 h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>
                              Löschen...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
