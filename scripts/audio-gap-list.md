# Audio asset gap list

These openly-licensed clips are already declared in
`scripts/download-audio-variants.mjs` (so they slot straight into their pools),
but could not be fetched in the build environment because Wikimedia Commons
returned persistent `HTTP 429` (rate-limit) responses for this host's IP. No
attributions are faked — the manifest only ever includes files that actually
downloaded, and `validate-uniqueness` reports these as pool-depth **warnings**
(not build failures) until the files land.

To complete them, re-run from a non-throttled network:

```
npm run download:audio:variants   # fetches any missing declared clips
npm run snapshot:scene-matrix     # refresh the matrix snapshot
npm run build                     # warnings clear once each pool reaches 4
```

Once every distinctive pool reaches 4 real clips, drop the matching entry from
`KNOWN_POOL_GAPS` in `scripts/validate-uniqueness.ts` and lower `MAX_UNRELATED`
toward 2 so the guard tightens.

## Pending clips (pool → clip → Commons file / licence / author)

| Pool | clipId | Commons file | Licence | Author |
|------|--------|--------------|---------|--------|
| corvid | `corvid-raven` | `Corvus corax - Northern Raven XC488951.mp3` | CC BY-SA 4.0 | Benjamin Mayer / Xeno-canto |
| corvid | `corvid-magpie` | `Pica pica - Eurasian Magpie XC537413.mp3` | CC BY-SA 4.0 | Benoît Van Hecke / Xeno-canto |
| primates | `primates-gibbon` | `Hoolock Gibbon Call.ogg` | CC BY-SA 4.0 | Chinmayisk (Wikimedia Commons) |
| primates | `primates-chimp` | `Pant-hoot call made by a male chimpanzee.ogg` | CC BY 4.0 | Pawel Fedurek et al. (Wikimedia Commons) |
| tropical-bird | `tropical-hornbill-malabar` | `Malabar pied hornbill call recorded in May 2014 at Netravali, Goa.wav` | CC BY-SA 4.0 | Sharadapte (Wikimedia Commons) |

## Native-species gaps (curation pass — reused closest clip, ideal species wanted)

The city-by-city curation features these native species as tiles, but no true
recording exists in the pools yet, so each currently **reuses the closest
existing clip** (noted below). Source the ideal CC0/PD call from Xeno-Canto
(CC0 filter) or Wikimedia Commons, add it to a pool with the right continent
tags, and repoint the tile's `fixedClipId`.

| Location | Tile | Ideal native species | Reused for now | Suggested source |
|----------|------|----------------------|----------------|------------------|
| Auckland / North Island Forest | Fantail (Pīwakawaka) | *Rhipidura fuliginosa* call | `legacy-bellbird` (NZ) | Xeno-Canto CC0 |
| Auckland / North Island Forest | Kererū | *Hemiphaga novaeseelandiae* coo + wingbeats | `songbird-breeze-birds` (neutral) | DOC / Xeno-Canto (needs CC re-licence) |
| Sydney | Bush Birds | Australian magpie / currawong / lorikeet | `songbird-breeze-birds` (neutral) | Xeno-Canto CC0 (`Gymnorhina tibicen`, `Strepera`, `Trichoglossus`) |
| Chiang Mai / Kyoto / Himalayas | Temple/Prayer Bells | dedicated temple bell + gong art plate (audio OK via `bells` pool) | `market` art plate | Commons PD bonshō / temple bell image |

Landed audio this pass:

- **bossa-nova**: `bossa-nova-migfus` (Rio) — Commons `609562 migfus20 background-music.ogg`, CC BY 4.0, Freesound user Migfus20. New `bossa-nova` type/pool.
- **kookaburra**: `kookaburra-1` (Sydney) — Commons `LaughingKookaburra.ogg`, Public domain, Kuco. New `kookaburra` type/pool.
- **kererū art**: `/icons/kereru.jpg` — Keulemans lithograph "Carpophaga Novæ Zealandiæ" from Walter Buller, *A History of the Birds of New Zealand* (Biodiversity Heritage Library scan), Public domain. Replaced an earlier Nga Manu photograph (CC BY-SA 2.0, Michael Hamilton) that breached the illustration-only imagery rule. The native Kererū *call* is still gap-listed above.

## Landed earlier (for reference)

- corvid: `corvid-crow`, `corvid-jackdaw` (European) — pool now 3 (blue-jay + 2).
- primates: `primates-vervet` (African) — pool now 2 (howler + vervet).
- tropical-bird: `tropical-hornbill-great` (Asian) — pool now 3 (toucan, quetzal + hornbill).
- seabird: `seabird-arctic-tern` (European) — pool now 4 (target met).

## Image plate gaps (per-continent wildlife art)

To push image de-collision toward the 2-unrelated-pins target, add per-continent
plates for these thin art pools (each currently 1–2 plates, so one plate must
cover several continents):

- `owl` (2 plates: European etching + arctic snowy owl) → add e.g. an
  Asian/African/Neotropical owl plate.
- `primates` (1 plate: Neotropical howler) → add Asian (gibbon/macaque) and
  African (colobus/vervet) plates.
- `corvid` (1 plate: American blue jay) → add a European corvid plate.

Wiring is already in place: drop the plate into `speciesArtPools` in
`src/data/iconArt.ts` with continent `tags`; the region-aware `rankPoolEntries`
resolver disperses and region-matches it automatically.
