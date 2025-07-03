'use client';

// Migrated customers list page – WIP
// TODO: replace legacy customersAPI calls with useAuthedFetch to new /api/customers route.

import Header from '../components/Header';
import Footer from '../components/Footer';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';

export default function CustomersPageMigrated() {
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetcher('/api/customers');
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
        const data = res.status === 404 ? [] : await res.json();
        setCustomers(data);
      } catch (e) {
        console.error(e);
        setError('Fehler beim Laden der Kunden.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetcher]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Kunden</h1>
          <button onClick={() => router.push('/customers/new')} className="bg-[#ffcb00] text-black px-4 py-2 rounded-lg">Neuer Kunde</button>
        </div>
        {error && <p className="text-red-400 mb-4">{error}</p>}
        {loading ? <p className="text-white/70">Lädt…</p> : (
          customers.length === 0 ? <p className="text-white/60">Keine Kunden gefunden.</p> : (
            <div className="space-y-4">
              {customers.map(c => (
                <div key={c.id} className="p-4 bg-[#1b1b1b] rounded-xl border border-white/10 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-white/60">{c.phone}</p>
                  </div>
                  <button onClick={() => router.push(`/customers/${c.id}`)} className="text-[#ffcb00]">Ansehen</button>
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
