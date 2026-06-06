# Mobile spatial audio plan

This plan captures the mobile-specific product patterns, interactions, and states for the Spatial Audio app. It is intended as the plan-mode reference before implementation work is split into buildable slices.

## Mobile product goals

- Keep the canvas as the primary surface: users should always understand where "You" are, where each sound lives, and how movement changes the mix.
- Make every core action thumb-reachable: browse sounds, add to the scene, play/pause, choose a place, open the globe, and inspect a sound.
- Preserve direct manipulation: dragging a sound should feel like moving an object through space, not editing a form.
- Use sheets for depth, not navigation dead ends: the user should be able to peek at details, change context, and return to the composition without losing scene state.
- Degrade gracefully on mobile browser constraints: audio unlock, geolocation permission, reduced motion, slow network, and orientation changes should have explicit states.

## Existing mobile baseline

The current app already includes several mobile-friendly foundations:

- `viewport-fit=cover`, `100dvh`, and safe-area-aware fixed controls.
- Pointer-based drag interactions instead of mouse-only handlers.
- A horizontal mobile dock below the canvas at `max-width: 768px`.
- Silk sheet patterns for the globe, sound detail, and attributions.
- Audio unlock through the first pointer/key interaction, plus a visible unlock banner.
- Reduced-motion handling in canvas, dock, and overlay animation paths.
- Keyboard nudge and deletion for selected sounds, which also supports external keyboards on tablets.
- Optional Vibration API haptics on coarse-pointer devices for touch, drag, spatial drop, playback, sheet, location, and error states.

## Device classes and layout rules

| Class | Width | Primary posture | Layout pattern |
| --- | --- | --- | --- |
| Compact phone | `< 390px` | One-handed portrait | Condensed title, dock as paged rail, bottom controls in one row with overflow actions in sheet |
| Standard phone | `390px-767px` | One-handed portrait | Full horizontal dock, centered bottom action group, detail sheets at medium detent |
| Foldable / small tablet | `768px-1023px` | Two-handed portrait or landscape | Keep bottom dock in portrait; allow side dock in landscape when canvas width permits |
| Tablet | `>= 1024px` | Two-handed | Desktop side dock with larger sheets and persistent globe/detail affordances |

Rules:

- Use `dvh` for full-height surfaces and recompute canvas bounds after orientation changes.
- Reserve bottom safe-area space for browser chrome and home indicators.
- Keep primary touch targets at least 44px by 44px.
- Keep the play/pause control visible when any sheet is open unless the sheet is full-screen.
- Prefer progressive disclosure over dense toolbars; mobile should expose fewer simultaneous controls than desktop.

## App shell pattern

### Header

- Compact phone: show app name and current place on one or two lines; move radar ring style selection into a small "View" sheet if it crowds the title.
- Standard phone and larger: keep the current title/subtitle plus the ring picker as long as it does not overlap the canvas or sheets.
- State copy should reflect the active context:
  - Default region: region name.
  - Custom search result: place name and nearest soundscape subtitle.
  - Loading location: "Finding nearby soundscape..."
  - Geolocation denied: "Location access off - choose a place."

### Canvas

- The listener remains fixed in the visual center of the playable area.
- The playable area should shrink around the bottom dock and sheet detents so a sound never hides behind fixed controls.
- Selected sounds get a persistent visual affordance and a short haptic pulse where supported.
- Use a short "sound trail" or shadow while dragging to reinforce distance and panning changes without adding labels.

### Bottom dock

- Treat the dock as the mobile inventory for sounds.
- Horizontal scrolling is acceptable, but the active drag item should lift above the dock and canvas controls.
- If the region has more items than fit comfortably, add category chips or a "More sounds" sheet instead of shrinking touch targets.
- Dragging an active sound back to the dock removes it from the scene.

### Bottom action bar

Recommended order, left to right:

1. Use my location
2. Random location
3. Search place
4. Globe
5. Play/pause, if the play bar is not already visually dominant

When search expands, dim non-search controls and keep the location affordance anchored to the same side so the user can cancel predictably.

### Sheet stack

- Use bottom sheets for globe, sound detail, attributions, location search overflow, and dense settings.
- Detents:
  - Peek: confirms what opened without hiding the canvas.
  - Medium: default for detail editing and search.
  - Full: globe exploration, attributions, long lists, and error recovery.
- Background canvas remains visible and spatially stable behind peek/medium sheets.
- Closing a sheet should restore focus to the control or sound that opened it.

## Core mobile interactions

### Add a sound

1. User touches a sound tile in the dock.
2. Tile lifts after a small drag threshold; dock stays visible as origin.
3. While over the canvas, show a drop preview at the normalized spatial coordinate.
4. On release, add the sound, select it, and briefly show distance/pan feedback.
5. If released outside the canvas, fly the tile back to the dock.

Mobile-specific details:

- Prevent page scroll and browser gestures only during an active drag.
- If the finger blocks the icon, offset the preview slightly upward while keeping the actual drop point clear.
- On compact phones, allow tap-to-add as an alternative: tapping a dock tile places it near the listener and opens detail.

### Move a sound

1. User drags an active sound icon.
2. Audio engine updates position continuously.
3. Visual scale, z-index, and optional ring highlighting update with distance.
4. On release, spring the icon to its settled position and persist the normalized coordinate.

Mobile-specific details:

- Keep the icon under a generous hit slop, not just the visible art tile.
- If the drag approaches fixed UI, show the dock as a remove target.
- Avoid accidental sheet pulls by disabling sheet gesture capture while dragging a canvas sound.

### Inspect and tune

1. Tap an active sound.
2. Open a detail sheet at medium detent.
3. Show sound art, title, source context, volume, remove, and optional solo/mute controls.
4. Dragging the selected sound while the detail sheet is open should keep the sheet attached to that selection.

Mobile-specific details:

- Volume sliders need large handles and live audio feedback.
- Keep destructive remove actions separated from volume and attribution links.
- If audio is locked, show an inline "Tap to enable audio" callout in the detail sheet.

### Change place

Supported entry points:

- Use my location
- Random location
- Search place
- Globe pin

Mobile flow:

1. User chooses a location action.
2. Show loading feedback in the triggering control and sheet/header copy.
3. Resolve to a region or nearest template.
4. Clear or replace the active scene according to the selected mode.
5. Preload the new region audio and start playback only after the user gesture unlocks audio.

Open product decision:

- When switching places, confirm if the current scene has user-added sounds. The safest mobile default is a bottom confirmation sheet with:
  - Replace scene
  - Keep current mix and change palette
  - Cancel

### Explore globe

- Default to a full-height mobile sheet because globe gestures conflict with page gestures.
- Keep a visible close affordance and a collapsed list/search section.
- Pin selection should update the header and preview region before committing.
- Geocode search results should use large rows with place, country/region, and nearest soundscape.

### Share scene

- Use the existing URL-first model as the mobile sharing foundation.
- Primary action: native Web Share API when available.
- Fallback: copy link with a toast.
- Share payload should include region, custom place when present, active sounds, positions, volumes, and globe style.

## Haptics and vibration language

Haptics are an optional enhancement layered on top of visible and audible feedback. The app should never rely on vibration as the only signal because iOS Safari and many desktop browsers do not expose the Vibration API.

Implementation rules:

- Trigger vibration only when `navigator.vibrate` is available and the primary pointer is coarse.
- Keep patterns short; mobile web vibration is less nuanced than native haptics and can feel noisy if overused.
- Pair haptics with interaction milestones, not every animation frame.
- Match spatial audio semantics:
  - Moving closer to the listener produces a stronger proximity tick when crossing distance bands.
  - Crossing the center pan line produces a light tick.
  - Dropping near the listener feels stronger than dropping far away.
  - Volume slider ticks scale subtly with output level.
- Treat reduced-motion and unsupported-device cases as graceful no-ops; visible and audio feedback remain complete.

| Moment | Pattern | Audio/interaction meaning |
| --- | --- | --- |
| Touch sound tile | Short tap | User has grabbed an available sound |
| Drag leaves dock | Soft double pulse | Sound is now active in the spatial field |
| Drag crosses distance band | Throttled tick | Perceived loudness/depth is changing |
| Drag crosses center pan | Light tick | Stereo image crosses left/right center |
| Valid drop near listener | Stronger short pulse | Sound is close/louder |
| Valid drop mid/far | Medium/light pulse | Sound is placed farther away |
| Invalid drop | Warning double pulse | Scene did not change |
| Select/open detail | Short sheet pulse | Focus shifted to a sound or sheet |
| Remove sound | Heavier descending pulse | Source leaves the mix |
| Play | Double pulse | Audio graph starts/resumes |
| Pause | Single longer pulse | Audio graph stops |
| Location loading | Tiny tick | Async location work started |
| Location/region success | Confirming double pulse | New soundscape applied |
| Error/denied/unavailable | Warning double pulse | User needs recovery path |
| Volume crosses coarse step | Level-scaled tick | Gain changed enough to feel intentional |

Current build coverage:

- Palette pointer down, lift threshold, valid drop, and invalid drop.
- Active canvas sound drag start, proximity band ticks, pan-center ticks, and release/drop.
- Detail sheet opening and coarse volume changes.
- Remove-to-dock flows.
- Audio unlock, play, and pause controls.
- Search/globe sheet entry.
- Region changes from search, random, geolocation, and globe selection.
- Geolocation loading and error states from bottom controls and the globe sheet.

## Mobile state inventory

| State | Trigger | User-facing treatment |
| --- | --- | --- |
| First load | App opens | Show default region with bed sounds; keep audio unlock banner until first gesture |
| Audio locked | Browser blocks audio | Persistent, tappable banner and inline prompts in sheets |
| Audio unlocking | First gesture | Brief loading state on play control; avoid duplicate prompts; short tap haptic where supported |
| Playing | Audio context running | Play bar shows pause; moving sounds updates immediately; double play haptic |
| Paused | User pauses or tab suspends | Play bar shows play; scene remains interactive; single pause haptic |
| Region preloading | Region changes | Lightweight loading copy; keep previous UI responsive where safe; success haptic once applied |
| Dragging from dock | Pointer moves past threshold | Floating tile, drop preview, dock origin visible; lift haptic |
| Invalid drop | Release outside canvas | Return animation to dock and no scene mutation; warning haptic |
| Canvas sound selected | Tap or new drop | Selected ring, detail affordance, keyboard focus where applicable; short selection haptic |
| Returning to dock | Active sound dragged to dock | Remove target highlight, return animation, source fades/removes; remove haptic |
| Detail sheet open | Tap active sound | Medium sheet with volume, metadata, remove; sheet haptic |
| Search open | Tap search | Expanded bottom search with other controls dimmed; sheet haptic |
| Globe loading | Open globe bundle/map | Full-screen loading panel with cancel/close |
| Geolocation pending | Use my location | Button loading state and header copy; tiny loading tick |
| Geolocation denied | Permission denied | Recovery copy with search/globe alternatives; warning haptic |
| Geolocation unavailable | Browser/device unsupported | Disable location action and explain fallback; warning haptic |
| Slow network | Audio/globe fetch delayed | Skeletons or retry buttons, not silent failure |
| Reduced motion | OS setting enabled | No spring/flight dependency for comprehension |
| Landscape phone | Orientation changes | Reflow dock/actions; recalculate canvas and keep selected sound in bounds |
| Offline / flaky connection | Fetch failures | Existing loaded sounds continue; new assets show retry |

## Accessibility and inclusive interaction

- All icon-only actions need labels, visible focus, and pressed/expanded states.
- Drag-only flows need tap alternatives:
  - Tap dock tile to add.
  - Tap selected sound to open position controls or nudge buttons.
  - Remove from detail sheet.
- Respect reduced motion by replacing return flights and springs with fades or direct state changes.
- Keep color-independent state indicators for selected, loading, disabled, and remove-target states.
- Avoid relying on haptics; treat vibration as optional enhancement only, and keep every haptic-backed state visible in the UI.
- Screen reader mode should describe spatial coordinates as plain language, such as "near left", "far right", and "center".

## Performance and mobile browser constraints

- Lazy-load heavy globe code when the globe sheet first opens.
- Preload only the current region's sounds plus lightweight bed layers.
- Cap simultaneous active sounds to the current app limit unless mobile profiling shows safe headroom.
- Use compressed audio formats that balance quality and startup latency.
- Keep drag updates on pointer events and animation frames; avoid React state writes for every visual-only frame.
- Reuse decoded audio buffers across add/remove cycles.
- Test on Safari iOS, Chrome Android, and at least one low-memory Android profile.

## Implementation slices

1. **Interaction parity**
   - Add tap-to-add for dock tiles.
   - Add larger hit slop for active canvas sounds.
   - Ensure sheet gestures cannot steal active sound drags.
   - Keep haptics aligned with tap/drag alternatives so non-drag flows receive equivalent confirmation.

2. **Mobile state clarity**
   - Standardize loading, denied, unavailable, and retry states for geolocation/search/globe/audio.
   - Add confirmation sheet for replacing a scene when switching places.

3. **Compact layout**
   - Audit compact phone header/action overflow.
   - Move crowded view controls into a lightweight sheet.
   - Keep play and location controls reachable above safe areas.

4. **Share and persistence**
   - Wire scene decoding on load.
   - Add native share/copy fallback.
   - Restore selected region, custom location, and active sound layout from shared URLs.

5. **Performance hardening**
   - Lazy-load globe sheet internals.
   - Add loading boundaries for audio and map assets.
   - Profile drag frame rate and audio startup on target devices.

## Mobile QA checklist

- Add, move, inspect, tune, and remove sounds with touch only.
- Tap-to-add works without accidental drag.
- Audio unlock works after first tap on iOS Safari and Chrome Android.
- Play/pause state survives sheet open/close.
- Location permission pending, denied, and unavailable states are clear.
- Search and globe flows can change regions without losing feedback.
- Haptics fire on supported Android/coarse-pointer browsers for lift, drop, proximity-band crossing, center-pan crossing, play/pause, location loading/success/error, detail open, volume steps, and remove.
- Unsupported browsers and desktop pointers do not throw errors and still provide complete visual/audio feedback.
- Orientation changes preserve selected sound and canvas bounds.
- Reduced-motion mode remains understandable.
- Refreshing a deployed URL with query parameters loads the app through the SPA fallback.
- Vercel production deploy serves assets with long-lived cache headers and routes all app URLs to `index.html`.
