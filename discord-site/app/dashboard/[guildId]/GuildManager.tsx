"use client";
import { useEffect, useState } from "react";
type Member = { id: string; tag: string; roles: string[]; joinedAt: string };
type Role = { id: string; name: string; color: string; members: number };
type Invite = { code: string; url: string; inviter?: string; uses: number; maxUses: number };
type Channel = { id: string; name: string; type: number };
export default function GuildManager({ guildId }: { guildId: string }) {
  const [tab, setTab] = useState("membres");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [config, setConfig] = useState<Record<string, { enabled?: boolean }>>({});
  async function load(target = tab) {
    setLoading(true);
    setError("");
    const path =
      target === "membres"
        ? `/api/guilds/${guildId}/members?page=${page}&q=${encodeURIComponent(query)}`
        : `/api/guilds/${guildId}/${target}`;
    const response = await fetch(path);
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error ?? "Le bot est hors ligne.");
    else if (target === "membres") setMembers(data.members ?? []);
    else if (target === "roles") setRoles(data ?? []);
    else if (target === "invites") setInvites(data ?? []);
    else setChannels(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tab, page]);
  useEffect(() => {
    fetch(`/api/guilds/${guildId}`)
      .then((response) => response.json())
      .then((data) => setConfig(data.config ?? {}))
      .catch(() => setError("Le bot est hors ligne."));
  }, [guildId]);
  async function toggle(section: string) {
    const next = {
      ...config,
      [section]: { ...(config[section] ?? {}), enabled: !config[section]?.enabled },
    };
    const response = await fetch(`/api/guilds/${guildId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [section]: next[section] }),
    });
    if (!response.ok) return setError("Impossible d'enregistrer la configuration.");
    const data = await response.json();
    setConfig(data.config ?? data);
  }
  async function create(target: "roles" | "channels") {
    const name = window.prompt(target === "roles" ? "Nom du rôle" : "Nom du salon");
    if (!name) return;
    await fetch(`/api/guilds/${guildId}/${target}`, {
      method: "POST",
      body: JSON.stringify(target === "roles" ? { name } : { name, type: 0 }),
      headers: { "Content-Type": "application/json" },
    });
    load(target);
  }
  async function remove(kind: "roles" | "channels", id: string) {
    await fetch(`/api/guilds/${guildId}/${kind}/${id}`, { method: "DELETE" });
    load(kind);
  }
  return (
    <section className="mt-10">
      <div className="rounded-2xl border bg-white/[.03] p-5">
        <h2 className="font-bold">Modules</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {["welcome", "levels", "automod", "logs", "antiRaid"].map((section) => (
            <button
              key={section}
              onClick={() => toggle(section)}
              className={`rounded-lg px-3 py-2 text-sm ${
                config[section]?.enabled ? "bg-emerald-600" : "border"
              }`}
            >
              {section} : {config[section]?.enabled ? "activé" : "désactivé"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {["membres", "roles", "invites", "channels"].map((item) => (
          <button
            key={item}
            onClick={() => {
              setTab(item);
              setPage(1);
            }}
            className={`rounded-lg px-4 py-2 text-sm ${tab === item ? "bg-violet-600" : "border"}`}
          >
            {item === "membres"
              ? "Membres"
              : item === "roles"
                ? "Rôles"
                : item === "invites"
                  ? "Invitations"
                  : "Salons"}
          </button>
        ))}
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-amber-200">
          {error}
        </div>
      )}
      {loading ? (
        <p className="mt-6 text-slate-400">Chargement…</p>
      ) : (
        <div className="mt-6 rounded-2xl border bg-white/[.03] p-5">
          {tab === "membres" && (
            <>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className="flex-1 rounded-lg border bg-transparent px-3 py-2"
                />
                <button onClick={() => load()} className="rounded-lg bg-violet-600 px-4">
                  Rechercher
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex justify-between border-b py-2 text-sm">
                    <span>{member.tag}</span>
                    <span className="text-slate-500">{member.roles.join(", ") || "Membre"}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ← Précédent
                </button>
                <span>Page {page}</span>
                <button onClick={() => setPage(page + 1)}>Suivant →</button>
              </div>
            </>
          )}
          {tab === "roles" && (
            <>
              <button
                onClick={() => create("roles")}
                className="rounded-lg bg-violet-600 px-4 py-2"
              >
                Créer un rôle
              </button>
              <button
                onClick={async () => {
                  await fetch(`/api/guilds/${guildId}/roles/presets`, { method: "POST" });
                  load("roles");
                }}
                className="ml-2 rounded-lg border px-4 py-2"
              >
                Rôles standards
              </button>
              <div className="mt-4 space-y-2">
                {roles.map((role) => (
                  <div key={role.id} className="flex justify-between border-b py-2">
                    <span style={{ color: role.color }}>{role.name}</span>
                    <button onClick={() => remove("roles", role.id)} className="text-red-300">
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "invites" && (
            <>
              <button
                onClick={async () => {
                  await fetch(`/api/guilds/${guildId}/invites`, {
                    method: "POST",
                    body: JSON.stringify({}),
                    headers: { "Content-Type": "application/json" },
                  });
                  load("invites");
                }}
                className="rounded-lg bg-violet-600 px-4 py-2"
              >
                Créer une invitation
              </button>
              <div className="mt-4 space-y-2">
                {invites.map((invite) => (
                  <div key={invite.code} className="border-b py-2 text-sm">
                    <a className="text-violet-300" href={invite.url}>
                      {invite.code}
                    </a>{" "}
                    · {invite.uses ?? 0} utilisations · {invite.inviter ?? "inconnu"}
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "channels" && (
            <>
              <button
                onClick={() => create("channels")}
                className="rounded-lg bg-violet-600 px-4 py-2"
              >
                Créer un salon
              </button>
              <div className="mt-4 space-y-2">
                {channels.map((channel) => (
                  <div key={channel.id} className="flex justify-between border-b py-2">
                    <span>#{channel.name}</span>
                    <button onClick={() => remove("channels", channel.id)} className="text-red-300">
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
