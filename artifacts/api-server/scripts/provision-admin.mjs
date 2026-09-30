// Controlled local operator action only; never exposed as an HTTP endpoint.
// Usage: pnpm --filter @workspace/api-server exec node scripts/provision-admin.mjs <email> <display-name>
// Enter the password on stdin (not as an argument, shell history, or environment).
import { createRequire } from "node:module";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const require = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const [emailArg, nameArg] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const name = nameArg?.trim();
if (!process.env.DATABASE_URL || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 || !name || name.length > 120 || process.argv.length !== 4 || !process.stdin.isTTY) {
  console.error("Usage: in an interactive trusted terminal, provide <email> <display-name> and DATABASE_URL.");
  process.exitCode = 1;
} else {
  process.stdout.write("Admin password (hidden): ");
  const password = await new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error) => {
      process.stdin.off("data", handle);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const handle = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n") { finish(); return; }
        if (char === "\u0003") { finish(new Error("Cancelled")); return; }
        if (char === "\u007f") value = value.slice(0, -1);
        else if (value.length <= 128) value += char;
      }
    };
    process.stdin.on("data", handle);
  });
  if (password.length < 12 || password.length > 128) {
    console.error("Password must be 12–128 characters.");
    process.exitCode = 1;
  } else {
    const salt = randomBytes(32);
    const hash = await promisify(scrypt)(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const result = await pool.query(
        "INSERT INTO users (id, email, name, password_hash, role, onboarding_completed, created_at) VALUES (gen_random_uuid(), $1, $2, $3, 'admin', true, now()) ON CONFLICT (email) DO NOTHING RETURNING id",
        [email, name, `scrypt-v1:${salt.toString("hex")}:${hash.toString("hex")}`],
      );
      if (result.rowCount !== 1) {
        console.error("Account already exists; no existing account was promoted.");
        process.exitCode = 1;
      } else {
        console.log("Administrator provisioned; no credentials displayed.");
      }
    } finally {
      await pool.end();
    }
  }
}