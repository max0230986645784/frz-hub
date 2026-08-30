const store = require('../lib/store.cjs');
const { skills } = require('./skills.cjs');
const { normalize, splitClauses, similarity, hasAny, bestMatch } = require('./nlp.cjs');
const { LAWS, opener, bullets } = require('./persona.cjs');

const CONFIDENCE_FLOOR = 0.34;
const YES = ['oui', 'ouais', 'yes', 'ok', 'vas-y', 'go', 'fais le', 'fais-le', 'confirme', 'yep', 'carrement'];
const NO = ['non', 'no', 'annule', 'laisse', 'stop', 'nope', 'pas maintenant'];

/** Volatile part of the brain: what it just did, what it is waiting for. */
const memory = {
  lastTarget: null,
  lastTopic: null,
  pending: null,
  turns: [],
};

function learned() {
  return store.get('learned') ?? [];
}

/** A learned phrase rewrites the sentence into the command it stands for. */
function applyLearned(text) {
  const match = bestMatch(text, learned(), (entry) => entry.phrase, 0.82);
  return match ? match.entry.command : text;
}

function scoreSkills(clause) {
  return skills
    .map((skill) => ({ skill, score: skill.match(clause) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function suggestions() {
  return [
    'Pourquoi mon PC rame ?',
    'Lance Streamora et ouvre Discord',
    'Nettoie les fichiers temporaires',
    'Teste mon debit',
    'Code-moi un site vitrine pour FRZ Repair',
    'Qui est connecte sur mon reseau ?',
  ];
}

/** Fallback answer: propose the closest abilities, never a flat refusal. */
function fallback(clause) {
  const ranked = skills
    .map((skill) => ({
      skill,
      score: Math.max(...skill.examples.map((example) => similarity(clause, example)), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return {
    say: [
      "Je n'ai pas encore le reflexe exact pour ca, mais je ne te laisse pas sans rien.",
      '',
      bullets([
        ...ranked.map((entry) => `${entry.skill.label} — ex. "${entry.skill.examples[0]}"`),
        'Ou apprends-le moi : "quand je dis ' + clause + ', fais <ta commande>"',
      ]),
    ].join('\n'),
    intent: 'fallback',
  };
}

async function runSkill(skill, { clause, original, confirmed = false }) {
  const context = {
    clause,
    original,
    memory,
    confirmed,
    requestConfirmation(question, payload) {
      memory.pending = { type: 'confirm', skill: skill.id, clause, original, payload };
      return { say: question, awaiting: 'confirm' };
    },
  };
  const result = await skill.run(context);
  return { intent: skill.id, ...result };
}

function transcript() {
  return memory.turns.slice(-40);
}

function remember(role, text, extra = {}) {
  memory.turns.push({ role, text, at: Date.now(), ...extra });
  if (memory.turns.length > 200) memory.turns.splice(0, memory.turns.length - 200);
}

/**
 * Main loop of the brain: resolve pending questions, rewrite learned phrases,
 * split the sentence into orders, execute each one and merge the answers.
 */
async function ask(input) {
  const original = String(input ?? '').trim();
  if (!original) return { reply: 'Dis-moi ce que je fais.', cards: [], intent: 'empty' };
  remember('user', original);

  const normalized = normalize(original);

  if (memory.pending?.type === 'confirm') {
    const pending = memory.pending;
    memory.pending = null;
    if (hasAny(normalized, NO)) {
      const answer = { reply: "Ok, j'annule.", cards: [], intent: 'cancelled' };
      remember('brain', answer.reply);
      return answer;
    }
    if (hasAny(normalized, YES)) {
      const skill = skills.find((entry) => entry.id === pending.skill);
      const result = await execute(skill, pending.clause, pending.original, true);
      remember('brain', result.reply);
      return result;
    }
  }

  if (memory.pending?.type === 'ask') {
    const pending = memory.pending;
    memory.pending = null;
    const skill = skills.find((entry) => entry.id === pending.skill);
    const merged = `${pending.clause} ${original}`;
    const result = await execute(skill, merged, merged, false);
    remember('brain', result.reply);
    return result;
  }

  const rewritten = applyLearned(original);
  const clauses = splitClauses(rewritten);
  const replies = [];
  const cards = [];
  const refresh = new Set();
  let intent = 'unknown';

  for (const clause of clauses) {
    const ranked = scoreSkills(clause);
    const best = ranked[0];
    if (!best || best.score < CONFIDENCE_FLOOR) {
      const answer = fallback(clause);
      replies.push(answer.say);
      continue;
    }
    const result = await execute(best.skill, clause, rewritten, false);
    intent = result.intent;
    replies.push(result.reply);
    cards.push(...result.cards);
    for (const key of result.refresh ?? []) refresh.add(key);
  }

  const reply = replies.filter(Boolean).join('\n\n');
  remember('brain', reply, { cards });
  return { reply, cards, intent, refresh: [...refresh], awaiting: memory.pending?.type ?? null };
}

/** Runs one skill and turns any crash into a useful sentence, never a stack. */
async function execute(skill, clause, original, confirmed) {
  if (!skill) return { reply: "J'ai perdu le fil, redis-moi ca.", cards: [], intent: 'lost' };
  try {
    const result = await runSkill(skill, { clause, original, confirmed });
    if (result.ask) memory.pending = { type: 'ask', skill: skill.id, clause, original };
    return {
      reply: (result.awaiting ? '' : opener()) + result.say,
      cards: result.card ? [result.card] : [],
      intent: result.intent,
      refresh: result.refresh ?? [],
    };
  } catch (error) {
    return {
      reply: `Je n'ai pas pu aller au bout : ${error.message}`,
      cards: [],
      intent: `${skill.id}:error`,
      refresh: [],
    };
  }
}

function capabilities() {
  return skills.map((skill) => ({ id: skill.id, label: skill.label, examples: skill.examples }));
}

function forget() {
  memory.lastTarget = null;
  memory.pending = null;
  memory.turns = [];
  return true;
}

module.exports = { ask, capabilities, suggestions, transcript, forget, LAWS, learned };
