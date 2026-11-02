import type { Client } from "@libsql/client";

export type ActionId = string;
export const ACTIONS: { id: ActionId; mod: "c" | "q" | "g"; req: ActionId[]; adminOnly?: boolean }[];
export const ACTION_IDS: ActionId[];
export const ADMIN_KEY: "admin";
export const STANDARD_PROFILES: { key: string; name: string; description: string; actions: ActionId[] }[];
export function withRequirements(list: readonly string[] | null | undefined): ActionId[];
export function withoutDependents(list: readonly string[], removed: string): ActionId[];
export function legacyActions(role: string, callsAccess: boolean, qrLevel: string): ActionId[];
export function parseActions(text: string | null | undefined): ActionId[];
export function ensureProfiles(client: Client): Promise<{ created: number; assigned: number }>;
