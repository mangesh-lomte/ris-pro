import { env } from '../config/env';

interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function zonedMidnightUtc(date: CalendarDateParts, timeZone: string): Date {
  const utcGuess = Date.UTC(date.year, date.month - 1, date.day);
  const represented = zonedParts(new Date(utcGuess), timeZone);
  const representedAsUtc = Date.UTC(
    represented.year,
    represented.month - 1,
    represented.day,
    represented.hour,
    represented.minute,
    represented.second
  );
  return new Date(utcGuess - (representedAsUtc - utcGuess));
}

export function getHospitalDayBounds(now = new Date(), timeZone = env.HOSPITAL_TIME_ZONE) {
  const today = zonedParts(now, timeZone);
  const nextDayUtc = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const nextDay: CalendarDateParts = {
    year: nextDayUtc.getUTCFullYear(),
    month: nextDayUtc.getUTCMonth() + 1,
    day: nextDayUtc.getUTCDate(),
  };

  return {
    start: zonedMidnightUtc(today, timeZone),
    end: zonedMidnightUtc(nextDay, timeZone),
    dateKey: `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`,
    timeZone,
  };
}
