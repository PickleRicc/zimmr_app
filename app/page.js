'use client';

import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Link from 'next/link';
import NextAppointment from './components/NextAppointment';

export default function Home() {
  return (
    <>
      <Header minimal />
      {/* --- LANDING PAGE CONTENT ONLY: No dashboard logic here --- */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 md:px-12 lg:px-16 pt-16 pb-8 bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        {/* Hero Section */}
        <div className="w-full max-w-6xl mx-auto flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-8 mb-12">
          {/* Left side - Content */}
          <div className="w-full md:w-1/2 text-left opacity-0 animate-fade-in-left">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              <span className="block">Weniger Papierkram.</span>
              <span className="block text-[#ffcb00]">Mehr Zeit fürs Handwerk.</span>
            </h1>
            <p className="text-lg text-white/90 mb-8 max-w-xl">
              ZIMMR ist dein digitaler Assistent für den Handwerksalltag. Erledigt Termine, 
              Rechnungen & Kommunikation – automatisch im Hintergrund.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6 opacity-0 animate-fade-in-up animate-delay-300">
              <Link 
                href="/auth/login" 
                className="px-8 py-3 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5 text-center"
              >
                Jetzt starten
              </Link>
              <Link 
                href="/auth/register" 
                className="px-8 py-3 border border-[#ffcb00]/50 hover:border-[#ffcb00] hover:bg-[#ffcb00]/10 text-white font-medium rounded-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5 text-center"
              >
                Konto erstellen
              </Link>
            </div>
          </div>
          
          {/* Right side - Logo */}
          <div className="w-full md:w-1/2 flex justify-center md:justify-end relative">
            <div className="absolute inset-0 opacity-0 animate-fade-in-right animate-delay-100 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 animate-shimmer animate-delay-500"></div>
            </div>
            <img 
              src="/images/Wordmark transparent.png" 
              alt="ZIMMR Logo" 
              className="w-full max-w-md h-auto opacity-0 animate-fade-in-right animate-delay-200 relative z-10"
              width="500"
              height="300"
              loading="eager"
            />
          </div>
        </div>
        
        {/* Trusted by row */}
        <div className="mt-8 mb-12 flex flex-col items-center">
          <span className="uppercase text-xs tracking-widest text-[#ffcb00]/80 mb-2">Vertraut von modernen Handwerkern</span>
          <div className="flex flex-wrap gap-6 justify-center opacity-90">
            <span className="text-white/80 font-semibold">Meisterbetrieb Müller</span>
            <span className="text-white/80 font-semibold">Elektro Schmidt</span>
            <span className="text-white/80 font-semibold">Sanitär König</span>
            <span className="text-white/80 font-semibold">Fliesenprofi</span>
          </div>
        </div>
        
        {/* Features Section */}
        <div className="w-full text-center mb-12 mt-8">
          <h2 className="text-3xl font-bold mb-4 text-[#ffcb00]">Funktionen</h2>
          <div className="w-24 h-1 bg-[#ffcb00]/30 mx-auto"></div>
        </div>
        <section className="w-full max-w-5xl mx-auto grid md:grid-cols-3 gap-6 mb-16 px-2">
          <div className="bg-[#1a1a1a]/80 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center text-center shadow-lg border border-[#2a2a2a]">
            <div className="bg-[#ffcb00]/20 p-3 rounded-full mb-4">
              <svg className="w-8 h-8 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <h3 className="font-bold text-lg mb-2">Einfache Terminplanung</h3>
            <p className="text-white/90">Buche, verwalte und verfolge Termine mit wenigen Klicks – ohne Papierkram.</p>
          </div>
          <div className="bg-[#1a1a1a]/80 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center text-center shadow-lg border border-[#2a2a2a]">
            <div className="bg-[#ffcb00]/20 p-3 rounded-full mb-4">
              <svg className="w-8 h-8 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 4v4m0 4h.01"></path></svg>
            </div>
            <h3 className="font-bold text-lg mb-2">Automatische Erinnerungen</h3>
            <p className="text-white/90">Reduziere Terminausfälle mit automatischen SMS/E-Mail-Erinnerungen für deine Kunden.</p>
          </div>
          <div className="bg-[#1a1a1a]/80 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center text-center shadow-lg border border-[#2a2a2a]">
            <div className="bg-[#ffcb00]/20 p-3 rounded-full mb-4">
              <svg className="w-8 h-8 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2z"></path></svg>
            </div>
            <h3 className="font-bold text-lg mb-2">All-in-One Dashboard</h3>
            <p className="text-white/90">Überblicke Kunden, Termine und Aufgaben auf einen Blick – optimiert für Mobilgeräte und Desktop.</p>
          </div>
        </section>
        
        <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="flex items-center justify-center">
            <img 
              src="/images/tile-cutting.jpg" 
              alt="Fliesen schneiden mit Winkelschleifer" 
              className="rounded-xl shadow-lg w-full max-w-xs sm:max-w-sm md:max-w-full h-auto object-cover aspect-video"
              width="480"
              height="270"
              loading="lazy"
              decoding="async"
              srcSet="/images/tile-cutting.jpg 480w, /images/tile-cutting.jpg 800w"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
            />
          </div>
          <div className="flex items-center justify-center">
            <img 
              src="/images/tilemeasuring.jpg" 
              alt="Handwerker vermisst Fliesen für die Installation" 
              className="rounded-xl shadow-lg w-full max-w-xs sm:max-w-sm md:max-w-full h-auto object-cover aspect-video"
              width="480"
              height="270"
              loading="lazy"
              decoding="async"
              srcSet="/images/tilemeasuring.jpg 480w, /images/tilemeasuring.jpg 800w"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}