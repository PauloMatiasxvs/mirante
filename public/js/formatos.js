// Funções pequenas para mostrar números, horas e coordenadas em português.

const numeroBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const horaBrasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function numero(valor) {
  return numeroBR.format(valor);
}

export function dataHora(milissegundos) {
  return `${horaBrasilia.format(milissegundos)} (Brasília)`;
}

export function haQuanto(milissegundos) {
  const minutos = Math.round((Date.now() - milissegundos) / 60_000);
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas} h ${minutos % 60} min`;
}

export function coordenada(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const lo = lon >= 0 ? 'L' : 'O';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${lo}`;
}
