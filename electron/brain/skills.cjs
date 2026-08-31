const os = require('node:os');
const path = require('node:path');
const { app, shell } = require('electron');
const store = require('../lib/store.cjs');
const system = require('../services/system.cjs');
const apps = require('../services/apps.cjs');
const games = require('../services/games.cjs');
const network = require('../services/network.cjs');
const toolbox = require('../services/tools.cjs');
const media = require('../services/media.cjs');
const weather = require('../services/weather.cjs');
const github = require('../services/github.cjs');
const studio = require('./studio.cjs');
const bots = require('../services/bots.cjs');
const { normalize, hasAny, countMatches, wordIn, similarity } = require('./nlp.cjs');
const { bytes, duration, playtime, bullets } = require('./persona.cjs');

const LAUNCH_VERBS = ['lance', 'lancer', 'ouvre', 'ouvrir', 'demarre', 'demarrer', 'execute', 'executer', 'start', 'open', 'run', 'joue', 'jouer'];
const CLOSE_VERBS = ['ferme', 'fermer', 'quitte', 'quitter', 'arrete', 'arreter', 'kill', 'tue', 'close', 'stop'];

/**
 * Builds a scorer: every group of `all` must be present, each hit of `any`
 * and each matching regex raises the confidence.
 */
function matcher({ all = [], any = [], regex = [], base = 0.35 } = {}) {
  return (text) => {
    for (const group of all) if (!hasAny(text, group)) return 0;
    let score = all.length ? base + 0.25 * all.length : 0;
    score += 0.12 * countMatches(text, any);
    for (const pattern of regex) if (pattern.test(normalize(text))) score += 0.3;
    return Math.min(1, score);
  };
}

/** Text after a verb: "lance minecraft en mode fenetre" -> "minecraft". */
function targetAfter(text, verbs) {
  const normalized = normalize(text);
  for (const verb of verbs) {
    const index = normalized.indexOf(`${verb} `);
    if (index === -1) continue;
    let rest = normalized.slice(index + verb.length + 1);
    rest = rest
      .replace(/^(moi|le|la|les|l'|mon|ma|mes|un|une|du|de|des)\s+/g, '')
      .replace(/\b(stp|svp|please|maintenant|tout de suite)\b/g, '')
      .trim();
    if (rest) return rest;
  }
  return '';
}

const skills = [
  {
    id: 'greeting',
    label: 'Dire bonjour',
    examples: ['salut', 'yo FRZ'],
    match: matcher({ all: [['salut', 'bonjour', 'yo', 'hello', 'hey', 'coucou', 'bonsoir']], base: 0.5 }),
    async run({ memory }) {
      const name = store.get('settings')?.userName || 'chef';
      const hour = new Date().getHours();
      const moment = hour < 6 ? 'Belle nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Salut' : 'Bonsoir';
      const snapshot = await system.snapshot();
      memory.lastTopic = 'greeting';
      return {
        say: `${moment} ${name}. CPU ${snapshot.cpu.total} %, RAM ${snapshot.memory.percent} %, tout est sous controle. Qu'est-ce qu'on fait ?`,
      };
    },
  },
  {
    id: 'identity',
    label: 'Qui es-tu',
    examples: ['tu es qui', 'tu sais faire quoi'],
    match: matcher({
      all: [['qui', 'quoi', 'comment']],
      any: ['tu es', 'ton nom', 'appelles', 'sais faire', 'peux faire', 'sert', 'aide'],
      regex: [/\b(qui es[- ]tu|tu es qui|c'est quoi frz ai|tu sais faire quoi|aide)\b/],
    }),
    run() {
      return {
        say: [
          "Je suis Velora AI, le cerveau de Velora OS. Pas de service en ligne derriere moi : mon code tourne dans l'app, sur ton PC.",
          '',
          bullets([
            'Lancer / fermer tes programmes et tes jeux',
            'Diagnostiquer les ralentissements (CPU, RAM, disque, processus, reseau)',
            'Nettoyer, compresser, convertir, chercher des fichiers',
            'Tester ta connexion et scanner ton reseau local',
            'Coder des projets pour toi (Velora Studio)',
            'Lire ton GitHub, ta meteo, ta bibliotheque media',
            "Apprendre de nouvelles commandes : \"quand je dis X, fais Y\"",
          ]),
        ].join('\n'),
      };
    },
  },
  {
    id: 'time',
    label: 'Heure et date',
    examples: ['il est quelle heure'],
    match: matcher({ all: [['heure', 'date', 'jour', 'time']], regex: [/quelle heure|on est quel jour/] }),
    run() {
      const now = new Date();
      return {
        say: `Il est ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, on est ${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. PC allume depuis ${duration(os.uptime())}.`,
      };
    },
  },
  {
    id: 'launch',
    label: 'Lancer un programme',
    examples: ['lance Minecraft', 'ouvre Discord'],
    match: (text) => {
      if (!hasAny(text, LAUNCH_VERBS)) return 0;
      if (hasAny(text, ['dossier', 'fichier', 'note', 'meteo'])) return 0.45;
      return targetAfter(text, LAUNCH_VERBS) ? 0.9 : 0.5;
    },
    async run({ clause, memory }) {
      const target = targetAfter(clause, LAUNCH_VERBS) || memory.lastTarget;
      if (!target) return { say: 'Tu veux que je lance quoi ?', ask: 'launch-target' };
      memory.lastTarget = target;
      const result = await apps.launchByName(target);
      return { say: `${result.name} est lance.`, refresh: ['apps', 'games'] };
    },
  },
  {
    id: 'close',
    label: 'Fermer un programme',
    examples: ['ferme Chrome'],
    match: (text) => {
      if (!hasAny(text, CLOSE_VERBS)) return 0;
      return targetAfter(text, CLOSE_VERBS) ? 0.88 : 0.5;
    },
    async run({ clause }) {
      const target = targetAfter(clause, CLOSE_VERBS);
      if (!target) return { say: 'Je ferme quoi ?', ask: 'close-target' };
      const result = await system.killByName(target);
      return {
        say: result.closed
          ? `${result.name} ferme (${result.closed} processus).`
          : `Aucun processus qui ressemble a "${target}" ne tourne.`,
      };
    },
  },
  {
    id: 'system',
    label: 'Etat du PC',
    examples: ['etat du PC', 'combien de RAM'],
    match: matcher({
      all: [['cpu', 'ram', 'memoire', 'gpu', 'processeur', 'carte graphique', 'systeme', 'pc', 'specs', 'temperature', 'disque', 'stockage', 'espace']],
      any: ['etat', 'status', 'combien', 'montre', 'affiche', 'utilise', 'reste', 'libre', 'infos'],
    }),
    async run() {
      const snapshot = await system.snapshot();
      const disk = snapshot.disks[0];
      return {
        say: bullets([
          `CPU ${snapshot.cpu.model} — ${snapshot.cpu.total} % sur ${snapshot.cpu.cores} coeurs`,
          `RAM ${bytes(snapshot.memory.used)} / ${bytes(snapshot.memory.total)} (${snapshot.memory.percent} %)`,
          snapshot.gpus[0]
            ? `GPU ${snapshot.gpus[0].name}${snapshot.gpus[0].load !== null ? ` — ${snapshot.gpus[0].load} %` : ''}`
            : null,
          disk ? `Disque ${disk.mount} — ${bytes(disk.free)} libres sur ${bytes(disk.total)}` : null,
          snapshot.temperatures[0] ? `Temperature ${snapshot.temperatures[0].celsius} C` : null,
          `Allume depuis ${duration(snapshot.os.uptime)}`,
        ]),
        card: { type: 'system', data: snapshot },
      };
    },
  },
  {
    id: 'diagnose',
    label: 'Diagnostic',
    examples: ['pourquoi mon PC rame'],
    match: matcher({
      all: [['rame', 'lent', 'lag', 'lags', 'ralenti', 'freeze', 'plante', 'chauffe', 'probleme', 'bug', 'lourd', 'diagnostic', 'diagnostique']],
      any: ['pourquoi', 'pc', 'ordi', 'jeu', 'comment', 'analyse'],
      base: 0.5,
    }),
    async run() {
      const { snapshot, top, problems } = await system.report();
      const net = await network.status();
      const heavy = top.slice(0, 3).map((entry) => `${entry.name} (${bytes(entry.memory)})`);
      const causes = [];
      if (snapshot.memory.percent >= 85) causes.push(`la RAM est a ${snapshot.memory.percent} %, Windows commence a swapper sur le disque`);
      if (snapshot.cpu.total >= 85) causes.push(`le CPU est a ${snapshot.cpu.total} %, quelque chose tourne a fond`);
      const fullDisk = snapshot.disks.find((disk) => disk.percent >= 90);
      if (fullDisk) causes.push(`le disque ${fullDisk.mount} est plein a ${fullDisk.percent} %, il ne reste que ${bytes(fullDisk.free)}`);
      if (snapshot.temperatures.some((entry) => entry.celsius >= 85)) causes.push('ca chauffe fort, le CPU se bride pour ne pas cramer');
      if (!net.online) causes.push('tu es hors ligne, tout ce qui dependrait du reseau va sembler fige');
      else if (net.ping !== null && net.ping > 120) causes.push(`ton ping est a ${net.ping} ms, la connexion traine`);

      const verdict = causes.length
        ? `Voila pourquoi : ${causes.join(', et ')}.`
        : "Rien d'anormal cote materiel : CPU, RAM, disque et reseau sont dans le vert.";
      const advice = [];
      if (snapshot.memory.percent >= 85 || snapshot.cpu.total >= 85) advice.push(`ferme ${top[0]?.name ?? 'le gros consommateur'} si tu ne t'en sers pas`);
      if (fullDisk) advice.push('lance un nettoyage des fichiers temporaires');
      if (!causes.length) advice.push("si ca rame quand meme, c'est plutot le jeu ou les pilotes GPU");

      return {
        say: [
          verdict,
          '',
          bullets([
            `CPU ${snapshot.cpu.total} % • RAM ${snapshot.memory.percent} % • ${problems.length ? problems.join(' • ') : 'aucune alerte'}`,
            `Les plus gourmands : ${heavy.join(', ')}`,
            advice.length ? `A faire : ${advice.join(', ')}` : null,
          ]),
        ].join('\n'),
        card: { type: 'diagnostic', data: { snapshot, top, problems } },
      };
    },
  },
  {
    id: 'processes',
    label: 'Processus',
    examples: ['qu est-ce qui tourne'],
    match: matcher({ all: [['processus', 'process', 'tache', 'taches', 'tourne', 'gourmand', 'bouffe']], any: ['quoi', 'liste', 'top', 'ram', 'cpu'] }),
    async run() {
      const top = await system.processes(8);
      return {
        say: bullets(top.map((entry) => `${entry.name} — ${bytes(entry.memory)} (pid ${entry.pid})`)),
        card: { type: 'processes', data: top },
      };
    },
  },
  {
    id: 'clean',
    label: 'Nettoyage',
    examples: ['nettoie mon PC'],
    match: matcher({ all: [['nettoie', 'nettoyer', 'nettoyage', 'clean', 'vide', 'libere', 'supprime']], any: ['temp', 'temporaires', 'cache', 'place', 'espace', 'pc', 'disque'] }),
    async run({ confirmed, requestConfirmation }) {
      const preview = await toolbox.cleanTemp({ dryRun: true });
      if (!confirmed) {
        return requestConfirmation(
          `J'ai trouve ${preview.files} elements temporaires, soit ${bytes(preview.bytes)}. Je supprime ? (oui / non)`,
          { skill: 'clean' },
        );
      }
      const result = await toolbox.cleanTemp({ dryRun: false });
      return { say: `Nettoye : ${result.files} elements supprimes, ${bytes(result.bytes)} recuperes.` };
    },
  },
  {
    id: 'network',
    label: 'Etat reseau',
    examples: ['ma connexion va bien ?'],
    match: matcher({
      all: [['internet', 'reseau', 'connexion', 'wifi', 'ping', 'ip', 'en ligne']],
      any: ['etat', 'marche', 'va', 'status', 'combien', 'mon'],
    }),
    async run() {
      const status = await network.status();
      return {
        say: bullets([
          status.online ? `En ligne — ping ${status.ping} ms` : 'Hors ligne, aucune reponse de 1.1.1.1',
          status.publicIp ? `IP publique ${status.publicIp}` : null,
          status.interfaces[0] ? `IP locale ${status.interfaces[0].address} (${status.interfaces[0].name})` : null,
          status.gateway ? `Passerelle ${status.gateway}` : null,
        ]),
        card: { type: 'network', data: status },
      };
    },
  },
  {
    id: 'speedtest',
    label: 'Test de debit',
    examples: ['teste mon debit'],
    match: matcher({ all: [['debit', 'speedtest', 'vitesse', 'download', 'upload', 'mb/s', 'megas']], any: ['test', 'teste', 'mesure', 'combien'] }),
    async run() {
      const result = await network.speedtest();
      return {
        say: `Descendant ${result.download ?? '?'} Mb/s, montant ${result.upload ?? '?'} Mb/s, ping ${result.ping ?? '?'} ms.`,
        card: { type: 'speedtest', data: result },
      };
    },
  },
  {
    id: 'devices',
    label: 'Appareils du reseau',
    examples: ['qui est connecte sur mon reseau'],
    match: matcher({ all: [['appareil', 'appareils', 'devices', 'machines', 'connecte', 'connectes', 'reseau local']], any: ['qui', 'liste', 'scan', 'montre'] }),
    async run() {
      const list = await network.devices({ deep: true });
      const online = list.filter((device) => device.online);
      return {
        say: [`${online.length} appareil(s) en ligne sur ton reseau :`, bullets(online.map((device) => `${device.name} — ${device.address}`))].join('\n'),
        card: { type: 'devices', data: list },
      };
    },
  },
  {
    id: 'password',
    label: 'Mot de passe',
    examples: ['genere un mot de passe de 24'],
    match: matcher({ all: [['mot de passe', 'mdp', 'password', 'passphrase']], any: ['genere', 'cree', 'fais', 'nouveau', 'fort'] }),
    run({ clause }) {
      const length = Number(/\b(\d{1,3})\b/.exec(normalize(clause))?.[1]) || 20;
      const result = toolbox.password({ length });
      return { say: `Voila : ${result.value}\n(force ${result.strength}/100, il est deja copiable depuis la carte)`, card: { type: 'password', data: result } };
    },
  },
  {
    id: 'weather',
    label: 'Meteo',
    examples: ['il fait quoi dehors'],
    match: matcher({ all: [['meteo', 'temps', 'pleut', 'neige', 'dehors', 'temperature exterieure']], any: ['quel', 'quoi', 'fait', 'demain', 'aujourd hui'] }),
    async run() {
      const now = await weather.current();
      return {
        say: `${now.icon} ${now.city} : ${now.temperature} C (ressenti ${now.feelsLike}), ${now.label.toLowerCase()}, vent ${now.wind} km/h.`,
        card: { type: 'weather', data: now },
      };
    },
  },
  {
    id: 'search',
    label: 'Recherche de fichiers',
    examples: ['trouve le fichier facture'],
    match: matcher({ all: [['cherche', 'chercher', 'trouve', 'trouver', 'recherche', 'ou est']], any: ['fichier', 'dossier', 'document', 'photo', 'video'] }),
    async run({ clause }) {
      const query = targetAfter(clause, ['cherche', 'chercher', 'trouve', 'trouver', 'recherche', 'ou est'])
        .replace(/^(le|la|les|un|une|mon|ma|mes)?\s*(fichier|dossier|document|photo|video)s?\s*/g, '')
        .trim();
      if (!query) return { say: 'Je cherche quoi exactement ?', ask: 'search-query' };
      const results = await toolbox.searchFiles({ query, limit: 20 });
      if (!results.length) return { say: `Rien trouve pour "${query}" dans ton dossier personnel.` };
      return {
        say: [`${results.length} resultat(s) pour "${query}" :`, bullets(results.slice(0, 6).map((entry) => entry.path))].join('\n'),
        card: { type: 'files', data: results },
      };
    },
  },
  {
    id: 'note',
    label: 'Prendre une note',
    examples: ['note : acheter un SSD'],
    match: matcher({ all: [['note', 'notes', 'rappelle', 'memo', 'bloc-notes']], any: ['prends', 'ecris', 'ajoute', 'moi'] }),
    run({ clause }) {
      const body = clause.replace(/^.*?\b(note|memo|rappelle[- ]moi|ecris)\b[\s:,-]*/i, '').trim();
      if (!body) {
        const list = toolbox.notes();
        return {
          say: list.length ? [`Tes ${list.length} notes :`, bullets(list.slice(0, 6).map((note) => note.title))].join('\n') : "Tu n'as aucune note.",
          card: { type: 'notes', data: list },
        };
      }
      const note = toolbox.saveNote({ title: body.slice(0, 40), body });
      return { say: `Note enregistree : "${note.title}".`, refresh: ['notes'] };
    },
  },
  {
    id: 'games',
    label: 'Jeux',
    examples: ['mes jeux', 'temps de jeu'],
    match: matcher({ all: [['jeu', 'jeux', 'game', 'games', 'steam', 'epic']], any: ['liste', 'mes', 'temps', 'joue', 'derniere', 'scan'] }),
    async run({ clause }) {
      if (hasAny(clause, ['scan', 'scanne', 'cherche', 'detecte'])) {
        const result = await games.scan();
        return { say: `Scan termine : ${result.found} jeux detectes, ${result.added} ajoutes a la bibliotheque.`, refresh: ['games'] };
      }
      const list = games.list();
      if (!list.length) return { say: "Ta bibliotheque de jeux est vide. Dis-moi \"scanne mes jeux\" et je regarde Steam et Epic." };
      const sorted = [...list].sort((a, b) => (b.playtime ?? 0) - (a.playtime ?? 0));
      return {
        say: bullets(sorted.slice(0, 6).map((game) => `${game.name} — ${playtime(game.playtime)}${game.lastLaunch ? `, dernier lancement ${new Date(game.lastLaunch).toLocaleDateString('fr-FR')}` : ''}`)),
        card: { type: 'games', data: sorted },
      };
    },
  },
  {
    id: 'apps',
    label: 'Applications',
    examples: ['mes applications'],
    match: matcher({ all: [['application', 'applications', 'apps', 'programmes', 'launcher', 'logiciels']], any: ['liste', 'mes', 'montre', 'quels'] }),
    run() {
      const list = apps.list();
      return {
        say: bullets(list.map((entry) => `${entry.icon} ${entry.name}${entry.target ? '' : ' (chemin a definir)'}`)),
        card: { type: 'apps', data: list },
      };
    },
  },
  {
    id: 'media',
    label: 'Media center',
    examples: ['mes films'],
    match: matcher({ all: [['film', 'films', 'serie', 'series', 'musique', 'media', 'album']], any: ['mes', 'liste', 'combien', 'joue', 'scan'] }),
    async run() {
      const library = await media.scan();
      return {
        say: `Bibliotheque : ${library.counts.movies} films, ${library.counts.episodes} episodes, ${library.counts.tracks} musiques.`,
        card: { type: 'media', data: library.counts },
      };
    },
  },
  {
    id: 'github',
    label: 'GitHub',
    examples: ['mes repos github'],
    match: matcher({ all: [['github', 'repo', 'repos', 'depot', 'commit', 'commits', 'pull request', 'pr']], any: ['mes', 'liste', 'dernier', 'derniers', 'notif'] }),
    async run({ clause }) {
      if (!github.connected()) return { say: 'Connecte-toi a GitHub depuis ton profil Velora OS et je te sors tes repos, commits et notifications.' };
      if (hasAny(clause, ['notif', 'notification', 'notifications'])) {
        const list = await github.notifications();
        return { say: list.length ? bullets(list.slice(0, 6).map((entry) => `${entry.repo} — ${entry.title}`)) : 'Aucune notification GitHub.', card: { type: 'github-notifications', data: list } };
      }
      if (hasAny(clause, ['commit', 'commits', 'activite'])) {
        const list = await github.activity();
        return { say: bullets(list.slice(0, 6).map((entry) => `${entry.type} sur ${entry.repo}`)), card: { type: 'github-activity', data: list } };
      }
      const list = await github.repos({ limit: 20 });
      return {
        say: bullets(list.slice(0, 8).map((repo) => `${repo.fullName}${repo.language ? ` (${repo.language})` : ''}`)),
        card: { type: 'github-repos', data: list },
      };
    },
  },
  {
    id: 'bots',
    label: 'Bots Discord (creer, heberger, piloter)',
    examples: ['fais-moi un bot Discord de moderation', 'demarre le bot', 'les logs du bot'],
    match: (text) => {
      if (!hasAny(text, ['bot', 'bots'])) return 0;
      if (hasAny(text, ['demarre', 'demarrer', 'lance', 'lancer', 'arrete', 'arreter', 'stop', 'redemarre', 'heberge', 'heberger', 'logs', 'log', 'en ligne'])) return 0.96;
      if (hasAny(text, ['fais', 'cree', 'creer', 'genere', 'generer', 'code', 'coder', 'ecris'])) return 0.94;
      if (hasAny(text, ['mes', 'liste', 'quels'])) return 0.8;
      return 0.5;
    },
    async run({ clause, original }) {
      const request = original || clause;
      const list = bots.list();
      const named = list.find((bot) => request.toLowerCase().includes(bot.name.toLowerCase()));

      if (hasAny(clause, ['fais', 'cree', 'creer', 'genere', 'generer', 'code', 'coder', 'ecris', 'nouveau'])) {
        const bot = await bots.create(request);
        return {
          say: [
            `${bot.name} est code dans ${bot.directory}.`,
            "Il me manque son token : colle-le dans Bots, j'installe les dependances et je l'heberge.",
          ].join('\n'),
          card: { type: 'bot', data: bot },
          refresh: ['bots'],
        };
      }

      const target = named ?? list[0];
      if (!target) return { say: "Tu n'as pas encore de bot. Dis-moi \"fais-moi un bot Discord\" et je le code." };

      if (hasAny(clause, ['arrete', 'arreter', 'stop', 'coupe'])) {
        const bot = bots.stop(target.id);
        return { say: `${bot.name} est arrete.`, card: { type: 'bot', data: bot }, refresh: ['bots'] };
      }
      if (hasAny(clause, ['redemarre', 'redemarrer', 'relance'])) {
        const bot = await bots.restart(target.id);
        return { say: `${bot.name} redemarre.`, card: { type: 'bot', data: bot }, refresh: ['bots'] };
      }
      if (hasAny(clause, ['logs', 'log'])) {
        const lines = bots.logs(target.id).slice(-8).map((entry) => entry.line);
        return {
          say: lines.length ? bullets(lines) : `${target.name} n'a encore rien affiche.`,
          card: { type: 'bot', data: target },
        };
      }
      if (hasAny(clause, ['demarre', 'demarrer', 'lance', 'lancer', 'heberge', 'heberger', 'allume'])) {
        if (!target.hasToken) return { say: `${target.name} n'a pas de token : colle-le dans Bots et je le demarre.` };
        const bot = bots.start(target.id);
        return { say: `${bot.name} tourne (PID ${bot.pid}), je te remonte ses logs dans Bots.`, card: { type: 'bot', data: bot }, refresh: ['bots'] };
      }
      return {
        say: bullets(list.map((bot) => `${bot.name} — ${bot.status === 'running' ? 'en ligne' : 'arrete'}`)),
        card: { type: 'bots', data: list },
      };
    },
  },
  {
    id: 'studio',
    label: 'Velora Studio (coder un projet)',
    examples: ['code-moi un site vitrine', 'fais-moi un bot Discord'],
    match: (text) => {
      const wantsCode = hasAny(text, ['code', 'coder', 'codes', 'programme', 'script', 'developpe', 'developper']);
      const wantsCreate = hasAny(text, ['fais', 'fais-moi', 'cree', 'creer', 'genere', 'generer', 'construis', 'ecris']);
      const artefact = hasAny(text, ['site', 'page', 'app', 'application', 'bot', 'api', 'jeu', 'script', 'programme', 'scraper', 'sauvegarde', 'todo', 'portfolio', 'projet']);
      if (wantsCode && artefact) return 0.95;
      if (wantsCode) return 0.7;
      if (wantsCreate && artefact) return 0.8;
      return 0;
    },
    async run({ clause, original }) {
      const project = await studio.generate(original || clause);
      return {
        say: [
          `${project.name} est code : ${project.kindLabel}, ${project.files.length} fichiers dans ${project.directory}.`,
          `Pour le lancer : ${project.run}`,
        ].join('\n'),
        card: { type: 'project', data: project },
        refresh: ['projects'],
      };
    },
  },
  {
    id: 'teach',
    label: 'Apprendre une commande',
    examples: ['quand je dis game time, lance Minecraft'],
    match: matcher({ all: [['apprends', 'retiens', 'quand je dis', 'souviens']], base: 0.6 }),
    run({ clause }) {
      const pattern = /(?:quand je dis|si je dis)\s+"?([^",]+)"?[, ]+(?:tu|fais|alors)?\s*(.+)/i.exec(clause);
      if (!pattern) return { say: 'Formule-le comme ca : "quand je dis game time, lance Minecraft".' };
      const [, phrase, command] = pattern;
      store.update((state) => {
        state.learned = [
          { phrase: phrase.trim(), command: command.trim(), createdAt: Date.now() },
          ...(state.learned ?? []).filter((entry) => entry.phrase !== phrase.trim()),
        ].slice(0, 100);
        return true;
      });
      return { say: `Retenu : "${phrase.trim()}" declenchera "${command.trim()}".` };
    },
  },
  {
    id: 'open-folder',
    label: 'Ouvrir un dossier',
    examples: ['ouvre le dossier telechargements'],
    match: matcher({ all: [['dossier', 'repertoire', 'explorateur', 'folder']], any: ['ouvre', 'montre', 'affiche'] }),
    async run({ clause }) {
      const known = {
        telechargement: app.getPath('downloads'),
        telechargements: app.getPath('downloads'),
        downloads: app.getPath('downloads'),
        bureau: app.getPath('desktop'),
        desktop: app.getPath('desktop'),
        documents: app.getPath('documents'),
        images: app.getPath('pictures'),
        photos: app.getPath('pictures'),
        musique: app.getPath('music'),
        videos: app.getPath('videos'),
        studio: studio.studioRoot(),
      };
      const found = Object.entries(known).find(([key]) => wordIn(clause, key));
      const target = found ? found[1] : path.join(os.homedir());
      await shell.openPath(target);
      return { say: `Dossier ouvert : ${target}` };
    },
  },
  {
    id: 'power',
    label: 'Arret / redemarrage',
    examples: ['eteins le PC'],
    match: matcher({ all: [['eteins', 'eteindre', 'redemarre', 'redemarrer', 'veille', 'verrouille', 'shutdown', 'reboot']], base: 0.6 }),
    async run({ clause, confirmed, requestConfirmation }) {
      const action = hasAny(clause, ['redemarre', 'redemarrer', 'reboot'])
        ? 'restart'
        : hasAny(clause, ['veille', 'sleep'])
          ? 'sleep'
          : hasAny(clause, ['verrouille', 'lock'])
            ? 'lock'
            : 'shutdown';
      if (action !== 'lock' && !confirmed) {
        const labels = { restart: 'redemarrer', sleep: 'mettre en veille', shutdown: 'eteindre' };
        return requestConfirmation(`Je confirme : je dois ${labels[action]} le PC ? (oui / non)`, { skill: 'power', action });
      }
      const { run: exec, IS_WIN } = require('../lib/run.cjs');
      const commands = IS_WIN
        ? {
            shutdown: ['shutdown', ['/s', '/t', '5']],
            restart: ['shutdown', ['/r', '/t', '5']],
            lock: ['rundll32.exe', ['user32.dll,LockWorkStation']],
            sleep: ['rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']],
          }
        : {
            shutdown: ['systemctl', ['poweroff']],
            restart: ['systemctl', ['reboot']],
            lock: ['loginctl', ['lock-session']],
            sleep: ['systemctl', ['suspend']],
          };
      const [command, args] = commands[action];
      const result = await exec(command, args);
      if (!result.ok) throw new Error(result.stderr.trim() || "L'action a ete refusee par le systeme.");
      return { say: action === 'lock' ? 'Session verrouillee.' : 'Ordre envoye au systeme.' };
    },
  },
];

module.exports = { skills, targetAfter, LAUNCH_VERBS, CLOSE_VERBS, similarity };
