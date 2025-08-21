// Time Tracking Integration Utilities
// Handles linking time entries with appointments, invoices, and quotes

/**
 * Get time entries for a specific appointment
 */
export async function getTimeEntriesForAppointment(appointmentId, authedFetch) {
  try {
    const res = await authedFetch(`/api/time-tracking?appointment_id=${appointmentId}`);
    if (res.ok) {
      const responseData = await res.json();
      return responseData.data || [];
    }
    return [];
  } catch (err) {
    console.error('Error fetching time entries for appointment:', err);
    return [];
  }
}

/**
 * Get time entries for a specific customer
 */
export async function getTimeEntriesForCustomer(customerId, authedFetch) {
  try {
    const res = await authedFetch(`/api/time-tracking?customer_id=${customerId}`);
    if (res.ok) {
      const responseData = await res.json();
      return responseData.data || [];
    }
    return [];
  } catch (err) {
    console.error('Error fetching time entries for customer:', err);
    return [];
  }
}

/**
 * Calculate total billable hours for time entries
 */
export function calculateBillableHours(timeEntries) {
  const billableEntries = timeEntries.filter(entry => entry.is_billable && entry.status === 'completed');
  const totalMinutes = billableEntries.reduce((total, entry) => total + (entry.duration_minutes || 0), 0);
  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate total revenue from time entries
 */
export function calculateTimeEntryRevenue(timeEntries, defaultHourlyRate = 65) {
  const billableEntries = timeEntries.filter(entry => entry.is_billable && entry.status === 'completed');
  
  return billableEntries.reduce((total, entry) => {
    const hours = (entry.duration_minutes || 0) / 60;
    const rate = entry.hourly_rate || defaultHourlyRate;
    return total + (hours * rate);
  }, 0);
}

/**
 * Format time entries for invoice line items
 */
export function formatTimeEntriesForInvoice(timeEntries, defaultHourlyRate = 65) {
  const billableEntries = timeEntries.filter(entry => entry.is_billable && entry.status === 'completed');
  
  return billableEntries.map(entry => {
    const hours = Math.round(((entry.duration_minutes || 0) / 60) * 100) / 100;
    const rate = entry.hourly_rate || defaultHourlyRate;
    
    return {
      description: entry.description || 'Time worked',
      quantity: hours,
      unit: 'hours',
      unit_price: rate,
      total: hours * rate,
      date: entry.start_time ? new Date(entry.start_time).toLocaleDateString('de-DE') : '',
      notes: entry.notes || ''
    };
  });
}

/**
 * Check if appointment has time tracking data
 */
export function hasTimeTrackingData(timeEntries) {
  return timeEntries && timeEntries.length > 0;
}

/**
 * Get time tracking summary for display
 */
export function getTimeTrackingSummary(timeEntries) {
  const completed = timeEntries.filter(entry => entry.status === 'completed');
  const billable = completed.filter(entry => entry.is_billable);
  const totalHours = calculateBillableHours(timeEntries);
  
  return {
    totalEntries: timeEntries.length,
    completedEntries: completed.length,
    billableEntries: billable.length,
    totalHours,
    hasActiveTimer: timeEntries.some(entry => entry.status === 'active')
  };
}
