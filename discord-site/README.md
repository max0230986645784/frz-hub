# Mr. Robot — Dashboard

Dashboard Next.js 14 en français pour administrer Mr. Robot.

## Déploiement Vercel

Importez le dépôt sur Vercel et choisissez `discord-site` comme **Root Directory**. Ajoutez les variables de `.env.example`, puis déployez. Dans Discord Developer Portal, ajoutez `https://<projet>.vercel.app/api/auth/callback` comme redirect URI OAuth2.

Générez `SESSION_SECRET` avec `openssl rand -hex 32` et utilisez une valeur d'au moins 32 caractères. `BOT_API_URL` et `BOT_API_SECRET` ne sont jamais exposés au navigateur : `BOT_API_SECRET` est un secret serveur-à-serveur qui ne doit jamais être exposé ou préfixé par `NEXT_PUBLIC_`. Les routes serveur proxyfient les changements vers l'API du bot. Si l'API est indisponible, le dashboard affiche « Le bot est hors ligne ».
