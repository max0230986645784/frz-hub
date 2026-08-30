/**
 * Code generators of Velora Studio. Each blueprint returns the real files to write
 * on disk, so a request always produces a runnable project, never a refusal.
 */

const PALETTE = {
  bg: '#0b0b16',
  card: '#151429',
  blue: '#6aa9ff',
  red: '#ff6b81',
  violet: '#a98cff',
  pastel: '#c9d7ff',
  white: '#f4f6ff',
};

function slug(name) {
  return (
    String(name || 'projet-frz')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'projet-frz'
  );
}

function readme(name, description, run) {
  return `# ${name}

${description}

Genere par Velora Studio (cerveau Velora OS).

## Lancer

\`\`\`bash
${run}
\`\`\`
`;
}

const website = ({ name, title, description, sections }) => {
  const nav = sections.map((section) => `        <a href="#${slug(section)}">${section}</a>`).join('\n');
  const blocks = sections
    .map(
      (section, index) => `      <section id="${slug(section)}" class="card reveal" style="--delay:${index * 80}ms">
        <h2>${section}</h2>
        <p>Contenu de la section ${section.toLowerCase()}. Remplace ce texte par le tien.</p>
      </section>`,
    )
    .join('\n');
  return {
    files: {
      'index.html': `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header class="hero">
      <nav>
        <span class="brand">${title}</span>
${nav}
      </nav>
      <h1>${title}</h1>
      <p>${description}</p>
      <a class="cta" href="#${slug(sections[0] ?? 'contact')}">Decouvrir</a>
    </header>
    <main>
${blocks}
    </main>
    <footer>© ${new Date().getFullYear()} ${title} — genere par Velora Studio</footer>
    <script src="script.js"></script>
  </body>
</html>
`,
      'style.css': `:root {
  --bg: ${PALETTE.bg};
  --card: ${PALETTE.card};
  --blue: ${PALETTE.blue};
  --red: ${PALETTE.red};
  --violet: ${PALETTE.violet};
  --text: ${PALETTE.white};
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: radial-gradient(1200px 600px at 20% -10%, #22204a, var(--bg));
  color: var(--text);
}
nav { display: flex; gap: 18px; align-items: center; padding: 22px 6vw; }
nav a { color: var(--pastel, #c9d7ff); text-decoration: none; opacity: .8; }
nav a:hover { opacity: 1; color: var(--blue); }
.brand { font-weight: 700; margin-right: auto; }
.hero { padding-bottom: 60px; text-align: center; }
.hero h1 { font-size: clamp(32px, 6vw, 64px); margin: 40px 0 12px; }
.hero p { opacity: .75; max-width: 620px; margin: 0 auto; }
.cta {
  display: inline-block; margin-top: 28px; padding: 14px 28px; border-radius: 999px;
  background: linear-gradient(120deg, var(--violet), var(--blue)); color: #0b0b16;
  font-weight: 700; text-decoration: none;
}
main { display: grid; gap: 22px; padding: 0 6vw 80px; }
.card {
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  border-radius: 22px; padding: 28px; backdrop-filter: blur(12px);
}
.reveal { opacity: 0; transform: translateY(18px); animation: rise .6s var(--delay) forwards; }
@keyframes rise { to { opacity: 1; transform: none; } }
footer { text-align: center; padding: 30px; opacity: .5; }
`,
      'script.js': `document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelector(link.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
  });
});
`,
      'README.md': readme(name, description, 'ouvre index.html dans ton navigateur'),
    },
    run: 'Ouvre index.html',
  };
};

const reactApp = ({ name, title, description }) => ({
  files: {
    'package.json': JSON.stringify(
      {
        name: slug(name),
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { react: '^19.2.8', 'react-dom': '^19.2.8' },
        devDependencies: { '@vitejs/plugin-react': '^6.0.4', vite: '^8.2.0' },
      },
      null,
      2,
    ),
    'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
`,
    'index.html': `<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8" /><title>${title}</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
`,
    'src/main.jsx': `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './style.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
    'src/App.jsx': `import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  return (
    <main className="app">
      <h1>${title}</h1>
      <p>${description}</p>
      <button onClick={() => setCount((value) => value + 1)}>Clics : {count}</button>
    </main>
  )
}
`,
    'src/style.css': `body { margin: 0; background: ${PALETTE.bg}; color: ${PALETTE.white}; font-family: system-ui, sans-serif; }
.app { min-height: 100vh; display: grid; place-content: center; gap: 16px; text-align: center; }
button {
  border: 0; border-radius: 999px; padding: 12px 24px; font-weight: 700; cursor: pointer;
  background: linear-gradient(120deg, ${PALETTE.violet}, ${PALETTE.blue}); color: ${PALETTE.bg};
}
`,
    'README.md': readme(name, description, 'npm install\nnpm run dev'),
  },
  run: 'npm install puis npm run dev',
});

const pythonScript = ({ name, description, task }) => ({
  files: {
    'main.py': `"""${name} — ${description}

Genere par Velora Studio.
"""

import argparse
from pathlib import Path


def run(target: Path, dry_run: bool) -> int:
    """${task}"""
    count = 0
    for item in sorted(target.iterdir()):
        print(("[dry-run] " if dry_run else "") + str(item))
        count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="${description}")
    parser.add_argument("target", nargs="?", default=".", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    total = run(args.target, args.dry_run)
    print(f"Termine : {total} element(s).")


if __name__ == "__main__":
    main()
`,
    'README.md': readme(name, description, 'python main.py'),
  },
  run: 'python main.py',
});

const discordBot = ({ name, description }) => ({
  files: {
    'package.json': JSON.stringify(
      {
        name: slug(name),
        private: true,
        type: 'module',
        scripts: { start: 'node index.js' },
        dependencies: { 'discord.js': '^14.16.3' },
      },
      null,
      2,
    ),
    'index.js': `import { Client, Events, GatewayIntentBits } from 'discord.js'

// Le token n'est jamais ecrit dans le code : mets-le dans .env
const token = process.env.DISCORD_TOKEN
if (!token) throw new Error('DISCORD_TOKEN manquant (voir .env.example)')

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

const commands = {
  ping: () => 'Pong',
  aide: () => 'Commandes : ' + Object.keys(commands).map((name) => '!' + name).join(', '),
}

client.once(Events.ClientReady, (bot) => console.log('Connecte comme ' + bot.user.tag))

client.on(Events.MessageCreate, (message) => {
  if (message.author.bot || !message.content.startsWith('!')) return
  const [name, ...args] = message.content.slice(1).split(/\\s+/)
  const handler = commands[name.toLowerCase()]
  if (handler) message.reply(handler(args, message))
})

client.login(token)
`,
    '.env.example': 'DISCORD_TOKEN=colle-ton-token-ici\n',
    'README.md': readme(name, description, 'npm install\nnode --env-file=.env index.js'),
  },
  run: 'npm install puis node --env-file=.env index.js',
});

const expressApi = ({ name, description }) => ({
  files: {
    'package.json': JSON.stringify(
      {
        name: slug(name),
        private: true,
        type: 'module',
        scripts: { start: 'node server.js' },
        dependencies: { express: '^4.21.2' },
      },
      null,
      2,
    ),
    'server.js': `import express from 'express'

const app = express()
app.use(express.json())

const items = []

app.get('/api/health', (request, response) => response.json({ ok: true, service: '${name}' }))

app.get('/api/items', (request, response) => response.json(items))

app.post('/api/items', (request, response) => {
  const item = { id: items.length + 1, ...request.body, createdAt: Date.now() }
  items.push(item)
  response.status(201).json(item)
})

const port = process.env.PORT ?? 3000
app.listen(port, () => console.log('API ${name} sur http://localhost:' + port))
`,
    'README.md': readme(name, description, 'npm install\nnpm start'),
  },
  run: 'npm install puis npm start',
});

const batchScript = ({ name, description, task }) => ({
  files: {
    [`${slug(name)}.bat`]: `@echo off
REM ${description}
REM ${task}
setlocal
echo [FRZ] Demarrage de ${name}...

REM --- ecris tes commandes ici ---
echo Rien a faire pour l'instant.

echo [FRZ] Termine.
pause
`,
    'README.md': readme(name, description, `${slug(name)}.bat`),
  },
  run: `Double-clique sur ${slug(name)}.bat`,
});

const backupScript = ({ name, description }) => ({
  files: {
    'backup.py': `"""${description}

Copie un dossier vers une destination horodatee, en ignorant les caches.
"""

import shutil
import sys
from datetime import datetime
from pathlib import Path

IGNORED = shutil.ignore_patterns("node_modules", "__pycache__", "*.tmp", ".git")


def backup(source: Path, destination: Path) -> Path:
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    target = destination / f"{source.name}_{stamp}"
    shutil.copytree(source, target, ignore=IGNORED, dirs_exist_ok=True)
    return target


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python backup.py <source> <destination>")
        raise SystemExit(1)
    result = backup(Path(sys.argv[1]), Path(sys.argv[2]))
    print(f"Sauvegarde creee : {result}")
`,
    'README.md': readme(name, description, 'python backup.py C:\\dossier D:\\sauvegardes'),
  },
  run: 'python backup.py <source> <destination>',
});

const canvasGame = ({ name, title, description }) => ({
  files: {
    'index.html': `<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8" /><title>${title}</title><link rel="stylesheet" href="style.css" /></head>
  <body>
    <canvas id="game" width="800" height="500"></canvas>
    <p class="hint">Fleches ou ZQSD pour bouger — ${description}</p>
    <script src="game.js"></script>
  </body>
</html>
`,
    'style.css': `body { margin: 0; min-height: 100vh; display: grid; place-content: center; gap: 12px; background: ${PALETTE.bg}; color: ${PALETTE.white}; font-family: system-ui, sans-serif; }
canvas { border-radius: 18px; border: 1px solid rgba(255,255,255,.12); background: #10102a; }
.hint { text-align: center; opacity: .6; }
`,
    'game.js': `const canvas = document.getElementById('game')
const context = canvas.getContext('2d')
const player = { x: 400, y: 250, size: 22, speed: 4 }
const keys = new Set()

addEventListener('keydown', (event) => keys.add(event.key.toLowerCase()))
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()))

function update() {
  if (keys.has('arrowleft') || keys.has('q')) player.x -= player.speed
  if (keys.has('arrowright') || keys.has('d')) player.x += player.speed
  if (keys.has('arrowup') || keys.has('z')) player.y -= player.speed
  if (keys.has('arrowdown') || keys.has('s')) player.y += player.speed
  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x))
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y))
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height)
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '${PALETTE.violet}')
  gradient.addColorStop(1, '${PALETTE.blue}')
  context.fillStyle = gradient
  context.beginPath()
  context.arc(player.x, player.y, player.size, 0, Math.PI * 2)
  context.fill()
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}

loop()
`,
    'README.md': readme(name, description, 'ouvre index.html'),
  },
  run: 'Ouvre index.html',
});

const todoApp = ({ name, title, description }) => ({
  files: {
    'index.html': `<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8" /><title>${title}</title><link rel="stylesheet" href="style.css" /></head>
  <body>
    <main>
      <h1>${title}</h1>
      <form id="form"><input id="input" placeholder="Nouvelle tache" autocomplete="off" /><button>Ajouter</button></form>
      <ul id="list"></ul>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
    'style.css': `body { margin: 0; min-height: 100vh; background: ${PALETTE.bg}; color: ${PALETTE.white}; font-family: system-ui, sans-serif; display: grid; place-items: center; }
main { width: min(520px, 92vw); background: ${PALETTE.card}; border-radius: 20px; padding: 28px; }
form { display: flex; gap: 10px; }
input { flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.12); background: #0f0f22; color: inherit; }
button { border: 0; border-radius: 12px; padding: 12px 18px; font-weight: 700; cursor: pointer; background: ${PALETTE.violet}; color: ${PALETTE.bg}; }
ul { list-style: none; padding: 0; margin-top: 18px; display: grid; gap: 8px; }
li { display: flex; gap: 10px; align-items: center; padding: 12px; border-radius: 12px; background: rgba(255,255,255,.04); }
li.done span { opacity: .45; text-decoration: line-through; }
`,
    'app.js': `const list = document.getElementById('list')
const form = document.getElementById('form')
const input = document.getElementById('input')
let todos = JSON.parse(localStorage.getItem('frz-todos') ?? '[]')

function save() {
  localStorage.setItem('frz-todos', JSON.stringify(todos))
  render()
}

function render() {
  list.innerHTML = ''
  todos.forEach((todo, index) => {
    const item = document.createElement('li')
    item.className = todo.done ? 'done' : ''
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = todo.done
    checkbox.onchange = () => { todos[index].done = checkbox.checked; save() }
    const label = document.createElement('span')
    label.textContent = todo.text
    const remove = document.createElement('button')
    remove.textContent = '✕'
    remove.onclick = () => { todos.splice(index, 1); save() }
    item.append(checkbox, label, remove)
    list.append(item)
  })
}

form.onsubmit = (event) => {
  event.preventDefault()
  if (!input.value.trim()) return
  todos.push({ text: input.value.trim(), done: false })
  input.value = ''
  save()
}

render()
`,
    'README.md': readme(name, description, 'ouvre index.html'),
  },
  run: 'Ouvre index.html',
});

const scraper = ({ name, description }) => ({
  files: {
    'scraper.py': `"""${description}

Recupere une page et extrait les titres. Depend de requests + beautifulsoup4.
"""

import sys

import requests
from bs4 import BeautifulSoup


def scrape(url: str) -> list[str]:
    response = requests.get(url, timeout=15, headers={"User-Agent": "FRZ-Studio/1.0"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    return [tag.get_text(strip=True) for tag in soup.select("h1, h2, h3") if tag.get_text(strip=True)]


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"
    for title in scrape(target):
        print("-", title)
`,
    'requirements.txt': 'requests>=2.32\nbeautifulsoup4>=4.12\n',
    'README.md': readme(name, description, 'pip install -r requirements.txt\npython scraper.py https://site.com'),
  },
  run: 'pip install -r requirements.txt puis python scraper.py <url>',
});

const genericProject = ({ name, description, request, language }) => {
  const isPython = language === 'python';
  const entry = isPython ? 'main.py' : 'index.js';
  const body = isPython
    ? `"""${name}

Demande d'origine : ${request}
"""


def main() -> None:
    # TODO: ${description}
    print("${name} : squelette genere par Velora Studio, a completer.")


if __name__ == "__main__":
    main()
`
    : `// ${name}
// Demande d'origine : ${request}

function main() {
  // TODO: ${description}
  console.log('${name} : squelette genere par Velora Studio, a completer.')
}

main()
`;
  return {
    files: {
      [entry]: body,
      'NOTES.md': `# ${name}

Demande : ${request}

Velora Studio n'a pas encore de modele exact pour cette demande, il a donc pose la
base la plus proche. Etapes proposees :

1. Preciser le comportement attendu (entrees / sorties).
2. Completer le TODO de ${entry}.
3. Redemander a Velora AI en donnant plus de details (langage, librairies, format).
`,
      'README.md': readme(name, description, isPython ? 'python main.py' : 'node index.js'),
    },
    run: isPython ? 'python main.py' : 'node index.js',
  };
};

const BLUEPRINTS = [
  { id: 'website', label: 'Site vitrine', keywords: ['site', 'website', 'vitrine', 'landing', 'page web', 'portfolio'], build: website },
  { id: 'react', label: 'Application React', keywords: ['react', 'vite', 'spa', 'application web', 'webapp', 'dashboard web'], build: reactApp },
  { id: 'todo', label: 'To-do list', keywords: ['todo', 'to-do', 'taches', 'liste de taches', 'checklist'], build: todoApp },
  { id: 'game', label: 'Mini jeu canvas', keywords: ['jeu', 'game', 'canvas', 'mini-jeu'], build: canvasGame },
  { id: 'discord', label: 'Bot Discord', keywords: ['discord', 'bot discord', 'bot'], build: discordBot },
  { id: 'api', label: 'API Express', keywords: ['api', 'express', 'serveur', 'server', 'backend', 'rest'], build: expressApi },
  { id: 'scraper', label: 'Scraper Python', keywords: ['scraper', 'scraping', 'crawler', 'extraire un site'], build: scraper },
  { id: 'backup', label: 'Script de sauvegarde', keywords: ['sauvegarde', 'backup', 'copier mes fichiers'], build: backupScript },
  { id: 'batch', label: 'Script Windows .bat', keywords: ['bat', 'batch', 'cmd', 'script windows'], build: batchScript },
  { id: 'python', label: 'Script Python', keywords: ['python', 'script py', 'automatiser'], build: pythonScript },
];

module.exports = { BLUEPRINTS, genericProject, slug, PALETTE };
