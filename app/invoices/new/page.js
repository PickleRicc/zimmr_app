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
  const prefillData = searchParams.get('prefill');
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
    total_materials_price: '0.00', // Total price of materials
    // German compliance fields
    invoice_type: 'final', // 'final', 'partial', 'down_payment'
    tax_number: '',
    vat_id: '',
    small_business_exempt: false,
    payment_terms_days: 14,
    issue_date: new Date().toISOString().split('T')[0],
    service_period_start: '',
    service_period_end: '',
    reverse_charge: false,
    legal_footer_text: ''
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
  const [timeEntries, setTimeEntries] = useState([]);
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(false);
  const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);
  const router = useRouter();

  // Function to fetch quote data and pre-fill the form
  const fetchQuoteData = async (quoteId) => {
    try {
      setLoading(true);
      console.log(`Fetching quote ${quoteId} for pre-filling invoice`);

      const response = await authedFetch(`/api/quotes/${quoteId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to fetch quote: ${response.statusText}`);
      }
      
      // Handle standardized API response format
      const responseData = await response.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const quote = responseData.data !== undefined ? responseData.data : responseData;
      console.log('Quote data retrieved:', quote);
      
      // Display success message if available
      if (responseData.message) {
        console.log('API Message:', responseData.message);
      }

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
          materials: quote.materials || [],
          total_materials_price: quote.total_materials_price || '0.00',
          type: 'invoice', // Always set type to invoice when creating from quote
        }));
      }
    } catch (err) {
      console.error(`Error fetching quote ${quoteId}:`, err);
      setError(err.message || `Fehler beim Laden der Angebotsdaten. Bitte versuchen Sie es später erneut.`);
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
        // Handle prefill data from time tracking
        if (prefillData) {
          try {
            const parsedData = JSON.parse(decodeURIComponent(prefillData));
            console.log('Prefill data received:', parsedData);
            
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 14);
            const formattedDueDate = dueDate.toISOString().split('T')[0];
            
            setFormData(prev => ({
              ...prev,
              customer_id: parsedData.customer_id?.toString() || '',
              appointment_id: parsedData.appointment_id?.toString() || '',
              amount: parsedData.net_amount?.toString() || '',
              tax_amount: (parsedData.net_amount * 0.19).toFixed(2),
              total_amount: (parsedData.net_amount * 1.19).toFixed(2),
              due_date: formattedDueDate,
              materials: parsedData.line_items || [],
              notes: `Time entry: ${parsedData.line_items?.[0]?.description || 'Work completed'}`,
              vat_exempt: false
            }));
          } catch (err) {
            console.error('Error parsing prefill data:', err);
          }
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
      setLoading(true);
      const response = await authedFetch('/api/customers');
      if (!response.ok && response.status !== 404) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP ${response.status}`);
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
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err.message || 'Fehler beim Laden der Kundendaten');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      console.log('Fetching appointments');
      const response = await authedFetch('/api/appointments?status=completed&has_invoice=false');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP ${response.status}`);
      }
      
      // Handle standardized API response format
      const responseData = await response.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const data = responseData.data !== undefined ? responseData.data : responseData;
      console.log('Fetched appointments:', data);
      setAppointments(Array.isArray(data) ? data : []);
      
      // Log any API message
      if (responseData.message) {
        console.log('Appointments API Message:', responseData.message);
      }
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

  // Fetch time entries for a customer or appointment
  const fetchTimeEntries = async (customerId = null, appointmentId = null) => {
    try {
      setLoadingTimeEntries(true);
      let url = '/api/time-tracking';
      const params = new URLSearchParams();
      
      if (customerId) params.append('customer_id', customerId);
      if (appointmentId) params.append('appointment_id', appointmentId);
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await authedFetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to fetch time entries');
      }
      
      const responseData = await response.json();
      const data = responseData.data !== undefined ? responseData.data : responseData;
      
      // Filter only billable and completed entries
      const billableEntries = Array.isArray(data) ? data.filter(entry => 
        entry.is_billable && entry.status === 'completed' && entry.duration_minutes > 0
      ) : [];
      
      setTimeEntries(billableEntries);
      return billableEntries;
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError(err.message || 'Failed to fetch time entries');
      setTimeEntries([]);
      return [];
    } finally {
      setLoadingTimeEntries(false);
    }
  };

  // Import time entries as line items
  const importTimeEntries = (selectedEntries) => {
    const timeLineItems = selectedEntries.map(entry => {
      const hours = (entry.duration_minutes || 0) / 60;
      const rate = parseFloat(entry.hourly_rate) || 50; // Default rate if not set
      const amount = hours * rate;
      
      return {
        id: `time_${entry.id}`,
        name: entry.description || 'Time Entry',
        quantity: hours.toFixed(2),
        unit: 'hours',
        unit_price: rate.toFixed(2),
        total_price: amount.toFixed(2),
        category: 'Labor',
        notes: entry.notes || `Time entry from ${new Date(entry.start_time).toLocaleDateString('de-DE')}`
      };
    });
    
    // Add time entries to existing materials
    const updatedMaterials = [...(formData.materials || []), ...timeLineItems];
    
    setFormData(prev => ({
      ...prev,
      materials: updatedMaterials
    }));
    
    // Recalculate totals
    setTimeout(() => {
      const materialsTotal = calculateMaterialsTotal();
      setFormData(prev => handleVatChange({
        ...prev,
        total_materials_price: materialsTotal
      }));
    }, 100);
    
    setShowTimeEntriesModal(false);
  };

  // Calculate the total price of all materials currently in the form
  const calculateMaterialsTotal = () => {
    // Ensure materials is always an array
    const materialsArray = Array.isArray(formData.materials) ? formData.materials : [];
    
    console.log('====== CALCULATING MATERIALS TOTAL ======');
    console.log('Materials array in form:', materialsArray);
    console.log('Materials count:', materialsArray.length);
    
    // Calculate the total materials price
    const total = materialsArray.reduce((sum, material) => {
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
    
    // Format the total for display
    const total_materials_price = totalMaterialsPrice.toFixed(2);
    console.log('Setting total_materials_price:', total_materials_price);
    
    // Force a state update with the new materials and totals
    setFormData(prev => {
      const updatedData = {
        ...prev,
        materials: materialsArray,
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
   const materialsTotal = parseFloat(formData.total_materials_price) || 0;
   const subtotal = amount + materialsTotal;
   let taxAmount = parseFloat(formData.tax_amount) || 0;
   if (formData.vat_exempt) {
       taxAmount = 0; // Ensure tax is 0 if exempt
   } else if (Math.abs(taxAmount - subtotal * 0.19) > 0.001) {
       // Optional: Recalculate tax if it seems manually changed and doesn't match 19% of subtotal
       // taxAmount = subtotal * 0.19;
       console.warn("Tax amount might not be 19% of subtotal (amount + materials).");
   }
   const totalAmount = subtotal + taxAmount;


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
        // CRITICAL: Explicitly include materials array for backend storage
        materials: Array.isArray(formData.materials) ? formData.materials : [],
        total_materials_price: parseFloat(formData.total_materials_price || 0).toFixed(2),
        // Ensure dates are in correct format if needed by backend (e.g., ISO string)
        // due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        // service_date: formData.service_date ? new Date(formData.service_date).toISOString() : null,
      };
      
      console.log('Materials data being sent to backend:', invoiceData.materials);

      console.log('Submitting invoice data:', invoiceData);

      // Choose API based on type
      let result;
      let apiMessage;

      if (formData.type === 'quote') {
        console.log('Creating Quote');
        // Note: This API call might need to be updated separately
        // to handle standardized responses from quotesAPI
        result = await quotesAPI.create(invoiceData);
        console.log('Quote created:', result);
      } else {
        console.log('Creating Invoice/Draft');
        const response = await authedFetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invoiceData)
        });

        if (!response.ok) {
          // Try to extract error message from standardized response
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || `HTTP Error ${response.status}`);
        }

        // Handle standardized API response format
        const responseData = await response.json();
        
        // Extract data and message from the response
        result = responseData.data !== undefined ? responseData.data : responseData;
        apiMessage = responseData.message;
        
        console.log('Invoice/Draft created:', result);
        if (apiMessage) {
          console.log('API Success Message:', apiMessage);
        }
      }

      setSuccess(true);
      setCreatedInvoice(result); // Store the created invoice/quote object
      
      // Set success message if available from API
      if (apiMessage) {
        setError(null); // Clear any previous errors
        // You could display the API message in the UI here if desired
      }

      // Don't redirect immediately to allow PDF generation or viewing message

    } catch (err) {
      console.error(`Error creating ${formData.type}:`, err);
      // Use the error message from the standardized API response if available
      // Otherwise fall back to other error information
      const errorMsg = err.message || `Fehler beim Erstellen des ${formData.type === 'quote' ? 'Angebots' : 'Rechnung'}`;
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
        const selectedCustomer = customers.find(c => String(c.id) === String(invoiceData.customer_id));
        console.log('Selected customer:', selectedCustomer);
        
        if (!selectedCustomer) {
             console.warn("Customer details not found for PDF generation.");
        }

        // Use the actual created invoice/quote data returned from the API
        const documentDataForPdf = {
            ...invoiceData, // Base data from the API response
            // Add/override details needed specifically for the PDF that might not be in invoiceData
            customer_name: selectedCustomer?.name || 'Kunde',
            customer_email: selectedCustomer?.email || '',
            customer_phone: selectedCustomer?.phone || '',
            customer_address: selectedCustomer?.address || 'Adresse nicht verfügbar',
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

                  {/* Invoice Type (German Compliance) */}
                  {formData.type === 'invoice' && (
                    <div>
                      <label htmlFor="invoice_type" className="block text-sm font-medium mb-1 text-gray-300">
                        Rechnungsart *
                      </label>
                      <select
                        id="invoice_type"
                        name="invoice_type"
                        value={formData.invoice_type}
                        onChange={handleChange}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                        required
                        disabled={submitting}
                      >
                        <option value="final">Schlussrechnung</option>
                        <option value="partial">Teilrechnung</option>
                        <option value="down_payment">Anzahlungsrechnung</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">
                        Wählen Sie die Art der Rechnung gemäß deutschen Steuervorschriften.
                      </p>
                    </div>
                  )}

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

                  {/* German Tax Compliance Section */}
                  <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-white/10">
                    <h3 className="text-lg font-semibold mb-3 text-gray-300">Deutsche Steuervorschriften</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Small Business Exemption */}
                      <div>
                        <label htmlFor="small_business_exempt" className="block text-sm font-medium mb-1 text-gray-300">
                          Kleinunternehmerregelung
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer mt-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 h-[42px]">
                          <input
                            id="small_business_exempt"
                            type="checkbox"
                            name="small_business_exempt"
                            checked={formData.small_business_exempt}
                            onChange={handleChange}
                            className="w-4 h-4 accent-[#ffcb00] disabled:opacity-50"
                            disabled={submitting}
                          />
                          <span className="text-sm font-medium text-gray-300">§19 UStG anwenden</span>
                        </label>
                        <p className="text-xs text-gray-400 mt-1">
                          Kleinunternehmerregelung - keine Umsatzsteuer.
                        </p>
                      </div>

                      {/* Issue Date */}
                      <div>
                        <label htmlFor="issue_date" className="block text-sm font-medium mb-1 text-gray-300">
                          Rechnungsdatum *
                        </label>
                        <input
                          id="issue_date"
                          type="date"
                          name="issue_date"
                          value={formData.issue_date}
                          onChange={handleChange}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                          required
                          disabled={submitting}
                        />
                      </div>

                      {/* Payment Terms */}
                      <div>
                        <label htmlFor="payment_terms_days" className="block text-sm font-medium mb-1 text-gray-300">
                          Zahlungsziel (Tage)
                        </label>
                        <input
                          id="payment_terms_days"
                          type="number"
                          name="payment_terms_days"
                          value={formData.payment_terms_days}
                          onChange={handleChange}
                          min="1"
                          max="365"
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                          disabled={submitting}
                          placeholder="14"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Standard: 14 Tage nach Rechnungsdatum.
                        </p>
                      </div>

                      {/* Service Period */}
                      <div>
                        <label htmlFor="service_period_start" className="block text-sm font-medium mb-1 text-gray-300">
                          Leistungszeitraum Start
                        </label>
                        <input
                          id="service_period_start"
                          type="date"
                          name="service_period_start"
                          value={formData.service_period_start}
                          onChange={handleChange}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                          disabled={submitting}
                        />
                      </div>

                      <div>
                        <label htmlFor="service_period_end" className="block text-sm font-medium mb-1 text-gray-300">
                          Leistungszeitraum Ende
                        </label>
                        <input
                          id="service_period_end"
                          type="date"
                          name="service_period_end"
                          value={formData.service_period_end}
                          onChange={handleChange}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                          disabled={submitting}
                        />
                      </div>

                      {/* Reverse Charge */}
                      <div>
                        <label htmlFor="reverse_charge" className="block text-sm font-medium mb-1 text-gray-300">
                          Reverse Charge
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer mt-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 h-[42px]">
                          <input
                            id="reverse_charge"
                            type="checkbox"
                            name="reverse_charge"
                            checked={formData.reverse_charge}
                            onChange={handleChange}
                            className="w-4 h-4 accent-[#ffcb00] disabled:opacity-50"
                            disabled={submitting}
                          />
                          <span className="text-sm font-medium text-gray-300">Reverse Charge Verfahren</span>
                        </label>
                        <p className="text-xs text-gray-400 mt-1">
                          Für B2B EU-Geschäfte mit USt-IdNr.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* VAT Exempt Toggle (Legacy - now replaced by small_business_exempt) */}
                    <div style={{display: 'none'}}>
                        <label htmlFor="vat_exempt" className="block text-sm font-medium mb-1 text-gray-300">
                          Steueroption
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer mt-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 h-[42px]">
                          <input
                            id="vat_exempt"
                            type="checkbox"
                            name="vat_exempt"
                            checked={formData.vat_exempt || formData.small_business_exempt}
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


                  {/* Tax Amount (Calculated based on German rules) */}
                   <div>
                      <label htmlFor="tax_amount" className="block text-sm font-medium mb-1 text-gray-300">
                        Steuerbetrag {formData.small_business_exempt || formData.reverse_charge ? '(Steuerfrei)' : '(19% USt)'}
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
                           disabled={submitting || formData.small_business_exempt || formData.reverse_charge} // Disable if exempt
                           readOnly={!(formData.small_business_exempt || formData.reverse_charge)} // ReadOnly if standard VAT to encourage relying on calculation, but allow override if needed
                       />
                       <p className="text-xs text-gray-400 mt-1">
                           {formData.small_business_exempt ? 'Kleinunternehmerregelung §19 UStG - keine USt' : 
                            formData.reverse_charge ? 'Reverse Charge - keine USt' : 
                            'Automatisch berechnet (19% Standard).'}
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
                       className="w-full bg-gray-900/60 border border-gray-700 rounded-xl px-4 py-2 focus:outline-none text-white font-semibold"
                       required
                       disabled={submitting}
                       placeholder="0.00"
                     />
                     <p className="text-xs text-gray-400 mt-1">
                       Automatisch berechnet (Betrag + Materialien + Steuer).
                     </p>
                   </div>

                   {/* Materials Section */}
                   <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-white/10">
                     <div className="flex justify-between items-center mb-3">
                       <h3 className="text-lg font-semibold text-gray-300">Materialien und Dienstleistungen</h3>
                       <button
                         type="button"
                         onClick={() => {
                           if (formData.customer_id) {
                             fetchTimeEntries(formData.customer_id, formData.appointment_id);
                             setShowTimeEntriesModal(true);
                           } else {
                             setError('Bitte wählen Sie zuerst einen Kunden aus');
                             setTimeout(() => setError(''), 3000);
                           }
                         }}
                         className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center"
                         disabled={!formData.customer_id || loadingTimeEntries}
                       >
                         <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                         </svg>
                         {loadingTimeEntries ? 'Lade...' : 'Zeiterfassung importieren'}
                       </button>
                     </div>
                     <MaterialSelector
                       selectedMaterials={formData.materials}
                       onChange={handleMaterialsChange}
                     />
                     {/* Materials Total */}
                     <div className="mt-4 flex justify-end">
                       <div className="bg-[#ffcb00] border border-[#ffcb00]/50 rounded-xl px-6 py-3 inline-flex items-center">
                         <span className="text-sm font-medium text-black">Materialkosten:</span>
                         <span className="ml-4 text-lg font-semibold text-black">€{calculateMaterialsTotal()}</span>
                       </div>
                     </div>
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

      {/* Time Entries Import Modal */}
      {showTimeEntriesModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
          <div className="bg-[#121212] border border-white/10 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Zeiterfassung importieren</h2>
              <button 
                onClick={() => setShowTimeEntriesModal(false)}
                className="text-white/70 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            {loadingTimeEntries ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffcb00] mx-auto"></div>
                <p className="text-white/70 mt-2">Lade Zeiterfassung...</p>
              </div>
            ) : timeEntries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/70">Keine abrechenbaren Zeiterfassungen für diesen Kunden gefunden.</p>
              </div>
            ) : (
              <div>
                <p className="text-white/70 mb-4">
                  Wählen Sie die Zeiterfassungen aus, die Sie als Positionen zur Rechnung hinzufügen möchten:
                </p>
                
                <TimeEntriesTable 
                  entries={timeEntries}
                  onImport={importTimeEntries}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </> // Closing fragment
  ); // Closing return
} // Closing component function

// Time Entries Table Component
function TimeEntriesTable({ entries, onImport }) {
  const [selectedEntries, setSelectedEntries] = useState([]);

  const toggleEntry = (entry) => {
    setSelectedEntries(prev => {
      const isSelected = prev.find(e => e.id === entry.id);
      if (isSelected) {
        return prev.filter(e => e.id !== entry.id);
      } else {
        return [...prev, entry];
      }
    });
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const calculateTotal = () => {
    return selectedEntries.reduce((sum, entry) => {
      const hours = (entry.duration_minutes || 0) / 60;
      const rate = parseFloat(entry.hourly_rate) || 50;
      return sum + (hours * rate);
    }, 0).toFixed(2);
  };

  return (
    <div>
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/10">
              <th className="p-3 text-white/80 font-medium w-12">
                <input
                  type="checkbox"
                  checked={selectedEntries.length === entries.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEntries([...entries]);
                    } else {
                      setSelectedEntries([]);
                    }
                  }}
                  className="w-4 h-4 accent-[#ffcb00]"
                />
              </th>
              <th className="p-3 text-white/80 font-medium">Datum</th>
              <th className="p-3 text-white/80 font-medium">Beschreibung</th>
              <th className="p-3 text-white/80 font-medium">Dauer</th>
              <th className="p-3 text-white/80 font-medium">Stundensatz</th>
              <th className="p-3 text-white/80 font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {entries.map((entry) => {
              const hours = (entry.duration_minutes || 0) / 60;
              const rate = parseFloat(entry.hourly_rate) || 50;
              const amount = hours * rate;
              const isSelected = selectedEntries.find(e => e.id === entry.id);

              return (
                <tr 
                  key={entry.id} 
                  className={`hover:bg-white/5 cursor-pointer ${isSelected ? 'bg-[#ffcb00]/10' : ''}`}
                  onClick={() => toggleEntry(entry)}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => toggleEntry(entry)}
                      className="w-4 h-4 accent-[#ffcb00]"
                    />
                  </td>
                  <td className="p-3 text-white">{formatDate(entry.start_time)}</td>
                  <td className="p-3 text-white">
                    {entry.description}
                    {entry.notes && (
                      <div className="text-white/60 text-sm mt-1">{entry.notes}</div>
                    )}
                  </td>
                  <td className="p-3 text-white">{formatDuration(entry.duration_minutes)}</td>
                  <td className="p-3 text-white">€{rate.toFixed(2)}/h</td>
                  <td className="p-3 text-white">€{amount.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-white">
          <span className="font-medium">{selectedEntries.length}</span> von {entries.length} ausgewählt
          {selectedEntries.length > 0 && (
            <span className="ml-4 text-[#ffcb00] font-medium">
              Gesamt: €{calculateTotal()}
            </span>
          )}
        </div>
        <button
          onClick={() => onImport(selectedEntries)}
          disabled={selectedEntries.length === 0}
          className="px-6 py-2 bg-[#ffcb00] text-black font-medium rounded-lg hover:bg-[#e3b700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedEntries.length} Einträge importieren
        </button>
      </div>
    </div>
  );
}


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