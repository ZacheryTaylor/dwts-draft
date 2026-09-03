#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const season = JSON.parse(readFileSync('data/season.json', 'utf8'));
const wikiPage = season.wikiPage || `Dancing_with_the_Stars_${season.season}`;
const wikipediaTitle = `Dancing_with_the_Stars_(season_${season.season})`;
const fandomUrl = `https://dancingwiththestars.fandom.com/wiki/${wikiPage}`;
const wikipediaUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(wikipediaTitle)}&prop=text&format=json&origin=*`;

const names = season.couples.map((couple) => ({
  coupleId: couple.id,
  amateur: couple.amateur.name.toLowerCase(),
  pro: couple.pro.name.toLowerCase()
}));

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
}

function parseFromHtml(html) {
  const blob = html.toLowerCase();
  const weekMatch = blob.match(/week\s*(\d+)/i);
  const week = weekMatch ? Number(weekMatch[1]) : 1;
  const results = [];

  for (const couple of names) {
    const idx = blob.indexOf(couple.amateur);
    if (idx < 0) continue;
    const window = blob.slice(idx, idx + 900);
    const scoreMatch = window.match(/(\d{1,2})\s*\/\s*30/) || window.match(/\b(1[0-9]|2[0-9]|30)\b/);
    if (!scoreMatch) continue;
    const score = Number(scoreMatch[1]);
    if (score < 1 || score > 40) continue;
    const eliminated = /eliminat/.test(window);
    results.push({ coupleId: couple.coupleId, score, eliminated });
  }

  return { week, results, text: stripTags(html).slice(0, 80) };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'dwts-draft-score-sync' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

try {
  let source = wikipediaUrl;
  let parsed = { week: 1, results: [] };

  try {
    const wikiJson = JSON.parse(await fetchHtml(wikipediaUrl));
    const html = wikiJson?.parse?.text?.['*'] || '';
    parsed = parseFromHtml(html);
    source = `https://en.wikipedia.org/wiki/${wikipediaTitle}`;
  } catch {
    const html = await fetchHtml(fandomUrl);
    parsed = parseFromHtml(html);
    source = fandomUrl;
  }

  if (!parsed.results.length) {
    const html = await fetchHtml(fandomUrl);
    parsed = parseFromHtml(html);
    source = fandomUrl;
  }

  const existing = JSON.parse(readFileSync('data/scores.json', 'utf8'));
  const weeks = Array.isArray(existing.weeks)
    ? existing.weeks.filter((item) => item.week !== parsed.week)
    : [];

  if (parsed.results.length) {
    weeks.push({
      week: parsed.week,
      theme: 'Published weekly scores',
      results: parsed.results
    });
  }

  weeks.sort((a, b) => a.week - b.week);

  writeFileSync('data/scores.json', JSON.stringify({
    source,
    updatedAt: new Date().toISOString(),
    weeks
  }, null, 2));

  console.log(`Wrote ${parsed.results.length} couple scores for week ${parsed.week} from ${source}`);
} catch (err) {
  console.error(err.message);
  process.exit(0);
}
