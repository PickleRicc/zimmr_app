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
 */
export default function CalendarView({ appointments }) {
  // Helper: get YYYY-MM-DD from date string
  function getDateKey(dateString) {
    return dateString.split('T')[0];
  }

  // Map appointments to calendar events (store both Date and string)
  const events = appointments.map((appt) => ({
    id: appt.id,
    title: appt.title || appt.subject || "Appointment",
    dateKey: appt.scheduled_at.split('T')[0],
    timeStr: appt.scheduled_at.split('T')[1]?.slice(0,5),
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
      <div className="flex flex-col gap-2 mb-4 px-1">
        {/* Month/Year Dropdown Row */}
        <div className="flex gap-2 items-center justify-center w-full">
          <select
            value={date.getMonth()}
            onChange={e => {
              const newDate = new Date(date);
              newDate.setMonth(Number(e.target.value));
              setDate(newDate);
            }}
            className="rounded-lg bg-white/5 text-white px-3 py-2 font-medium shadow focus:outline-none focus:ring-1 focus:ring-[#ffcb00] text-sm"
          >
            {months.map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>
          <select
            value={date.getFullYear()}
            onChange={e => {
              const newDate = new Date(date);
              newDate.setFullYear(Number(e.target.value));
              setDate(newDate);
            }}
            className="rounded-lg bg-white/5 text-white px-3 py-2 font-medium shadow focus:outline-none focus:ring-1 focus:ring-[#ffcb00] text-sm"
          >
            {years.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
        {/* Navigation/Views Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
          <div className="flex gap-2 mb-2 sm:mb-0 items-center">
            <button
              className="rounded-full bg-white/5 text-[#ffcb00] hover:bg-white/10 px-3 py-1 font-bold shadow h-8 w-8 flex items-center justify-center"
              onClick={() => handleNavigate('PREV')}
              aria-label="Previous"
            >
              ←
            </button>
            <button
              className="rounded-full bg-white/5 text-[#ffcb00] hover:bg-white/10 px-3 py-1 font-bold shadow h-8 w-8 flex items-center justify-center"
              onClick={() => handleNavigate('TODAY')}
              aria-label="Today"
            >
              •
            </button>
            <button
              className="rounded-full bg-white/5 text-[#ffcb00] hover:bg-white/10 px-3 py-1 font-bold shadow h-8 w-8 flex items-center justify-center"
              onClick={() => handleNavigate('NEXT')}
              aria-label="Next"
            >
              →
            </button>
          </div>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                view === 'month' 
                  ? 'bg-[#ffcb00] text-black shadow' 
                  : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Monat
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                view === 'week' 
                  ? 'bg-[#ffcb00] text-black shadow' 
                  : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Woche
            </button>
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                view === 'day' 
                  ? 'bg-[#ffcb00] text-black shadow' 
                  : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Tag
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper: status color for dot
  function getDotColor(status) {
    if (status === 'approved') return 'bg-green-400';
    if (status === 'rejected') return 'bg-red-400';
    if (status === 'pending') return 'bg-yellow-400';
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
        className={`flex flex-col items-center justify-center min-h-[48px] transition-all duration-150 rounded-lg cursor-pointer 
          ${isToday ? 'bg-[#ffcb00]/15' : 'hover:bg-[#223a5e]/60'}
        `}
        style={{ boxSizing: 'border-box', minHeight: 48, background: isToday ? null : 'none' }}
      >
        <span className={`text-xs ${isToday ? 'text-[#ffcb00] font-bold' : 'text-blue-100'} mb-1 drop-shadow`}>
          {date.getDate()}
        </span>
        <div className="flex flex-wrap gap-1 justify-center">
          {todaysEvents.slice(0, 3).map(ev => (
            <span
              key={ev.id}
              className={`w-2.5 h-2.5 rounded-full ${getDotColor(ev.resource.approval_status)} border border-white/30 shadow-sm`}
              title={ev.title}
            />
          ))}
          {todaysEvents.length > 3 && (
            <span className="text-xs text-[#ffcb00] font-semibold ml-1">+{todaysEvents.length - 3}</span>
          )}
        </div>
      </div>
    );
  }

  // Popup for day details (show time as string)
  const [popupInfo, setPopupInfo] = useState({ show: false, date: null, events: [] });
  function handleDateClick(slotInfo) {
    const slotDateKey = slotInfo.start.toISOString().split('T')[0];
    const todaysEvents = events.filter(ev => ev.dateKey === slotDateKey);
    if (todaysEvents.length > 0) {
      setPopupInfo({ show: true, date: slotInfo.start, events: todaysEvents });
    }
  }
  function closePopup() {
    setPopupInfo({ show: false, date: null, events: [] });
  }

  return (
    <div
      className="bg-[#0a1929] p-2 sm:p-4 rounded-2xl border border-[#223a5e] shadow-xl"
      style={{ minHeight: 400, overflow: 'hidden' }}
    >
      <Toolbar />
      <div className="w-full overflow-x-auto md:overflow-visible">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 450, minWidth: 320, background: "transparent" }}
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
                <div onClick={() => handleDateClick({ start: props.date })} className="cursor-pointer">
                  <CustomMonthDateCell date={props.date} events={events} />
                </div>
              ),
            },
          }}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: event.resource.approval_status === 'approved' ? '#4caf50' : 
                              event.resource.approval_status === 'pending' ? '#ff9800' : 
                              event.resource.approval_status === 'rejected' ? '#f44336' : '#ffcb00',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '14px',
              display: view === 'month' ? 'none' : undefined,
            },
          })}
          messages={{
            month: "Monat",
            week: "Woche",
            day: "Tag",
            today: "Heute",
            previous: "Zurück",
            next: "Weiter",
            showMore: (total) => `+${total} mehr`,
          }}
        />
        {/* Day popup */}
        {popupInfo.show && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-[#121212] rounded-xl shadow-xl p-5 w-full max-w-sm mx-auto border border-white/10">
              <div className="flex justify-between items-center mb-3">
                <span className="text-lg font-bold text-white">{popupInfo.date && popupInfo.date.toLocaleDateString()}</span>
                <button 
                  onClick={closePopup} 
                  className="text-[#ffcb00] hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                >
                  ×
                </button>
              </div>
              <div className="space-y-3">
                {popupInfo.events.map(ev => (
                  <div key={ev.id} className="bg-[#0a1929]/80 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-[#0a1929]">
                      <span className={`w-3 h-3 rounded-full ${getDotColor(ev.resource.approval_status)} border border-white/30 shadow-sm`} />
                      <span className="text-white text-sm font-medium">{ev.title}</span>
                      <span className="text-xs text-blue-200 ml-auto font-mono">{ev.timeStr || '-'}</span>
                    </div>
                    <div className="px-3 py-2 bg-[#0a1929]/50 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-blue-300">Status:</span>
                        <span className={`
                          ${ev.resource.approval_status === 'approved' ? 'text-green-400' : 
                            ev.resource.approval_status === 'pending' ? 'text-yellow-400' : 
                            ev.resource.approval_status === 'rejected' ? 'text-red-400' : 'text-[#ffcb00]'}
                          font-medium
                        `}>
                          {ev.resource.approval_status === 'approved' ? 'Genehmigt' : 
                           ev.resource.approval_status === 'pending' ? 'Ausstehend' : 
                           ev.resource.approval_status === 'rejected' ? 'Abgelehnt' : 'Unbekannt'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-300">Kunde:</span>
                        <span className="text-white">{ev.resource.customer_name || 'Nicht angegeben'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-300">Ort:</span>
                        <span className="text-white">{ev.resource.location || 'Nicht angegeben'}</span>
                      </div>
                      <div className="mt-2 pt-1 border-t border-white/10">
                        <a 
                          href={`/appointments/${ev.id}`} 
                          className="block w-full text-center text-black bg-[#ffcb00] hover:bg-[#e6b800] py-1.5 rounded transition-colors"
                        >
                          Details anzeigen
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
                {popupInfo.events.length === 0 && (
                  <div className="text-center py-3 text-blue-200">Keine Termine für diesen Tag</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
