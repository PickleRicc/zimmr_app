'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import dynamic from 'next/dynamic';
// Dynamically import MaterialSelector only on the client to avoid SSR errors
const MaterialSelector = dynamic(() => import('../../components/MaterialSelector'), { ssr: false });

// Format date for input fields (YYYY-MM-DD)
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

// Format appointment date for display
const formatAppointmentDate = (dateString) => {
  if (!dateString) return 'Kein Datum';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format date for display
const formatDate = (dateString) => {
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

export default function QuoteDetailPage({ params }) {
  // Unwrap params using React.use() as required by Next.js
  const resolvedParams = React.use(params);
  const quoteId = resolvedParams.id;
  
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
    type: 'quote',
    appointment_id: '',
    materials: [], // Array to store selected materials
    total_materials_price: '0.00' // Total price of materials
  });
  
  const [editMode, setEditMode] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
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
    if (authLoading || !user || !quoteId) return;

    const init = async () => {
      try {
        // Fetch the quote details
        await fetchQuote();

        // Fetch customers & appointments in parallel
        await Promise.all([fetchCustomers(), fetchAppointments()]);
      } catch (err) {
        console.error('Error initializing quote detail page:', err);
        setError('Fehler beim Laden der Angebotsdetails. Bitte versuchen Sie es später erneut.');
        setLoading(false);
      }
    };

    init();
  }, [authLoading, user, quoteId]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const response = await fetcher(`/api/quotes/${quoteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quote details');
      }
      const responseData = await response.json();
      // Extract the actual quote data from the API response
      const quoteData = responseData.data || responseData;
      
      // DEBUGGING: Log all quote information when quote is fetched
      console.log('========= QUOTE DATA DEBUG (Quote Fetch) =========');
      console.log('Raw API response:', responseData);
      console.log('Extracted quote data:', quoteData);
      console.log('Quote ID:', quoteData.id);
      console.log('Customer ID:', quoteData.customer_id);
      console.log('Amount:', quoteData.amount);
      console.log('Due date:', quoteData.due_date);
      console.log('Service date:', quoteData.service_date);
      console.log('Location:', quoteData.location);
      console.log('Notes:', quoteData.notes);
      console.log('Created at:', quoteData.created_at);
      console.log('Materials:', quoteData.materials);
      console.log('Materials valid array?', Array.isArray(quoteData.materials));
      console.log('Materials length:', Array.isArray(quoteData.materials) ? quoteData.materials.length : 0);
      console.log('Total materials price:', quoteData.total_materials_price);
      console.log('========= END QUOTE DEBUG =========');
      
      // Format dates for input fields
      const formattedQuote = {
        ...quoteData,
        due_date: formatDateForInput(quoteData.due_date),
        service_date: formatDateForInput(quoteData.service_date),
        // CRITICAL: Ensure materials array is properly initialized
        materials: Array.isArray(quoteData.materials) && quoteData.materials.length > 0 
          ? quoteData.materials 
          : [],
        total_materials_price: quoteData.total_materials_price || calculateMaterialsTotal(quoteData.materials || [])
      };
      
      console.log('========= FORMATTED QUOTE DEBUG =========');
      console.log('Formatted quote:', formattedQuote);
      console.log('Formatted quote ID:', formattedQuote.id);
      console.log('Formatted customer ID:', formattedQuote.customer_id);
      console.log('Formatted amount:', formattedQuote.amount);
      console.log('Formatted due date:', formattedQuote.due_date);
      console.log('Formatted service date:', formattedQuote.service_date);
      console.log('Formatted location:', formattedQuote.location);
      console.log('Formatted notes:', formattedQuote.notes);
      console.log('Formatted created at:', formattedQuote.created_at);
      console.log('Formatted materials:', formattedQuote.materials);
      console.log('========= END FORMATTED QUOTE DEBUG =========');
      
      setFormData(formattedQuote);
      setCreatedQuote(formattedQuote);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching quote:', err);
      setError('Fehler beim Laden des Angebots');
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetcher('/api/customers');
      if (response.ok) {
        const json = await response.json();
        const customersArray = json.data || json;
        setCustomers(Array.isArray(customersArray) ? customersArray : []);
      } else {
        throw new Error('Failed to fetch customers');
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      const response = await fetcher('/api/appointments');
      if (response.ok) {
        const json = await response.json();
        const appointmentsArray = json.data || json;
        setAppointments(Array.isArray(appointmentsArray) ? appointmentsArray : []);
        setLoadingAppointments(false);
      } else {
        throw new Error('Failed to fetch appointments');
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setLoadingAppointments(false);
    }
  };

  // Calculate total price of materials
  const calculateMaterialsTotal = (materials = []) => {
    return materials.reduce((total, material) => {
      const price = parseFloat(material.unit_price) || 0;
      const quantity = parseFloat(material.quantity) || 0;
      return total + (price * quantity);
    }, 0).toFixed(2);
  };
  
  const handleCheckboxChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.checked });
  };

  const handleVatExemptChange = (e) => {
    const isExempt = e.target.checked;
    setFormData(prev => {
      const amount = parseFloat(prev.amount) || 0;
      const taxAmount = isExempt ? 0 : (amount * 0.19).toFixed(2);
      const totalAmount = (amount + parseFloat(taxAmount)).toFixed(2);

      // Calculate total with materials
      const materialsTotal = parseFloat(prev.total_materials_price) || 0;
      const grandTotal = (parseFloat(totalAmount) + materialsTotal).toFixed(2);

      return {
        ...prev,
        vat_exempt: isExempt,
        tax_amount: taxAmount,
        total_amount: grandTotal
      };
    });
  };

  const handleAmountChange = (e) => {
    const amount = parseFloat(e.target.value) || 0;
    setFormData(prev => {
      const taxAmount = prev.vat_exempt ? 0 : (amount * 0.19).toFixed(2);
      const totalAmount = (amount + parseFloat(taxAmount)).toFixed(2);

      // Calculate total with materials
      const materialsTotal = parseFloat(prev.total_materials_price) || 0;
      const grandTotal = (parseFloat(totalAmount) + materialsTotal).toFixed(2);

      return {
        ...prev,
        amount: e.target.value,
        tax_amount: taxAmount,
        total_amount: grandTotal
      };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleChange = (e) => {
    // Special case handlers
    if (e.target.name === 'amount') {
      return handleAmountChange(e);
    }
    
    if (e.target.type === 'checkbox') {
      return handleCheckboxChange(e);
    }
    
    // Default handler
    return handleInputChange(e);
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

  const handleAppointmentChange = (e) => {
    const appointmentId = e.target.value;
    setFormData(prev => ({ ...prev, appointment_id: appointmentId }));

    if (appointmentId) {
      const selectedAppointment = appointments.find(a => a.id.toString() === appointmentId.toString());
      if (selectedAppointment) {
        setSelectedAppointment(selectedAppointment);

        // Auto-fill fields from appointment
        const amount = parseFloat(formData.amount) || 0;
        const taxAmount = formData.vat_exempt ? 0 : (amount * 0.19).toFixed(2);
        const totalAmount = (amount + parseFloat(taxAmount)).toFixed(2);

        setFormData(prev => ({
          ...prev,
          customer_id: selectedAppointment.customer_id?.toString() || prev.customer_id,
          service_date: selectedAppointment.start_time ? new Date(selectedAppointment.start_time).toISOString().split('T')[0] : prev.service_date,
          location: selectedAppointment.location || prev.location,
          tax_amount: taxAmount,
          total_amount: totalAmount
        }));
      }
    } else {
      setSelectedAppointment(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      // Prepare the payload
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount).toFixed(2),
        tax_amount: parseFloat(formData.tax_amount).toFixed(2),
        total_amount: parseFloat(formData.total_amount).toFixed(2),
        total_materials_price: parseFloat(formData.total_materials_price).toFixed(2)
      };

      // Update the quote
      const response = await fetcher(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update quote');
      }

      const updatedQuote = await response.json();
      setCreatedQuote(updatedQuote);
      setSuccess(true);
      setEditMode(false);
      
      // Refresh the quote data
      await fetchQuote();
      
    } catch (err) {
      console.error('Error updating quote:', err);
      setError(err.message || 'Fehler beim Aktualisieren des Angebots');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setPdfLoading(true);
      
      // Get craftsman data if needed for the PDF
      let craftsmanData = {};
      try {
        const response = await fetcher('/api/craftsman/profile');
        if (response.ok) {
          craftsmanData = await response.json();
        }
      } catch (err) {
        console.warn('Could not fetch craftsman profile for PDF:', err);
        // Continue anyway with empty craftsman data
      }
      
      // DEBUGGING: Log materials information before generating PDF
      console.log('========= MATERIALS DATA DEBUG (Quote Detail) =========');
      console.log('FormData.materials:', formData.materials);
      console.log('Materials valid array?', Array.isArray(formData.materials));
      console.log('Materials length:', Array.isArray(formData.materials) ? formData.materials.length : 0);
      console.log('Total materials price:', formData.total_materials_price);
      
      // If materials array is missing but we have the ID, try to fetch materials
      if ((!Array.isArray(formData.materials) || formData.materials.length === 0) && formData.id) {
        try {
          console.log('Attempting to fetch materials for quote ID:', formData.id);
          // Explicit request to fetch materials for this quote
          const materialsResponse = await fetcher(`/api/quotes/${formData.id}?materials=true`);
          if (materialsResponse.ok) {
            const freshData = await materialsResponse.json();
            if (Array.isArray(freshData.materials) && freshData.materials.length > 0) {
              console.log('Successfully retrieved materials from API:', freshData.materials.length);
              formData.materials = freshData.materials;
            }
          }
        } catch (err) {
          console.warn('Failed to fetch materials:', err);
          // Continue with empty materials
        }
      }
      
      console.log('========= END MATERIALS DEBUG =========');
      
      // CRITICAL FIX: Make sure materials data is properly structured before PDF generation
      const quoteDataForPdf = {
        ...formData,
        // If materials array is missing but we have a price, create a placeholder
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
      
      // Generate PDF with the quote data using dynamic import to avoid DOM errors
      console.log('Importing PDF generator...');
      const pdfModule = await import('../../../lib/utils/pdfGenerator');
      console.log('PDF module imported:', pdfModule);
      const pdfGenerator = pdfModule.default || pdfModule;
      console.log('PDF generator obtained:', pdfGenerator);
      
      // Use the quote PDF generator
      console.log('Generating quote PDF with data:', quoteDataForPdf);
      await pdfGenerator.generateQuotePdf(quoteDataForPdf, craftsmanData);
      
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Fehler beim Generieren des PDFs. ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEditToggle = () => {
    setEditMode(!editMode);
  };

  const handleConvertToInvoice = async () => {
    try {
      setSubmitting(true);
      
      const response = await fetcher(`/api/quotes/${quoteId}/convert-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to convert to invoice');
      }

      const invoice = await response.json();
      router.push(`/invoices/${invoice.id}`);
      
    } catch (err) {
      console.error('Error converting to invoice:', err);
      setError(err.message || 'Fehler beim Umwandeln in eine Rechnung');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-4 border-[#ffcb00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
              Angebotsdetails
            </h1>
            <div className="flex space-x-3">
              <Link href="/quotes" className="text-[#ffcb00] hover:text-[#e6b800] transition-colors">
                &larr; Zurück zu Angeboten
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
              {error}
            </div>
          )}

          {loading ? (
            <div className="bg-[#2a2a2a]/50 rounded-xl p-8 mb-8 flex items-center justify-center">
              <div className="h-8 w-8 border-4 border-[#ffcb00] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-[#2a2a2a]/70 backdrop-blur-md rounded-2xl shadow-xl border border-[#2a2a2a] overflow-hidden mb-8">
              <div className="p-6">
              {success && !editMode && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-400 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                  Angebot erfolgreich aktualisiert!
                </div>
              )}

              {/* Quote Details Display */}
              {!editMode ? (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-[#ffcb00]">Angebot #{formData.id || 'N/A'}</h2>
                    <span className="px-3 py-1 rounded-xl text-sm font-medium bg-blue-900/30 text-blue-400 border border-blue-800/50">
                      ANGEBOT
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Kunde</h3>
                      <p className="text-white">{customers.find(c => c.id === formData.customer_id)?.name || 'N/A'}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Erstellungsdatum</h3>
                      <p className="text-white">{formatDate(formData.created_at)}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Fälligkeitsdatum</h3>
                      <p className="text-white">{formatDate(formData.due_date)}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Leistungsdatum</h3>
                      <p className="text-white">{formatDate(formData.service_date)}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Standort</h3>
                      <p className="text-white">{formData.location || 'N/A'}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">MwSt. befreit</h3>
                      <p className="text-white">{formData.vat_exempt ? 'Ja' : 'Nein'}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Dienstleistung</h3>
                      <p className="text-white">€{parseFloat(formData.amount || 0).toFixed(2)}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Materialien</h3>
                      <p className="text-white">€{parseFloat(formData.total_materials_price || 0).toFixed(2)}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">MwSt.</h3>
                      <p className="text-white">€{parseFloat(formData.tax_amount || 0).toFixed(2)}</p>
                    </div>
                    
                    <div className="p-2">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Gesamtbetrag</h3>
                      <p className="text-white font-medium text-lg">€{parseFloat(formData.total_amount || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {formData.notes && (
                    <div className="mt-6">
                      <h3 className="text-sm font-medium text-white/60 mb-2">Notizen</h3>
                      <p className="text-white whitespace-pre-line bg-[#2a2a2a]/50 p-4 rounded-xl border border-[#2a2a2a]">{formData.notes}</p>
                    </div>
                  )}
                  
                  {/* Linked Appointment */}
                  {selectedAppointment && (
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
                            <span className="text-white">{formatDate(selectedAppointment.start_time)}</span>
                          </div>
                          <div className="p-2">
                            <span className="text-white/60 text-sm">Titel:</span>{' '}
                            <span className="text-white">{selectedAppointment.title || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="mt-8 flex flex-wrap gap-3 justify-end items-center">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="px-5 py-2.5 border border-white/20 rounded-xl text-white hover:bg-white/5 transition-all duration-300"
                    >
                      Zurück
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
                      onClick={() => setEditMode(true)}
                      className="px-5 py-2.5 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                      Angebot bearbeiten
                    </button>
                  </div>
                </div>
              ) : (
                /* Edit Mode Form */
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-[#ffcb00]">Angebot bearbeiten</h2>
                  </div>
                </div>
              )}

              {/* Quote details form */}
              <form onSubmit={handleSubmit} className={editMode ? '' : 'hidden'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer selection */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Kunde
                    </label>
                    <select
                      name="customer_id"
                      value={formData.customer_id || ''}
                      onChange={handleChange}
                      className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                      required
                      disabled={!editMode}
                    >
                      <option value="">Bitte wählen Sie einen Kunden</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name || 'Unbenannter Kunde'} {customer.email ? `(${customer.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Appointment selection */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Zugehöriger Termin (optional)
                    </label>
                    <select
                      name="appointment_id"
                      value={formData.appointment_id || ''}
                      onChange={handleAppointmentChange}
                      className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                      disabled={loadingAppointments || !editMode}
                    >
                      <option value="">Keinen Termin auswählen</option>
                      {appointments.map(appointment => (
                        <option key={appointment.id} value={appointment.id}>
                          {formatAppointmentDate(appointment.start_time)} - {appointment.title || 'Kein Titel'}
                        </option>
                      ))}
                    </select>
                    {loadingAppointments && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center">
                        <span className="mr-2 h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                        Termine werden geladen...
                      </p>
                    )}
                  </div>
                  
                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Standort
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location || ''}
                      onChange={handleChange}
                      className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                      disabled={!editMode}
                    />
                  </div>
                  
                  {/* Service Date */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Leistungsdatum
                    </label>
                    <input
                      type="date"
                      name="service_date"
                      value={formData.service_date || ''}
                      onChange={handleChange}
                      className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                      disabled={!editMode}
                    />
                  </div>
                  
                  {/* VAT Exempt checkbox */}
                  <div>
                    <div className="flex items-center mt-4">
                      <input
                        type="checkbox"
                        name="vat_exempt"
                        id="vat_exempt"
                        checked={formData.vat_exempt}
                        onChange={handleVatExemptChange}
                        className="h-4 w-4 rounded border-white/10 focus:ring-[#ffcb00] bg-[#2a2a2a] text-[#ffcb00]"
                        disabled={!editMode}
                      />
                      <label htmlFor="vat_exempt" className="ml-2 text-sm">
                        Umsatzsteuerbefreit (§19 UStG)
                      </label>
                    </div>
                  </div>
                  
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Betrag (netto) €
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleAmountChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        required
                        disabled={!editMode}
                      />
                    </div>
                  </div>
                  
                  {/* Tax Amount */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Mehrwertsteuer €
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                      <input
                        type="number"
                        name="tax_amount"
                        value={formData.tax_amount}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        readOnly
                        disabled={true}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Automatisch berechnet (19%)
                    </p>
                  </div>
                  
                  {/* Total Amount */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Gesamtbetrag €
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                      <input
                        type="number"
                        name="total_amount"
                        value={formData.total_amount}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        required
                        readOnly
                        disabled={true}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Automatisch berechnet aus Betrag + Steuer + Materialien
                    </p>
                  </div>
                  
                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Gültig bis
                    </label>
                    <input
                      type="date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                      disabled={!editMode}
                    />
                  </div>
                  
                  {/* Notes */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-white/60">
                      Notizen
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows="4"
                      className="w-full bg-[#2a2a2a]/50 border border-[#2a2a2a] rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200"
                      disabled={!editMode}
                    ></textarea>
                  </div>
                </div>
                
                {/* Materials Section */}
                <div className="mt-8">
                  <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m-8-4l8 4m8 4l-8 4m-8-4l8 4m8-11v11"></path>
                    </svg>
                    Materialien
                  </h3>
                  
                  {editMode ? (
                    <MaterialSelector 
                      selectedMaterials={formData.materials}
                      onChange={handleMaterialsChange}
                    />
                  ) : (
                    <div className="bg-[#2a2a2a]/50 rounded-xl p-4 border border-[#2a2a2a]">
                      {formData.materials && formData.materials.length > 0 ? (
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
                            {formData.materials.map((material, index) => {
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
                              <td className="py-3 font-bold">€{parseFloat(formData.total_materials_price).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-white/60">Keine Materialien</p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                {editMode ? (
                  <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-3 justify-end items-center">
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="px-5 py-2.5 border border-white/20 rounded-xl text-white hover:bg-white/5 transition-all duration-300"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !formData.customer_id || !formData.amount}
                      className="px-5 py-2.5 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:transform-none"
                    >
                      {submitting ? (
                        <>
                          <span className="mr-2 h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                          Wird gespeichert...
                        </>
                      ) : 'Angebot aktualisieren'}
                    </button>
                  </div>
                ) : null}
              </form>
              </div>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}
