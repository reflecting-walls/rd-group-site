# Digital business card

- Public card: `card/index.html` (share as `https://www.rdgroup.info/card/`)
- Editor: `admin/card.html`
- Data: `card/card.json`. The editor reads and saves it through the shared admin store (`assets/js/data.js`), the same as the rest of the site.

## What the card does
- Call, Text, Email/Website, Map buttons, plus a docked "Save contact" bar after scrolling
- Save contact: builds a .vcf on the fly with photo, phone, website, address, socials, review links and a services note, so it's always current
- QR codes in two modes: "Open card" (static URL, safe to print) and "Save contact" (offline vCard). Download as PNG or print-ready SVG
- Share sheet, copy link, add to home screen (web app manifest)
- Combined star rating across review sites, per-site tiles that link out, featured quotes linking to the original review
- Swipeable recent-work gallery, services tags, credentials, custom link buttons
- Free-estimate form: posts to a Formspree/Basin endpoint if set, otherwise opens a pre-filled text to Rafal
- SEO: Person + HomeAndConstructionBusiness JSON-LD with aggregate rating, Open Graph tags, canonical URL, index toggle

## Editing and publishing
1. Open `admin/card.html` and make changes. The phone preview updates as you type, and unsaved edits survive a page reload.
2. Press **Save** (or Ctrl/Cmd+S). This saves a draft in this browser only. The public card keeps showing the published version; the editor preview shows the draft.
3. Press **Download update**. You get a .zip with `card/card.json` and any new photos in `card/media/`, together with any other admin changes.
4. Upload the zip's contents to the site repository. The site rebuilds, and the card is live.

## Placeholders to fill
Rafal's photo, cover photo, project photos, new email, review site links and numbers, social links, service area confirmation.

`card/vendor/qrcode.js` is qrcode-generator 1.4.4 (MIT, Kazuhiko Arase).
