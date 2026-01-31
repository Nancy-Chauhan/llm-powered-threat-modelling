import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const client = new Database(process.env.DATABASE_URL || 'sqlite.db');
export const db = drizzle(client, { schema });

export * from './schema';
