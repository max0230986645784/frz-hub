import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getGuild, saveGuild } from "./_helpers.js";
function ensure(cfg, id) {
  cfg.economy ??= {};
  cfg.economy[id] ??= { balance: 0, lastDaily: 0, lastWork: 0 };
  return cfg.economy[id];
}
export const data = new SlashCommandBuilder()
  .setName("economie")
  .setDescription("Économie légère")
  .addSubcommand((s) => s.setName("daily").setDescription("Récupérer votre récompense quotidienne"))
  .addSubcommand((s) =>
    s
      .setName("solde")
      .setDescription("Voir votre solde")
      .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(false)),
  )
  .addSubcommand((s) => s.setName("travailler").setDescription("Travailler"))
  .addSubcommand((s) =>
    s
      .setName("pay")
      .setDescription("Payer un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
      .addIntegerOption((o) =>
        o.setName("montant").setDescription("Montant").setRequired(true).setMinValue(1),
      ),
  )
  .addSubcommand((s) => s.setName("classement").setDescription("Classement des fortunes"));
export async function execute(i) {
  const cfg = await getGuild(i.guildId);
  const sub = i.options.getSubcommand();
  const account = ensure(cfg, i.user.id);
  if (sub === "daily") {
    if (Date.now() - account.lastDaily < 86_400_000)
      return i.reply({ content: "Votre récompense est déjà récupérée.", ephemeral: true });
    account.balance += 100;
    account.lastDaily = Date.now();
  } else if (sub === "travailler") {
    if (Date.now() - account.lastWork < 3_600_000)
      return i.reply({ content: "Vous devez attendre avant de retravailler.", ephemeral: true });
    account.balance += 50 + Math.floor(Math.random() * 100);
    account.lastWork = Date.now();
  } else if (sub === "pay") {
    const target = ensure(cfg, i.options.getUser("membre").id);
    const amount = i.options.getInteger("montant");
    if (account.balance < amount)
      return i.reply({ content: "Solde insuffisant.", ephemeral: true });
    account.balance -= amount;
    target.balance += amount;
  }
  await saveGuild(i.guildId, cfg);
  if (sub === "solde")
    return i.reply(
      `💰 Solde : **${ensure(cfg, i.options.getUser("membre")?.id ?? i.user.id).balance}** crédits`,
    );
  if (sub === "classement")
    return i.reply({
      embeds: [
        new EmbedBuilder().setTitle("Classement argent").setDescription(
          Object.entries(cfg.economy)
            .sort((a, b) => b[1].balance - a[1].balance)
            .slice(0, 10)
            .map(([id, x], n) => `${n + 1}. <@${id}> — ${x.balance}`)
            .join("\n"),
        ),
      ],
    });
  return i.reply("Opération effectuée.");
}
