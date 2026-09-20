function escape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
export async function buildTranscript(channel) {
  const messages = [];
  let before;
  do {
    const batch = await channel.messages.fetch({ limit: 100, before });
    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  } while (before);
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = messages.map(
    (m) =>
      `[${new Date(m.createdTimestamp).toISOString()}] ${m.author?.tag ?? "Inconnu"}: ${m.content}`,
  );
  const html = `<!doctype html><meta charset="utf-8"><title>Transcript ${escape(channel.name)}</title><style>body{font:14px sans-serif;background:#111;color:#eee}article{padding:8px;border-bottom:1px solid #333}.author{color:#a78bfa}</style>${messages.map((m) => `<article><span class="author">${escape(m.author?.tag)}</span> <time>${new Date(m.createdTimestamp).toLocaleString("fr-FR")}</time><div>${escape(m.content)}</div></article>`).join("")}`;
  return { html: Buffer.from(html), text: Buffer.from(lines.join("\n")) };
}
