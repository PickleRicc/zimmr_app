'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { useRequireAuth } from '../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';

// Accent color consistent with Profile page and rest of app
const ACCENT = "#ffcb00";

export default function TimeTrackingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const authedFetch = useAuthedFetch();

  // State for entries and UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeEntries, setTimeEntries] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);

  // Form state for new time entry
  const [newEntry, setNewEntry] = useState({
    description: '',
    start_time: formatDateForInput(new Date()),
    end_time: '',
    duration_minutes: '',
    is_billable: true,
    hourly_rate: '',
    customer_id: '',
    appointment_id: '',
    notes: ''
  });

  // Active timer state (if needed)
  const [activeTimer, setActiveTimer] = useState(null);

  // Load time entries when auth is ready
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    
    fetchTimeEntries();
    fetchCustomers();
    fetchAppointments();
  }, [user, authLoading]);

  // Helper to format date for input fields
  function formatDateForInput(date) {
    return date.toISOString().slice(0, 16); // YYYY-MM-DDThh:mm format
  }

  // Format duration in minutes to hours and minutes
  function formatDuration(minutes) {
    if (!minutes && minutes !== 0) return '--';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    return `${hours}h ${mins}m`;
  }

  // Format date for display
  function formatDate(dateString) {
    if (!dateString) return '--';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Format time for display
  function formatTime(dateString) {
    if (!dateString) return '--';
    
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Fetch all time entries
  async function fetchTimeEntries() {
    try {
      setLoading(true);
      const res = await authedFetch('/api/time-entries');
      
      if (!res.ok) {
        throw new Error('Failed to fetch time entries');
      }
      
      const data = await res.json();
      setTimeEntries(data);
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError('Failed to load time entries. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Fetch customers for the dropdown
  async function fetchCustomers() {
    try {
      const res = await authedFetch('/api/customers');
      
      if (!res.ok) {
        console.error('Failed to fetch customers');
        return;
      }
      
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }
  
  // Fetch appointments for the dropdown
  async function fetchAppointments() {
    try {
      const res = await authedFetch('/api/appointments');
      
      if (!res.ok) {
        console.error('Failed to fetch appointments');
        return;
      }
      
      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    }
  }

  // Handle form input changes
  function handleInputChange(e) {
    const { name, value, type, checked } = e.target;
    
    // Special handling for appointment selection
    if (name === 'appointment_id' && value) {
      const selectedAppointment = appointments.find(apt => apt.id.toString() === value.toString());
      
      if (selectedAppointment) {
        // Autopopulate relevant fields from appointment
        setNewEntry(prev => ({
          ...prev,
          [name]: value,
          // If appointment has a customer, use it
          customer_id: selectedAppointment.customer_id || prev.customer_id,
          // Use appointment start time if available
          start_time: selectedAppointment.scheduled_at ? 
            formatDateForInput(new Date(selectedAppointment.scheduled_at)) : 
            prev.start_time,
          // Use appointment description/title if empty
          description: prev.description || selectedAppointment.title || '',
          // If appointment has notes, use them
          notes: prev.notes || selectedAppointment.notes || ''
        }));
        return;
      }
    }
    
    // Default behavior for other fields
    setNewEntry(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  // Auto-calculate duration when start and end times change
  useEffect(() => {
    if (newEntry.start_time && newEntry.end_time) {
      const start = new Date(newEntry.start_time);
      const end = new Date(newEntry.end_time);
      
      // Only calculate if end is after start
      if (end > start) {
        const diffMs = end - start;
        const diffMinutes = Math.round(diffMs / 60000);
        setNewEntry(prev => ({ ...prev, duration_minutes: diffMinutes }));
      }
    }
  }, [newEntry.start_time, newEntry.end_time]);

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    
    // Create payload (deep copy to avoid modifying state)
    const payload = { ...newEntry };
    
    // Handle empty strings and convert to null for integer fields
    if (!payload.hourly_rate || payload.hourly_rate === '') {
      delete payload.hourly_rate; // Delete to use DB default
    }
    
    // These should be null not undefined/empty string for integer fields
    payload.customer_id = payload.customer_id || null;
    payload.appointment_id = payload.appointment_id || null;
    
    // Handle integer fields
    if (payload.customer_id === '') payload.customer_id = null;
    if (payload.appointment_id === '') payload.appointment_id = null;
    if (payload.duration_minutes === '') payload.duration_minutes = null;
    
    // Handle timestamp fields
    if (payload.end_time === '') payload.end_time = null;
    
    try {
      setSaving(true);
      
      const res = await authedFetch('/api/time-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to save time entry');
      }
      
      // Get the new entry from response
      const savedEntry = await res.json();
      
      // Update state with optimistic update
      setTimeEntries(prev => [savedEntry, ...prev]);
      setSuccess('Time entry saved!');
      
      // Close modal and reset form
      setShowAddModal(false);
      setNewEntry({
        description: '',
        start_time: formatDateForInput(new Date()),
        end_time: '',
        duration_minutes: '',
        is_billable: true,
        hourly_rate: '',
        customer_id: '',
        appointment_id: '',
        notes: ''
      });
      
      // Clear success message after a delay
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('Error saving time entry:', err);
      setError(err.message || 'Failed to save time entry');
      
      // Clear error after delay
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
        <span className="text-white">Loading…</span>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Time Tracking</h1>
            <button 
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[#ffcb00] text-black font-medium rounded-lg hover:bg-[#e3b700] transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              New Entry
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-3 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg">
              {success}
            </div>
          )}

          {/* Time Entries Table */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {timeEntries.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-white/70">No time entries yet. Click "New Entry" to add one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/10">
                      <th className="p-4 text-white/80 font-medium">Date</th>
                      <th className="p-4 text-white/80 font-medium">Time / Duration</th>
                      <th className="p-4 text-white/80 font-medium">Description</th>
                      <th className="p-4 text-white/80 font-medium">Status</th>
                      <th className="p-4 text-white/80 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {timeEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-white/5">
                        <td className="p-4 text-white">{formatDate(entry.start_time)}</td>
                        <td className="p-4 text-white">
                          {formatTime(entry.start_time)} 
                          {entry.end_time ? ` - ${formatTime(entry.end_time)}` : ' (active)'}
                          <div className="text-white/60 text-sm">
                            {entry.duration_minutes ? formatDuration(entry.duration_minutes) : '--'}
                          </div>
                        </td>
                        <td className="p-4 text-white">
                          {entry.description || '(No description)'}
                          {entry.notes && (
                            <div className="text-white/60 text-sm mt-1">
                              {entry.notes}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {entry.is_billable ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                              Billable
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                              Non-billable
                            </span>
                          )}
                          {entry.customer_id && (
                            <div className="text-white/60 text-xs mt-1">
                              Customer ID: {entry.customer_id}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-white">
                          {entry.hourly_rate ? `€${entry.hourly_rate}/h` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add New Time Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
          <div className="bg-[#121212] border border-white/10 rounded-xl p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">New Time Entry</h2>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-white/70 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={newEntry.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                  placeholder="What did you work on?"
                />
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    name="start_time"
                    value={newEntry.start_time}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    name="end_time"
                    value={newEntry.end_time}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                  />
                </div>
              </div>

              {/* Duration (auto-calculated, but can be overridden) */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  name="duration_minutes"
                  value={newEntry.duration_minutes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                  placeholder="Auto-calculated from time range"
                />
                <p className="text-white/60 text-xs mt-1">
                  {newEntry.duration_minutes && formatDuration(newEntry.duration_minutes)}
                </p>
              </div>

              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Customer (Optional)
                </label>
                <select
                  name="customer_id"
                  value={newEntry.customer_id || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                >
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name || customer.company_name} {customer.company_name && customer.name ? `(${customer.company_name})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-white/60 text-xs mt-1">
                  Selecting a customer will make this entry billable
                </p>
              </div>
              
              {/* Appointment Selection */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Appointment (Optional)
                </label>
                <select
                  name="appointment_id"
                  value={newEntry.appointment_id || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                >
                  <option value="">Select an appointment</option>
                  {appointments.map(appointment => (
                    <option key={appointment.id} value={appointment.id}>
                      {formatDate(appointment.scheduled_at)} - {appointment.title || 'Untitled'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Billable Toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_billable"
                  name="is_billable"
                  checked={newEntry.is_billable || !!newEntry.customer_id}
                  onChange={handleInputChange}
                  disabled={!!newEntry.customer_id}
                  className="rounded border-white/20 text-[#ffcb00] focus:ring-[#ffcb00]"
                />
                <label htmlFor="is_billable" className="text-white/80 text-sm">
                  Billable
                  {newEntry.customer_id && (
                    <span className="ml-2 text-xs text-white/60">
                      (Auto-enabled for customer entries)
                    </span>
                  )}
                </label>
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Hourly Rate (Optional)
                </label>
                <input
                  type="number"
                  name="hourly_rate"
                  value={newEntry.hourly_rate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                  placeholder="€ per hour"
                  step="0.01"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={newEntry.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00] min-h-[80px]"
                  placeholder="Any additional details..."
                ></textarea>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving || !newEntry.description || !newEntry.start_time}
                  className="w-full py-2 px-4 bg-[#ffcb00] text-black font-medium rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Time Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
