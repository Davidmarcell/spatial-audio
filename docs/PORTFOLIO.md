# Spatial Audio — Portfolio case study

_Copy the sections below into your portfolio site, CMS, or LinkedIn project description._

---

## One-liner

An interactive ambient soundscape composer where you drag sounds through 2D space and hear them respond with real-time volume and stereo panning via the Web Audio API.

## Live demo

**URL:** _[Add after deploy — e.g. https://spatial-audio.vercel.app]_

**GitHub:** _[Add repo URL if public]_

---

## The problem

Most ambient or nature apps play a fixed mix. I wanted something closer to *being in a place* — where you decide what you hear, where each sound sits in space, and how loud it feels relative to you. The challenge was making spatial audio feel intuitive in the browser without a game engine: drag-and-drop placement, immediate feedback, and enough polish that the experience feels like a product, not a demo.

## The approach

I built **Spatial Audio** as a static React app with a custom Web Audio graph. Each sound is a looping source routed through gain and stereo panner nodes; dragging on a radar-style canvas updates position in real time. Regions (Auckland, Rio, Bed-Stuy, London, the Dolomites, and others) ship curated palettes and always-on ambient beds so a scene sounds coherent even before you add layers.

The UI uses **Silk** swipeable sheets for stacked navigation — globe map, sound art detail, attributions — without leaving the main canvas. A **globe.gl** explorer adds a Radio Garden–style map: curated pins, geocode search for custom locations, and nearest-region matching from browser geolocation. Tile artwork comes from **NYPL Digital Collections** (Audubon lithographs), **The Met Open Access**, and **Wikimedia Commons**, chosen so small icons stay readable and legally clear.

Sharing is URL-first: globe textures persist via query params; soundscape state compresses into shareable links (layout, region, custom pin). Everything ships as a Vite static build deployable to Vercel or Netlify.

## Highlights

- Real-time spatial mixing in the browser (distance → volume, horizontal position → pan)
- Six environments with region-specific palettes and CC0 / public-domain audio
- Globe map with geocoding, “use my location,” and custom pins
- Museum-sourced illustration tiles with full in-app attributions
- Silk sheet stack for mobile-friendly layered UI
- Production-ready static deploy (`vercel.json`, `netlify.toml`)

---

## Suggested portfolio fields

| Field | Value |
| --- | --- |
| **Title** | Spatial Audio |
| **Role** | Design & development |
| **Year** | 2025–2026 |
| **Tags** | React, TypeScript, Web Audio API, globe.gl, Three.js, interactive audio, creative coding |
| **Featured image** | Main canvas screenshot (see `docs/screenshots/`) |

## Suggested prototypes-page entry

| Field | Value |
| --- | --- |
| **Slug** | `spatial-audio` |
| **Route** | `/prototypes/spatial-audio` |
| **Status** | Prototype |
| **Summary** | Interactive ambient soundscape composer with spatial Web Audio, mobile haptics, globe map, and museum-sourced artwork. |
| **Launch URL** | _Use the Vercel production URL for this repo, or the same-domain static export at `/prototypes/spatial-audio/`._ |

Integration notes: see [docs/PORTFOLIO_INTEGRATION.md](./PORTFOLIO_INTEGRATION.md).

---

## Screenshots checklist

Before publishing, add 2–3 images to `docs/screenshots/`:

1. **Hero** — Canvas with 3–4 sounds placed, play bar visible
2. **Globe** — Map sheet open with pins or geocode search
3. **Detail** — Sound art detail sheet or Bed-Stuy NYPL bird tiles

Then update the preview table in the root [README.md](../README.md).
