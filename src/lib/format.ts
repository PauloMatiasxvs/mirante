const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const brasiliaDateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatInt = (value: number) => integer.format(value);

export const formatDecimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');

export const formatBrasiliaTime = (ms: number) => `${brasiliaDateTime.format(ms)} (Brasília)`;

export function timeAgo(ms: number, now = Date.now()): string {
  const minutes = Math.round((now - ms) / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatLatLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'L' : 'O'}`;
}

export function formatDms(value: number, positive: string, negative: string): string {
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${degrees}°${pad(minutes)}'${pad(seconds)}"${value >= 0 ? positive : negative}`;
}

export const formatDistance = (meters: number) =>
  meters >= 10_000 ? `${formatInt(meters / 1000)} km` : `${formatInt(meters)} m`;

export function formatGroundResolution(metersPerPixel: number): string {
  if (metersPerPixel < 10) return `${formatDecimal(metersPerPixel, 2)} m/px`;
  if (metersPerPixel < 1000) return `${formatInt(metersPerPixel)} m/px`;
  return `${formatInt(metersPerPixel / 1000)} km/px`;
}
