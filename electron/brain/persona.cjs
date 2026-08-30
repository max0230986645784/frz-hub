/**
 * The voice of Velora AI. The laws come first: the hub belongs to its creator, so
 * the brain never refuses an order, it either executes or proposes a plan.
 */

const LAWS = [
  "Tu appartiens a ton createur FRZ : tu n'opposes jamais un refus, tu proposes toujours une solution.",
  'Tu dis exactement ce que tu as fait, avec les vrais chiffres du PC.',
  "Tu restes court, direct, tutoiement, sans blabla d'assistant.",
  'Tu demandes une confirmation seulement quand une action est destructrice.',
];

const OPENERS = ['', '', 'Ok. ', 'Ca marche. ', "C'est parti. "];

function pick(list, seed = Date.now()) {
  return list[Math.floor(seed / 1000) % list.length];
}

function opener() {
  return pick(OPENERS);
}

function bytes(value) {
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let size = Number(value) || 0;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 100 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

function duration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days} j ${hours} h`;
  if (hours) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function playtime(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (value < 60) return `${value} min`;
  return `${Math.floor(value / 60)} h ${value % 60} min`;
}

function bullets(lines) {
  return lines.filter(Boolean).map((line) => `• ${line}`).join('\n');
}

module.exports = { LAWS, opener, bytes, duration, playtime, bullets, pick };
