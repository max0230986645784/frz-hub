import express from "express";
import { getGuild, saveGuild } from "./store.js";
let botClient;
export function startApi(client) {
  botClient = client;
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!process.env.API_SECRET || token !== process.env.API_SECRET)
      return res.status(401).json({ error: "Non autorisé" });
    next();
  });
  app.get("/health", (_, res) => res.json({ ok: true, service: "Mr. Robot" }));
  app.get("/guilds", (_, res) =>
    res.json(
      [...botClient.guilds.cache.values()].map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL(),
        memberCount: g.memberCount,
      })),
    ),
  );
  app.get("/guilds/:id", async (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    const config = await getGuild(guild.id);
    res.json({
      config,
      channels: [...guild.channels.cache.values()].map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      })),
      roles: [...guild.roles.cache.values()].map((r) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
      })),
    });
  });
  app.put("/guilds/:id/config", async (req, res) => {
    if (!botClient.guilds.cache.has(req.params.id))
      return res.status(404).json({ error: "Serveur introuvable" });
    const current = await getGuild(req.params.id);
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
      return res.status(400).json({ error: "Configuration invalide" });
    const allowed = [
      "tickets",
      "welcome",
      "goodbye",
      "automod",
      "levels",
      "logs",
      "twitch",
      "autorole",
      "tempVoice",
      "antiRaid",
      "roleKeywords",
      "suggestions",
      "boost",
    ];
    const patch = {};
    for (const [key, value] of Object.entries(req.body ?? {})) {
      if (!allowed.includes(key)) continue;
      if (value === null || typeof value !== "object")
        return res.status(400).json({ error: `Configuration invalide : ${key}` });
      const currentValue = current[key];
      patch[key] =
        !Array.isArray(value) &&
        value &&
        typeof currentValue === "object" &&
        currentValue &&
        !Array.isArray(currentValue)
          ? { ...currentValue, ...value }
          : value;
    }
    res.json(await saveGuild(req.params.id, { ...current, ...patch }));
  });
  app.get("/guilds/:id/stats", async (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    const config = await getGuild(req.params.id);
    const levels = Object.entries(config.xp ?? {})
      .sort((a, b) => (b[1].level ?? 0) - (a[1].level ?? 0))
      .slice(0, 10);
    res.json({
      memberCount: guild.memberCount,
      warnsCount: Object.values(config.warns ?? {}).flat().length,
      ticketsCount: config.tickets?.counter ?? 0,
      topLevels: levels,
    });
  });
  app.get("/guilds/:id/members", async (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    await guild.members.fetch();
    const q = String(req.query.q ?? "").toLowerCase();
    const page = Math.max(1, Number(req.query.page ?? 1));
    const all = [...guild.members.cache.values()].filter(
      (m) => !q || `${m.user.tag} ${m.displayName}`.toLowerCase().includes(q),
    );
    const items = all.slice((page - 1) * 25, page * 25).map((m) => ({
      id: m.id,
      tag: m.user.tag,
      avatar: m.displayAvatarURL(),
      roles: m.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.name),
      joinedAt: m.joinedAt,
    }));
    res.json({
      members: items,
      page,
      total: all.length,
      pages: Math.max(1, Math.ceil(all.length / 25)),
    });
  });
  app.get("/guilds/:id/roles", (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    res.json(
      [...guild.roles.cache.values()]
        .filter((r) => r.id !== guild.id)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, members: r.members.size })),
    );
  });
  app.post("/guilds/:id/roles", async (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    const role = await guild.roles.create({
      name: String(req.body.name ?? "Nouveau rôle"),
      color: req.body.color ?? "Grey",
    });
    res.json({ id: role.id, name: role.name, color: role.hexColor });
  });
  app.delete("/guilds/:id/roles/:roleId", async (req, res) => {
    const role = botClient.guilds.cache.get(req.params.id)?.roles.cache.get(req.params.roleId);
    if (!role) return res.status(404).json({ error: "Rôle introuvable" });
    await role.delete();
    res.json({ ok: true });
  });
  app.post("/guilds/:id/roles/presets", async (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    for (const [name, color] of [
      ["Fondateur", "#ef4444"],
      ["Administrateur", "#eab308"],
      ["Modérateur", "#22c55e"],
      ["Support", "#06b6d4"],
      ["Streamer", "#9146ff"],
      ["Membre", "#94a3b8"],
    ])
      if (!guild.roles.cache.find((r) => r.name === name))
        await guild.roles.create({ name, color });
    res.json({ ok: true });
  });
  app.get("/guilds/:id/invites", async (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    const invites = await guild.invites.fetch();
    res.json(
      invites.map((x) => ({
        code: x.code,
        url: x.url,
        inviter: x.inviter?.tag,
        uses: x.uses,
        maxUses: x.maxUses,
        expiresAt: x.expiresAt,
      })),
    );
  });
  app.post("/guilds/:id/invites", async (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    const channel = guild?.channels.cache.get(req.body.channelId) ?? guild?.systemChannel;
    if (!channel?.isTextBased()) return res.status(400).json({ error: "Salon invalide" });
    const invite = await channel.createInvite({
      maxAge: Number(req.body.duration ?? 0),
      maxUses: Number(req.body.maxUses ?? 0),
    });
    res.json({ code: invite.code, url: invite.url });
  });
  app.post("/guilds/:id/channels", async (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    const channel = await guild.channels.create({
      name: String(req.body.name ?? "nouveau-salon"),
      type: Number(req.body.type ?? 0),
      parent: req.body.parentId ?? undefined,
    });
    res.json({ id: channel.id, name: channel.name, type: channel.type });
  });
  app.delete("/guilds/:id/channels/:channelId", async (req, res) => {
    const channel = botClient.guilds.cache
      .get(req.params.id)
      ?.channels.cache.get(req.params.channelId);
    if (!channel) return res.status(404).json({ error: "Salon introuvable" });
    await channel.delete();
    res.json({ ok: true });
  });
  const port = Number(process.env.API_PORT || 3001);
  return app.listen(port, () => console.log(`API Mr. Robot sur :${port}`));
}
