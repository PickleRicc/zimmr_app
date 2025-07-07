'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import { getNumericCraftsmanId } from '../../../utils/id-mapper';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { generateInvoicePdf } from '../../../lib/utils/pdfGenerator';
import MaterialSelector from '../../components/MaterialSelector';

export default function NewQuotePage() {
  // Format date for better readability in the dropdown
  const formatAppointmentDate = (dateString) => {
    if (!dateString) return 'Kein Datum';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if parsing fails
      
      // Format: DD.MM.YYYY HH:MM (German format)
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Fehler beim Formatieren des Datums:', error);
      return dateString; // Return original if any error occurs
    }
  };
  
  const [formData, setFormData] = useState({
    craftsman_id: '',
    customer_id: '',
    amount: '',
    tax_amount: '',
    total_amount: '',
    notes: '',
    due_date: '',
    service_date: '',
    location: '',
    vat_exempt: false,
    type: 'quote', // Default to quote type
    appointment_id: '',
    materials: [], // Array to store selected materials
    total_materials_price: '0.00' // Total price of materials
  });
  
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [createdQuote, setCreatedQuote] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const fetcher = useAuthedFetch();

  useEffect(() => {
    if (authLoading || !user) return;

    const init = async () => {
      try {
        // Numeric craftsman ID derived from profile
        const numericId = await getNumericCraftsmanId(user);
        if (!numericId) {
          setError('Ihr Konto konnte keiner Handwerker-ID zugeordnet werden.');
          return;
        }

        // Persist in local state for submission
        setFormData(prev => ({ ...prev, craftsman_id: String(numericId) }));

        // Fetch customers & appointments in parallel
        await Promise.all([fetchCustomers(), fetchAppointments()]);

        // Optional: pre-fill form when navigated from appointment
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('from_appointment') === 'true') {
            const amountRaw = params.get('amount') || '';
            const amount = parseFloat(amountRaw) || 0;
            const tax = formData.vat_exempt ? 0 : amount * 0.19;
            const total = amount + tax;

            const due = new Date();
            due.setDate(due.getDate() + 30);

            setFormData(prev => ({
              ...prev,
              appointment_id: params.get('appointment_id') || '',
              customer_id: params.get('customer_id') || '',
              amount: amountRaw,
              tax_amount: tax.toFixed(2),
              total_amount: total.toFixed(2),
              due_date: due.toISOString().split('T')[0],
              service_date: params.get('service_date') || '',
              location: params.get('location') || '',
              notes: params.get('notes') || ''
            }));
          }
        }
      } catch (err) {
        console.error('Initial load error:', err);
        setError('Fehler beim Laden der Daten. Bitte versuchen Sie es später erneut.');
      }
    };

    init();
  }, [authLoading, user]);
   

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetcher('/api/customers');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP Error ${response.status}`);
      }
      
      // Handle standardized API response format
      const responseData = await response.json();
      console.log('Kunden geladen:', responseData);
      
      // Extract data, supporting both new standardized and legacy formats
      const customersData = responseData.data !== undefined ? responseData.data : responseData;
      setCustomers(Array.isArray(customersData) ? customersData : []);
      
      // Log any API message
      if (responseData.message) {
        console.log('Customers API Message:', responseData.message);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Kunden:', err);
      setError(err.message || 'Kunden konnten nicht geladen werden. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      // Fetch all appointments for this craftsman without filtering by status or invoice association
      const response = await fetcher('/api/appointments');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP Error ${response.status}`);
      }
      
      // Handle standardized API response format
      const responseData = await response.json();
      console.log('Termine geladen:', responseData);
      
      // Extract data, supporting both new standardized and legacy formats
      const appointmentsData = responseData.data !== undefined ? responseData.data : responseData;
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
      
      // Log any API message
      if (responseData.message) {
        console.log('API Message:', responseData.message);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Termine:', err);
      // Non-critical error, don't set error state to avoid blocking quote creation
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleVatExemptChange = (e) => {
    const { value, type } = e.target;
    const isExempt = type === 'checkbox' ? e.target.checked : value === 'true';
    const amount = parseFloat(formData.amount) || 0;
    const materialsCost = parseFloat(formData.total_materials_price) || 0;
    const tax = isExempt ? 0 : amount * 0.19;
    const total = amount + tax + materialsCost;
    
    setFormData(prev => ({
      ...prev,
      vat_exempt: isExempt,
      tax_amount: tax.toFixed(2),
      total_amount: total.toFixed(2)
    }));
  };

  const handleAmountChange = (e) => {
    const { value } = e.target;
    const amount = parseFloat(value) || 0;
    const materialsCost = parseFloat(formData.total_materials_price) || 0;
    const tax = formData.vat_exempt ? 0 : amount * 0.19;
    const total = amount + tax + materialsCost;
    
    setFormData(prev => ({
      ...prev,
      amount: value,
      tax_amount: tax.toFixed(2),
      total_amount: total.toFixed(2)
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Recalculate totals when amount changes
    if (name === 'amount') {
      handleAmountChange(e);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // For checkbox handling (e.g., vat_exempt)
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
      return;
    }
    if (name === 'vat_exempt') {
      const isExempt = type === 'checkbox' ? checked : value === 'true';
      const amount = parseFloat(formData.amount) || 0;
      const materialsCost = parseFloat(formData.total_materials_price) || 0;
      const tax = isExempt ? 0 : amount * 0.19;
      const total = amount + tax + materialsCost;
      
      setFormData(prev => ({
        ...prev,
        vat_exempt: isExempt,
        tax_amount: tax.toFixed(2),
        total_amount: total.toFixed(2)
      }));
      return;
    }
    
    // Calculate tax and total when amount changes
    if (name === 'amount') {
      const amount = parseFloat(value) || 0;
      const materialsCost = parseFloat(formData.total_materials_price) || 0;
      const tax = formData.vat_exempt ? 0 : amount * 0.19;
      const total = amount + tax + materialsCost;
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        tax_amount: tax.toFixed(2),
        total_amount: total.toFixed(2)
      }));
      return;
    }
    
    // For all other fields, simply update the value
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Calculate the total price of all materials
  const calculateMaterialsTotal = () => {
    // Ensure materials is always an array
    const materialsArray = Array.isArray(formData.materials) ? formData.materials : [];
    
    // Calculate the total materials price
    const totalMaterialsPrice = materialsArray.reduce((sum, material) => {
      const quantity = parseFloat(material.quantity) || 0;
      const price = parseFloat(material.unit_price) || 0;
      return sum + (quantity * price);
    }, 0);
    
    return totalMaterialsPrice.toFixed(2);
  };

  // Handle materials selection changes
  const handleMaterialsChange = (materials) => {
    // Ensure materials is always an array
    const materialsArray = Array.isArray(materials) ? materials : [];
    
    // Calculate the total materials price
    const totalMaterialsPrice = materialsArray.reduce((sum, material) => {
      const quantity = parseFloat(material.quantity) || 0;
      const price = parseFloat(material.unit_price) || 0;
      const lineTotal = quantity * price;
      console.log(`Material: ${material.name}, Qty: ${quantity}, Price: ${price}, Line Total: ${lineTotal}`);
      return sum + lineTotal;
    }, 0);
    
    console.log('Materials array:', materialsArray);
    console.log('Total materials price calculated:', totalMaterialsPrice);
    
    // Update the amount and tax calculation
    const amount = parseFloat(formData.amount) || 0;
    const tax = formData.vat_exempt ? 0 : amount * 0.19;
    const total = amount + tax + totalMaterialsPrice;
    
    console.log('Updating form data with materials total:', totalMaterialsPrice.toFixed(2));
    
    // Force a state update with the new materials and totals
    setFormData(prev => {
      const newState = {
        ...prev,
        materials: materialsArray,
        total_materials_price: totalMaterialsPrice.toFixed(2),
        total_amount: total.toFixed(2)
      };
      console.log('New form state:', newState);
      return newState;
    });
  };

  const handleAppointmentChange = (e) => {
    const appointmentId = e.target.value;
    const appointment = appointments.find(a => a.id === parseInt(appointmentId));
    setSelectedAppointment(appointment);
    
    // Update form data with appointment information
    if (appointment) {
      // Set associated customer
      const customer = customers.find(c => c.id === appointment.customer_id);
      
      // Update related fields (customer_id, service_date, location if available)
      const updates = {
        appointment_id: appointmentId,
        customer_id: String(appointment.customer_id),
        service_date: appointment.date ? new Date(appointment.date).toISOString().split('T')[0] : '',
      };
      
      // Add location if available
      if (appointment.location) {
        updates.location = appointment.location;
      }
      
      // Update form state
      setFormData(prev => ({ ...prev, ...updates }));
    } else {
      // If appointment is deselected, just update the appointment_id field
      setFormData(prev => ({
        ...prev,
        appointment_id: appointmentId,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      // Ensure all required fields are filled
      const requiredFields = ['craftsman_id', 'customer_id', 'amount', 'total_amount'];
      for (const field of requiredFields) {
        if (!formData[field]) {
          const fieldName = field === 'craftsman_id' ? 'Handwerker-ID' :
                          field === 'customer_id' ? 'Kunde' :
                          field === 'amount' ? 'Betrag' :
                          field === 'total_amount' ? 'Gesamtbetrag' : field;
          setError(`Bitte geben Sie ${fieldName} ein`);
          setSubmitting(false);
          return;
        }
      }
      
      console.log('Angebotsdaten werden übermittelt:', JSON.stringify(formData, null, 2));
    console.log('Materials being sent:', JSON.stringify(formData.materials, null, 2));
      
      // Look up the customer name from the customers array
      const selectedCustomer = customers.find(c => c.id === parseInt(formData.customer_id, 10));
      
      // Prepare the payload with materials data - mapped to match actual database schema
      // Use the actual amounts from form data rather than recalculating
      const amount = parseFloat(formData.amount) || 0;
      const taxAmount = parseFloat(formData.tax_amount) || 0;
      const totalAmount = parseFloat(formData.total_amount) || 0;
      
      console.log('Amount values being used:', { 
        amount, 
        taxAmount, 
        totalAmount, 
        formValues: { 
          amount: formData.amount, 
          tax_amount: formData.tax_amount,
          total_amount: formData.total_amount 
        } 
      });
      
      const payload = {
        customer_id: formData.customer_id,
        appointment_id: formData.appointment_id || undefined, // Use undefined for empty values to avoid DB constraints
        status: 'draft',
        // Use proper column names from DB schema
        amount: amount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        vat_exempt: formData.vat_exempt || false,
        total_materials_price: parseFloat(formData.total_materials_price) || 0,
        due_date: formData.due_date || undefined,
        service_date: formData.service_date || undefined,
        location: formData.location || '',
        // Include notes about selected customer in notes field
        notes: `Angebot für ${selectedCustomer?.name || 'Kunde'}: ${formData.notes || ''}`,
        // Pass materials for junction table creation
        materials: formData.materials || []
      };
      
      console.log('Quote payload formatted for DB schema:', payload);

      // Create the quote using authenticated fetch (ensures fresh token)
      const response = await fetcher('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        // Try to extract error message from standardized response
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP Error ${response.status}`);
      }
      
      // Handle standardized API response format
      const responseData = await response.json();
      
      // Extract data and message from response
      const quoteData = responseData.data !== undefined ? responseData.data : responseData;
      const successMessage = responseData.message || 'Angebot erfolgreich erstellt';
      
      // Ensure materials is always an array before setting state
      if (quoteData && !Array.isArray(quoteData.materials)) {
        quoteData.materials = quoteData.materials || [];
      }
      
      // Ensure total price includes materials price
      if (quoteData) {
        // Get materials price
        const materials = Array.isArray(quoteData.materials) ? quoteData.materials : [];
        const materialsPrice = parseFloat(quoteData.total_materials_price) || 
          materials.reduce((sum, material) => {
            return sum + (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
          }, 0);
        
        // Recalculate the total to ensure it includes materials
        const baseAmount = parseFloat(quoteData.amount) || 0;
        const taxAmount = parseFloat(quoteData.tax_amount) || 0;
        const expectedTotal = baseAmount + taxAmount + materialsPrice;
        
        // If total doesn't include materials price, update it
        const currentTotal = parseFloat(quoteData.total_amount) || 0;
        if (Math.abs(currentTotal - expectedTotal) > 0.01) { // Allow for small rounding differences
          console.log(`Adjusting total price to include materials: ${currentTotal} -> ${expectedTotal}`);
          quoteData.total_amount = expectedTotal.toFixed(2);
          quoteData.total_materials_price = materialsPrice.toFixed(2);
        }
      }
      
      console.log('Angebot erfolgreich erstellt:', quoteData);
      console.log('API Message:', successMessage);
      setCreatedQuote(quoteData);
      setSuccess(true);
      
      // Clear form data
      setFormData({
        craftsman_id: formData.craftsman_id, // Keep craftsman_id
        customer_id: '',
        amount: '',
        tax_amount: '',
        total_amount: '',
        notes: '',
        due_date: '',
        service_date: '',
        location: '',
        vat_exempt: false,
        type: 'quote',
        appointment_id: ''
      });
      
      // Redirect to quotes page after 2 seconds
      setTimeout(() => {
        router.push('/quotes');
      }, 2000);
    } catch (err) {
      console.error('Fehler beim Erstellen des Angebots:', err);
      setError('Angebot konnte nicht erstellt werden. Bitte versuchen Sie es später erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!createdQuote) return;
    
    try {
      setPdfLoading(true);
      
      // Generate PDF for created quote
      await quotesAPI.generatePdf(createdQuote);
      
      console.log('PDF erfolgreich erstellt');
    } catch (err) {
      console.error('Fehler beim Erstellen des PDFs:', err);
      setError('PDF konnte nicht erstellt werden. Bitte versuchen Sie es später erneut.');
    } finally {
      setPdfLoading(false);
    }
  };
  
  const handleRedirectToQuotes = () => {
    router.push('/quotes');
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          {/* Page Title and Back Link */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Neues Angebot erstellen</h1>
              <p className="text-gray-400">Füllen Sie das Formular aus, um ein neues Angebot zu erstellen</p>
            </div>
            <Link 
              href="/quotes" 
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
            >
              Zurück zu den Angeboten
            </Link>
          </div>

          {/* Success Message */}
          {success && createdQuote && (
            <div className="bg-green-900/50 border border-green-500 text-white p-4 rounded-xl mb-6">
              <h2 className="font-bold text-lg mb-2">Angebot erfolgreich erstellt!</h2>
              <p className="mb-4">Ihr Angebot wurde erfolgreich erstellt und im System gespeichert.</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGeneratePdf}
                  disabled={pdfLoading}
                  className={`px-4 py-2 ${pdfLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#ffcb00] hover:bg-[#e6b800]'} text-black font-semibold rounded-xl transition-colors flex items-center justify-center`}
                >
                  {pdfLoading ? (
                    <>
                      <span className="mr-2 h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                      PDF wird erstellt...
                    </>
                  ) : (
                    'PDF erstellen'
                  )}
                </button>
                <button
                  onClick={handleRedirectToQuotes}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
                >
                  Alle Angebote anzeigen
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-white p-4 rounded-xl mb-6">
              <h2 className="font-bold text-lg mb-2">Fehler</h2>
              <p>{error}</p>
            </div>
          )}

          {/* Form Container */}
          {!success && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <form onSubmit={handleSubmit}>
                {/* Appointment Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1">
                    Termin auswählen (Optional)
                  </label>
                  <div className="relative">
                    <select
                      name="appointment_id"
                      value={formData.appointment_id}
                      onChange={handleAppointmentChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] appearance-none"
                      disabled={loadingAppointments || success}
                    >
                      <option value="">-- Termin auswählen --</option>
                      {appointments.map(appointment => (
                        <option key={appointment.id} value={appointment.id}>
                          {formatAppointmentDate(appointment.date)} - {appointment.customer_name || 'Kein Kundenname'}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {loadingAppointments && (
                    <p className="text-sm text-gray-400 mt-1 flex items-center">
                      <span className="mr-2 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                      Termine werden geladen...
                    </p>
                  )}
                </div>

                {/* Selected Appointment Card */}
                {selectedAppointment && (
                  <div className="mb-6 p-4 bg-[#1e3a5f]/50 rounded-xl border border-white/10">
                    <h3 className="font-medium mb-2">Ausgewählter Termin</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Datum:</span> {formatAppointmentDate(selectedAppointment.date)}
                      </div>
                      <div>
                        <span className="text-gray-400">Kunde:</span> {selectedAppointment.customer_name || 'Nicht angegeben'}
                      </div>
                      <div>
                        <span className="text-gray-400">Ort:</span> {selectedAppointment.location || 'Nicht angegeben'}
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span> {selectedAppointment.status || 'Nicht angegeben'}
                      </div>
                      {selectedAppointment.notes && (
                        <div className="col-span-1 md:col-span-2">
                          <span className="text-gray-400">Notizen:</span> {selectedAppointment.notes}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Selection */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Kunde *
                    </label>
                    <div className="relative">
                      <select
                        name="customer_id"
                        value={formData.customer_id}
                        onChange={handleChange}
                        className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] appearance-none"
                        required
                        disabled={loading || success}
                      >
                        <option value="">-- Kunde auswählen --</option>
                        {customers.map(customer => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name} {customer.email ? `(${customer.email})` : ''}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    {loading && (
                      <p className="text-sm text-gray-400 mt-1 flex items-center">
                        <span className="mr-2 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                        Kunden werden geladen...
                      </p>
                    )}
                  </div>

                  {/* Service Date */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Leistungsdatum
                    </label>
                    <input
                      type="date"
                      name="service_date"
                      value={formData.service_date}
                      onChange={handleChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={success}
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Ort
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={success}
                    />
                  </div>

                  {/* VAT Exempt Checkbox */}
                  <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="vat_exempt"
                        name="vat_exempt"
                        checked={formData.vat_exempt}
                        onChange={(e) => setFormData({...formData, vat_exempt: e.target.checked})}
                        className="h-5 w-5 text-[#ffcb00] focus:ring-[#ffcb00] border-white/30 rounded"
                        disabled={success}
                      />
                      <label htmlFor="vat_exempt" className="ml-2 block text-sm">
                        MwSt. befreit (keine Steuer wird berechnet)
                      </label>
                    </div>
                  </div>

                  {/* Amount (Net) */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Betrag (Netto) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        €
                      </span>
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        required
                        disabled={success}
                      />
                    </div>
                  </div>

                  {/* Tax Amount (calculated) */}
                  {!formData.vat_exempt && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Steuerbetrag (19% MwSt.)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                          €
                        </span>
                        <input
                          type="number"
                          name="tax_amount"
                          value={formData.tax_amount}
                          onChange={handleChange}
                          step="0.01"
                          min="0"
                          className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                          disabled={success}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Automatisch berechnet als 19% des Betrags
                      </p>
                    </div>
                  )}
                  
                  {/* Total Amount (calculated) */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Gesamtbetrag (Brutto) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        €
                      </span>
                      <input
                        type="number"
                        name="total_amount"
                        value={formData.total_amount}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        required
                        readOnly
                        disabled={success}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Automatisch berechnet aus Betrag + Steuer
                    </p>
                  </div>
                  
                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Gültig bis
                    </label>
                    <input
                      type="date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={success}
                    />
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
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={success}
                    ></textarea>
                  </div>
                </div>
                
                {/* Materials Section */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <MaterialSelector 
                    selectedMaterials={formData.materials}
                    onChange={handleMaterialsChange}
                  />
                  
                  {/* Materials Total */}
                  <div className="mt-4 flex justify-end">
                    <div className="bg-[#ffcb00] border border-[#ffcb00]/50 rounded-xl px-6 py-3 inline-flex items-center">
                      <span className="text-sm font-medium text-black">Materials Total:</span>
                      <span className="ml-4 text-lg font-semibold text-black">€{calculateMaterialsTotal()}</span>
                    </div>
                  </div>
                </div>
                
                {/* Submit Button */}
                <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || loading || !formData.customer_id || !formData.amount} // Disable on submit/load/missing required fields
                    className={`px-6 py-2.5 ${submitting ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#ffcb00] hover:bg-[#e6b800]'} text-black font-semibold rounded-xl transition-colors flex items-center justify-center disabled:opacity-60`}
                    style={{ minWidth: '150px' }} // Ensure minimum width
                  >
                    {submitting ? (
                      <>
                        <span className="mr-2 h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        Angebot wird erstellt...
                      </>
                    ) : (
                      'Angebot erstellen'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}
