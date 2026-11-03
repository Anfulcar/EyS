import { createHmac, timingSafeEqual } from "node:crypto";

// The demo pass: given after typing the demo password, valid for a few hours. Signed by the server, so it
// can't be made up; it only ever opens the demo (made-up data), never the real app.
export const DEMO_COOKIE = "eys_demo";
export const DEMO_HOURS = 8;

function sign(exp: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET is missing or too short");
  return createHmac("sha256", `${secret}|demo`).update(String(exp)).digest("base64url");
}

export function demoToken(now = Date.now()) {
  const exp = now + DEMO_HOURS * 3600_000;
  return `${exp}.${sign(exp)}`;
}

export function validDemoToken(v: string | undefined, now = Date.now()) {
  if (!v) return false;
  const [e, mac] = v.split(".");
  const exp = Number(e);
  if (!Number.isFinite(exp) || exp < now || !mac) return false;
  const good = Buffer.from(sign(exp));
  const got = Buffer.from(mac);
  return good.length === got.length && timingSafeEqual(good, got);
}
