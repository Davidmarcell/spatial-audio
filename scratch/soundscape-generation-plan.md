# Soundscape generation plan: city-specific soundscapes + custom builder

Read-only research and plan. Nothing here is implemented. British English throughout.

## Step 1: How the current system works

### The search-to-scene pipeline

1. A user types a place into the spotlight. `fetchGeocodeResults` (`src/utils/geocode.ts`) queries Photon (OpenStreetMap). Each result carries `lat`, `lng`, `shortName`, `subtitle`, `placeId`, and a small geocode context: `class` / `type` / `addresstype` (mapped from OSM `osm_key`/`osm_value`, e.g. `place`/`city`), `displayName` (a comma-joined "name, district, city, county, state, country" string) and `countryCode`.
2. On pick, `GlobeExplorer.handleGeocodePick` calls `resolveProceduralSoundscape({ name, lat, lng, placeId, geocode })` (`src/utils/proceduralSoundscape.ts`).
3. `buildProceduralRegion` infers a small `Traits` object, chooses a recipe (curated palette if the slugified name matches, otherwise `buildFallbackLayers`), assembles a `Region` of `SoundDef` layers plus a `bedSounds` list (the auto-playing default palette), registers it, and returns `{ environmentId: 'procedural', regionId }`.
4. At playback, `selectSceneVariants` (`src/utils/soundscapeSelection.ts`) turns each typed `SoundDef` into a concrete clip from its pool, seeded by the region id so the result is stable per place.

"Use my location" (`resolveGeolocationSoundscape.ts`) is the same path via Nominatim reverse geocode.

### How the 3-4 sounds are actually chosen for a non-curated place

`inferTraits` derives only:

- `climate`: from `|lat|` alone, three buckets. `<23.5` tropical, `<50` temperate, else cold.
- `regionTag`: from `countryCode` into one of `european | americas | asian | african | pacific | nz`, with a longitude fallback.
- `urban | coastal | riverine | mountain | forest | arid`: **regex keyword matches** against `name + displayName + osm class/type`. `urban` also fires when OSM class/type is city/metropolis/suburb/borough.

`buildFallbackLayers(traits)` is then a short decision tree:

- Base bed: `urban` -> City Hum; `arid` -> Dry Wind; else -> Woodland.
- Water: `coastal` -> Surf (+ optional Seabirds); `mountain`/cold -> Mountain Stream; `riverine` -> Stream; else a ~40% chance of an optional Brook.
- Birds: `tropical && !urban` -> Tropical Birds (+ optional primates if forest); **else -> generic Songbird**.
- Wind: only if mountain/coastal/cold and not urban/arid.
- Warm voices: non-cold, non-arid -> Insects (bed if tropical, else optional).
- Frogs: tropical and (riverine or forest).
- Owl: rural and (forest or mountain), always optional, never a bed.

Only the layers marked `bed` auto-play. So for a **plain city search**, where the geocode string is just "City, Country" with no words like coast/river/mountain/forest, every keyword trait is false and the default palette collapses to roughly:

- **Tropical city** -> City Hum + Songbird + Insects (3 layers).
- **Temperate city** -> City Hum + Songbird (2 layers, insects only optional).
- **Temperate countryside** -> Woodland + Songbird (+ maybe Stream/Insects/Owl as non-default options).

That is the "same three or four sounds every time" the brief describes. It is baked into the fallback: there are only about five or six reachable default recipes for the entire non-curated world.

### Why it feels generic and repetitive

1. **The trait vocabulary is tiny.** Climate is three lat bands; place character is regex hits on a short string that, for most city searches, contains no descriptive words. So the overwhelming majority of places take the same one or two branches.
2. **Depth is shallow.** Default palettes are 2-4 beds. Curated pins get 4-6 hand-authored voices and feel rich by comparison; procedural places do not.
3. **No cultural or human layer for arbitrary places.** Tram, adhan, fado, ney, musette, bells, market are only ever attached by the hand-written `CURATED_PLACES` recipes. The fallback can never add them, so no searched city gets a call to prayer, a market, temple bells, or characteristic traffic. It only ever gets a generic "City Hum".
4. **A tropical city gets a temperate songbird.** Because the bird branch requires `!urban`, urban tropical cities skip Tropical Birds and fall to generic Songbird.
5. **Region gating cannot save an empty category.** `city-hum` has only European/temperate-tagged clips, so an Asian city scores them all with the conflict penalty but still plays one (a European street), because there is nothing else in the pool. There is no Southeast Asian, African, or Latin American street ambience to pick.
6. **Dispersion only reshuffles within thin, region-gated pools**, so neighbouring or unrelated places differ by at most a clip or two, reinforcing the sameness.

### The sound library today

Backing clips live in `src/data/soundClips.generated.ts` (~143 clips), grouped into pools by `type` in `soundPools.ts`. `SoundType` has 28 members. Rough counts per pool:

| Type | Clips | Notes |
|---|---|---|
| songbird | 28 | Mostly European/temperate; a few Asian (Japanese warbler, bulbul), African, neotropical, NZ, Australian. |
| owl | 14 | Mostly European; one African, two Asian, one NZ/Pacific. |
| corvid | 13 | Mostly European; two nearctic (pinnedOnly), one Asian. |
| seabird | 10 | Entirely European/north-Atlantic + two generic harbour/beach. |
| tropical-bird | 7 | Neotropical (quetzal, toucan), Asian (hornbill, drongo), African (turaco, ibis, fish eagle). |
| waves | 7 | Region-neutral. |
| insects | 7 | European/Mediterranean/tropical/Japanese. |
| rain | 6 | Region-neutral + urban variants. |
| stream | 6 | Region-neutral, some mountain. |
| jazz | 5 | Music. |
| primates | 5 | Neotropical howler, Asian gibbon/siamang, African vervet. |
| forest | 5 | Temperate/European. |
| bells | 4 | European church + Asian/Tibetan temple. |
| city-hum | 3 | **European/temperate only.** |
| wind | 3 | Temperate/forest/grassland. |
| frogs | 3 | Generic + tropical + Japanese. |
| thunder | 3 | Region-neutral. |
| market | 3 | European + one Spanish; no Asian/African/Latin. |
| fire | 2 | Camp/fireplace. |
| adhan, bossa-nova, fado, kookaburra, lion, musette, ney, traffic, tram | 1 each | Single-clip signatures, mostly pinned by curated recipes only. |

Region flavour is carried by string `tags` on each clip (`european`, `asian`, `african`, `americas`, `neotropical`, `nz`, `pacific`, `mediterranean`, plus habitat tags like `coastal`, `forest`, `savanna`, `urban`, `night`, `summer`). `selectSceneVariants` scores clips by tag overlap and hard-gates cross-continent species.

### What signals about a place are available today

Available now, offline/free: **name string, subtitle, country code, lat, lng, and OSM class/type/addresstype/displayName.** Derivable trivially: hemisphere and a crude season (from lat sign + month), a three-band climate, a coarse continent/region tag. **Not available today:** biome / land cover, elevation, true coastal proximity (only a keyword guess), population density / true urbanity, waterbody proximity, and time of day. This is the core gap: the generator reasons almost entirely from a country code and a lat band.

---

## Step 2: In-depth generation plan

### Design goals

1. Every searched place should produce a **layered** scene (aim for 5-7 audible voices, not 3), with real depth.
2. Scenes should **vary meaningfully by place** and, above all, carry **region/culture-specific voices** (the thing that makes Hanoi feel like Hanoi).
3. Results must stay **deterministic** per place (stable on reload and shareable) yet distinct from neighbours.
4. Ship the biggest perceptual jump **offline first**, with optional API/data enrichment later.

### The signals to derive, and how

I recommend a `PlaceSignals` object computed once per search, each field tagged feasible/offline or later/API.

| Signal | How (offline, ship first) | How (later / higher fidelity) |
|---|---|---|
| Climate zone | Keep the lat-band, but expand to ~6 Koppen-lite buckets using lat + a coarse continental-interior vs maritime guess. | Bundle a low-res Koppen raster (a small PNG/坐标 lookup, a few hundred KB) sampled by lat/lng. |
| Hemisphere + season | `lat` sign + current month -> season; drives cicadas/swifts/migrants and day-length. | Same, plus solar-position for finer dawn/dusk. |
| Time of day | Compute local-ish solar time from `lng` + clock (offset ~ lng/15). Buckets: dawn/day/dusk/night. | True timezone via a bundled tz lookup by lat/lng. |
| Coastal vs inland | Ship a very low-res coastline distance raster (or a coarse land/sea grid) sampled by lat/lng. Much better than the current keyword. | Higher-res coastline dataset or an on-demand reverse-geocode "is near water" check. |
| Elevation / mountain | Bundle a low-res elevation raster (SRTM downsampled to a small grid). | Open-Elevation API on demand. |
| Biome / land cover | Derive from climate + coastal + elevation as a first pass (e.g. tropical + low + humid -> tropical-wet). | Bundle a downsampled land-cover raster (forest/grassland/desert/urban/wetland). |
| Urban density | Combine OSM class/type with a **bundled list of ~1,000 major cities** (name + country + lat/lng + rough population). A name/coord match promotes to "big city" and unlocks the cultural layer. | A gridded population-density raster (GHSL) sampled by lat/lng. |
| Cultural/regional cues | A **country -> culture profile** table (offline): dominant religion(s) -> call to prayer or church/temple bells; region -> characteristic traffic (motorbike swarm vs tuk-tuk vs tram vs taxi horns), market style, and a signature instrument/music where one clearly exists. Optionally a per-major-city override table. | Curated per-city profiles expanded over time. |
| Characteristic wildlife | Region tag + biome selects the right bird/insect/amphibian pool; per-region "signature species" clips pinned where we have them. | eBird/GBIF-derived "top vocal species by region" tables to guide sourcing. |

The rasters are the key unlock and are all small, static, offline assets sampled with a couple of array lookups. No network dependency, no latency, deterministic.

### A layered recipe model

Replace the flat `buildFallbackLayers` tree with an explicit, weighted **layer stack**. Each place composes up to one voice from each layer; layers have target counts and volume bands so mixes have consistent depth and headroom.

1. **Base bed (1, vol 0.18-0.30).** The floor of the scene. Urban -> region-specific city hum; rural -> woodland/grassland/desert-wind depending on biome; always present.
2. **Geo / water layer (0-1, vol 0.30-0.46).** Coastal -> surf; near-water inland -> river/stream; mountain -> snowmelt stream/high wind; arid -> dry wind. Driven by the coastal/elevation/biome signals, not keywords.
3. **Wildlife: birds (1-2, vol 0.42-0.52).** Region + biome + time-of-day selects songbird / tropical-bird / seabird / corvid. Tropical cities keep a tropical or urban-adapted bird (crucially, do not fall back to a temperate songbird). Two bird voices in rich biomes for depth.
4. **Wildlife: insects/amphibians (0-1, vol 0.18-0.30).** Warm/humid -> cicadas or nocturnal insects; wetland/tropical night -> frogs; suppressed in cold/arid or midday.
5. **Human / cultural layer (1-2, vol 0.22-0.40).** THE differentiator. From the culture profile: call to prayer, temple bells or church bells, market bustle, characteristic traffic texture (motorbike swarm, tuk-tuk, tram, taxi horns), and where apt a signature music bed. This is what the fallback completely lacks today.
6. **Weather layer (0-1, vol 0.30-0.44), optional/off by default.** Rain/thunder offered by climate and season but not auto-played, matching the existing "no forced rain" curation principle.

Target default palette: base + geo + 1-2 birds + insects + 1-2 cultural = **5-7 beds**, with weather and a second wildlife voice available in the library but not auto-played.

### Mapping signals to clips, and the library gaps

The scoring/gating in `selectSceneVariants` is already the right mechanism: give each layer a `type`, `variantTags` (region + biome + habitat + time), and let the seeded picker choose. The generator's job is to emit the right typed layers with the right tags; sourcing new clips fills the pools so the picker has something regional to land on.

**Biggest gaps blocking believable non-European, non-curated cities (prioritised):**

- **P0 - Regional city ambience / traffic.** `city-hum` is European-only and `traffic` is a single clip. Need: Southeast Asian motorbike-swarm street, Indian/South Asian traffic with horns, Middle Eastern street, Latin American street, African street, generic dense-Asian megacity hum. This single category is the difference between "generic city" and "this city".
- **P0 - Market/crowd variety.** Add South/Southeast Asian market, Middle Eastern souk, Latin American mercado, African market. Currently European-only.
- **P1 - Regional birds.** Add common, recognisable urban/edge species per region: Southeast Asia (koel, common myna, bulbuls, sparrows), South Asia, tropical Africa, Latin America (kiskadee, urban parrots). The tropical-bird and songbird pools skew heavily to a few continents.
- **P1 - Cultural signatures for more cultures.** We have adhan, church/temple bells, fado, ney, musette, bossa, jazz, tram. Consider adding: a generic pan-regional temple bell already exists; a bell/gong for East/SE Asian temples; optional light regional music beds only where uncontroversial.
- **P2 - Water/weather texture.** Tropical monsoon rain (distinct from temperate), large-river wash, harbour activity.
- **P2 - Insects/amphibians** for tropical-wet nights beyond the current few.

All sourcing should stay CC0 / CC-BY(-SA) from the existing pipeline (Wikimedia Commons, xeno-canto, BigSoundBank) and flow through `scripts/download-audio-variants.mjs` into `soundClips.generated.ts`.

### Determinism vs variety

- Keep the current model: region id (place id or rounded lat/lng) is the seed; `selectSceneVariants` is deterministic on `seed + salt`. Preserve the "Shuffle" salt.
- **Drive variety from signals, not just the hash.** Two neighbouring towns with the same signals *should* sound similar; the goal is that a Vietnamese city and a French city sound clearly different, which comes from region/culture tags and pools, not from the dispersion hash. Keep dispersion only as a tie-breaker within an eligible tier (as it is now) so unrelated same-region places do not all grab the single highest-weighted clip.
- **Snap major cities to a stable per-city profile** (from the bundled city list). This makes "Hanoi" reliably Hanoi regardless of exactly which OSM node is returned, while smaller places fall through to the generic signal-driven recipe.
- Guard against the current failure where a region-empty pool still plays a conflicting clip: when the only candidates conflict on region, prefer a **region-neutral** clip (surf, rain, generic insects) over a wrong-continent species, and treat "no good cultural clip" as "omit that layer" rather than "play the European one".

### Worked example: "Hanoi, Vietnam"

Signals: lat ~21.03 (tropical, northern hemisphere), lng ~105.85 (local time offset ~+7h), country `vn` -> region `asian`, subregion Southeast Asia; bundled-city match -> big inland city on the Red River; biome tropical-wet; not coastal; low elevation; culture profile: predominantly Buddhist/folk-religion, motorbike-dominated traffic, dense street-vendor markets.

Target default palette (named layer -> type -> approx volume, spatial position):

1. **Motorbike Street Swarm** -> `city-hum`/`traffic` (SE Asian) -> 0.24, centre-low. **NEEDS SOURCING** (no SE Asian traffic clip today).
2. **Old Quarter Market** -> `market` -> 0.26, left. **NEEDS SOURCING** (SE Asian market; only European market clips exist).
3. **Asian Koel** (or common myna) -> `tropical-bird` -> 0.48, right-high. Partial: the `tropical-bird` pool has Asian species (hornbill, drongo) but no koel/myna; usable stand-in today, **koel/myna worth sourcing**.
4. **Street Sparrows / Bulbuls** -> `songbird` (asian) -> 0.42, centre. **Exists** (brown-eared bulbul, Japanese warbler are the nearest Asian clips; a SE Asian bulbul/sparrow would be better).
5. **Temple Bell / Gong** -> `bells` (asian/temple) -> 0.32, left-high. **Exists** (Tibetan bowl / bronze bell; a Vietnamese/SE Asian temple bell would be ideal).
6. **Warm-Night Insects (cicadas)** -> `insects` (tropical) -> 0.20, low. **Exists** (tropical cicadas).
7. **Hoan Kiem Lakeside Water** -> `stream`/water -> 0.34, low-left. **Exists** (generic water flow) if the near-water signal fires.

Available in the library, not auto-played: monsoon rain (needs a tropical-rain clip; only generic rain today), frogs, distant thunder.

What exists today vs what to source for Hanoi:

- **Exists / usable now:** temple bells, tropical cicadas, an Asian-tagged songbird, an Asian tropical-bird stand-in, generic water.
- **Must source for real fidelity:** Southeast Asian motorbike traffic (P0), SE Asian street-market (P0), koel/common myna (P1), SE Asian temple bell/gong (P1), tropical monsoon rain (P2).

Contrast with what Hanoi produces **today**: European City Hum + a temperate/Japanese Songbird + tropical Insects. Three layers, one of them audibly wrong. The plan turns that into six or seven placed, region-true voices.

### Phased roadmap

**Phase 0 - Fix the fallback shape (about 1-2 days, no new assets).** Biggest quick win. Rework `buildFallbackLayers` into the layered stack; stop routing tropical cities to temperate songbirds; always emit 5-7 beds; add a `time-of-day` tag from lng+clock; prefer region-neutral over wrong-continent clips when a pool is region-empty. Even before new audio, this makes places deeper and stops the obviously-wrong picks.

**Phase 1 - Culture profiles + big-city list (about 2-4 days).** Add a bundled `major-cities` table and a `country -> culture profile` table (religion-driven bells/adhan, traffic style, market style). Emit the human/cultural layer. Snap matched big cities to stable profiles. This is where "Hanoi feels like Hanoi" starts to land, gated on P0 audio.

**Phase 1 audio - P0/P1 sourcing (parallel, ongoing).** Source SE Asian + South Asian + Latin American + African street/traffic and market clips first (unblocks the cultural layer for most of the world), then regional urban birds. Route through the existing download script.

**Phase 2 - Offline rasters (about 3-5 days).** Bundle low-res climate, coastline-distance, elevation, and land-cover rasters; replace keyword traits with sampled signals. This upgrades every place at once and makes coastal/mountain/biome detection reliable rather than guessed.

**Phase 3 - Optional API enrichment (later, opt-in).** Open-Elevation / population-density / richer land cover on demand for higher fidelity, behind a feature flag, always with the offline path as fallback so the app stays fully functional offline.

Recommended path: do Phase 0 immediately (it alone removes the "same 3-4 sounds" feeling), run P0 audio sourcing in parallel, then Phase 1, then rasters.

---

## Step 3: "Create your own" builder

The pieces for this already exist; the builder is mostly UX plus a save/serialise layer.

**What is already there:** the app has a full sound library per scene (`getRegionSoundCatalog` = regional + global ambient), an "Add sound" sheet (`AddSoundSheet` / `soundCatalog.ts` with tab/season/keyword filtering), draggable spatial positioning and per-sound volume on the canvas, and complete **scene serialisation** (`sceneShare.ts`) that already encodes `environmentId`, `regionId`, an optional custom location, and every sound's `{ soundId, position, volume }` into a shareable URL. So "build, position, set volumes, share by URL" is effectively already possible on top of any scene.

**Proposed UX:**

- A "Create your own" entry (empty canvas, or "start from this place"). Under the hood it is a procedural/blank region so the existing catalog + global library are available.
- Reuse the existing Add-sound sheet as a **library browser**: search by keyword, filter by category/type, tap to drop a layer onto the canvas. Extend the searchable catalog from just the current region to the **full clip library** (all pools) for custom mode, so users can pull in any voice.
- Reuse existing drag-to-position and volume controls. Add a small "name this soundscape" field.
- **Save**: persist to `localStorage` as a list of `SharedScene` objects plus a title (the wire format already exists). A "My soundscapes" list to reload them.
- **Share**: reuse `buildSceneShareUrl`. Add the title to the wire (`n` field already carries a name). For custom scenes, ensure the sound ids used are all resolvable via `getRegionSoundCatalog` so `decodeWire`'s validation passes; the simplest route is a dedicated `custom` region whose `sounds` list is the union of every pool-backed `SoundDef` plus the global library.

**Technical notes / smallest slice:**

- Data model needs almost nothing new: a custom scene is a `SharedScene` with a title. Add `title` to the wire and a `localStorage` key for saved scenes.
- The one real gap is that shared/custom scenes must reference sound ids the catalog knows about. Introduce a synthetic "custom" region (or extend the procedural registry) that exposes the whole library so any picked layer round-trips through save/share validation.
- Keep positions/volumes exactly as the canvas already stores them; no engine changes required.

This is deliberately shorter than Step 2 because the heavy lifting (library, spatial canvas, volume, URL serialisation) is done; the work is a browse-and-save UI plus widening the catalog for custom mode.
