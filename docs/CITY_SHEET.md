# City Preview Sheet — Design & Implementation Notes

> Status: **proposal** — not wired into App yet.

## Wireframe (stacked on GlobeMapSheet)

```
┌─────────────────────────────────────────────┐  ← GlobeMapSheet (dimmed / scaled back)
│  Explore the world                    [×]   │
│  ┌─────────────────────────────────────┐    │
│  │         🌍 globe (still visible)     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ╭─────────────────────────────────────╮    │  ← CityPreviewSheet (detent ~42%)
│  │  Berlin                             │    │
│  │  Germany · Urban Europe             │    │
│  │  ─────────────────────────────────  │    │
│  │  [hero: static map tile OR pin art] │    │
│  │  ─────────────────────────────────  │    │
│  │  Sounds in this soundscape          │    │
│  │  ○ Traffic hum   ○ Café chatter     │    │
│  │  ○ Distant siren ○ Rain on glass    │    │
│  │  ─────────────────────────────────  │    │
│  │  14:32 local · Overcast · 8°C       │    │  (optional v2)
│  │                                     │    │
│  │  ┌─────────────────────────────┐    │    │
│  │  │     Start soundscape  ▶     │    │    │
│  │  └─────────────────────────────┘    │    │
│  │  Mapped from Urban Europe template   │    │  (custom only)
│  ╰─────────────────────────────────────╯    │
└─────────────────────────────────────────────┘
```

## When to show

| Trigger | Show city sheet? | Notes |
|---------|------------------|-------|
| Curated pin / list pick | Yes | Confirm before leaving globe |
| Geocode result | Yes | Especially important — explains template mapping |
| Re-select active location | No | Skip if already on that region |
| "Use my location" (globe) | Yes | Same as curated pick |
| Bottom bar LocationPicker | No | Keep fast path for power users |

## UX flow (summary)

1. User picks a place in `GlobeExplorer` → globe flies to pin (unchanged).
2. `onSelect` sets `pendingLocation` and opens `CityPreviewSheet` — **does not** call `applyRegion`.
3. Globe sheet stays open; city sheet stacks above (Silk depth).
4. User taps **Start soundscape** → `applyRegion`, `setAutoPlayOnLoad(true)`, dismiss both sheets.
5. Dismiss city sheet (swipe/back) → clear `pendingLocation`, stay on globe.

## Globe sheet relationship

**Stack, do not replace.** Keep `GlobeMapSheet` mounted; present `CityPreviewSheet` as a sibling under `SheetStack.Root`. Globe remains context; user can dismiss preview and pick another city without reopening the map.

## Custom vs preset

| | Preset (`worldLocations`) | Custom (geocode) |
|--|---------------------------|------------------|
| Title | Pin name + subtitle | Geocode short name |
| Hero | Region artwork / pin | Generic pin + coords |
| Sound list | Exact region from pin | Template-mapped region |
| Footer | — | "Sounds inspired by nearby soundscapes" + template label |
| Pin persistence | N/A | `setCustomGlobeLocation` on confirm only |

## Implementation checklist

### New files

- `src/components/CityPreviewSheet.tsx` — Silk sheet shell
- `src/components/CityPreviewContent.tsx` — presentational panel (optional split)
- `src/components/CityPreviewSheet.module.css` — hero, sound chips, CTA

### App.tsx state

```ts
const [pendingGlobeLocation, setPendingGlobeLocation] = useState<WorldLocation | null>(null);
const showCityPreview = pendingGlobeLocation !== null;
```

### Handler changes

```ts
// Replace immediate apply in handleGlobeSelect:
const handleGlobeSelect = useCallback((location: WorldLocation) => {
  if (
    location.environmentId === environmentId &&
    location.regionId === regionId &&
    !location.custom
  ) {
    setShowGlobe(false);
    return;
  }
  setPendingGlobeLocation(location);
}, [environmentId, regionId]);

const handleCityPreviewConfirm = useCallback(() => {
  if (!pendingGlobeLocation) return;
  if (pendingGlobeLocation.custom) setCustomGlobeLocation(pendingGlobeLocation);
  applyRegion(pendingGlobeLocation.environmentId, pendingGlobeLocation.regionId);
  setAutoPlayOnLoad(true);
  setPendingGlobeLocation(null);
  setShowGlobe(false);
}, [applyRegion, pendingGlobeLocation]);
```

### Props sketch

```ts
type CityPreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: WorldLocation | null;
  region: RegionDef | null;       // from getRegion(location.environmentId, location.regionId)
  templateLabel?: string;         // e.g. "Urban Europe" for custom geocode
  onConfirm: () => void;
  regionArt: RegionArtContext;
};
```

### Data sources (no new API for v1)

- `getRegion(envId, regionId)` → `sounds`, `bedSounds`, display name
- `resolveSoundscapeForGeocode` → expose human label for custom footer (optional helper)
- `regionArt` → sound tile icons in preview list
- v2: Open-Meteo or similar for local time / weather (lat/lng from location)

### Sound preview behavior

- Read-only horizontal scroll of palette tiles (reuse `SoundPalette` tile styling or compact chips).
- Optional: 2s hover/tap to audition one sound via engine (requires unlock) — defer to v2.

### Accessibility

- `sheetRole="dialog"`, focus trap on CTA
- Escape dismisses city sheet only (not globe)
- Announce city name + sound count on open

## Estimated scope

- v1 (sheet + confirm gate): ~150–200 LOC
- v2 (weather, sound audition): +80–120 LOC
