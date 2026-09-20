import Link from "next/link";
import { getSession } from "../../../lib/session";
import { botJson } from "../../../lib/bot-api";
import GuildManager from "./GuildManager";
export default async function GuildDashboard({ params }: { params: { guildId: string } }) {
  const session = await getSession();
  if (!session || !session.guilds.some((guild) => guild.id === params.guildId))
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold">Accès refusé</h1>
        <Link href="/dashboard" className="mt-6 inline-block text-violet-300">
          Retour
        </Link>
      </main>
    );
  const data = await botJson<{ channels: unknown[]; roles: unknown[] }>(
    `/guilds/${params.guildId}`,
  );
  const stats = await botJson<{ memberCount: number; warnsCount: number; ticketsCount: number }>(
    `/guilds/${params.guildId}/stats`,
  );
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/dashboard" className="text-sm text-slate-400">
        ← Serveurs
      </Link>
      <h1 className="mt-5 text-4xl font-black">Dashboard du serveur</h1>
      {!data ? (
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          Le bot est hors ligne. Réessayez plus tard.
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Membres", stats?.memberCount ?? 0],
              ["Avertissements", stats?.warnsCount ?? 0],
              ["Tickets ouverts", stats?.ticketsCount ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border bg-white/[.03] p-5">
                <div className="text-sm text-slate-400">{label}</div>
                <div className="mt-2 text-3xl font-black">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {["Bienvenue", "Tickets", "Automod", "Niveaux", "Logs", "Twitch", "Autorole"].map(
              (title) => (
                <section key={title} className="rounded-2xl border bg-white/[.03] p-6">
                  <h2 className="text-xl font-bold">{title}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Configuration disponible via l'API Mr. Robot.
                  </p>
                </section>
              ),
            )}
          </div>
          <GuildManager guildId={params.guildId} />
        </>
      )}
    </main>
  );
}
