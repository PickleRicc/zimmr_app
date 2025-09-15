'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function NewNotePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const authedFetch = useAuthedFetch();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Pre-fill data from URL params
  const appointmentId = searchParams.get('appointment_id');
  const customerId = searchParams.get('customer_id');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    customer_id: customerId || '',
    appointment_id: appointmentId || '',
    tags: '',
    is_private: false
  });

  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Fetch initial data when authentication is ready
  useEffect(() => {
    if (!authLoading && user) {
      fetchCustomers();
      fetchAppointments();
    }
  }, [authLoading, user]);

  // Filter appointments when customer changes
  useEffect(() => {
    if (formData.customer_id) {
      const customerAppointments = appointments.filter(
        appointment => appointment.customer_id === formData.customer_id
      );
      setFilteredAppointments(customerAppointments);
      
      // Clear appointment selection if it doesn't belong to the selected customer
      if (formData.appointment_id && !customerAppointments.find(a => a.id === formData.appointment_id)) {
        setFormData(prev => ({ ...prev, appointment_id: '' }));
      }
    } else {
      setFilteredAppointments([]);
      setFormData(prev => ({ ...prev, appointment_id: '' }));
    }
  }, [formData.customer_id, appointments]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await authedFetch('/api/customers');
      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const responseData = response.status === 404 ? { data: { customers: [] } } : await response.json();
      const customers = responseData.data?.customers || responseData.customers || [];
      setCustomers(Array.isArray(customers) ? customers : []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Fehler beim Laden der Kundendaten');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await authedFetch('/api/appointments');
      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const responseData = response.status === 404 ? { data: [] } : await response.json();
      const appointments = responseData.data || responseData;
      setAppointments(Array.isArray(appointments) ? appointments : []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.customer_id) {
      setError('Bitte wählen Sie einen Kunden aus');
      return;
    }

    if (!formData.title.trim()) {
      setError('Bitte geben Sie einen Titel ein');
      return;
    }

    if (!formData.content.trim()) {
      setError('Bitte geben Sie einen Inhalt ein');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Prepare data for submission
      const noteData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        customer_id: formData.customer_id,
        appointment_id: formData.appointment_id || null,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        is_private: formData.is_private
      };

      console.log('Submitting note data:', noteData);

      const response = await authedFetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP Error ${response.status}`);
      }

      const responseData = await response.json();
      const result = responseData.data !== undefined ? responseData.data : responseData;
      
      console.log('Note created:', result);
      
      setSuccess(true);
      
      // Redirect to notes list after a short delay
      setTimeout(() => {
        router.push('/notes');
      }, 1500);

    } catch (err) {
      console.error('Error creating note:', err);
      setError(err.message || 'Fehler beim Erstellen der Notiz');
      setSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedCustomerName = () => {
    const customer = customers.find(c => c.id === formData.customer_id);
    return customer ? customer.name : '';
  };

  const getSelectedAppointmentTitle = () => {
    const appointment = filteredAppointments.find(a => a.id === formData.appointment_id);
    return appointment ? `Termin vom ${new Date(appointment.scheduled_at).toLocaleDateString('de-DE')}` : '';
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white flex items-center justify-center">
      <div className="text-white">Laden...</div>
    </div>;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          {/* Header Section */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 transition-all duration-300 mb-6">
            <div className="mb-6">
              <h2 className="text-2xl md:text-3xl font-bold mb-2 text-white font-heading">Neue Notiz erstellen</h2>
              <p className="text-gray-400">Erstellen Sie eine neue Notiz für einen Kunden oder einen spezifischen Termin.</p>
            </div>
            <Link
              href="/notes"
              className="text-[#ffcb00] hover:text-[#e6b800] transition-colors inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Zurück zu Notizen
            </Link>
          </div>

          {error && (
            <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100/10 border border-green-200/20 text-green-400 p-4 rounded-lg mb-6">
              Notiz erfolgreich erstellt! Sie werden weitergeleitet...
            </div>
          )}

          {/* Form Section */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Kunde *
                </label>
                <select
                  name="customer_id"
                  value={formData.customer_id}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                  required
                >
                  <option value="">Kunde auswählen</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.email ? `(${customer.email})` : ''}
                    </option>
                  ))}
                </select>
                {formData.customer_id && (
                  <p className="text-sm text-gray-400 mt-1">
                    Ausgewählt: {getSelectedCustomerName()}
                  </p>
                )}
              </div>

              {/* Appointment Selection */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Termin (Optional)
                </label>
                <select
                  name="appointment_id"
                  value={formData.appointment_id}
                  onChange={handleChange}
                  disabled={!formData.customer_id}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Kein spezifischer Termin</option>
                  {filteredAppointments.map(appointment => (
                    <option key={appointment.id} value={appointment.id}>
                      {`Termin vom ${new Date(appointment.scheduled_at).toLocaleDateString('de-DE')}`}
                    </option>
                  ))}
                </select>
                {!formData.customer_id && (
                  <p className="text-sm text-gray-400 mt-1">
                    Wählen Sie zuerst einen Kunden aus, um Termine zu sehen
                  </p>
                )}
                {formData.appointment_id && (
                  <p className="text-sm text-gray-400 mt-1">
                    Ausgewählt: {getSelectedAppointmentTitle()}
                  </p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Titel *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="z.B. Besprechung Badezimmer Renovierung"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white placeholder-gray-400"
                  required
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Inhalt *
                </label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  rows="8"
                  placeholder="Beschreiben Sie hier die Details der Notiz..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white placeholder-gray-400 resize-none"
                  required
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Tags (Optional)
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="z.B. wichtig, nachfassen, material (durch Kommas getrennt)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white placeholder-gray-400"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Trennen Sie mehrere Tags durch Kommas
                </p>
              </div>

              {/* Private Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_private"
                  checked={formData.is_private}
                  onChange={handleChange}
                  className="mr-3 h-4 w-4 text-[#ffcb00] focus:ring-[#ffcb00] border-gray-600 rounded bg-gray-800"
                />
                <label className="text-sm text-gray-300">
                  Private Notiz (nur für mich sichtbar)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                <button
                  type="submit"
                  disabled={submitting || loading}
                  className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-200 ${
                    submitting || loading
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-[#ffcb00] hover:bg-[#e6b800] text-black shadow-lg hover:shadow-xl'
                  }`}
                >
                  {submitting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                      Notiz wird erstellt...
                    </div>
                  ) : (
                    'Notiz erstellen'
                  )}
                </button>
                
                <Link
                  href="/notes"
                  className="flex-1 py-3 px-6 rounded-xl font-medium text-center bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
                >
                  Abbrechen
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}
