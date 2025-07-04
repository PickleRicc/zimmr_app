'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import { invoicesAPI, quotesAPI } from '../../lib/api';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import MaterialSelector from '../../components/MaterialSelector';

function InvoicePageContent() {
  // This component uses useSearchParams which requires Suspense
  const { user, loading: authLoading } = useRequireAuth();
  const authedFetch = useAuthedFetch();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quote_id');
  const [formData, setFormData] = useState({
    customer_id: '',
    amount: '',
    tax_amount: '',
    total_amount: '',
    notes: '',
    due_date: '',
    service_date: '',
    location: '',
    vat_exempt: false,
    type: 'invoice',
    appointment_id: '',
    materials: [], // Array to store selected materials
    total_materials_price: '0.00' // Total price of materials
  });

  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(false); // General loading (customers, quote)
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const router = useRouter();

  // Function to fetch quote data and pre-fill the form
  const fetchQuoteData = async (quoteId) => {
    try {
      setLoading(true);
      console.log(`Workspaceing quote ${quoteId} for pre-filling invoice`);

      const quote = await quotesAPI.getById(quoteId);
      console.log('Quote data retrieved:', quote);

      if (quote) {
        // Calculate default due date (14 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        const formattedDueDate = dueDate.toISOString().split('T')[0];

        // Pre-fill form with quote data
        setFormData(prev => ({
          ...prev,
          customer_id: quote.customer_id?.toString() || '', // Ensure string for select value
          amount: quote.amount?.toString() || '', // Ensure string for input value
          tax_amount: quote.tax_amount?.toString() || '', // Ensure string for input value
          total_amount: quote.total_amount?.toString() || '', // Ensure string for input value
          notes: `Basierend auf Angebot #${quoteId}\n\n${quote.notes || ''}`,
          due_date: formattedDueDate,
          service_date: quote.service_date || '',
          location: quote.location || '',
          vat_exempt: quote.vat_exempt || false,
          type: 'invoice', // Always set type to invoice when creating from quote
        }));

        // If the quote has a customer ID, make sure we have the customer data (already fetched in useEffect)
        // No need to call fetchCustomers again here if it's already called in useEffect
      }
    } catch (err) {
      console.error(`Error fetching quote ${quoteId}:`, err);
      setError(`Fehler beim Laden der Angebotsdaten. Bitte versuchen Sie es später erneut.`);
    } finally {
      setLoading(false);
    }
  };

  // Initial data load + optional quote/appointment pre-fill
  useEffect(() => {
    if (authLoading) return; // wait for auth
    if (!user) return;  // redirected

    const init = async () => {
      try {
        await Promise.all([fetchCustomers(), fetchAppointments()]);
        if (quoteId) {
          await fetchQuoteData(quoteId);
        }
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('from_appointment') === 'true') {
            console.log('Pre-populating invoice from appointment data via URL params');
            const appointmentId = urlParams.get('appointment_id');
            const customerId = urlParams.get('customer_id');
            const amount = urlParams.get('amount');
            const location = urlParams.get('location');
            const serviceDate = urlParams.get('service_date');
            const notes = urlParams.get('notes');

            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 14);
            const formattedDueDate = dueDate.toISOString().split('T')[0];

            const amountValue = parseFloat(amount) || 0;
            const taxAmount = amountValue > 0 ? (amountValue * 0.19).toFixed(2) : '0.00';
            const totalAmount = amountValue > 0 ? (amountValue + parseFloat(taxAmount)).toFixed(2) : amountValue.toFixed(2);

            setFormData(prev => ({
              ...prev,
              appointment_id: appointmentId || '',
              customer_id: customerId || '',
              amount: amount || '',
              tax_amount: taxAmount,
              total_amount: totalAmount,
              location: location || '',
              service_date: serviceDate || '',
              notes: notes || '',
              due_date: prev.due_date || formattedDueDate,
            }));
          }
        }
      } catch (err) {
        console.error('Initial data load error', err);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, authLoading]); // Depend on quoteId to refetch if it changes

  const fetchCustomers = async () => {
    try {
      setLoading(true); // Use general loading for initial customer fetch
      console.log('Fetching customers');
      const res = await authedFetch('/api/customers');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      console.log('Fetched customers:', data);
      setCustomers(data || []); // Ensure customers is always an array
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Fehler beim Laden der Kunden. Bitte versuchen Sie es später erneut.');
      setCustomers([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      console.log('Fetching appointments');
      const res = await authedFetch('/api/appointments?status=completed&has_invoice=false');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      console.log('Fetched appointments:', data);
      setAppointments(data || []); // Ensure appointments is always an array
    } catch (err) {
      console.error('Error fetching appointments:', err);
      // Don't set the main error here to avoid overriding customer/quote fetch errors
      setAppointments([]); // Set to empty array on error
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Handle regular form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updatedData = { ...prev, [name]: newValue };
      
      // Special handling for VAT exempt and amount changes
      if (name === 'vat_exempt' || name === 'amount') {
        return handleVatChange(updatedData);
      }
      
      // If customer changes, potentially clear appointment selection or update available appointments
      if (name === 'customer_id') {
        // Optional: Clear appointment selection if customer changes
        // updatedData.appointment_id = '';
        // setSelectedAppointment(null);
        // Or refetch/filter appointments for the new customer if needed
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

  // Calculate total price of materials
  const calculateMaterialsTotal = (materials = []) => {
    console.log('====== CALCULATING MATERIALS TOTAL ======');
    console.log('Materials array received:', materials);
    console.log('Materials count:', materials.length);
    
    const total = materials.reduce((sum, material) => {
      const quantity = parseFloat(material.quantity) || 0;
      const unitPrice = parseFloat(material.unit_price) || 0;
      const itemTotal = quantity * unitPrice;
      console.log(`Material: ${material.name} - Quantity: ${quantity}, Unit Price: ${unitPrice}, Item Total: ${itemTotal}`);
      return sum + itemTotal;
    }, 0).toFixed(2);
    
    console.log('Calculated materials total:', total);
    console.log('======================================');
    return total;
  };
  
  // Handle materials selection changes
  const handleMaterialsChange = (materials) => {
    console.log('====== MATERIALS SELECTION CHANGED ======');
    console.log('New materials selected:', materials);
    
    const total_materials_price = calculateMaterialsTotal(materials);
    
    console.log('Setting total_materials_price:', total_materials_price);
    
    setFormData(prev => {
      const updatedData = {
        ...prev,
        materials,
        total_materials_price
      };
      
      console.log('Updated form data with materials:', updatedData);
      
      // Recalculate total with materials
      return handleVatChange(updatedData);
    });
  };


  const handleAppointmentChange = (e) => {
    const appointmentId = e.target.value;
    setFormData(prev => ({ ...prev, appointment_id: appointmentId })); // Update form state immediately

    if (!appointmentId) {
      setSelectedAppointment(null);
      // Optional: Reset fields that were auto-filled by appointment, or leave them
      // setFormData(prev => ({
      //   ...prev,
      //   service_date: '',
      //   location: '',
      //   notes: '', // Or keep notes?
      //   // Don't reset amount/tax/total here usually
      // }));
      return; // No appointment selected
    }

    // Find the selected appointment
    const newlySelectedAppointment = appointments.find(
      appointment => appointment.id.toString() === appointmentId
    );

    if (!newlySelectedAppointment) {
      setSelectedAppointment(null);
      return;
    }

    console.log('Selected appointment:', newlySelectedAppointment);
    setSelectedAppointment(newlySelectedAppointment);

    // Auto-populate invoice data from appointment
    // Calculate default due date (14 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    const formattedDueDate = dueDate.toISOString().split('T')[0];

    setFormData(prev => ({
      ...prev,
      // appointment_id is already set
      customer_id: newlySelectedAppointment.customer_id.toString(),
      service_date: newlySelectedAppointment.scheduled_at ? new Date(newlySelectedAppointment.scheduled_at).toISOString().split('T')[0] : '',
      location: newlySelectedAppointment.location || prev.location || '', // Keep existing if appointment has none
      notes: newlySelectedAppointment.notes || prev.notes || '', // Keep existing if appointment has none
      due_date: prev.due_date || formattedDueDate, // Keep existing due date or set default
      // Decide if you want to reset amount/tax/total when selecting an appointment
      // amount: '',
      // tax_amount: '',
      // total_amount: '',
      // vat_exempt: false, // Or keep existing?
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (authLoading) return <p className="text-white p-8">Lade...</p>;

  // Basic validation
    if (!formData.customer_id) {
      setError('Bitte wählen Sie einen Kunden');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Bitte geben Sie einen gültigen Betrag ein (größer als 0)');
      return;
    }

    // Ensure total amount calculation is correct before submission
     const amount = parseFloat(formData.amount) || 0;
     let taxAmount = parseFloat(formData.tax_amount) || 0;
     if (formData.vat_exempt) {
         taxAmount = 0; // Ensure tax is 0 if exempt
     } else if (Math.abs(taxAmount - amount * 0.19) > 0.001) {
         // Optional: Recalculate tax if it seems manually changed and doesn't match 19%
         // taxAmount = amount * 0.19;
         console.warn("Tax amount might not be 19% of net amount.");
     }
     const totalAmount = amount + taxAmount;


    try {
      setSubmitting(true);
      setError(null);

      // Prepare data for submission, ensuring numbers are numbers
      const invoiceData = {
        ...formData,
        amount: parseFloat(formData.amount),
        tax_amount: parseFloat(formData.tax_amount) || 0, // Use calculated or ensure 0 if exempt
        total_amount: parseFloat(totalAmount.toFixed(2)), // Use calculated total
        appointment_id: formData.appointment_id || null, // Send null if empty string
        // Ensure dates are in correct format if needed by backend (e.g., ISO string)
        // due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        // service_date: formData.service_date ? new Date(formData.service_date).toISOString() : null,
      };

      console.log('Submitting invoice data:', invoiceData);

      // Choose API based on type
      let result;
      if (formData.type === 'quote') {
          console.log('Creating Quote');
          result = await quotesAPI.create(invoiceData); // Assuming quotesAPI has a create method
          console.log('Quote created:', result);
      } else {
          console.log('Creating Invoice/Draft');
          const res = await authedFetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceData)
        });
        if (!res.ok) throw new Error(await res.text());
        result = await res.json();
          console.log('Invoice/Draft created:', result);
      }


      setSuccess(true);
      setCreatedInvoice(result); // Store the created invoice/quote object

      // Don't redirect immediately to allow PDF generation or viewing message

    } catch (err) {
      console.error(`Error creating ${formData.type}:`, err);
      const errorMsg = err.response?.data?.error || `Fehler beim Erstellen: ${err.message}`;
      setError(errorMsg);
      setSuccess(false); // Ensure success is false on error
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePdf = async () => {
    console.log('PDF Generation triggered');
    console.log('createdInvoice:', createdInvoice);
    
    // Extract the actual invoice data from the response structure
    const invoiceData = createdInvoice?.invoice || createdInvoice;
    console.log('Extracted invoice data:', invoiceData);
    
    if (!invoiceData || !invoiceData.id) {
        console.error('Missing invoice data for PDF generation:', { createdInvoice, invoiceData });
        alert('PDF kann nicht generiert werden. Rechnungs-/Angebotsdaten fehlen.');
        return;
    }

    try {
        setPdfLoading(true);
        setError(null); // Clear previous errors

        // Import the PDF generator utility
        console.log('Importing PDF generator...');
        const pdfModule = await import('../../../lib/utils/pdfGenerator');
        console.log('PDF module imported:', pdfModule);
        const pdfGenerator = pdfModule.default || pdfModule;
        console.log('PDF generator obtained:', pdfGenerator);
        
        if (!pdfGenerator || !pdfGenerator.generateInvoicePdf) {
            console.error('PDF generator import failed or missing expected methods:', pdfGenerator);
            throw new Error('PDF Generator konnte nicht geladen werden.');
        }

        // Find the selected customer's details (use invoiceData.customer_id)
        console.log('Looking for customer with ID:', invoiceData.customer_id);
        console.log('Available customers:', customers);
        const selectedCustomer = customers.find(c => c.id === parseInt(invoiceData.customer_id));
        console.log('Selected customer:', selectedCustomer);
        
        if (!selectedCustomer) {
             console.warn("Customer details not found for PDF generation.");
        }

        // Use the actual created invoice/quote data returned from the API
        const documentDataForPdf = {
            ...invoiceData, // Base data from the API response
            // Add/override details needed specifically for the PDF that might not be in invoiceData
            customer_name: selectedCustomer?.name || 'N/A',
            customer_email: selectedCustomer?.email || '',
            customer_phone: selectedCustomer?.phone || '',
            customer_address: selectedCustomer?.address || '',
            // Ensure amounts are formatted as needed by PDF generator
            amount: parseFloat(invoiceData.amount || 0).toFixed(2),
            tax_amount: parseFloat(invoiceData.tax_amount || 0).toFixed(2),
            total_amount: parseFloat(invoiceData.total_amount || 0).toFixed(2),
            // Use created_at from the API response, format if needed
            created_at_formatted: invoiceData.created_at ? new Date(invoiceData.created_at).toLocaleDateString() : 'N/A',
            due_date_formatted: invoiceData.due_date ? new Date(invoiceData.due_date).toLocaleDateString() : 'N/A',
            service_date_formatted: invoiceData.service_date ? new Date(invoiceData.service_date).toLocaleDateString() : 'N/A',
            // Line items - if not present, create a placeholder
            line_items: invoiceData.line_items || [{
                description: invoiceData.notes || 'Dienstleistungen',
                quantity: 1,
                unit: 'Pauschal',
                price: invoiceData.amount || 0
            }],
            // Use materials from formData since the database/API isn't returning it properly
            materials: Array.isArray(formData.materials) ? formData.materials : [],
            // Make sure we're also passing the materials price
            total_materials_price: formData.total_materials_price || invoiceData.total_materials_price || 0
        };

        // Get user profile data from the authenticated user object instead of localStorage
        const craftsmanData = {
            name: user?.user_metadata?.full_name || 'ZIMMR Craftsman',
            email: user?.email || '',
            phone: user?.user_metadata?.phone || '',
            address: user?.user_metadata?.address || '',
            // Add tax and banking information for German invoices
            tax_id: user?.user_metadata?.tax_id || '',
            iban: user?.user_metadata?.iban || '',
            bic: user?.user_metadata?.bic || '',
            bank_name: user?.user_metadata?.bank_name || '',
            owner_name: user?.user_metadata?.full_name || '' // Often same as name
        };

        console.log("Full document data for PDF:", documentDataForPdf);
        console.log("Using Craftsman data:", craftsmanData);

        // Use the appropriate PDF generator function based on document type
        console.log("Document type:", documentDataForPdf.type);
        
        // DEBUGGING: Log all available data sources
        console.log('========= MATERIALS DATA DEBUG =========');
        console.log('FormData direct access:', formData);
        console.log('FormData.materials:', formData.materials);
        console.log('InvoiceData.materials:', invoiceData.materials);
        console.log('DocumentDataForPdf.materials:', documentDataForPdf.materials);
        
        // CRITICAL FIX: Manually synthesize materials data if needed
        if (!documentDataForPdf.materials || !Array.isArray(documentDataForPdf.materials) || documentDataForPdf.materials.length === 0) {
            if (formData.materials && Array.isArray(formData.materials) && formData.materials.length > 0) {
                console.log('Using materials from formData');
                documentDataForPdf.materials = formData.materials;
            } else if (formData.total_materials_price && parseFloat(formData.total_materials_price) > 0) {
                // If we only have the price but not the items, create a placeholder material
                console.log('Creating placeholder material from total_materials_price');
                documentDataForPdf.materials = [{
                    name: 'Materialien',
                    quantity: 1,
                    unit: 'Pauschal',
                    unit_price: formData.total_materials_price
                }];
            }
        }
        
        console.log('Final materials array:', JSON.stringify(documentDataForPdf.materials, null, 2));
        console.log('Final materials count:', Array.isArray(documentDataForPdf.materials) ? documentDataForPdf.materials.length : 0);
        console.log('Total materials price:', documentDataForPdf.total_materials_price);
        console.log('========= END MATERIALS DEBUG =========');
        
        if (documentDataForPdf.type === 'quote') {
            console.log('Generating quote PDF...');
            await pdfGenerator.generateQuotePdf(documentDataForPdf, craftsmanData);
        } else {
            // Default to invoice PDF generator
            console.log('Generating invoice PDF...');
            await pdfGenerator.generateInvoicePdf(documentDataForPdf, craftsmanData);
        }
        
        console.log(`German-style ${invoiceData.type || 'document'} PDF generated successfully`);

    } catch (err) {
        console.error('Error generating German PDF:', err);
        const errorMsg = err.response?.data?.error || 'Fehler beim Generieren des PDFs. Bitte versuchen Sie es später erneut.';
        setError(errorMsg); // Show error near the button
        alert(errorMsg); // Also show alert
    } finally {
        setPdfLoading(false);
    }
};


  const handleRedirectToInvoices = () => {
    router.push('/invoices'); // Or potentially redirect to quotes list if a quote was created
  };

  const getDocumentTypeName = () => {
      switch (formData.type) {
          case 'quote': return 'Angebot';
          case 'draft': return 'Rechnungsentwurf';
          default: return 'Rechnung';
      }
  }
  const getDocumentListName = () => {
       switch (formData.type) {
          case 'quote': return 'Angebote';
          default: return 'Rechnungen'; // Drafts usually listed with invoices
      }
  }


  // --- Render ---
  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          {/* Header Section */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 transition-all duration-300 mb-6">
            <div className="mb-6">
              <h2 className="text-2xl md:text-3xl font-bold mb-2 text-primary font-heading">Neue {getDocumentTypeName()} erstellen</h2>
              <p className="text-gray-400">Füllen Sie die Details unten aus oder wählen Sie einen abgeschlossenen Termin, um Informationen automatisch einzutragen.</p>
            </div>
            <Link
              href={getDocumentListName() === 'Angebote' ? "/quotes" : "/invoices"} // Link back to appropriate list
              className="text-[#ffcb00] hover:text-[#e6b800] transition-colors flex items-center text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Zurück zu {getDocumentListName()}
            </Link>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-6">
              <p>Fehler: {error}</p>
            </div>
          )}

          {/* Success Message & Actions */}
          {success && createdInvoice && (
            <div className="bg-green-900/50 border border-green-700 text-green-300 p-4 rounded-lg mb-6">
              <p className="mb-4 font-semibold">{getDocumentTypeName()} #{createdInvoice.id} erfolgreich erstellt!</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGeneratePdf}
                  disabled={pdfLoading || submitting} // Disable if PDF is loading OR if main form is submitting (shouldn't happen here, but safe)
                  className={`px-4 py-2 ${pdfLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#ffcb00] hover:bg-[#e6b800]'} text-black font-medium rounded-xl transition-colors flex items-center justify-center`}
                  style={{ minWidth: '150px' }} // Ensure minimum width
                >
                  {pdfLoading ? (
                    <>
                      <span className="mr-2 h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                      PDF wird generiert...
                    </>
                  ) : (
                    `${getDocumentTypeName()} als PDF herunterladen`
                  )}
                </button>
                <button
                  onClick={handleRedirectToInvoices}
                  disabled={pdfLoading || submitting}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
                >
                  Alle {getDocumentListName()} anzeigen
                </button>
              </div>
               {/* Display PDF generation error specifically here if needed */}
               {error && pdfLoading === false && ( // Show error only if it occurred during PDF generation attempt
                 <p className="text-red-400 mt-3 text-sm">PDF-Generierung fehlgeschlagen: {error}</p>
               )}
            </div>
          )}

          {/* Invoice Form - Render only if not success or if success but no createdInvoice yet */}
          {(!success || !createdInvoice) && (
             <div className={`bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 transition-all duration-300 ${submitting || loading ? 'opacity-70 pointer-events-none' : ''}`}>
              <form onSubmit={handleSubmit}>
                {/* Form Loading Indicator */}
                 {loading && <p className="text-center text-gray-400 mb-4">Lade Daten...</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

                  {/* Craftsman ID (Hidden but necessary) */}
                  <input type="hidden" name="craftsman_id" value={formData.craftsman_id} />

                  {/* Appointment Selection */}
                  <div className="col-span-1 md:col-span-2">
                    <label htmlFor="appointment_id" className="block text-sm font-medium mb-1 text-gray-300">
                      Erstelle aus abgeschlossenem Termin (Optional)
                    </label>
                    <select
                      id="appointment_id"
                      name="appointment_id"
                      value={formData.appointment_id}
                      onChange={handleAppointmentChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                      disabled={submitting || loadingAppointments || loading} // Disable while loading/submitting
                    >
                      <option value="">-- Wählen Sie einen abgeschlossenen Termin --</option>
                      {loadingAppointments ? (
                        <option disabled>Loading appointments...</option>
                      ) : appointments.length === 0 ? (
                        <option disabled>Keine geeigneten abgeschlossenen Termine gefunden</option>
                      ) : (
                        appointments.map((appointment) => (
                          <option key={appointment.id} value={appointment.id}>
                            {new Date(appointment.scheduled_at).toLocaleDateString()} - {appointment.customer_name} ({appointment.service_type || 'Service'})
                          </option>
                        )) // Corrected closing parenthesis for map
                      )}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      Die Auswahl eines Termins füllt automatisch Kunden- und Service-Daten aus.
                    </p>
                  </div>

                   {/* Selected Appointment Details Display */}
                  {selectedAppointment && (
                    <div className="col-span-1 md:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl p-4 my-4">
                      <h3 className="text-md font-semibold mb-2 text-[#ffcb00]">
                        Ausgewählte Termin-Details:
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-300">
                        <div><span className="font-medium text-gray-400">Kunde:</span> {selectedAppointment.customer_name}</div>
                        <div><span className="font-medium text-gray-400">Datum:</span> {new Date(selectedAppointment.scheduled_at).toLocaleDateString()}</div>
                        <div><span className="font-medium text-gray-400">Uhrzeit:</span> {new Date(selectedAppointment.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div><span className="font-medium text-gray-400">Service:</span> {selectedAppointment.service_type || 'General Service'}</div>
                        {selectedAppointment.location && (
                          <div className="col-span-1 sm:col-span-2"><span className="font-medium text-gray-400">Ort:</span> {selectedAppointment.location}</div>
                        )}
                        {selectedAppointment.notes && (
                          <div className="col-span-1 sm:col-span-2"><span className="font-medium text-gray-400">Notizen:</span> {selectedAppointment.notes}</div>
                        )}
                      </div>
                    </div>
                  )}


                  {/* Customer Selection */}
                  <div className="col-span-1 md:col-span-2">
                    <label htmlFor="customer_id" className="block text-sm font-medium mb-1 text-gray-300">
                      Kunde *
                    </label>
                    <select
                      id="customer_id"
                      name="customer_id"
                      value={formData.customer_id}
                      onChange={handleChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                      required
                      disabled={submitting || loading || customers.length === 0} // Disable if loading customers or submitting
                    >
                      <option value="">-- Wählen Sie einen Kunden --</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} {customer.email ? `(${customer.email})` : ''}
                        </option>
                      ))}
                    </select>
                     {customers.length === 0 && !loading && (
                         <p className="text-xs text-yellow-400 mt-1">Keine Kunden gefunden. <Link href="/customers/new" className="underline hover:text-yellow-300">Fügen Sie einen Kunden hinzu?</Link></p>
                     )}
                  </div>

                  {/* Document Type */}
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium mb-1 text-gray-300">
                      Dokumenttyp *
                    </label>
                    <select
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                      required
                      disabled={submitting}
                    >
                      <option value="invoice">Rechnung</option>
                      <option value="quote">Angebot</option>
                      <option value="draft">Rechnungsentwurf</option>
                    </select>
                  </div>

                   {/* Due Date (Relevant for Invoice/Draft) */}
                   {formData.type !== 'quote' && (
                        <div>
                           <label htmlFor="due_date" className="block text-sm font-medium mb-1 text-gray-300">
                             Fälligkeitsdatum
                           </label>
                           <input
                             id="due_date"
                             type="date"
                             name="due_date"
                             value={formData.due_date}
                             onChange={handleChange}
                             className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                             disabled={submitting}
                           />
                           <p className="text-xs text-gray-400 mt-1">
                             Standardmäßig 14 Tage nach Erstellung.
                           </p>
                         </div>
                   )}
                    {/* Spacer if Due Date is hidden to maintain layout */}
                   {formData.type === 'quote' && <div></div>}


                  {/* Service Date */}
                  <div>
                    <label htmlFor="service_date" className="block text-sm font-medium mb-1 text-gray-300">
                      Service-Datum
                    </label>
                    <input
                      id="service_date"
                      type="date"
                      name="service_date"
                      value={formData.service_date}
                      onChange={handleChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                      disabled={submitting}
                    />
                  </div>

                  {/* Service Location */}
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium mb-1 text-gray-300">
                      Service-Ort
                    </label>
                    <input
                      id="location"
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                      disabled={submitting}
                      placeholder="z.B. Kundenadresse, Standortname"
                    />
                  </div>

                  {/* Amount (Net) */}
                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium mb-1 text-gray-300">
                      Betrag (Netto) *
                    </label>
                    <input
                      id="amount"
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                      required
                      disabled={submitting}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Betrag vor Steuern.
                    </p>
                  </div>

                  {/* VAT Exempt Toggle */}
                    <div>
                        <label htmlFor="vat_exempt" className="block text-sm font-medium mb-1 text-gray-300">
                          Steueroption
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer mt-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 h-[42px]">
                          <input
                            id="vat_exempt"
                            type="checkbox"
                            name="vat_exempt"
                            checked={formData.vat_exempt}
                            onChange={handleChange}
                            className="w-4 h-4 accent-[#ffcb00] disabled:opacity-50"
                            disabled={submitting}
                          />
                          <span className="text-sm font-medium text-gray-300">Steuerfrei</span>
                        </label>
                         <p className="text-xs text-gray-400 mt-1">
                             Aktivieren Sie dies, wenn die Steuer nicht anwendbar ist (z.B. §19 UStG).
                        </p>
                    </div>


                  {/* Tax Amount (Calculated or 0) */}
                   <div>
                      <label htmlFor="tax_amount" className="block text-sm font-medium mb-1 text-gray-300">
                        Steuerbetrag {formData.vat_exempt ? '(Steuerfrei)' : '(19% USt)'}
                      </label>
                       <input
                           id="tax_amount"
                           type="number"
                           name="tax_amount"
                           value={formData.tax_amount}
                           onChange={handleChange} // Allow manual override but recalculate total
                           step="0.01"
                           min="0"
                           className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50 bg-opacity-70" // Slightly dimmer if calculated
                           disabled={submitting || formData.vat_exempt} // Disable if exempt
                           readOnly={!formData.vat_exempt} // ReadOnly if standard VAT to encourage relying on calculation, but allow override if needed
                       />
                       <p className="text-xs text-gray-400 mt-1">
                           {formData.vat_exempt ? 'Auf 0.00 gesetzt' : 'Automatisch berechnet (19% Standard).'}
                       </p>
                   </div>


                  {/* Total Amount (Calculated) */}
                  <div>
                    <label htmlFor="total_amount" className="block text-sm font-medium mb-1 text-gray-300">
                      Gesamtbetrag (Brutto) *
                    </label>
                    <input
                      id="total_amount"
                      type="number"
                      name="total_amount"
                      value={formData.total_amount}
                      readOnly // Always calculated
                      step="0.01"
                      min="0"
                      className="w-full bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none text-white font-semibold" // Clearly indicate read-only/calculated
                      required
                      disabled={submitting} // Technically covered by readOnly, but good practice
                      placeholder="0.00"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Automatisch berechnet (Betrag + Steuer).
                    </p>
                  </div>

                  {/* Materials Section */}
                  <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-white/10">
                    <h3 className="text-lg font-semibold mb-3 text-gray-300">Materialien und Dienstleistungen</h3>
                    <MaterialSelector
                      selectedMaterials={formData.materials}
                      onChange={handleMaterialsChange}
                    />
                    {/* Show materials price in the UI */}
                    {parseFloat(formData.total_materials_price) > 0 && (
                      <div className="mt-2 text-right">
                        <span className="text-sm font-medium text-gray-300">
                          Materialkosten: €{parseFloat(formData.total_materials_price).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="col-span-1 md:col-span-2">
                    <label htmlFor="notes" className="block text-sm font-medium mb-1 text-gray-300">
                      Notizen / Service-Beschreibung
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows="4"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                      disabled={submitting}
                      placeholder="Fügen Sie weitere Details, Bedingungen oder eine Beschreibung der Dienstleistungen hinzu..."
                    />
                    {/* Closing textarea tag added */}
                  </div>

                </div> {/* Closing grid div */}

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
                         Erstelle...
                       </>
                     ) : (
                       `Erstelle ${getDocumentTypeName()}`
                     )}
                   </button>
                 </div>

              </form> {/* Closing form tag */}
            </div> // Closing form container div
          )} {/* Closing conditional rendering for form */}

        </main> {/* Closing main tag */}
        <Footer /> {/* Added Footer */}
      </div> {/* Closing main layout div */}
    </> // Closing fragment
  ); // Closing return
} // Closing component function


// Need to wrap the component with Suspense because it uses useSearchParams
export default function InvoicePage() {
    return (
        <Suspense fallback={<InvoicePageLoadingSkeleton />}>
             <InvoicePageContent />
        </Suspense>
    );
}

// Basic Loading Skeleton Component (Optional but recommended)
function InvoicePageLoadingSkeleton() {
    return (
         <>
             <Header />
             <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
                 <main className="container mx-auto px-4 py-8 animate-pulse">
                     {/* Header Skeleton */}
                     <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
                         <div className="h-6 bg-gray-700 rounded w-3/4 mb-3"></div>
                         <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
                         <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                     </div>
                     {/* Form Skeleton */}
                     <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="col-span-1 md:col-span-2 h-10 bg-gray-700 rounded-xl"></div>
                             <div className="col-span-1 md:col-span-2 h-10 bg-gray-700 rounded-xl"></div>
                              <div className="h-10 bg-gray-700 rounded-xl"></div>
                              <div className="h-10 bg-gray-700 rounded-xl"></div>
                              <div className="h-10 bg-gray-700 rounded-xl"></div>
                              <div className="h-10 bg-gray-700 rounded-xl"></div>
                              <div className="h-10 bg-gray-700 rounded-xl"></div>
                              <div className="h-10 bg-gray-700 rounded-xl"></div>
                              <div className="col-span-1 md:col-span-2 h-24 bg-gray-700 rounded-xl"></div>
                         </div>
                         <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                            <div className="h-11 w-36 bg-gray-700 rounded-xl"></div>
                        </div>
                     </div>
                 </main>
                 <Footer />
             </div>
        </>
    );
}