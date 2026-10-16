import { execFileSync } from "node:child_process";
import path from "node:path";

/** Stops the copy global-setup started (E2E_KEEP=1 leaves it up for another run with E2E_BASE_URL). */
export default function globalTeardown() {
  if (process.env.E2E_BASE_URL || process.env.E2E_KEEP) return;
  const root = path.resolve(__dirname, "..");
  execFileSync("bash", [path.join(root, "scripts/preview-clone.sh"), "--stop"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PORT: process.env.E2E_PORT ?? "3350" },
  });
}
