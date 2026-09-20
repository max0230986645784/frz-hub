# Mr. Robot — Dashboard

Dashboard Next.js 14 en français pour administrer Mr. Robot.

## Déploiement Vercel

Importez le dépôt sur Vercel et choisissez `discord-site` comme **Root Directory**. Ajoutez les variables de `.env.example`, puis déployez. Dans Discord Developer Portal, ajoutez `https://<projet>.vercel.app/api/auth/callback` comme redirect URI OAuth2.

`BOT_API_URL` et `BOT_API_SECRET` ne sont jamais exposés au navigateur : les routes serveur proxyfient les changements vers l'API du bot. Si l'API est indisponible, le dashboard affiche « Le bot est hors ligne ».
