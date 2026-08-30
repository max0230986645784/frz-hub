const store = require('../lib/store.cjs');

const CODES = new Map([
  [0, { label: 'Ciel degage', icon: '☀️' }],
  [1, { label: 'Plutot degage', icon: '🌤️' }],
  [2, { label: 'Partiellement nuageux', icon: '⛅' }],
  [3, { label: 'Couvert', icon: '☁️' }],
  [45, { label: 'Brouillard', icon: '🌫️' }],
  [48, { label: 'Brouillard givrant', icon: '🌫️' }],
  [51, { label: 'Bruine legere', icon: '🌦️' }],
  [53, { label: 'Bruine', icon: '🌦️' }],
  [55, { label: 'Bruine dense', icon: '🌧️' }],
  [61, { label: 'Pluie legere', icon: '🌦️' }],
  [63, { label: 'Pluie', icon: '🌧️' }],
  [65, { label: 'Grosse pluie', icon: '🌧️' }],
  [71, { label: 'Neige legere', icon: '🌨️' }],
  [73, { label: 'Neige', icon: '❄️' }],
  [75, { label: 'Grosse neige', icon: '❄️' }],
  [80, { label: 'Averses', icon: '🌦️' }],
  [81, { label: 'Averses fortes', icon: '🌧️' }],
  [95, { label: 'Orage', icon: '⛈️' }],
  [96, { label: 'Orage et grele', icon: '⛈️' }],
]);

function describe(code) {
  return CODES.get(code) ?? { label: 'Meteo inconnue', icon: '🌡️' };
}

/** Open-Meteo needs no API key, which keeps the hub free of secrets. */
async function current() {
  const place = store.get('settings')?.weather ?? { latitude: 50.8503, longitude: 4.3517, city: 'Bruxelles' };
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto';
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Meteo indisponible (${response.status})`);
  const body = await response.json();
  return {
    city: place.city,
    temperature: Math.round(body.current.temperature_2m),
    feelsLike: Math.round(body.current.apparent_temperature),
    humidity: body.current.relative_humidity_2m,
    wind: Math.round(body.current.wind_speed_10m),
    ...describe(body.current.weather_code),
    days: (body.daily?.time ?? []).map((date, index) => ({
      date,
      max: Math.round(body.daily.temperature_2m_max[index]),
      min: Math.round(body.daily.temperature_2m_min[index]),
      ...describe(body.daily.weather_code[index]),
    })),
  };
}

async function searchCity(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=fr`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Recherche de ville indisponible.');
  const body = await response.json();
  return (body.results ?? []).map((result) => ({
    city: result.name,
    country: result.country,
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}

module.exports = { current, searchCity };
