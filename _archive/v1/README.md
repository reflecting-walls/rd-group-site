# RD Group, Inc. website (static)

Plain HTML/CSS/JS. No build step, no backend. Open `index.html` in a browser, or drop the folder on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

## Files
- `index.html` — the full one-page site (styles and script inline)
- `business-card.html` — print-ready card, front and back (3.5 x 2 in trim, 0.125 in bleed). `business-card-preview.png` is a quick look.
- `assets/logo-mark.svg`, `assets/logo-mark-dark.svg` — the house + RD mark
- `assets/logo-horizontal.svg`, `assets/logo-horizontal-reversed.svg` — mark with wordmark. The wordmark uses the Archivo font; outline the text in Illustrator/Figma before sending to a printer.

## Details taken from the old business card
RD Group, Inc. · Rafal Dmochowski · 773-936-9244 · www.rdgroup.info · "Major Home Repairs - Kitchens and Bathrooms". The old email is intentionally not used.

## Still placeholders (search the files for these)
- New email address (site contact block + card back)
- "Chicago, IL" / "Chicago and nearby suburbs" — inferred from the 773 area code; confirm the service area
- Project photos: the blue blueprint drawings ("Add project photo") are stand-ins. Replace each `<svg><use .../></svg>` inside a `.plate` with `<img src="images/your-photo.jpg" alt="...">`
- Project names, sizes and durations in the portfolio sheets
- Hero photo and photo of Rafal
- Founded year and license number (About section, footer)
- Three client reviews (paste real ones)
- Social links in the footer
- Typical timelines in Services — adjust to Rafal's real numbers

## Quote form
There is no server, so the form doesn't send anything yet. Connect it to Formspree, Netlify Forms or Basin by setting the form's `action` and removing the `preventDefault` handler at the bottom of `index.html`.
