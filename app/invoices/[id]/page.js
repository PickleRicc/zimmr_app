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
  const [craftsmanData, setCraftsmanData] = useState(null);
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
    status: 'pending',
    service_date: '',
    location: '',
    vat_exempt: false,
    type: 'invoice',
    appointment_id: '',
    materials: [],
    total_materials_price: '0.00',
    // German compliance fields
    invoice_type: 'final',
    tax_number: '',
    vat_id: '',
    small_business_exempt: false,
    payment_terms_days: 14,
    issue_date: '',
    service_period_start: '',
    service_period_end: '',
    reverse_charge: false,
    legal_footer_text: ''
  });
  
  const router = useRouter();

  // Fetch invoice data when user is authenticated
  useEffect(() => {
    if (!authLoading && user && invoiceId) {
      fetchInvoice();
      fetchCustomers();
      fetchCraftsmanData();
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
      console.log('Materials in fetched data:', data.materials);
      console.log('Materials type:', typeof data.materials);
      console.log('Materials is array:', Array.isArray(data.materials));
      
      // Display success message if available
      if (responseData.message) {
        console.log('API Message:', responseData.message);
      }
      
      // Calculate total materials price if needed (in case it's not properly set)
      let calculatedMaterialsPrice = 0;
      if (Array.isArray(data.materials) && data.materials.length > 0) {
        calculatedMaterialsPrice = data.materials.reduce((total, material) => {
          return total + (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
        }, 0);
      }
      setInvoice(data);
      
      // Initialize form data with invoice data
      const materialsArray = Array.isArray(data.materials) ? data.materials : [];
      const calculatedTotal = materialsArray.length > 0 ? calculatedMaterialsPrice.toFixed(2) : (data.total_materials_price || '0.00');
      
      console.log('Setting form data with materials:', materialsArray);
      console.log('Materials price:', calculatedTotal);
      
      setFormData({
        customer_id: String(data.customer_id),
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
        materials: materialsArray,
        total_materials_price: calculatedTotal,
        // German compliance fields
        invoice_type: data.invoice_type || 'final',
        tax_number: data.tax_number || '',
        vat_id: data.vat_id || '',
        small_business_exempt: data.small_business_exempt || false,
        payment_terms_days: data.payment_terms_days || 14,
        issue_date: data.issue_date ? new Date(data.issue_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        service_period_start: data.service_period_start ? new Date(data.service_period_start).toISOString().split('T')[0] : '',
        service_period_end: data.service_period_end ? new Date(data.service_period_end).toISOString().split('T')[0] : '',
        reverse_charge: data.reverse_charge || false,
        legal_footer_text: data.legal_footer_text || ''
      });
      
      // If there's an appointment_id, fetch the appointment details
      if (data.appointment_id) {
        fetchAppointment(data.appointment_id);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching invoice:', err);
      const errorMessage = err.message.includes('404') 
        ? 'Rechnung nicht gefunden.'
        : err.message.includes('403') 
        ? 'Keine Berechtigung für diese Rechnung.'
        : 'Fehler beim Laden der Rechnung. Bitte versuchen Sie es später erneut.';
      setError(errorMessage);
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
      
      // Extract customers array from the response
      let customersArray = [];
      if (responseData.data && Array.isArray(responseData.data.customers)) {
        // New format: { data: { customers: [...], pagination: {...} } }
        customersArray = responseData.data.customers;
      } else if (Array.isArray(responseData.customers)) {
        // Direct format: { customers: [...], pagination: {...} }
        customersArray = responseData.customers;
      } else if (Array.isArray(responseData.data)) {
        // Legacy format: { data: [...] }
        customersArray = responseData.data;
      } else if (Array.isArray(responseData)) {
        // Direct array format: [...]
        customersArray = responseData;
      }
      
      console.log('Fetched customers:', customersArray);
      setCustomers(customersArray);
      
      // Log any API message
      if (responseData.message) {
        console.log('Customers API Message:', responseData.message);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to load customers');
    }
  };

  const fetchCraftsmanData = async () => {
    try {
      const response = await authedFetch('/api/craftsmen');
      if (!response.ok) {
        throw new Error(`Failed to fetch craftsman data: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      const data = responseData.data !== undefined ? responseData.data : responseData;
      setCraftsmanData(data);
    } catch (err) {
      console.error('Error fetching craftsman data:', err);
      // Set default craftsman data if fetch fails
      setCraftsmanData({
        name: user?.user_metadata?.full_name || 'Handwerker',
        email: user?.email || '',
        phone: user?.user_metadata?.phone || '',
        address: '',
        tax_number: '',
        vat_id: ''
      });
    }
  };

  // Calculate total price of materials
  const calculateMaterialsTotal = (materials = []) => {
    return materials.reduce((total, material) => {
      return total + (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    }, 0);
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updatedData = { ...prev, [name]: newValue };
      
      // Special handling for VAT exempt, amount, and tax_amount changes
      if (name === 'vat_exempt' || name === 'amount') {
        return handleVatChange(updatedData);
      }
      
      // Special handling for manual tax_amount changes - recalculate total
      if (name === 'tax_amount') {
        const amount = parseFloat(updatedData.amount) || 0;
        const materialTotal = parseFloat(updatedData.total_materials_price) || 0;
        const taxAmount = parseFloat(updatedData.tax_amount) || 0;
        const subtotal = amount + materialTotal;
        updatedData.total_amount = (subtotal + taxAmount).toFixed(2);
        return updatedData;
      }
      
      return updatedData;
    });
  };

  // Handle VAT calculations when amount or vat_exempt changes
  const handleVatChange = (data) => {
    const amount = parseFloat(data.amount) || 0;
    const materialTotal = parseFloat(data.total_materials_price) || 0;
    const subtotal = amount + materialTotal;
    
    if (data.vat_exempt) {
      data.tax_amount = '0.00';
      data.total_amount = subtotal.toFixed(2);
    } else {
      const taxAmount = subtotal * 0.19; // 19% VAT
      data.tax_amount = taxAmount.toFixed(2);
      data.total_amount = (subtotal + taxAmount).toFixed(2);
    }
    
    return data;
  };

  // Handle materials selection changes
  const handleMaterialsChange = (materials) => {
    console.log('Materials changed:', materials);
    
    // Calculate total materials price (returns number)
    const totalMaterialsPrice = calculateMaterialsTotal(materials);
    
    // Update form data with new materials and total
    setFormData(prev => {
      const amount = parseFloat(prev.amount) || 0;
      const materialTotal = parseFloat(prev.total_materials_price) || 0;
      const subtotal = amount + totalMaterialsPrice;
      const taxAmount = prev.vat_exempt ? 0 : subtotal * 0.19;
      
      return {
        ...prev,
        materials: materials,
        total_materials_price: totalMaterialsPrice.toFixed(2),
        tax_amount: taxAmount.toFixed(2),
        total_amount: (subtotal + taxAmount).toFixed(2)
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
      
      // Prepare data for submission with proper date handling
      const invoiceData = {
        ...formData,
        amount: parseFloat(formData.amount),
        tax_amount: parseFloat(formData.tax_amount) || 0,
        total_amount: parseFloat(formData.total_amount),
        // Handle date fields - convert empty strings to null
        due_date: formData.due_date || null,
        service_date: formData.service_date || null,
        issue_date: formData.issue_date || null,
        service_period_start: formData.service_period_start || null,
        service_period_end: formData.service_period_end || null,
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
    return new Date(dateString).toLocaleDateString('de-DE');
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
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-6">Rechnung bearbeiten</h3>
                    <form onSubmit={handleSubmit}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        
                        {/* Customer Selection */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Kunde *
                          </label>
                          <select
                            name="customer_id"
                            value={formData.customer_id}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
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

                        {/* Invoice Type */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Rechnungstyp
                          </label>
                          <select
                            name="invoice_type"
                            value={formData.invoice_type}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                          >
                            <option value="final">Schlussrechnung</option>
                            <option value="partial">Teilrechnung</option>
                            <option value="down_payment">Anzahlungsrechnung</option>
                          </select>
                        </div>

                        {/* Issue Date */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Rechnungsdatum *
                          </label>
                          <input
                            type="date"
                            name="issue_date"
                            value={formData.issue_date}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                            required
                          />
                        </div>

                        {/* Service Date */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Leistungsdatum
                          </label>
                          <input
                            type="date"
                            name="service_date"
                            value={formData.service_date}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                          />
                        </div>

                        {/* Due Date */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Fälligkeitsdatum
                          </label>
                          <input
                            type="date"
                            name="due_date"
                            value={formData.due_date}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                          />
                        </div>

                        {/* Payment Terms */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Zahlungsziel (Tage)
                          </label>
                          <input
                            type="number"
                            name="payment_terms_days"
                            value={formData.payment_terms_days}
                            onChange={handleChange}
                            min="1"
                            max="365"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                          />
                        </div>

                        {/* Location */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Arbeitsort
                          </label>
                          <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="z.B. Musterstraße 123, 12345 Berlin"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                          />
                        </div>

                        {/* Materials Section */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-sm font-medium mb-2 text-gray-300">
                            Materialien
                          </label>
                          <MaterialSelector
                            selectedMaterials={formData.materials}
                            onChange={handleMaterialsChange}
                            className="mb-4"
                          />
                          <div className="text-right">
                            <span className="text-sm text-gray-400">
                              Materialien Gesamt: <span className="text-[#ffcb00] font-medium">€{formData.total_materials_price}</span>
                            </span>
                          </div>
                        </div>

                        {/* Service Amount */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Dienstleistung (€) *
                          </label>
                          <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            step="0.01"
                            min="0"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                            required
                          />
                        </div>

                        {/* VAT Exempt Checkbox */}
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            name="vat_exempt"
                            checked={formData.vat_exempt}
                            onChange={handleChange}
                            className="mr-2 h-4 w-4 text-[#ffcb00] focus:ring-[#ffcb00] border-gray-600 rounded bg-gray-800"
                          />
                          <label className="text-sm text-gray-300">
                            MwSt.-befreit (Kleinunternehmer)
                          </label>
                        </div>

                        {/* Tax Amount */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            MwSt. Betrag (€)
                          </label>
                          <input
                            type="number"
                            name="tax_amount"
                            value={formData.tax_amount}
                            onChange={handleChange}
                            step="0.01"
                            min="0"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                            readOnly={formData.vat_exempt}
                          />
                        </div>

                        {/* Total Amount */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Gesamtbetrag (€) *
                          </label>
                          <input
                            type="number"
                            name="total_amount"
                            value={formData.total_amount}
                            step="0.01"
                            min="0"
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white font-medium"
                            readOnly
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Automatisch berechnet: Dienstleistung + Materialien + MwSt.
                          </p>
                        </div>

                        {/* Status */}
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Status
                          </label>
                          <select
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                          >
                            <option value="pending">Ausstehend</option>
                            <option value="paid">Bezahlt</option>
                            <option value="overdue">Überfällig</option>
                            <option value="cancelled">Storniert</option>
                          </select>
                        </div>

                        {/* Notes */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-sm font-medium mb-1 text-gray-300">
                            Notizen / Beschreibung
                          </label>
                          <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="4"
                            placeholder="Beschreibung der erbrachten Leistungen..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white resize-none"
                          />
                        </div>

                        {/* German Compliance Fields */}
                        <div className="col-span-1 md:col-span-2 border-t border-gray-700 pt-4 mt-4">
                          <h4 className="text-lg font-medium text-white mb-4">Deutsche Steuerfelder (Optional)</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-300">
                                Steuernummer
                              </label>
                              <input
                                type="text"
                                name="tax_number"
                                value={formData.tax_number}
                                onChange={handleChange}
                                placeholder="z.B. 123/456/78901"
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-300">
                                USt-IdNr.
                              </label>
                              <input
                                type="text"
                                name="vat_id"
                                value={formData.vat_id}
                                onChange={handleChange}
                                placeholder="z.B. DE123456789"
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-8 flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => setEditing(false)}
                          className="px-6 py-2.5 border border-gray-600 rounded-xl text-gray-300 hover:bg-gray-800 transition-colors"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-6 py-2.5 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:transform-none"
                        >
                          {submitting ? 'Speichern...' : 'Änderungen speichern'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="bg-[#2a2a2a]/70 backdrop-blur-md rounded-2xl shadow-xl border border-[#2a2a2a] overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white">
                        {invoice.invoice_number_formatted ? `Rechnung Nr. ${invoice.invoice_number_formatted}` : `Rechnung #${invoice.id}`}
                        {invoice.invoice_type && invoice.invoice_type !== 'final' && (
                          <span className="text-sm text-white/60 ml-2">
                            ({invoice.invoice_type === 'partial' ? 'Teilrechnung' : 
                              invoice.invoice_type === 'down_payment' ? 'Anzahlungsrechnung' : ''})
                          </span>
                        )}
                      </h2>
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
                        <p className="text-white">{formatDate(invoice.issue_date || invoice.created_at)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Fälligkeitsdatum</h3>
                        <p className="text-white">{formatDate(invoice.due_date)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Leistungszeitraum</h3>
                        <p className="text-white">
                          {invoice.service_period_start && invoice.service_period_end ? (
                            `${formatDate(invoice.service_period_start)} - ${formatDate(invoice.service_period_end)}`
                          ) : (
                            formatDate(invoice.service_date || invoice.service_period_start)
                          )}
                        </p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Dienstleistung</h3>
                        <p className="text-white">€{parseFloat(invoice.amount).toFixed(2)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Materialien</h3>
                        <p className="text-white">€{parseFloat(invoice.total_materials_price || 0).toFixed(2)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">MwSt.</h3>
                        <p className="text-white">€{parseFloat(invoice.tax_amount || 0).toFixed(2)}</p>
                      </div>
                      
                      <div className="p-2">
                        <h3 className="text-sm font-medium text-white/60 mb-2">Gesamtbetrag</h3>
                        <p className="text-white font-medium text-lg">€{parseFloat(invoice.total_amount).toFixed(2)}</p>
                      </div>
                      
                      {/* German Tax Information */}
                      {(invoice.tax_number || invoice.vat_id) && (
                        <div className="col-span-1 md:col-span-2 p-2 border-t border-[#2a2a2a] mt-4">
                          <h3 className="text-sm font-medium text-white/60 mb-2">Steuerliche Angaben</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {invoice.tax_number && (
                              <div>
                                <span className="text-white/60 text-sm">Steuernummer: </span>
                                <span className="text-white">{invoice.tax_number}</span>
                              </div>
                            )}
                            {invoice.vat_id && (
                              <div>
                                <span className="text-white/60 text-sm">USt-IdNr.: </span>
                                <span className="text-white">{invoice.vat_id}</span>
                              </div>
                            )}
                            {invoice.small_business_exempt && (
                              <div className="col-span-1 md:col-span-2">
                                <span className="text-[#ffcb00] text-sm">§19 UStG - Kleinunternehmerregelung</span>
                              </div>
                            )}
                            {invoice.reverse_charge && (
                              <div className="col-span-1 md:col-span-2">
                                <span className="text-[#ffcb00] text-sm">Reverse Charge Verfahren</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Payment Terms */}
                      {invoice.payment_terms_days && (
                        <div className="col-span-1 md:col-span-2 p-2">
                          <h3 className="text-sm font-medium text-white/60 mb-2">Zahlungsbedingungen</h3>
                          <p className="text-white">Zahlbar ohne Abzug innerhalb von {invoice.payment_terms_days} Tagen</p>
                        </div>
                      )}
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
                                {appointment.status === 'completed' ? 'Abgeschlossen' : 
                                 appointment.status === 'cancelled' ? 'Storniert' : 
                                 appointment.status === 'confirmed' ? 'Bestätigt' : 
                                 appointment.status === 'scheduled' ? 'Geplant' : 
                                 appointment.status === 'pending' ? 'Ausstehend' : 
                                 appointment.status?.charAt(0).toUpperCase() + appointment.status?.slice(1)}
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
                                <span>Termin-Details anzeigen</span>
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
