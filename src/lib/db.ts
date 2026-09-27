import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClients?: Map<string, PrismaClient> };
const clients = (globalForPrisma.prismaClients ??= new Map());

function create(url: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: url, max: 5 });
  return new PrismaClient({ adapter });
}

/**
 * Database router. Every organization records a `databaseKey`; "shared" is
 * the default database. A premium client can later be moved to a dedicated
 * database by setting its key and a DATABASE_URL_<KEY> variable.
 */
export function dbFor(databaseKey = "shared"): PrismaClient {
  const envName = databaseKey === "shared" ? "DATABASE_URL" : `DATABASE_URL_${databaseKey.toUpperCase()}`;
  const url = process.env[envName];
  if (!url) throw new Error(`No database configured for key "${databaseKey}"`);
  let client = clients.get(databaseKey);
  if (!client) {
    client = create(url);
    clients.set(databaseKey, client);
  }
  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = dbFor("shared");
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
