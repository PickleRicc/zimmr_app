'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { generateInvoicePdf } from '../../../lib/utils/pdfGenerator';
import MaterialSelector from '../../components/MaterialSelector';
import AIQuoteAssistant from '../../components/AIQuoteAssistant';
import SmartMaterialSelector from '../../components/SmartMaterialSelector';

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
    amount: '0.00',
    tax_amount: '0.00',
    total_amount: '0.00',
    notes: '',
    due_date: '',
    service_date: '',
    location: '',
    vat_exempt: false,
    type: 'quote', // Default to quote type
    appointment_id: '',
    materials: [], // Array to store selected materials
    total_materials_price: '0.00', // Total price of materials
    serviceType: '', // For AI suggestions
    projectDescription: '' // For AI analysis
  });
  
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [createdQuote, setCreatedQuote] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [useSmartMaterials, setUseSmartMaterials] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const fetcher = useAuthedFetch();

  useEffect(() => {
    if (authLoading || !user) return;

    const init = async () => {
      try {
        // Get craftsman ID using the same system as other APIs
        const craftsmanResponse = await fetcher('/api/craftsmen');
        
        if (!craftsmanResponse.ok) {
          const errorData = await craftsmanResponse.json().catch(() => null);
          throw new Error(errorData?.message || `HTTP Error ${craftsmanResponse.status}`);
        }
        
        const craftsmanData = await craftsmanResponse.json();
        
        if (craftsmanData.status !== 'success' || !craftsmanData.data) {
          setError('Ihr Konto konnte keiner Handwerker-ID zugeordnet werden.');
          return;
        }

        // Persist craftsman UUID in local state for submission
        setFormData(prev => ({ ...prev, craftsman_id: craftsmanData.data.id }));

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
      const appointmentsArray = Array.isArray(appointmentsData) ? appointmentsData : [];
      

      
      setAppointments(appointmentsArray);
      // Initialize filtered appointments with all appointments
      setFilteredAppointments(appointmentsArray);
      
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

  const handleCustomerChange = (e) => {
    const customerId = e.target.value;
  
    // Update form data with selected customer
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      // Clear appointment selection when customer changes
      appointment_id: ''
    }));
  
    // Clear selected appointment
    setSelectedAppointment(null);
  
    // Filter appointments by selected customer
    if (customerId) {
      const customerAppointments = appointments.filter(appointment => 
        String(appointment.customer_id) === String(customerId)
      );
      setFilteredAppointments(customerAppointments);
    } else {
      // If no customer selected, show all appointments
      setFilteredAppointments(appointments);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
  
    // Handle customer selection with appointment filtering
    if (name === 'customer_id') {
      handleCustomerChange(e);
      return;
    }
  
    // For checkbox handling (e.g., vat_exempt)
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
      return;
    }
    if (name === 'vat_exempt') {
      const isExempt = type === 'checkbox' ? checked : value === 'true';
      const amount = parseFloat(formData.amount) || 0;
      const materialsCost = parseFloat(formData.total_materials_price) || 0;
      const subtotal = amount + materialsCost;
      const tax = isExempt ? 0 : subtotal * 0.19;
      const total = subtotal + tax;
    
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
      const subtotal = amount + materialsCost;
      const tax = formData.vat_exempt ? 0 : subtotal * 0.19;
      const total = subtotal + tax;
    
      console.log('Amount changed:', { amount, materialsCost, subtotal, tax, total });
    
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
  
  // Use React state for materials total to ensure reactivity
  const [materialsTotal, setMaterialsTotal] = useState('0.00');
  const [forceUpdate, setForceUpdate] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Calculate materials total whenever materials change
  useEffect(() => {
    const materialsArray = Array.isArray(formData.materials) ? formData.materials : [];
    console.log('Materials changed, recalculating total for:', materialsArray);
    
    const totalMaterialsPrice = materialsArray.reduce((sum, material) => {
      const quantity = parseFloat(material.quantity) || 0;
      const price = parseFloat(material.unit_price) || 0;
      const lineTotal = quantity * price;
      console.log(`Material ${material.name}: ${quantity} × ${price} = ${lineTotal}`);
      return sum + lineTotal;
    }, 0);
    
    console.log('Updated materials total:', totalMaterialsPrice);
    setMaterialsTotal(totalMaterialsPrice.toFixed(2));
    
    // Update tax and total calculations when materials change
    const serviceAmount = parseFloat(formData.amount) || 0;
    const subtotal = serviceAmount + totalMaterialsPrice;
    const tax = formData.vat_exempt ? 0 : subtotal * 0.19;
    const total = subtotal + tax;
    
    console.log('Updating tax and total from materials change:', { serviceAmount, totalMaterialsPrice, subtotal, tax, total });
    
    // Update form data with new calculations
    setFormData(prev => ({
      ...prev,
      total_materials_price: totalMaterialsPrice.toFixed(2),
      tax_amount: tax.toFixed(2),
      total_amount: total.toFixed(2)
    }));
  }, [formData.materials, formData.amount, formData.vat_exempt]);

  // Calculate the total price of all materials (for backward compatibility)
  const calculateMaterialsTotal = () => {
    return materialsTotal;
  };

  // Calculate combined totals for display
  const getDisplayTotals = () => {
    const serviceAmount = parseFloat(formData.amount) || 0; // User input - service only
    const materialsTotal = parseFloat(calculateMaterialsTotal()) || 0; // Materials only
    const subtotal = serviceAmount + materialsTotal; // Service + Materials
    const taxAmount = formData.vat_exempt ? 0 : subtotal * 0.19;
    const total = subtotal + taxAmount;
    
    return {
      serviceAmount: serviceAmount.toFixed(2),
      materialsTotal: materialsTotal.toFixed(2),
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2)
    };
  };

  // Handle materials selection changes
  const handleMaterialsChange = (materials) => {
    console.log('handleMaterialsChange called with:', materials);
    
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
    
    // Update materials and force immediate re-render
    setFormData(prev => {
      const newState = {
        ...prev,
        materials: materialsArray,
        total_materials_price: totalMaterialsPrice.toFixed(2)
      };
      console.log('Updated form state:', newState);
      return newState;
    });
    
    // Force immediate UI update
    setForceUpdate(prev => prev + 1);
  };

  const handleAppointmentChange = (e) => {
    const appointmentId = e.target.value;
    console.log('=== APPOINTMENT SELECTION DEBUG ===');
    console.log('Raw appointmentId:', appointmentId);
    console.log('appointmentId type:', typeof appointmentId);
    console.log('All appointments:', appointments);
    console.log('Filtered appointments:', filteredAppointments);
    console.log('All customers:', customers);
    
    if (!appointmentId) {
      console.log('No appointment selected (empty value)');
      setSelectedAppointment(null);
      setFormData(prev => ({ ...prev, appointment_id: '' }));
      return;
    }
    
    // Try both string and number comparison
    const appointment = appointments.find(apt => {
      console.log(`Comparing apt.id (${apt.id}, type: ${typeof apt.id}) with appointmentId (${appointmentId}, type: ${typeof appointmentId})`);
      return apt.id == appointmentId || apt.id === parseInt(appointmentId, 10) || String(apt.id) === String(appointmentId);
    });
    
    console.log('Found appointment:', appointment);
    
    if (!appointment) {
      console.error('APPOINTMENT NOT FOUND! Available appointment IDs:', appointments.map(a => ({ id: a.id, type: typeof a.id })));
      return;
    }
    
    setSelectedAppointment(appointment);
    
    if (appointment) {
      // Find the customer details
      console.log('Looking for customer with ID:', appointment.customer_id, 'type:', typeof appointment.customer_id);
      console.log('Available customers:', customers.map(c => ({ id: c.id, type: typeof c.id, name: c.name })));
      
      const customer = customers.find(c => {
        console.log(`Comparing customer.id (${c.id}, type: ${typeof c.id}) with appointment.customer_id (${appointment.customer_id}, type: ${typeof appointment.customer_id})`);
        return c.id == appointment.customer_id || c.id === parseInt(appointment.customer_id, 10) || String(c.id) === String(appointment.customer_id);
      });
      
      console.log('Found customer for appointment:', customer);
      
      if (!customer) {
        console.error('CUSTOMER NOT FOUND for appointment.customer_id:', appointment.customer_id);
      }
      
      // Update related fields with appointment and customer data
      const updates = {
        appointment_id: appointmentId,
        customer_id: String(appointment.customer_id),
        service_date: appointment.scheduled_at ? new Date(appointment.scheduled_at).toISOString().split('T')[0] : '',
      };
      
      // Add location from appointment if available, otherwise use customer address
      if (appointment.location) {
        updates.location = appointment.location;
      } else if (customer && customer.address) {
        updates.location = customer.address;
      }
      
      // Add appointment service type if available
      if (appointment.service_type) {
        updates.service_type = appointment.service_type;
      }
      
      // Add appointment notes to quote notes if available
      if (appointment.notes) {
        updates.notes = formData.notes ? 
          `${formData.notes}\n\nTermin-Notizen: ${appointment.notes}` : 
          `Termin-Notizen: ${appointment.notes}`;
      }
      
      console.log('Updating form with appointment and customer data:', updates);
      
      // Update form state
      setFormData(prev => ({ ...prev, ...updates }));
      
      // Also update the selected customer state
      setSelectedCustomer(customer);
      
      // Filter appointments by the selected customer to maintain consistency
      const customerAppointments = appointments.filter(apt => 
        String(apt.customer_id) === String(appointment.customer_id)
      );
      setFilteredAppointments(customerAppointments);
    } else {
      // If appointment is deselected, show all appointments again
      setFilteredAppointments(appointments);
      setFormData(prev => ({
        ...prev,
        appointment_id: appointmentId,
      }));
    }
  };

  const handleAISuggestions = (suggestions) => {
    console.log('Raw AI suggestions received:', suggestions);
    
    // Add AI suggestions to form data with correct MaterialSelector format
    const aiLineItems = suggestions.map(suggestion => {
      console.log('Processing suggestion:', suggestion);
      console.log('Unit price from suggestion:', suggestion.unitPrice);
      
      return {
        id: crypto.randomUUID(), // Unique ID for MaterialSelector
        name: suggestion.description, // MaterialSelector expects 'name' not 'description'
        quantity: suggestion.quantity,
        unit: suggestion.unit,
        unit_price: suggestion.unitPrice, // MaterialSelector expects 'unit_price'
        category: suggestion.category
      };
    });
    
    console.log('Processed AI line items:', aiLineItems);
    
    // Update materials with AI suggestions - don't modify the amount field
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, ...aiLineItems]
    }));
  };

  const handleGeneratedText = (text) => {
    // Set AI-generated text in notes field
    setFormData(prev => ({
      ...prev,
      notes: text
    }));
  };

  // Handle file uploads
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    if (validFiles.length !== files.length) {
      alert('Nur JPG, PNG und PDF Dateien bis 10MB sind erlaubt.');
    }

    const newFiles = validFiles.map(file => ({
      id: Date.now() + Math.random(),
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId) => {
    setUploadedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove && fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };


  const handleCustomerSelection = (customerId) => {
    const customer = customers.find(c => c.id === parseInt(customerId, 10));
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer_id: customerId }));
    
    // Filter appointments for selected customer
    if (customer) {
      const customerAppointments = appointments.filter(apt => 
        String(apt.customer_id) === String(customer.id)
      );
      setFilteredAppointments(customerAppointments);
    } else {
      setFilteredAppointments(appointments);
    }
  };

  const handleSmartMaterialSelection = (material) => {
    // Add smart material suggestion to materials with correct format
    const newMaterial = {
      id: crypto.randomUUID(),
      name: material.name,
      quantity: material.quantity || 1,
      unit_price: material.price_per_unit || material.unit_price, // Handle both formats
      unit: material.unit,
      category: material.category
    };
    
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, newMaterial]
    }));
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
      
      // Calculate correct totals including materials
      const baseAmount = parseFloat(formData.amount) || 0;
      const materialsTotal = parseFloat(formData.total_materials_price) || 0;
      const subtotal = baseAmount + materialsTotal;
      const taxAmount = formData.vat_exempt ? 0 : subtotal * 0.19;
      const totalAmount = subtotal + taxAmount;
      
      console.log('Corrected amount calculation:', { 
        baseAmount, 
        materialsTotal, 
        subtotal,
        taxAmount, 
        totalAmount,
        vat_exempt: formData.vat_exempt
      });
      
      const payload = {
        customer_id: formData.customer_id,
        appointment_id: formData.appointment_id || undefined, // Use undefined for empty values to avoid DB constraints
        status: 'draft',
        // Use proper column names from DB schema
        amount: baseAmount,
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
        materials: formData.materials || [],
        // Include uploaded files
        uploadedFiles: uploadedFiles || []
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
      await generateInvoicePdf(createdQuote);
      
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
        <div className="max-w-4xl mx-auto p-4 md:p-6 bg-black text-white min-h-screen">
          <div className="bg-[#1a1a1a] rounded-2xl p-4 md:p-8 shadow-xl border border-white/10">
            <h1 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 text-center">Neues Angebot erstellen</h1>
            <Link 
              href="/quotes" 
              className="inline-flex items-center text-[#ffcb00] hover:text-[#e6b800] transition-colors mb-6"
            >
              ← Zurück zu den Angeboten
            </Link>
          </div>

          {/* Success Message */}
          {success && createdQuote && (
            <div className="bg-green-900/50 border border-green-500 text-white p-4 rounded-xl mb-6">
              <h2 className="font-bold text-lg mb-2">Angebot erfolgreich erstellt!</h2>
              <p className="mb-4">Ihr Angebot wurde erfolgreich erstellt und im System gespeichert.</p>
              <div className="flex flex-col sm:flex-row gap-3">
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
                      value={formData.appointment_id || ''}
                      onChange={(e) => {
                        console.log('SELECT onChange triggered with value:', e.target.value);
                        handleAppointmentChange(e);
                      }}
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] appearance-none"
                      disabled={loadingAppointments || success}
                    >
                      <option value="">-- Termin auswählen --</option>
                      {formData.customer_id && filteredAppointments.length === 0 ? (
                        <option value="" disabled>
                          Keine Termine für ausgewählten Kunden
                        </option>
                      ) : (
                        filteredAppointments.map(appointment => {
                          // Get customer name with fallback logic
                          let customerName = 'Kein Kundenname';
                          if (appointment.customers) {
                            customerName = appointment.customers.name || 
                                         [appointment.customers.first_name, appointment.customers.last_name].filter(Boolean).join(' ').trim() ||
                                         'Kein Kundenname';
                          } else {
                            // Fallback: find customer in customers array
                            const customer = customers.find(c => c.id === appointment.customer_id);
                            if (customer) {
                              customerName = customer.name || 
                                           [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() ||
                                           'Kein Kundenname';
                            }
                          }
                          return (
                            <option key={appointment.id} value={appointment.id}>
                              {formatAppointmentDate(appointment.scheduled_at)} - {customerName}
                            </option>
                          );
                        })
                      )}
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
                  {!loadingAppointments && (
                    <p className="text-xs text-gray-400 mt-1">
                      💡 Tipp: Wählen Sie einen Termin aus, um automatisch den Kunden zu setzen, oder wählen Sie zuerst einen Kunden, um nur dessen Termine anzuzeigen.
                    </p>
                  )}
                </div>

                {/* Selected Appointment Card */}
                {selectedAppointment && (
                  <div className="mb-6 p-4 bg-gray-900/30 border border-gray-500/30 rounded-xl">
                    <h3 className="font-medium mb-2 text-gray-300">✓ Termin ausgewählt - Details übernommen</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Datum:</span> {new Date(selectedAppointment.scheduled_at).toLocaleDateString('de-DE')}
                      </div>
                      <div>
                        <span className="text-gray-400">Kunde:</span> {selectedCustomer?.name || 'Nicht gefunden'}
                      </div>
                      <div>
                        <span className="text-gray-400">Zeit:</span> {new Date(selectedAppointment.scheduled_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div>
                        <span className="text-gray-400">Service:</span> {selectedAppointment.service_type || 'Nicht angegeben'}
                      </div>
                      {selectedAppointment.location && (
                        <div className="col-span-1 lg:col-span-2">
                          <span className="text-gray-400">Adresse:</span> {selectedAppointment.location}
                        </div>
                      )}
                      {selectedCustomer?.address && !selectedAppointment.location && (
                        <div className="col-span-1 lg:col-span-2">
                          <span className="text-gray-400">Kundenadresse:</span> {selectedCustomer.address}
                        </div>
                      )}
                      {selectedAppointment.notes && (
                        <div className="col-span-1 lg:col-span-2">
                          <span className="text-gray-400">Termin-Notizen:</span> {selectedAppointment.notes}
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* Customer Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1">
                    Kunde *
                  </label>
                  <div className="relative">
                    <select
                      name="customer_id"
                      value={formData.customer_id}
                      onChange={(e) => {
                        handleChange(e);
                        handleCustomerSelection(e.target.value);
                      }}
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] appearance-none"
                      required
                      disabled={success}
                    >
                      <option value="">-- Kunde auswählen --</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || `Kunde ${customer.id}`}
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

                {/* Form Fields */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
                  {/* Service Type */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Art der Dienstleistung
                    </label>
                    <select
                      name="serviceType"
                      value={formData.serviceType}
                      onChange={handleChange}
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] appearance-none"
                      disabled={success}
                    >
                      <option value="">-- Dienstleistung auswählen --</option>
                      <option value="bathroom">Badezimmer</option>
                      <option value="kitchen">Küche</option>
                      <option value="flooring">Bodenbeläge</option>
                      <option value="tiling">Fliesenarbeiten</option>
                      <option value="renovation">Renovierung</option>
                      <option value="repair">Reparatur</option>
                      <option value="installation">Installation</option>
                      <option value="maintenance">Wartung</option>
                    </select>
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
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
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
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      placeholder={selectedAppointment ? "Adresse aus Termin verwenden" : "Adresse eingeben"}
                      disabled={success}
                    />
                  </div>

                  {/* VAT Exempt Checkbox */}
                  <div className="col-span-1 lg:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="vat_exempt"
                        name="vat_exempt"
                        checked={formData.vat_exempt}
                        onChange={handleChange}
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
                        className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        required
                        disabled={success}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Service-Betrag (ohne Materialien). Materialien werden separat berechnet.
                    </p>
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
                          value={formData.tax_amount || getDisplayTotals().taxAmount}
                          step="0.01"
                          min="0"
                          className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                          readOnly
                          disabled={success}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Automatisch berechnet als 19% von (€{getDisplayTotals().serviceAmount} Service + €{getDisplayTotals().materialsTotal} Materialien)
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
                        value={formData.total_amount || getDisplayTotals().total}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        required
                        readOnly
                        disabled={success}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                       €{getDisplayTotals().serviceAmount} (Service) + €{getDisplayTotals().materialsTotal} (Materialien) + €{getDisplayTotals().taxAmount} (Steuer)
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
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={success}
                    />
                  </div>
                  
                  {/* Project Description */}
                  <div className="col-span-1 lg:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Projektbeschreibung
                    </label>
                    <textarea
                      name="projectDescription"
                      value={formData.projectDescription}
                      onChange={handleChange}
                      rows="4"
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] resize-vertical"
                      placeholder="Beschreiben Sie das Projekt für bessere KI-Vorschläge..."
                      disabled={success}
                    />
                  </div>

                  {/* Quote Notes */}
                  <div className="col-span-1 lg:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Angebots-Notizen
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows="3"
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] resize-vertical"
                      placeholder="Zusätzliche Notizen zum Angebot..."
                      disabled={success}
                    />
                    
                    {/* File Upload Section */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-2">
                        📎 Dateien anhängen (Fotos, Skizzen, PDFs)
                      </label>
                      <div className="border-2 border-dashed border-white/20 rounded-xl p-4 hover:border-[#ffcb00]/50 transition-colors">
                        <input
                          type="file"
                          multiple
                          accept="image/jpeg,image/jpg,image/png,application/pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="file-upload"
                          disabled={success}
                        />
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer flex flex-col items-center justify-center text-center"
                        >
                          <div className="text-3xl mb-2">📁</div>
                          <div className="text-sm text-gray-300">
                            Klicken Sie hier oder ziehen Sie Dateien hierher
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            JPG, PNG, PDF • Max. 10MB pro Datei
                          </div>
                        </label>
                      </div>
                      
                      {/* Uploaded Files Display */}
                      {uploadedFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h4 className="text-sm font-medium text-gray-300">Hochgeladene Dateien:</h4>
                          {uploadedFiles.map(file => (
                            <div key={file.id} className="flex items-center justify-between bg-[#2a2a2a] rounded-lg p-3">
                              <div className="flex items-center gap-3">
                                {file.preview ? (
                                  <img src={file.preview} alt={file.name} className="w-10 h-10 object-cover rounded" />
                                ) : (
                                  <div className="w-10 h-10 bg-red-500 rounded flex items-center justify-center text-white text-xs">
                                    PDF
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-medium">{file.name}</div>
                                  <div className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFile(file.id)}
                                className="text-red-400 hover:text-red-300 text-sm"
                                disabled={success}
                              >
                                Entfernen
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                
                {/* Materials Section */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <MaterialSelector 
                    key={`materials-${forceUpdate}`}
                    selectedMaterials={formData.materials}
                    onChange={handleMaterialsChange}
                  />
                  
                  
                  {/* Materials Total */}
                  <div className="mt-4 flex justify-end">
                    <div className="bg-[#ffcb00] border border-[#ffcb00]/50 rounded-xl px-6 py-3 inline-flex items-center">
                      <span className="text-sm font-medium text-black">Materials Total:</span>
                      <span className="ml-4 text-lg font-semibold text-black" key={`total-${forceUpdate}`}>€{materialsTotal}</span>
                    </div>
                  </div>
                </div>

                {/* AI Quote Assistant */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  {formData.serviceType && formData.projectDescription ? (
                    <AIQuoteAssistant
                      key="ai-quote-assistant"
                      serviceType={formData.serviceType}
                      projectDescription={formData.projectDescription}
                      customer={selectedCustomer}
                      onSuggestionsReceived={handleAISuggestions}
                      onTextGenerated={handleGeneratedText}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>Wählen Sie eine Dienstleistung und fügen Sie eine Projektbeschreibung hinzu, um KI-Funktionen zu aktivieren.</p>
                    </div>
                  )}
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
        </div>
      </div>
      <Footer />
    </>
  );
}
