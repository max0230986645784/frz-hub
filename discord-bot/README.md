# Mr. Robot

Mr. Robot est un bot Discord français complet pour les communautés de streaming : tickets avec transcripts, modération, niveaux, automod, alertes Twitch, économie, giveaways et configuration de serveur.

## Installation

1. Créez une application sur [Discord Developer Portal](https://discord.com/developers/applications), ajoutez un bot et activez les trois **Privileged Gateway Intents** (présence, membres, contenu des messages).
2. Invitez-le avec les scopes `bot` et `applications.commands` et la permission Administrator.
3. Copiez `.env.example` vers `.env`, puis renseignez `DISCORD_TOKEN`, `CLIENT_ID`, éventuellement `DEV_GUILD_ID`, `API_SECRET`, `OWNER_IDS` (identifiants Discord séparés par des virgules), et les identifiants Twitch.
4. Lancez `npm install`, `npm run deploy`, puis `npm start`.

Les données sont écrites en JSON dans `data/` (un fichier par serveur). Le dossier est ignoré par Git.

Si `OWNER_IDS` est défini, les commandes d'administration sont réservées aux propriétaires indiqués. La liste peut aussi être gérée par `/mr-robot proprietaires ajouter`, `retirer` et `liste`; elle est conservée dans `config/owners.json`. L'API protégée expose cette liste via `GET /owners`.

## Hébergement

Le bot tourne sur un VPS avec `pm2`, Railway ou Render. Exemple VPS : `pm2 start src/index.js --name mr-robot`. L'API Express écoute `API_PORT` et est protégée par `Authorization: Bearer API_SECRET`. Le dashboard Next.js utilise cette API côté serveur uniquement.

## Commandes

Les commandes sont organisées en français : tickets, salons, catégories, vocaux temporaires, modération (ban, unban, warn, unwarn, nuke, purge de liens), automod, bienvenue, niveaux et XP, logs complets, streaming/Twitch, communauté (giveaways persistants), économie, invitations et suivi des inviteurs, rôles avec mots-clés, membres, anti-raid, `/setup` et `/mr-robot` (infos, statut, config, installation, jeux et annonces).
