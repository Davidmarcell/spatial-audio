import type { SoundDef, SoundType, VariantTag } from '../data/types';

/**
 * Migration glue: derive a pool `type` and biome/region `variantTags` for the
 * existing curated/global sounds (which predate the typed pool model) from
 * their id, name, and keywords. Sounds that already declare a `type`/`tags`
 * (e.g. procedural scenes) are left untouched.
 */

type Rule = { type: SoundType; test: RegExp };

// Order matters: the first matching rule wins (most specific first).
const TYPE_RULES: Rule[] = [
  // Jazz must beat the `city-hum` /street/ rule below (e.g. "street jazz busker").
  { type: 'jazz', test: /jazz|busker|saxophone|\bmusic\b/ },
  { type: 'primates', test: /howler|primate|monkey|ape/ },
  { type: 'owl', test: /owl|morepork|ruru|nocturnal/ },
  { type: 'seabird', test: /gull|seagull|seabird/ },
  { type: 'corvid', test: /\bjay\b|crow|magpie|raven|rook/ },
  { type: 'tropical-bird', test: /toucan|quetzal|tropical|parrot|jungle|hill-bird|understory/ },
  { type: 'thunder', test: /thunder/ },
  { type: 'rain', test: /rain|monsoon|drizzle|shower|storm/ },
  { type: 'waves', test: /surf|wave|ocean|sea\b|copacabana|atlantic|breakers/ },
  { type: 'stream', test: /stream|creek|brook|river|fountain|water|thames/ },
  { type: 'city-hum', test: /traffic|city|harbou?r-traffic|distant-city|motorway|highway|street/ },
  { type: 'insects', test: /insect|cicada|cricket|bug/ },
  { type: 'forest', test: /forest|bush|canopy|woodland|rustle|domain|valley|bamboo|floor|ambience|park/ },
  { type: 'wind', test: /wind|breeze|gust/ },
];

const TAG_RULES: Array<{ tag: VariantTag; test: RegExp }> = [
  { tag: 'tropical', test: /tropical|jungle|rainforest|toucan|quetzal|monsoon|howler/ },
  { tag: 'alpine', test: /alpine|dolomite/ },
  { tag: 'mountain', test: /mountain|alpine|dolomite|valley|highland/ },
  { tag: 'cold', test: /alpine|snow|glacier|arctic/ },
  { tag: 'coastal', test: /coast|surf|harbou?r|beach|gull|seabird|copacabana|atlantic|pacific|thames|wave|ocean/ },
  { tag: 'nz', test: /tui|bellbird|fantail|morepork|piwakawaka|waitemata|auckland|kiwi/ },
  { tag: 'native', test: /tui|bellbird|fantail|morepork|native/ },
  { tag: 'urban', test: /urban|city|traffic|street|brownstone/ },
  { tag: 'night', test: /owl|night|nocturnal|evening/ },
  { tag: 'woodland', test: /forest|bush|canopy|woodland/ },
  { tag: 'garden', test: /garden|park|backyard/ },
  { tag: 'summer', test: /summer|cicada/ },
];

function haystack(sound: SoundDef): string {
  return [sound.id, sound.name, sound.description ?? '', ...(sound.keywords ?? [])]
    .join(' ')
    .toLowerCase();
}

export function inferSoundType(sound: SoundDef): SoundType | undefined {
  if (sound.type) return sound.type;
  const text = haystack(sound);
  for (const rule of TYPE_RULES) {
    if (rule.test.test(text)) return rule.type;
  }
  if (sound.category === 'bird') return 'songbird';
  if (sound.category === 'insect') return 'insects';
  if (sound.category === 'water') return 'stream';
  if (sound.category === 'ambient') return 'wind';
  return undefined;
}

export function inferVariantTags(sound: SoundDef, regionTags: VariantTag[] = []): VariantTag[] {
  const text = haystack(sound);
  const tags = new Set<VariantTag>([...(sound.variantTags ?? []), ...regionTags]);
  for (const rule of TAG_RULES) {
    if (rule.test.test(text)) tags.add(rule.tag);
  }
  return [...tags];
}

/** Return a copy of the sound enriched with an inferred type + variant tags. */
export function enrichSound(sound: SoundDef, regionTags: VariantTag[] = []): SoundDef {
  return {
    ...sound,
    type: inferSoundType(sound),
    variantTags: inferVariantTags(sound, regionTags),
  };
}

export function enrichSounds(sounds: SoundDef[], regionTags: VariantTag[] = []): SoundDef[] {
  return sounds.map((sound) => enrichSound(sound, regionTags));
}
