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
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'daily'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyEntries, setDailyEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);

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

  // Local timer state - no API calls for start/pause/resume
  const [localTimer, setLocalTimer] = useState(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseBreaks, setPauseBreaks] = useState([]);
  const [timerCustomerId, setTimerCustomerId] = useState('');
  const [timerAppointmentId, setTimerAppointmentId] = useState('');
  const [timerIsBillable, setTimerIsBillable] = useState(false);
  const [timerHourlyRate, setTimerHourlyRate] = useState('');

  // Load time entries when auth is ready
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    
    fetchTimeEntries();
    fetchCustomers();
    fetchAppointments();
    checkActiveTimer();
  }, [user, authLoading]);

  // Load daily entries when date changes
  useEffect(() => {
    if (viewMode === 'daily' && selectedDate) {
      fetchDailyEntries();
    }
  }, [viewMode, selectedDate]);

  // Local timer effect - counts elapsed time locally
  useEffect(() => {
    if (localTimer && !isPaused) {
      const interval = setInterval(() => {
        const now = new Date();
        const startTime = new Date(localTimer.start_time);
        
        // Calculate total elapsed time minus break time
        let totalElapsed = Math.floor((now - startTime) / 1000);
        
        // Subtract completed break durations
        const totalBreakTime = pauseBreaks.reduce((total, breakPeriod) => {
          if (breakPeriod.end_time) {
            return total + Math.floor((new Date(breakPeriod.end_time) - new Date(breakPeriod.start_time)) / 1000);
          }
          return total;
        }, 0);
        
        setTimerElapsed(Math.max(0, totalElapsed - totalBreakTime));
      }, 1000);
      
      setTimerInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
    }
  }, [localTimer, isPaused, pauseBreaks]);

  // Load timer breaks for recovery
  async function loadTimerBreaks(timerId) {
    try {
      const res = await authedFetch(`/api/time-tracking/breaks?time_tracking_id=${timerId}`);
      if (res.ok) {
        const responseData = await res.json();
        const breaks = responseData.data || [];
        setPauseBreaks(breaks);
      }
    } catch (err) {
      console.error('Error loading timer breaks:', err);
    }
  }

  // Check for existing active timer on load (for recovery only)
  async function checkActiveTimer() {
    try {
      const res = await authedFetch('/api/time-tracking?status=active');
      if (res.ok) {
        const responseData = await res.json();
        const data = responseData.data !== undefined ? responseData.data : responseData;
        const activeEntry = Array.isArray(data) ? data.find(entry => entry.status === 'active') : null;
        
        if (activeEntry) {
          // Restore local timer state from database
          setLocalTimer(activeEntry);
          const now = new Date();
          const startTime = new Date(activeEntry.start_time);
          const elapsed = Math.floor((now - startTime) / 1000);
          setTimerElapsed(elapsed);
          
          // Load any existing breaks for this session
          loadTimerBreaks(activeEntry.id);
        }
      }
    } catch (err) {
      console.error('Error checking active timer:', err);
    }
  }

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

  // Calculate total amount from duration and hourly rate
  function calculateAmount(durationMinutes, hourlyRate) {
    if (!durationMinutes || !hourlyRate) return 0;
    const hours = durationMinutes / 60;
    return (hours * hourlyRate).toFixed(2);
  }

  // Create invoice from time entry
  function createInvoiceFromEntry(entry) {
    const hourlyRate = entry.hourly_rate || 65; // Default rate if none set
    const amount = calculateAmount(entry.duration_minutes, hourlyRate);
    const invoiceData = {
      customer_id: entry.customer_id,
      appointment_id: entry.appointment_id,
      line_items: [{
        description: entry.description || 'Time tracking work',
        quantity: (entry.duration_minutes / 60).toFixed(2),
        unit: 'hours',
        unit_price: hourlyRate,
        total: parseFloat(amount)
      }],
      net_amount: parseFloat(amount),
      time_entry_id: entry.id
    };
    
    // Navigate to invoice creation with prefilled data
    const params = new URLSearchParams({
      prefill: JSON.stringify(invoiceData)
    });
    router.push(`/invoices/new?${params.toString()}`);
  }

  // Create quote from time entry
  function createQuoteFromEntry(entry) {
    const hourlyRate = entry.hourly_rate || 65; // Default rate if none set
    const amount = calculateAmount(entry.duration_minutes, hourlyRate);
    const quoteData = {
      customer_id: entry.customer_id,
      appointment_id: entry.appointment_id,
      line_items: [{
        description: entry.description || 'Time tracking work',
        quantity: (entry.duration_minutes / 60).toFixed(2),
        unit: 'hours',
        unit_price: hourlyRate,
        total: parseFloat(amount)
      }],
      net_amount: parseFloat(amount),
      time_entry_id: entry.id
    };
    
    // Navigate to quote creation with prefilled data
    const params = new URLSearchParams({
      prefill: JSON.stringify(quoteData)
    });
    router.push(`/quotes/new?${params.toString()}`);
  }

  // Format elapsed time in seconds to readable format
  function formatElapsedTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
      const res = await authedFetch('/api/time-tracking');
      
      if (!res.ok) {
        // Try to extract error message from standardized response
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to fetch time entries');
      }
      
      // Handle standardized API response format
      const responseData = await res.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const data = responseData.data !== undefined ? responseData.data : responseData;
      setTimeEntries(Array.isArray(data) ? data : []);
      
      // Display success message if available
      if (responseData.message) {
        console.log('Time Entries API Message:', responseData.message);
      }
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError(err.message || 'Failed to load time entries. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Fetch daily entries for selected date
  async function fetchDailyEntries() {
    try {
      setLoading(true);
      const res = await authedFetch(`/api/time-tracking?date=${selectedDate}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to fetch daily entries');
      }
      
      const responseData = await res.json();
      const data = responseData.data !== undefined ? responseData.data : responseData;
      setDailyEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching daily entries:', err);
      setError(err.message || 'Failed to load daily entries');
    } finally {
      setLoading(false);
    }
  }

  // Update entry (for daily view editing)
  async function updateEntry(entryId, updates) {
    try {
      setSaving(true);
      
      const res = await authedFetch('/api/time-tracking', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: entryId,
          ...updates
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to update entry');
      }
      
      setSuccess('Entry updated successfully');
      setEditingEntry(null);
      
      // Refresh the appropriate view
      if (viewMode === 'daily') {
        fetchDailyEntries();
      } else {
        fetchTimeEntries();
      }
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating entry:', err);
      setError(err.message || 'Failed to update entry');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  }

  // Fetch customers for the dropdown
  async function fetchCustomers() {
    try {
      const res = await authedFetch('/api/customers');
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error('Failed to fetch customers:', errorData?.message || res.statusText);
        return;
      }
      
      // Handle standardized API response format
      const responseData = await res.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const data = responseData.data !== undefined ? responseData.data : responseData;
      setCustomers(Array.isArray(data) ? data : []);
      
      // Log any API message
      if (responseData.message) {
        console.log('Customers API Message:', responseData.message);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }
  
  // Fetch appointments for the dropdown
  async function fetchAppointments() {
    try {
      const res = await authedFetch('/api/appointments');
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error('Failed to fetch appointments:', errorData?.message || res.statusText);
        return;
      }
      
      // Handle standardized API response format
      const responseData = await res.json();
      
      // Extract data, supporting both new standardized and legacy formats
      const data = responseData.data !== undefined ? responseData.data : responseData;
      const appointmentsList = Array.isArray(data) ? data : [];
      
      console.log('Fetched appointments:', appointmentsList.length, appointmentsList);
      setAppointments(appointmentsList);
      
      // Log any API message
      if (responseData.message) {
        console.log('Appointments API Message:', responseData.message);
      }
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

  // Project auto-selection based on location and time
  async function autoSelectProject() {
    try {
      // Get current location if available
      if ('geolocation' in navigator) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false
          });
        });
        
        const { latitude, longitude } = position.coords;
        
        // Find nearby appointments within 500m radius
        const res = await authedFetch('/api/appointments');
        if (res.ok) {
          const responseData = await res.json();
          const appointments = responseData.data !== undefined ? responseData.data : responseData;
          
          // Filter appointments for today and nearby
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          
          const nearbyAppointments = appointments.filter(apt => {
            if (!apt.scheduled_at) return false;
            
            const aptDate = new Date(apt.scheduled_at).toISOString().split('T')[0];
            if (aptDate !== todayStr) return false;
            
            // Check if appointment has location data and is within radius
            if (apt.location_lat && apt.location_lng) {
              const distance = calculateDistance(
                latitude, longitude,
                apt.location_lat, apt.location_lng
              );
              return distance <= 0.5; // 500m radius
            }
            
            return false;
          });
          
          // Return the closest upcoming appointment
          if (nearbyAppointments.length > 0) {
            const now = new Date();
            const upcoming = nearbyAppointments
              .filter(apt => new Date(apt.scheduled_at) <= now)
              .sort((a, b) => Math.abs(new Date(a.scheduled_at) - now) - Math.abs(new Date(b.scheduled_at) - now));
            
            return upcoming[0] || null;
          }
        }
      }
    } catch (err) {
      console.log('Auto-selection failed:', err.message);
    }
    
    return null;
  }

  // Calculate distance between two coordinates (Haversine formula)
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  // Start timer locally - no API call
  // Handle appointment selection and auto-fill customer
  function handleAppointmentChange(appointmentId) {
    setTimerAppointmentId(appointmentId);
    
    if (appointmentId) {
      // Find the selected appointment and auto-fill customer
      const selectedAppointment = appointments.find(apt => apt.id === appointmentId);
      if (selectedAppointment && selectedAppointment.customer_id) {
        setTimerCustomerId(selectedAppointment.customer_id);
        setTimerIsBillable(true); // Auto-set billable when appointment selected
      }
    }
  }

  // Start timer - local state only
  function startTimer(description = 'Working...', customerId = '', appointmentId = '', isBillable = false, hourlyRate = '') {
    setLocalTimer({
      start_time: new Date().toISOString(),
      description,
      is_billable: isBillable || Boolean(customerId), // Auto-billable if customer selected
      customer_id: customerId || null,
      appointment_id: appointmentId || null,
      hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null
    });
    setIsPaused(false);
    setPauseBreaks([]);
    
    // Reset timer form fields
    setTimerCustomerId('');
    setTimerAppointmentId('');
    setTimerIsBillable(false);
    setTimerHourlyRate('');
    
    setSuccess('Timer started!');
    setTimeout(() => setSuccess(''), 3000);
  }

  // Pause timer locally - no API call
  function pauseTimer() {
    if (!localTimer) return;
    
    // Add new break period
    const newBreak = {
      start_time: new Date().toISOString(),
      end_time: null
    };
    
    setPauseBreaks(prev => [...prev, newBreak]);
    setIsPaused(true);
    setSuccess('Timer paused');
    setTimeout(() => setSuccess(''), 3000);
  }

  // Resume timer locally - no API call
  function resumeTimer() {
    if (!localTimer) return;
    
    // End the current break period
    setPauseBreaks(prev => 
      prev.map((breakPeriod, index) => 
        index === prev.length - 1 && !breakPeriod.end_time
          ? { ...breakPeriod, end_time: new Date().toISOString() }
          : breakPeriod
      )
    );
    
    setIsPaused(false);
    setSuccess('Timer resumed');
    setTimeout(() => setSuccess(''), 3000);
  }

  // Stop timer and save to database
  async function stopTimer() {
    if (!localTimer) return;
    
    try {
      setSaving(true);
      
      const endTime = new Date().toISOString();
      
      // End any active break
      let finalBreaks = pauseBreaks;
      if (isPaused && pauseBreaks.length > 0 && !pauseBreaks[pauseBreaks.length - 1].end_time) {
        finalBreaks = pauseBreaks.map((breakPeriod, index) => 
          index === pauseBreaks.length - 1
            ? { ...breakPeriod, end_time: endTime }
            : breakPeriod
        );
      }
      
      // Calculate total duration minus breaks - simplified and robust
      const startTime = new Date(localTimer.start_time);
      const endTimeObj = new Date(endTime);
      const totalMs = Math.max(0, endTimeObj - startTime);
      
      const totalBreakMs = finalBreaks.reduce((total, breakPeriod) => {
        if (breakPeriod.end_time && breakPeriod.start_time) {
          const breakDuration = new Date(breakPeriod.end_time) - new Date(breakPeriod.start_time);
          return total + Math.max(0, breakDuration);
        }
        return total;
      }, 0);
      
      const workingMs = Math.max(60000, totalMs - totalBreakMs); // Minimum 1 minute
      const durationMinutes = Math.round(workingMs / 60000);
      
      // Create simplified payload - let database handle what it can
      const payload = {
        description: localTimer.description || 'Work session',
        start_time: localTimer.start_time,
        end_time: endTime,
        duration_minutes: durationMinutes,
        is_billable: Boolean(localTimer.is_billable),
        customer_id: localTimer.customer_id || null,
        appointment_id: localTimer.appointment_id || null,
        notes: `Worked for ${formatElapsedTime(Math.floor(workingMs / 1000))}${finalBreaks.length > 0 ? ` (${finalBreaks.length} break${finalBreaks.length > 1 ? 's' : ''})` : ''}`,
        status: 'completed',
        is_manual_entry: false
      };
      
      const res = await authedFetch('/api/time-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error('Timer save error:', errorData);
        throw new Error(errorData?.message || `Failed to save timer (${res.status})`);
      }
      
      const responseData = await res.json();
      const savedEntry = responseData.data || responseData;
      
      // Reset local timer state first
      setLocalTimer(null);
      setTimerElapsed(0);
      setIsPaused(false);
      setPauseBreaks([]);
      
      // Show success message
      const integrationMsg = (localTimer.appointment_id || localTimer.customer_id) 
        ? await showIntegrationOptions(savedEntry) 
        : '';
      
      setSuccess(`Timer saved! ${integrationMsg}`.trim());
      
      // Refresh entries list
      fetchTimeEntries();
      
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error stopping timer:', err);
      setError(`Failed to save timer: ${err.message}`);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  }

  // Show integration options after timer completion
  async function showIntegrationOptions(timeEntry) {
    const options = [];
    
    if (timeEntry.appointment_id) {
      options.push('Ready for invoicing');
    }
    
    if (timeEntry.customer_id && timeEntry.is_billable) {
      options.push('Can be added to invoice');
    }
    
    return options.length > 0 ? options.join(' • ') : '';
  }

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
        // Try to extract error message from standardized response
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP Error ${res.status}`);
      }
      
      // Handle standardized API response format
      const responseData = await res.json();
      
      // Extract data and message from the response
      const savedEntry = responseData.data !== undefined ? responseData.data : responseData;
      const apiMessage = responseData.message;
      
      // Update state with optimistic update
      setTimeEntries(prev => [savedEntry, ...prev]);
      
      // Use API success message if available
      if (apiMessage) {
        console.log('API Success Message:', apiMessage);
        setSuccess(apiMessage);
      } else {
        setSuccess('Time entry saved!');
      }
      
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
            <div className="flex items-center space-x-4">
              {/* View Mode Toggle */}
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-[#ffcb00] text-black' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode('daily')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'daily' 
                      ? 'bg-[#ffcb00] text-black' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Daily Log
                </button>
              </div>
              
              {/* Date Picker for Daily View */}
              {viewMode === 'daily' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 bg-black/40 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                />
              )}
              
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[#ffcb00] text-black font-medium rounded-lg hover:bg-[#e3b700] transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Manual Entry
              </button>
            </div>
          </div>

          {/* Active Timer Widget */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
            {!localTimer && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Appointment (Optional)</label>
                  <select
                    value={timerAppointmentId}
                    onChange={(e) => handleAppointmentChange(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                  >
                    <option value="">Select Appointment</option>
                    {appointments.map(appointment => (
                      <option key={appointment.id} value={appointment.id}>
                        {appointment.customers?.name || 'Unknown Customer'} - {appointment.location || 'No location'} ({formatDate(appointment.scheduled_at)})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Customer (Optional)</label>
                  <select
                    value={timerCustomerId}
                    onChange={(e) => setTimerCustomerId(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Hourly Rate (€)</label>
                  <input
                    type="number"
                    value={timerHourlyRate}
                    onChange={(e) => setTimerHourlyRate(e.target.value)}
                    placeholder="65.00"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-black/40 border border-white/20 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Billable</label>
                  <div className="flex items-center h-10">
                    <input
                      type="checkbox"
                      checked={timerIsBillable}
                      onChange={(e) => setTimerIsBillable(e.target.checked)}
                      className="w-4 h-4 text-[#ffcb00] bg-black/40 border-white/20 rounded focus:ring-[#ffcb00] focus:ring-2"
                    />
                    <span className="ml-2 text-white/70">Mark as billable</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${localTimer ? (isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse') : 'bg-gray-500'}`}></div>
                  <span className="text-white font-medium">
                    {localTimer ? (isPaused ? 'Timer Paused' : 'Timer Running') : 'No Active Timer'}
                  </span>
                </div>
                {localTimer && (
                  <div className="text-2xl font-mono text-[#ffcb00]">
                    {formatElapsedTime(timerElapsed)}
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {!localTimer ? (
                  <button
                    onClick={() => startTimer('Working...', timerCustomerId, timerAppointmentId, timerIsBillable, timerHourlyRate)}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Start Timer
                  </button>
                ) : (
                  <>
                    {!isPaused ? (
                      <button
                        onClick={pauseTimer}
                        disabled={saving}
                        className="px-4 py-2 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 transition-colors flex items-center disabled:opacity-50"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={resumeTimer}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Resume
                      </button>
                    )}
                    <button
                      onClick={stopTimer}
                      disabled={saving}
                      className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center disabled:opacity-50"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      Stop
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {localTimer && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-white/70 text-sm">
                  <span className="font-medium">Task:</span> {localTimer.description}
                </p>
                <p className="text-white/70 text-sm">
                  <span className="font-medium">Started:</span> {formatTime(localTimer.start_time)} on {formatDate(localTimer.start_time)}
                </p>
                {pauseBreaks.length > 0 && (
                  <p className="text-white/70 text-sm">
                    <span className="font-medium">Breaks:</span> {pauseBreaks.length} pause{pauseBreaks.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
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

          {/* Content based on view mode */}
          {viewMode === 'list' ? (
            /* Time Entries Table */
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {timeEntries.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-white/70">No time entries yet. Click "Manual Entry" to add one.</p>
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
                        <th className="p-4 text-white/80 font-medium">Rate / Amount</th>
                        <th className="p-4 text-white/80 font-medium">Actions</th>
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
                            {entry.hourly_rate ? (
                              <div>
                                <div>€{entry.hourly_rate}/hr</div>
                                {entry.duration_minutes && (
                                  <div className="text-[#ffcb00] text-sm font-medium">
                                    Total: €{calculateAmount(entry.duration_minutes, entry.hourly_rate)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-white/60">No rate set</div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              {/* Simplified: Show buttons for billable entries with customers */}
                              {entry.is_billable && entry.customer_id && (
                                <>
                                  <button
                                    onClick={() => createInvoiceFromEntry(entry)}
                                    className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                                  >
                                    Invoice
                                  </button>
                                  <button
                                    onClick={() => createQuoteFromEntry(entry)}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                  >
                                    Quote
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Daily Log View */
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-white">
                    Daily Log - {formatDate(selectedDate + 'T00:00:00')}
                  </h2>
                  <div className="text-white/70">
                    Total: {dailyEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0)} minutes
                    ({formatDuration(dailyEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0))})
                  </div>
                </div>
                
                {dailyEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/70">No entries for this date.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dailyEntries.map((entry) => (
                      <div key={entry.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                        {editingEntry === entry.id ? (
                          /* Edit Mode */
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <input
                                type="text"
                                defaultValue={entry.description}
                                placeholder="Description"
                                className="px-3 py-2 bg-black/40 border border-white/20 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                                onBlur={(e) => updateEntry(entry.id, { description: e.target.value })}
                              />
                              <input
                                type="number"
                                defaultValue={entry.duration_minutes || ''}
                                placeholder="Duration (minutes)"
                                className="px-3 py-2 bg-black/40 border border-white/20 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                                onBlur={(e) => updateEntry(entry.id, { duration_minutes: parseInt(e.target.value) || null })}
                              />
                            </div>
                            <textarea
                              defaultValue={entry.notes || ''}
                              placeholder="Notes"
                              className="w-full px-3 py-2 bg-black/40 border border-white/20 text-white rounded focus:outline-none focus:ring-2 focus:ring-[#ffcb00] min-h-[60px]"
                              onBlur={(e) => updateEntry(entry.id, { notes: e.target.value })}
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setEditingEntry(null)}
                                className="px-3 py-1 text-white/70 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4 mb-2">
                                <span className="text-white font-medium">{entry.description}</span>
                                <span className="text-[#ffcb00] text-sm">
                                  {formatDuration(entry.duration_minutes)}
                                </span>
                                <span className="text-white/60 text-sm">
                                  {formatTime(entry.start_time)} - {entry.end_time ? formatTime(entry.end_time) : 'Active'}
                                </span>
                              </div>
                              {entry.notes && (
                                <p className="text-white/70 text-sm">{entry.notes}</p>
                              )}
                              <div className="flex items-center space-x-2 mt-2">
                                {entry.is_billable ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                    Billable
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                    Non-billable
                                  </span>
                                )}
                                {entry.hourly_rate && (
                                  <span className="text-white/60 text-xs">
                                    €{entry.hourly_rate}/hr • Total: €{calculateAmount(entry.duration_minutes, entry.hourly_rate)}
                                  </span>
                                )}
                              </div>
                              {/* Simplified: Invoice/Quote buttons for daily view */}
                              {entry.is_billable && entry.customer_id && (
                                <div className="flex items-center space-x-2 mt-2">
                                  <button
                                    onClick={() => createInvoiceFromEntry(entry)}
                                    className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                                  >
                                    Invoice
                                  </button>
                                  <button
                                    onClick={() => createQuoteFromEntry(entry)}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                  >
                                    Quote
                                  </button>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setEditingEntry(entry.id)}
                              className="px-3 py-1 text-[#ffcb00] hover:bg-[#ffcb00]/10 rounded transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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
