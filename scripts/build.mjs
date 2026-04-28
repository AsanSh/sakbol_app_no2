#!/usr/bin/env node
/**
 * prisma generate → migrate deploy (unless SKIP_PRISMA_MIGRATE_ON_BUILD=1) → next build
 */
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npx", ["prisma", "generate"]);

if (process.env.SKIP_PRISMA_MIGRATE_ON_BUILD === "1") {
  console.warn("[build] SKIP_PRISMA_MIGRATE_ON_BUILD=1 — skipping prisma migrate deploy");
} else {
  run("npx", ["prisma", "migrate", "deploy"]);
}

run("npx", ["next", "build"]);
