import { getDriver } from "./infrastructure/ydb/driver.js";
import { runMigrations } from "./infrastructure/ydb/migrations.js";
import type { YcfEvent, YcfContext, YcfResponse } from "./webhook/types.js";

export async function handler(_event: YcfEvent, _context: YcfContext): Promise<YcfResponse> {
  const driver = await getDriver();
  await runMigrations(driver);
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, message: "Migrations complete" }),
  };
}
