# Builderland asset guide

How to add buildings, props, car models and people parts that look like they belong.

## The rules

- **Three levels of detail.** Primary shape → secondary features (awnings, balconies, signs, stairs) → tertiary details (vents, plants, lamps, crates, people). A building that is one box looks cheap.
- **Chunky and toy-like.** Bevel everything (`rbox` in `bkit.js`), with no knife edges. Exaggerate about 1.2×: big signs, big wheels, big heads.
- **A unique silhouette.** You should recognise every landmark in a 64 px thumbnail.
- **Size tiers.**

  | Tier | Footprint | Height |
  |---|---|---|
  | S | 1 tile | ≤ 1 |
  | M | 2×2 lot | 1–2 |
  | L | 1 parcel | 3–4 |
  | XL | 2×2 parcels | 5–7 |

- **Colour.** Take colours from `tokens.js`: `MAT` for materials, `ACCENTS` for brand pops (at most 10% of the frame). Shade is tinted by the light, so never paint shadows grey.

## Add a building (a place kind)

1. Write a builder in `src/places.js` (or its own module) that returns a `THREE.Group`:
   - The origin sits at the centre of its footprint, on the ground, with the front facing **+z**.
   - Use `M`, `rbox`, `at`, `logoMaterial`, `stripes` and `windows` from `bkit.js`.
   - Put the place's name or logo on a sign with `logoMaterial(place, aspect)`.
   - Set `g.userData.height` (used for labels and the camera).
   - Animate in `g.userData.update = (t) => …`, and wrap every object you move in `live()`.
   - Optional `g.userData.spots`:
     - `{ sit: [{ x, z, y, yaw }] }` for seated people
     - `{ stand: [...] }` for people standing or queuing
     - `{ roof: [...] }` for rooftop cats
2. Register it: add the kind to `PLACE_KINDS`, `KIND_LABEL`, `KIND_SIZE` (`half`, `full` or `xl`) and `buildPlace()`.
3. Add it to the style board's `ASSETS` and check it in all three lights.

The `slots` argument is the land's Signs list. Use it for any sponsor surface.

## Add a prop to the editor

Add a case to `buildProp()` in `src/props.js`, its id to `PROP_TYPES` in `world.js`, and an icon to `PROP_UI` in `editor.js`.

## Add a car model

Add an entry to `MODELS` in `src/traffic.js`:
- `paint` parts are tinted per car.
- `fixed` parts are `[geometry, colour]` pairs: glass, tyres and lights.

Cars face **+x**, sit on y = 0 and are about 0.65 long. The model bakes into two instanced meshes automatically.

## Add a hairstyle or body part

Add a geometry to `geo().hair` in `src/folk.js`:
- Build it white, facing +x, with the head centre at y 0.41. The instance colour tints it.
- Darker baked vertex colours (like the shoes) stay darker.

## Models from Blender

1. Model with the ground at 0 and the front facing **+z** (+x for vehicles).
2. Name materials by role, so config can recolour them:
   - `*_hull`, `*_accent`, `*logo`, `*glass`
3. Export `.glb` with "Apply modifiers" on.
4. Load it with `GLTFLoader`, run `toonify()` from `src/engine/ink.js`, and give it a turntable check on the style board before it ships.

## Performance checklist

- [ ] Static parts merge (no `live` on things that don't move).
- [ ] Repeated things are instanced.
- [ ] No per-frame allocation in `update()`.
- [ ] The overview stays under 1,500 draw calls. To check, set `renderer.info.autoReset = false`, render once, and read `renderer.info.render.calls`.
