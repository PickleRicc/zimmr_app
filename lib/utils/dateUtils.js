/**
 * Formats a date according to the specified format
 * @param {Date|string} date - The date to format
 * @param {string} format - The format string (e.g., 'MMM d, yyyy', 'h:mm a')
 * @returns {string} The formatted date string
 */
export function formatDate(date, format = 'MMM d, yyyy') {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '';
  
  // Format options
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Replace format tokens with actual values
  return format
    .replace(/yyyy/g, d.getFullYear())
    .replace(/yy/g, d.getFullYear().toString().slice(-2))
    .replace(/MMMM/g, fullMonths[d.getMonth()])
    .replace(/MMM/g, months[d.getMonth()])
    .replace(/MM/g, (d.getMonth() + 1).toString().padStart(2, '0'))
    .replace(/M/g, d.getMonth() + 1)
    .replace(/dd/g, d.getDate().toString().padStart(2, '0'))
    .replace(/d/g, d.getDate())
    .replace(/HH/g, d.getHours().toString().padStart(2, '0'))
    .replace(/H/g, d.getHours())
    .replace(/hh/g, (d.getHours() % 12 || 12).toString().padStart(2, '0'))
    .replace(/h/g, d.getHours() % 12 || 12)
    .replace(/mm/g, d.getMinutes().toString().padStart(2, '0'))
    .replace(/m/g, d.getMinutes())
    .replace(/ss/g, d.getSeconds().toString().padStart(2, '0'))
    .replace(/s/g, d.getSeconds())
    .replace(/a/g, d.getHours() < 12 ? 'am' : 'pm')
    .replace(/A/g, d.getHours() < 12 ? 'AM' : 'PM');
}

/**
 * Formats a date range
 * @param {Date|string} startDate - The start date
 * @param {Date|string} endDate - The end date
 * @param {Object} options - Formatting options
 * @returns {string} The formatted date range
 */
export function formatDateRange(startDate, endDate, options = {}) {
  const { 
    dateFormat = 'MMM d, yyyy',
    timeFormat = 'h:mm a',
    showTime = true
  } = options;
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
  
  // Same day
  if (start.toDateString() === end.toDateString()) {
    if (showTime) {
      return `${formatDate(start, dateFormat)}, ${formatDate(start, timeFormat)} - ${formatDate(end, timeFormat)}`;
    }
    return formatDate(start, dateFormat);
  }
  
  // Different days
  if (showTime) {
    return `${formatDate(start, dateFormat)}, ${formatDate(start, timeFormat)} - ${formatDate(end, dateFormat)}, ${formatDate(end, timeFormat)}`;
  }
  return `${formatDate(start, dateFormat)} - ${formatDate(end, dateFormat)}`;
}

/**
 * Returns a relative time string (e.g., "2 hours ago", "in 3 days")
 * @param {Date|string} date - The date to format
 * @returns {string} The relative time string
 */
export function getRelativeTimeString(date) {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  if (isNaN(d.getTime())) return '';
  
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  
  if (diffSec < 0) {
    // Past
    if (diffSec > -60) return 'just now';
    if (diffMin > -60) return `${Math.abs(diffMin)} minute${Math.abs(diffMin) !== 1 ? 's' : ''} ago`;
    if (diffHour > -24) return `${Math.abs(diffHour)} hour${Math.abs(diffHour) !== 1 ? 's' : ''} ago`;
    if (diffDay > -7) return `${Math.abs(diffDay)} day${Math.abs(diffDay) !== 1 ? 's' : ''} ago`;
    return formatDate(d);
  } else {
    // Future
    if (diffSec < 60) return 'in a moment';
    if (diffMin < 60) return `in ${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
    if (diffHour < 24) return `in ${diffHour} hour${diffHour !== 1 ? 's' : ''}`;
    if (diffDay < 7) return `in ${diffDay} day${diffDay !== 1 ? 's' : ''}`;
    return formatDate(d);
  }
}

/**
 * Formats a currency value
 * @param {number|string} amount - The amount to format
 * @param {string} currency - The currency code (e.g., 'EUR', 'USD')
 * @param {string} locale - The locale to use for formatting
 * @returns {string} The formatted currency string
 */
export function formatCurrency(amount, currency = 'EUR', locale = 'de-DE') {
  if (amount === null || amount === undefined || isNaN(parseFloat(amount))) {
    return '';
  }
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseFloat(amount));
}
