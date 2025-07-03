'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { invoicesAPI, customersAPI, appointmentsAPI } from '../../lib/api';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function InvoiceDetailPage({ params }) {
  const invoiceId = use(params).id;
  
  const [invoice, setInvoice] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [craftsmanId, setCraftsmanId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [formData, setFormData] = useState({
    craftsman_id: '',
    customer_id: '',
    amount: '',
    tax_amount: '',
    total_amount: '',
    notes: '',
    due_date: '',
    status: '',
    service_date: '',
    location: '',
    vat_exempt: false,
    type: 'invoice',
    appointment_id: ''
  });
  
  const router = useRouter();

  useEffect(() => {
    // Get craftsman ID from token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        
        // Check for craftsmanId in different possible formats
        let extractedCraftsmanId = null;
        if (tokenData.craftsmanId) {
          extractedCraftsmanId = tokenData.craftsmanId;
        } else if (tokenData.craftsman_id) {
          extractedCraftsmanId = tokenData.craftsman_id;
        } else if (tokenData.user && tokenData.user.craftsmanId) {
          extractedCraftsmanId = tokenData.user.craftsmanId;
        } else if (tokenData.user && tokenData.user.craftsman_id) {
          extractedCraftsmanId = tokenData.user.craftsman_id;
        }
        
        if (extractedCraftsmanId) {
          setCraftsmanId(extractedCraftsmanId);
          setFormData(prev => ({ ...prev, craftsman_id: extractedCraftsmanId }));
        } else {
          setError('Keine Handwerker-ID in Ihrem Konto gefunden. Bitte wenden Sie sich an den Support.');
        }
      } catch (err) {
        console.error('Error parsing token:', err);
        setError('Fehler bei der Authentifizierung Ihres Kontos. Bitte versuchen Sie es erneut.');
      }
    } else {
      setError('Sie sind nicht angemeldet. Bitte melden Sie sich an, um Rechnungsdetails anzuzeigen.');
    }
  }, []);

  useEffect(() => {
    if (craftsmanId && invoiceId) {
      fetchInvoice();
      fetchCustomers();
    }
  }, [craftsmanId, invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const data = await invoicesAPI.getById(invoiceId, craftsmanId);
      console.log('Fetched invoice:', data);
      setInvoice(data);
      
      // Initialize form data with invoice data
      setFormData({
        craftsman_id: data.craftsman_id,
        customer_id: data.customer_id,
        amount: data.amount,
        tax_amount: data.tax_amount || 0,
        total_amount: data.total_amount,
        notes: data.notes || '',
        due_date: data.due_date ? new Date(data.due_date).toISOString().split('T')[0] : '',
        status: data.status || 'pending',
        service_date: data.service_date ? new Date(data.service_date).toISOString().split('T')[0] : '',
        location: data.location || '',
        vat_exempt: data.vat_exempt || false,
        type: data.type || 'invoice',
        appointment_id: data.appointment_id || ''
      });
      
      // If there's an appointment_id, fetch the appointment details
      if (data.appointment_id) {
        fetchAppointment(data.appointment_id);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching invoice:', err);
      setError('Fehler beim Laden der Rechnung. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointment = async (appointmentId) => {
    try {
      const data = await appointmentsAPI.getById(appointmentId);
      console.log('Fetched appointment:', data);
      setAppointment(data);
    } catch (err) {
      console.error('Error fetching appointment:', err);
      // Don't set error here
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await customersAPI.getAll({ craftsman_id: craftsmanId });
      console.log('Fetched customers:', data);
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
      // Don't set error here to avoid overriding invoice fetch errors
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Auto-calculate total amount when amount or tax_amount changes
      if (name === 'amount' || name === 'tax_amount') {
        const amount = parseFloat(newData.amount) || 0;
        const taxAmount = parseFloat(newData.tax_amount) || 0;
        newData.total_amount = (amount + taxAmount).toFixed(2);
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.customer_id) {
      setError('Bitte wählen Sie einen Kunden aus');
      return;
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Bitte geben Sie einen gültigen Betrag ein');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Prepare data for submission
      const invoiceData = {
        ...formData,
        amount: parseFloat(formData.amount),
        tax_amount: parseFloat(formData.tax_amount) || 0,
        total_amount: parseFloat(formData.total_amount)
      };
      
      console.log('Submitting invoice update:', invoiceData);
      
      const result = await invoicesAPI.update(invoiceId, invoiceData);
      console.log('Invoice updated:', result);
      
      setInvoice(result);
      setSuccess(true);
      setEditing(false);
      
      // Clear success message after delay
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Error updating invoice:', err);
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren der Rechnung. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setPdfLoading(true);
      
      // Get craftsman data from localStorage if available
      const craftsmanData = {
        name: localStorage.getItem('userName') || 'ZIMMR Craftsman',
        email: localStorage.getItem('userEmail') || '',
        phone: '',
        address: '',
        // Add any other data from profile if available
        tax_id: localStorage.getItem('userTaxId') || '',
        iban: localStorage.getItem('userIban') || '',
        bic: localStorage.getItem('userBic') || ''
      };
      
      // Use our new German invoice PDF generator through the API
      await invoicesAPI.generatePdf(invoice, craftsmanData);
      
      console.log('German-style invoice PDF generated successfully');
      
    } catch (err) {
      console.error('Error generating German PDF:', err);
      alert('Failed to generate PDF. Please try again later.');
    } finally {
      setPdfLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-900/30 text-green-400 border border-green-800/50';
      case 'overdue':
        return 'bg-red-900/30 text-red-400 border border-red-800/50 animate-pulse';
      case 'pending':
        return 'bg-[#2a2a2a]/70 text-[#ffcb00] border border-[#2a2a2a]';
      case 'cancelled':
        return 'bg-gray-900/30 text-gray-400 border border-gray-800/50';
      case 'draft':
        return 'bg-[#2a2a2a]/70 text-white/70 border border-[#2a2a2a]';
      default:
        return 'bg-[#2a2a2a]/70 text-white/70 border border-[#2a2a2a]';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <div className="min-h-screen px-4 py-8">
        <main className="container mx-auto">
          <div className="mb-6">
            <Link 
              href="/invoices" 
              className="text-[#ffcb00] hover:text-[#e6b800] transition-colors"
            >
              &larr; Zurück zu Rechnungen
            </Link>
          </div>
          
          {error && (
            <div className="bg-[#2a2a2a]/70 backdrop-blur-md rounded-2xl shadow-xl border border-[#2a2a2a] overflow-hidden">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-[#2a2a2a]/70 backdrop-blur-md rounded-2xl shadow-xl border border-[#2a2a2a] overflow-hidden">
              Rechnung erfolgreich aktualisiert!
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
            </div>
          ) : invoice ? (
            <>
              {editing ? (
                <div className="bg-[#2a2a2a]/70 backdrop-blur-md rounded-2xl shadow-xl border border-[#2a2a2a] overflow-hidden">
                  <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Customer Selection */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium mb-1">
                          Kunde *
                        </label>
                        <select
                          name="customer_id"
                          value={formData.customer_id}
                          onChange={handleChange}
                          className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                          required
                        >
                          <option value="">Kunde auswählen</option>
                          {customers.map(customer => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name} {customer.email ? `(${customer.email})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Betrag (€) *
                        </label>
                        <input
                          type="number"
                          name="amount"
                          value={formData.amount}
                          onChange={handleChange}
                          step="0.01"
                          min="0"
                          className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                          required
                        />
                      </div>
                      
                      {/* Tax Amount */}
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          MwSt. Betrag (€)
                        </label>
                        <input
                          type="number"
                          name="tax_amount"
                          value={formData.tax_amount}
                          onChange={handleChange}
                          step="0.01"
                          min="0"
                          className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                        />
                      </div>
                      
                      {/* Total Amount (calculated) */}
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Gesamtbetrag (€) *
                        </label>
                        <input
                          type="number"
                          name="total_amount"
                          value={formData.total_amount}
                          onChange={handleChange}
                          step="0.01"
                          min="0"
                          className="w-full bg-[#1e3a5f] border border-[#2a4d76] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#e91e63] bg-opacity-50"
                          required
                          readOnly
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Automatisch berechnet aus Betrag + MwSt.
                        </p>
                      </div>
                      
                      {/* Due Date */}
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Fälligkeitsdatum
                        </label>
                        <input
                          type="date"
                          name="due_date"
                          value={formData.due_date}
                          onChange={handleChange}
                          className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                        />
                      </div>
                      
                      {/* Status */}
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Status
                        </label>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleChange}
                          className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                        >
                          <option value="pending">Ausstehend</option>
                          <option value="paid">Bezahlt</option>
                          <option value="overdue">Überfällig</option>
                        </select>
                      </div>
                      
                      {/* Notes */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium mb-1">
                          Notizen
                        </label>
                        <textarea
                          name="notes"
                          value={formData.notes}
                          onChange={handleChange}
                          rows="4"
                          className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                        ></textarea>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="px-5 py-2.5 border border-white/20 rounded-xl text-white hover:bg-white/5 transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2.5 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:transform-none"
                      >
                        {submitting ? 'Speichern...' : 'Änderungen speichern'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-[#2a2a2a]/70 backdrop-blur-md rounded-2xl shadow-xl border border-[#2a2a2a] overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-[#ffcb00]">Rechnung #{invoice.invoice_number || invoice.id}</h2>
                      <span className={`px-3 py-1 rounded-xl text-sm font-medium ${getStatusBadgeClass(invoice.status)}`}>
                        {invoice.status === 'overdue' ? 'ÜBERFÄLLIG' : 
                         invoice.status === 'paid' ? 'BEZAHLT' : 
                         invoice.status === 'pending' ? 'AUSSTEHEND' : 
                         invoice.status?.charAt(0).toUpperCase() + invoice.status?.slice(1) || 'Ausstehend'}
                      </span>
                    </div>
                    
                    {invoice.status === 'overdue' && (
                      <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#ffcb00]">
                          Diese Rechnung ist überfällig. Die Zahlung war am {formatDate(invoice.due_date)} fällig.
                        </span>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Kunde</h3>
                        <p className="text-white">{invoice.customer_name || 'N/A'}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Rechnungsdatum</h3>
                        <p className="text-white">{formatDate(invoice.created_at)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Fälligkeitsdatum</h3>
                        <p className="text-white">{formatDate(invoice.due_date)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Leistungsdatum</h3>
                        <p className="text-white">{formatDate(invoice.service_date)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Betrag</h3>
                        <p className="text-white">€{parseFloat(invoice.amount).toFixed(2)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">MwSt.</h3>
                        <p className="text-white">€{parseFloat(invoice.tax_amount || 0).toFixed(2)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Gesamtbetrag</h3>
                        <p className="text-white font-medium">€{parseFloat(invoice.total_amount).toFixed(2)}</p>
                      </div>
                    </div>
                    
                    {invoice.notes && (
                      <div className="mt-6">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Notizen</h3>
                        <p className="text-white whitespace-pre-line bg-[#2a2a2a]/50 p-4 rounded-xl border border-[#2a2a2a]">{invoice.notes}</p>
                      </div>
                    )}
                    
                    {appointment && (
                      <div className="mt-8">
                        <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          Verknüpfter Termin
                        </h3>
                        <div className="bg-[#2a2a2a]/50 rounded-xl p-4 border border-[#2a2a2a]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-2">
                              <span className="text-white/60 text-sm">Datum:</span>{' '}
                              <span className="text-white">{formatDate(appointment.scheduled_at)}</span>
                            </div>
                            <div className="p-2">
                              <span className="text-white/60 text-sm">Uhrzeit:</span>{' '}
                              <span className="text-white">{new Date(appointment.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="p-2">
                              <span className="text-white/60 text-sm">Status:</span>{' '}
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                appointment.status === 'completed' ? 'bg-green-900/30 text-green-400 border border-green-800/50' :
                                appointment.status === 'cancelled' ? 'bg-red-900/30 text-red-400 border border-red-800/50' :
                                'bg-[#2a2a2a]/70 text-[#ffcb00] border border-[#2a2a2a]'
                              }`}>
                                {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                              </span>
                            </div>
                            {appointment.service_type && (
                              <div className="p-2">
                                <span className="text-white/60 text-sm">Service:</span>{' '}
                                <span className="text-white">{appointment.service_type}</span>
                              </div>
                            )}
                            {appointment.location && (
                              <div className="p-2 col-span-1 md:col-span-2">
                                <span className="text-white/60 text-sm">Ort:</span>{' '}
                                <span className="text-white">{appointment.location}</span>
                              </div>
                            )}
                            <div className="p-2 col-span-1 md:col-span-2 mt-3">
                              <Link
                                href={`/appointments/${appointment.id}`}
                                className="text-sm text-[#ffcb00] hover:text-[#e6b800] transition-colors flex items-center w-fit"
                              >
                                <span>TerminDetails anzeigen</span>
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                                </svg>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-8 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="px-5 py-2.5 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5"
                      >
                        Rechnung bearbeiten
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleGeneratePdf}
                        disabled={pdfLoading}
                        className="px-5 py-2.5 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:transform-none"
                      >
                        {pdfLoading ? 'PDF wird erstellt...' : 'PDF erstellen'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-5 py-2.5 border border-white/20 rounded-xl text-white hover:bg-white/5 transition-all duration-300"
                      >
                        Zurück
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#132f4c] rounded-xl p-6 text-center">
              <p className="text-lg mb-4">Rechnung nicht gefunden</p>
              <Link 
                href="/invoices" 
                className="px-4 py-2 bg-[#e91e63] hover:bg-[#d81b60] text-white font-medium rounded-xl transition-colors"
              >
                Alle Rechnungen anzeigen
              </Link>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}
