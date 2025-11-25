"use client";
import React, { useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

/**
 * @param {Object} props
 * @param {Array} props.appointments
 * @param {Array} props.customers
 * @param {Function} props.onDateClick - Callback when a date is clicked for creating new appointment
 */
export default function CalendarView({ appointments, customers, onDateClick }) {
  // Helper: get YYYY-MM-DD from date string
  function getDateKey(dateString) {
    return dateString.split('T')[0];
  }

  // Map appointments to calendar events (store both Date and string)
  const events = appointments.map((appt) => ({
    id: appt.id,
    title: appt.title || appt.subject || "Appointment",
    dateKey: appt.scheduled_at.split('T')[0],
    timeStr: appt.scheduled_at.split('T')[1]?.slice(0, 5),
    start: new Date(appt.scheduled_at),
    end: new Date(appt.scheduled_at),
    resource: appt,
    raw: appt.scheduled_at,
  }));

  const [view, setView] = useState("month");
  const [date, setDate] = useState(new Date());

  // Month dropdown helper
  const months = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 3; y++) years.push(y);

  // Custom navigation handler
  const handleNavigate = (action) => {
    const current = new Date(date);
    if (action === "TODAY") {
      setDate(new Date());
    } else if (action === "PREV") {
      if (view === "month") current.setMonth(current.getMonth() - 1);
      if (view === "week") current.setDate(current.getDate() - 7);
      if (view === "day") current.setDate(current.getDate() - 1);
      setDate(current);
    } else if (action === "NEXT") {
      if (view === "month") current.setMonth(current.getMonth() + 1);
      if (view === "week") current.setDate(current.getDate() + 7);
      if (view === "day") current.setDate(current.getDate() + 1);
      setDate(current);
    }
  };

  // Custom toolbar
  function Toolbar() {
    return (
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-2">
        {/* Navigation */}
        <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/5">
          <button
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            onClick={() => handleNavigate('PREV')}
            aria-label="Previous"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            className="px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 rounded-md transition-colors"
            onClick={() => handleNavigate('TODAY')}
          >
            Heute
          </button>
          <button
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            onClick={() => handleNavigate('NEXT')}
            aria-label="Next"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Date Selectors */}
        <div className="flex gap-3 items-center">
          <div className="relative">
            <select
              value={date.getMonth()}
              onChange={e => {
                const newDate = new Date(date);
                newDate.setMonth(Number(e.target.value));
                setDate(newDate);
              }}
              className="appearance-none bg-[#121212] text-white pl-4 pr-10 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[#ffcb00] focus:ring-1 focus:ring-[#ffcb00] font-medium text-sm cursor-pointer hover:border-white/30 transition-colors"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <select
              value={date.getFullYear()}
              onChange={e => {
                const newDate = new Date(date);
                newDate.setFullYear(Number(e.target.value));
                setDate(newDate);
              }}
              className="appearance-none bg-[#121212] text-white pl-4 pr-10 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-[#ffcb00] focus:ring-1 focus:ring-[#ffcb00] font-medium text-sm cursor-pointer hover:border-white/30 transition-colors"
            >
              {years.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex bg-white/5 rounded-lg p-1 border border-white/5">
          {['month', 'week', 'day'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === v
                  ? 'bg-[#ffcb00] text-black shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
            >
              {v === 'month' ? 'Monat' : v === 'week' ? 'Woche' : 'Tag'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Helper: status color for dot
  function getDotColor(status) {
    if (status === 'approved') return 'bg-green-500';
    if (status === 'rejected') return 'bg-red-500';
    if (status === 'pending') return 'bg-yellow-500';
    return 'bg-[#ffcb00]';
  }

  // Custom month cell renderer: show dots for each appointment (match by YYYY-MM-DD)
  function CustomMonthDateCell({ date, events }) {
    const cellDateKey = date.toISOString().split('T')[0];
    const todaysEvents = events.filter(ev => ev.dateKey === cellDateKey);
    const todayKey = new Date().toISOString().split('T')[0];
    const isToday = cellDateKey === todayKey;

    return (
      <div
        className={`flex flex-col items-center justify-start h-full w-full transition-all duration-200 group
          ${isToday ? 'bg-[#ffcb00]/5' : 'hover:bg-white/5'}
        `}
      >
        <span className={`
          text-xs mt-2 mb-1 w-7 h-7 flex items-center justify-center rounded-full transition-all
          ${isToday
            ? 'bg-[#ffcb00] text-black font-bold shadow-[0_0_10px_rgba(255,203,0,0.4)]'
            : 'text-white/50 group-hover:text-white group-hover:bg-white/10'}
        `}>
          {date.getDate()}
        </span>

        <div className="flex flex-wrap gap-1.5 justify-center px-1 w-full mt-1">
          {todaysEvents.slice(0, 4).map(ev => (
            <div
              key={ev.id}
              className={`w-2 h-2 rounded-full ${getDotColor(ev.resource.approval_status)} shadow-sm ring-1 ring-black/50`}
              title={ev.title}
            />
          ))}
          {todaysEvents.length > 4 && (
            <span className="text-[10px] text-[#ffcb00] font-bold leading-none flex items-center justify-center h-2">
              +
            </span>
          )}
        </div>
      </div>
    );
  }

  // Popup for day details (show time as string)
  const [popupInfo, setPopupInfo] = useState({ show: false, date: null, events: [], canCreateNew: false });
  function handleDateClick(slotInfo) {
    const slotDateKey = slotInfo.start.toISOString().split('T')[0];
    const todaysEvents = events.filter(ev => ev.dateKey === slotDateKey);

    // Always show popup - either with existing events or option to create new
    setPopupInfo({
      show: true,
      date: slotInfo.start,
      events: todaysEvents,
      canCreateNew: true
    });
  }
  function closePopup() {
    setPopupInfo({ show: false, date: null, events: [] });
  }

  return (
    <div className="bg-[#1b1b1b] rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[600px]">
      {/* Custom Styles for React Big Calendar */}
      <style jsx global>{`
        .rbc-calendar { font-family: inherit; color: rgba(255,255,255,0.8); }
        .rbc-header { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 12px 0; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: rgba(255,255,255,0.5); }
        .rbc-month-view { border: none; }
        .rbc-month-row { border-bottom: 1px solid rgba(255,255,255,0.05); min-height: 100px; }
        .rbc-day-bg { border-left: 1px solid rgba(255,255,255,0.05); }
        .rbc-off-range-bg { background: rgba(255,255,255,0.02); }
        .rbc-today { background: rgba(255, 203, 0, 0.05); }
        .rbc-date-cell { padding: 8px; font-size: 0.875rem; font-weight: 500; text-align: center; }
        .rbc-event { background: #ffcb00; color: black; border-radius: 4px; border: none; padding: 2px 6px; font-size: 0.75rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .rbc-event.rbc-selected { background: #e6b800; }
        .rbc-time-view { border: none; }
        .rbc-time-header { border-bottom: 1px solid rgba(255,255,255,0.1); }
        .rbc-time-content { border-top: 1px solid rgba(255,255,255,0.1); }
        .rbc-timeslot-group { border-bottom: 1px solid rgba(255,255,255,0.05); }
        .rbc-day-slot { border-left: 1px solid rgba(255,255,255,0.05); }
        .rbc-current-time-indicator { background-color: #ffcb00; height: 2px; }
        .rbc-label { color: rgba(255,255,255,0.5); font-size: 0.75rem; }
      `}</style>

      <div className="p-4 border-b border-white/10 bg-[#1b1b1b]">
        <Toolbar />
      </div>

      <div className="flex-1 p-4 bg-[#121212]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          popup
          views={["month", "week", "day"]}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          components={{
            toolbar: () => null,
            month: {
              dateHeader: (props) => (
                <div onClick={() => handleDateClick({ start: props.date })} className="cursor-pointer h-full w-full">
                  <CustomMonthDateCell date={props.date} events={events} />
                </div>
              ),
            },
          }}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: event.resource.approval_status === 'approved' ? '#10b981' : // green-500
                event.resource.approval_status === 'pending' ? '#f59e0b' : // amber-500
                  event.resource.approval_status === 'rejected' ? '#ef4444' : '#ffcb00', // red-500
              color: event.resource.approval_status === 'pending' ? 'black' : 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: '600',
              display: view === 'month' ? 'none' : 'block',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            },
          })}
          messages={{
            month: "Monat",
            week: "Woche",
            day: "Tag",
            today: "Heute",
            previous: "Zurück",
            next: "Weiter",
            showMore: (total) => `+${total} weitere`,
            noEventsInRange: "Keine Termine in diesem Zeitraum",
          }}
        />
      </div>

      {/* Day popup */}
      {popupInfo.show && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1b1b1b] rounded-2xl shadow-2xl w-full max-w-md border border-white/10 overflow-hidden transform transition-all scale-100">
            <div className="flex justify-between items-center p-5 border-b border-white/10 bg-white/5">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {popupInfo.date && format(popupInfo.date, 'd. MMMM yyyy', { locale: enUS })}
                </h3>
                <p className="text-sm text-white/50 mt-1">
                  {popupInfo.events.length} {popupInfo.events.length === 1 ? 'Termin' : 'Termine'}
                </p>
              </div>
              <button
                onClick={closePopup}
                className="text-white/50 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
              {popupInfo.events.map(ev => (
                <div key={ev.id} className="bg-[#121212] rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-colors group">
                  <div className="flex items-center gap-3 px-4 py-3 bg-white/5 group-hover:bg-white/10 transition-colors">
                    <span className={`w-3 h-3 rounded-full ${getDotColor(ev.resource.approval_status)} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
                    <span className="text-white font-semibold truncate flex-1">{ev.title}</span>
                    <span className="text-xs text-white/60 font-mono bg-black/30 px-2 py-1 rounded">
                      {ev.timeStr || 'Ganztägig'}
                    </span>
                  </div>

                  <div className="px-4 py-3 space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-white/40">Status</span>
                      <span className={`
                        px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider
                        ${ev.resource.approval_status === 'approved' ? 'bg-green-500/10 text-green-400' :
                          ev.resource.approval_status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                            ev.resource.approval_status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-white/10 text-white'}
                      `}>
                        {ev.resource.approval_status === 'approved' ? 'Genehmigt' :
                          ev.resource.approval_status === 'pending' ? 'Ausstehend' :
                            ev.resource.approval_status === 'rejected' ? 'Abgelehnt' : 'Unbekannt'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-white/40">Kunde</span>
                      <span className="text-white/90">{ev.resource.customer_name || '—'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-white/40">Ort</span>
                      <span className="text-white/90 truncate max-w-[180px]">{ev.resource.location || '—'}</span>
                    </div>

                    <div className="pt-3 mt-2">
                      <a
                        href={`/appointments/${ev.id}`}
                        className="flex items-center justify-center w-full text-black bg-[#ffcb00] hover:bg-[#e6b800] py-2 rounded-lg font-semibold transition-all text-xs uppercase tracking-wide shadow-lg hover:shadow-[#ffcb00]/20"
                      >
                        Details anzeigen
                      </a>
                    </div>
                  </div>
                </div>
              ))}

              {popupInfo.events.length === 0 && (
                <div className="text-center py-8 flex flex-col items-center justify-center text-white/30">
                  <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>Keine Termine für diesen Tag</p>
                </div>
              )}

              {/* Create New Appointment Button */}
              {popupInfo.canCreateNew && onDateClick && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      const dateStr = popupInfo.date.toISOString().split('T')[0];
                      onDateClick(dateStr);
                      closePopup();
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/30 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 group"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#ffcb00] text-black flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    Neuen Termin erstellen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
