/** Monday–Friday elapsed days in Asia/Taipei, preserving partial weekdays. */
export const WORKWEEK_DAYS = 5;

export function workingDaysBetween(start, end) {
  const from = +new Date(start), until = +new Date(end);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) return 0;
  const day = 86400000, week = 7 * day;
  // Shift timestamps to Taiwan local dates and anchor weeks on Monday, 1970/1/5.
  const clock = stamp => {
    const shifted = stamp + 8 * 3600000 - 4 * day;
    const weeks = Math.floor(shifted / week);
    return weeks * WORKWEEK_DAYS * day + Math.min(shifted - weeks * week, WORKWEEK_DAYS * day);
  };
  return (clock(until) - clock(from)) / day;
}
