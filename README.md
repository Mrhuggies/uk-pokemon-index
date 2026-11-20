# UK Pokémon Card Index

A daily price index for Pokémon cards in pounds, plus a tracker for your own cards.

- **Data**: Cardmarket prices via the free [TCGdex API](https://tcgdex.dev), converted to GBP at the ECB euro reference rate.
- **Nightly job**: `.github/workflows/nightly.yml` runs `scripts/update.mjs` at 04:20 UTC and commits `public/data/latest.json` and `public/data/history.json`. Run it any time from the Actions tab (Nightly prices → Run workflow).
- **Site**: static `public/index.html`. On Vercel, `api/search.js` serves live search; elsewhere the page calls TCGdex directly.

## Index method
Chain-linked, equal-weighted (Jevons) index, base 1,000 on the first run. Each day it moves by the geometric mean of every constituent's GBP price relative to the previous day, with each card's daily log change capped at ±0.4. Sub-indices: Vintage (1999–2009), Modern (2010–2022), Current era (2023 on). Constituents live in `lib/basket.js`.

## Finding card ids
Actions → Find card ids → Run workflow, with names like `Umbreon VMAX, Iono`. It lists ids, sets and current GBP prices.

## Tracking your cards
Add a file per card in `watch/`, named after its TCGdex id (see `watch/README.md`). The site's Add card button pre-fills this on GitHub.

## Deploy
Import the repo into Vercel: no build command, output directory `public` (already set in `vercel.json`). Each nightly commit redeploys the site.

## Tests
`npm test` runs the index maths against fixtures.
