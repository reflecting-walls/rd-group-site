#!/usr/bin/env node
// Static site generator for RD Group, Inc. No dependencies (Node 18+).
//
//   node scripts/build.mjs                 -> dist/  (production: sample content dropped)
//   SAMPLES=1 node scripts/build.mjs       -> include the sample projects/reviews
//   PREVIEW=1 ...                          -> links end in index.html (for file:// or artifact previews)
//
// Content comes from data/*.json (edited in /admin and uploaded as an update zip).
// Optional: with GOOGLE_PLACES_API_KEY and/or YELP_API_KEY set on the host, Google and
// Yelp ratings and their newest reviews are refreshed at every build.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');
const SAMPLES = process.env.SAMPLES === '1';
const PREVIEW = process.env.PREVIEW === '1';
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const YELP_KEY = process.env.YELP_API_KEY || '';

// ---------- data ----------
const readJSON = async (f) => JSON.parse(await fs.readFile(path.join(ROOT, 'data', f), 'utf8'));

// ---------- optional review refresh ----------
async function refreshReviews(sources, reviews) {
  for (const src of sources) {
    try {
      if (src.kind === 'google_places' && src.external_id && GOOGLE_KEY) {
        const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(src.external_id)}`, { headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,reviews' } });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        const p = await res.json();
        src.rating = p.rating ?? src.rating; src.review_count = p.userRatingCount ?? src.review_count; src.profile_url ||= p.googleMapsUri || '';
        for (const r of p.reviews || []) mergeReview(reviews, { source_id: src.id, external_id: r.name, author_name: r.authorAttribution?.displayName || 'Google user', rating: r.rating, text: r.originalText?.text || r.text?.text || '', review_url: r.googleMapsUri || p.googleMapsUri || '', published_at: r.publishTime || null });
        console.log(`Google: ${src.rating} from ${src.review_count} reviews`);
      }
      if (src.kind === 'yelp_fusion' && src.external_id && YELP_KEY) {
        const h = { Authorization: `Bearer ${YELP_KEY}`, accept: 'application/json' };
        const b = await fetch(`https://api.yelp.com/v3/businesses/${encodeURIComponent(src.external_id)}`, { headers: h });
        if (!b.ok) throw new Error(`${b.status} ${await b.text()}`);
        const biz = await b.json();
        src.rating = biz.rating ?? src.rating; src.review_count = biz.review_count ?? src.review_count; src.profile_url ||= (biz.url || '').split('?')[0];
        const r = await fetch(`https://api.yelp.com/v3/businesses/${encodeURIComponent(src.external_id)}/reviews?limit=3&sort_by=yelp_sort`, { headers: h });
        if (r.ok) for (const x of (await r.json()).reviews || []) mergeReview(reviews, { source_id: src.id, external_id: x.id, author_name: x.user?.name || 'Yelp user', rating: x.rating, text: x.text || '', review_url: x.url || biz.url, published_at: x.time_created ? x.time_created.slice(0, 10) : null });
        console.log(`Yelp: ${src.rating} from ${src.review_count} reviews`);
      }
    } catch (e) { console.warn(`Review refresh for ${src.name} skipped: ${e.message}`); }
  }
}
function mergeReview(reviews, r) {
  const existing = reviews.find((x) => x.source_id === r.source_id && x.external_id === r.external_id);
  if (existing) { if (!existing.hidden) Object.assign(existing, { rating: r.rating, text: r.text, review_url: r.review_url }); }
  else reviews.push({ id: `${r.source_id}-${r.external_id}`, featured: false, hidden: false, project_id: null, ...r });
}

async function loadData() {
  const [services, towns, faqs] = await Promise.all([readJSON('services.json'), readJSON('towns.json'), readJSON('faqs.json')]);
  let [business, projects, media, sources, reviews] = await Promise.all(['business.json', 'projects.json', 'media.json', 'review-sources.json', 'reviews.json'].map(readJSON));
  sources = sources.filter((x) => x.enabled !== false).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  await refreshReviews(sources, reviews);
  projects = projects.filter((p) => p.published).sort((a, b) => String(b.completed_on || '').localeCompare(String(a.completed_on || '')));
  reviews = reviews.filter((r) => !r.hidden);
  for (const m of media) m.url = String(m.url || '').replace(/^\//, '');
  if (!SAMPLES) {
    projects = projects.filter((p) => !p.sample);
    media = media.filter((m) => !m.sample);
    reviews = reviews.filter((r) => !r.sample);
  }
  const mediaByProject = {};
  for (const m of media) if (m.project_id) (mediaByProject[m.project_id] ||= []).push(m);
  for (const list of Object.values(mediaByProject)) list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  for (const p of projects) {
    p.media = mediaByProject[p.id] || [];
    p.cover = p.media.find((m) => m.id === p.cover_media_id) || p.media[0] || null;
  }
  const sourceById = Object.fromEntries(sources.map((s) => [s.id, s]));
  reviews = reviews.filter((r) => sourceById[r.source_id]);
  reviews.sort((a, b) => (b.featured - a.featured) || (b.rating - a.rating) || String(b.published_at).localeCompare(String(a.published_at)));
  return { business, services, towns, faqs, projects, media, sources, sourceById, reviews };
}

// ---------- helpers ----------
const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');
const townSlug = (name) => slugify(name);
const townPagePath = (t) => `/kitchen-bathroom-remodeling-${t.slug}-${t.state.toLowerCase()}/`;
const stars = (n) => '★★★★★'.slice(0, Math.round(n || 0)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n || 0));
const fmtDate = (d) => (d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '');
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const tagLabel = (t) => t.replace(/-/g, ' ');

function makeLinker(pagePath) {
  const depth = pagePath.split('/').filter(Boolean).length - (pagePath.endsWith('.html') ? 1 : 0);
  const prefix = depth ? '../'.repeat(depth) : './';
  return (target) => {
    if (/^(https?:|mailto:|tel:|#|data:)/.test(target)) return target;
    let [p, hash] = target.split('#');
    p = p.replace(/^\//, '');
    if (PREVIEW && (p === '' || p.endsWith('/'))) p += 'index.html';
    return (prefix + p).replace(/^\.\/$/, './') + (hash ? '#' + hash : '');
  };
}

// ---------- page chrome ----------
function head(c, meta) {
  const { business: b } = c.data;
  const canonical = b.website.replace(/\/$/, '') + meta.path;
  const img = meta.image ? (meta.image.startsWith('http') ? meta.image : b.website.replace(/\/$/, '') + '/' + meta.image.replace(/^\//, '')) : b.website + '/assets/logo/og-image.png';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(meta.title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${esc(canonical)}">
${meta.noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(b.legalName)}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FAFAF8">
<link rel="icon" href="${c.u('/assets/logo/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,200..700&family=Hanken+Grotesk:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${c.u('/assets/css/tokens.css')}">
<link rel="stylesheet" href="${c.u('/assets/css/site.css')}">
${(meta.jsonld || []).map(ld).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>`;
}

function header(c, active) {
  const { business: b } = c.data;
  const nav = [['/kitchen-remodeling/', 'Kitchens'], ['/bathroom-remodeling/', 'Bathrooms'], ['/home-remodeling/', 'Other Spaces'], ['/projects/', 'Projects'], ['/reviews/', 'Reviews'], ['/service-area/', 'Service Area']];
  const hours = b.hours.filter((h) => h.open).map((h) => `${h.days} ${h.open}–${h.close}`).join(' · ');
  return `
<div class="topbar"><div class="wrap"><span class="hours">${esc(hours)}</span><a href="tel:${esc(b.phoneE164)}">Call Rafal · ${esc(b.phone)}</a></div></div>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="${c.u('/')}" aria-label="${esc(b.legalName)} home"><img src="${c.u('/assets/logo/rd-logo.svg')}" alt="${esc(b.legalName)}" width="514" height="124"></a>
    <nav class="nav" id="nav" aria-label="Main">
      ${nav.map(([href, label]) => `<a href="${c.u(href)}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
    </nav>
    <a class="btn btn-ink header-cta" href="${c.u('#estimate')}">Free Consultation</a>
    <button class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</header>
<main id="main">`;
}

function footer(c) {
  const { business: b, services, towns } = c.data;
  const live = towns.filter((t) => t.published);
  const hours = b.hours.map((h) => `<li>${esc(h.days)}: ${h.open ? `${esc(h.open)} – ${esc(h.close)}` : 'Closed'}</li>`).join('');
  return `</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <img src="${c.u('/assets/logo/rd-logo-reversed.svg')}" alt="${esc(b.legalName)}" width="514" height="124" loading="lazy">
      <p>${esc(b.summary)}</p>
    </div>
    <div><h4>Services</h4><ul>${services.map((s) => `<li><a href="${c.u('/' + s.slug + '/')}">${esc(s.name)}</a></li>`).join('')}<li><a href="${c.u('/projects/')}">Project gallery</a></li></ul></div>
    <div><h4>Service area</h4><ul>${live.map((t) => `<li><a href="${c.u(townPagePath(t))}">${esc(t.name)}, ${t.state}</a></li>`).join('')}<li><a href="${c.u('/service-area/')}">All towns we serve</a></li></ul></div>
    <div><h4>Contact</h4><ul><li><a href="tel:${esc(b.phoneE164)}">${esc(b.phone)}</a></li>${b.email ? `<li><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>` : ''}<li>${esc(b.city)}, ${esc(b.state)}</li>${hours}<li><a href="${c.u('/card/')}">Rafal's digital card</a></li></ul></div>
  </div>
  <div class="wrap footer-base">
    <span>© ${new Date().getFullYear()} ${esc(b.legalName)}${b.license ? ` · License ${esc(b.license)}` : ''} · Licensed &amp; insured</span>
    <span><a href="${c.u('/reviews/')}">Reviews</a> · <a href="${c.u('/service-area/')}">Service area</a></span>
    <span class="credit">Site Developed and Maintained by <a href="https://rwmediapros.com/" target="_blank" rel="noopener">RW Media</a></span>
  </div>
</footer>
<div class="mobile-bar">
  <a class="btn btn-line" href="tel:${esc(b.phoneE164)}">Call</a>
  <a class="btn btn-ink" href="${c.u('#estimate')}">Free Quote</a>
</div>
<script src="${c.u('/assets/js/site.js')}" defer></script>
</body>
</html>
`;
}

// ---------- JSON-LD ----------
function businessLD(c) {
  const { business: b, services, towns, sources } = c.data;
  const sameAs = [...(b.sameAs || []), ...sources.map((s) => s.profile_url).filter(Boolean)];
  return {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    '@id': b.website + '/#business',
    name: b.legalName,
    url: b.website,
    logo: b.website + '/assets/logo/rd-mark.svg',
    image: b.website + '/assets/logo/og-image.png',
    telephone: b.phoneE164,
    ...(b.email ? { email: b.email } : {}),
    priceRange: b.priceRange,
    description: b.summary,
    founder: { '@type': 'Person', name: b.founder, jobTitle: 'Owner', url: b.website + '/card/' },
    ...(b.foundedYear ? { foundingDate: b.foundedYear } : {}),
    address: { '@type': 'PostalAddress', addressLocality: b.city, addressRegion: b.state, ...(b.streetAddress ? { streetAddress: b.streetAddress } : {}), ...(b.postalCode ? { postalCode: b.postalCode } : {}), addressCountry: 'US' },
    geo: b.geo ? { '@type': 'GeoCoordinates', latitude: b.geo.latitude, longitude: b.geo.longitude } : undefined,
    areaServed: [
      ...(b.geo ? [{ '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: b.geo.latitude, longitude: b.geo.longitude }, geoRadius: Math.round((b.serviceRadiusMiles || 30) * 1609.34) }] : []),
      ...towns.map((t) => ({ '@type': 'City', name: `${t.name}, ${t.state}` })),
    ],
    openingHours: b.hours.map((h) => h.schema).filter(Boolean),
    hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Remodeling services', itemListElement: services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.short, url: b.website + '/' + s.slug + '/' } })) },
    ...(sameAs.length ? { sameAs } : {}),
  };
}
const faqLD = (faqs) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
const crumbLD = (c, items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: c.data.business.website + p })) });

// ---------- components ----------
function mediaImg(c, m, { sizes = '', eager = false, alt } = {}) {
  if (!m) return '';
  const src = /^https?:/.test(m.url) ? m.url : c.u('/' + m.url);
  return `<img src="${esc(src)}" alt="${esc(alt ?? m.alt ?? '')}" width="${m.width || 1600}" height="${m.height || 1200}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${sizes ? ` sizes="${sizes}"` : ''}>`;
}

function projectCard(c, p) {
  return `<a class="project" href="${c.u('/projects/' + p.slug + '/')}" data-tags="${esc((p.tags || []).join(' '))}" data-town="${esc(townSlug(p.town || ''))}">
  <div class="frame">${mediaImg(c, p.cover, { alt: p.cover?.alt || p.title })}${p.sample ? '<span class="frame-tag">Sample</span>' : ''}</div>
  <div class="project-meta"><h3>${esc(p.title)}</h3><p>${esc([p.town && `${p.town}, ${p.state || 'IL'}`, (p.tags || [])[0] && tagLabel(p.tags[0])].filter(Boolean).join(' · '))}</p></div>
</a>`;
}

function reviewCard(c, r) {
  const s = c.data.sourceById[r.source_id];
  const link = r.review_url || s.profile_url;
  return `<figure class="review">
  <div class="review-top"><span class="src-badge"><span class="src-dot" style="background:${esc(s.color || '#A88553')}"></span>${esc(s.name)}</span><span class="stars" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</span></div>
  <blockquote class="clamp">${esc(r.text)}</blockquote>
  <figcaption><span><b>${esc(r.author_name)}</b>${esc(fmtDate(r.published_at))}</span>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener nofollow">Read on ${esc(s.name)} ↗</a>` : ''}</figcaption>
</figure>`;
}

function overall(c) {
  const rated = c.data.sources.filter((s) => s.rating && s.review_count);
  if (!rated.length) return null;
  const count = rated.reduce((n, s) => n + s.review_count, 0);
  const avg = rated.reduce((n, s) => n + s.rating * s.review_count, 0) / count;
  return { avg: Math.round(avg * 10) / 10, count, platforms: rated.length };
}

function reviewsSection(c, { limit = 6, list = c.data.reviews, heading = 'What homeowners say', id = 'reviews' } = {}) {
  const { sources } = c.data;
  const o = overall(c);
  const shown = list.slice(0, limit);
  const anySample = shown.some((r) => r.sample);
  return `<section class="band band-night" id="${id}">
  <div class="wrap">
    <div class="review-summary">
      <div class="overall">
        <p class="label">Reviews</p>
        <h2 class="h-lg">${esc(heading)}</h2>
        ${o ? `<div class="overall-num">${o.avg.toFixed(1)}</div><div class="stars" aria-hidden="true">${stars(o.avg)}</div><p>Average of ${o.count} reviews across ${o.platforms} platforms</p>` : '<p>Ratings from every platform we\'re listed on, each linking to the original review.</p>'}
      </div>
      <div class="sources">
        ${sources.map((s) => {
          const inner = `<span class="source-name"><span class="src-dot" style="background:${esc(s.color || '#A88553')}"></span>${esc(s.name)}</span>${s.rating ? `<span class="source-rating">${Number(s.rating).toFixed(1)} <span class="stars">${stars(s.rating)}</span></span><span class="source-count">${s.review_count || 0} reviews</span>` : '<span class="source-count">Rating coming soon</span>'}${s.profile_url ? '<span class="source-cta">See all on ' + esc(s.name) + ' ↗</span>' : ''}`;
          return s.profile_url ? `<a class="source" href="${esc(s.profile_url)}" target="_blank" rel="noopener nofollow">${inner}</a>` : `<div class="source">${inner}</div>`;
        }).join('\n        ')}
      </div>
    </div>
    ${shown.length ? `<div class="reviews">${shown.map((r) => reviewCard(c, r)).join('\n')}</div>` : ''}
    ${anySample ? '<p class="sample-note">Preview: these are labeled sample reviews. Real reviews replace them once the review platforms are connected in the admin.</p>' : ''}
    ${list.length > limit ? `<p style="margin-top:2rem"><a class="arrow-link" href="${c.u('/reviews/')}">Read all ${list.length} reviews</a></p>` : ''}
  </div>
</section>`;
}

function estimateSection(c, { towns } = {}) {
  const { services } = c.data;
  return `<section class="band band-stone" id="estimate">
  <div class="wrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:clamp(2rem,5vw,5rem);align-items:center">
    <div class="head" style="margin:0">
      <p class="label">Free in-home consultation</p>
      <h2 class="h-lg">Tell us about your project</h2>
      <p class="lede">Rafal will call you back within one business day to set up a visit. You'll get a fixed, itemized written quote a few days after.</p>
      <p><a class="arrow-link" href="tel:${esc(c.data.business.phoneE164)}">Or call ${esc(c.data.business.phone)}</a></p>
    </div>
    ${quoteForm(c, 'estimate-form')}
  </div>
</section>`;
}

function quoteForm(c, id) {
  const { services } = c.data;
  return `<form class="quote-card" id="${id}" data-lead-form${c.data.business.formEndpoint ? ` data-endpoint="${esc(c.data.business.formEndpoint)}"` : ''} data-phone="${esc(c.data.business.phone)}" novalidate>
  <h2>Request a consultation</h2>
  <p class="sub">No cost, no obligation.</p>
  <div class="row-2">
    <div class="field"><label for="${id}-name">Name</label><input id="${id}-name" name="name" autocomplete="name" required></div>
    <div class="field"><label for="${id}-phone">Phone</label><input id="${id}-phone" name="phone" type="tel" autocomplete="tel" required></div>
  </div>
  <div class="row-2">
    <div class="field"><label for="${id}-email">Email</label><input id="${id}-email" name="email" type="email" autocomplete="email"></div>
    <div class="field"><label for="${id}-zip">ZIP code</label><input id="${id}-zip" name="zip" inputmode="numeric" autocomplete="postal-code"></div>
  </div>
  <div class="field"><label for="${id}-type">Project</label><select id="${id}-type" name="project">${services.map((s) => `<option>${esc(s.name)}</option>`).join('')}<option>Something else</option></select></div>
  <div class="field"><label for="${id}-msg">Details</label><textarea id="${id}-msg" name="message" placeholder="Rooms, rough size, timing"></textarea></div>
  <div class="hp" aria-hidden="true"><label for="${id}-website">Leave this empty</label><input id="${id}-website" name="website" tabindex="-1" autocomplete="off"></div>
  <button class="btn btn-ink" type="submit">Send request</button>
  <p class="form-status" role="status" hidden></p>
</form>`;
}

function faqBlock(faqs, heading = 'Questions homeowners ask') {
  return `<section class="band">
  <div class="wrap faq-grid">
    <div class="head"><p class="label">FAQ</p><h2 class="h-lg">${esc(heading)}</h2></div>
    <div class="faq">${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
  </div>
</section>`;
}

const processSteps = [
  ['Consultation', 'Rafal visits, measures and talks through how you want the room to work. Free, usually within a week of your call.'],
  ['Written quote', 'An itemized scope and fixed price a few days later, with a realistic start date.'],
  ['Build', 'Permits pulled, materials ordered, then one crew on site from demolition to finish, with the work area sealed and cleaned daily.'],
  ['Walkthrough', 'We go through the finished room together, close out the punch list and pass final inspection.'],
];
const processBlock = () => `<section class="band band-stone">
  <div class="wrap">
    <div class="head"><p class="label">How it works</p><h2 class="h-lg">Four steps from first call to finished room</h2></div>
    <ol class="steps">${processSteps.map(([h, p]) => `<li><h3>${h}</h3><p>${p}</p></li>`).join('')}</ol>
  </div>
</section>`;

// ---------- pages ----------
function pageHome(c) {
  const { business: b, services, projects, faqs, towns } = c.data;
  const o = overall(c);
  const show = [...projects.filter((p) => p.featured), ...projects.filter((p) => !p.featured)].slice(0, 5);
  const heroImg = show[0]?.cover;
  const title = 'Kitchen & Bathroom Remodeling in Palatine, IL | RD Group';
  const description = `RD Group, Inc. remodels kitchens and bathrooms in Palatine and the Northwest Suburbs. Owner-run by Rafal Dmochowski. Free in-home consultation and fixed written quote. Call ${b.phone}.`;
  const facts = [
    b.yearsExperience && ['Years building', b.yearsExperience + '+'],
    b.projectsCompleted && ['Projects completed', b.projectsCompleted + '+'],
    ['Bath remodel', '3–5 wks'],
    ['Kitchen remodel', '6–10 wks'],
    b.warrantyYears && ['Workmanship warranty', b.warrantyYears + ' yrs'],
  ].filter(Boolean).slice(0, 3);
  return head(c, { path: '/', title, description, image: heroImg?.url, jsonld: [businessLD(c), faqLD(faqs)] }) + header(c, '/') + `
<section class="hero">
  <div class="hero-media">${heroImg ? mediaImg(c, heroImg, { eager: true, alt: '' }) : `<img src="${c.u('/assets/img/materials/calacatta.webp')}" alt="" width="1600" height="1200" fetchpriority="high">`}</div>
  <div class="wrap hero-grid">
    <div>
      <p class="label" style="color:var(--brass)">Palatine · Northwest Suburbs</p>
      <h1 class="h-xl">Kitchen &amp; bathroom remodeling in Palatine, <em>built to last</em>.</h1>
      <p class="lede">RD Group, Inc. is an owner-run remodeling contractor in Palatine, IL. We build full kitchen and bathroom remodels across the Northwest Suburbs, usually 3 to 5 weeks on site for a bathroom and 6 to 10 weeks for a kitchen, with a fixed written quote before any work starts.</p>
      <div class="hero-actions">
        <a class="btn btn-light" href="${c.u('/projects/')}">View Projects</a>
        <a class="btn btn-line" href="tel:${esc(b.phoneE164)}">Call ${esc(b.phone)}</a>
      </div>
      <div class="rating-chips">
        ${o ? `<span><b>${o.avg.toFixed(1)}</b> <span class="stars">★★★★★</span> from ${o.count} reviews</span>` : ''}
        ${c.data.sources.filter((s) => s.rating).map((s) => `<a href="${c.u('/reviews/')}"><b>${Number(s.rating).toFixed(1)}</b> ${esc(s.name)}</a>`).join('')}
        <span>Licensed &amp; insured</span><span>Free consultation</span>
      </div>
    </div>
    <div id="estimate">${quoteForm(c, 'hero-form')}</div>
  </div>
</section>

<section class="band" id="services">
  <div class="wrap">
    <div class="head-row">
      <div class="head"><p class="label">What we do</p><h2 class="h-lg">Kitchens and bathrooms first. The rest of the house, too.</h2></div>
      <a class="arrow-link" href="${c.u('/projects/')}">See finished work</a>
    </div>
    <div class="services">
      ${services.map((s) => `<a class="service" href="${c.u('/' + s.slug + '/')}"><div class="frame"><img src="${c.u('/' + s.image)}" alt="" width="1600" height="1200" loading="lazy" decoding="async"></div><h3>${esc(s.name)}</h3><p>${esc(s.short)}</p><span class="arrow-link" style="justify-self:start">Learn more</span></a>`).join('\n      ')}
    </div>
  </div>
</section>

${show.length ? `<section class="band" style="padding-top:0" id="work">
  <div class="wrap">
    <div class="head-row">
      <div class="head"><p class="label">Portfolio</p><h2 class="h-lg">Recent projects</h2></div>
      <a class="arrow-link" href="${c.u('/projects/')}">All projects</a>
    </div>
    <div class="projects${show.length === 5 ? ' featured' : ''}">${show.map((p) => projectCard(c, p)).join('\n')}</div>
  </div>
</section>` : ''}

${processBlock()}

${reviewsSection(c)}

<section class="band" id="about">
  <div class="wrap about">
    <div class="frame"><img src="${c.u('/assets/img/materials/plaster.webp')}" alt="" width="1600" height="1200" loading="lazy"><span class="frame-tag">Photo of Rafal</span></div>
    <div class="about-copy">
      <p class="label">About RD Group</p>
      <h2 class="h-lg">Owner-run. Rafal is on every job.</h2>
      <p>RD Group, Inc. is owned and run by ${esc(b.founder)}. He meets every client, walks every job, and signs off on the work before the final walkthrough. We keep a small, steady crew and take on a limited number of remodels at a time, so the schedule in your quote is one we can keep.</p>
      <p>Most of our work is full kitchen and bathroom remodels in Palatine, Arlington Heights, Inverness and the surrounding Northwest Suburbs. Past clients also call us for basements, flooring, tile and the other projects a house needs.</p>
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </div>
  </div>
</section>

<section class="band band-stone" id="area">
  <div class="wrap areas">
    <div class="head"><p class="label">Service area</p><h2 class="h-lg">Based in Palatine, serving every town within 30 miles</h2><p class="lede">We take projects in every town within ${c.data.business.serviceRadiusMiles || 30} miles of Palatine.</p><p><a class="arrow-link" href="${c.u('/service-area/')}">Service area details</a></p></div>
    <ul class="area-list">${towns.filter((t) => t.tier === 1).map((t) => `<li>${t.published ? `<a href="${c.u(townPagePath(t))}">${esc(t.name)}</a>` : esc(t.name)}</li>`).join('')}<li><a href="${c.u('/service-area/')}">+ ${towns.filter((t) => t.tier !== 1).length} more towns</a></li></ul>
  </div>
</section>

${faqBlock(faqs)}
` + footer(c);
}

function pageService(c, s) {
  const { business: b, projects, reviews } = c.data;
  const p = `/${s.slug}/`;
  const rel = projects.filter((x) => (x.tags || []).includes(s.tag) || x.room === s.tag);
  const relReviews = reviews.filter((r) => rel.some((x) => x.id === r.project_id));
  return head(c, { path: p, title: s.seoTitle, description: s.seoDescription, image: s.image, jsonld: [businessLD(c), faqLD(s.faqs), crumbLD(c, [['Home', '/'], [s.name, p]]), { '@context': 'https://schema.org', '@type': 'Service', name: s.name, serviceType: s.name, provider: { '@id': b.website + '/#business' }, areaServed: c.data.towns.map((t) => `${t.name}, ${t.state}`), description: s.intro }] }) + header(c, p) + `
<section class="wrap pd-head">
  <div style="display:grid;gap:1.25rem">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${c.u('/')}">Home</a><span>/</span><span>${esc(s.name)}</span></nav>
    <h1 class="h-xl">${esc(s.name)} in Palatine, IL</h1>
    <p class="lede">${esc(s.intro)}</p>
    <div class="hero-actions" style="margin-top:.5rem"><a class="btn btn-ink" href="#estimate">Free Consultation</a><a class="btn btn-line" href="tel:${esc(b.phoneE164)}">Call ${esc(b.phone)}</a></div>
  </div>
  <div class="frame"><img src="${c.u('/' + s.image)}" alt="" width="1600" height="1200" fetchpriority="high"></div>
</section>
<section class="band" style="padding-top:clamp(2rem,4vw,3rem)">
  <div class="wrap pd-body">
    <div class="head"><p class="label">What's included</p><h2 class="h-lg">Everything from demo to final walkthrough</h2></div>
    <ul class="area-list" style="columns:2 14rem">${s.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
  </div>
</section>
${rel.length ? `<section class="band band-stone"><div class="wrap"><div class="head-row"><div class="head"><p class="label">Portfolio</p><h2 class="h-lg">${esc(s.name.replace(' Remodeling', ''))} projects</h2></div><a class="arrow-link" href="${c.u('/projects/')}">All projects</a></div><div class="projects">${rel.slice(0, 6).map((x) => projectCard(c, x)).join('')}</div></div></section>` : ''}
${processBlock()}
${reviewsSection(c, { list: relReviews.length >= 3 ? relReviews : reviews, limit: 3 })}
${faqBlock(s.faqs, `${s.name}: cost, timing and permits`)}
${estimateSection(c)}
` + footer(c);
}

function pageProjects(c) {
  const { projects } = c.data;
  const tags = [...new Set(projects.flatMap((p) => p.tags || []))];
  const towns = [...new Set(projects.map((p) => p.town).filter(Boolean))];
  const p = '/projects/';
  return head(c, { path: p, title: 'Remodeling Projects in Palatine & the Northwest Suburbs | RD Group', description: 'Finished kitchen, bathroom and basement remodels by RD Group, Inc. in Palatine, Arlington Heights, Inverness and nearby towns, with scope, materials and timelines for each.', jsonld: [businessLD(c), crumbLD(c, [['Home', '/'], ['Projects', p]])] }) + header(c, p) + `
<section class="band" style="padding-top:clamp(2.5rem,5vw,4rem)">
  <div class="wrap">
    <div class="head">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="${c.u('/')}">Home</a><span>/</span><span>Projects</span></nav>
      <h1 class="h-xl">Projects</h1>
      <p class="lede">Finished remodels with the town, scope, materials and how long we were on site.</p>
    </div>
    ${projects.length ? `<div class="filters" role="group" aria-label="Filter by type"><button class="chip" type="button" data-filter="all" aria-pressed="true">All</button>${tags.map((t) => `<button class="chip" type="button" data-filter="${esc(t)}" aria-pressed="false">${esc(tagLabel(t))}</button>`).join('')}</div>
    <div class="filters" role="group" aria-label="Filter by town" style="margin-top:-1.25rem">${towns.map((t) => `<button class="chip" type="button" data-town-filter="${esc(townSlug(t))}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
    <div class="projects" id="project-grid">${projects.map((x) => projectCard(c, x)).join('\n')}</div>` : '<p class="empty">New projects are being photographed. Check back soon, or call to see recent work in person.</p>'}
  </div>
</section>
${estimateSection(c)}
` + footer(c);
}

function pageProject(c, pr) {
  const { business: b, reviews, towns } = c.data;
  const p = `/projects/${pr.slug}/`;
  const title = pr.seo_title || `${pr.title} | ${pr.town ? pr.town + ', ' + (pr.state || 'IL') + ' ' : ''}Remodel | RD Group`;
  const description = pr.seo_description || (pr.summary || pr.description || '').slice(0, 155);
  const review = reviews.find((r) => r.project_id === pr.id);
  const town = towns.find((t) => t.name === pr.town && t.published);
  const specs = [['Location', [pr.neighborhood, pr.town && `${pr.town}, ${pr.state || 'IL'}`].filter(Boolean).join(', ')], ['Completed', fmtDate(pr.completed_on)], ['Time on site', pr.duration_weeks ? `${pr.duration_weeks} weeks` : ''], ['Style', pr.style], ['Budget range', pr.budget_range], ['Materials', pr.materials]].filter(([, v]) => v);
  const before = pr.media.filter((m) => m.kind === 'before');
  const after = pr.media.filter((m) => m.kind !== 'before');
  const fig = (m) => `<figure><div class="frame" data-lightbox="${esc(/^https?:/.test(m.url) ? m.url : c.u('/' + m.url))}">${mediaImg(c, m)}</div>${m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : ''}</figure>`;
  const crumbs = [['Home', '/'], ['Projects', '/projects/'], [pr.title, p]];
  return head(c, { path: p, title, description, image: pr.cover?.url, jsonld: [businessLD(c), crumbLD(c, crumbs), { '@context': 'https://schema.org', '@type': 'CreativeWork', name: pr.title, description: pr.description, creator: { '@id': b.website + '/#business' }, locationCreated: pr.town ? { '@type': 'Place', name: `${pr.town}, ${pr.state || 'IL'}` } : undefined, dateCreated: pr.completed_on || undefined, keywords: (pr.tags || []).join(', '), image: pr.media.map((m) => (/^https?:/.test(m.url) ? m.url : b.website + '/' + m.url)) }] }) + header(c, '/projects/') + `
<section class="wrap pd-head">
  <div style="display:grid;gap:1.25rem">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${c.u('/')}">Home</a><span>/</span><a href="${c.u('/projects/')}">Projects</a><span>/</span><span>${esc(pr.title)}</span></nav>
    <h1 class="h-lg">${esc(pr.title)}${pr.town ? `<span class="sr-only"> in ${esc(pr.town)}, ${esc(pr.state || 'IL')}</span>` : ''}</h1>
    ${pr.summary ? `<p class="lede">${esc(pr.summary)}</p>` : ''}
    <div class="tags">${(pr.tags || []).map((t) => `<span class="tag">${esc(tagLabel(t))}</span>`).join('')}${pr.sample ? '<span class="tag">Sample project</span>' : ''}</div>
  </div>
  <dl class="pd-specs">${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
</section>
<section class="wrap pd-gallery">${after.map(fig).join('')}</section>
${before.length ? `<section class="wrap" style="margin-top:3rem"><p class="label" style="margin-bottom:1rem">Before</p><div class="pd-gallery">${before.map(fig).join('')}</div></section>` : ''}
<section class="band">
  <div class="wrap pd-body">
    <div class="head"><p class="label">The project</p><h2 class="h-md">${esc(pr.scope || 'Scope of work')}</h2></div>
    <div class="prose">${String(pr.description || '').split(/\n\s*\n/).map((para) => `<p>${esc(para)}</p>`).join('')}
      ${town ? `<p><a class="arrow-link" href="${c.u(townPagePath(town))}">More remodeling in ${esc(town.name)}</a></p>` : ''}
    </div>
  </div>
</section>
${review ? `<section class="band band-night"><div class="wrap" style="max-width:52rem">${reviewCard(c, review)}</div></section>` : ''}
${estimateSection(c)}
` + footer(c);
}

function pageTown(c, t) {
  const { business: b, towns, projects, reviews } = c.data;
  const p = townPagePath(t);
  const here = projects.filter((x) => x.town === t.name);
  const hereReviews = reviews.filter((r) => here.some((x) => x.id === r.project_id));
  const nearby = t.nearby.map((s) => towns.find((x) => x.slug === s)).filter(Boolean);
  const title = `Kitchen & Bathroom Remodeling in ${t.name}, ${t.state} | RD Group`;
  const description = `Kitchen and bathroom remodeling in ${t.name}, ${t.state} by RD Group, Inc. Free in-home consultation, fixed written quote, permits handled. Call ${b.phone}.`;
  return head(c, { path: p, title, description, jsonld: [businessLD(c), crumbLD(c, [['Home', '/'], ['Service area', '/service-area/'], [t.name, p]]), ...(t.faqs.length ? [faqLD(t.faqs)] : [])] }) + header(c, '/service-area/') + `
<section class="wrap pd-head">
  <div style="display:grid;gap:1.25rem">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${c.u('/')}">Home</a><span>/</span><a href="${c.u('/service-area/')}">Service area</a><span>/</span><span>${esc(t.name)}</span></nav>
    <h1 class="h-xl">Kitchen &amp; bathroom remodeling in ${esc(t.name)}, ${t.state}</h1>
    <p class="lede">${esc(t.intro)}</p>
    <div class="hero-actions" style="margin-top:.5rem"><a class="btn btn-ink" href="#estimate">Free Consultation</a><a class="btn btn-line" href="tel:${esc(b.phoneE164)}">Call ${esc(b.phone)}</a></div>
  </div>
  <div class="frame">${here[0]?.cover ? mediaImg(c, here[0].cover, { eager: true }) : `<img src="${c.u('/assets/img/materials/terrazzo.webp')}" alt="" width="1600" height="1200">`}</div>
</section>
<section class="band" style="padding-top:clamp(2rem,4vw,3rem)">
  <div class="wrap pd-body">
    <div class="head"><p class="label">${esc(t.name)} remodeling</p><h2 class="h-md">What we build in ${esc(t.name)}</h2></div>
    <div class="prose">${t.body.map((x) => `<p>${esc(x)}</p>`).join('')}
      <p>Services in ${esc(t.name)}: <a href="${c.u('/kitchen-remodeling/')}">kitchen remodeling</a>, <a href="${c.u('/bathroom-remodeling/')}">bathroom remodeling</a> and <a href="${c.u('/home-remodeling/')}">basements and other spaces</a>.</p>
    </div>
  </div>
</section>
${here.length ? `<section class="band band-stone"><div class="wrap"><div class="head"><p class="label">Portfolio</p><h2 class="h-lg">Projects in ${esc(t.name)}</h2></div><div class="projects">${here.map((x) => projectCard(c, x)).join('')}</div></div></section>` : ''}
${reviewsSection(c, { list: hereReviews.length ? hereReviews : reviews, limit: 3, heading: hereReviews.length ? `Reviews from ${t.name}` : 'What homeowners say' })}
${t.faqs.length ? faqBlock(t.faqs, `Remodeling in ${t.name}`) : ''}
<section class="band" style="padding-top:0"><div class="wrap"><p class="label" style="margin-bottom:1rem">Nearby</p><div class="tags">${nearby.map((n) => n.published ? `<a class="tag" href="${c.u(townPagePath(n))}">${esc(n.name)}</a>` : `<span class="tag">${esc(n.name)}</span>`).join('')}<a class="tag" href="${c.u('/service-area/')}">All towns</a></div></div></section>
${estimateSection(c)}
` + footer(c);
}

function pageArea(c) {
  const { towns } = c.data;
  const p = '/service-area/';
  return head(c, { path: p, title: 'Service Area: Palatine & Northwest Suburbs | RD Group', description: 'RD Group, Inc. remodels kitchens and bathrooms in every town within 30 miles of Palatine, IL, including Arlington Heights, Barrington, Schaumburg, Buffalo Grove, Northbrook and Lake Zurich.', jsonld: [businessLD(c), crumbLD(c, [['Home', '/'], ['Service area', p]])] }) + header(c, p) + `
<section class="band" style="padding-top:clamp(2.5rem,5vw,4rem)">
  <div class="wrap areas">
    <div class="head">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="${c.u('/')}">Home</a><span>/</span><span>Service area</span></nav>
      <h1 class="h-xl">Service area</h1>
      <p class="lede">RD Group is based in Palatine, Illinois. We take kitchen, bathroom and interior remodels in every town within ${c.data.business.serviceRadiusMiles || 30} miles of Palatine, including the towns below. Not sure if you're in range? Call ${esc(c.data.business.phone)}.</p>
    </div>
    <ul class="area-list">${towns.map((t) => `<li>${t.published ? `<a href="${c.u(townPagePath(t))}">${esc(t.name)}, ${t.state}</a>` : `${esc(t.name)}, ${t.state}`}</li>`).join('')}</ul>
  </div>
</section>
${estimateSection(c)}
` + footer(c);
}

function pageReviews(c) {
  const p = '/reviews/';
  return head(c, { path: p, title: 'Reviews | RD Group Kitchen & Bath Remodeling, Palatine IL', description: 'Read reviews of RD Group, Inc. from Google, Yelp, Angi, Houzz and more. Every review links to the original on its platform.', jsonld: [businessLD(c), crumbLD(c, [['Home', '/'], ['Reviews', p]])] }) + header(c, p) + `
<section class="wrap" style="padding-block:clamp(2.5rem,5vw,4rem) 0"><nav class="crumbs" aria-label="Breadcrumb"><a href="${c.u('/')}">Home</a><span>/</span><span>Reviews</span></nav><h1 class="sr-only">Reviews of RD Group, Inc.</h1></section>
${reviewsSection(c, { limit: 999, heading: 'Reviews from every platform', id: 'all-reviews' })}
${estimateSection(c)}
` + footer(c);
}

function page404(c) {
  return head(c, { path: '/404.html', title: 'Page not found | RD Group', description: 'This page has moved.', noindex: true }) + header(c, '') + `
<section class="band"><div class="wrap cta"><p class="label">404</p><h1 class="h-lg">That page has moved</h1><p class="lede">Try the project gallery, or call ${esc(c.data.business.phone)}.</p><a class="btn btn-ink" href="${c.u('/projects/')}">View projects</a></div></section>
` + footer(c);
}

// ---------- write ----------
async function write(rel, html) {
  const file = path.join(OUT, /\.(html|txt|xml|js)$/.test(rel) ? rel : path.join(rel, 'index.html'));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

async function copyDir(src, dest) {
  try { await fs.cp(path.join(ROOT, src), path.join(OUT, dest), { recursive: true }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

async function main() {
  const data = await loadData();
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  const pages = [];
  const render = async (p, fn) => { pages.push(p); await write(p, fn({ data, u: makeLinker(p) })); };

  await render('/', pageHome);
  for (const s of data.services) await render(`/${s.slug}/`, (c) => pageService(c, s));
  await render('/projects/', pageProjects);
  for (const pr of data.projects) await render(`/projects/${pr.slug}/`, (c) => pageProject(c, pr));
  await render('/service-area/', pageArea);
  for (const t of data.towns.filter((t) => t.published)) await render(townPagePath(t), (c) => pageTown(c, t));
  await render('/reviews/', pageReviews);
  await write('404.html', page404({ data, u: makeLinker('/404.html') }));

  // The admin ships only when ADMIN=1 is set on the host, i.e. once /admin/* is behind Cloudflare Access.
  for (const d of ['assets', 'card', 'data', ...(process.env.ADMIN === '1' ? ['admin'] : [])]) await copyDir(d, d);
  for (const f of ['_headers', '_redirects']) await fs.copyFile(path.join(ROOT, f), path.join(OUT, f));

  const site = data.business.website.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages, '/card/'].map((p) => `  <url><loc>${site}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  await write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\n\n# AI search and assistant crawlers are welcome\nUser-agent: GPTBot\nAllow: /\nUser-agent: OAI-SearchBot\nAllow: /\nUser-agent: ChatGPT-User\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: Claude-SearchBot\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
  const b = data.business;
  await write('llms.txt', `# ${b.legalName}\n\n> ${b.summary}\n\n- Owner: ${b.founder}\n- Phone: ${b.phone}\n- Based in: ${b.city}, ${b.state}\n- Service area: every town within ${b.serviceRadiusMiles || 30} miles of Palatine, IL, including ${data.towns.map((t) => t.name).join(', ')}\n- Typical timelines: bathroom remodel 3–5 weeks on site; kitchen remodel 6–10 weeks on site\n\n## Services\n${data.services.map((s) => `- [${s.name}](${site}/${s.slug}/): ${s.short}`).join('\n')}\n\n## Pages\n- [Projects](${site}/projects/): finished remodels with town, scope, materials and duration\n- [Reviews](${site}/reviews/): ratings and reviews from Google, Yelp, Angi, Houzz and others, linked to their sources\n- [Service area](${site}/service-area/)\n- [Contact card for ${b.founder}](${site}/card/)\n${data.projects.length ? `\n## Recent projects\n${data.projects.slice(0, 10).map((p) => `- [${p.title}](${site}/projects/${p.slug}/): ${p.summary || ''}`).join('\n')}\n` : ''}`);

  console.log(`Built ${pages.length} pages into ${path.relative(ROOT, OUT)}/ (${data.projects.length} projects, ${data.reviews.length} reviews${SAMPLES ? ', samples included' : ''})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
