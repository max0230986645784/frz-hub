import { SlashCommandBuilder } from "discord.js";
import { admin, success } from "./_helpers.js";
export const data = admin(
  new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Verrouiller tout le serveur")
    .addBooleanOption((o) =>
      o.setName("active").setDescription("Activer le verrouillage").setRequired(true),
    ),
);
export async function execute(i) {
  const active = i.options.getBoolean("active");
  await Promise.all(
    i.guild.channels.cache
      .filter((c) => c.isTextBased() && c.permissionOverwrites)
      .map((c) =>
        c.permissionOverwrites
          .edit(i.guild.roles.everyone, { SendMessages: active ? false : null })
          .catch(() => {}),
      ),
  );
  return i.reply({ embeds: [success(active ? "Lockdown activé." : "Lockdown désactivé.")] });
}
