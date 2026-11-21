// Vitest's global setup: a copy of data/database-seed.json in a temporary
// directory for backend/database.ts (DATABASE_FILE), removed after the run, so
// the unit tests leave the tracked data/database.json alone. The test workers
// start after this and inherit the variable.
import fs from "fs";
import os from "os";
import path from "path";

export default function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rwa-unit-"));
  const file = path.join(dir, "database.json");
  fs.copyFileSync(path.join(process.cwd(), "data", "database-seed.json"), file);
  process.env.DATABASE_FILE = file;
  return () => fs.rmSync(dir, { recursive: true, force: true });
}
