import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema.ts";

export function testDatabase(t: { after: (fn: () => void) => void }) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  const directory = new URL("../../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  const client = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const execute = () => ({ results: sqlite.prepare(sql).all(...values), success: true, meta: {} });
      return { bind(...params: SQLInputValue[]) { values = params; return this; }, all: async () => execute(), run: async () => execute(), raw: async () => execute().results.map((row) => Object.values(row)), execute };
    },
    async batch(statements: { execute: () => unknown }[]) {
      sqlite.exec("BEGIN");
      try { const results = statements.map((statement) => statement.execute()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  return { sqlite, db: drizzle(client as unknown as D1Database, { schema }) };
}
