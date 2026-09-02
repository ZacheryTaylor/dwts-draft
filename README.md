# DWTS Draft

Simple Dancing with the Stars draft and scoring site. Search and share it as **DWTS Draft**.

Repo: https://github.com/ZacheryTaylor/dwts-draft

After GitHub Pages is on: https://zacherytaylor.github.io/dwts-draft/

## Rules

- Draft pros and amateurs separately
- Two copies of each dancer in the pool
- A team may take both partners from a couple
- A team may never own two copies of the same person
- Rosters are 4 pros + 4 amateurs

## Scoring

`points = (coupleScore / 2 / 15) * roundValue`

Default week values: 10, 12, 14, 16, 18, 20, 23, 26, 29, 32, 36

MPP assumes every living dancer scores a perfect 15/15 in remaining weeks.

## Score sync

GitHub Action runs `scripts/fetch-scores.mjs` against the DWTS Fandom wiki. Manual week entry is on the Scores tab. League state lives in the browser; use Export / Import to share.
