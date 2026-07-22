#!/usr/bin/env node
/**
 * Downloads the openly-licensed audio variant pools for the dynamic soundscape
 * system and (re)generates src/data/soundClips.generated.ts.
 *
 * Sources:
 *  - BigSoundBank (CC0 1.0) — https://bigsoundbank.com  (numeric mp3 ids)
 *  - Wikimedia Commons (CC0 / Public domain / CC BY(-SA)) — via Special:FilePath
 *
 * Only clips that download successfully and fall inside the size bounds are
 * written into the generated manifest, so a dead link can never leave a
 * dangling pool entry. Re-run with:  npm run download:audio:variants
 */
import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_ROOT = join(ROOT, 'public', 'audio');
const POOL_ROOT = join(AUDIO_ROOT, 'pool');
const MANIFEST_OUT = join(ROOT, 'src', 'data', 'soundClips.generated.ts');

const MIN_BYTES = 30 * 1024;
const MAX_BYTES = 6.5 * 1024 * 1024;
const UA = 'Saudade/1.0 (soundscape asset fetch; contact local-dev)';

const bsbAuthor = 'Joseph SARDIN — BigSoundBank.com';
const bsbLicense = 'CC0 1.0';
const bsbUrl = (slug) => `https://bigsoundbank.com/${slug}.html`;
const bsbMp3 = (num) => `https://bigsoundbank.com/UPLOAD/mp3/${num}.mp3`;

/** BigSoundBank clips: [clipId, type, tags, sustained, numericId, slug, title]. */
const BSB = [
  // ---- wind ----
  // Soft, gentle breezes only. The lead clip is the natural fir-forest wind in
  // the LOCAL list below; these two textured BigSoundBank breezes add variety.
  // The plain "Wind s0595" recording (previously wind-open / legacy-wind) was
  // removed — it read as a flat hiss — and the eerie whistling/howling and loud
  // strong-wind clips stay excluded so every scene gets a pleasant breeze.
  ['wind-tall-grass', 'wind', ['open', 'temperate', 'rural'], true, '0908', 'wind-in-tall-grass-s0908', 'Wind in tall grass'],
  ['wind-in-tree', 'wind', ['forest', 'temperate'], true, '0659', 'wind-in-a-tree-s0659', 'Wind in a tree'],
  // ---- waves / surf ----
  ['waves-sea', 'waves', ['coastal', 'temperate'], true, '0266', 'sea-waves-s0266', 'Sea waves'],
  ['waves-beach-sea', 'waves', ['coastal', 'beach'], true, '1059', 'beach-and-sea-s1059', 'Beach and sea'],
  ['waves-small-beach', 'waves', ['coastal', 'beach', 'calm'], true, '0265', 'beach-small-waves-s0265', 'Beach, small waves'],
  ['waves-froth-beach', 'waves', ['coastal', 'beach'], true, '1446', 'small-waves-and-beach-1-s1446', 'Small waves and beach #1'],
  ['waves-agitated', 'waves', ['coastal', 'storm'], true, '0915', 'slightly-agitated-sea-s0915', 'Slightly agitated sea'],
  // ---- rain ----
  ['rain-storm', 'rain', ['storm', 'temperate'], true, '2719', 'storm-and-rain-4-s2719', 'Storm and rain #4'],
  ['rain-storm-2', 'rain', ['storm', 'tropical'], true, '0740', 'rain-and-storm-2-s0740', 'Rain and storm #2'],
  ['rain-terrace', 'rain', ['urban', 'temperate', 'summer'], true, '1019', 'summer-rain-on-terrace-s1019', 'Summer rain on terrace'],
  ['rain-concrete', 'rain', ['urban'], true, '1289', 'rain-on-concrete-s1289', 'Rain on concrete'],
  ['rain-umbrella', 'rain', ['urban', 'temperate'], true, '2679', 'rain-under-an-umbrella-s2679', 'Rain under an umbrella'],
  // ---- thunder ----
  ['thunder-1', 'thunder', ['storm'], false, '2718', 'thunder-s2718', 'Thunder'],
  ['thunder-2', 'thunder', ['storm'], false, '3113', 'thunder-2-s3113', 'Thunder #2'],
  ['thunder-6', 'thunder', ['storm', 'tropical'], false, '3179', 'thunder-6-s3179', 'Thunder #6'],
  // ---- stream / water ----
  ['stream-brooklet', 'stream', ['forest', 'temperate', 'calm'], true, '0864', 'brooklet-s0864', 'Brooklet'],
  ['stream-small-1', 'stream', ['forest', 'temperate'], true, '0213', 'small-stream-1-s0213', 'Small stream #1'],
  ['stream-watercourse-1', 'stream', ['mountain', 'alpine'], true, '3132', 'watercourse-1-s3132', 'Watercourse #1'],
  ['stream-waterfall', 'stream', ['forest', 'mountain'], true, '0219', 'small-waterfall-2-s0219', 'Small waterfall #2'],
  ['stream-flow', 'stream', ['temperate', 'calm'], true, '0204', 'water-flow-1-s0204', 'Water flow #1'],
  ['forest-stream-mix', 'stream', ['forest', 'temperate'], true, '2713', 'forest-and-stream-1-s2713', 'Forest and stream #1'],
  // ---- forest beds ----
  ['forest-1', 'forest', ['temperate', 'woodland'], true, '0100', 'forest-s0100', 'Forest'],
  ['forest-rambouillet', 'forest', ['temperate', 'european', 'woodland'], true, '0136', 'rambouillet-forest-s0136', 'Rambouillet forest'],
  ['forest-3', 'forest', ['temperate', 'woodland'], true, '2715', 'forest-3-s2715', 'Forest #3'],
  ['forest-edge', 'forest', ['temperate', 'rural'], true, '0905', 'forest-on-the-edge-s0905', 'Forest on the edge'],
  ['forest-night-rain', 'forest', ['temperate', 'night', 'woodland'], true, '0555', 'forest-at-night-after-rain-s0555', 'Forest at night after rain'],
  // ---- insects (cicada / cricket) ----
  ['insects-nocturnal', 'insects', ['tropical', 'night', 'summer'], true, '1470', 'nocturnal-insects-4-s1470', 'Nocturnal insects #4'],
  ['insects-cicada-1', 'insects', ['summer', 'mediterranean'], true, '2246', 'cicada-1-s2246', 'Cicada #1'],
  ['insects-cicadas', 'insects', ['summer', 'tropical'], true, '3002', 'cicadas-s3002', 'Cicadas'],
  ['insects-field-cricket', 'insects', ['temperate', 'rural', 'summer'], true, '1020', 'field-cricket-s1020', 'Field cricket'],
  ['insects-singing-1', 'insects', ['summer', 'night'], true, '3089', 'singing-insect-1-s3089', 'Singing insect #1'],
  // ---- songbird (temperate dawn chorus / blackbird) ----
  ['songbird-blackbird-2', 'songbird', ['temperate', 'european', 'garden'], true, '3474', 'common-blackbird-2-s3474', 'Common blackbird #2'],
  ['songbird-blackbird-5', 'songbird', ['temperate', 'european', 'garden'], true, '3478', 'common-blackbird-5-s3478', 'Common blackbird #5'],
  ['songbird-blackbird-10', 'songbird', ['temperate', 'european', 'woodland'], true, '3483', 'common-blackbird-10-s3483', 'Common blackbird #10'],
  ['songbird-awakening', 'songbird', ['temperate', 'dawn', 'woodland'], true, '0222', 'awakening-birds-s0222', 'Awakening birds'],
  ['songbird-evening', 'songbird', ['temperate', 'dusk', 'garden'], true, '1859', 'evening-birds-s1859', 'Evening birds'],
  // ---- owl ----
  ['owl-tawny-1', 'owl', ['temperate', 'night', 'european'], false, '1763', 'tawny-owl-1-s1763', 'Tawny owl #1'],
  ['owl-tawny-2', 'owl', ['temperate', 'night', 'woodland'], false, '1764', 'tawny-owl-2-s1764', 'Tawny owl #2'],
  ['owl-barn', 'owl', ['temperate', 'night', 'rural'], false, '1400', 'barn-owl-s1400', 'Barn owl'],
  ['owl-night-birds', 'owl', ['night', 'woodland'], true, '0315', 'birds-at-night-s0315', 'Birds at night'],
  // ---- city-hum / traffic / street ----
  // Warm, calm distant-city murmur recorded from a second-floor Paris balcony at
  // 1 am — a soft traffic wash with no sirens. Region-neutral (urban/temperate)
  // so it is the default city-hum bed on every non-European urban scene. Replaced
  // the harsher crossroads recording "Street and roads" (s0608) the default used.
  ['city-night-murmur', 'city-hum', ['urban', 'temperate'], true, '0680', 'paris-by-night-s0680', 'Paris by Night'],
  ['city-cheerful-street', 'city-hum', ['urban', 'european'], true, '2372', 'cheerful-street-s2372', 'Cheerful street'],
  ['city-pedestrian', 'city-hum', ['urban', 'european', 'calm'], true, '0527', 'small-pedestrian-street-s0527', 'Small pedestrian street'],
  ['traffic-children-street', 'traffic', ['urban'], true, '0370', 'children-in-the-street-s0370', 'Children in the street'],
  // Region-neutral motorway wash that adds depth to the traffic pool so cities
  // without a region-specific street clip get varied road texture, not silence.
  ['traffic-highway', 'traffic', ['urban'], true, '0122', 'highway-s0122', 'Highway'],
  // ---- market / crowd ----
  ['market-covered-1', 'market', ['urban', 'european'], true, '3346', 'covered-market-1-s3346', 'Covered market #1'],
  ['market-crowd', 'market', ['urban'], true, '3515', 'crowd-of-50-60-people-1-s3515', 'Crowd of 50-60 people #1'],
  ['market-spanish-crowd', 'market', ['urban', 'european', 'mediterranean'], true, '0825', 'spanish-crowd-s0825', 'Spanish crowd'],
  // ---- bells ----
  ['bells-church', 'bells', ['european', 'urban'], false, '0135', 'church-bell-s0135', 'Church bell'],
  ['bells-4-church', 'bells', ['european'], false, '0829', '4-church-bells-s0829', '4 church bells'],
  ['bells-tibetan', 'bells', ['asian', 'temple', 'calm'], false, '1109', 'tibetan-bowl-singing-s1109', 'Tibetan bowl, singing'],
  ['bells-bronze', 'bells', ['temple'], false, '2703', 'bronze-bell-1-s2703', 'Bronze bell #1'],
  // Soft mallet strike on a hanging gong, an East/Southeast-Asian temple gong
  // for Buddhist-profile cities (Hanoi, Bangkok, Kyoto). CC0.
  ['bells-gong-temple', 'bells', ['asian', 'temple', 'calm'], false, '1482', 'gong-sweet-s1482', 'Gong, sweet'],
  // ---- fire ----
  ['fire-fireplace', 'fire', ['cold', 'indoor'], true, '0030', 'fireplace-1-s0030', 'Fireplace #1'],
  ['fire-branching-1', 'fire', ['camp', 'rural'], true, '0987', 'big-branching-fire-1-s0987', 'Big branching fire #1'],
  // ---- frogs ----
  ['frogs-1', 'frogs', ['wetland', 'night'], true, '0997', 'frogs-1-s0997', 'Frogs #1'],
  ['frogs-2', 'frogs', ['wetland', 'tropical', 'night'], true, '0998', 'frogs-2-s0998', 'Frogs #2'],
  // ---- seabird (gull) ----
  ['seabird-gulls-harbour', 'seabird', ['coastal', 'harbour'], true, '2573', 'gulls-on-the-harbor-s2573', 'Gulls on the harbour'],
  ['seabird-waves-gulls', 'seabird', ['coastal', 'beach'], true, '0267', 'sea-waves-and-seagulls-s0267', 'Sea waves and seagulls'],
];

/** Wikimedia Commons clips: [clipId, type, tags, sustained, fileName, license, author]. */
const COMMONS = [
  // Note: "Howling_wind" intentionally omitted — too eerie/spooky for a gentle
  // ambient soundscape (see the wind section in BSB above).
  ['waves-pebble', 'waves', ['coastal', 'beach', 'calm'], true, 'On_a_pebble_beach.ogg', 'Public domain', 'earthcalling (Wikimedia Commons)'],
  ['waves-crashing', 'waves', ['coastal', 'storm'], true, 'Oceanwavescrushing.ogg', 'CC BY 3.0', 'Luftrum (Wikimedia Commons)'],
  ['rain-light', 'rain', ['temperate', 'calm'], true, 'Sound_of_light_rainfall.ogg', 'CC BY-SA 4.0', 'Mijesty (Wikimedia Commons)'],
  ['songbird-breeze-birds', 'songbird', ['temperate', 'garden', 'dawn'], true, 'Gentle_breeze_and_birds_singing.ogg', 'Public domain', 'ezwa (Wikimedia Commons)'],
  // ---- jazz / music ----
  ['jazz-park', 'jazz', ['jazz', 'music', 'mellow'], true, 'Jazz at the park.ogg', 'CC0', 'Manwithmetalpig (Wikimedia Commons)'],
  ['jazz-its-a-thing', 'jazz', ['jazz', 'music', 'upbeat'], true, "It's a jazz thing.ogg", 'CC BY 3.0', 'smiling cynic (Wikimedia Commons)'],
  ['jazz-sleepless', 'jazz', ['jazz', 'music', 'mellow', 'late-night'], true, 'Dream a sleepless dream.ogg', 'CC BY 3.0', 'smiling cynic (Wikimedia Commons)'],
  ['jazz-kinda-sorta', 'jazz', ['jazz', 'music', 'mellow'], true, 'Kinda sorta.ogg', 'CC BY 3.0', 'smiling cynic (Wikimedia Commons)'],
  ['jazz-what-can-i-say', 'jazz', ['jazz', 'music', 'upbeat'], true, 'What can i say.ogg', 'CC BY 3.0', 'smiling cynic (Wikimedia Commons)'],
  // ---- bossa nova (Rio signature) ----
  ['bossa-nova-migfus', 'bossa-nova', ['americas', 'neotropical', 'brazil', 'music', 'mellow'], true, '609562 migfus20 background-music.ogg', 'CC BY 4.0', 'Freesound user Migfus20 (Wikimedia Commons)'],
  // ---- Australian kookaburra (Sydney signature) ----
  ['kookaburra-1', 'kookaburra', ['pacific', 'australia', 'forest'], false, 'LaughingKookaburra.ogg', 'Public domain', 'Kuco (Wikimedia Commons)'],
  // ---- Australian Magpie (Gymnorhina tibicen) — Sydney signature carol.
  // Routed through the deep `songbird` pool (not the Eurasian `magpie-*`
  // corvid clips) and region-gated to the Pacific so it stays effectively
  // unique to Sydney, where the tile pins this exact clip. ~12s adult song. ----
  ['songbird-australian-magpie', 'songbird', ['pacific', 'australia', 'garden'], true, 'Magpiesong.ogg', 'CC BY-SA 4.0', 'Meganesia (Wikimedia Commons)'],
  // ---- Lisbon signatures ----
  // Common Swift (Apus apus) — summer swifts screaming over the Alfama rooftops.
  // European/Mediterranean-tagged; pinned by the Lisbon recipe so it stays put.
  ['songbird-common-swift', 'songbird', ['european', 'mediterranean', 'urban', 'garden', 'summer'], true, 'Apus apus - Common Swift XC554033.mp3', 'CC BY-SA 4.0', 'Luis Alvarez Menendez (xeno-canto XC554033, via Wikimedia Commons)'],
  // Tram 28 / Lisbon eléctrico rattle — closest genuine recording on Commons is
  // the Elevador da Bica, Lisbon's iconic yellow hill-tram/funicular. NEW `tram` type.
  ['tram-lisboa-bica', 'tram', ['european', 'urban', 'lisbon'], true, 'Lisboa Elevador da Bica.ogg', 'Public domain', 'Pixelkaspar (Wikimedia Commons)'],
  // Instrumental fado (guitarra portuguesa) drifting from a tavern. NEW `fado` type.
  ['fado-tic-tac', 'fado', ['european', 'portugal', 'music', 'mellow'], true, 'Tic Tac Fado Instrumental.ogg', 'CC BY-SA 3.0', 'PRS (Wikimedia Commons)'],
  // ---- Istanbul signatures ----
  // Adhan / call to prayer — a genuine CC0 recording, kept as a quiet, respectful
  // ambient layer. NEW `adhan` type.
  ['adhan-1', 'adhan', ['urban', 'calm'], true, 'Adhan.ogg', 'CC0', 'Aishatu98 (Wikimedia Commons)'],
  // Turkish taksim — a 1928 Hicaz-makam classical instrumental (public domain).
  // Stands in for a solo ney (no CC ney recording exists on Commons); the same
  // drifting Ottoman-classical genre. NEW `ney` type; tile named "Turkish Taksim".
  ['ney-taksim-hicaz', 'ney', ['music', 'mellow', 'calm'], true, 'Taxim Hicaz (c. 1928).ogg', 'Public domain', 'Ahmed Djewdet (c. 1928), via Wikimedia Commons'],
  // ================================================================
  // Region-specific species pools (sourced & licence-verified via
  // parallel research passes). Continent tags drive the region
  // weighting in soundscapeSelection.ts so distinctive calls stay on
  // their own continent and disperse across unrelated pins.
  // ================================================================
  // ---- European corvids (disperse the lone Blue Jay off unrelated pins) ----
  ['jackdaw-1', 'corvid', ['european', 'urban'], false, 'Corvus monedula calls.ogg', 'CC BY-SA 4.0', 'Veljo Runnel'],
  ['jackdaw-2', 'corvid', ['european', 'urban'], false, 'Coloeus monedula - Western Jackdaw XC436939.mp3', 'CC BY-SA 4.0', 'Joost van Bruggen'],
  ['jackdaw-3', 'corvid', ['european', 'urban'], false, "European Jackdaw's croaking.ogg", 'CC BY-SA 3.0', 'QWerk'],
  ['rook-1', 'corvid', ['european', 'farmland'], false, 'Corvus frugilegus.ogg', 'CC BY-SA 3.0', 'Vladimir Yu. Arkhipov, Arkhivov'],
  ['rook-2', 'corvid', ['european', 'farmland'], false, 'Грач в Лаздинае.ogg', 'CC BY-SA 4.0', 'Кашеед'],
  ['rook-3', 'corvid', ['european', 'farmland'], true, 'Rooks in rookery and nests sounds.wav', 'CC BY-SA 4.0', 'Alwayswonder'],
  ['magpie-1', 'corvid', ['european', 'garden'], false, 'Pica pica - Eurasian Magpie XC432921.mp3', 'CC BY-SA 4.0', 'Joost van Bruggen'],
  ['magpie-2', 'corvid', ['european', 'garden'], false, 'Pica pica - Eurasian Magpie XC537413.mp3', 'CC BY-SA 4.0', 'Benoît Van Hecke'],
  ['carrion-crow-1', 'corvid', ['european', 'woodland'], false, 'Corvus corone - Carrion Crow XC511945.mp3', 'CC BY-SA 4.0', 'Marie-Lan Taÿ Pamart'],
  ['carrion-crow-2', 'corvid', ['european', 'woodland'], false, 'Corvus corone - Carrion Crow XC491082.mp3', 'CC BY-SA 4.0', 'Marie-Lan Taÿ Pamart'],
  ['jay-1', 'corvid', ['european', 'woodland'], false, 'Garrulus glandarius - Eurasian Jay XC461843.mp3', 'CC BY-SA 4.0', 'Marie-Lan Taÿ Pamart'],
  ['jay-2', 'corvid', ['european', 'woodland'], false, 'Garrulus glandarius - Eurasian Jay XC395872.mp3', 'CC BY-SA 4.0', 'Alvaro Ortiz Troncoso'],
  // ---- European owls ----
  ['tawny-owl-xc-1', 'owl', ['european', 'woodland', 'night'], false, 'Strix aluco - Tawny Owl XC494801.mp3', 'CC BY-SA 4.0', 'Alvaro Ortiz Troncoso'],
  ['tawny-owl-xc-2', 'owl', ['european', 'woodland', 'night'], false, 'Strix aluco - Tawny Owl XC563348.mp3', 'CC BY-SA 4.0', 'Alvaro Ortiz Troncoso'],
  ['little-owl-1', 'owl', ['european', 'farmland', 'night'], false, 'Athene noctua - Little Owl XC432927.mp3', 'CC BY-SA 4.0', 'Joost van Bruggen'],
  ['little-owl-2', 'owl', ['european', 'farmland', 'night'], false, 'Little owl, steenuil.wav', 'CC BY-SA 3.0', 'Klankbeeld'],
  ['eagle-owl-1', 'owl', ['european', 'woodland', 'night'], false, 'Bubo bubo - Eurasian Eagle-Owl XC604112.mp3', 'CC BY-SA 4.0', 'Robert Petersen'],
  ['eagle-owl-2', 'owl', ['european', 'woodland', 'night'], false, 'BuboBuboMariankaSlovakia2012.ogg', 'CC BY-SA 4.0', 'Michal Noga'],
  ['long-eared-owl-1', 'owl', ['european', 'woodland', 'night'], false, 'Asio otus - Long-eared Owl XC108293.mp3', 'CC BY-SA 4.0', 'Alexander Kurthy'],
  ['long-eared-owl-2', 'owl', ['european', 'woodland', 'night'], false, 'Asio otus - Long-eared Owl XC513604.mp3', 'CC BY-SA 4.0', 'JACOB Hervé'],
  // ---- European seabirds (widen beyond gulls: tern, puffin, kittiwake, gannet) ----
  ['herring-gull-1', 'seabird', ['european', 'coastal'], false, 'Larus argentatus - European Herring Gull XC436943.mp3', 'CC BY-SA 4.0', 'Joost van Bruggen'],
  ['herring-gull-2', 'seabird', ['european', 'coastal'], false, 'XC707075 - European Herring Gull - Larus argentatus.mp3', 'CC0', 'Sonothèque ADVL'],
  ['kittiwake-1', 'seabird', ['european', 'coastal'], true, 'Kittiwake (Rissa tridactyla) (W1CDR0001389 BD30).ogg', 'CC BY-SA 4.0', 'British Library'],
  ['common-tern-1', 'seabird', ['european', 'coastal'], false, 'Sterna-hirundo-002.ogg', 'CC BY-SA 3.0', 'Mdf'],
  ['puffin-1', 'seabird', ['european', 'coastal', 'cold'], true, 'Atlantic Puffin (Fratercula arctica) (W1CDR0001416 BD3).ogg', 'CC BY-SA 4.0', 'British Library'],
  ['gannet-1', 'seabird', ['european', 'coastal'], true, 'Northern Gannet (Morus bassanus) (W1CDR0001422 BD11).ogg', 'CC BY-SA 4.0', 'British Library'],
  ['arctic-tern-1', 'seabird', ['european', 'coastal', 'cold'], false, 'Sterna paradisaea - Arctic Tern XC564600.mp3', 'CC BY-SA 4.0', 'Doug Hynes'],
  ['arctic-tern-2', 'seabird', ['european', 'coastal', 'cold'], true, 'Holm of Papa Sterna paradisaea.wav', 'CC BY-SA 4.0', 'Gunther Tschuch'],
  // ---- North African / Mediterranean songbirds ----
  ['laughing-dove-1', 'songbird', ['mediterranean', 'arid'], true, 'Spilopelia senegalensis call in Tehran.ogg', 'CC BY-SA 4.0', 'MRG90'],
  ['laughing-dove-2', 'songbird', ['mediterranean', 'arid'], true, 'S-senegalensis.ogg', 'CC BY 2.5', 'L. Shyamal'],
  ['nightingale-1', 'songbird', ['mediterranean', 'european', 'garden'], true, 'Luscinia megarhynchos - Common Nightingale XC546171.mp3', 'CC BY-SA 4.0', 'Benoît Van Hecke'],
  ['nightingale-2', 'songbird', ['mediterranean', 'european', 'garden'], true, 'Luscinia megarhynchos - Common Nightingale XC473316.mp3', 'CC BY-SA 4.0', 'Marie-Lan Taÿ Pamart'],
  ['bee-eater-1', 'songbird', ['mediterranean', 'arid'], false, 'Merops apiaster - European Bee-eater XC477953.mp3', 'CC BY-SA 4.0', 'Pascal Christe'],
  // ---- European songbirds ----
  ['robin-1', 'songbird', ['european', 'garden'], true, 'Erithacus rubecula - European Robin XC507779.mp3', 'CC BY-SA 4.0', 'Marie-Lan Taÿ Pamart'],
  ['robin-2', 'songbird', ['european', 'garden'], true, 'Erithacus rubecula - European Robin XC542842.mp3', 'CC BY-SA 4.0', 'Benoît Van Hecke'],
  ['chaffinch-1', 'songbird', ['european', 'woodland'], true, 'Fringilla coelebs - Common Chaffinch XC477912.mp3', 'CC BY-SA 4.0', 'Marie-Lan Taÿ Pamart'],
  ['chaffinch-2', 'songbird', ['european', 'woodland'], true, 'Fringilla coelebs - Common Chaffinch XC489896.mp3', 'CC BY-SA 4.0', 'Hannu Varkki'],
  ['blackcap-1', 'songbird', ['european', 'woodland'], true, 'Sylvia atricapilla - Eurasian Blackcap XC576666.mp3', 'CC BY-SA 4.0', 'Benoît Van Hecke'],
  ['blackcap-2', 'songbird', ['european', 'woodland'], true, 'Sylvia atricapilla - Eurasian Blackcap XC282805.mp3', 'CC BY-SA 4.0', 'Alexander Kurthy'],
  ['song-thrush-1', 'songbird', ['european', 'garden'], true, 'Turdus philomelos - Song Thrush XC541754.mp3', 'CC BY-SA 4.0', 'Benoît Van Hecke'],
  ['song-thrush-2', 'songbird', ['european', 'garden'], true, 'Turdus philomelos - Song Thrush XC436363.mp3', 'CC BY-SA 4.0', 'Joost van Bruggen'],
  ['goldfinch-1', 'songbird', ['european', 'garden'], true, 'Carduelis carduelis - Spring call.oga', 'CC BY 4.0', 'Ewithu'],
  ['goldfinch-2', 'songbird', ['european', 'garden'], true, 'Carduelis carduelis - European Goldfinch XC473287.mp3', 'CC BY-SA 4.0', 'Marie-Lan Taÿ Pamart'],
  // ---- Asian primates (break the fixed Neotropical howler for SE Asia) ----
  ['primates-lar-gibbon', 'primates', ['asian', 'tropical', 'forest'], true, 'Lar Gibbon hoots.ogg', 'CC BY-SA 3.0', 'FunkMonk'],
  ['primates-siamang', 'primates', ['asian', 'tropical', 'forest'], true, 'Hylobates syndactylus calling 3588.ogg', 'Public domain', 'Dori'],
  // ---- Asian tropical birds (break the fixed Neotropical toucan/quetzal) ----
  ['tropical-bird-asian-koel', 'tropical-bird', ['asian', 'tropical', 'forest', 'garden'], true, 'Eudynamys scolopaceus - Asian Koel XC476378.mp3', 'CC BY-SA 4.0', 'Manoj Karingamadathil'],
  ['tropical-bird-racket-tailed-drongo', 'tropical-bird', ['asian', 'tropical', 'forest'], true, 'Dicrurus paradiseus - Greater Racket-tailed Drongo XC124717.ogg', 'CC BY-SA 3.0', 'Sudipto Roy'],
  ['tropical-bird-red-whiskered-bulbul', 'tropical-bird', ['asian', 'tropical', 'forest', 'garden'], true, 'Pycnonotus jocosus (Red-whiskered Bulbul).wav', 'CC BY-SA 4.0', 'Subhashish Panigrahi'],
  ['tropical-bird-great-hornbill', 'tropical-bird', ['asian', 'tropical', 'forest'], false, 'Great hornbill , Buceros bicornis,call.wav', 'CC BY-SA 4.0', 'Shino jacob koottanad'],
  // ---- Asian songbirds ----
  ['songbird-japanese-bush-warbler-uguisu', 'songbird', ['asian', 'temperate', 'forest', 'garden'], true, 'Uguisu5707.ogg', 'CC BY 2.1 jp', 'Jnn'],
  ['songbird-japanese-bush-warbler-2', 'songbird', ['asian', 'temperate', 'forest', 'garden'], true, 'Japanese nightingale note01.ogg', 'CC BY-SA 3.0', 'Unknown'],
  ['songbird-brown-eared-bulbul', 'songbird', ['asian', 'temperate', 'garden'], false, 'Hypsipetes-amaurotis-2025-05-20-282617142.ogg', 'CC BY 4.0', 'karliatje'],
  // ---- Asian owls ----
  ['owl-collared-scops-owl', 'owl', ['asian', 'tropical', 'forest', 'night'], false, 'CollaredScopsOwl-BirdCall.ogg', 'CC BY-SA 4.0', 'AnupreetBorkar'],
  ['owl-brown-hawk-owl', 'owl', ['asian', 'tropical', 'forest', 'night'], false, 'Ninox scutulata - Brown Hawk-Owl XC382468.mp3', 'CC BY-SA 4.0', 'Manoj Karingamadathil'],
  // ---- Asian corvid ----
  ['corvid-large-billed-crow', 'corvid', ['asian', 'mountain', 'forest'], false, '20190712-1226 himalayan crow.ogg', 'CC BY-SA 4.0', 'Shyamal L.'],
  // ---- Asian insects & frog ----
  ['insects-higurashi-cicada', 'insects', ['asian', 'temperate', 'forest', 'summer', 'night'], true, 'Tanna japonensis v01.ogg', 'CC BY 4.0', 'Σ64'],
  ['insects-min-min-cicada', 'insects', ['asian', 'temperate', 'forest', 'summer'], true, 'HyalessaFuscata KR.flac', 'CC0', '金旻秀 (kim.min.su)'],
  ['insects-higurashi-2', 'insects', ['asian', 'temperate', 'forest', 'summer', 'night'], true, 'Higurashi 20180728 1902.ogg', 'CC BY-SA 3.0', 'あおもりくま'],
  ['frogs-kajika', 'frogs', ['asian', 'temperate', 'night', 'summer'], true, 'Buergeria buergeri.ogg', 'CC BY-SA 4.0', 'リトルスター'],
  // ---- Neotropical songbirds (Andes / Patagonia) ----
  ['songbird-southern-lapwing', 'songbird', ['americas', 'neotropical'], false, 'Vanellus Chilensis.ogg', 'CC BY-SA 2.5', 'Eurico Zimbres'],
  ['songbird-rufous-collared-sparrow', 'songbird', ['americas', 'neotropical'], true, 'Canto de un Zonotrichia capensis.ogg', 'CC BY-SA 4.0', 'Santga'],
  // ---- Neotropical primate + tropical bird ----
  ['primates-mantled-howler', 'primates', ['americas', 'neotropical', 'tropical', 'forest'], true, 'Mantled Howler Monkey (Alouatta palliata) (W ALOUATTA PALLIATA R1 C2).ogg', 'CC BY 4.0', 'Richard Ranft'],
  ['tropical-bird-chestnut-headed-oropendola', 'tropical-bird', ['americas', 'neotropical', 'tropical', 'forest'], false, 'Psarocolius wagleri - Chestnut-headed Oropendola XC251419.mp3', 'CC BY-SA 4.0', 'Niels Krabbe'],
  // ---- Sub-Saharan African primate, birds & owl ----
  ['primates-vervet', 'primates', ['african', 'savanna'], false, 'Vervet Monkey (Chlorocebus pygerythrus) (W CERCOPITHECUS AETHIOPS R2 C2).ogg', 'CC BY 4.0', 'British Library'],
  ['tropical-bird-african-fish-eagle', 'tropical-bird', ['african', 'savanna'], false, 'En-us-African fish eagle.ogg', 'CC BY 4.0', 'Paul2520'],
  ['tropical-bird-great-blue-turaco', 'tropical-bird', ['african', 'forest'], false, 'Great Blue Turaco (Corythaeola cristata) (022A-WA03044X0043-0035M0).ogg', 'CC BY 4.0', 'A.R. Gregory'],
  ['tropical-bird-hadada-ibis', 'tropical-bird', ['african', 'savanna'], false, 'Hadada Ibis (Bostrychia hagedash) (022A-WA03044X0019-0013M0).ogg', 'CC BY 4.0', 'A.R. Gregory'],
  ['songbird-cape-robin-chat', 'songbird', ['african', 'garden', 'mountain'], true, 'Cossypha caffra, 2 sing voor sonop, Pretoria, a.ogg', 'CC BY-SA 4.0', 'JMK'],
  ['owl-pearl-spotted-owlet', 'owl', ['african', 'savanna', 'night'], false, 'Glaucidium perlatum, twee roep te Hartbeesfontein, 2022-06-25 15h35, a.mp3', 'CC BY-SA 4.0', 'JMK'],
  // Ring-necked / Cape turtle dove — the quintessential background coo of the
  // East-African savanna (pinned by the Serengeti recipe).
  ['songbird-cape-turtle-dove', 'songbird', ['african', 'savanna', 'arid'], true, 'Streptopelia capicola abunda, roep, 17 s, Bronberg, a.mp3', 'CC BY-SA 4.0', 'JMK'],
  // ---- Serengeti signature: distant lion roar (NEW `lion` type) ----
  ['lion-roar-1', 'lion', ['african', 'savanna', 'arid'], false, 'Lion raring-sound1TamilNadu178.ogg', 'Public domain', 'தகவலுழவன் (Wikimedia Commons)'],
  // ---- Morepork / ruru (Queenstown, Auckland). No CC recording of Ninox
  // novaeseelandiae exists on Commons, so the near-identical call of its
  // congener, the Southern Boobook (Ninox boobook), stands in. STAND-IN FLAG. ----
  ['owl-morepork-ruru', 'owl', ['pacific', 'nz', 'night'], false, 'Ninox boobook - Southern Boobook XC442607.mp3', 'CC BY-SA 4.0', 'James Ray (xeno-canto XC442607, via Wikimedia Commons)'],
  // White-throated Sparrow (Zonotrichia albicollis) — the "Oh sweet Canada"
  // whistle of the northern woods. Routed through the deep songbird pool and
  // nearctic-tagged so it disperses onto nearctic pins.
  ['songbird-white-throated-sparrow', 'songbird', ['americas', 'nearctic', 'boreal', 'woodland'], true, 'Zonotrichia albicollis - White-throated Sparrow XC138634.ogg', 'CC BY-SA 3.0', 'Jonathon Jongsma (xeno-canto XC138634, via Wikimedia Commons)'],
  // ---- Redwoods (Northern California coast-redwood forest) signatures ----
  // Common Raven (Corvus corax) — a genuine NPS Yellowstone Sound Library
  // recording of the croaking flight call, public domain. Nearctic-tagged and
  // pinned by the Redwoods recipe so the corvid stays put.
  ['corvid-common-raven', 'corvid', ['americas', 'nearctic', 'forest', 'woodland'], false, 'Yellowstone sound library - Common Raven - 001.mp3', 'Public domain', 'NPS / David Restivo (Wikimedia Commons)'],
  // Steller's Jay (Cyanocitta stelleri) — the crested blue jay of western North
  // American conifer forests, pinned by the Redwoods recipe. Nearctic-tagged.
  ['corvid-stellers-jay', 'corvid', ['americas', 'nearctic', 'forest', 'woodland'], false, "Cyanocitta stelleri - Steller's Jay XC109653.mp3", 'CC BY-SA 3.0', 'Jonathon Jongsma (xeno-canto XC109653, via Wikimedia Commons)'],
  // ---- Paris signatures ----
  // House Sparrow (Passer domesticus) — the ubiquitous chirping of the Tuileries
  // and Luxembourg gardens, pinned by the Paris recipe. European/urban-tagged.
  ['songbird-house-sparrow', 'songbird', ['european', 'urban', 'garden'], true, 'Passer domesticus - House Sparrow XC543237.mp3', 'CC BY-SA 4.0', 'Benoît Van Hecke (xeno-canto XC543237, via Wikimedia Commons)'],
  // Musette accordion — a warm French café musette drifting over a terrace. No
  // genuine field recording of a Parisian street musette exists on Commons, so
  // this openly-licensed solo-accordion musette stands in. STAND-IN FLAG. NEW `musette` type.
  ['musette-duet', 'musette', ['european', 'french', 'music', 'mellow'], true, 'Duet Musette (ISRC USUAN1100250).mp3', 'CC BY 3.0', 'Kevin MacLeod (incompetech.com, via Wikimedia Commons)'],
  // ================================================================
  // Regional CITY AMBIENCE / TRAFFIC + MARKET pools (P0 sourcing).
  // Genuine field recordings, continent-tagged so the picker lands a
  // region-true street/market on non-European cities instead of the old
  // European-only city hum. See scripts/audio-gap-list.md for the gaps
  // (South-Asian / Middle-Eastern street) that have no CC recording yet.
  // ================================================================
  // ---- Southeast-Asian street traffic (Manila jeepney ride), the busy-street
  // base bed for motorbike/jeepney-profile cities (Hanoi, Bangkok, Jakarta). ----
  ['traffic-manila-jeepney', 'traffic', ['asian', 'seasian', 'urban'], true, 'Jeepney Makati-Pasay.ogg', 'CC BY-SA 4.0', 'YoeriMeulemans (Wikimedia Commons)'],
  // ---- Southeast-Asian night markets (Carbon Market, Cebu City) ----
  ['market-cebu-night', 'market', ['asian', 'seasian', 'urban', 'night'], true, 'Carbon Market at Night in Cebu City.ogg', 'CC BY-SA 4.0', 'Bim24 (Wikimedia Commons)'],
  ['market-cebu-soundscape', 'market', ['asian', 'seasian', 'urban', 'night'], true, 'Carbon Market Night soundscapes.ogg', 'CC BY 4.0', 'Bim24 (Wikimedia Commons)'],
  // ---- Sub-Saharan African city (Lagos, Nigeria, Emeka Ogboh field recordings) ----
  ['traffic-lagos-obalende', 'traffic', ['african', 'urban'], true, 'Obalende bus park, Lagos Nigeria (Emeka Ogboh).ogg', 'CC BY-SA 3.0', 'Emeka Ogboh (Wikimedia Commons)'],
  ['market-lagos-idumota', 'market', ['african', 'urban'], true, 'Idumota Market (Emeka Ogboh).ogg', 'CC BY-SA 3.0', 'Emeka Ogboh (Wikimedia Commons)'],
  // ---- Latin-American city centre (Aguascalientes, Mexico, street vendors) ----
  ['city-latam-aguascalientes', 'city-hum', ['americas', 'urban'], true, 'Paisaje sonoro del centro de la ciudad.ogg', 'CC BY-SA 4.0', 'PamStan (Wikimedia Commons)'],
  // ---- Asian urban birds (the koel/bulbul already exist as tropical-bird; add
  // the two most ubiquitous Asian city songbirds: Common Myna & Tree Sparrow) ----
  ['songbird-common-myna', 'songbird', ['asian', 'urban', 'garden'], true, 'Acridotheres tristis - Common Myna XC508591.mp3', 'CC BY-SA 4.0', 'James Ray (xeno-canto XC508591, via Wikimedia Commons)'],
  ['songbird-tree-sparrow', 'songbird', ['asian', 'urban', 'garden'], true, 'Passer montanus - Eurasian Tree Sparrow XC347806.mp3', 'CC BY-SA 4.0', 'Derek Paulo (xeno-canto XC347806, via Wikimedia Commons)'],
];

/**
 * Legacy in-repo clips already downloaded by scripts/download-audio.sh.
 * Folded into the manifest so they remain attributed and join the pools.
 * [clipId, type, tags, sustained, src, title, author, license, sourceUrl]
 */
const LEGACY = [
  ['legacy-surf', 'waves', ['coastal'], true, '/audio/nz/surf-loop.ogg', 'Adriatic Sea waves', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Adriatic_Sea_waves.ogg'],
  ['legacy-rain-canopy', 'rain', ['tropical', 'storm'], true, '/audio/costa-rica/rain-canopy.mp3', 'Rain and Thunder #20', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/storm-and-rain-4-s2719.html'],
  ['legacy-stream-distant', 'stream', ['forest'], true, '/audio/costa-rica/stream-distant.mp3', 'Forest and Stream #1', 'Pierre SIBANARCO — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/forest-and-stream-1-s2713.html'],
  ['legacy-forest-ambience', 'forest', ['temperate', 'woodland'], true, '/audio/nz/forest-ambience.mp3', 'Forest', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/forest-s0100.html'],
  // Note: legacy-wind (the plain BigSoundBank "Wind s0595") was retired from the
  // pool in the curation pass; the file stays only as a src fallback. The new
  // default breeze is `wind-fir-forest` (LOCAL list).
  ['legacy-insect-chorus', 'insects', ['tropical', 'night'], true, '/audio/costa-rica/insect-chorus.mp3', 'Nocturnal Insects #4', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/nocturnal-insects-4-s1470.html'],
  ['legacy-tui', 'songbird', ['pacific', 'nz', 'native'], true, '/audio/nz/tui-loop.ogg', 'Tui song — Trelissick Park', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Tui_song_-_Trelissick_Park_-8_March_2021.ogg'],
  ['legacy-bellbird', 'songbird', ['pacific', 'nz', 'native'], true, '/audio/nz/bellbird-loop.ogg', 'New Zealand Bellbird', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:New_Zealand_Bellbird_(Anthornis_melanura).ogg'],
  ['legacy-blackbird', 'songbird', ['temperate', 'european', 'garden'], true, '/audio/nz/fantail-loop.ogg', 'Common Blackbird song', 'British Library / Wikimedia Commons', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Common_Blackbird_song_(Turdus_merula).ogg'],
  // This "morepork" file is actually a South-American Peruvian Pygmy Owl
  // (Glaucidium peruanum); retagged americas/neotropical so it stops resolving
  // onto NZ/Pacific pins. Genuine NZ ruru now comes from `owl-morepork-ruru`.
  ['legacy-morepork', 'owl', ['americas', 'neotropical', 'night'], false, '/audio/nz/morepork-call.ogg', 'Peruvian Pygmy Owl call (Glaucidium peruanum)', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Pacific_Pygmy_Owl_call_(Glaucidium_peruanum).ogg'],
  ['legacy-gull', 'seabird', ['coastal', 'european'], true, '/audio/nz/gull-call.ogg', 'Herring Gull', 'British Library / Wikimedia Commons', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Herring_Gull_(Larus_argentatus)_(W1CDR0001420_BD12).ogg'],
  ['legacy-toucan', 'tropical-bird', ['tropical', 'jungle', 'americas', 'neotropical'], false, '/audio/costa-rica/toucan-call.ogg', 'Toco Toucan call', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Toco_Toucan_call_(Ramphastos_toco).ogg'],
  ['legacy-quetzal', 'tropical-bird', ['tropical', 'cloud-forest', 'americas', 'neotropical'], true, '/audio/costa-rica/quetzal-song.ogg', 'Resplendent Quetzal song', 'Wikimedia Commons contributor', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Resplendent_Quetzal_song_(Pharomachrus_mocinno).ogg'],
  ['legacy-howler', 'primates', ['tropical', 'jungle', 'americas', 'neotropical'], true, '/audio/costa-rica/howler-distant.mp3', 'Hall of the monkeys (primate ambience)', 'Joseph SARDIN — BigSoundBank.com', 'CC0 1.0', 'https://bigsoundbank.com/hall-of-the-monkeys-of-the-menagerie-of-paris-s1004.html'],
  ['legacy-catbird', 'songbird', ['temperate', 'americas', 'garden'], true, '/audio/bed-stuy/gray-catbird.ogg', 'Gray Catbird', 'G. McGrane', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Gray_Catbird.ogg'],
  ['legacy-cardinal', 'songbird', ['temperate', 'americas', 'garden'], true, '/audio/bed-stuy/northern-cardinal.ogg', 'Northern Cardinal song (XC125284)', 'Xeno-canto / Wikimedia Commons', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Cardinalis_cardinalis_-_Northern_Cardinal_XC125284.ogg'],
  ['legacy-blue-jay', 'corvid', ['temperate', 'americas'], false, '/audio/bed-stuy/blue-jay.ogg', 'Blue Jay call (XC86756)', 'Jonathon Jongsma / Xeno-canto', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Cyanocitta_cristata_-_Blue_Jay_-_XC86756.ogg'],
];

/**
 * Locally-prepared pool clips that can't come straight from Special:FilePath —
 * e.g. a large Commons original transcoded to a smaller, loop-friendly file.
 * These are committed under public/audio and only verified for existence here.
 * [clipId, type, tags, sustained, src, title, author, license, sourceUrl]
 */
const LOCAL = [
  // A calm, natural fir-forest wind (the new default breeze). The Commons
  // original is a 11 MB Ogg; we ship the site's 64 kbps MP3 transcode (~6 MB).
  ['wind-fir-forest', 'wind', ['forest', 'temperate', 'calm'], true, '/audio/pool/wind/wind-fir-forest.mp3', 'Wind in the spruces, Vijlenerbos (transcoded 64 kbps MP3 of the CC BY 3.0 original)', 'luc de bruijn (Wikimedia Commons)', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Wind_in_sparren_in_het_Vijlenerbos_-_SoundCloud_-_luc_de_bruijn.ogg'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url, dest) {
  if (existsSync(dest)) {
    const info = await stat(dest);
    if (info.size >= MIN_BYTES) return { ok: true, bytes: info.size, cached: true };
  }
  // Wikimedia rate-limits bursts (HTTP 429) and occasionally 5xxs; retry a few
  // times with exponential back-off so a full pool fetch survives throttling.
  let lastReason = 'unknown';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let res;
    // Guard against connections that accept but never respond: without a
    // timeout a single stalled fetch hangs the whole pool regeneration.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: '*/*' },
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (err) {
      lastReason = `fetch error: ${err.message}`;
      await sleep(1000 * 2 ** attempt);
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      lastReason = `HTTP ${res.status}`;
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      return { ok: false, reason: lastReason };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_BYTES) return { ok: false, reason: `too small (${buf.length}B)` };
    if (buf.length > MAX_BYTES) return { ok: false, reason: `too large (${Math.round(buf.length / 1024)}KB)` };
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    return { ok: true, bytes: buf.length };
  }
  return { ok: false, reason: lastReason };
}

const manifest = [];
let okCount = 0;
let failCount = 0;

for (const [id, type, tags, sustained, num, slug, title] of BSB) {
  const src = `/audio/pool/${type}/${id}.mp3`;
  const dest = join(POOL_ROOT, type, `${id}.mp3`);
  const result = await download(bsbMp3(num), dest);
  if (!result.ok) {
    console.warn(`✗ ${id} (${slug}): ${result.reason}`);
    failCount += 1;
    continue;
  }
  okCount += 1;
  console.log(`✓ ${id} ${result.cached ? '(cached)' : `${Math.round(result.bytes / 1024)}KB`}`);
  manifest.push({ id, type, tags, sustained, src, title, author: bsbAuthor, license: bsbLicense, sourceUrl: bsbUrl(slug) });
}

for (const [id, type, tags, sustained, file, license, author] of COMMONS) {
  const ext = file.split('.').pop();
  const src = `/audio/pool/${type}/${id}.${ext}`;
  const dest = join(POOL_ROOT, type, `${id}.${ext}`);
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
  const result = await download(url, dest);
  if (!result.ok) {
    console.warn(`✗ ${id} (${file}): ${result.reason}`);
    failCount += 1;
    continue;
  }
  okCount += 1;
  console.log(`✓ ${id} ${result.cached ? '(cached)' : `${Math.round(result.bytes / 1024)}KB`}`);
  manifest.push({
    id, type, tags, sustained, src,
    title: file.replace(/_/g, ' ').replace(/\.[^.]+$/, ''),
    author, license,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${file}`,
  });
}

for (const [id, type, tags, sustained, src, title, author, license, sourceUrl] of LEGACY) {
  const dest = join(ROOT, 'public', src.replace(/^\//, ''));
  if (!existsSync(dest)) {
    console.warn(`✗ ${id}: missing legacy file ${src} (run scripts/download-audio.sh)`);
    failCount += 1;
    continue;
  }
  okCount += 1;
  manifest.push({ id, type, tags, sustained, src, title, author, license, sourceUrl });
}

for (const [id, type, tags, sustained, src, title, author, license, sourceUrl] of LOCAL) {
  const dest = join(ROOT, 'public', src.replace(/^\//, ''));
  if (!existsSync(dest)) {
    console.warn(`✗ ${id}: missing local file ${src}`);
    failCount += 1;
    continue;
  }
  okCount += 1;
  manifest.push({ id, type, tags, sustained, src, title, author, license, sourceUrl });
}

// Selection-weight overrides. The wind pool leans slightly toward the softest
// breezes (a breeze through a tree, through tall grass) so the calm ambient
// default favours the gentlest recordings.
const WEIGHT_OVERRIDES = {
  // The new calm fir-forest breeze dominates; the soft textured breezes stay as
  // variety; the plainer "Wind s0595" hiss recordings are demoted so scenes lead
  // with the nicer, more natural wind.
  'wind-fir-forest': 5,
  'wind-in-tree': 1.5,
  'wind-tall-grass': 1.5,
};
for (const clip of manifest) {
  const w = WEIGHT_OVERRIDES[clip.id];
  if (w != null) clip.weight = w;
}

// Signature species that must stay unique to the single pin that pins them via
// `fixedClipId`: excluded from the dispersion/weighted pools so they never leak
// onto unrelated same-continent pins (see soundscapeSelection `pinnedOnly`).
const PINNED_ONLY = new Set(['corvid-common-raven', 'corvid-stellers-jay']);
for (const clip of manifest) {
  if (PINNED_ONLY.has(clip.id)) clip.pinnedOnly = true;
}

manifest.sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type.localeCompare(b.type)));

const banner = `// AUTO-GENERATED by scripts/download-audio-variants.mjs — do not edit by hand.\n// Each entry is one openly-licensed audio clip with its required attribution.\n`;
const body = `import type { SoundClip } from './types';\n\nexport const soundClips: SoundClip[] = ${JSON.stringify(manifest, null, 2)};\n`;
await writeFile(MANIFEST_OUT, banner + body, 'utf8');

console.log(`\nManifest: ${manifest.length} clips written to ${MANIFEST_OUT}`);
console.log(`Downloaded/verified: ${okCount} ok, ${failCount} failed/skipped.`);

// Sanity: confirm we still parse as plausible JSON-ish (no NaN etc.)
const text = await readFile(MANIFEST_OUT, 'utf8');
if (!text.includes('export const soundClips')) {
  console.error('Manifest generation looks wrong.');
  process.exit(1);
}
