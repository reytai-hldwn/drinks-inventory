/** Monday–Friday elapsed days in Asia/Taipei, preserving partial weekdays. */
export const WORKWEEK_DAYS = 5;
export const CONSUMPTION_WINDOW_DAYS = 30;

/** A rolling elapsed-time window; zero selects all retained observations. */
export function consumptionWindow(days = CONSUMPTION_WINDOW_DAYS, now = Date.now()) {
  const until = +new Date(now);
  return {days,startAt:days===0?null:new Date(until-days*86400000).toISOString(),endAt:new Date(until).toISOString()};
}

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
