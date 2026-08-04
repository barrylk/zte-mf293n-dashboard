import { createRouterClient } from "../router-client";
import { createRouterSession, destroyRouterSession, getRouterSession } from "../session-store";

export const dynamic = "force-dynamic";

function normalizeRouterUrl(value: unknown) {
  const candidate = String(value || "http://192.168.1.1").trim();
  const url = new URL(candidate.includes("://") ? candidate : `http://${candidate}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error("Enter a valid router address");
  const host = url.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (!local) throw new Error("The router address must be on your local network");
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const session = getRouterSession(request);
  return Response.json(session ? { authenticated: true, baseUrl: session.baseUrl, username: session.username } : { authenticated: false }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { baseUrl?: unknown; username?: unknown; password?: unknown };
    const credentials = { baseUrl: normalizeRouterUrl(input.baseUrl), username: String(input.username || "").trim().slice(0, 64), password: String(input.password || "").slice(0, 128) };
    if (!credentials.username || !credentials.password) throw new Error("Username and password are required");
    await createRouterClient(credentials).ensureAuth();
    const session = createRouterSession(credentials);
    return Response.json({ ok: true, baseUrl: credentials.baseUrl, username: credentials.username }, { headers: { "Set-Cookie": session.cookie, "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log in to router";
    return Response.json({ ok: false, error: message }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": destroyRouterSession(request), "Cache-Control": "no-store" } });
}
