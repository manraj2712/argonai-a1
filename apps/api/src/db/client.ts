import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';

export type Database = PrismaClient;

/** Either the root client or an interactive transaction; repositories accept both. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export function createDatabase(connectionString: string): Database {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
