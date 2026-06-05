export type GlobeAppearancePreset = 1 | 2 | 3 | 4;

export type GlobeAppearance = {
  showOutlines: boolean;
  outlineOpacity: number;
  pointRadius: number;
  bumpScale: number;
};

export const globeAppearancePresets: Record<GlobeAppearancePreset, GlobeAppearance> = {
  1: { showOutlines: true, outlineOpacity: 0.22, pointRadius: 0.32, bumpScale: 1 },
  2: { showOutlines: true, outlineOpacity: 0.38, pointRadius: 0.36, bumpScale: 1.2 },
  3: { showOutlines: true, outlineOpacity: 0.52, pointRadius: 0.4, bumpScale: 1.6 },
  4: { showOutlines: false, outlineOpacity: 0, pointRadius: 0.28, bumpScale: 0.6 },
};

export const COUNTRIES_GEOJSON_URL =
  'https://unpkg.com/three-globe/example/datasets/ne_110m_admin_0_countries.geojson';

export type CountryFeature = {
  type: 'Feature';
  properties: { ADMIN?: string; ISO_A2?: string };
  geometry: unknown;
};

export type CountriesGeoJson = {
  features: CountryFeature[];
};

let countriesCache: CountryFeature[] | null = null;

export async function loadCountryFeatures(): Promise<CountryFeature[]> {
  if (countriesCache) return countriesCache;
  const res = await fetch(COUNTRIES_GEOJSON_URL);
  if (!res.ok) throw new Error(`Countries GeoJSON HTTP ${res.status}`);
  const data = (await res.json()) as CountriesGeoJson;
  countriesCache = data.features.filter((feature) => feature.properties.ISO_A2 !== 'AQ');
  return countriesCache;
}
