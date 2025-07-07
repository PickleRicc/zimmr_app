'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { invoicesAPI, customersAPI, appointmentsAPI } from '../../lib/api';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import MaterialSelector from '../../components/MaterialSelector';

export default function InvoiceDetailPage({ params }) {
  const invoiceId = use(params).id;
  
  // Use the authentication hook
  const { user, loading: authLoading } = useRequireAuth();
  const authedFetch = useAuthedFetch();
  
  const [invoice, setInvoice] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [formData, setFormData] = useState({
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
    appointment_id: '',
    materials: [],
    total_materials_price: '0.00'
  });
  
  const router = useRouter();

  // Fetch invoice data when user is authenticated
  useEffect(() => {
    if (!authLoading && user && invoiceId) {
      fetchInvoice();
      fetchCustomers();
    }
  }, [user, authLoading, invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await authedFetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch invoice: ${response.statusText}`);
      }
      
      // Handle standardized API response format
      const responseData = await response.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const data = responseData.data !== undefined ? responseData.data : responseData;
      console.log('Fetched invoice:', data);
      
      // Display success message if available
      if (responseData.message) {
        console.log('API Message:', responseData.message);
      }
      
      // DEBUGGING: Log materials information when invoice is fetched
      console.log('========= MATERIALS DATA DEBUG (Invoice Fetch) =========');
      console.log('Fetched invoice.materials:', data.materials);
      console.log('Materials valid array?', Array.isArray(data.materials));
      console.log('Materials length:', Array.isArray(data.materials) ? data.materials.length : 0);
      console.log('Total materials price:', data.total_materials_price);
      
      // Calculate total materials price if needed (in case it's not properly set)
      let calculatedMaterialsPrice = 0;
      if (Array.isArray(data.materials) && data.materials.length > 0) {
        calculatedMaterialsPrice = data.materials.reduce((total, material) => {
          return total + (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
        }, 0);
        console.log('Calculated materials price from array:', calculatedMaterialsPrice);
        
        // If there's a significant difference between the stored total and calculated total
        if (Math.abs(calculatedMaterialsPrice - parseFloat(data.total_materials_price || 0)) > 0.01) {
          console.warn('Warning: Calculated materials price differs from stored value');
        }
      }
      console.log('========= END MATERIALS DEBUG =========');
      setInvoice(data);
      
      // Initialize form data with invoice data
      setFormData({
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
        appointment_id: data.appointment_id || '',
        materials: data.materials || [],
        total_materials_price: data.total_materials_price || '0.00'
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
      const response = await authedFetch(`/api/appointments/${appointmentId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch appointment: ${response.statusText}`);
      }
      
      // Handle standardized API response format
      const responseData = await response.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const data = responseData.data !== undefined ? responseData.data : responseData;
      setAppointment(data);
      
      // Log any API message
      if (responseData.message) {
        console.log('Appointment API Message:', responseData.message);
      }
    } catch (err) {
      console.error('Error fetching appointment:', err);
      // Don't set error here to avoid overriding invoice fetch errors
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await authedFetch('/api/customers');
      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Handle standardized API response format
      const responseData = response.status === 404 ? { data: [] } : await response.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const data = responseData.data !== undefined ? responseData.data : responseData;
      setCustomers(Array.isArray(data) ? data : []);
      
      // Log any API message
      if (responseData.message) {
        console.log('Customers API Message:', responseData.message);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to load customers');
    }
  };

  // Calculate total price of materials
  const calculateMaterialsTotal = (materials = []) => {
    return materials.reduce((total, material) => {
      return total + (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    }, 0).toFixed(2);
  };

  // Handle materials selection changes
  const handleMaterialsChange = (materials) => {
    const materialsTotal = calculateMaterialsTotal(materials);
    
    setFormData(prev => {
      const serviceTotal = parseFloat(prev.amount) || 0;
      const taxAmount = prev.vat_exempt ? 0 : (serviceTotal * 0.19).toFixed(2);
      const subtotal = (serviceTotal + parseFloat(taxAmount)).toFixed(2);
      const totalAmount = (parseFloat(subtotal) + parseFloat(materialsTotal)).toFixed(2);
      
      return {
        ...prev,
        materials: materials,
        total_materials_price: materialsTotal,
        total_amount: totalAmount
      };
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
        total_amount: parseFloat(formData.total_amount),
        // CRITICAL: Explicitly include materials array for backend storage
        materials: Array.isArray(formData.materials) ? formData.materials : [],
        total_materials_price: parseFloat(formData.total_materials_price || 0).toFixed(2)
      };
      
      console.log('Materials data being sent to backend for update:', invoiceData.materials);
      
      console.log('Submitting invoice update:', invoiceData);
      
      const response = await authedFetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      });
      
      if (!response.ok) {
        // Try to extract error message from standardized response
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to update invoice: ${response.statusText}`);
      }
      
      // Handle standardized API response format
      const responseData = await response.json();
      
      // Extract data, supporting both standardized and legacy formats
      const result = responseData.data !== undefined ? responseData.data : responseData;
      console.log('Invoice updated:', result);
      
      // Display success message if available
      if (responseData.message) {
        console.log('API Success Message:', responseData.message);
      }
      
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
      
      if (!invoice) {
        throw new Error('PDF kann nicht generiert werden. Rechnungs-/Angebotsdaten fehlen.');
      }
      
      // Import the PDF generator utility - FIXED: path was incorrect
      console.log('Importing PDF generator...');
      const pdfModule = await import('../../../lib/utils/pdfGenerator');
      const pdfGenerator = pdfModule.default || pdfModule;

      // Debug materials data for PDF generation
      console.log('========= MATERIALS DATA DEBUG (Invoice Detail PDF) =========');
      console.log('Invoice.materials:', invoice.materials);
      console.log('FormData.materials:', formData.materials);
      console.log('Materials array?', Array.isArray(formData.materials));
      console.log('Materials length:', Array.isArray(formData.materials) ? formData.materials.length : 0);
      console.log('Total materials price:', formData.total_materials_price);
      
      // CRITICAL FIX: If materials array is missing but we have the ID, try to fetch fresh materials
      if ((!Array.isArray(formData.materials) || formData.materials.length === 0) && invoiceId) {
        try {
          console.log('Attempting to fetch fresh materials for invoice ID:', invoiceId);
          // Explicit request to fetch materials for this invoice
          const materialsResponse = await authedFetch(`/api/invoices/${invoiceId}?materials=true`);
          if (materialsResponse.ok) {
            const freshData = await materialsResponse.json();
            if (Array.isArray(freshData.materials) && freshData.materials.length > 0) {
              console.log('Successfully retrieved materials from API:', freshData.materials.length);
              formData.materials = freshData.materials;
            }
          }
        } catch (err) {
          console.warn('Failed to fetch fresh materials:', err);
          // Continue with empty materials
        }
      }
      
      console.log('Final materials for PDF:', formData.materials);
      console.log('========= END MATERIALS DEBUG =========');

      // CRITICAL FIX: Prepare data with materials consistency check
      const invoiceDataForPdf = {
        ...formData,
        // Use materials array if we have one, otherwise create placeholder from total price
        materials: Array.isArray(formData.materials) && formData.materials.length > 0
          ? formData.materials
          : (formData.total_materials_price && parseFloat(formData.total_materials_price) > 0 
              ? [{
                  name: 'Materialien',
                  quantity: 1,
                  unit: 'Pauschal',
                  unit_price: parseFloat(formData.total_materials_price)
                }] 
              : [])
      };

      // Generate PDF using the enhanced data
      await pdfGenerator.generateInvoicePdf(invoiceDataForPdf, craftsmanData);
      
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
    <>
      <Header />
      <div className="flex-1 bg-black">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center">
              <svg className="w-7 h-7 mr-2 text-[#ffcb00]" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              Rechnungsdetails
            </h1>
            <div className="flex space-x-3">
              <Link href="/invoices" className="text-[#ffcb00] hover:text-[#e6b800] transition-colors">
                &larr; Zurück zu Rechnungen
              </Link>
            </div>
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
                    
                    {/* Materials Section */}
                    <div className="mt-8">
                      <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m-8-4l8 4m8 4l-8 4m-8-4l8 4m8-11v11"></path>
                        </svg>
                        Materialien
                      </h3>
                      {editing ? (
                        <div className="bg-[#2a2a2a]/50 rounded-xl p-4 border border-[#2a2a2a]">
                          <MaterialSelector 
                            selectedMaterials={formData.materials || []}
                            onChange={handleMaterialsChange}
                          />
                        </div>
                      ) : (
                        <div className="bg-[#2a2a2a]/50 rounded-xl p-4 border border-[#2a2a2a]">
                          {invoice.materials && invoice.materials.length > 0 ? (
                            <table className="w-full">
                              <thead>
                                <tr className="text-left text-sm text-white/60">
                                  <th className="pb-2">Name</th>
                                  <th className="pb-2">Menge</th>
                                  <th className="pb-2">Einheit</th>
                                  <th className="pb-2">Preis (€)</th>
                                  <th className="pb-2">Gesamt (€)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invoice.materials.map((material, index) => {
                                  const total = (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
                                  return (
                                    <tr key={index} className="border-t border-white/10">
                                      <td className="py-3">{material.name}</td>
                                      <td className="py-3">{material.quantity}</td>
                                      <td className="py-3">{material.unit}</td>
                                      <td className="py-3">€{parseFloat(material.unit_price).toFixed(2)}</td>
                                      <td className="py-3">€{total.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                                <tr className="border-t border-white/10">
                                  <td colSpan="4" className="py-3 text-right font-bold">Materialien Gesamt:</td>
                                  <td className="py-3 font-bold">€{parseFloat(invoice.total_materials_price || 0).toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-white/60">Keine Materialien</p>
                          )}
                        </div>
                      )}
                    </div>
                    
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
    </>
  );
}
