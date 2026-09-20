import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getGuild, saveGuild } from "../store.js";

let token;
let tokenExpires = 0;
async function getToken() {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return null;
  if (token && Date.now() < tokenExpires) return token;
  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(process.env.TWITCH_CLIENT_ID)}&client_secret=${encodeURIComponent(process.env.TWITCH_CLIENT_SECRET)}&grant_type=client_credentials`,
    { method: "POST" },
  );
  if (!response.ok) return null;
  const body = await response.json();
  token = body.access_token;
  tokenExpires = Date.now() + (body.expires_in - 60) * 1000;
  return token;
}
export function startTwitchPoller(client) {
  const poll = async () => {
    const accessToken = await getToken();
    if (!accessToken) return;
    for (const guild of client.guilds.cache.values()) {
      const cfg = await getGuild(guild.id);
      const channels = cfg.twitch?.channels ?? [];
      for (const entry of channels) {
        const response = await fetch(
          `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(entry.login)}`,
          {
            headers: {
              "Client-ID": process.env.TWITCH_CLIENT_ID,
              Authorization: `Bearer ${accessToken}`,
            },
          },
        ).catch(() => null);
        if (!response?.ok) continue;
        const body = await response.json();
        const stream = body.data?.[0];
        const previous = cfg.twitch.live?.[entry.login];
        if (!stream) {
          if (previous) {
            delete cfg.twitch.live[entry.login];
            await saveGuild(guild.id, cfg);
          }
          continue;
        }
        if (previous === stream.id) continue;
        cfg.twitch.live ??= {};
        cfg.twitch.live[entry.login] = stream.id;
        await saveGuild(guild.id, cfg);
        const channel = guild.channels.cache.get(entry.channel);
        if (!channel?.isTextBased()) continue;
        const embed = new EmbedBuilder()
          .setColor(0x9146ff)
          .setTitle(`🔴 ${stream.user_name} est en direct`)
          .setDescription(entry.message.replaceAll("{login}", stream.user_name))
          .addFields(
            { name: "Jeu", value: stream.game_name || "—", inline: true },
            { name: "Spectateurs", value: String(stream.viewer_count), inline: true },
          )
          .setImage(stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720"))
          .setURL(`https://twitch.tv/${entry.login}`);
        await channel
          .send({
            embeds: [embed],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setLabel("Regarder")
                  .setStyle(ButtonStyle.Link)
                  .setURL(`https://twitch.tv/${entry.login}`),
              ),
            ],
          })
          .catch(() => {});
      }
    }
  };
  poll();
  return setInterval(poll, 60_000);
}
