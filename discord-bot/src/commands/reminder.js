import { SlashCommandBuilder } from "discord.js";
import { getGuild, saveGuild } from "./_helpers.js";
export const data = new SlashCommandBuilder()
  .setName("rappel")
  .setDescription("Programmer un rappel")
  .addIntegerOption((o) =>
    o.setName("minutes").setDescription("Dans combien de minutes").setRequired(true).setMinValue(1),
  )
  .addStringOption((o) => o.setName("message").setDescription("Message").setRequired(true));
export async function execute(i) {
  const cfg = await getGuild(i.guildId);
  cfg.reminders ??= {};
  const id = crypto.randomUUID();
  cfg.reminders[id] = {
    user: i.user.id,
    message: i.options.getString("message"),
    at: Date.now() + i.options.getInteger("minutes") * 60_000,
  };
  await saveGuild(i.guildId, cfg);
  setTimeout(
    () => i.user.send(`⏰ Rappel : ${cfg.reminders[id].message}`).catch(() => {}),
    i.options.getInteger("minutes") * 60_000,
  );
  return i.reply({ content: "Rappel programmé.", ephemeral: true });
}
