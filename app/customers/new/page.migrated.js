'use client';

// Stub for creating a new customer using Supabase-backed API

import { useState } from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRouter } from 'next/navigation';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';

export default function NewCustomerPage() {
  const router = useRouter();
  const fetcher = useAuthedFetch();

  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.phone) return setError('Name und Telefon sind Pflichtfelder');

    setSaving(true);
    try {
      const res = await fetcher('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push('/customers');
    } catch (err) {
      console.error(err);
      setError('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
      <Header />
      <main className="flex-1 w-full max-w-lg mx-auto p-6 md:p-10">
        <h1 className="text-3xl font-bold mb-6">Neuer Kunde</h1>
        {error && <p className="text-red-400 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="name" placeholder="Name *" value={form.name} onChange={handleChange} className="w-full p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
          <input name="phone" placeholder="Telefon *" value={form.phone} onChange={handleChange} className="w-full p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
          <input name="email" placeholder="E-Mail" value={form.email} onChange={handleChange} className="w-full p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
          <input name="address" placeholder="Adresse" value={form.address} onChange={handleChange} className="w-full p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
          <div className="flex justify-end gap-4">
            <button type="button" onClick={()=>router.back()} className="px-4 py-2 border border-white/20 rounded-lg">Abbrechen</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[#ffcb00] text-black rounded-lg disabled:opacity-50">{saving?'Speichern…':'Kunden anlegen'}</button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
