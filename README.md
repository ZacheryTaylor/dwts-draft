# DWTS Draft

Draft and scoring site for *Dancing with the Stars*. Members draft **pros** and **amateurs** separately. Each dancer exists **twice** in the pool. A team may take both partners from a couple, but may never own two copies of the same person. Final rosters are **4 pros + 4 amateurs**.

Live demo after GitHub Pages is enabled: https://zacherytaylor.github.io/dwts-draft/

## Scoring

Judge couple score is split in half so each partner earns `coupleScore / 2`.

That share is turned into a ratio of a perfect 15 (half of 30), then multiplied by the week value:

`points = (coupleScore / 2 / 15) * roundValue`

which is the same as `(coupleScore / 30) * roundValue`.

Default week values reward longevity without going extremely top-heavy:

`10, 12, 14, 16, 18, 20, 23, 26, 29, 32, 36`

Edit `data/season.json` to change them.

**Max Possible Points (MPP)** assumes every living dancer scores a perfect 15/15 in every remaining week.

## Score sync

`scripts/fetch-scores.mjs` tries to read weekly totals from the [DWTS Fandom wiki](https://dancingwiththestars.fandom.com/) and writes `data/scores.json`. A GitHub Action can run it after each episode. The ABC site is not a stable public API, so the wiki is the scrape target, with manual JSON as backup.

## Local use

Open `index.html` or serve the folder. League state is stored in your browser (`localStorage`). Use **Export / Import** on the League tab to share a draft with others.

## GitHub Pages

Repo Settings → Pages → Deploy from **main** / **root**.
