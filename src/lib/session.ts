// Edge-safe session token helpers (used by middleware and server code).
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "eys_session";
export const SESSION_HOURS = 12;

// authAt: when the person last typed their password (sign-in or confirmation), in milliseconds.
export type SessionPayload = { uid: number; role: string; name: string; mcp: boolean; authAt?: number };

// Sensitive actions ask for the password again when the last confirmation is older than this.
export function reauthWindowMinutes() {
  const v = Number(process.env.REAUTH_MINUTES);
  return Number.isFinite(v) && v >= 0 && process.env.REAUTH_MINUTES !== "" ? v : 10;
}

export function isRecentAuth(authAt: number | undefined, now = Date.now(), minutes = reauthWindowMinutes()) {
  return typeof authAt === "number" && now - authAt < minutes * 60_000;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
