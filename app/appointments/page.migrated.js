'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
import CalendarView from '../components/CalendarView';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function AppointmentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState({});
  const [filter, setFilter] = useState('upcoming'); // upcoming, past, all, pending
  const [processingAppointment, setProcessingAppointment] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [appointmentToReject, setAppointmentToReject] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'calendar'

  const { user, loading: authLoading } = useAuth();
  const fetcher = useAuthedFetch();
  const router = useRouter();

  // Load all data once the user/session is ready
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    const load = async () => {
      try {
        const [aptRes, custRes] = await Promise.all([
          fetcher('/api/appointments'),
          fetcher('/api/customers')
        ]);
        if (!aptRes.ok) throw new Error(`Appointments HTTP ${aptRes.status}`);
        const aptData = await aptRes.json();
        setAppointments(Array.isArray(aptData) ? aptData : []);
        if (custRes.ok) {
          const custData = await custRes.json();
          const map = {};
          custData?.forEach(c => (map[c.id] = c));
          setCustomers(map);
        }
      } catch (e) {
        console.error(e);
        setError('Fehler beim Laden der Termine');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authLoading, user]);

  /* ---------- helpers ---------- */
  const filteredAppointments = () => {
    const now = new Date();
    switch (filter) {
      case 'pending':
        return appointments.filter(a => a.approval_status === 'pending');
      case 'past':
        return appointments.filter(a => new Date(a.scheduled_at) <= now);
      case 'all':
        return appointments;
      default: // upcoming
        return appointments.filter(a => new Date(a.scheduled_at) > now);
    }
  };

  const handleApprove = async id => {
    try {
      setProcessingAppointment(id);
      const res = await fetcher(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: 'approved' })
      });
      if (!res.ok) throw new Error();
      setAppointments(prev => prev.map(a => (a.id === id ? { ...a, approval_status: 'approved' } : a)));
      setSuccess('Termin genehmigt');
    } catch (e) {
      setError('Fehler beim Genehmigen');
    } finally {
      setProcessingAppointment(null);
    }
  };

  const handleReject = async () => {
    if (!appointmentToReject) return;
    try {
      setProcessingAppointment(appointmentToReject.id);
      const res = await fetcher(`/api/appointments/${appointmentToReject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: 'rejected', reject_reason: rejectReason })
      });
      if (!res.ok) throw new Error();
      setAppointments(prev => prev.map(a => (a.id === appointmentToReject.id ? { ...a, approval_status: 'rejected' } : a)));
      setSuccess('Termin abgelehnt');
      closeRejectModal();
    } catch (e) {
      setError('Fehler beim Ablehnen');
    } finally {
      setProcessingAppointment(null);
    }
  };

  const handleDelete = async id => {
    try {
      setProcessingAppointment(id);
      const res = await fetcher(`/api/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      setError('Fehler beim Löschen');
    } finally {
      setProcessingAppointment(null);
    }
  };

  const openRejectModal = appt => {
    setAppointmentToReject(appt);
    setRejectReason('');
    setShowRejectModal(true);
  };
  const closeRejectModal = () => {
    setShowRejectModal(false);
    setAppointmentToReject(null);
    setRejectReason('');
  };

  /* ---------- render helpers ---------- */
  const statusClass = (status, approval, isPrivate) => {
    if (isPrivate) return 'bg-gray-500/20 text-gray-400';
    if (approval === 'pending') return 'bg-yellow-100/80 text-yellow-800';
    if (approval === 'rejected') return 'bg-red-100/80 text-red-800';
    switch (status) {
      case 'completed':
        return 'bg-green-100/80 text-green-800';
      case 'cancelled':
        return 'bg-red-100/80 text-red-800';
      default:
        return 'bg-blue-100/80 text-blue-800';
    }
  };

  const formatDate = iso => new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen flex flex-col bg-[#111]">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-4">Termine</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {success && <p className="text-green-500 mb-4">{success}</p>}
        {loading ? (
          <p className="text-white/70">Lädt…</p>
        ) : (
          <>
            {/* Tabs */}
            <div className="mb-4 space-x-2">
              {['list', 'calendar'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded ${activeTab === tab ? 'bg-[#ffcb00] text-black' : 'bg-white/10 text-white'}`}
                >
                  {tab === 'list' ? 'Liste' : 'Kalender'}
                </button>
              ))}
            </div>

            {activeTab === 'calendar' ? (
              <CalendarView appointments={appointments} customers={customers} />
            ) : (
              <div className="space-y-4">
                {/* Filter buttons */}
                <div className="space-x-2 mb-2">
                  {['upcoming', 'past', 'all', 'pending'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded ${filter === f ? 'bg-[#ffcb00] text-black' : 'bg-white/10 text-white'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {filteredAppointments().length === 0 ? (
                  <p className="text-white/60">Keine Termine gefunden.</p>
                ) : (
                  filteredAppointments().map(appt => (
                    <div key={appt.id} className="p-4 bg-[#1b1b1b] rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-white">{customers[appt.customer_id]?.name || 'Kunde'} – {formatDate(appt.scheduled_at)}</p>
                        <p className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${statusClass(appt.status, appt.approval_status, appt.is_private)}`}>
                          {appt.approval_status === 'pending' ? 'Ausstehend' : appt.approval_status === 'rejected' ? 'Abgelehnt' : appt.status}
                        </p>
                      </div>
                      <div className="mt-3 sm:mt-0 flex space-x-2 text-sm">
                        {appt.approval_status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(appt.id)} disabled={processingAppointment===appt.id} className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded disabled:opacity-50">Genehmigen</button>
                            <button onClick={() => openRejectModal(appt)} className="bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded">Ablehnen</button>
                          </>
                        )}
                        <button onClick={() => handleDelete(appt.id)} disabled={processingAppointment===appt.id} className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded disabled:opacity-50">Löschen</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1b1b1b] rounded-xl p-6 w-full max-w-md border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4">Termin ablehnen</h2>
            <p className="text-white mb-4">Möchten Sie diesen Termin wirklich ablehnen?</p>
            <textarea
              className="w-full p-3 mb-4 rounded bg-[#111] border border-white/10 text-white"
              placeholder="Optionaler Grund…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end space-x-3">
              <button onClick={closeRejectModal} className="px-4 py-2 border border-white/30 rounded text-white">Abbrechen</button>
              <button onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded">Ablehnen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
