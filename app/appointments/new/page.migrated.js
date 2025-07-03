'use client';

// Stub for the NEW Appointment page (Next-gen version)
// This file is the starting point for migrating the legacy appointments/new page.
// TODO:
//  • Fetch customers list via `/api/customers` using useAuthedFetch
//  • Build form for date/time, customer, notes, private toggle, etc.
//  • POST to `/api/appointments` on submit and redirect back to /appointments
//  • Handle success & error states
//  • Re-use shared components (Header, Footer) and maintain dark theme

import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';

export default function NewAppointmentPage() {
  const router = useRouter();
  const fetcher = useAuthedFetch();

  // Placeholder – no actual form yet
  const [message] = useState('Diese Seite wird gerade migriert…');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
      <Header />
      <main className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Neuer Termin</h1>
          <p className="text-white/70">{message}</p>
          <button
            onClick={() => router.back()}
            className="mt-6 bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg"
          >
            Zurück
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
