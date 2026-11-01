// apps/api/src/db/prisma.ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/**
 * Ensures the PostgreSQL set_server_updated_at() trigger function and
 * BEFORE INSERT OR UPDATE triggers exist on all 4 sync tables.
 */
export async function ensureServerUpdatedAtTriggers(
  client: PrismaClient = prisma,
): Promise<void> {
  await client.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION set_server_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.server_updated_at = clock_timestamp();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const syncTables = [
    "businesses",
    "customers",
    "customer_entries",
    "cashbook_entries",
  ];

  for (const table of syncTables) {
    const triggerName = `trg_${table}_server_updated_at`;
    await client.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS ${triggerName} ON "${table}";`,
    );
    await client.$executeRawUnsafe(`
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT OR UPDATE ON "${table}"
      FOR EACH ROW
      EXECUTE FUNCTION set_server_updated_at();
    `);
  }
}
