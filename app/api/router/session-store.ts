export type RouterCredentials = { baseUrl: string; username: string; password: string };

type RouterSession = RouterCredentials & { expiresAt: number };
type SessionRoot = typeof globalThis & { __beaconRouterSessions?: Map<string, RouterSession> };

const cookieName = "beacon_router_session";
const lifetimeSeconds = 8 * 60 * 60;
const root = globalThis as SessionRoot;
const sessions = root.__beaconRouterSessions ?? new Map<string, RouterSession>();
root.__beaconRouterSessions = sessions;

function sessionId(request: Request) {
  const cookies = request.headers.get("cookie") || "";
  for (const cookie of cookies.split(";")) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === cookieName) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function createRouterSession(credentials: RouterCredentials) {
  const id = crypto.randomUUID();
  sessions.set(id, { ...credentials, expiresAt: Date.now() + lifetimeSeconds * 1000 });
  return { id, cookie: `${cookieName}=${encodeURIComponent(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${lifetimeSeconds}` };
}

export function getRouterSession(request: Request) {
  const id = sessionId(request);
  const session = id ? sessions.get(id) : undefined;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  session.expiresAt = Date.now() + lifetimeSeconds * 1000;
  return session as RouterCredentials;
}

export function destroyRouterSession(request: Request) {
  const id = sessionId(request);
  if (id) sessions.delete(id);
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
