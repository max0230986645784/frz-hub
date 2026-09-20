"use client";
import { useMemo, useState } from "react";
import { commands } from "../../lib/commands";
export default function CommandsPage() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      commands.filter((c) =>
        `${c.name} ${c.description} ${c.category}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-4xl font-black">Commandes</h1>
      <p className="mt-3 text-slate-400">Toutes les commandes françaises de Mr. Robot.</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher une commande..."
        className="mt-8 w-full rounded-xl border bg-white/5 px-4 py-3 outline-none focus:border-violet-400"
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((command) => (
          <article key={command.name} className="rounded-xl border bg-white/[.03] p-5">
            <div className="text-violet-300">/{command.name}</div>
            <p className="mt-2 text-sm text-slate-300">{command.description}</p>
            <div className="mt-4 text-xs text-slate-500">{command.category}</div>
          </article>
        ))}
      </div>
    </main>
  );
}
