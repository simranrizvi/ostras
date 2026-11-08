const wallParts = (date, timezone) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
const wallStamp = (p) => Date.UTC(p.year, p.month - 1, p.day, p.hour || 0, p.minute || 0);

export function zonedInstant(day, time, timezone) {
  const [hour, minute] = time.split(':').map(Number);
  const target = { ...day, hour, minute };
  let guess = wallStamp(target);
  for (let i = 0; i < 4; i += 1) {
    const actual = wallStamp(wallParts(new Date(guess), timezone));
    if (actual === wallStamp(target)) return new Date(guess);
    guess += wallStamp(target) - actual;
  }
  // A nonexistent local time during the spring DST change is skipped.
  return null;
}
export function upcomingSlots(brand, now = new Date(), horizon = 21) {
  const timezone = brand.timezone || 'UTC';
  const local = wallParts(now, timezone);
  const daysPerWeek = Math.min(7, Math.max(1, brand.postsPerWeek || 5));
  const weekdays = Array.from({ length: daysPerWeek }, (_, i) => Math.floor((i * 7) / daysPerWeek));
  const times = [
    ...new Set(brand.preferredTimes?.length ? brand.preferredTimes : ['10:00']),
  ].sort();
  const result = [];
  for (let offset = 0; offset < horizon; offset += 1) {
    const day = new Date(Date.UTC(local.year, local.month - 1, local.day + offset));
    if (!weekdays.includes((day.getUTCDay() + 6) % 7)) continue;
    // One slot per publishing day; preferred times rotate across those days.
    const slot = zonedInstant(
      { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate() },
      times[result.length % times.length],
      timezone,
    );
    if (slot && slot > now) result.push(slot);
  }
  return result;
}
