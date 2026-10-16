import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Builds and serves the production copy (scripts/preview-clone.sh) on the suite's own port,
 * unless E2E_BASE_URL points at a server that is already running. The script never touches
 * a server it did not start, and the repo's `next dev` is left alone (it owns .next).
 */
export default function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  const root = path.resolve(__dirname, "..");
  execFileSync("bash", [path.join(root, "scripts/preview-clone.sh")], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PORT: process.env.E2E_PORT ?? "3350" },
  });
}
