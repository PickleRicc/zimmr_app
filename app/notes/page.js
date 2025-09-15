'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useRequireAuth } from '../../lib/utils/useRequireAuth';

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [appointmentFilter, setAppointmentFilter] = useState('all');
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const fetcher = useAuthedFetch();
  const { user, loading: authLoading } = useRequireAuth();

  // Fetch data when authentication state is ready
  useEffect(() => {
    if (!authLoading && user) {
      fetchNotes();
      fetchCustomers();
      fetchAppointments();
    }
  }, [authLoading, user]);

  // Filter notes when search term or filters change
  useEffect(() => {
    let filtered = notes;

    // Text search
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(note => 
        note.title?.toLowerCase().includes(term) ||
        note.content?.toLowerCase().includes(term) ||
        note.customer_name?.toLowerCase().includes(term)
      );
    }

    // Customer filter
    if (customerFilter !== 'all') {
      filtered = filtered.filter(note => note.customer_id === customerFilter);
    }

    // Appointment filter
    if (appointmentFilter !== 'all') {
      if (appointmentFilter === 'no_appointment') {
        filtered = filtered.filter(note => !note.appointment_id);
      } else {
        filtered = filtered.filter(note => note.appointment_id === appointmentFilter);
      }
    }

    setFilteredNotes(filtered);
  }, [notes, searchTerm, customerFilter, appointmentFilter]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      
      const res = await fetcher('/api/notes?include_customer=true&include_appointment=true');
      if (!res.ok) throw new Error(await res.text());
      const responseData = await res.json();
      
      const notesArray = responseData.data?.notes || responseData.notes || [];
      
      // Add customer and appointment names for display
      const notesWithNames = notesArray.map(note => ({
        ...note,
        customer_name: note.customers?.name || 'Unbekannter Kunde',
        appointment_title: note.appointments ? `Termin vom ${new Date(note.appointments.scheduled_at).toLocaleDateString('de-DE')}` : null
      }));
      
      setNotes(notesWithNames);
      setError(null);
      
      if (responseData.message && responseData.status === 'success') {
        setSuccess(responseData.message);
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Fehler beim Laden von Notizen. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetcher('/api/customers');
      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const responseData = response.status === 404 ? { data: { customers: [] } } : await response.json();
      const customers = responseData.data?.customers || responseData.customers || [];
      setCustomers(Array.isArray(customers) ? customers : []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await fetcher('/api/appointments');
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

  const handleDelete = async (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!confirm('Sind Sie sicher, dass Sie diese Notiz löschen möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.')) {
      return;
    }
    
    try {
      setDeletingId(id);

      const res = await fetcher(`/api/notes/${id}`, { method: 'DELETE' });
      const responseData = res.ok ? await res.json() : null;

      const note = notes.find(n => n.id === id);
      const noteTitle = note?.title || 'Notiz';

      const successMessage = responseData?.message || `Notiz "${noteTitle}" erfolgreich gelöscht`;
      setSuccess(successMessage);
      
      await fetchNotes();
      
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error deleting note:', err);
      
      let errorMessage = `Fehler beim Löschen der Notiz: ${err.message}`;
      try {
        if (err.response) {
          const errorData = await err.response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const truncateContent = (content, maxLength = 100) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <>
      <Header title="Notizen" />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          {error && (
            <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100/10 border border-green-200/20 text-green-400 p-4 rounded-lg mb-6">
              {success}
            </div>
          )}
          
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
              <h1 className="text-2xl font-bold text-white">Notizen</h1>
              <Link 
                href="/notes/new" 
                className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Neue Notiz
              </Link>
            </div>
            
            {/* Filters and Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Notizen suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 pl-10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
              
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
              >
                <option value="all">Alle Kunden</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>

              <select
                value={appointmentFilter}
                onChange={(e) => setAppointmentFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
              >
                <option value="all">Alle Termine</option>
                <option value="no_appointment">Ohne Termin</option>
                {appointments.map(appointment => (
                  <option key={appointment.id} value={appointment.id}>
                    {`Termin vom ${new Date(appointment.scheduled_at).toLocaleDateString('de-DE')}`}
                  </option>
                ))}
              </select>
            </div>
            
            {loading ? (
              <div className="flex justify-center my-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-12">
                {searchTerm || customerFilter !== 'all' || appointmentFilter !== 'all' ? (
                  <div>
                    <p className="text-white/70 text-lg mb-3">Keine Notizen entsprechen Ihren Suchkriterien</p>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setCustomerFilter('all');
                        setAppointmentFilter('all');
                      }}
                      className="text-[#ffcb00] hover:underline"
                    >
                      Filter zurücksetzen
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-white/70 text-lg mb-4">Sie haben noch keine Notizen</p>
                    <Link
                      href="/notes/new"
                      className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg shadow text-sm font-medium inline-flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                      Erste Notiz erstellen
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredNotes.map((note) => (
                  <div key={note.id} className="bg-white/5 rounded-lg p-5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-white font-medium text-lg mb-1">{note.title || 'Ohne Titel'}</h3>
                        <p className="text-white/60 text-sm">{note.customer_name}</p>
                        {note.appointment_title && (
                          <p className="text-[#ffcb00] text-xs mt-1">📅 {note.appointment_title}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-white/70 text-sm leading-relaxed">
                        {truncateContent(note.content)}
                      </p>
                    </div>
                    
                    <div className="text-xs text-white/40 mb-4">
                      Erstellt: {formatDate(note.created_at)}
                    </div>
                    
                    <div className="flex justify-between gap-2 pt-3 border-t border-white/10">
                      <Link 
                        href={`/notes/${note.id}`}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center flex-1"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        Anzeigen
                      </Link>
                      <button
                        onClick={(e) => handleDelete(note.id, e)}
                        disabled={deletingId === note.id}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                      >
                        {deletingId === note.id ? (
                          <>
                            <span className="mr-2 h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>
                            Löschen...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            Löschen
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}
