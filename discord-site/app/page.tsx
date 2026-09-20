import Link from "next/link";
import { commands } from "../lib/commands";
const features = [
  ["🎫", "Tickets complets", "Catégories, rôles support, réclamation et transcripts HTML."],
  ["📡", "Twitch en direct", "Alertes Helix, rôles live et planning de streams."],
  ["🛡️", "Anti-raid & automod", "Invitations, liens, spam, mots interdits et lockdown."],
  ["🔊", "Vocaux temporaires", "Chaque membre obtient son espace vocal privé."],
  ["📈", "Niveaux & économie", "XP, récompenses, daily, travail et classements."],
  ["⚙️", "Dashboard Vercel", "Configurez tout votre serveur depuis une interface moderne."],
];
export default function Home() {
  const invite = `https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? ""}&scope=bot%20applications.commands&permissions=8`;
  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-28 text-center">
        <div className="mx-auto mb-6 w-fit rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm text-violet-300">
          Le bot français pensé pour le streaming
        </div>
        <h1 className="text-5xl font-black tracking-tight md:text-7xl">
          Bienvenue sur <span className="text-violet-400">Mr. Robot</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Tout ce qu'il faut pour faire grandir, protéger et animer votre serveur Discord. Puissant,
          élégant et entièrement en français.
        </p>
        <div className="mt-9 flex justify-center gap-4">
          <a
            href={invite}
            className="rounded-xl bg-violet-600 px-6 py-3 font-bold hover:bg-violet-500"
          >
            Ajouter à Discord
          </a>
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/15 px-6 py-3 font-bold hover:bg-white/5"
          >
            Dashboard
          </Link>
        </div>
        <div className="mt-8 text-sm text-slate-500">
          {commands.length}+ commandes · JSON local · Déployable partout
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 md:grid-cols-3">
        {features.map(([icon, title, text]) => (
          <article key={title} className="rounded-2xl border bg-white/[.03] p-6">
            <div className="text-3xl">{icon}</div>
            <h2 className="mt-4 text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
          </article>
        ))}
      </section>
      <section className="mx-auto mt-24 max-w-6xl rounded-3xl border border-violet-500/20 bg-violet-500/5 px-8 py-12">
        <h2 className="text-3xl font-black">Pourquoi mieux que DraftBot ?</h2>
        <p className="mt-4 max-w-3xl leading-7 text-slate-300">
          Transcripts HTML et TXT envoyés en DM, vocaux temporaires, notifications Twitch fiables,
          anti-raid configurable, dashboard complet et données JSON simples à héberger. Mr. Robot
          reste lisible et personnalisable.
        </p>
      </section>
    </main>
  );
}
