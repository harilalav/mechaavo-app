#!/usr/bin/env node
/*
 * The to-do tracker (docs/todo-tracker.csv): what is done and what is not, so work can continue
 * after a context reset without guessing.
 *
 *   node scripts/todo.mjs list [status]          all rows (or one status: pending, in-progress, done, blocked, dropped)
 *   node scripts/todo.mjs open                   everything not done (pending, in-progress), in order
 *   node scripts/todo.mjs set T18 done "evidence"   change a row's status, optionally replace its detail
 *   node scripts/todo.mjs add T27 P2 pending area "task" "detail" "files"   append a row
 *
 * Plain CSV (RFC 4180 quoting), so it also opens in a spreadsheet. Statuses: pending, in-progress,
 * done, blocked, dropped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs/todo-tracker.csv");

function parse(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const q = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const write = (rows) => writeFileSync(file, rows.map((r) => r.map(q).join(",")).join("\n") + "\n");

const rows = parse(readFileSync(file, "utf8")).filter((r) => r.length > 1);
const head = rows[0];
const col = (n) => head.indexOf(n);
const [cmd, ...args] = process.argv.slice(2);

const show = (r) => `${r[col("id")].padEnd(4)} ${r[col("priority")].padEnd(8)} ${r[col("status")].padEnd(11)} ${r[col("task")].slice(0, 96)}`;

if (cmd === "list") {
  const want = args[0];
  rows.slice(1).filter((r) => !want || r[col("status")] === want).forEach((r) => console.log(show(r)));
} else if (cmd === "open") {
  rows.slice(1).filter((r) => ["pending", "in-progress"].includes(r[col("status")])).forEach((r) => console.log(show(r)));
} else if (cmd === "set") {
  const [id, status, detail] = args;
  const r = rows.find((x) => x[col("id")] === id);
  if (!r || !status) { console.error("usage: set <id> <status> [detail]"); process.exit(2); }
  r[col("status")] = status;
  if (detail) r[col("detail_or_evidence")] = detail;
  write(rows);
  console.log(show(r));
} else if (cmd === "add") {
  const [id, priority, status, area, task, detail = "", files = "", blockedBy = ""] = args;
  if (!id || !task) { console.error("usage: add <id> <priority> <status> <area> <task> [detail] [files] [blocked_by]"); process.exit(2); }
  rows.push([id, priority, status, area, task, detail, files, blockedBy]);
  write(rows);
  console.log("added", id);
} else {
  console.error("usage: node scripts/todo.mjs list|open|set|add");
  process.exit(2);
}
