import { SlashCommandBuilder } from "discord.js";
import { getGuild, saveGuild } from "./_helpers.js";
import { scheduleReminder } from "../timers.js";
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
  scheduleReminder(i.client, i.guildId, id, cfg.reminders[id]);
  return i.reply({ content: "Rappel programmé.", ephemeral: true });
}
