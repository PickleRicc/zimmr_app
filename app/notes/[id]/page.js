'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function NoteDetailPage({ params }) {
  const noteId = use(params).id;
  
  const { user, loading: authLoading } = useRequireAuth();
  const authedFetch = useAuthedFetch();
  
  const [note, setNote] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    customer_id: '',
    appointment_id: '',
    tags: '',
    is_private: false
  });
  
  const router = useRouter();

  // Fetch note data when user is authenticated
  useEffect(() => {
    if (!authLoading && user && noteId) {
      fetchNote();
      fetchCustomers();
      fetchAppointments();
    }
  }, [user, authLoading, noteId]);

  // Filter appointments when customer changes in edit mode
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

  const fetchNote = async () => {
    try {
      setLoading(true);
      const response = await authedFetch(`/api/notes/${noteId}?include_customer=true&include_appointment=true`);
      if (!response.ok) {
        throw new Error(`Failed to fetch note: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      const data = responseData.data !== undefined ? responseData.data : responseData;
      
      console.log('Fetched note:', data);
      
      setNote(data);
      
      // Initialize form data with note data
      setFormData({
        title: data.title || '',
        content: data.content || '',
        customer_id: data.customer_id || '',
        appointment_id: data.appointment_id || '',
        tags: Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''),
        is_private: data.is_private || false
      });
      
      setError(null);
    } catch (err) {
      console.error('Error fetching note:', err);
      const errorMessage = err.message.includes('404') 
        ? 'Notiz nicht gefunden.'
        : err.message.includes('403') 
        ? 'Keine Berechtigung für diese Notiz.'
        : 'Fehler beim Laden der Notiz. Bitte versuchen Sie es später erneut.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await authedFetch('/api/customers');
      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const responseData = response.status === 404 ? { data: { customers: [] } } : await response.json();
      const customers = responseData.data?.customers || responseData.customers || [];
      setCustomers(Array.isArray(customers) ? customers : []);
    } catch (error) {
      console.error('Error fetching customers:', error);
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
      
      console.log('Submitting note update:', noteData);
      
      const response = await authedFetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to update note: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      const result = responseData.data !== undefined ? responseData.data : responseData;
      
      console.log('Note updated:', result);
      
      setNote(result);
      setSuccess(true);
      setEditing(false);
      
      // Clear success message after delay
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Error updating note:', err);
      setError(err.message || 'Fehler beim Aktualisieren der Notiz. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCustomerName = () => {
    if (note?.customers) {
      return note.customers.name;
    }
    const customer = customers.find(c => c.id === (note?.customer_id || formData.customer_id));
    return customer ? customer.name : 'Unbekannter Kunde';
  };

  const getAppointmentTitle = () => {
    if (note?.appointments) {
      return `Termin vom ${new Date(note.appointments.scheduled_at).toLocaleDateString('de-DE')}`;
    }
    const appointment = appointments.find(a => a.id === (note?.appointment_id || formData.appointment_id));
    return appointment ? `Termin vom ${new Date(appointment.scheduled_at).toLocaleDateString('de-DE')}` : null;
  };

  const renderTags = (tags) => {
    if (!tags || (Array.isArray(tags) && tags.length === 0)) return null;
    
    const tagArray = Array.isArray(tags) ? tags : [tags];
    
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {tagArray.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 bg-[#ffcb00]/20 text-[#ffcb00] text-xs rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center">
              <svg className="w-7 h-7 mr-2 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Notiz Details
            </h1>
            <div className="flex space-x-3">
              <Link href="/notes" className="text-[#ffcb00] hover:text-[#e6b800] transition-colors">
                &larr; Zurück zu Notizen
              </Link>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100/10 border border-green-200/20 text-green-400 p-4 rounded-lg mb-6">
              Notiz erfolgreich aktualisiert!
            </div>
          )}
          
          {note ? (
            <>
              {editing ? (
                <div className="bg-white/5 backdrop-blur-md rounded-xl shadow-xl border border-white/10 overflow-hidden">
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-6">Notiz bearbeiten</h3>
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
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white disabled:opacity-50"
                        >
                          <option value="">Kein spezifischer Termin</option>
                          {filteredAppointments.map(appointment => (
                            <option key={appointment.id} value={appointment.id}>
                              {`Termin vom ${new Date(appointment.scheduled_at).toLocaleDateString('de-DE')}`}
                            </option>
                          ))}
                        </select>
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
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
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
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white resize-none"
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
                          placeholder="durch Kommas getrennt"
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50 text-white"
                        />
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
                          Private Notiz
                        </label>
                      </div>

                      {/* Submit Buttons */}
                      <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                        <button
                          type="submit"
                          disabled={submitting}
                          className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-200 ${
                            submitting
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-[#ffcb00] hover:bg-[#e6b800] text-black'
                          }`}
                        >
                          {submitting ? 'Wird gespeichert...' : 'Änderungen speichern'}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setEditing(false)}
                          className="flex-1 py-3 px-6 rounded-xl font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 backdrop-blur-md rounded-xl shadow-xl border border-white/10 overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white mb-2">{note.title}</h2>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                          <span>👤 {getCustomerName()}</span>
                          {getAppointmentTitle() && (
                            <span>📅 {getAppointmentTitle()}</span>
                          )}
                          {note.is_private && (
                            <span className="text-yellow-400">🔒 Privat</span>
                          )}
                        </div>
                        {renderTags(note.tags)}
                      </div>
                      <button
                        onClick={() => setEditing(true)}
                        className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Bearbeiten
                      </button>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-white mb-3">Inhalt</h3>
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-gray-700 pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Erstellt:</span>
                          <div className="text-white">{formatDate(note.created_at)}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Zuletzt bearbeitet:</span>
                          <div className="text-white">{formatDate(note.updated_at)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-white/70 text-lg">Notiz nicht gefunden</p>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}
