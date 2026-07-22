import type { SoundDef, SoundType, VariantTag } from '../data/types';

/**
 * Migration glue: derive a pool `type` and biome/region `variantTags` for the
 * existing curated/global sounds (which predate the typed pool model) from
 * their id, name, and keywords. Sounds that already declare a `type`/`tags`
 * (e.g. procedural scenes) are left untouched.
 */

type Rule = { type: SoundType; test: RegExp };

/**
 * Bird species rules, checked only for `category === 'bird'` sounds. Order is
 * most-specific first; anything unmatched falls through to `songbird`. All
 * fragments are `\b`-anchored so `howler` can't match `owl`, `blackbird` can't
 * match a corvid, etc.
 */
const BIRD_RULES: Rule[] = [
  { type: 'owl', test: /\b(owls?|morepork|ruru|tawny|nocturnal)\b/ },
  { type: 'seabird', test: /\b(gulls?|seagulls?|seabirds?|terns?|albatross|petrel)\b/ },
  { type: 'corvid', test: /\b(jays?|crows?|magpies?|ravens?|rooks?|corvids?|jackdaws?|choughs?)\b/ },
  { type: 'primates', test: /\b(howlers?|monkeys?|primates?|apes?|gibbons?|macaques?|langurs?|lemurs?)\b/ },
  {
    type: 'tropical-bird',
    test: /\b(toucans?|quetzals?|parrots?|macaws?|hornbills?|barbets?|tropical|jungle|understory|hill-bird)\b/,
  },
];

/**
 * Ambient/weather rules, checked only for non-wildlife sounds. Order matters:
 * water/insects/rain/thunder/wind beat the urban rules, and thunder beats rain.
 */
const AMBIENT_RULES: Rule[] = [
  { type: 'jazz', test: /\b(jazz|busker|saxophone|music)\b/ },
  { type: 'thunder', test: /\bthunder\b/ },
  { type: 'rain', test: /\b(rain|monsoon|drizzle|shower|downpour)\b/ },
  { type: 'waves', test: /\b(surf|waves?|ocean|breakers?|copacabana|atlantic)\b/ },
  { type: 'stream', test: /\b(stream|creek|brook|brooklet|river|fountain|waterfall|watercourse|thames)\b/ },
  { type: 'forest', test: /\b(forest|bush|canopy|woodland|rustle|domain|valley|bamboo|floor|ambience|park)\b/ },
  { type: 'city-hum', test: /\b(traffic|city|motorway|highway|street|urban)\b/ },
  { type: 'wind', test: /\b(wind|breeze|gust)\b/ },
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
  { tag: 'night', test: /\bowl\b|night|nocturnal|evening/ },
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

  // Category-gated inference: the SoundDef `category` is authoritative, so a
  // wildlife clip can never be routed to an ambient pool (and vice-versa). This
  // stops the fragile substring bugs — `brook`→`rook`, `escapes`→`ape`,
  // `bush`→forest — from mis-categorising streams, rain and songbirds.
  switch (sound.category) {
    case 'bird': {
      for (const rule of BIRD_RULES) {
        if (rule.test.test(text)) return rule.type;
      }
      return 'songbird';
    }
    case 'insect': {
      if (/\b(frogs?|toads?)\b/.test(text)) return 'frogs';
      return 'insects';
    }
    case 'water': {
      if (/\b(surf|waves?|ocean|breakers?|copacabana|atlantic|pacific-surf)\b/.test(text)) {
        return 'waves';
      }
      return 'stream';
    }
    case 'ambient': {
      for (const rule of AMBIENT_RULES) {
        if (rule.test.test(text)) return rule.type;
      }
      return 'wind';
    }
    default:
      return undefined;
  }
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
