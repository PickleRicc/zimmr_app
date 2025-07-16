'use client';

// Migrated appointment detail page using Supabase-backed API routes
// Minimal first version: view details, approve/complete, edit basic fields

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import { splitLocalDateTime, formatLocal } from '../../../lib/utils/date';
import { useAuth } from '../../../contexts/AuthContext';



export default function AppointmentDetailPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [notes, setNotes] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [editForm, setEditForm] = useState({
    scheduled_at: '',
    notes: '',
    duration: '',
    location: ''
  });
  const [customerId, setCustomerId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [isPrivate, setIsPrivate] = useState(false);

  const router = useRouter();
  const { session } = useAuth();
  const fetcher = useAuthedFetch();
  const fetcherRef = useRef(fetcher);
  const fetchedRef = useRef(false);
  useEffect(()=>{fetcherRef.current = fetcher;}, [fetcher]);
  const params = useParams();
  const id = params?.id;

  useEffect(() => {
    if (id && session && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchAppointment();
    }
  }, [id, session]);

  const fetchAppointment = async () => {
    try {
      // Fetch appointment details
      console.log(`Fetching appointment with ID: ${id}`);
      const resA = await fetcherRef.current(`/api/appointments/${id}`);
      if(!resA.ok) throw new Error(`HTTP ${resA.status}`);
      
      // Handle standardized API response format
      const response = await resA.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const appointmentData = response.data !== undefined ? response.data : response;
      console.log('Appointment data received:', appointmentData);
      
      // Display success message if available
      if (response.message) {
        console.log('API Message:', response.message);
        setSuccess(response.message);
      }
      
      setAppointment(appointmentData);

      // Fetch customer details
      if (appointmentData.customer_id) {
        try {
          console.log(`Fetching customer with ID: ${appointmentData.customer_id}`);
          const resC = await fetcherRef.current(`/api/customers?id=${appointmentData.customer_id}`);
          if(resC.ok) {
            // Handle standardized API response format
            const customerResponse = await resC.json();
            
            // Extract data, supporting both new standardized and legacy formats
            const customerData = customerResponse.data !== undefined ? customerResponse.data : customerResponse;
            console.log('Customer data received:', customerData);
            setCustomer(customerData);
          }
        } catch (customerErr) {
          console.error('Error fetching customer details:', customerErr);
          // Continue with the rest of the function even if customer fetch fails
        }
      }

      // Set initial service price if available
      if (appointmentData.price) {
        setServicePrice(appointmentData.price.toString());
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching appointment:', err);

      // Check if it's a 404 error
      if (err.response && err.response.status === 404) {
        setError('Der Termin wurde nicht gefunden. Es ist möglich, dass er gelöscht wurde oder Sie keine Berechtigung haben, ihn zu sehen.');
      } else {
        setError(err.message || 'Fehler beim Laden des Termins. Bitte versuchen Sie es erneut.');
      }

      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '€0.00';

    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getStatusClass = (status, approvalStatus) => {
    // First check approval status
    if (approvalStatus === 'pending') {
      return 'bg-yellow-100/80 text-yellow-800 border border-yellow-200/50';
    }
    if (approvalStatus === 'rejected') {
      return 'bg-red-100/80 text-red-800 border border-red-200/50';
    }

    // Then check appointment status
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100/80 text-blue-800 border border-blue-200/50';
      case 'completed':
        return 'bg-green-100/80 text-green-800 border border-green-200/50';
      case 'cancelled':
        return 'bg-red-100/80 text-red-800 border border-red-200/50';
      default:
        return 'bg-gray-100/80 text-gray-800 border border-gray-200/50';
    }
  };

  const openCompleteModal = () => {
    setShowCompleteModal(true);
  };

  const closeCompleteModal = () => {
    setShowCompleteModal(false);
  };

  const openEditModal = () => {
    if (appointment) {
      // Format the date-time for the input field (YYYY-MM-DDThh:mm)
      const scheduledDate = new Date(appointment.scheduled_at);
      const formattedDate = scheduledDate.toISOString().slice(0, 16);

      setCustomerId(appointment.customer_id || '');
      setScheduledAt(scheduledDate.toISOString().split('T')[0]); // YYYY-MM-DD
      setScheduledTime(scheduledDate.toISOString().substring(11, 16)); // HH:MM
      setNotes(appointment.notes || '');
      setDuration(appointment.duration || 60);
      setLocation(appointment.location || '');
      setStatus(appointment.status || 'scheduled');
      setIsPrivate(appointment.is_private || false);

      setShowEditModal(true);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveAppointment = async () => {
    if (!appointment) return;

    setProcessingAction('edit');
    setError('');
    setSuccess('');

    try {
      const updateData = {
        customer_id: isPrivate ? null : parseInt(customerId),
        scheduled_at: new Date(`${scheduledAt}T${scheduledTime}`).toISOString(),
        notes,
        duration: parseInt(duration),
        location,
        status,
        is_private: isPrivate
      };

      // Call the API to update the appointment
      const res = await fetcherRef.current(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!res.ok) {
        // Try to extract error message from standardized response
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP Error ${res.status}`);
      }

      // Parse response with standardized format
      const response = await res.json();
      
      // Extract data supporting both standardized and legacy formats
      const result = response.data !== undefined ? response.data : response;

      // Update the appointment state with the result from the server
      if (result) {
        setAppointment(result);

        // Update the notes state if it's being used elsewhere in the UI
        if (result.notes) {
          setNotes(result.notes);
        }

        // Use the API's success message if available
        setSuccess(response.message || 'Der Termin wurde erfolgreich aktualisiert');
        setShowEditModal(false);
      }
    } catch (err) {
      console.error('Error updating appointment:', err);
      setError(err.message || 'Fehler beim Aktualisieren des Termins. Bitte versuchen Sie es erneut.');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCompleteAppointment = async () => {
    try {
      // Validate required fields
      if (!servicePrice || parseFloat(servicePrice) <= 0) {
        setError('Bitte geben Sie einen gültigen Preis ein.');
        return;
      }

      setProcessingAction('complete');
      setError('');
      setSuccess('');

      // Create update data
      const completeData = {
        status: 'completed',
        price: servicePrice,
        notes: notes
      };

      // Call the API to complete appointment using the standard PUT endpoint
      const res = await fetcherRef.current(`/api/appointments/${appointment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeData)
      });

      if (!res.ok) {
        // Try to extract error message from standardized response
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP Error ${res.status}`);
      }

      // Parse response with standardized format
      const response = await res.json();
      
      // Use the API's success message if available
      setSuccess(response.message || 'Der Termin wurde erfolgreich abgeschlossen!');

      // Redirect to the new invoice page with appointment data
      setTimeout(() => {
        // Prepare appointment data for invoice creation with correct parameter names
        const appointmentData = {
          appointment_id: appointment.id,
          customer_id: appointment.customer_id,
          amount: servicePrice, // Use 'amount' instead of 'price'
          service_date: appointment.scheduled_at ? appointment.scheduled_at.split('T')[0] : '',
          location: appointment.location || '',
          notes: notes || appointment.notes || '',
          from_appointment: 'true' // Ensure string value
        };

        // Create query string with appointment data
        const queryString = new URLSearchParams(appointmentData).toString();

        // Redirect to new invoice page with appointment data
        router.push(`/invoices/new?${queryString}`);
      }, 1000);
    } catch (err) {
      console.error('Error completing appointment:', err);
      setError(err.message || 'Fehler beim Abschließen des Termins. Bitte versuchen Sie es erneut.');
    } finally {
      setProcessingAction(null);
      setShowCompleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="bg-dark-lighter rounded-xl shadow-xl p-6 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">Termin nicht gefunden</h1>
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6">
                <p>{error}</p>
              </div>
            )}
            <a
              href="/appointments"
              className="inline-flex items-center px-4 py-2 bg-dark-lighter hover:bg-dark-border text-white font-medium rounded-xl transition-all duration-200 border border-dark-border"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Zurück zu den Terminen
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="bg-dark rounded-xl shadow-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <div className="flex items-center mb-2">
                <a
                  href="/appointments"
                  className="mr-3 text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                  </svg>
                </a>
                <h1 className="text-2xl md:text-3xl font-bold text-white">{appointment.title || 'Termin Details'}</h1>
              </div>
              <div className="flex items-center">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(appointment.status, appointment.approval_status)}`}>
                  {appointment.is_private ? 'Privat' :
                   appointment.approval_status === 'pending' ? 'Genehmigung ausstehend' :
                   appointment.approval_status === 'rejected' ? 'Abgelehnt' :
                   appointment.status === 'completed' ? 'Abgeschlossen' :
                   appointment.status === 'scheduled' ? 'Geplant' :
                   appointment.status === 'cancelled' ? 'Abgesagt' : 'Unbekannt'}
                </span>
              </div>
            </div>

            {appointment.status !== 'completed' && appointment.approval_status !== 'rejected' && (
              <div className="flex space-x-3">
                <button
                  onClick={openCompleteModal}
                  className="mt-4 md:mt-0 px-4 py-2 bg-primary hover:bg-[#e6b800] text-white font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Termin abschließen und Rechnung erstellen
                  </div>
                </button>
                <button
                  onClick={openEditModal}
                  className="mt-4 md:mt-0 px-4 py-2 bg-dark-lighter hover:bg-dark-border text-white font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-1.073-5.73-6.568 6.569-4.725-4.725-1.073-1.073 5.768-5.768 4.725 4.725z"></path>
                    </svg>
                    Termin bearbeiten
                  </div>
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6">
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg mb-6">
              <p>{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-dark rounded-xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Termin Details</h2>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/70">Datum:</span>
                  <span className="text-white">{splitLocalDateTime(appointment.scheduled_at).date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Uhrzeit:</span>
                  <span className="text-white">{splitLocalDateTime(appointment.scheduled_at).time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Dauer:</span>
                  <span className="text-white">{appointment.duration} Minuten</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Ort:</span>
                  <span className="text-white">{appointment.location || 'Nicht angegeben'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Service-Typ:</span>
                  <span className="text-white">{appointment.service_type || 'Nicht angegeben'}</span>
                </div>
                {appointment.price && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Preis:</span>
                    <span className="text-white">{formatCurrency(appointment.price)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/70">Status:</span>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(appointment.status, appointment.approval_status)}`}>
                    {appointment.is_private ? 'Privat' :
                     appointment.approval_status === 'pending' ? 'Genehmigung ausstehend' :
                     appointment.approval_status === 'rejected' ? 'Abgelehnt' :
                     appointment.status === 'completed' ? 'Abgeschlossen' :
                     appointment.status === 'scheduled' ? 'Geplant' :
                     appointment.status === 'cancelled' ? 'Abgesagt' : 'Unbekannt'}
                  </span>
                </div>
              </div>

              {appointment.notes && (
                <div className="mt-6">
                  <h3 className="text-white font-medium mb-2">Notizen:</h3>
                  <p className="text-white/80 bg-dark p-3 rounded-lg whitespace-pre-line">
                    {appointment.notes}
                  </p>
                </div>
              )}
            </div>

            {customer && (
              <div className="bg-dark rounded-xl shadow-xl p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Kundeninformationen</h2>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/70">Name:</span>
                    <span className="text-white">{customer.name}</span>
                  </div>
                  {customer.email && (
                    <div className="flex justify-between">
                      <span className="text-white/70">E-Mail:</span>
                      <span className="text-white">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex justify-between">
                      <span className="text-white/70">Telefon:</span>
                      <span className="text-white">{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex justify-between">
                      <span className="text-white/70">Adresse:</span>
                      <span className="text-white">{customer.address}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <a
                      href={`/customers/${customer.id}`}
                      className="text-primary hover:text-[#e6b800] transition-colors inline-flex items-center"
                    >
                      <span className="text-primary">Kundenprofil anzeigen</span>
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Complete Appointment Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl shadow-2xl p-6 max-w-3xl w-full animate-scale-in overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold text-white mb-4">Termin abschließen und Rechnung erstellen</h3>

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6">
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg mb-6">
                <p>{success}</p>
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="servicePrice" className="block text-sm font-medium text-white/80 mb-2">
                Service-Preis (€)
              </label>
              <input
                id="servicePrice"
                type="number"
                min="0"
                step="0.01"
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
                placeholder="Geben Sie den Service-Preis ein"
                className="w-full p-3 border border-dark-border rounded-xl bg-dark text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="notes" className="block text-sm font-medium text-white/80 mb-2">
                Rechnungsnotizen (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Fügen Sie Notizen für die Rechnung hinzu..."
                className="w-full p-3 border border-dark-border rounded-xl bg-dark text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                rows="3"
              ></textarea>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={closeCompleteModal}
                className="px-4 py-2 border border-dark-border rounded-xl text-white hover:bg-white/10 transition-all duration-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCompleteAppointment}
                disabled={processingAction === 'complete'}
                className="px-4 py-2 bg-primary hover:bg-[#e6b800] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 flex items-center"
              >
                {processingAction === 'complete' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verarbeitung...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Termin abschließen und Rechnung erstellen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Appointment Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark rounded-xl shadow-2xl p-6 max-w-3xl w-full animate-scale-in overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold text-white mb-4">Termin bearbeiten</h3>

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6">
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg mb-6">
                <p>{success}</p>
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="scheduledAt" className="block text-sm font-medium text-white/80 mb-2">
                Geplantes Datum & Uhrzeit
              </label>
              <input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt + 'T' + scheduledTime}
                onChange={(e) => {
                  const date = e.target.value.split('T');
                  setScheduledAt(date[0]);
                  setScheduledTime(date[1]);
                }}
                className="w-full p-3 border border-dark-border rounded-xl bg-dark text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="notes" className="block text-sm font-medium text-white/80 mb-2">
                Notizen
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Fügen Sie Notizen für den Termin hinzu..."
                className="w-full p-3 border border-dark-border rounded-xl bg-dark text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                rows="3"
              ></textarea>
            </div>
            
            <div className="mb-6">
              <label htmlFor="duration" className="block text-sm font-medium text-white/80 mb-2">
                Dauer (Minuten)
              </label>
              <input
                id="duration"
                type="number"
                min="1"
                value={editForm.duration}
                onChange={handleEditFormChange}
                name="duration"
                className="w-full p-3 border border-dark-border rounded-xl bg-dark text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="location" className="block text-sm font-medium text-white/80 mb-2">
                Ort
              </label>
              <input
                id="location"
                type="text"
                value={editForm.location}
                onChange={handleEditFormChange}
                name="location"
                className="w-full p-3 border border-dark-border rounded-xl bg-dark text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 border border-dark-border rounded-xl text-white hover:bg-white/10 transition-all duration-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveAppointment}
                disabled={processingAction === 'edit'}
                className="px-4 py-2 bg-primary hover:bg-[#e6b800] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 flex items-center"
              >
                {processingAction === 'edit' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verarbeitung...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-1.073-5.73-6.568 6.569-4.725-4.725-1.073-1.073 5.768-5.768 4.725 4.725z"></path>
                    </svg>
                    Änderungen speichern
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}
