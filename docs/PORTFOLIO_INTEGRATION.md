# Portfolio prototypes-page integration

This guide prepares the Spatial Audio prototype for integration into the `Portfolio` website repository at `https://github.com/Davidmarcell/Portfolio`.

The Portfolio repository was not available from this environment, so the integration is documented as a route-level contract that works for common Vercel-hosted React, Vite, Next.js, and static portfolio sites.

## Recommended integration model

Use a standalone Vercel deployment for this prototype and add it to the Portfolio site's prototypes page as a card that opens or embeds the deployed URL.

Why this is preferred:

- The prototype stays independently buildable and deployable.
- The Portfolio site does not inherit the prototype's Web Audio, Three.js, globe.gl, or large audio/artwork assets.
- The prototypes page can lazy-load an iframe or link out without increasing the Portfolio site's main bundle.
- Query-string sharing, globe styles, and future scene sharing remain owned by this app.

### Standalone Vercel settings

The root `vercel.json` is ready for this model:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Install command | `npm ci` |
| Development command | `npm run dev` |
| Build command | `npm run build` |
| Output directory | `dist` |

The deployment also includes:

- SPA fallback to `index.html`.
- Long-lived cache headers for Vite assets, bundled audio, and bundled icons.
- Basic document security headers.
- No `X-Frame-Options` header, so the Portfolio prototypes page can embed the deployed prototype in an iframe.

### Portfolio prototypes-page card contract

Add a prototype entry similar to:

| Field | Value |
| --- | --- |
| Title | Spatial Audio |
| Slug | `spatial-audio` |
| Route | `/prototypes/spatial-audio` |
| Live URL | Vercel production URL for this repo |
| Summary | Interactive ambient soundscape composer with spatial Web Audio, mobile haptics, globe map, and museum-sourced artwork. |
| Tags | React, TypeScript, Web Audio, mobile interaction, haptics, globe.gl |
| Status | Prototype |

Suggested page behavior:

- Display the prototype on the Portfolio prototypes page as a card.
- Open the live prototype in a new tab for the most reliable audio behavior.
- If embedding inline, lazy-load the iframe only after the user chooses "Launch prototype" or scrolls near the card.
- Give the iframe an explicit title, for example `title="Spatial Audio prototype"`.
- Include the permissions needed by browser APIs:

```html
<iframe
  src="https://YOUR-SPATIAL-AUDIO-VERCEL-URL"
  title="Spatial Audio prototype"
  loading="lazy"
  allow="autoplay; geolocation"
></iframe>
```

Notes:

- Web Audio still requires a user gesture before sound can play.
- Geolocation may prompt from inside the iframe; linking out is more reliable on mobile Safari.
- Mobile vibration/haptics only run on browsers that expose `navigator.vibrate` and coarse pointers.

## Subpath static-export model

If the Portfolio site should serve the prototype from the same Vercel project and domain, build this app for the Portfolio subpath:

```bash
npm ci
npm run build:portfolio
```

This emits `dist/` with Vite's base path set to:

```text
/prototypes/spatial-audio/
```

Then copy the contents of this repo's `dist/` folder into the Portfolio repo's public/static folder at the matching route:

| Portfolio stack | Copy target |
| --- | --- |
| Next.js App/Pages Router | `public/prototypes/spatial-audio/` |
| Vite/static site | `public/prototypes/spatial-audio/` or equivalent static passthrough |
| Astro/SvelteKit/static adapter | `public/prototypes/spatial-audio/` or `static/prototypes/spatial-audio/` depending on the stack |

The app has been prepared for this mode by:

- Reading the Vite base path from `VITE_BASE_PATH`.
- Resolving public audio and icon URLs against `import.meta.env.BASE_URL`.
- Keeping external globe textures and Wikimedia/Met source links absolute.

### Portfolio Vercel routing for subpath export

For a static copied export, the Portfolio site should serve:

- `/prototypes/spatial-audio/` -> `public/prototypes/spatial-audio/index.html`
- `/prototypes/spatial-audio/assets/*` -> copied Vite assets
- `/prototypes/spatial-audio/audio/*` -> copied audio assets
- `/prototypes/spatial-audio/icons/*` -> copied icon assets

If the Portfolio app has a catch-all route or middleware, make sure it does not rewrite these static prototype assets to the Portfolio app shell.

Recommended cache headers in the Portfolio Vercel project:

```json
{
  "headers": [
    {
      "source": "/prototypes/spatial-audio/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/prototypes/spatial-audio/audio/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/prototypes/spatial-audio/icons/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

## Deployment checklist

Before linking or copying into the Portfolio repository:

1. Run `npm run build` for standalone root hosting.
2. Run `npm run build:portfolio` for subpath hosting.
3. Run `npm run lint`.
4. Confirm the app loads at the chosen URL.
5. Confirm audio unlock, play/pause, globe sheet, location search, and mobile controls.
6. Add a prototypes-page card in the Portfolio repo.
7. Update `README.md` and `docs/PORTFOLIO.md` with the final live URL.

## Recommended Portfolio implementation steps

1. In the Portfolio repo, find the data source or route that renders the prototypes page.
2. Add a `spatial-audio` prototype entry using the card contract above.
3. Use the standalone Vercel URL as the first integration path.
4. Optionally add a launch modal or iframe preview that lazy-loads the prototype.
5. If the Portfolio team wants same-domain hosting, switch to the subpath static-export model and copy `dist/` to `public/prototypes/spatial-audio/`.
6. Push the Portfolio repo to Vercel and verify the prototypes page in production.
