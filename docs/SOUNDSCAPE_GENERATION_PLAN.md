# Making generated soundscapes feel like the actual place

A plan for replacing the current trait-flag recipe builder with a signal-driven,
evidence-scored composer — and for growing the clip library it draws from.

Status: proposal. Nothing here is implemented yet.

---

## 1. The problem, measured

The complaint is that searching **Manhattan** returns a soundscape that could be
anywhere. That is literally true, and it is measurable. Running the current
generator (`buildProceduralRegion`) over ten very different cities:

| Place | Bed layers generated |
|---|---|
| Manhattan | traffic, songbird, bells, market |
| Denver | traffic, songbird, bells, market |
| Madrid | traffic, songbird, bells, market |
| Beijing | traffic, songbird, bells, market |
| Chicago | traffic, **stream**, songbird, bells, market |
| Toronto | traffic, **stream**, songbird, bells, market |
| Melbourne | traffic, **surf, gull**, songbird, bells, market |
| Reykjavík | traffic, **surf, gull**, songbird, bells, market |
| Venice | traffic, **surf, gull**, songbird, bells, market |
| Cairo | traffic, stream, songbird, **adhan**, market |

Ten cities across five continents collapse into **four distinct shapes**.
Manhattan, Denver, Madrid and Beijing are byte-identical. Melbourne, Reykjavík
and Venice are byte-identical — a subtropical Australian harbour city, a
subarctic Icelandic capital, and a car-free Italian lagoon.

At the clip level there is *some* variation, because the seeded picker biases on
region tags. But it produces its own howlers:

```
Manhattan  bells=bells-bronze  market=market-crowd  songbird=legacy-cardinal  traffic=city-latam-aguascalientes
Denver     bells=bells-bronze  market=market-crowd  songbird=white-throated-sparrow  traffic=city-latam-aguascalientes
```

**Manhattan's base bed is a street recording from Aguascalientes, Mexico** —
because `americas` is one region tag covering both. Manhattan and Denver share
three of four clips.

Three specific failures worth naming:

- **Manhattan gets no water at all.** It is an island between two tidal rivers
  with one of the world's great harbours. The generator decides "coastal" by
  running a regex for `coast|beach|bay|harbour|island|…` over the *place name*,
  and "Manhattan" contains none of those words. The bundled `majorCities` table
  *does* know New York is coastal, but the lookup requires the searched name to
  start with the table entry, and `"manhattan" !== "new york"`, so it misses.
- **Venice gets road traffic as its base bed** and no boats, no canal water, no
  vaporetto. Venice has essentially no cars.
- **Reykjavík gets church bells, a market and songbirds**, no wind, no
  geothermal, no seabird colony — and shares its exact shape with Melbourne.

### Why it happens

The generator reduces every place on earth to this vector:

```
climate:   tropical | temperate | cold      (3 latitude bands)
region:    european | americas | asian | african | mena | pacific | nz
urban:     boolean                          (regex on OSM class + name)
coastal / riverine / mountain / forest / arid:  booleans (regex on the NAME string)
culture:   worship(temple|church|adhan) + street(busy|calm) + birds  (per COUNTRY)
```

Manhattan's vector is `{temperate, americas, urban}` + `{church, calm, default}`.
So is Denver's. So is Philadelphia's, Toronto's, Boston's. Every US city is
culturally identical to the algorithm, because culture is keyed on country.

Almost all the geographic signal comes from **regex matching on the place name**,
which is why a place only counts as coastal if it happens to be *called* something
coastal.

### The library is lopsided too

168 clips, 30 types — but they are not distributed where cities need them:

| Group | Clips | Share |
|---|---|---|
| Birds (songbird 36, owl 16, corvid 15, seabird 11, tropical-bird 9) | 87 | 52% |
| Nature/weather (insects, waves, rain, stream, forest, wind, thunder, frogs, fire) | 43 | 26% |
| Human/urban (city-hum 4, traffic 4, market 5, bells 5, tram 1, subway 1, adhan 1) | 21 | 13% |
| Music (jazz 5, fado/musette/ney/bossa-nova 1 each) | 9 | 5% |

There are **four city-hum recordings on earth** in this app, and their tags cover
only `americas` and `european` — no Asian, African or MENA city hum exists, which
is exactly why cross-region clips leak in. Ten of thirty types have a single clip.

So the problem is two problems: **the algorithm can't express specificity**, and
**the library doesn't contain enough specific material for it to express.**

### The baseline, across 40 world cities

`scripts/measure-generation-distinctiveness.ts` (added with this plan) samples 40
places on every inhabited continent and measures mean pairwise Jaccard distance
between their bed layer sets:

```
  layer distinctiveness : 0.640      (1.0 = every scene unique)
  clip  distinctiveness : 0.923
  distinct bed shapes   : 20 of 40
```

Half the world collapses into twenty shapes, and the two largest collision groups
are seven cities each:

```
  7x  New Orleans, Toronto, Buenos Aires, Ushuaia, Bergen, Berlin, Seoul
  7x  San Francisco, Reykjavik, Edinburgh, Dublin, Venice, Athens, Melbourne
  4x  Manhattan, Denver, Madrid, Beijing
```

A Louisiana jazz city, a Canadian metropolis, an Argentine capital, a
subantarctic port, a Norwegian fjord town, Berlin and Seoul all generate the same
five beds.

The gap between the two metrics is the precise diagnosis: **casting is fine,
composition is broken.** The seeded picker does give places different recordings
(0.923), but it is choosing them to fill an identical stencil. Meanwhile the
three curated pins in the sample stand out immediately in the same output —
Paris returns `paris-musette, paris-cafe, paris-bells, paris-sparrows,
paris-cityhum`, Kyoto returns `kyoto-uguisu, kyoto-higurashi, kyoto-stream,
kyoto-crows, kyoto-bells`. That is the quality bar, and it is currently reachable
only by hand-authoring.

---

### Two negative results that reorder the whole plan

Before writing the plan I fixed one real input bug as a probe: `matchMajorCity`
required the searched name to start with the bundled city's name, so no
*subdivision* of a city could ever match its parent (`"manhattan" !== "new
york"`). It now falls back to the nearest bundled city within ~35km when the OSM
place type is `borough`/`suburb`/`quarter`/`district`. Manhattan correctly became
coastal: it gained surf, harbour gulls and the subway option, and its base bed
stopped being a Mexican street recording.

The distinctiveness metric did not move at all:

```
before:  0.640 layer distinctiveness, 20 distinct shapes of 40
after:   0.639 layer distinctiveness, 20 distinct shapes of 40
```

Manhattan just relocated from the four-city collision group into the seven-city
one, making it eight. **Better signals alone change nothing while the composer
only owns four stencils.**

So I built the composer instead, as a prototype: `src/utils/sceneComposer.ts`,
the scored-rule design described in §3 below — signature slots, family caps,
exclusions, finer latitude bands, season as a real input. Fed with *the same
crude signals* the shipped generator uses, so the comparison isolates the
composer:

```
shipped generator :  0.639 layer distinctiveness, 20 distinct shapes of 40
scored composer   :  0.569 layer distinctiveness, 20 distinct shapes of 40
```

**It is worse.** And the reason is the most useful thing this analysis produced.

A scored composer converges *harder* than an if/else chain. The if/else has
arbitrary branch quirks that accidentally manufacture variety; smooth scoring
just picks the globally highest-scoring layers, and when every score derives from
the same six booleans, the same layers win everywhere. The first version of the
prototype made this vivid: I gave the subway rule a pre-OSM fallback
(`majorCity && urban → 35`), it fired in 33 of 40 cities, and because signatures
are seated first, *the signature slot became a uniform*. A signature that fires
everywhere is not a signature.

### What the two results mean together

| Intervention | Layer distinctiveness |
|---|---|
| Shipped today | 0.639 |
| Better input signals, same composer | 0.639 |
| Better composer, same input signals | 0.569 |

Neither half helps alone. The composer is an amplifier: it multiplies whatever
discrimination exists in the evidence, and six booleans contain almost none.

**Therefore OSM feature data is not an enhancement to the composer — it is a
precondition for it.** The two must ship as one unit. This is the opposite of the
order I would have chosen by instinct (rewrite the messy code first, enrich data
later), and it is worth the day of analysis to have found out before writing the
real thing.

The one intervention that *does* pay off standalone is naming (§3, stage 4),
because it does not depend on having more layers to choose between — it depends
only on knowing what the layers we already chose are actually near.

### The structural ceiling

A brute-force sweep of 8,250 synthetic places (15 countries × 10 trait payloads ×
5 OSM classes × 11 latitudes) bounds what the current composer can *ever* emit:

```
distinct full layer sets : 91
distinct bed sets        : 50
distinct displayed names : 149
```

**Fifty possible default palettes for the entire planet.** `buildLayeredRecipe`
is a linear cascade of independent binary branches, so its output cardinality is
the product of a few small factors. Against ~10⁵ searchable settlements the
collision rate is effectively 100%. No amount of tuning moves this; only
replacing the cascade does.

### Three bugs the audit found (two now fixed)

- ✅ **Curated recipes were unreachable from search.** Recipes are keyed on the
  bare name (`kyoto`), but search passes the formatted label — "Kyoto, Kyoto
  Prefecture, Japan" — which slugified to `kyotokyotoprefecturejapan` and matched
  nothing. Typing "Paris" and pressing Enter returned City Hum + Church Bells +
  Market while the hand-built Paris sat unused. Now falls back to the leading
  comma-segment. *(Note: Enter with nothing highlighted still takes
  `geocodeResults[0]`, the worldwide result, rather than a curated pin sitting
  above it — worth a look separately.)*
- ✅ **The UI discarded every hand-authored layer name.** `displaySoundName`
  unconditionally replaced the name with a generic type label for 12 of 30
  types, so "Higurashi Cicadas" rendered as "Insects", "Malecón Surf" as "Surf",
  "Boulevard Hum" as "City hum". Someone pinned a Hiroshige plate and a recording
  of *Tanna japonensis* to a tile captioned "Insects". Now only names that add
  nothing over the type label are collapsed.
- ⬜ **`mena` is a hole with a wall around it.** It is in `REGION_TAGS` with no
  `REGION_COMPAT` entry and **zero clips carry it**, so a MENA scene excludes
  European, Asian and African clips and then has nothing of its own — which is
  why Cairo's corvid is a Himalayan large-billed crow. Four of the five
  sub-region tags the culture table emits (`southasian`, `eastasian`, `latam`,
  `mena`) are attached to zero clips and cannot influence casting at all.

### Casting failures worth naming

The audit traced where specific clips land. A sample:

- Kyoto's market is Carbon Market, **Cebu City**; Beijing's too.
- Johannesburg's street bed and market are both **Lagos** recordings; Nairobi
  gets the Lagos market as well — three African cities, two Lagos tapes.
- Malé — a 100% Muslim country — gets a **"Temple Bell"**, because `mv` is in no
  continent set, falls through the longitude fallback to `asian`, and the Asian
  default worship style is `temple`.
- Ushuaia's songbird is a **Northern Cardinal**, ~11,000 km out of range.
- Berlin's songbird is a **laughing dove recorded in Tehran**.
- Kathmandu's street bed is a **Manila jeepney**.
- `subway-metro-arrival` — a Paris metro — plays in all 19 scenes that offer a
  subway, including Tokyo.

Two structural causes: **108 of 280 ISO country codes** are in none of the six
continent sets and fall through a longitude guess (Russia, Pakistan, Hong Kong,
Greenland, the Maldives, most island states); and `pickDispersed` has a silent
escape hatch where, if no clip is in-region or neutral, *all* candidates come
back eligible rather than the scene admitting it has no material.

### Signals discarded at the type boundary

Photon returns `extent` (a bounding box) for every result and the app drops it
at `GeocodeResult`. That is **physical size for free** — Manhattan's bbox is
~0.14° × 0.20°, Cairo's ~0.69° × 0.57° — which separates a megacity from a market
town with no population data at all. Nominatim's reverse call already runs but
omits `extratags=1`; adding it returns **population, elevation and a Wikidata
id** for one query parameter. `place=island` / `place=archipelago` are already
parsed for search ranking but never consulted for coastality, which is why Malé
is not coastal.

## 2. Design principles

1. **Evidence over inference.** Prefer "there are 34 subway entrances within 1km"
   over "the name contains the word 'city'."
2. **Every scene needs a signature.** A guaranteed "only here" element. If we
   cannot find one, we should say so rather than pad with generic beds.
3. **Negative space matters.** Venice must *exclude* road traffic. A scene is
   defined as much by what it refuses to play as by what it plays.
4. **Never block on the network.** A provisional scene must start immediately;
   richer signals refine it when they arrive.
5. **Deterministic per place.** Same place → same scene, always (modulo an
   explicit reshuffle). Today's seeded selection already guarantees this and it
   must survive.
6. **Naming is half the perceived personalisation** and costs nothing.

---

## 3. The proposed architecture

Four stages, replacing the current single `buildLayeredRecipe` if/else chain.

```
        ┌─────────────────┐
search →│ 1. SIGNALS      │ geocode + OSM features + season/time + weather
        │    (async, cached)   + elevation + species occurrence
        └────────┬────────┘
                 ↓  PlaceSignals
        ┌─────────────────┐
        │ 2. BRIEF        │ score every candidate layer against the evidence;
        │    (pure)       │ apply exclusions; enforce a composition contract
        └────────┬────────┘
                 ↓  SoundBrief  (ranked layers + reasons + naming hints)
        ┌─────────────────┐
        │ 3. CASTING      │ resolve each brief slot to a concrete clip from the
        │    (pure)       │ pools — today's selectSceneVariants, extended
        └────────┬────────┘
                 ↓  Scene
        ┌─────────────────┐
        │ 4. NAMING       │ place-aware layer names + "why this sound" copy
        └─────────────────┘
```

Stages 2–4 stay pure and synchronous, so they remain unit-testable and
snapshot-testable exactly like `test-scene-matrix.ts` does today.

### Stage 1 — `PlaceSignals`

```ts
type PlaceSignals = {
  // Already available today
  name: string; lat: number; lng: number;
  countryCode?: string; osmClass?: string; osmType?: string;

  // New: derived locally, zero network
  season: 'spring' | 'summer' | 'autumn' | 'winter';   // lat hemisphere + date
  localTime: TimeOfDay;                                 // already exists
  latitudeBand: 'equatorial' | 'tropical' | 'subtropical' | 'temperate' | 'boreal' | 'polar';

  // New: one Overpass round-trip, cached
  features?: {
    subwayStations: number; tramStops: number; railStations: number;
    ferryTerminals: number; harbour: boolean; canals: number;
    marketplaces: number; parks: number; parkArea: number;
    worship: Partial<Record<'christian'|'muslim'|'buddhist'|'hindu'|'shinto'|'jewish', number>>;
    beaches: number; forestArea: number; farmlandArea: number;
    motorways: number; airports: number; stadiums: number;
    barsCafes: number;              // nightlife density proxy
    waterBodies: number; rivers: number;
    coastlineDistanceM?: number;
  };

  // New: cheap public APIs, cached, non-blocking
  elevationM?: number;
  weather?: { precipitation: number; windSpeedMs: number; tempC: number };
  species?: { birds: string[] };    // eBird/GBIF near point
};
```

Every field is optional except the geocode basics. The composer must produce a
good scene from the basics alone and simply get *better* as fields populate.

### Stage 2 — scoring instead of branching

Today: `if (urban) { push(cityHum) }`. Proposed: every layer type declares how it
earns its place.

```ts
type LayerRule = {
  preset: PresetKey;
  /** Positive evidence → score. */
  score: (s: PlaceSignals) => number;
  /** Hard veto regardless of score. */
  exclude?: (s: PlaceSignals) => boolean;
  /** Marks this as a "signature" candidate — a distinctive, only-here layer. */
  signature?: boolean;
  family: 'base' | 'water' | 'wildlife' | 'human' | 'weather' | 'transit' | 'music';
};
```

Worked example — the subway rule:

```ts
{
  preset: 'subway',
  family: 'transit',
  signature: true,
  score: (s) => {
    const n = s.features?.subwayStations ?? 0;
    if (n === 0) return 0;
    return 40 + Math.min(30, n * 3);   // dense metro networks score higher
  },
}
```

Manhattan (34+ stations within 1km of Midtown) scores ~70 and lands a signature
slot. Denver (a light-rail city) scores lower and gets tram instead. Chamonix
scores 0 and never sees it. No if/else chain edited — the rule is self-contained.

And the Venice veto:

```ts
{
  preset: 'streetTraffic',
  family: 'base',
  exclude: (s) => (s.features?.motorways ?? 0) === 0 && (s.features?.canals ?? 0) > 3,
  score: (s) => (s.features?.motorways ?? 0) * 8 + (s.culture.street === 'busy' ? 25 : 10),
}
```

**Composition contract.** After scoring, selection is not simply "top N" — the
scene must satisfy a shape:

| Slot | Count | Rule |
|---|---|---|
| Base bed | exactly 1 | highest-scoring `base` family layer |
| Signature | 1–2 | highest-scoring `signature:true` layers, **required** |
| Water | 0–1 | only if real water evidence |
| Wildlife | 1–2 | biome + season + (ideally) actual local species |
| Human/cultural | 0–2 | worship, market, music — evidence-gated |
| Weather | 0–1 | live weather, or seasonal climatology |
| Dock-only options | 4–8 | everything else that scored > 0 |

This guarantees a Manhattan scene contains a subway, and a Venice scene contains
canal water and no cars, without hard-coding either place.

### Stage 3 — casting

Mostly today's `selectSceneVariants`, with three fixes:

1. **Tighter region gating.** `americas` is too coarse — split into `nearctic`
   (US/Canada) and `latam`, so a Mexican street recording stops being Manhattan's
   base bed. Same for `european` (nordic / mediterranean / central).
2. **Signals participate in clip scoring.** Season, time-of-day and weather
   should bias clip choice, not just layer choice (a summer-evening scene should
   prefer the dusk chorus recording over the dawn one).
3. **Species-aware casting** where we have occurrence data: if eBird says
   Northern Cardinal and Blue Jay are the commonest birds at this point, and the
   library has both, cast those rather than a hash-picked sparrow.

### Stage 4 — naming (the cheapest big win)

Today every generated scene says "City Hum", "Songbirds", "Market". The curated
pins say "Notre-Dame Bells", "Tram 28", "Higurashi Cicadas", "Malecón Surf" —
and that naming is a large part of why curated places feel authored.

Naming can be generated from the same evidence, with no new audio at all:

| Evidence | Generic name today | Generated name |
|---|---|---|
| nearest named park polygon | "Songbirds" | "Central Park Songbirds" |
| subway feature present | "Subway" | "Lexington Ave Subway" |
| named river within 1km | "Riverside Water" | "East River Tide" |
| worship=jewish+christian, named landmark | "Church Bells" | "St Patrick's Bells" |
| coastline + harbour tag | "Surf" | "Upper Bay Harbour" |

Overpass returns feature `name` tags for free in the same query that gives us the
counts, so this is nearly zero marginal cost once stage 1 exists. It should ship
**first**, because it improves every existing scene immediately.

---

## 3b. Worked example: what Manhattan should produce

Evidence available for `40.7831, -73.9712` once Phase 3 lands, and the layer each
piece of evidence earns. This is the concrete target to build against.

| Evidence | Source | Layer earned | Generated name |
|---|---|---|---|
| 30+ subway entrances within 1km | Overpass `railway=subway_entrance` | **subway** (signature) | "Lexington Ave Subway" |
| coastline 1.1km; harbour polygon | Overpass `natural=coastline`, `harbour` | water: harbour | "Upper Bay" |
| named waterway "East River" 900m | Overpass `waterway=river` | water alt / dock option | "East River Tide" |
| Central Park polygon, 3.4 km² | Overpass `leisure=park` + `name` | wildlife: songbird | "Central Park Songbirds" |
| eBird: Blue Jay, N. Cardinal, House Sparrow | eBird occurrence | casts *those* clips | "Blue Jay" |
| `worship`: christian 40, jewish 12 | Overpass `amenity=place_of_worship` | human: bells (low mix) | "Midtown Bells" |
| motorways present, `street: calm` | Overpass + culture | base bed | "Midtown Hum" |
| July, northern hemisphere | date + lat | wildlife: cicadas | "Summer Cicadas" |
| 08:00 local | lng | biases casting to morning takes | — |
| no marketplace within 1km | Overpass | market **suppressed** | — |

Result: `subway, harbour, Central Park songbirds, Midtown hum, cicadas` with
`East River, blue jay, bells, rain` in the dock. Nothing in that list is
reachable today, and only two of the five need audio the library doesn't already
have.

Contrast Venice at the same date: no motorways → traffic **vetoed**; canals and
ferry terminals present → boat/canal signature; `worship: church` with the
Basilica nearby → bells; lagoon rather than open coast → gulls but no surf.
Currently Venice and Melbourne are byte-identical.

## 3c. Signal sources — measured, not assumed

Every figure below was measured by running the API live, not read off a doc page.

| Source | Gives us | Auth | CORS | Latency | Licence | Verdict |
|---|---|---|---|---|---|---|
| **Open-Meteo** `/v1/forecast` | IANA timezone, true local time, `is_day`, precipitation, snowfall, wind, cloud, **elevation**, sunrise/sunset — all in one 800-byte call | none | yes | **0.70 s** | CC BY 4.0 | **live fetch, do first** |
| **Overpass** `/api/interpreter` | counts of real features within N metres | none | yes | 3–19 s, **~1 in 3 returns 504** | ODbL | live + cache, never blocking |
| **GBIF** `/v1/occurrence/search` | species actually observed at a coordinate | none | yes | ~1 s | 98.6% **CC BY 4.0** (eBird dataset) | live fetch, cached |
| **Nominatim** `/lookup?extratags=1` | population, elevation, Wikidata QID | none | — | — | ODbL | 1 req/s cap; precompute |
| **Wikidata** `wbgetclaims` | Köppen code, population, elevation, languages | none | yes | 184 ms (by QID) | **CC0** | live, via QID from OSM |
| **Radio Aporee** `/api/maps/*` | 78,148 geolocated field recordings | none (needs `Referer`) | **no** | 2.4 s for the full 8.4 MB index | 31% PD/BY, 49% BY-SA, 19% NC/ND | build-time, after asking |
| Köppen 0.5° raster | a real climate code per point | — | — | offline | CC BY 4.0 | **bundle (~tens of KB)** |
| Distance-to-coast 0.25° grid | actual coast distance | — | — | offline | derived from Natural Earth (PD) | **bundle (~100–150 KB)** |
| eBird direct | same data as GBIF | key | yes | — | forbids key sharing + redistribution | **avoid — use GBIF** |

### Overpass genuinely discriminates

The measured signatures are the recipe, written out:

| feature (1.5 km) | Times Square | Kyoto | Timbuktu | Reine, Lofoten |
|---|---|---|---|---|
| subway entrances | **243** | 43 | 0 | 0 |
| places of worship | 51 | **173** | 8 | 0 |
| bars/pubs/clubs | 228 | 263 | 0 | 0 |
| major roads | **435** | 98 | 14 | **0** |
| coastline ways (3 km) | 48 | 0 | 0 | **10** |
| national park | 0 | 0 | 0 | **1** |

Reine is *nothing but coastline inside a national park*. Kyoto is 173 shrines and
35 river ways. Those columns are more place-specific than anything the current
generator can represent.

A second query returns `religion=*` tags rather than counts — Timbuktu comes back
`{muslim: 8, christian: 1}`, Kyoto splits buddhist/shinto. That is a
**data-driven basis for adhan vs church bells vs temple gong**, replacing the
country-code guess that currently hands Malé a Tibetan singing bowl.

**The operational catch:** roughly one Overpass request in three returned
`504 Dispatcher_Client::request_read_and_idx::timeout` during testing, and the
public instance allows two concurrent slots per IP. It cannot sit on the
synchronous path of a search. Precompute the top ~300 cities at build time, fetch
live-with-cache for the rest, and always degrade to today's inference.

### GBIF answers "which birds actually live here"

Keyless, CORS-open, ~1 s, and 98.6% of records near Manhattan are the eBird
dataset under **CC BY 4.0** — the licence-clean route to eBird's coverage without
eBird's key-sharing and redistribution restrictions.

- Times Square → House Sparrow, American Robin, Rock Pigeon, European Starling,
  Blue Jay
- Reine, Lofoten → Common Eider, Black Guillemot, European Shag, Razorbill

Adding `&month=8` reorders by season. Phase one is cheap and delivers most of the
gain: fetch the top ten species, match against the clips already in the library,
and use the match to **rank the existing pool and name the layer**. "Songbirds"
becomes "Blue Jay" without sourcing a single new recording.

## 4. Library expansion

The composer can only cast what exists. Priorities, in order:

### 4.1 Fill the urban hole (highest priority)
Cities are the most-searched category and the worst served: 4 city hums, 4
traffic, 5 markets, 5 bells for the whole world.

Target **6–8 clips per urban type per major region** (nearctic, latam, european,
nordic, mediterranean, mena, south-asian, east-asian, se-asian, african,
oceanian). Concretely, that is roughly:

| Type | Now | Target | Gap |
|---|---|---|---|
| city-hum | 4 | 30 | +26 |
| traffic | 4 | 25 | +21 |
| market | 5 | 25 | +20 |
| transit (subway/tram/rail/ferry) | 2 | 20 | +18 |
| bells / worship | 6 | 20 | +14 |
| crowd / plaza / café | 0 | 15 | +15 |

### 4.2 Add the missing "signature" types
Types that don't exist at all today but define specific places: ferry/ship horn,
harbour, canal water, fountain, construction, sirens, buskers by tradition,
stadium roar, call of street vendors, geothermal/steam, ice/snow underfoot,
desert wind, monsoon, cable car, tuk-tuk, bicycle bells.

### 4.3 Season and time variants
The same place in July and January should differ. Aim for summer/winter and
day/night variants of the highest-traffic beds (city hum, forest, insects,
songbird chorus) rather than more one-off exotica.

### 4.4 Sourcing — audited

| Source | Scale | How to enumerate | Licence | Verdict |
|---|---|---|---|---|
| **BigSoundBank** | 3,567 sounds | `sitemap_bsb.xml` (1.24 MB) → schema.org JSON-LD on each page carries name, description, duration, keywords, and **`.ogg` as well as `.mp3`** URLs | CC0 | **Automate.** Replaces the hand-maintained `BSB` array |
| **Radio Aporee** | **78,148 geolocated recordings, 67,388 places** | undocumented `/api/maps/getAllLocations` — the whole index in one 8.4 MB fetch | 31% PD/BY, 49% BY-SA, 19% NC/ND | **Highest impact. Email first.** |
| **Freesound** | large | `search/text/?filter={!geofilt sfield=geotag pt=lat,lng d=10}` — sounds *recorded near* a place | filter to CC0 + Attribution | build-time, server-side key |
| **Wikimedia Commons** | 146 country subcategories | `Category:Audio files of <country>` via `list=categorymembers` | mostly CC BY-SA | build-time |
| **Xeno-canto** | huge, species-indexed | v3 API, `box:` bbox (no radius operator) | filter `lc:` to cc0/cc-by/cc-by-sa | **v2 is dead; v3 needs a free key** |
| **NPS Natural Sounds** | hundreds | per-park libraries | **US public domain** | best free nature audio, US-only |
| **Europeana** | large | `TYPE:SOUND&reusability=open` | PD/CC0/BY/BY-SA | build-time |

**Excluded on licence:** BBC Sound Effects (RemArc forbids non-profit and
commercial use), Cities and Memory (per-artist permission), Macaulay Library (all
rights reserved), eBird raw data, Tierstimmenarchiv (NC).

**Two findings that save wasted effort.** Commons geo-search for audio is a dead
end — `nearcoord` returns 1 file within 20 km of Rome and 0 within 30 km of
Tokyo. And BigSoundBank, despite being the backbone of the library, is
structurally Franco-European (paris 23 slugs, london 8, japan 3; **mosque 0,
muezzin 0, airport 0, traffic 0**). It can supply generic beds and European
texture; it **cannot** supply the regional diversity §4.1 needs. That has to come
from Aporee, Freesound and Commons.

**Watch the ND clause specifically.** `optimize-audio.mjs` trims, loops and
re-encodes — that is a derivative work, so no-derivatives audio is unusable even
for a free app. ND is a stricter bar than NC here.

**Guardrail:** every added clip must carry title/author/license/sourceUrl in the
manifest, which `npm run validate:audio` already enforces.

---

## 5. Delivery plan

Ordered so that each phase ships user-visible improvement on its own and nothing
depends on a later phase.

### Phase 0 — Instrumentation ✅ done
`scripts/measure-generation-distinctiveness.ts` samples 40 world cities and
reports layer/clip distinctiveness plus the collision groups. Baseline recorded
above (0.640 layer / 20 distinct shapes of 40). Every later phase is judged
against it.

### Phase 1 — Fix the cheap lies (small, no new data) — partly done
- ✅ `matchMajorCity` now falls back to the nearest bundled city for
  `borough`/`suburb`/`quarter`/`district` searches, so Manhattan inherits New
  York's water. Shipped.
- Split `americas` → `nearctic` / `latam`, and `european` → `nordic` /
  `mediterranean` / `central`, so region gating stops casting an Aguascalientes
  street bed under Manhattan. (Also worth fixing: the `americas` culture default
  tags *every* US city `latam`.)
- Derive **season** from hemisphere + date and let it gate insects/dawn chorus.
  `seasonFor` already exists in the composer prototype.

### Phase 2 — The two standalone wins

Both pay off *without* the composer rewrite, because neither depends on having
more layers to choose between. Ship them next, independently, in either order.

**2a. Naming.** Re-describes the layers we already pick rather than picking
different ones. Partly done already: the UI had been discarding every
hand-authored name (fixed above), which recovered "Higurashi Cicadas" and
"Malecón Surf" for free. Next: name templates driven by whatever evidence exists,
geocode-only at first, sharpening automatically once Overpass lands (it returns
feature `name` tags in the same query that yields the counts).

**2b. Live weather + true local time — one Open-Meteo call.** The research ranks
this highest by impact ÷ effort in the whole programme, and I agree: 800 bytes,
0.70 s, no key, CORS already open, roughly a day of plumbing. One request returns
the IANA timezone (replacing the `lng / 15` guess that is ~3 hours wrong in
China, Spain and India), `is_day`, current precipitation and snowfall, wind
speed, elevation, and sunrise/sunset.

It is the fastest route to the effect a user actually notices: **Manhattan in a
February snowstorm at 3 a.m. should not sound like Manhattan at noon in August.**
And unlike everything else here it makes *every* place time-varying, including
the ones we never curate. It also deletes the dedicated elevation call — the
forecast response already carries it.

Caveat to respect: keep the *structural* layer set deterministic and let live
weather bias casting and optional layers only, or a shared scene link renders
differently for the recipient than for the sender. (That bug already exists today
via the owl option — see `timeOfDayFor`.)

### Phase 3+4 — OSM features **and** the scored composer, together
The experiments above show these cannot be sequenced apart: signals with no
composer to spend them change nothing, and a composer with nothing to spend
converges harder than the code it replaces. Treat as one deliverable.
- `src/utils/placeFeatures.ts`: one Overpass query per place, cached in
  IndexedDB, hard timeout, graceful "no features" path.
- Non-blocking: the scene starts from geocode-only signals; when features land
  the scene *upgrades* behind the existing cover transition.
- Promote `src/utils/sceneComposer.ts` from prototype: port the remaining
  branches of `buildLayeredRecipe` to rules, and make every `signature` rule
  require real feature evidence — no unearned fallbacks.
- Keep `CURATED_PLACES` as an override — hand-authored recipes always win.
- Gate on the metric: this phase is only done when the 40-city sample clears a
  target (proposed: ≥ 0.80 layer distinctiveness, ≥ 34 distinct shapes of 40, no
  collision group larger than 2).

### Phase 5 — Library expansion campaign
- Work the table in §4.1 region by region, urban types first.
- Each batch: source → optimise → manifest → validate → snapshot.

### Phase 6 — Species casting
- **GBIF** occurrence → cast the birds that actually live there. Keyless, CORS,
  CC BY 4.0. Phase one is cheap: fetch the top ten species, match against clips
  already in the library, use the match to rank the pool and name the layer.
  "Songbirds" becomes "Blue Jay" with no new audio at all.
- Phase two: go out to **Xeno-canto** (v3, free key, `box:` bbox queries) for
  species the library lacks.

### Phase 7 — Recorded-near-here (the transformative one)
Radio Aporee has 78,148 geolocated field recordings — one 30 metres from Times
Square, "nishiki market" 250 m from central Kyoto, Emeka Ogboh's "Yaba Bus Park"
1.8 km from central Lagos. Nothing else in this report can put a recording *of
the actual place* into the app.

Ship a build-time filtered index (PD + CC-BY is 31% of the corpus, still ~24,000
sounds) as a "recorded near here" layer crediting the recordist by name. Ranked
last only because it needs a permission conversation — the API is undocumented,
`robots.txt` discourages crawling `/maps*`, and Udo Noll has run this as a
public-good art project since the 1990s. **Email radio@aporee.org before any bulk
use.** On pure impact it is the strongest item in the plan, and the one that
would make the app a document of real places rather than a synthesiser.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Overpass latency/rate limits make entry feel slow | Never block: provisional scene first, upgrade on arrival; cache aggressively; hard timeout |
| Scenes become non-deterministic (weather/time change them) | Structural layers stay deterministic; live signals only bias *casting* and optional layers, and the seed stays place-derived |
| Scoring becomes as unreadable as the if/else it replaced | Rules are self-contained and individually unit-testable; the snapshot matrix catches regressions |
| Library growth balloons the payload | Per-scene loading is already lazy; the optimiser keeps bitrate in check; more clips ≠ more downloaded per scene |
| Licensing drift as sourcing scales | `validate:audio` already fails the build on a missing licence |

---

## 7. What "done" looks like

- Searching Manhattan yields: a New York street bed (not Aguascalientes), a
  subway signature layer, East River / harbour water, Central Park songbirds
  cast from species actually recorded there, and — in July — cicadas.
- Layer distinctiveness ≥ 0.80 across the 40-city sample (from 0.639), ≥ 34
  distinct shapes of 40 (from 20), and no collision group larger than 2.
- No two of the ten cities in §1 share a bed skeleton.
- Every generated scene names at least one layer after something real and
  nearby.

## 8. Reproducing the measurements

```bash
npx tsx scripts/measure-generation-distinctiveness.ts
```

Prints the shipped generator's distinctiveness, the collision groups, and the
prototype composer's numbers side by side. Re-run it after any change to the
generator, the culture/city tables, or the pools — the metric is the only thing
that reliably catches "every city sounds the same" creeping back in, because no
single scene ever looks wrong on its own.
