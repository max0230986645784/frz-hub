import { ChannelType, SlashCommandBuilder } from "discord.js";
import { admin, getGuild, saveGuild, success } from "./_helpers.js";
export const data = admin(
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Installer toute la structure Mr. Robot")
    .addBooleanOption((o) =>
      o.setName("confirmer").setDescription("Confirmer la création").setRequired(true),
    ),
);
export async function execute(i) {
  if (!i.options.getBoolean("confirmer"))
    return i.reply({
      content: "Ajoutez `confirmer:true` pour lancer l'installation.",
      ephemeral: true,
    });
  const names = [
    ["📢 Informations", ["regles", "annonces", "planning-stream"]],
    ["💬 Communauté", ["general", "clips", "suggestions"]],
    ["🎫 Support", ["tickets-panel"]],
    ["🔊 Vocaux", ["general-vocal", "generateur-vocal"]],
    ["🛠 Staff", ["logs", "staff-chat"]],
  ];
  for (const [categoryName, channels] of names) {
    let category = i.guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === categoryName,
    );
    if (!category)
      category = await i.guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
      });
    for (const name of channels)
      if (!i.guild.channels.cache.find((c) => c.name === name && c.parentId === category.id))
        await i.guild.channels.create({
          name,
          type:
            name.includes("vocal") || name === "general-vocal" || name === "generateur-vocal"
              ? ChannelType.GuildVoice
              : ChannelType.GuildText,
          parent: category.id,
        });
  }
  const cfg = await getGuild(i.guildId);
  const log = i.guild.channels.cache.find((c) => c.name === "logs");
  const generator = i.guild.channels.cache.find((c) => c.name === "generateur-vocal");
  cfg.logs.channel = log?.id;
  cfg.tempVoice = { generator: generator?.id, category: generator?.parentId };
  await saveGuild(i.guildId, cfg);
  return i.reply({
    embeds: [
      success("Structure Mr. Robot installée. Lancez `/role presets` pour les rôles standards."),
    ],
  });
}
