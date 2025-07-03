'use client';

// New customer creation page (migrated)
// Uses Supabase-authenticated API route `/api/customers` via useAuthedFetch
// Rich form adapted from legacy implementation, simplified where logic now
// lives server-side (e.g. craftsman id lookup) and using Tailwind dark theme.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';

export default function NewCustomerPage() {
  const router = useRouter();
  const fetcher = useAuthedFetch();

  // primitive fields ultimately sent to backend
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // structured helpers for nicer UX (combined into name / address)
  const [isCompany, setIsCompany] = useState(false);
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // combine structured name / address whenever parts change
  useEffect(() => {
    const fullName = isCompany
      ? firstName.trim() // company name stored in firstName field
      : [title.trim(), firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    setName(fullName);

    const line1 = [street.trim(), houseNumber.trim()].filter(Boolean).join(' ');
    let fullAddress = line1;
    if (addressLine2.trim()) fullAddress += `\n${addressLine2.trim()}`;
    const location = [postalCode.trim(), city.trim()].filter(Boolean).join(' ');
    if (location) fullAddress += fullAddress ? `\n${location}` : location;
    setAddress(fullAddress);
  }, [isCompany, title, firstName, lastName, street, houseNumber, addressLine2, postalCode, city]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!name || !phone) {
      setError('Name und Telefon sind Pflichtfelder');
      return;
    }
    setSaving(true);
    try {
      const res = await fetcher('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email: email || null, address: address || null, notes: notes || null })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess('Kunde erfolgreich hinzugefügt!');
      setTimeout(() => router.push('/customers'), 1500);
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
      <main className="flex-1 w-full max-w-2xl mx-auto p-6 md:p-10 animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Neuen Kunden hinzufügen</h1>
          <button onClick={() => router.back()} className="text-white/70 hover:text-white transition-colors">Zurück</button>
        </div>

        {error && <div className="bg-red-900/40 text-red-300 p-3 rounded-lg mb-4">{error}</div>}
        {success && <div className="bg-green-900/40 text-green-300 p-3 rounded-lg mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* customer type toggle */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input type="radio" className="accent-[#ffcb00]" checked={!isCompany} onChange={() => setIsCompany(false)} />
              <span>Privatperson</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" className="accent-[#ffcb00]" checked={isCompany} onChange={() => setIsCompany(true)} />
              <span>Unternehmen</span>
            </label>
          </div>

          {/* name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!isCompany && (
              <input placeholder="Anrede" value={title} onChange={e => setTitle(e.target.value)} className="col-span-1 p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
            )}
            <input
              placeholder={isCompany ? 'Firmenname *' : 'Vorname *'}
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className={`p-3 bg-[#1b1b1b] border border-white/10 rounded-lg ${isCompany ? 'md:col-span-3' : 'md:col-span-2'}`}
              required
            />
            {!isCompany && (
              <input placeholder="Nachname *" value={lastName} onChange={e => setLastName(e.target.value)} className="p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" required />
            )}
          </div>

          {/* contact */}
          <input placeholder="Telefon *" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" required />
          <input placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" type="email" />

          {/* address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Straße" value={street} onChange={e => setStreet(e.target.value)} className="p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
            <input placeholder="Nr." value={houseNumber} onChange={e => setHouseNumber(e.target.value)} className="p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
          </div>
          <input placeholder="Adresszusatz" value={addressLine2} onChange={e => setAddressLine2(e.target.value)} className="w-full p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="PLZ" value={postalCode} onChange={e => setPostalCode(e.target.value)} className="p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
            <input placeholder="Ort" value={city} onChange={e => setCity(e.target.value)} className="p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />
          </div>

          {/* notes */}
          <textarea placeholder="Notizen" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-3 bg-[#1b1b1b] border border-white/10 rounded-lg" />

          <div className="flex justify-end gap-4 pt-4">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-white/20 rounded-lg">Abbrechen</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[#ffcb00] text-black rounded-lg disabled:opacity-50">
              {saving ? 'Speichern…' : 'Kunde hinzufügen'}
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
