# Velora OS

Centre de controle du PC : dashboard, launcher, Game Center, Media Center, outils, reseau, GitHub et l'agent **Velora AI** (cerveau 100% local, aucun modele externe).

## Stack

- Electron (processus principal en CommonJS, `electron/`)
- React 19 + TypeScript + Vite (renderer, `src/`)
- IPC unique et liste blanche de canaux (`electron/ipc.cjs`, `electron/preload.cjs`)

## Developpement

```bash
npm install
npm run build        # tsc -b + vite build
npm run lint         # oxlint
npm run desktop      # build + lance Electron
npm run desktop:dev  # Electron sur le serveur Vite (npm run dev en parallele)
```

Node.js 20.19+ ou 22.12+ est requis par Vite 7.

## Installeur Windows

```bash
npm run dist:win     # NSIS -> release/Velora-OS-Setup-<version>.exe
```

## Modules

| Module | Contenu |
| --- | --- |
| Dashboard | heure, meteo, CPU/RAM/GPU, reseau, lancements recents, jeux favoris |
| Launcher | projets et programmes, ajout de `.exe`/`.bat`/`.py`, scan du PC |
| Velora AI | comprehension du francais, actions locales, memoire, commandes apprises |
| Velora Studio | generation de vrais projets sur le disque a partir de blueprints locaux |
| Bots | Velora IA code le bot Discord, l'heberge, le relance, montre ses logs |
| Montage | timeline de clips, decoupe, concat, musique, export ffmpeg |
| Game Center | scan Steam/Epic/Rockstar/FiveM/Battle.net, lancement, temps de jeu, favoris |
| Media Center | films, series, musique, posters locaux, lecteur plein ecran avec reprise |
| Tools | conversion video/audio/image, PDF, archives, nettoyage, mots de passe, notes |
| Network | appareils du reseau local, ping, IP publique, test de debit |
| GitHub | depots, activite, PR, notifications, clone |
| Comptes | compte local, GitHub, Discord et TikTok en QR code (ou navigateur pour Discord) |

Les tokens OAuth et les tokens de bots sont chiffres avec `safeStorage` quand la plateforme le permet.

## Bots Discord heberges par Velora

Velora Studio ecrit le bot, `bots:install` installe ses dependances, puis Velora le lance avec le
Node embarque d'Electron (`ELECTRON_RUN_AS_NODE`) : pas besoin d'installer Node sur le PC. Le token
n'existe que chiffre sur le disque et n'est injecte que dans l'environnement du processus enfant.
Les bots marques `autostart` demarrent avec Velora et sont tous arretes a la fermeture.

## Connexion par QR code

Les trois providers affichent un QR code sur l'ecran de connexion :

- TikTok : Login Kit for Desktop (`get_qrcode` + `check_qrcode`), scan avec l'app TikTok.
- GitHub : device flow, le QR encode `verification_uri_complete` (le code est pre-rempli).
- Discord : le QR encode la page d'autorisation avec un `redirect_uri` pointant sur l'IP locale du
  PC, donc le telephone approuve et la redirection revient sur Velora (meme Wi-Fi requis, et l'URI
  affichee sous le QR doit etre ajoutee une fois dans les redirects de l'app Discord).

Si les identifiants d'app manquent, le bouton ouvre un panneau de configuration (lien vers le
portail + champs a coller) au lieu d'echouer avec un simple message.

## Connexion TikTok (QR code)

Velora utilise le Login Kit for Desktop de TikTok (`get_qrcode` + `check_qrcode`) : le QR s'affiche
dans l'ecran de connexion, tu le scannes avec l'app TikTok et tu approuves, puis la photo TikTok
devient l'avatar du compte.

Prerequis : creer une app sur developers.tiktok.com avec le produit Login Kit (scopes
`user.info.basic`, `user.info.profile`), puis coller le Client Key et le Client Secret dans
Reglages > Integrations. Le secret est stocke chiffre et n'est jamais renvoye au renderer.
