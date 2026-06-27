/** Short, high-level copy for the artwork detail panel. */
export const soundBlurbs: Record<string, string> = {
  tui:
    'A loud, melodic native honeyeater of New Zealand. Tui are known for their complex song and the distinctive white throat tuft that catches the light in forest canopy.',
  bellbird:
    'Named for its bell-like call, the bellbird (korimako) is a nectar-feeding songbird found in native bush throughout Aotearoa.',
  morepork:
    'New Zealand’s small native owl (ruru), heard at night with a rhythmic “more-pork” call from forest edges and gardens.',
  fantail:
    'A friendly forest bird (pīwakawaka) that flits close to people, fanning its tail as it hunts insects in the understorey.',
  gull:
    'Coastal gulls wheel above harbours and beaches, their calls a familiar part of Auckland’s shoreline soundscape.',
  surf:
    'Rolling ocean surf — distance and placement on the grid change how present the waves feel in the mix.',
  wind:
    'Air moving through open coast or canopy; a soft bed that shifts with position relative to you.',
  'wind-forest':
    'Wind threading through treetops and leaves, deeper in the bush than open coastal breeze.',
  'forest-ambience':
    'The quiet rustle and texture of forest floor and understory — distant life without a single focal call.',
  howler:
    'Deep howls from neotropical primates, often heard at dawn and dusk across rainforest canopy.',
  toucan:
    'Large-billed forest birds whose croaks and clacks carry through humid lowland rainforest.',
  quetzal:
    'A revered cloud-forest bird of Central America, with iridescent green plumage and a long tail.',
  insects:
    'A layered chorus of cicadas, crickets, and tiny forest insects — the constant texture of warm nights.',
  rain:
    'Rain on leaves and canopy, from drizzle to heavy tropical downpour.',
  stream:
    'Fresh water over rocks and roots — a bright, moving counterpoint to still forest air.',
  'copacabana-surf':
    'Atlantic rollers along the Brazilian coast — Copacabana and the open ocean beyond the city.',
  'atlantic-wind': 'Warm sea breeze drifting in from the Atlantic across Rio’s hills and bays.',
  seabird: 'Gulls and seabirds above harbour and beach — a coastal thread in the mix.',
  'tropical-insects':
    'Cicadas and warm-climate insects — the constant hum of subtropical afternoons.',
  'city-hum':
    'A soft urban bed — distant rhythm of a city that never fully falls silent.',
  'street-bird':
    'Passerines in Brooklyn trees and backyards — sparrows, robins, and neighbours singing from rooftops.',
  'gray-catbird':
    'Gray catbirds nest in Brooklyn hedges and community gardens — raspy mews and borrowed phrases from telephone wires and ailanthus trees.',
  'northern-cardinal':
    'Male cardinals sing from backyard shrubs and treetops — a bright whistle that carries down the block, especially in spring.',
  'blue-jay':
    'Blue jays visit feeders and street trees in autumn and winter — sharp jeers and quiet “queedle” calls between brownstones.',
  'park-rustle':
    'Leaves and city park texture — rustle between brownstones and community gardens.',
  'urban-breeze': 'Air moving between buildings and avenues on a clear city day.',
  'street-jazz-busker':
    'A loose jazz trio on the corner — guitar, brushed rhythm, and saxophone carrying down the street.',
  'distant-traffic': 'Far-off traffic hiss — the low shimmer of a borough awake.',
  'alpine-wind': 'Cold wind through high passes and limestone peaks of the Dolomites.',
  'mountain-stream': 'Meltwater over stone — bright streams in alpine valleys.',
  'forest-valley': 'Larch and pine forest quiet between sheer mountain walls.',
  'alpine-bird': 'Birdsong from high meadows and cliff faces — choughs and meadow pipits.',
  'jungle-insects':
    'Layered insect chorus of northern Thai foothills — cicadas at dusk and dawn.',
  'hill-bird':
    'Melodic calls from Doi Suthep forest — bulbuls, barbets, and hill-country songbirds.',
  'understory-bird':
    'Songbirds in forest margins and understory — melodic calls filtered through dense tropical foliage.',
  'monsoon-rain': 'Tropical rain on broad leaves during monsoon season.',
  'tropical-bird': 'Colourful lowland forest birds — toucans and hornbills of the tropics.',
};

export function getSoundBlurb(soundId: string): string {
  return (
    soundBlurbs[soundId] ??
    'A sound from this environment. Drag it on the grid to change volume and stereo placement.'
  );
}
