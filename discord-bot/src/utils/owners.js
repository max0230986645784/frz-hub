import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ownersPath = join(process.cwd(), "config", "owners.json");

function envOwners() {
  return (process.env.OWNER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d{15,25}$/.test(id));
}

async function fileOwners() {
  try {
    const value = JSON.parse(await readFile(ownersPath, "utf8"));
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string" && /^\d{15,25}$/.test(id))
      : [];
  } catch {
    return [];
  }
}

export async function getOwners() {
  return [...new Set([...envOwners(), ...(await fileOwners())])];
}

export async function isOwner(userId) {
  return (await getOwners()).includes(userId);
}

export async function ownersConfigured() {
  return envOwners().length > 0 || (await fileOwners()).length > 0;
}

export async function addOwner(userId) {
  const owners = await getOwners();
  if (!owners.includes(userId)) owners.push(userId);
  await mkdir(join(process.cwd(), "config"), { recursive: true });
  await writeFile(ownersPath, JSON.stringify(owners, null, 2));
  return owners;
}

export async function removeOwner(userId) {
  const owners = (await fileOwners()).filter((id) => id !== userId);
  await mkdir(join(process.cwd(), "config"), { recursive: true });
  await writeFile(ownersPath, JSON.stringify(owners, null, 2));
  return getOwners();
}

export function ownerExempt(interaction) {
  const command = interaction.commandName;
  const subcommand = interaction.options?.getSubcommand?.(false);
  if (["rank", "leaderboard", "economie", "info"].includes(command)) return true;
  if (command === "communaute" && ["sondage", "suggestion"].includes(subcommand)) return true;
  return command === "ticket" && subcommand === "open";
}
