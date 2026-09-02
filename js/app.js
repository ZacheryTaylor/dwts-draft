const STORAGE_KEY = "draft-the-stars-leagues-v1";
const RESET_CODE = "0000";

let season;
let scoreData;
let store;
let activeLeagueId;
let poolFilter = "all";

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newLeague(name = "") {
  return {
    id: uid("league"),
    name,
    teams: [],
    picks: [],
    status: "setup",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function defaultStore() {
  const league = newLeague("");
  return { leagues: [league], activeLeagueId: league.id };
}

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.leagues?.length) return parsed;
  } catch (_) {}
  return defaultStore();
}

function saveStore() {
  store.activeLeagueId = activeLeagueId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function activeLeague() {
  return store.leagues.find((league) => league.id === activeLeagueId) || store.leagues[0];
}

function touch() {
  activeLeague().updatedAt = new Date().toISOString();
  saveStore();
}

function dancers() {
  return season.couples.flatMap((couple) => [
    {
      ...couple.amateur,
      role: "amateur",
      coupleId: couple.id,
      partnerName: couple.pro.name
    },
    {
      ...couple.pro,
      role: "pro",
      coupleId: couple.id,
      partnerName: couple.amateur.name
    }
  ]);
}

function dancerById(dancerId) {
  return dancers().find((dancer) => dancer.id === dancerId);
}

function totalCopies() {
  return Number(season.copiesPerDancer || 2);
}

function rosterSize(role) {
  return Number(season.rosterSize?.[role] || 4);
}

function teamById(teamId) {
  return activeLeague().teams.find((team) => team.id === teamId);
}

function roster(teamId) {
  return activeLeague().picks
    .filter((pick) => pick.teamId === teamId)
    .map((pick) => ({ ...pick, ...dancerById(pick.dancerId) }));
}

function teamRoleCount(teamId, role) {
  return roster(teamId).filter((pick) => pick.role === role).length;
}

function copiesTaken(dancerId) {
  return activeLeague().picks.filter((pick) => pick.dancerId === dancerId).length;
}

function teamOwnsDancer(teamId, dancerId) {
  return activeLeague().picks.some(
    (pick) => pick.teamId === teamId && pick.dancerId === dancerId
  );
}

function draftOrder() {
  const league = activeLeague();
  const teams = league.teams.map((team) => team.id);
  const totalPicks = teams.length * (rosterSize("amateur") + rosterSize("pro"));
  const picks = [];

  if (!teams.length) return picks;

  for (let round = 0; picks.length < totalPicks; round += 1) {
    const order = round % 2 === 0 ? teams : [...teams].reverse();
    for (const teamId of order) {
      if (picks.length >= totalPicks) break;
      picks.push(teamId);
    }
  }

  return picks;
}

function currentPickNumber() {
  return activeLeague().picks.length + 1;
}

function onClockTeamId() {
  const league = activeLeague();
  if (league.status !== "live") return null;
  return draftOrder()[league.picks.length] || null;
}

function onClockTeam() {
  return teamById(onClockTeamId());
}

function roundForPick(pickIndex) {
  const teamCount = activeLeague().teams.length || 1;
  return Math.floor(pickIndex / teamCount) + 1;
}

function isEligible(dancer) {
  const teamId = onClockTeamId();
  if (!teamId || !dancer) return false;
  if (copiesTaken(dancer.id) >= totalCopies()) return false;
  if (teamOwnsDancer(teamId, dancer.id)) return false;
  if (teamRoleCount(teamId, dancer.role) >= rosterSize(dancer.role)) return false;
  return true;
}

function createLeague() {
  const name = prompt("New league name?");
  if (!name?.trim()) return;
  const league = newLeague(name.trim());
  store.leagues.push(league);
  activeLeagueId = league.id;
  saveStore();
  render();
}

function selectLeague(value) {
  if (value === "new") {
    createLeague();
    return;
  }
  activeLeagueId = value;
  saveStore();
  render();
}

function addTeam() {
  const league = activeLeague();
  if (league.status !== "setup") return;
  if (league.teams.length >= 8) {
    alert("This visual board supports up to 8 teams.");
    return;
  }
  league.teams.push({ id: uid("team"), name: `Team ${league.teams.length + 1}` });
  touch();
  render();
}

function removeTeam(teamId) {
  const league = activeLeague();
  if (league.status !== "setup") return;
  league.teams = league.teams.filter((team) => team.id !== teamId);
  touch();
  render();
}

function moveTeam(index, direction) {
  const league = activeLeague();
  if (league.status !== "setup") return;
  const next = index + direction;
  if (next < 0 || next >= league.teams.length) return;
  [league.teams[index], league.teams[next]] = [league.teams[next], league.teams[index]];
  touch();
  render();
}

function saveSetup() {
  const league = activeLeague();
  if (league.status !== "setup") return;

  const name = $("league-name")?.value.trim();
  league.name = name || "";

  league.teams.forEach((team) => {
    const input = $(`team-name-${team.id}`);
    if (input) team.name = input.value.trim();
  });

  touch();
  render();
}

function leagueReady() {
  const league = activeLeague();
  return Boolean(
    league.name.trim() &&
    league.teams.length >= 2 &&
    league.teams.every((team) => team.name.trim())
  );
}

function startDraft() {
  saveSetup();
  const league = activeLeague();
  if (!leagueReady()) {
    alert("Give the league a name, add at least two teams, and name each team first.");
    return;
  }
  league.status = "live";
  touch();
  render();
}

function pauseDraft() {
  const league = activeLeague();
  if (league.status !== "live") return;
  league.status = "paused";
  touch();
  render();
}

function resumeDraft() {
  const league = activeLeague();
  if (league.status !== "paused") return;
  league.status = "live";
  touch();
  render();
}

function chooseDancer(dancerId) {
  const dancer = dancerById(dancerId);
  const team = onClockTeam();

  if (!dancer || !team || !isEligible(dancer)) return;

  const remainingBefore = totalCopies() - copiesTaken(dancer.id);
  const message = `Draft ${dancer.name} to ${team.name}?\n\n${dancer.role === "amateur" ? "Celebrity / amateur" : "Professional dancer"}\n${remainingBefore} copy${remainingBefore === 1 ? "" : "ies"} available before this pick.`;
  if (!confirm(message)) return;

  const pickIndex = activeLeague().picks.length;
  activeLeague().picks.push({
    id: uid("pick"),
    dancerId: dancer.id,
    teamId: team.id,
    role: dancer.role,
    copy: copiesTaken(dancer.id) + 1,
    overall: pickIndex + 1,
    round: roundForPick(pickIndex),
    createdAt: new Date().toISOString()
  });

  if (activeLeague().picks.length >= draftOrder().length) {
    activeLeague().status = "complete";
  }

  touch();
  render();
}

function undoLastPick() {
  const league = activeLeague();
  if (!league.picks.length) {
    alert("There are no picks to undo.");
    return;
  }

  const last = league.picks[league.picks.length - 1];
  const dancer = dancerById(last.dancerId);
  const team = teamById(last.teamId);

  if (!confirm(`Undo ${dancer?.name || "this dancer"} from ${team?.name || "this team"}?`)) return;
  league.picks.pop();
  league.status = "live";
  touch();
  render();
}

function rewindToPick(overall) {
  const league = activeLeague();
  const pick = league.picks.find((item) => item.overall === overall);
  if (!pick) return;

  const dancer = dancerById(pick.dancerId);
  if (!confirm(`Rewind to Pick ${overall}: ${dancer?.name || "selected dancer"}? This removes this pick and every pick after it.`)) return;

  league.picks = league.picks.filter((item) => item.overall < overall);
  league.status = "live";
  touch();
  render();
}

function resetLeague() {
  const typed = prompt("Enter the reset code:");
  if (typed === null) return;
  if (typed !== RESET_CODE) {
    alert("Incorrect reset code. No changes were made.");
    return;
  }
  if (!confirm("Reset this league? All picks will be permanently removed.")) return;

  const league = activeLeague();
  league.picks = [];
  league.status = "setup";
  touch();
  render();
}

function exportLeague() {
  const league = activeLeague();
  const payload = JSON.stringify({ season, scores: scoreData, league }, null, 2);
  const file = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = `${(league.name || "draft-the-stars").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importLeague(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload?.league?.id) throw new Error("Invalid file");
      const imported = { ...payload.league, id: uid("league") };
      store.leagues.push(imported);
      activeLeagueId = imported.id;
      saveStore();
      render();
    } catch (_) {
      alert("That does not appear to be a valid Draft the Stars league file.");
    }
  };
  reader.readAsText(file);
}

function eliminated(coupleId) {
  return (scoreData.weeks || []).some((week) =>
    (week.results || []).some((result) => result.coupleId === coupleId && result.eliminated)
  );
}

function teamPoints(teamId) {
  return (scoreData.weeks || []).reduce((total, week) => {
    const roundValue = season.roundValues?.[week.week - 1] || 0;
    const rosterPoints = roster(teamId).reduce((sum, dancer) => {
      const result = (week.results || []).find((row) => row.coupleId === dancer.coupleId);
      return sum + (result ? (Number(result.score) / 30) * roundValue : 0);
    }, 0);
    return total + rosterPoints;
  }, 0);
}

function maxPossiblePoints(teamId) {
  const latestWeek = Math.max(0, ...(scoreData.weeks || []).map((week) => Number(week.week) || 0));
  let total = teamPoints(teamId);

  roster(teamId).forEach((dancer) => {
    if (eliminated(dancer.coupleId)) return;
    for (let index = latestWeek; index < (season.roundValues || []).length; index += 1) {
      total += season.roundValues[index];
    }
  });

  return total;
}

function renderLeaguePicker() {
  const select = $("league-picker");
  if (!select) return;
  select.innerHTML = store.leagues.map((league) =>
    `<option value="${league.id}" ${league.id === activeLeagueId ? "selected" : ""}>${escapeHtml(league.name || "Untitled league")}</option>`
  ).join("") + '<option value="new">＋ Create new league</option>';
  select.onchange = (event) => selectLeague(event.target.value);
}

function renderSetup() {
  const league = activeLeague();
  const locked = league.status !== "setup";
  $("view-league").innerHTML = `
    <div class="card setup-card">
      <div class="section-title"><div><p class="eyebrow">Commissioner controls</p><h2>League setup</h2></div><span class="status ${league.status}">${league.status}</span></div>
      <label>League name<input id="league-name" value="${escapeHtml(league.name)}" placeholder="Example: Girls' DWTS Draft" ${locked ? "disabled" : ""}></label>
      <p class="muted">The saved league name appears on the rankings page and in the top-right league selector.</p>
      <h3>Round 1 draft order</h3>
      <p class="muted">Top to bottom is Round 1. The order automatically reverses every round for a snake draft.</p>
      <div class="team-list">
        ${league.teams.map((team, index) => `
          <div class="team-row">
            <span class="pick-badge">${index + 1}</span>
            <input id="team-name-${team.id}" value="${escapeHtml(team.name)}" ${locked ? "disabled" : ""}>
            <button data-up="${index}" ${locked || index === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
            <button data-down="${index}" ${locked || index === league.teams.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
            <button class="danger-mini" data-remove="${team.id}" ${locked ? "disabled" : ""}>Remove</button>
          </div>
        `).join("")}
      </div>
      <div class="row controls">
        <button id="save-setup" ${locked ? "disabled" : ""}>Save setup</button>
        <button id="add-team" ${locked || league.teams.length >= 8 ? "disabled" : ""}>Add team</button>
        <button class="primary" id="start-draft" ${locked ? "disabled" : ""}>Start Draft</button>
        <button id="export-league">Export league</button>
        <label class="file">Import league<input id="import-league" type="file" accept="application/json" hidden></label>
      </div>
    </div>
  `;

  $("save-setup").onclick = saveSetup;
  $("add-team").onclick = addTeam;
  $("start-draft").onclick = startDraft;
  $("export-league").onclick = exportLeague;
  $("import-league").onchange = (event) => {
    if (event.target.files[0]) importLeague(event.target.files[0]);
  };
  $("view-league").querySelectorAll("[data-up]").forEach((button) => {
    button.onclick = () => moveTeam(Number(button.dataset.up), -1);
  });
  $("view-league").querySelectorAll("[data-down]").forEach((button) => {
    button.onclick = () => moveTeam(Number(button.dataset.down), 1);
  });
  $("view-league").querySelectorAll("[data-remove]").forEach((button) => {
    button.onclick = () => removeTeam(button.dataset.remove);
  });
}

function boardCell(team, round) {
  const pick = activeLeague().picks.find((item) => item.teamId === team.id && item.round === round);
  if (!pick) return '<div class="board-pick empty"></div>';
  const dancer = dancerById(pick.dancerId);
  return `<button class="board-pick ${dancer?.role || ""}" data-rewind="${pick.overall}" title="Pick ${pick.overall}: click to rewind here"><span>${escapeHtml(dancer?.name || "")}</span><small>${dancer?.role === "amateur" ? "Celebrity" : "Pro"}</small></button>`;
}

function renderBoard() {
  const league = activeLeague();
  const teams = league.teams;
  const rows = Array.from({ length: 8 }, (_, index) => index + 1);

  return `
    <div class="board-wrap">
      <div class="draft-board-shell">
        <img src="1.png" class="board-art" alt="Draft the Stars board">
        <div class="board-overlay" style="--teams:${Math.max(teams.length, 1)}">
          <div class="board-header-spacer"></div>
          ${teams.map((team) => `<div class="board-team-name">${escapeHtml(team.name)}</div>`).join("")}
          ${rows.map((round) => `
            <div class="round-label">${round}</div>
            ${teams.map((team) => boardCell(team, round)).join("")}
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function dancerCard(dancer) {
  const taken = copiesTaken(dancer.id);
  const remaining = totalCopies() - taken;
  const allTaken = remaining === 0;
  const eligible = isEligible(dancer);

  return `
    <button class="dancer-card ${dancer.role} ${allTaken ? "all-taken" : ""} ${eligible ? "selectable" : ""}" data-dancer="${dancer.id}" ${eligible ? "" : "disabled"}>
      <span class="role-label">${dancer.role === "amateur" ? "Celebrity / amateur" : "Professional dancer"}</span>
      <span class="dancer-name">${escapeHtml(dancer.name)}</span>
      <span class="partner">with ${escapeHtml(dancer.partnerName)}</span>
      <span class="copy-status ${allTaken ? "gone" : taken ? "one-left" : "available"}">
        ${allTaken ? "All copies drafted" : taken ? "1 copy left" : "2 copies available"}
      </span>
    </button>
  `;
}

function renderDraft() {
  const league = activeLeague();
  const team = onClockTeam();
  const visibleDancers = dancers().filter((dancer) => poolFilter === "all" || dancer.role === poolFilter);
  const setupReady = leagueReady();
  const nextTeams = draftOrder().slice(league.picks.length, league.picks.length + 5)
    .map((teamId) => teamById(teamId)?.name)
    .filter(Boolean);

  $("view-draft").innerHTML = `
    <div class="card draft-command">
      <div class="clock-layout">
        <div>
          <p class="eyebrow">${league.status === "live" ? `Pick ${currentPickNumber()} · Round ${roundForPick(league.picks.length)}` : "Commissioner draft room"}</p>
          <h2>${league.status === "live" ? `On the clock: ${escapeHtml(team?.name || "")}` : league.status === "paused" ? "Draft paused" : league.status === "complete" ? "Draft complete" : "Set up your league"}</h2>
          <p class="muted">${league.status === "live" ? `This team has ${teamRoleCount(team.id, "amateur")}/4 celebrities and ${teamRoleCount(team.id, "pro")}/4 pros.` : "Create your league and start the draft. Clicking an available dancer will place them on the board immediately."}</p>
        </div>
        <div class="draft-actions">
          ${league.status === "setup" ? `<button class="primary" id="draft-start" ${setupReady ? "" : "disabled"}>Start Draft</button>` : ""}
          ${league.status === "live" ? '<button id="pause">Pause</button><button class="oops" id="undo">OOPS · Undo</button>' : ""}
          ${league.status === "paused" ? '<button class="primary" id="resume">Resume Draft</button><button class="oops" id="undo">OOPS · Undo</button>' : ""}
          <button class="reset" id="reset">Reset league</button>
        </div>
      </div>
      ${league.status === "setup" ? `<p class="setup-message ${setupReady ? "ready" : ""}">${setupReady ? "League setup is complete. Start when everyone is ready." : "Go to League Setup: add a league name, at least two teams, and team names."}</p>` : ""}
      ${league.status === "live" ? `<p class="next-up"><b>Next up:</b> ${nextTeams.map(escapeHtml).join(" → ")}</p>` : ""}
    </div>
    ${renderBoard()}
    <div class="card pool-controls"><div><h2>Available dancers</h2><p class="muted">Click a highlighted dancer to draft them. One copy can still be drafted by a different team; two copies makes the card unavailable.</p></div><label>Filter<select id="pool-filter"><option value="all">All dancers</option><option value="amateur">Celebrities / amateurs</option><option value="pro">Professionals</option></select></label></div>
    <div class="dancer-grid">${visibleDancers.map(dancerCard).join("")}</div>
  `;

  $("pool-filter").value = poolFilter;
  $("pool-filter").onchange = (event) => {
    poolFilter = event.target.value;
    renderDraft();
  };
  if ($("draft-start")) $("draft-start").onclick = startDraft;
  if ($("pause")) $("pause").onclick = pauseDraft;
  if ($("resume")) $("resume").onclick = resumeDraft;
  if ($("undo")) $("undo").onclick = undoLastPick;
  $("reset").onclick = resetLeague;
  $("view-draft").querySelectorAll("[data-dancer]").forEach((card) => {
    card.onclick = () => chooseDancer(card.dataset.dancer);
  });
  $("view-draft").querySelectorAll("[data-rewind]").forEach((cell) => {
    cell.onclick = () => rewindToPick(Number(cell.dataset.rewind));
  });
}

function renderRankings() {
  const league = activeLeague();
  const rows = league.teams.map((team) => {
    const teamRoster = roster(team.id);
    return {
      ...team,
      points: teamPoints(team.id),
      mpp: maxPossiblePoints(team.id),
      alive: teamRoster.filter((dancer) => !eliminated(dancer.coupleId)).length,
      teamRoster
    };
  }).sort((a, b) => b.points - a.points || b.mpp - a.mpp);

  $("view-rankings").innerHTML = `
    <div class="card">
      <p class="eyebrow">${escapeHtml(league.name || "Untitled league")}</p>
      <h2>Live rankings</h2>
      <p class="muted">Each dancer receives the equivalent of their couple score divided by 30, multiplied by that week’s round value. Max possible points assumes perfect remaining scores for dancers whose couples are still alive.</p>
      <div class="table-scroll"><table><thead><tr><th>Rank</th><th>Team</th><th>Points</th><th>Alive</th><th>Max possible</th><th>Roster</th></tr></thead><tbody>
        ${rows.map((team, index) => `<tr><td class="rank">${index + 1}</td><td>${escapeHtml(team.name)}</td><td>${team.points.toFixed(2)}</td><td>${team.alive}/${team.teamRoster.length}</td><td>${team.mpp.toFixed(2)}</td><td>${team.teamRoster.map((dancer) => `<span class="roster-dot ${dancer.role}">${escapeHtml(dancer.name)}</span>`).join("") || "—"}</td></tr>`).join("")}
      </tbody></table></div>
    </div>
  `;
}

function renderScores() {
  const weeks = scoreData.weeks || [];
  $("view-scores").innerHTML = `
    <div class="card"><h2>Weekly scores</h2><p class="muted">The scoring file can be updated after each episode. Each individual earns \(\frac{\text{couple score}}{30} \times \text{round value}\).</p>
      ${weeks.length ? weeks.map((week) => `<h3>Week ${week.week}</h3><table><tbody>${(week.results || []).map((result) => {
        const couple = season.couples.find((item) => item.id === result.coupleId);
        return `<tr><td>${escapeHtml(couple?.amateur.name || "")} / ${escapeHtml(couple?.pro.name || "")}</td><td>${result.score}/30</td><td>${result.eliminated ? "Eliminated" : "Safe"}</td></tr>`;
      }).join("")}</tbody></table>`).join("") : "<p>No scores have been entered yet.</p>"}
    </div>
  `;
}

function showView(view) {
  ["rankings", "draft", "scores", "league"].forEach((name) => {
    $("view-" + name).classList.toggle("hidden", name !== view);
    document.querySelector(`[data-view="${name}"]`)?.classList.toggle("active", name === view);
  });
}

function render() {
  renderLeaguePicker();
  renderSetup();
  renderDraft();
  renderRankings();
  renderScores();
}

async function init() {
  [season, scoreData] = await Promise.all([
    fetch("data/season.json").then((response) => response.json()),
    fetch("data/scores.json").then((response) => response.json()).catch(() => ({ weeks: [] }))
  ]);

  store = loadStore();
  activeLeagueId = store.activeLeagueId || store.leagues[0].id;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.onclick = () => showView(button.dataset.view);
  });
  render();
}

init();
