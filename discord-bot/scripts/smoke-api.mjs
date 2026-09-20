import http from "node:http";
import { startApi } from "../src/api.js";
process.env.API_PORT = "3137";
process.env.API_SECRET = "smoke-secret";
const client = {
  guilds: {
    cache: new Map([["1", { id: "1", name: "Serveur test", memberCount: 3, iconURL: () => null }]]),
  },
};
const server = startApi(client);
const request = (path) =>
  new Promise((resolve, reject) => {
    http
      .get(
        `http://127.0.0.1:3137${path}`,
        { headers: { Authorization: "Bearer smoke-secret" } },
        (response) => {
          let body = "";
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => resolve({ status: response.statusCode, body }));
        },
      )
      .on("error", reject);
  });
await new Promise((resolve) => setTimeout(resolve, 50));
const health = await request("/health");
const guilds = await request("/guilds");
if (health.status !== 200 || guilds.status !== 200)
  throw new Error(`Échec smoke API: ${health.status}/${guilds.status}`);
console.log("OK: /health et /guilds");
server.close();
