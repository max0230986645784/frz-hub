const base = process.env.BOT_API_URL ?? "http://localhost:3001";
export async function botFetch(path: string, options: RequestInit = {}) { return fetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BOT_API_SECRET ?? ""}`, ...(options.headers ?? {}) }, cache: "no-store" }); }
export async function botJson<T>(path: string, options?: RequestInit): Promise<T | null> { try { const res = await botFetch(path, options); if (!res.ok) return null; return await res.json(); } catch { return null; } }
