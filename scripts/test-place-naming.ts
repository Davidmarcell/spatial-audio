/**
 * Lightweight self-test for place naming (runs without a browser / GPS).
 * Invoked via `npm run test:place-naming`.
 */
import { resolvePlaceDisplayName } from '../src/utils/placeNaming.ts';

type Case = {
  label: string;
  input: Parameters<typeof resolvePlaceDisplayName>[0];
  shortName: string;
};

const CASES: Case[] = [
  {
    label: 'London plaque reverse geocode',
    input: {
      primaryName: 'Mileage Central Point of London Plaque',
      displayName:
        'Mileage Central Point of London Plaque, Charing Cross, Westminster, London, Greater London, England, SW1A 2DX, United Kingdom',
      type: 'memorial',
      class: 'historic',
      addresstype: 'memorial',
      address: {
        city: 'London',
        state: 'England',
        country: 'United Kingdom',
        country_code: 'gb',
      },
    },
    shortName: 'London',
  },
  {
    label: 'Explicit POI search keeps landmark name',
    input: {
      primaryName: 'Eiffel Tower',
      displayName: 'Eiffel Tower, Paris, France',
      type: 'attraction',
      class: 'tourism',
      addresstype: 'attraction',
      address: { city: 'Paris', country: 'France', country_code: 'fr' },
      searchQuery: 'Eiffel Tower',
    },
    shortName: 'Eiffel Tower',
  },
  {
    label: 'City address preferred for Auckland suburb',
    input: {
      primaryName: 'Auckland Domain',
      displayName: 'Auckland Domain, Auckland, New Zealand',
      type: 'park',
      class: 'leisure',
      addresstype: 'park',
      address: { city: 'Auckland', country: 'New Zealand', country_code: 'nz' },
    },
    shortName: 'Auckland Domain',
  },
  {
    label: 'Micro POI without city falls back to display segment',
    input: {
      primaryName: 'Old Survey Marker',
      displayName: 'Old Survey Marker, Wellington, New Zealand',
      type: 'survey_point',
      class: 'man_made',
      addresstype: 'survey_point',
      address: { city: 'Wellington', country: 'New Zealand', country_code: 'nz' },
    },
    shortName: 'Wellington',
  },
];

let failed = 0;

for (const testCase of CASES) {
  const result = resolvePlaceDisplayName(testCase.input);
  if (result.shortName !== testCase.shortName) {
    failed += 1;
    console.error(
      `FAIL: ${testCase.label}\n  expected "${testCase.shortName}", got "${result.shortName}"`,
    );
  } else {
    console.log(`ok: ${testCase.label}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} place-naming test(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${CASES.length} place-naming tests passed`);
