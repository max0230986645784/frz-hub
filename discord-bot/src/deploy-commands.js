import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands } from "./index.js";
const commands = await loadCommands();
const json = commands.map((command) => command.data.toJSON());
if (process.argv.includes("--dry-run")) { console.log(JSON.stringify(json, null, 2)); process.exit(0); }
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) throw new Error("DISCORD_TOKEN et CLIENT_ID sont requis");
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
const route = process.env.DEV_GUILD_ID ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.DEV_GUILD_ID) : Routes.applicationCommands(process.env.CLIENT_ID);
await rest.put(route, { body: json });
console.log(`${json.length} commandes déployées.`);
