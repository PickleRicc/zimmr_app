'use client';

// Migrated customers list page – WIP
// Customers list page using new Supabase-backed API routes

import Header from '../components/Header';
import Footer from '../components/Footer';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
import { useRequireAuth } from '../../lib/utils/useRequireAuth';

export default function CustomersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const fetcher = useAuthedFetch();
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [success, setSuccess] = useState('');
  const [processingCustomer, setProcessingCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (authLoading || !user) return;
    // Remove the guard that prevented refetching
    
    setLoading(true); // Always show loading state when fetching
    console.log('Customers page - Fetching customers data');
    
    (async () => {
      try {
        const res = await fetcherRef.current('/api/customers');
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
        const responseJson = await res.json();
        // Handle new standardized API response format
        const data = responseJson.data || (res.status === 404 ? [] : responseJson);
        console.log(`Customers page - Fetched ${data.length} customers`);
        setCustomers(data);
        setSuccess(''); // reset any prior success
      } catch (e) {
        console.error('Customers page - Error fetching customers:', e);
        setError('Fehler beim Laden der Kunden.');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user, router.pathname]); // Added dependencies to refetch when page is visited

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term) ||
      (c.email || '').toLowerCase().includes(term)
    );
  });

  const handleDelete = async (id, name) => {
    if (!confirm(`${name} wirklich löschen?`)) return;
    try {
      setProcessingCustomer(id);
      const res = await fetcher(`/api/customers?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCustomers(prev => prev.filter(c => c.id !== id));
      setSuccess(`Kunde ${name} gelöscht.`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      console.error(e);
      setError('Löschen fehlgeschlagen.');
    } finally {
      setProcessingCustomer(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold">Kunden</h1>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-grow md:flex-none">
              <input type="text" placeholder="Suchen…" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-[#1b1b1b] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/50" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">🔍</span>
            </div>
            <button onClick={() => router.push('/customers/new')} className="bg-[#ffcb00] text-black px-4 py-2 rounded-lg whitespace-nowrap">Neuer Kunde</button>
          </div>
        </div>

        {error && <div className="bg-red-900/40 text-red-300 p-3 rounded-lg mb-4">{error}</div>}
        {success && <div className="bg-green-900/40 text-green-300 p-3 rounded-lg mb-4">{success}</div>}
        {loading ? <p className="text-white/70">Lädt…</p> : (
          filteredCustomers.length === 0 ? <p className="text-white/60">Keine Kunden gefunden.</p> : (
            <div className="space-y-4">
              {filteredCustomers.map(c => (
                <div key={c.id} className="p-5 bg-[#1b1b1b] rounded-xl border border-white/10 transition hover:bg-[#232323] flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#ffcb00]/20 text-[#ffcb00] flex items-center justify-center font-bold text-lg">{(c.name||'?').charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-sm text-white/60">{c.phone}</p>
                      {c.email && <p className="text-sm text-white/60">{c.email}</p>}
                    </div>
                  </div>
                  <div className="flex gap-4 justify-end">
                    <button onClick={() => router.push(`/customers/${c.id}`)} className="text-[#ffcb00]">Details</button>
                    <button onClick={() => router.push(`/appointments/new?customer_id=${c.id}`)} className="text-[#ffcb00]">Termin</button>
                    <button disabled={processingCustomer===c.id} onClick={() => handleDelete(c.id, c.name)} className="text-red-400">{processingCustomer===c.id?'…':'Löschen'}</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  );
}
