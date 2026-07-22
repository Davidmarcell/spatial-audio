import type { VariantTag } from './types';

/**
 * Bundled major-world-cities table (Phase 1).
 *
 * A searched place is matched by name + proximity against this list. A match
 * "snaps" a big city to a stable, good profile: it is treated as genuinely
 * urban (so it gets the city bed even when the OSM class is vague), and it can
 * carry hints the coarse keyword traits miss, above all whether the city sits
 * on notable water (a lake, big river or harbour), which unlocks a water bed
 * that "Hanoi, Vietnam" would otherwise never get.
 *
 * It does not need to be exhaustive (~250 cities here); smaller places fall
 * through to the generic signal-driven recipe. Coordinates are approximate; the
 * match tolerance is ~1 degree, enough to disambiguate same-named cities on
 * different continents.
 */
export type MajorCity = {
  name: string;
  /** ISO country code (lowercase). */
  cc: string;
  lat: number;
  lng: number;
  /** Sits on notable water (lake / large river / harbour) → unlock a water bed. */
  water?: boolean;
  /** Water is open coast (surf) rather than inland river/lake. */
  coastal?: boolean;
  /** Extra flavour tags. */
  tags?: VariantTag[];
};

export const majorCities: MajorCity[] = [
  // ---- East & Southeast Asia ----
  { name: 'Hanoi', cc: 'vn', lat: 21.03, lng: 105.85, water: true },
  { name: 'Ho Chi Minh City', cc: 'vn', lat: 10.82, lng: 106.63, water: true },
  { name: 'Saigon', cc: 'vn', lat: 10.82, lng: 106.63, water: true },
  { name: 'Da Nang', cc: 'vn', lat: 16.05, lng: 108.22, water: true, coastal: true },
  { name: 'Bangkok', cc: 'th', lat: 13.76, lng: 100.5, water: true },
  { name: 'Chiang Mai', cc: 'th', lat: 18.79, lng: 98.98, water: true },
  { name: 'Phnom Penh', cc: 'kh', lat: 11.56, lng: 104.92, water: true },
  { name: 'Vientiane', cc: 'la', lat: 17.97, lng: 102.6, water: true },
  { name: 'Yangon', cc: 'mm', lat: 16.87, lng: 96.2, water: true },
  { name: 'Jakarta', cc: 'id', lat: -6.21, lng: 106.85, water: true, coastal: true },
  { name: 'Surabaya', cc: 'id', lat: -7.26, lng: 112.75, water: true, coastal: true },
  { name: 'Bandung', cc: 'id', lat: -6.9, lng: 107.61 },
  { name: 'Denpasar', cc: 'id', lat: -8.65, lng: 115.22, water: true, coastal: true },
  { name: 'Kuala Lumpur', cc: 'my', lat: 3.14, lng: 101.69 },
  { name: 'Singapore', cc: 'sg', lat: 1.35, lng: 103.82, water: true, coastal: true },
  { name: 'Manila', cc: 'ph', lat: 14.6, lng: 120.98, water: true, coastal: true },
  { name: 'Cebu City', cc: 'ph', lat: 10.32, lng: 123.9, water: true, coastal: true },
  { name: 'Bandar Seri Begawan', cc: 'bn', lat: 4.9, lng: 114.94, water: true },
  { name: 'Tokyo', cc: 'jp', lat: 35.68, lng: 139.69, water: true, coastal: true },
  { name: 'Osaka', cc: 'jp', lat: 34.69, lng: 135.5, water: true, coastal: true },
  { name: 'Kyoto', cc: 'jp', lat: 35.01, lng: 135.77, water: true },
  { name: 'Yokohama', cc: 'jp', lat: 35.44, lng: 139.64, water: true, coastal: true },
  { name: 'Sapporo', cc: 'jp', lat: 43.06, lng: 141.35, tags: ['cold'] },
  { name: 'Fukuoka', cc: 'jp', lat: 33.59, lng: 130.4, water: true, coastal: true },
  { name: 'Seoul', cc: 'kr', lat: 37.57, lng: 126.98, water: true },
  { name: 'Busan', cc: 'kr', lat: 35.18, lng: 129.08, water: true, coastal: true },
  { name: 'Taipei', cc: 'tw', lat: 25.03, lng: 121.57, water: true },
  { name: 'Beijing', cc: 'cn', lat: 39.9, lng: 116.4 },
  { name: 'Shanghai', cc: 'cn', lat: 31.23, lng: 121.47, water: true, coastal: true },
  { name: 'Guangzhou', cc: 'cn', lat: 23.13, lng: 113.26, water: true },
  { name: 'Shenzhen', cc: 'cn', lat: 22.54, lng: 114.06, water: true, coastal: true },
  { name: 'Chengdu', cc: 'cn', lat: 30.57, lng: 104.07 },
  { name: 'Xian', cc: 'cn', lat: 34.34, lng: 108.94 },
  { name: 'Hong Kong', cc: 'hk', lat: 22.32, lng: 114.17, water: true, coastal: true },
  { name: 'Ulaanbaatar', cc: 'mn', lat: 47.89, lng: 106.91, tags: ['cold'] },
  // ---- South Asia ----
  { name: 'Delhi', cc: 'in', lat: 28.61, lng: 77.21, water: true },
  { name: 'New Delhi', cc: 'in', lat: 28.61, lng: 77.21, water: true },
  { name: 'Mumbai', cc: 'in', lat: 19.08, lng: 72.88, water: true, coastal: true },
  { name: 'Bengaluru', cc: 'in', lat: 12.97, lng: 77.59 },
  { name: 'Bangalore', cc: 'in', lat: 12.97, lng: 77.59 },
  { name: 'Kolkata', cc: 'in', lat: 22.57, lng: 88.36, water: true },
  { name: 'Chennai', cc: 'in', lat: 13.08, lng: 80.27, water: true, coastal: true },
  { name: 'Hyderabad', cc: 'in', lat: 17.39, lng: 78.49, water: true },
  { name: 'Jaipur', cc: 'in', lat: 26.91, lng: 75.79, tags: ['arid'] },
  { name: 'Ahmedabad', cc: 'in', lat: 23.03, lng: 72.58, water: true },
  { name: 'Pune', cc: 'in', lat: 18.52, lng: 73.86 },
  { name: 'Varanasi', cc: 'in', lat: 25.32, lng: 82.97, water: true },
  { name: 'Kathmandu', cc: 'np', lat: 27.72, lng: 85.32, tags: ['mountain'] },
  { name: 'Colombo', cc: 'lk', lat: 6.93, lng: 79.85, water: true, coastal: true },
  { name: 'Dhaka', cc: 'bd', lat: 23.81, lng: 90.41, water: true },
  { name: 'Karachi', cc: 'pk', lat: 24.86, lng: 67.0, water: true, coastal: true },
  { name: 'Lahore', cc: 'pk', lat: 31.55, lng: 74.34, water: true },
  { name: 'Islamabad', cc: 'pk', lat: 33.68, lng: 73.05 },
  // ---- Middle East & Central Asia ----
  { name: 'Istanbul', cc: 'tr', lat: 41.01, lng: 28.98, water: true, coastal: true },
  { name: 'Ankara', cc: 'tr', lat: 39.93, lng: 32.86 },
  { name: 'Izmir', cc: 'tr', lat: 38.42, lng: 27.14, water: true, coastal: true },
  { name: 'Tehran', cc: 'ir', lat: 35.69, lng: 51.39, tags: ['arid'] },
  { name: 'Baghdad', cc: 'iq', lat: 33.31, lng: 44.36, water: true, tags: ['arid'] },
  { name: 'Riyadh', cc: 'sa', lat: 24.71, lng: 46.68, tags: ['arid'] },
  { name: 'Jeddah', cc: 'sa', lat: 21.49, lng: 39.19, water: true, coastal: true, tags: ['arid'] },
  { name: 'Mecca', cc: 'sa', lat: 21.39, lng: 39.86, tags: ['arid'] },
  { name: 'Dubai', cc: 'ae', lat: 25.2, lng: 55.27, water: true, coastal: true, tags: ['arid'] },
  { name: 'Abu Dhabi', cc: 'ae', lat: 24.45, lng: 54.38, water: true, coastal: true, tags: ['arid'] },
  { name: 'Doha', cc: 'qa', lat: 25.29, lng: 51.53, water: true, coastal: true, tags: ['arid'] },
  { name: 'Kuwait City', cc: 'kw', lat: 29.38, lng: 47.99, water: true, coastal: true, tags: ['arid'] },
  { name: 'Manama', cc: 'bh', lat: 26.23, lng: 50.59, water: true, coastal: true, tags: ['arid'] },
  { name: 'Muscat', cc: 'om', lat: 23.59, lng: 58.41, water: true, coastal: true, tags: ['arid'] },
  { name: 'Amman', cc: 'jo', lat: 31.95, lng: 35.93, tags: ['arid'] },
  { name: 'Beirut', cc: 'lb', lat: 33.89, lng: 35.5, water: true, coastal: true },
  { name: 'Damascus', cc: 'sy', lat: 33.51, lng: 36.29, tags: ['arid'] },
  { name: 'Jerusalem', cc: 'il', lat: 31.77, lng: 35.21 },
  { name: 'Tel Aviv', cc: 'il', lat: 32.08, lng: 34.78, water: true, coastal: true },
  { name: 'Sanaa', cc: 'ye', lat: 15.37, lng: 44.19, tags: ['arid', 'mountain'] },
  // ---- Africa ----
  { name: 'Cairo', cc: 'eg', lat: 30.04, lng: 31.24, water: true, tags: ['arid'] },
  { name: 'Alexandria', cc: 'eg', lat: 31.2, lng: 29.92, water: true, coastal: true },
  { name: 'Casablanca', cc: 'ma', lat: 33.57, lng: -7.59, water: true, coastal: true },
  { name: 'Marrakech', cc: 'ma', lat: 31.63, lng: -7.99, tags: ['arid'] },
  { name: 'Rabat', cc: 'ma', lat: 34.02, lng: -6.83, water: true, coastal: true },
  { name: 'Tunis', cc: 'tn', lat: 36.81, lng: 10.18, water: true, coastal: true },
  { name: 'Algiers', cc: 'dz', lat: 36.75, lng: 3.06, water: true, coastal: true },
  { name: 'Tripoli', cc: 'ly', lat: 32.89, lng: 13.19, water: true, coastal: true, tags: ['arid'] },
  { name: 'Lagos', cc: 'ng', lat: 6.52, lng: 3.38, water: true, coastal: true },
  { name: 'Abuja', cc: 'ng', lat: 9.06, lng: 7.5 },
  { name: 'Kano', cc: 'ng', lat: 12.0, lng: 8.52, tags: ['arid'] },
  { name: 'Accra', cc: 'gh', lat: 5.6, lng: -0.19, water: true, coastal: true },
  { name: 'Nairobi', cc: 'ke', lat: -1.29, lng: 36.82 },
  { name: 'Mombasa', cc: 'ke', lat: -4.04, lng: 39.66, water: true, coastal: true },
  { name: 'Kampala', cc: 'ug', lat: 0.35, lng: 32.58, water: true },
  { name: 'Dar es Salaam', cc: 'tz', lat: -6.79, lng: 39.21, water: true, coastal: true },
  { name: 'Addis Ababa', cc: 'et', lat: 9.03, lng: 38.74, tags: ['mountain'] },
  { name: 'Kinshasa', cc: 'cd', lat: -4.32, lng: 15.31, water: true },
  { name: 'Douala', cc: 'cm', lat: 4.05, lng: 9.77, water: true, coastal: true },
  { name: 'Abidjan', cc: 'ci', lat: 5.36, lng: -4.01, water: true, coastal: true },
  { name: 'Dakar', cc: 'sn', lat: 14.72, lng: -17.47, water: true, coastal: true },
  { name: 'Bamako', cc: 'ml', lat: 12.64, lng: -8.0, water: true },
  { name: 'Johannesburg', cc: 'za', lat: -26.2, lng: 28.05 },
  { name: 'Cape Town', cc: 'za', lat: -33.92, lng: 18.42, water: true, coastal: true },
  { name: 'Durban', cc: 'za', lat: -29.86, lng: 31.02, water: true, coastal: true },
  { name: 'Pretoria', cc: 'za', lat: -25.75, lng: 28.19 },
  { name: 'Harare', cc: 'zw', lat: -17.83, lng: 31.05 },
  { name: 'Luanda', cc: 'ao', lat: -8.84, lng: 13.23, water: true, coastal: true },
  // ---- Europe ----
  { name: 'London', cc: 'gb', lat: 51.51, lng: -0.13, water: true },
  { name: 'Manchester', cc: 'gb', lat: 53.48, lng: -2.24 },
  { name: 'Edinburgh', cc: 'gb', lat: 55.95, lng: -3.19, water: true, coastal: true },
  { name: 'Dublin', cc: 'ie', lat: 53.35, lng: -6.26, water: true, coastal: true },
  { name: 'Paris', cc: 'fr', lat: 48.86, lng: 2.35, water: true },
  { name: 'Marseille', cc: 'fr', lat: 43.3, lng: 5.37, water: true, coastal: true, tags: ['mediterranean'] },
  { name: 'Lyon', cc: 'fr', lat: 45.76, lng: 4.84, water: true },
  { name: 'Nice', cc: 'fr', lat: 43.71, lng: 7.26, water: true, coastal: true, tags: ['mediterranean'] },
  { name: 'Madrid', cc: 'es', lat: 40.42, lng: -3.7 },
  { name: 'Barcelona', cc: 'es', lat: 41.39, lng: 2.17, water: true, coastal: true, tags: ['mediterranean'] },
  { name: 'Seville', cc: 'es', lat: 37.39, lng: -5.99, water: true, tags: ['mediterranean'] },
  { name: 'Valencia', cc: 'es', lat: 39.47, lng: -0.38, water: true, coastal: true, tags: ['mediterranean'] },
  { name: 'Lisbon', cc: 'pt', lat: 38.72, lng: -9.14, water: true, coastal: true, tags: ['mediterranean'] },
  { name: 'Porto', cc: 'pt', lat: 41.15, lng: -8.61, water: true, coastal: true },
  { name: 'Rome', cc: 'it', lat: 41.9, lng: 12.5, water: true, tags: ['mediterranean'] },
  { name: 'Milan', cc: 'it', lat: 45.46, lng: 9.19 },
  { name: 'Naples', cc: 'it', lat: 40.85, lng: 14.27, water: true, coastal: true, tags: ['mediterranean'] },
  { name: 'Venice', cc: 'it', lat: 45.44, lng: 12.34, water: true, coastal: true },
  { name: 'Florence', cc: 'it', lat: 43.77, lng: 11.26, water: true, tags: ['mediterranean'] },
  { name: 'Athens', cc: 'gr', lat: 37.98, lng: 23.73, water: true, coastal: true, tags: ['mediterranean'] },
  { name: 'Berlin', cc: 'de', lat: 52.52, lng: 13.41, water: true },
  { name: 'Munich', cc: 'de', lat: 48.14, lng: 11.58, water: true },
  { name: 'Hamburg', cc: 'de', lat: 53.55, lng: 9.99, water: true },
  { name: 'Cologne', cc: 'de', lat: 50.94, lng: 6.96, water: true },
  { name: 'Frankfurt', cc: 'de', lat: 50.11, lng: 8.68, water: true },
  { name: 'Amsterdam', cc: 'nl', lat: 52.37, lng: 4.9, water: true },
  { name: 'Rotterdam', cc: 'nl', lat: 51.92, lng: 4.48, water: true, coastal: true },
  { name: 'Brussels', cc: 'be', lat: 50.85, lng: 4.35 },
  { name: 'Vienna', cc: 'at', lat: 48.21, lng: 16.37, water: true },
  { name: 'Zurich', cc: 'ch', lat: 47.37, lng: 8.54, water: true },
  { name: 'Geneva', cc: 'ch', lat: 46.2, lng: 6.14, water: true },
  { name: 'Prague', cc: 'cz', lat: 50.08, lng: 14.44, water: true },
  { name: 'Warsaw', cc: 'pl', lat: 52.23, lng: 21.01, water: true },
  { name: 'Krakow', cc: 'pl', lat: 50.06, lng: 19.94, water: true },
  { name: 'Budapest', cc: 'hu', lat: 47.5, lng: 19.04, water: true },
  { name: 'Bucharest', cc: 'ro', lat: 44.43, lng: 26.1 },
  { name: 'Copenhagen', cc: 'dk', lat: 55.68, lng: 12.57, water: true, coastal: true },
  { name: 'Stockholm', cc: 'se', lat: 59.33, lng: 18.07, water: true, coastal: true, tags: ['cold'] },
  { name: 'Oslo', cc: 'no', lat: 59.91, lng: 10.75, water: true, coastal: true, tags: ['cold'] },
  { name: 'Helsinki', cc: 'fi', lat: 60.17, lng: 24.94, water: true, coastal: true, tags: ['cold'] },
  { name: 'Reykjavik', cc: 'is', lat: 64.15, lng: -21.94, water: true, coastal: true, tags: ['cold'] },
  { name: 'Moscow', cc: 'ru', lat: 55.76, lng: 37.62, water: true },
  { name: 'Saint Petersburg', cc: 'ru', lat: 59.93, lng: 30.34, water: true, coastal: true, tags: ['cold'] },
  { name: 'Kyiv', cc: 'ua', lat: 50.45, lng: 30.52, water: true },
  { name: 'Kiev', cc: 'ua', lat: 50.45, lng: 30.52, water: true },
  // ---- North America ----
  { name: 'New York', cc: 'us', lat: 40.71, lng: -74.01, water: true, coastal: true },
  { name: 'Los Angeles', cc: 'us', lat: 34.05, lng: -118.24, water: true, coastal: true },
  { name: 'Chicago', cc: 'us', lat: 41.88, lng: -87.63, water: true },
  { name: 'San Francisco', cc: 'us', lat: 37.77, lng: -122.42, water: true, coastal: true },
  { name: 'Seattle', cc: 'us', lat: 47.61, lng: -122.33, water: true, coastal: true },
  { name: 'Boston', cc: 'us', lat: 42.36, lng: -71.06, water: true, coastal: true },
  { name: 'Washington', cc: 'us', lat: 38.91, lng: -77.04, water: true },
  { name: 'Miami', cc: 'us', lat: 25.76, lng: -80.19, water: true, coastal: true, tags: ['tropical'] },
  { name: 'New Orleans', cc: 'us', lat: 29.95, lng: -90.07, water: true },
  { name: 'Austin', cc: 'us', lat: 30.27, lng: -97.74, water: true },
  { name: 'Denver', cc: 'us', lat: 39.74, lng: -104.99, tags: ['mountain'] },
  { name: 'Toronto', cc: 'ca', lat: 43.65, lng: -79.38, water: true },
  { name: 'Montreal', cc: 'ca', lat: 45.5, lng: -73.57, water: true },
  { name: 'Vancouver', cc: 'ca', lat: 49.28, lng: -123.12, water: true, coastal: true },
  { name: 'Mexico City', cc: 'mx', lat: 19.43, lng: -99.13 },
  { name: 'Guadalajara', cc: 'mx', lat: 20.66, lng: -103.35 },
  { name: 'Monterrey', cc: 'mx', lat: 25.69, lng: -100.32, tags: ['arid'] },
  { name: 'Cancun', cc: 'mx', lat: 21.16, lng: -86.85, water: true, coastal: true, tags: ['tropical'] },
  { name: 'Havana', cc: 'cu', lat: 23.11, lng: -82.37, water: true, coastal: true, tags: ['tropical'] },
  { name: 'Santo Domingo', cc: 'do', lat: 18.49, lng: -69.93, water: true, coastal: true, tags: ['tropical'] },
  { name: 'Guatemala City', cc: 'gt', lat: 14.63, lng: -90.51 },
  { name: 'San Jose', cc: 'cr', lat: 9.93, lng: -84.08, tags: ['tropical'] },
  { name: 'Panama City', cc: 'pa', lat: 8.98, lng: -79.52, water: true, coastal: true, tags: ['tropical'] },
  // ---- South America ----
  { name: 'Sao Paulo', cc: 'br', lat: -23.55, lng: -46.63 },
  { name: 'Rio de Janeiro', cc: 'br', lat: -22.91, lng: -43.17, water: true, coastal: true, tags: ['tropical'] },
  { name: 'Brasilia', cc: 'br', lat: -15.79, lng: -47.88 },
  { name: 'Salvador', cc: 'br', lat: -12.97, lng: -38.5, water: true, coastal: true, tags: ['tropical'] },
  { name: 'Fortaleza', cc: 'br', lat: -3.73, lng: -38.52, water: true, coastal: true, tags: ['tropical'] },
  { name: 'Manaus', cc: 'br', lat: -3.12, lng: -60.02, water: true, tags: ['tropical'] },
  { name: 'Buenos Aires', cc: 'ar', lat: -34.6, lng: -58.38, water: true },
  { name: 'Cordoba', cc: 'ar', lat: -31.42, lng: -64.18 },
  { name: 'Santiago', cc: 'cl', lat: -33.45, lng: -70.67, tags: ['mountain'] },
  { name: 'Valparaiso', cc: 'cl', lat: -33.05, lng: -71.62, water: true, coastal: true },
  { name: 'Lima', cc: 'pe', lat: -12.05, lng: -77.04, water: true, coastal: true },
  { name: 'Cusco', cc: 'pe', lat: -13.53, lng: -71.97, tags: ['mountain'] },
  { name: 'Bogota', cc: 'co', lat: 4.71, lng: -74.07, tags: ['mountain'] },
  { name: 'Medellin', cc: 'co', lat: 6.24, lng: -75.58, tags: ['tropical'] },
  { name: 'Cartagena', cc: 'co', lat: 10.39, lng: -75.51, water: true, coastal: true, tags: ['tropical'] },
  { name: 'Caracas', cc: 've', lat: 10.48, lng: -66.9, tags: ['tropical'] },
  { name: 'Quito', cc: 'ec', lat: -0.18, lng: -78.47, tags: ['mountain'] },
  { name: 'La Paz', cc: 'bo', lat: -16.5, lng: -68.15, tags: ['mountain'] },
  { name: 'Montevideo', cc: 'uy', lat: -34.9, lng: -56.19, water: true, coastal: true },
  { name: 'Asuncion', cc: 'py', lat: -25.28, lng: -57.63, water: true },
  // ---- Oceania ----
  { name: 'Sydney', cc: 'au', lat: -33.87, lng: 151.21, water: true, coastal: true },
  { name: 'Melbourne', cc: 'au', lat: -37.81, lng: 144.96, water: true, coastal: true },
  { name: 'Brisbane', cc: 'au', lat: -27.47, lng: 153.03, water: true, coastal: true },
  { name: 'Perth', cc: 'au', lat: -31.95, lng: 115.86, water: true, coastal: true },
  { name: 'Adelaide', cc: 'au', lat: -34.93, lng: 138.6, water: true, coastal: true },
  { name: 'Auckland', cc: 'nz', lat: -36.85, lng: 174.76, water: true, coastal: true },
  { name: 'Wellington', cc: 'nz', lat: -41.29, lng: 174.78, water: true, coastal: true },
  { name: 'Christchurch', cc: 'nz', lat: -43.53, lng: 172.64, water: true, coastal: true },
];

/** Strip diacritics + punctuation so "São Paulo" matches "sao paulo". */
function normaliseCityName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CITY_INDEX: Array<{ key: string; city: MajorCity }> = majorCities.map((city) => ({
  key: normaliseCityName(city.name),
  city,
}));

/**
 * Match a searched place to a bundled major city. Requires the city name to
 * appear as a leading token of the searched name (so "Hanoi" and "Hanoi,
 * Vietnam" both match, but "New Hanoi Springs" does not) AND the coordinates to
 * fall within ~1.2 degrees, which disambiguates same-named cities on different
 * continents. Returns the closest qualifying city.
 */
export function matchMajorCity(
  name: string,
  lat: number,
  lng: number,
  countryCode?: string,
): MajorCity | undefined {
  const searched = normaliseCityName(name);
  if (!searched) return undefined;
  const cc = countryCode?.toLowerCase();
  let best: MajorCity | undefined;
  let bestDist = Infinity;
  for (const { key, city } of CITY_INDEX) {
    const nameMatches = searched === key || searched.startsWith(`${key} `);
    if (!nameMatches) continue;
    const dLat = city.lat - lat;
    const dLng = city.lng - lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    // Country code, when present, must agree, a cheap guard against a distant
    // same-named city sneaking in on a loose coordinate.
    if (cc && city.cc !== cc && dist > 1.2) continue;
    if (dist > 1.2) continue;
    if (dist < bestDist) {
      best = city;
      bestDist = dist;
    }
  }
  return best;
}
