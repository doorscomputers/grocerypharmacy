/**
 * Date/Time Utilities for Philippine Timezone
 * All timestamps in this app should use the device's local time (Asia/Manila, UTC+8)
 * The mobile device is expected to be set to the correct Philippine timezone.
 */

/**
 * Get current date/time using device's local time
 * The device is expected to be configured with the correct Philippine timezone (Asia/Manila)
 * @returns Date object with device's current local time
 */
export function getPhilippineTime(): Date {
  // Use device's local time directly - the device should be set to Philippine timezone
  return new Date();
}

/**
 * Helper to pad numbers with leading zeros
 */
function padZero(num: number, length: number = 2): string {
  return String(num).padStart(length, '0');
}

/**
 * Get current Philippine time as ISO string (YYYY-MM-DDTHH:mm:ss.sssZ format)
 * Note: The 'Z' suffix is kept for SQLite compatibility but the time is actually PH time
 * @returns ISO string in Philippine timezone
 */
export function getPhilippineTimeISO(): string {
  const phTime = getPhilippineTime();
  const year = phTime.getFullYear();
  const month = padZero(phTime.getMonth() + 1);
  const day = padZero(phTime.getDate());
  const hours = padZero(phTime.getHours());
  const minutes = padZero(phTime.getMinutes());
  const seconds = padZero(phTime.getSeconds());
  const ms = padZero(phTime.getMilliseconds(), 3);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}Z`;
}

/**
 * Get current Philippine date as YYYY-MM-DD string
 * @returns Date string in YYYY-MM-DD format
 */
export function getPhilippineDateString(): string {
  const phTime = getPhilippineTime();
  const year = phTime.getFullYear();
  const month = padZero(phTime.getMonth() + 1);
  const day = padZero(phTime.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Get current Philippine time as HH:mm:ss string
 * @returns Time string in HH:mm:ss format
 */
export function getPhilippineTimeString(): string {
  const phTime = getPhilippineTime();
  const hours = padZero(phTime.getHours());
  const minutes = padZero(phTime.getMinutes());
  const seconds = padZero(phTime.getSeconds());
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Get current Philippine datetime as YYYY-MM-DD HH:mm:ss string (SQLite compatible)
 * @returns Datetime string in YYYY-MM-DD HH:mm:ss format
 */
export function getPhilippineDateTimeString(): string {
  const phTime = getPhilippineTime();
  const year = phTime.getFullYear();
  const month = padZero(phTime.getMonth() + 1);
  const day = padZero(phTime.getDate());
  const hours = padZero(phTime.getHours());
  const minutes = padZero(phTime.getMinutes());
  const seconds = padZero(phTime.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Convert a Date object to local date string (YYYY-MM-DD format)
 * Use this instead of .toISOString().split('T')[0] which gives UTC date
 * @param date Date object to convert
 * @returns Date string in YYYY-MM-DD format using local timezone
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1);
  const day = padZero(date.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Format a date to Philippine timezone display string
 * @param date Date object or date string to format
 * @returns Formatted date string in Philippine timezone
 */
export function formatPhilippineDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date to Philippine timezone display string with time
 * @param date Date object or date string to format
 * @returns Formatted datetime string in Philippine timezone
 */
export function formatPhilippineDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a time to Philippine timezone display string
 * @param date Date object or date string to format
 * @returns Formatted time string in Philippine timezone
 */
export function formatPhilippineTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * ASCII-safe date formatter for thermal printers (e.g. "Feb 13, 2026")
 * Avoids toLocaleString which can produce non-ASCII characters on some devices
 */
export function formatPrinterDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * ASCII-safe datetime formatter for thermal printers (e.g. "Feb 13, 2026 02:30 PM")
 * Avoids toLocaleString which can produce non-ASCII AM/PM on some devices
 */
export function formatPrinterDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${padZero(h12)}:${padZero(d.getMinutes())} ${ampm}`;
}

/**
 * ASCII-safe short datetime for thermal printers (e.g. "Feb 13 02:30 PM")
 * Compact version without year, for line-constrained printer output
 */
export function formatPrinterShortDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()} ${padZero(h12)}:${padZero(d.getMinutes())} ${ampm}`;
}

/**
 * ASCII-safe time-only formatter for thermal printers (e.g. "02:30 PM")
 * Avoids toLocaleTimeString which can produce non-ASCII AM/PM on some devices
 */
export function formatPrinterTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${padZero(h12)}:${padZero(d.getMinutes())} ${ampm}`;
}

/**
 * ASCII-safe numeric date formatter for thermal printers (e.g. "02/23/2026")
 * Avoids toLocaleDateString which can produce non-ASCII characters on some devices
 */
export function formatPrinterDateNumeric(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${padZero(d.getMonth() + 1)}/${padZero(d.getDate())}/${d.getFullYear()}`;
}
