/**
 * Returns 'YYYY-MM-DD' date string using the device's local timezone (no hardcoded timezone).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns display time in the device's local timezone (e.g. '06:50 PM').
 */
export function getLocalTimeString(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Checks whether a given 'YYYY-MM-DD' date string is strictly after today's local date.
 */
export function isFutureDate(dateStr: string, now: Date = new Date()): boolean {
  const todayStr = getLocalDateString(now);
  return dateStr > todayStr;
}

/**
 * Returns relative time string (e.g. '26 minutes ago', '6 hours ago') from a UTC epoch timestamp.
 */
export function formatRelativeTime(
  timestampMs: number,
  nowMs: number = Date.now(),
): string {
  const diffSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));

  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
}
