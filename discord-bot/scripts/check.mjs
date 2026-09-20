import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const files = [];
async function collect(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await collect(path);
    else if (item.name.endsWith(".js")) files.push(path);
  }
}
await collect(root);
for (const file of files) execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
const commandFiles = files.filter((file) => file.includes("/commands/") && !file.split("/").pop().startsWith("_"));
const names = new Map();
for (const file of commandFiles) {
  const module = await import(file);
  if (!module.data || typeof module.execute !== "function") throw new Error(`${relative(root, file)}: data/execute manquant`);
  const name = module.data.name;
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`${name}: nom de commande invalide`);
  if (names.has(name)) throw new Error(`Commande dupliquée: ${name}`);
  names.set(name, file);
}
console.log(`OK: ${files.length} fichiers vérifiés, ${names.size} commandes chargées.`);
