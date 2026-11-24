# Contributing to Builderland

Thanks for helping. New buildings, props, car models, people parts, animals and fixes are all welcome.

## Run it

```bash
npx serve .            # or: python3 -m http.server
```

There is no build step. Open `index.html` for the land and `style.html` for the style board.

## Before you open a pull request

1. **Check it on the style board.** Add your asset to the `ASSETS` list in [`src/style.js`](src/style.js) and open `style.html#a=<your-id>&still`. It should read well in day, golden hour and night, and with **Value check** on (greyscale).
2. **Use the tokens.** Colours come from [`src/tokens.js`](src/tokens.js). Bases stay at 25–45% saturation, and only accents go above 70%. Add a token rather than a new hex value.
3. **Keep it deterministic.** Use the seeded `rng` (or a hash of the name), never `Math.random()`. The same seed and the same edits must give the same land.
4. **Stay fast.** The default land draws in about 900 calls; keep the overview under 1,500. Wrap anything that moves in `live()` from `bkit.js` so the static merge leaves it alone, and instance anything that repeats.
5. **Keep `userData` JSON-safe**, so `.glb` export keeps working. Put object references on plain properties.
6. **No third-party logos in the repo.** Defaults show names only.
7. **Include a screenshot.** The style board is perfect for this.

The how-to for new buildings, props, cars and people is in [`docs/asset-guide.md`](docs/asset-guide.md).
