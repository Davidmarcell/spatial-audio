# Add Sounds & Seasonal Birds — Design & Implementation

> Status: **v1 scaffold wired** — add-sound sheet + dock button live; season bird swapping planned.

## Goals

1. Let users build a custom mix beyond region **bed defaults** by browsing the full regional catalog.
2. For migratory locations (Bed-Stuy), let users pick a **season** so wildlife tabs reflect spring/fall migration patterns.

---

## UX flow — Add sounds (v1)

```
┌──────────────────────────────────────────────────────────────┐
│  Spatial canvas (radar grid)                    [sound icons] │
│                                                               │
│  ┌─────┐                                                      │
│  │  +  │  ← AddSoundButton (top of left dock)                 │
│  ├─────┤                                                      │
│  │ 🐦 │  ← available palette slots (not yet on canvas)       │
│  │ 🌬 │                                                      │
│  └─────┘                                                      │
└──────────────────────────────────────────────────────────────┘
         │
         │ tap +
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Add sounds                                          [×]     │
│  Bedford-Stuyvesant, Brooklyn                                │
│  ─────────────────────────────────────────────────────────   │
│  [ Ambient ]  [ Wildlife ]     ← tabs (extensible later)     │
│  Season: Spring · Summer · Fall · Winter  (migratory only)   │
│  ─────────────────────────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [icon] Gray Catbird          Tap to add to mix        │    │
│  │ [icon] Northern Cardinal     On canvas (disabled)    │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Entry points

| Trigger | Action |
|---------|--------|
| **+** on left dock (`AddSoundButton`) | Opens `AddSoundSheet` |
| (future) long-press empty canvas | Same sheet, optional |

### Tab structure

| Tab | `SoundCategory` values | Notes |
|-----|------------------------|-------|
| **Ambient** | `ambient`, `water` | Weather, rustle, traffic, streams |
| **Wildlife** | `bird`, `insect` | Season picker when region is migratory |

Additional tabs (e.g. **Urban**, **Night**) can be added later without changing the sheet shell — extend `AddSoundTab` and `soundsForAddTab()` in `src/utils/soundCatalog.ts`.

### Add target — design decision

**Chosen for v1: add directly to the mix (canvas).**

- Tap a row → `addSound(sound)` with default spawn position (same as drag-drop without aiming).
- Sound leaves the dock palette (already on canvas) and row shows **On canvas** / disabled.
- Drag-from-dock remains the spatial placement path; the sheet is the browse/discover path.

**Alternatives considered**

| Option | Pros | Cons |
|--------|------|------|
| Add to dock only | Keeps placement ritual | Extra step; dock already lists available sounds |
| Add to canvas (chosen) | Fast audition; matches “build a mix” | Less precise initial position |
| Add + auto-open detail | Immediate volume tweak | Noisy for power users |

### Sheet behavior (Silk)

- Bottom sheet, indented glass panel (matches `AttributionsSheet` / `GlobeMapSheet`).
- Detents: `52%` (browse), `88%` (full list).
- Dismiss: swipe, backdrop, ×, or after successful add.
- Rendered as sibling under `SheetStack.Root` in `App.tsx`.

---

## Season / migration model

### Problem

Bed-Stuy and similar urban parks have **different breeding vs overwintering** bird communities. A single static palette misrepresents the soundscape.

### Data model (implemented as types; tagging TBD)

```ts
// src/data/types.ts
type Season = 'spring' | 'summer' | 'fall' | 'winter';

type SoundDef = {
  // ...
  seasons?: Season[];  // omit = available all year
};

type Region = {
  // ...
  migratoryBirds?: boolean;
  defaultSeason?: Season;
};
```

**Filtering rule:** A sound appears in catalog/palette when `!seasons || seasons.includes(activeSeason)`.

Non-bird sounds (ambient, water) typically omit `seasons` and stay year-round.

### Bed-Stuy example (proposed tagging)

| Sound | Category | Suggested `seasons` | Rationale |
|-------|----------|---------------------|-----------|
| Gray Catbird | bird | spring, summer | Breeds in NYC; quiet in winter |
| Northern Cardinal | bird | *(none)* | Year-round resident |
| Blue Jay | bird | *(none)* | Year-round resident |
| Park Rustle | ambient | *(none)* | Year-round |
| Urban Breeze | ambient | *(none)* | Year-round |
| Distant Traffic | ambient | *(none)* | Year-round |

**Future birds** (not in catalog yet): White-throated Sparrow (`fall`, `winter`), Yellow Warbler (`spring`, `summer`), etc.

Region metadata (already on Bed-Stuy):

```ts
{
  id: 'bed-stuy',
  migratoryBirds: true,
  defaultSeason: 'spring',
  // ...
}
```

### Season UI placement

| Location | When | v1 status |
|----------|------|-----------|
| **AddSoundSheet** → Wildlife tab | Browsing migratory birds | **Stub wired** (`SeasonPicker`) |
| Header / location row | Global season for palette + defaults | Planned |
| Globe / city preview | Set season before entering soundscape | Optional v2 |

### Season state (planned wiring)

```ts
// App.tsx (future)
const [season, setSeason] = useState<Season>(region.defaultSeason ?? inferSeasonFromDate());

const paletteSounds = useMemo(
  () => filterSoundsBySeason(region.sounds, season),
  [region.sounds, season],
);

// Reset season when region changes
useEffect(() => {
  setSeason(region.defaultSeason ?? 'spring');
}, [regionId]);
```

**Not in v1:** Changing season does not yet re-filter the dock or swap bed defaults — only the Add Sound sheet Wildlife list respects `SeasonPicker`.

### Default season inference (v2)

- Northern hemisphere: map calendar month → season.
- Override with `region.defaultSeason` for demos.
- Optional: hemisphere flag on `Environment`.

---

## Implementation map

### Shipped (v1 scaffold)

| File | Role |
|------|------|
| `src/components/AddSoundButton.tsx` | + control on dock |
| `src/components/AddSoundSheet.tsx` | Silk sheet, tabs, sound list |
| `src/components/SeasonPicker.tsx` | Season segments (stub) |
| `src/utils/soundCatalog.ts` | Tab + season filtering |
| `src/data/types.ts` | `Season`, `AddSoundTab`, optional fields |
| `src/components/SoundPalette.tsx` | Renders add button |
| `src/App.tsx` | Sheet state + `onAddSound` |

### Next steps

1. Tag Bed-Stuy bird `seasons` in `environments.ts`.
2. Lift `season` to `App` and filter `SoundPalette` `sounds` prop.
3. Season-aware `bedSounds` per season or dynamic bed load on season change.
4. Persist season in share URL (`sceneShare.ts`).
5. Empty-state copy when Wildlife tab has no birds for selected season.
6. Haptic / brief toast on add (mobile).

---

## Accessibility

- Add button: `aria-label="Add sounds to mix"`.
- Sheet: `sheetRole="dialog"`, titled header, focusable close.
- Tabs: `role="tablist"` / `role="tab"` / `aria-selected`.
- Season control: `role="group"`, `aria-pressed` on segments.
- List rows: disabled when sound already on canvas.

---

## Testing checklist

- [ ] + visible on dock (desktop vertical + mobile horizontal).
- [ ] Sheet opens/closes; stacks with globe/attributions without z-index fights.
- [ ] Ambient tab lists ambient + water only.
- [ ] Wildlife tab lists bird + insect only.
- [ ] Bed-Stuy Wildlife shows `SeasonPicker`.
- [ ] Tap add places sound on canvas; dock slot disappears.
- [ ] Already-active sounds show On canvas and do not duplicate.
- [ ] Region switch closes sheet and resets tab state on next open.
