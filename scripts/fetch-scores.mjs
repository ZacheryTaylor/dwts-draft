#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const season = JSON.parse(readFileSync("data/season.json", "utf8"));
const page = season.wikiPage || `Dancing_with_the_Stars_${season.season}`;
const url = `https://dancingwiththestars.fandom.com/wiki/${page}`;

const names = [];
for (const c of season.couples) {
  names.push({ coupleId: c.id, amateur: c.amateur.name.toLowerCase(), pro: c.pro.name.toLowerCase() });
}

function parseCoupleScore(text, couple) {
  const blob = text.toLowerCase();
  const idx = blob.indexOf(couple.amateur);
  if (idx < 0) return null;
  const window = blob.slice(idx, idx + 800);
  const m = window.match(/(\d{1,2})\s*\/\s*30/) || window.match(/>(\d{2})</) || window.match(/\b(1\d|2\d|30)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 40) return null;
  return n;
}

try {
  const res = await fetch(url, { headers: { "user-agent": "dwts-draft-score-sync" } });
  if (!res.ok) throw new Error(`Wiki HTTP ${res.status}`);
  const html = await res.text();
  const weekMatch = html.match(/week\s*(\d+)/i);
  const week = weekMatch ? Number(weekMatch[1]) : 1;
  const results = [];
  for (const couple of names) {
    const score = parseCoupleScore(html, couple);
    const eliminated = html.toLowerCase().includes(couple.amateur) && /eliminat/.test(html.toLowerCase().slice(html.toLowerCase().indexOf(couple.amateur), html.toLowerCase().indexOf(couple.amateur) + 500));
    if (score != null) results.push({ coupleId: couple.coupleId, score, eliminated: Boolean(eliminated) });
  }
  const existing = JSON.parse(readFileSync("data/scores.json", "utf8"));
  const weeks = Array.isArray(existing.weeks) ? existing.weeks.filter((w) => w.week !== week) : [];
  if (results.length) weeks.push({ week, theme: "Wiki sync", results });
  weeks.sort((a, b) => a.week - b.week);
  writeFileSync("data/scores.json", JSON.stringify({
    source: url,
    updatedAt: new Date().toISOString(),
    weeks
  }, null, 2));
  console.log(`Wrote ${results.length} couple scores for week ${week}`);
} catch (err) {
  console.error(err.message);
  process.exit(0);
}
