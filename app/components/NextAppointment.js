'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NextAppointment({ appointment }) {
  // If no appointment is provided, return nothing
  if (!appointment) return null;
  
  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Format time for display
  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

  // Get formatted date and time
  const formattedDate = formatDate(appointment.scheduled_at);
  const formattedTime = formatTime(appointment.scheduled_at);
  
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 md:p-7 border border-white/10 shadow-lg mb-8 max-w-xl w-full mx-auto animate-fade-in">
      <div className="flex items-center mb-4 gap-3">
        <div className="p-2.5 bg-[#ffcb00]/20 rounded-full">
          <svg className="w-5 h-5 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h2 className="text-lg md:text-xl font-semibold text-white">Nächster Termin</h2>
      </div>
      <div className="bg-white/10 rounded-xl p-4 mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-lg md:text-2xl font-bold text-white mb-1">{appointment.title || appointment.subject || "Termin"}</div>
          <div className="text-[#ffcb00] font-medium text-base md:text-lg">{formattedDate}</div>
        </div>
        <div className="flex items-center">
          <div className="bg-white/10 text-white px-4 py-2 rounded-lg font-mono text-base md:text-lg shadow-sm">
            {formattedTime} Uhr
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex items-start">
          <div className="p-2 bg-white/10 rounded-full mr-3 mt-0.5">
            <svg className="w-5 h-5 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <div>
            <div className="text-[#ffcb00] text-xs mb-1">Ort</div>
            <div className="text-white text-sm md:text-base">{appointment.location || "Nicht angegeben"}</div>
          </div>
        </div>
        <div className="flex items-start">
          <div className="p-2 bg-white/10 rounded-full mr-3 mt-0.5">
            <svg className="w-5 h-5 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          </div>
          <div>
            <div className="text-[#ffcb00] text-xs mb-1">Kunde</div>
            <div className="text-white text-sm md:text-base">{appointment.customer_name || "Nicht angegeben"}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium w-fit md:w-auto text-center
          ${appointment.approval_status === 'approved' ? 'bg-green-500/20 text-green-400' :
            appointment.approval_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
            appointment.approval_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
            'bg-[#ffcb00]/20 text-[#ffcb00]'}
        `}>
          {appointment.approval_status === 'approved' ? 'Genehmigt' :
            appointment.approval_status === 'pending' ? 'Ausstehend' :
            appointment.approval_status === 'rejected' ? 'Abgelehnt' :
            'Offen'}
        </div>
        <Link
          href={`/appointments/${appointment.id}`}
          className="text-black hover:text-black bg-[#ffcb00] hover:bg-[#e6b800] px-4 py-2 rounded-lg transition-colors text-sm font-semibold text-center w-full md:w-auto"
        >
          Details anzeigen
        </Link>
      </div>
    </div>
  );
}
