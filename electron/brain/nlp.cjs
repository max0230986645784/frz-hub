/**
 * Minimal French/English language kit for the FRZ brain: everything here runs
 * offline, there is no model behind it, only normalisation and scoring.
 */

const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'a', 'et', 'ou', 'mais', 'donc', 'que', 'qui',
  'quoi', 'pour', 'sur', 'dans', 'en', 'me', 'moi', 'my', 'the', 'to', 'of', 'stp', 'svp', 'please', 'peux',
  'peut', 'tu', 'te', 'je', 'j', 'il', 'elle', 'on', 'est', 'es', 'suis', 'ce', 'cet', 'cette', 'mon', 'ma', 'mes',
]);

/** Lowercase, accent free, punctuation free: the shape every matcher expects. */
function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return normalize(text)
    .replace(/[^\w\s.:/\\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function contentTokens(text) {
  return tokens(text).filter((token) => !STOP_WORDS.has(token) && token.length > 1);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** 0..1 similarity, tolerant to typos ("minecarft" still finds "minecraft"). */
function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const distance = levenshtein(left, right);
  return Math.max(0, 1 - distance / Math.max(left.length, right.length));
}

/** Best match of `query` inside a list of named entries, above `threshold`. */
function bestMatch(query, entries, accessor = (entry) => entry.name, threshold = 0.55) {
  let best = null;
  for (const entry of entries) {
    const score = similarity(query, accessor(entry));
    if (score >= threshold && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}

/** Splits "lance minecraft et ouvre discord puis nettoie" into three orders. */
function splitClauses(text) {
  const parts = normalize(text)
    .split(/\s+(?:puis|ensuite|apres|then|et aussi|et ensuite)\s+|\s*(?:;|,\s*puis|\balors\b)\s*/g)
    .flatMap((part) => part.split(/\s+et\s+(?=(?:lance|ouvre|demarre|ferme|start|open|close|nettoie|montre|affiche|joue|cherche|genere|code|cree))/g))
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [normalize(text)];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word aware contains: "net" never matches "internet", "ferm" matches "ferme". */
function wordIn(text, word) {
  const needle = normalize(word);
  if (!needle) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`, 'i').test(normalize(text));
}

function hasAny(text, words) {
  return words.some((word) => wordIn(text, word));
}

function countMatches(text, words) {
  return words.filter((word) => wordIn(text, word)).length;
}

function parseDuration(text) {
  const match = /(\d+)\s*(s|sec|secondes?|m|min|minutes?|h|heures?)/.exec(normalize(text));
  if (!match) return null;
  const value = Number(match[1]);
  if (/^h/.test(match[2])) return value * 3600;
  if (/^m/.test(match[2])) return value * 60;
  return value;
}

function parseNumber(text) {
  const match = /(\d+([.,]\d+)?)/.exec(normalize(text));
  return match ? Number(match[1].replace(',', '.')) : null;
}

module.exports = {
  STOP_WORDS,
  normalize,
  tokens,
  contentTokens,
  levenshtein,
  similarity,
  bestMatch,
  splitClauses,
  wordIn,
  hasAny,
  countMatches,
  parseDuration,
  parseNumber,
};
