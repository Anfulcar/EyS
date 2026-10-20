import type { Client } from "@libsql/client";

export const DEMO_USERS: { username: string; name: string; role: string }[];
export function buildDemoData(): Record<string, string | null>[];
export function seedDemo(client: Client, env?: Record<string, string | undefined>): Promise<{ users: number; establishments: number; campaignId: number; date: string }>;
