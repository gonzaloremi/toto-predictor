import { useState, useEffect } from 'react';

const VENUE_COORDS: Record<string, { lat: number; lon: number }> = {
  'Mexico City': { lat: 19.30, lon: -99.15 },
  'Guadalajara (Zapopan)': { lat: 20.71, lon: -103.37 },
  'Monterrey (Guadalupe)': { lat: 25.67, lon: -100.24 },
  'Atlanta': { lat: 33.76, lon: -84.40 },
  'Toronto': { lat: 43.63, lon: -79.42 },
  'San Francisco Bay Area (Santa Clara)': { lat: 37.40, lon: -121.97 },
  'Los Angeles (Inglewood)': { lat: 33.95, lon: -118.34 },
  'Vancouver': { lat: 49.28, lon: -123.11 },
  'Seattle': { lat: 47.60, lon: -122.33 },
  'New York/New Jersey (East Rutherford)': { lat: 40.81, lon: -74.07 },
  'Boston (Foxborough)': { lat: 42.09, lon: -71.26 },
  'Philadelphia': { lat: 39.90, lon: -75.17 },
  'Miami (Miami Gardens)': { lat: 25.96, lon: -80.24 },
  'Houston': { lat: 29.68, lon: -95.41 },
  'Dallas (Arlington)': { lat: 32.75, lon: -97.09 },
  'Kansas City': { lat: 39.05, lon: -94.48 },
};

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  56: '🌨️', 57: '🌨️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌨️', 67: '🌨️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  77: '❄️', 80: '🌧️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export interface WeatherInfo {
  temp: number;
  icon: string;
  wind: number;
  humidity: number;
}

const cache = new Map<string, WeatherInfo>();

export function useWeather(ground: string, date: string, time: string): WeatherInfo | null {
  const [weather, setWeather] = useState<WeatherInfo | null>(() => cache.get(`${ground}_${date}`) ?? null);

  useEffect(() => {
    const key = `${ground}_${date}`;
    if (cache.has(key)) { setWeather(cache.get(key)!); return; }

    const coords = VENUE_COORDS[ground];
    if (!coords) return;

    const matchDate = new Date(date);
    const now = new Date();
    const daysAhead = Math.floor((matchDate.getTime() - now.getTime()) / 86400000);
    if (daysAhead < -1 || daysAhead > 15) return;

    let hour = 15;
    const timeMatch = time.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) hour = parseInt(timeMatch[1]);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&start_date=${date}&end_date=${date}&timezone=auto`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!data.hourly) return;
        const idx = Math.min(hour, data.hourly.time.length - 1);
        const code = data.hourly.weather_code[idx] ?? 0;
        const info: WeatherInfo = {
          temp: Math.round(data.hourly.temperature_2m[idx]),
          icon: WMO_ICONS[code] ?? '🌡️',
          wind: Math.round(data.hourly.wind_speed_10m[idx]),
          humidity: data.hourly.relative_humidity_2m[idx],
        };
        cache.set(key, info);
        setWeather(info);
      })
      .catch(() => {});
  }, [ground, date, time]);

  return weather;
}
