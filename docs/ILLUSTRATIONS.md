# Illustration sourcing

Saudade uses **historical illustrations and watercolours** for sound tiles—not wildlife photographs. That keeps tiles readable at small sizes, avoids mixed photo styles, and matches the public-domain collections we already use for ambience (Met Open Access drawings).

## Preferred sources (in order)

| Source | Best for | License | API |
|--------|----------|---------|-----|
| [NYPL Digital Collections](https://digitalcollections.nypl.org/) | Audubon *Birds of America* (octavo 1840–44), other ornithology | Public domain (NYPL-reviewed) | [Repo API](https://api.repo.nypl.org/) — **token required**; **deprecated Aug 1, 2026** |
| [Wikimedia Commons](https://commons.wikimedia.org/) | Buller NZ plates, Barraband, Iconographia Zoologica | Mostly public domain | MediaWiki API (no key) |
| [The Met Open Access](https://www.metmuseum.org/art/collection/search?isPublicDomain=true) | Surf, wind, forest, rain, stream pools | CC0 | Collection API + IIIF |

## NYPL Digital Collections (deep dive)

### Why NYPL fits this project

- Large **ornithological illustration** set, including John James Audubon’s octavo *Birds of America* (500 colour lithographs, Bowen/Endicott).
- Many items are explicitly **“no known U.S. copyright restrictions”** with direct image URLs.
- Same institution as your catbird link: [Cat-Bird, Pl. 140](https://digitalcollections.nypl.org/items/2a28c850-c5f9-012f-9b77-58d385a7bc34?canvasIndex=0) (Image ID **108398**).

### Bed-Stuy birds (current NYPL plates)

| Sound | Plate | Image ID | Item |
|-------|-------|----------|------|
| Gray catbird | Pl. 140 | 108398 | [Cat-Bird](https://digitalcollections.nypl.org/items/2a28c850-c5f9-012f-9b77-58d385a7bc34) |
| Northern cardinal | Pl. 203 | 108462 | [Common Cardinal Grosbeak](https://digitalcollections.nypl.org/items/43a68310-c5f9-012f-0599-58d385a7bc34) |
| Blue jay | Pl. 231 | 108491 | [Blue Jay](https://digitalcollections.nypl.org/items/510d47d9-7308-a3d9-e040-e00a18064a99) |

Octavo plate numbers differ from the famous Havell folio (e.g. folio Blue Jay = 102, octavo = 231).

### Images **without** the API (recommended for builds)

If you know the **Image ID** (shown on each item page), download derivatives directly:

```text
https://iiif-prod.nypl.org/index.php?id={imageId}&t=q   # ~1600 px JPEG
https://iiif-prod.nypl.org/index.php?id={imageId}&t=w   # ~760 px
https://images.nypl.org/index.php?id={imageId}&t=q     # fallback host
```

Derivative codes (from [NYPL API docs](https://api.repo.nypl.org/)): `q` = 1600px, `w` = 760px, `r` = 300px, `v` = 2560px, `g` = original dimensions.

This repo’s `npm run download:icons` reads `scripts/icon-manifest.json` → `nypl[]` and pulls `t=q` for tile artwork.

### Repo API (optional; for search & metadata)

1. Sign up at [api.repo.nypl.org](https://api.repo.nypl.org/) (free token, ~10k requests/day).
2. Search public-domain items:

   ```bash
   export NYPL_API_TOKEN=your_token
   npm run nypl:search -- "Cardinal Grosbeak" 
   ```

3. Example request:

   ```bash
   curl -s -H "Authorization: Token token=\"$NYPL_API_TOKEN\"" \
     "https://api.repo.nypl.org/api/v2/items/search?q=cat-bird+audubon&publicDomainOnly=true"
   ```

`item_details` responses can include `imageLinks` when `publicDomainOnly=true`. **No public replacement API is planned after August 2026**—keep stable `imageId` + `sourceUrl` in the manifest even if search breaks later.

### Attribution (required courtesy, not a legal requirement)

NYPL asks that you credit the library when possible:

> **From The New York Public Library**, with a link back to the item page.

The download script appends that to the author line in `artworkAttributions` (shown on the in-app **Attributions** page). Example MLA from NYPL:

> General Research Division, The New York Public Library. "Cat-Bird, 1. Male 2. Female … Pl. 140" The New York Public Library Digital Collections. 1841. https://digitalcollections.nypl.org/items/…

### Finding new plates

1. Browse [Birds of America collection](https://digitalcollections.nypl.org/collections/the-birds-of-america-from-drawings-made-in-the-united-states) or search with **Public domain** checked.
2. Open the item → note **Image ID** and **UUID** (permalink).
3. Add an entry under `nypl` in `scripts/icon-manifest.json`.
4. Run `npm run download:icons`.

**Tip:** Wikimedia often mirrors NYPL scans; filenames like `(NYPL b13559627-108462)` reveal the Image ID when the site search is slow.

### Illustration-only policy

- Use **prints, lithographs, watercolours** for species tiles.
- Avoid contemporary **photographs** unless there is no plate and license is acceptable (we removed the Central Park catbird photo for this reason).
- Met pools are already constrained to works on paper (see `icon-manifest.json` `pools`).

## Wikimedia & Met (short)

- **Wikimedia:** fixed species in `manifest.wikimedia`; use thumb URLs or Commons API for downloads.
- **Met:** `pools` + `soundPoolMap`; IIIF `main-image` / `preview`; CC0 attribution.

## Pipeline

```bash
npm run download:icons   # manifest → public/icons/, generates iconPools.generated.ts
```

Edit `scripts/icon-manifest.json`, then re-run. Per-icon crops live in `src/data/iconCrop.ts`.

See also [SOURCES.md](../SOURCES.md) and [ATTRIBUTIONS.md](../ATTRIBUTIONS.md).
