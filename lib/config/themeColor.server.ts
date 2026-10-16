import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The colour of the browser's own chrome (the address bar and status bar on a phone, the title bar of an
 * installed app): the page's ground, which is the white token. Read from src/styles/theme.css when the page
 * is built, never copied, so the one place a colour is written stays theme.css. Returns undefined, and the
 * meta tag is simply left out, if the token cannot be read.
 */
export function pageColor(): string | undefined {
  try {
    const css = readFileSync(path.join(process.cwd(), "src/styles/theme.css"), "utf8");
    return /--color-white:\s*(#[0-9a-fA-F]{6})\b/.exec(css)?.[1];
  } catch {
    return undefined;
  }
}
