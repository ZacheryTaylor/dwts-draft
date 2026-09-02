const STORAGE = "dwts-draft-v1";
let season, scores, league;

const $ = (id) => document.getElementById(id);
const views = ["rankings", "draft", "scores", "league"];

function loadLeague() {
  try { return JSON.parse(localStorage.getItem(STORAGE)); } catch { return null; }
}
function saveLeague() {
  localStorage.setItem(STORAGE, JSON.stringify(league));
}
function defaultLeague() {
  return {
    name: "Ballroom League",
    teams: [
      { id: "t1", name: "Team Mirrorball" },
      { id: "t2", name: "Team Samba" }
    ],
    picks: [],
    snake: true,
    draftComplete: false
  };
}
function allDancers() {
  const list = [];
  for (const c of season.couples) {
    list.push({ ...c.amateur, role: "amateur", coupleId: c.id, partnerName: c.pro.name });
    list.push({ ...c.pro, role: "pro", coupleId: c.id, partnerName: c.amateur.name });
  }
  return list;
}
function poolSlots() {
  const copies = season.copiesPerDancer || 2;
  const slots = [];
  for (const d of allDancers()) {
    for (let copy = 1; copy <= copies; copy++) {
      slots.push({ slotId: d.id + "#" + copy, dancerId: d.id, copy, ...d });
    }
  }
  return slots;
}
function takenSlotIds() { return new Set(league.picks.map((p) => p.slotId)); }
function teamOwnsDancer(teamId, dancerId) {
  return league.picks.some((p) => p.teamId === teamId && p.dancerId === dancerId);
}
function teamRoster(teamId) {
  return league.picks.filter((p) => p.teamId === teamId).map((p) => {
    const d = allDancers().find((x) => x.id === p.dancerId);
    return { ...p, ...d };
  });
}
function roleCount(teamId, role) {
  return teamRoster(teamId).filter((d) => d.role === role).length;
}
function draftOrder() {
  const n = league.teams.length;
  const need = (season.rosterSize.pro + season.rosterSize.amateur) * n;
  const order = [];
  let round = 0;
  while (order.length < need) {
    const row = league.teams.map((t) => t.id);
    if (league.snake && round % 2 === 1) row.reverse();
    for (const id of row) order.push(id);
    round++;
  }
  return order.slice(0, need);
}
function onClockTeamId() {
  return draftOrder()[league.picks.length] || null;
}
function coupleById(id) { return season.couples.find((c) => c.id === id); }
function eliminatedWeek(coupleId) {
  let w = null;
  for (const week of scores.weeks || []) {
    const r = (week.results || []).find((x) => x.coupleId === coupleId);
    if (r && r.eliminated) w = week.week;
  }
  return w;
}
function isAlive(coupleId) { return eliminatedWeek(coupleId) == null; }
function dancerShare(coupleScore) { return coupleScore / 2; }
function fantasyPoints(coupleScore, roundValue) {
  if (coupleScore == null) return 0;
  return (dancerShare(coupleScore) / 15) * roundValue;
}
function weekValue(weekNum) {
  return season.roundValues[weekNum - 1] ?? season.roundValues[season.roundValues.length - 1];
}
function remainingWeeks(fromWeek) {
  const total = season.roundValues.length;
  const start = Math.max(fromWeek, 1);
  const out = [];
  for (let w = start; w <= total; w++) out.push(w);
  return out;
}
function latestScoredWeek() {
  const weeks = (scores.weeks || []).map((w) => w.week);
  return weeks.length ? Math.max(...weeks) : 0;
}
function teamScore(teamId) {
  let pts = 0;
  const roster = teamRoster(teamId);
  for (const week of scores.weeks || []) {
    const rv = weekValue(week.week);
    for (const d of roster) {
      const row = (week.results || []).find((r) => r.coupleId === d.coupleId);
      if (!row) continue;
      const gone = eliminatedWeek(d.coupleId);
      if (gone != null && week.week > gone) continue;
      pts += fantasyPoints(row.score, rv);
    }
  }
  return pts;
}
function teamMPP(teamId) {
  const current = teamScore(teamId);
  const next = latestScoredWeek() + 1;
  let future = 0;
  for (const d of teamRoster(teamId)) {
    if (!isAlive(d.coupleId)) continue;
    for (const w of remainingWeeks(next)) future += weekValue(w);
  }
  return current + future;
}
function aliveCount(teamId) {
  return teamRoster(teamId).filter((d) => isAlive(d.coupleId)).length;
}
function canPick(teamId, slot) {
  if (takenSlotIds().has(slot.slotId)) return false;
  if (teamOwnsDancer(teamId, slot.dancerId)) return false;
  const need = season.rosterSize[slot.role];
  if (roleCount(teamId, slot.role) >= need) return false;
  return true;
}
function pick(slot) {
  const teamId = onClockTeamId();
  if (!teamId || !canPick(teamId, slot)) return;
  league.picks.push({ slotId: slot.slotId, dancerId: slot.dancerId, teamId, copy: slot.copy, ts: Date.now() });
  if (!onClockTeamId()) league.draftComplete = true;
  saveLeague();
  render();
}
function resetDraft() {
  league.picks = [];
  league.draftComplete = false;
  saveLeague();
  render();
}
function addTeam() {
  const name = prompt("Team name?");
  if (!name) return;
  league.teams.push({ id: "t" + Date.now(), name });
  saveLeague();
  render();
}
function exportLeague() {
  const blob = new Blob([JSON.stringify({ league, scores }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dwts-league.json";
  a.click();
}
function importLeague(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    if (data.league) league = data.league;
    if (data.scores) scores = data.scores;
    saveLeague();
    render();
  };
  reader.readAsText(file);
}
function addManualWeek() {
  const week = Number(prompt("Week number?", String(latestScoredWeek() + 1)));
  if (!week) return;
  const results = season.couples.map((c) => {
    const score = Number(prompt(`Couple score /30 for ${c.amateur.name} & ${c.pro.name} (blank skip)`, "24"));
    const eliminated = confirm(`Eliminated this week: ${c.amateur.name}? Click cancel for no.`);
    return { coupleId: c.id, score: Number.isFinite(score) ? score : null, eliminated };
  }).filter((r) => r.score != null);
  scores.weeks = (scores.weeks || []).filter((w) => w.week !== week);
  scores.weeks.push({ week, theme: "Manual", results });
  scores.weeks.sort((a, b) => a.week - b.week);
  scores.updatedAt = new Date().toISOString();
  render();
}

function renderRankings() {
  const rows = league.teams.map((t) => ({
    ...t,
    pts: teamScore(t.id),
    alive: aliveCount(t.id),
    mpp: teamMPP(t.id),
    roster: teamRoster(t.id)
  })).sort((a, b) => b.pts - a.pts || b.mpp - a.mpp);
  $("view-rankings").innerHTML = `
    <div class="card">
      <h2>${season.title} live rankings</h2>
      <p class="muted">Points use couple score ÷ 2, as a ratio of 15, times the week value. MPP assumes perfect 15/15 for every living dancer in remaining weeks.</p>
      <table>
        <thead><tr><th>Rank</th><th>Team</th><th>Points</th><th>Alive</th><th>MPP</th><th>Roster</th></tr></thead>
        <tbody>
          ${rows.map((t, i) => `<tr>
            <td class="rank">${i + 1}</td>
            <td>${t.name}</td>
            <td>${t.pts.toFixed(2)}</td>
            <td>${t.alive}/${t.roster.length}</td>
            <td>${t.mpp.toFixed(2)}</td>
            <td class="muted">${t.roster.map((d) => d.name).join(", ") || "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}
function renderDraft() {
  const clock = onClockTeamId();
  const team = league.teams.find((t) => t.id === clock);
  const slots = poolSlots().filter((s) => !takenSlotIds().has(s.slotId));
  $("view-draft").innerHTML = `
    <div class="card">
      <div class="row">
        <h2 style="margin:0">${league.draftComplete ? "Draft complete" : `On the clock: ${team ? team.name : "—"}`}</h2>
        <button type="button" id="reset-draft">Reset draft</button>
      </div>
      <p class="muted">Need ${season.rosterSize.pro} pros and ${season.rosterSize.amateur} amateurs. Two copies exist; you cannot own both copies of one dancer. Taking both members of a couple is allowed.</p>
    </div>
    <div class="grid">
      ${slots.map((s) => {
        const blocked = clock && !canPick(clock, s);
        return `<article class="pick">
          <div class="tag">${s.role} · copy ${s.copy}</div>
          <strong>${s.name}</strong>
          <div class="muted">Partner: ${s.partnerName}</div>
          <button type="button" ${blocked || !clock ? "disabled" : ""} data-slot="${s.slotId}">Draft</button>
        </article>`;
      }).join("")}
    </div>`;
  $("reset-draft").onclick = resetDraft;
  $("view-draft").querySelectorAll("[data-slot]").forEach((btn) => {
    btn.onclick = () => pick(poolSlots().find((s) => s.slotId === btn.dataset.slot));
  });
}
function renderScores() {
  const weeks = scores.weeks || [];
  $("view-scores").innerHTML = `
    <div class="card">
      <div class="row">
        <h2 style="margin:0">Weekly scores</h2>
        <button class="primary" type="button" id="add-week">Enter week</button>
      </div>
      <p class="muted">Auto-sync writes <code>data/scores.json</code> from the Fandom wiki via GitHub Action. Use Enter week if a show night is still missing.</p>
      ${weeks.length === 0 ? "<p>No weeks yet.</p>" : weeks.map((w) => `
        <h3>Week ${w.week} · value ${weekValue(w.week)} ${w.theme ? "· " + w.theme : ""}</h3>
        <table><thead><tr><th>Couple</th><th>Judges</th><th>Each dancer</th><th>Fantasy pts</th><th>Status</th></tr></thead>
        <tbody>${(w.results || []).map((r) => {
          const c = coupleById(r.coupleId);
          const share = dancerShare(r.score);
          const pts = fantasyPoints(r.score, weekValue(w.week));
          return `<tr><td>${c ? c.amateur.name + " / " + c.pro.name : r.coupleId}</td>
            <td>${r.score}/30</td><td>${share.toFixed(1)}/15</td><td>${pts.toFixed(2)}</td>
            <td class="${r.eliminated ? "warn" : "ok"}">${r.eliminated ? "Eliminated" : "Safe"}</td></tr>`;
        }).join("")}</tbody></table>`).join("")}
    </div>`;
  $("add-week").onclick = addManualWeek;
}
function renderLeague() {
  $("view-league").innerHTML = `
    <div class="card">
      <h2>${league.name}</h2>
      <div class="row">
        <button class="primary" type="button" id="add-team">Add team</button>
        <button type="button" id="export">Export JSON</button>
        <label class="file">Import <input id="import" type="file" accept="application/json" hidden /></label>
      </div>
      ${league.teams.map((t) => {
        const r = teamRoster(t.id);
        const ok = roleCount(t.id, "pro") === season.rosterSize.pro && roleCount(t.id, "amateur") === season.rosterSize.amateur;
        return `<p><strong>${t.name}</strong> · ${roleCount(t.id, "pro")} pros / ${roleCount(t.id, "amateur")} amateurs
          <span class="${ok ? "ok" : "warn"}">${ok ? "complete" : "building"}</span><br />
          <span class="muted">${r.map((d) => d.name + " (" + d.role + ")").join(", ") || "empty"}</span></p>`;
      }).join("")}
      <p class="muted">Round values: ${season.roundValues.join(", ")}. Edit data/season.json when the official Season 35 partners are locked.</p>
    </div>`;
  $("add-team").onclick = addTeam;
  $("export").onclick = exportLeague;
  $("import").onchange = (e) => e.target.files[0] && importLeague(e.target.files[0]);
}
function render() {
  renderRankings(); renderDraft(); renderScores(); renderLeague();
}
function show(view) {
  views.forEach((v) => {
    $("view-" + v).classList.toggle("hidden", v !== view);
    document.querySelector(`[data-view="${v}"]`).classList.toggle("active", v === view);
  });
}
async function init() {
  const [s, sc] = await Promise.all([
    fetch("data/season.json").then((r) => r.json()),
    fetch("data/scores.json").then((r) => r.json()).catch(() => ({ weeks: [] }))
  ]);
  season = s; scores = sc;
  league = loadLeague() || defaultLeague();
  document.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => show(b.dataset.view));
  render();
}
init();
