const VENUE_TZ: Record<string, string> = {
  'Mexico City': 'America/Mexico_City',
  'Guadalajara (Zapopan)': 'America/Mexico_City',
  'Monterrey (Guadalupe)': 'America/Monterrey',
  'Atlanta': 'America/New_York',
  'Toronto': 'America/Toronto',
  'San Francisco Bay Area (Santa Clara)': 'America/Los_Angeles',
  'Los Angeles (Inglewood)': 'America/Los_Angeles',
  'Vancouver': 'America/Vancouver',
  'Seattle': 'America/Los_Angeles',
  'New York/New Jersey (East Rutherford)': 'America/New_York',
  'Boston (Foxborough)': 'America/New_York',
  'Philadelphia': 'America/New_York',
  'Miami (Miami Gardens)': 'America/New_York',
  'Houston': 'America/Chicago',
  'Dallas (Arlington)': 'America/Chicago',
  'Kansas City': 'America/Chicago',
};

function parseMatchUTC(date: string, time: string): Date | null {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d+)?$/);
  if (!m) return null;
  const hours = parseInt(m[1]);
  const minutes = parseInt(m[2]);
  const offset = m[3] ? parseInt(m[3]) : 0;
  const utcHours = hours - offset;
  return new Date(`${date}T${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`);
}

function formatInTz(utc: Date, tz: string): string {
  return utc.toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
}

export interface MatchTimes {
  france: string;
  local: string;
  localTzLabel: string;
}

export function getMatchTimes(date: string, time: string, ground: string): MatchTimes {
  const utc = parseMatchUTC(date, time);
  if (!utc) return { france: time.split(' ')[0], local: time.split(' ')[0], localTzLabel: '' };

  const france = formatInTz(utc, 'Europe/Paris');
  const localTz = VENUE_TZ[ground] ?? 'UTC';
  const local = formatInTz(utc, localTz);

  const cityShort = ground.includes('(') ? ground.split('(')[0].trim() : ground;

  return { france, local, localTzLabel: cityShort };
}
