'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';

export default function NewAppointmentPage() {
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const fetcherRef = useRef(fetcher);
  useEffect(()=>{fetcherRef.current = fetcher;}, [fetcher]);

  /* ---------- state ---------- */
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // form fields
  const [isPrivate, setIsPrivate] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  /* ---------- load customers ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetcherRef.current('/api/customers');
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
        
        // Handle standardized API response format
        const response = res.status === 404 ? { data: [] } : await res.json();
        
        // Extract data, supporting both new standardized and legacy formats
        const customerData = response.data !== undefined ? response.data : response;
        setCustomers(Array.isArray(customerData) ? customerData : []);
        
        // Display success message if available
        if (response.message) {
          console.log('API Message:', response.message);
        }
      } catch (e) {
        console.error('load customers', e);
        setError('Fehler beim Laden der Kunden.');
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  /* ---------- handlers ---------- */
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isPrivate && !customerId) return setError('Bitte wählen Sie einen Kunden.');
    if (!scheduledDate || !scheduledTime) return setError('Bitte Datum und Uhrzeit wählen.');

    setSaving(true);
    try {
      const scheduled_at = `${scheduledDate}T${scheduledTime}`;
      const body = {
        scheduled_at,
        duration: Number(duration),
        location,
        notes,
        is_private: isPrivate,
        ...(isPrivate ? {} : { customer_id: customerId })
      };
      const res = await fetcher('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        // Try to parse error response if available in standardized format
        try {
          const errorResponse = await res.json();
          if (errorResponse.message) {
            throw new Error(errorResponse.message);
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch (parseError) {
          throw new Error(`HTTP ${res.status}`);
        }
      }
      
      // Parse successful response
      const response = await res.json();
      
      // Use message from API response if available, otherwise use default message
      setSuccess(response.message || 'Termin erstellt!');
      
      // Navigate after delay
      setTimeout(() => router.push('/appointments'), 1500);
    } catch (e) {
      console.error('create appointment', e);
      setError(e.message || 'Fehler beim Erstellen des Termins.');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto p-6 md:p-10">
        <h1 className="text-3xl font-bold mb-6">Neuer Termin</h1>

        {error && <div className="mb-4 p-3 bg-red-900/40 text-red-300 rounded-lg">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-900/40 text-green-300 rounded-lg">{success}</div>}

        {loadingCustomers ? (
          <p className="text-white/70">Kunden werden geladen…</p>) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Private toggle */}
            <label className="flex items-center gap-3">
              <input type="checkbox" className="w-5 h-5" checked={isPrivate} onChange={e=>setIsPrivate(e.target.checked)} />
              <span>Privater Termin (kein Kunde)</span>
            </label>

            {/* Customer select */}
            {!isPrivate && (
              <div>
                <label className="block mb-1">Kunde *</label>
                <select value={customerId} onChange={e=>setCustomerId(e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg p-3">
                  <option value="">Bitte wählen…</option>
                  {customers.map(c=> (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date & time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Datum *</label>
                <input type="date" value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg p-3" required />
              </div>
              <div>
                <label className="block mb-1">Uhrzeit *</label>
                <input type="time" value={scheduledTime} onChange={e=>setScheduledTime(e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg p-3" required />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block mb-1">Dauer (Minuten)</label>
              <select value={duration} onChange={e=>setDuration(e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg p-3">
                {[30,60,90,120,180,240].map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block mb-1">Ort</label>
              <input type="text" value={location} onChange={e=>setLocation(e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg p-3" />
            </div>

            {/* Notes */}
            <div>
              <label className="block mb-1">Notizen</label>
              <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg p-3" />
            </div>

            <div className="flex justify-end gap-4">
              <button type="button" onClick={()=>router.back()} className="px-4 py-2 border border-white/20 rounded-lg">Abbrechen</button>
              <button type="submit" disabled={saving} className="px-6 py-2 bg-[#ffcb00] text-black rounded-lg disabled:opacity-50">{saving?'Speichern…':'Termin erstellen'}</button>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
