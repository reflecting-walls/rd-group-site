/* RD Group digital business card: data loading, rendering, vCard and QR.
   Used by card/index.html (public card) and admin/card.html (preview + vCard test). */
(function () {
  "use strict";

  // ---------- icons (24px, stroke) ----------
  const I = {
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    sms: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3.5 6 8.5 7 8.5-7"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1-4.5-4.2 6.1-.8z"/>',
    share: '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12"/>',
    download: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>',
    userplus: '<circle cx="9.5" cy="8" r="4"/><path d="M2.5 20.5c.8-3.8 3.7-6 7-6s6.2 2.2 7 6M19 8v6M16 11h6"/>',
    qr: '<rect x="3.5" y="3.5" width="6" height="6"/><rect x="14.5" y="3.5" width="6" height="6"/><rect x="3.5" y="14.5" width="6" height="6"/><path d="M14.5 14.5h2.5v2.5h-2.5zM18 18h2.5v2.5H18zM14.5 20.5h1M20.5 14.5v1"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="1.5"/><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5.5A1.5 1.5 0 0 1 16.5 21h-12A1.5 1.5 0 0 1 3 19.5v-12A1.5 1.5 0 0 1 4.5 6H10"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/>',
    tool: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2zM4 20l3.5-3.5"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    home: '<path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5z"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
    linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 10.5V16M8 7.8v.01M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.8 2.2 2.6V16"/>',
    youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="3.5"/><path d="m10 9 5 3-5 3z"/>',
    tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.4 5 4.6"/>',
    x: '<path d="M4 4l16 16M20 4 4 20"/>',
    houzz: '<path d="M6 3v18h4.5v-6h3v6H18V9.5L10.5 7V3z"/>',
    nextdoor: '<path d="M3.5 11 12 4l8.5 7M6.5 20v-6.5a3 3 0 0 1 6 0V20M12.5 13.5a3 3 0 0 1 5.5-1.6V20"/>',
    pinterest: '<circle cx="12" cy="12" r="9"/><path d="m10.5 21 2-8.5M10 15.5c3.5 1 6.5-1 6.5-4.5a4.5 4.5 0 0 0-9 0c0 1 .3 1.8.8 2.4"/>'
  };
  const icon = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || I.link}</svg>`;

  const SOCIAL_LABELS = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", x: "X", houzz: "Houzz", nextdoor: "Nextdoor", pinterest: "Pinterest" };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const digits = (s) => String(s || "").replace(/[^\d+]/g, "");
  const e164 = (s) => { const d = String(s || "").replace(/\D/g, ""); if (!d) return ""; return d.length === 10 ? "+1" + d : (d.length === 11 && d[0] === "1" ? "+" + d : "+" + d); };
  const fullName = (p) => [p.firstName, p.lastName].filter(Boolean).join(" ");
  const cardUrl = () => location.href.split(/[?#]/)[0];
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  const addressLine = (a) => [a.street, [a.city, [a.region, a.postal].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const mapsUrl = (c) => { const q = addressLine(c.address || {}) || c.serviceArea; return q ? "https://maps.google.com/?q=" + encodeURIComponent(q) : ""; };

  function aggregate(sources) {
    const rated = (sources || []).filter((s) => +s.rating > 0 && +s.count > 0);
    const count = rated.reduce((n, s) => n + +s.count, 0);
    if (!count) return null;
    const avg = rated.reduce((n, s) => n + s.rating * s.count, 0) / count;
    return { avg: Math.round(avg * 10) / 10, count, names: rated.map((s) => s.name) };
  }
  function stars(r) {
    let h = "";
    for (let i = 1; i <= 5; i++) {
      const fill = Math.max(0, Math.min(1, r - i + 1));
      h += `<span class="st" style="--f:${Math.round(fill * 100)}%">${icon("star", "i st-i")}</span>`;
    }
    return `<span class="stars" aria-label="${r} out of 5 stars">${h}</span>`;
  }

  // ---------- data ----------
  async function load() {
    // Shared site loader (Supabase, written by the site build) when present; card.json is the seed/fallback.
    const store = window.store || window.RDData;
    if (store && store.getSetting) {
      try { const d = await store.getSetting("card"); if (d && d.profile) return d; } catch (e) { console.warn("card: shared loader failed, using card.json", e); }
    }
    const base = document.currentScript?.src || (document.querySelector('script[src$="card.js"]') || {}).src || location.href;
    const res = await fetch(new URL("card.json", base), { cache: "no-cache" });
    return res.json();
  }

  // ---------- vCard ----------
  const vesc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const enc = new TextEncoder();
  function fold(line) {
    // Fold at 75 octets without splitting a multi-byte character.
    if (enc.encode(line).length <= 75) return line;
    const parts = []; let cur = "", bytes = 0, max = 75;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      if (bytes + n > max) { parts.push(cur); cur = ""; bytes = 0; max = 74; }
      cur += ch; bytes += n;
    }
    parts.push(cur);
    return parts.join("\r\n ");
  }
  async function imageToJpegB64(src, size = 400) {
    if (!src) return "";
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = c.height = size;
          const x = c.getContext("2d");
          const s = Math.min(img.naturalWidth || size, img.naturalHeight || size);
          const sx = ((img.naturalWidth || size) - s) / 2, sy = ((img.naturalHeight || size) - s) / 2;
          x.fillStyle = "#fff"; x.fillRect(0, 0, size, size);
          x.drawImage(img, sx, sy, s, s, 0, 0, size, size);
          resolve(c.toDataURL("image/jpeg", 0.82).split(",")[1]);
        } catch { resolve(""); }
      };
      img.onerror = () => resolve("");
      img.src = src;
    });
  }
  async function buildVCard(d, opts = {}) {
    const p = d.profile || {}, c = d.contact || {}, a = c.address || {};
    const L = ["BEGIN:VCARD", "VERSION:3.0",
      `N:${vesc(p.lastName)};${vesc(p.firstName)};;;`,
      `FN:${vesc(fullName(p))}`];
    if (p.company) L.push(`ORG:${vesc(p.company)}`);
    if (p.title) L.push(`TITLE:${vesc(p.title)}`);
    if (c.mobile) L.push(`TEL;TYPE=CELL,VOICE,pref:${e164(c.mobile)}`);
    if (c.office) L.push(`TEL;TYPE=WORK,VOICE:${e164(c.office)}`);
    if (c.email) L.push(`EMAIL;TYPE=INTERNET,WORK,pref:${c.email}`);
    if (c.website) L.push(`URL;TYPE=WORK:${c.website}`);
    if (opts.cardUrl) L.push(`URL;TYPE=Digital card:${opts.cardUrl}`);
    if (a.street || a.city) L.push(`ADR;TYPE=WORK:;;${vesc(a.street)};${vesc(a.city)};${vesc(a.region)};${vesc(a.postal)};${vesc(a.country)}`);
    (d.socials || []).filter((s) => s.url).forEach((s) => L.push(`X-SOCIALPROFILE;TYPE=${s.network}:${s.url}`));
    if (!opts.lean) (d.reviews?.sources || []).filter((s) => s.url).forEach((s) => L.push(`URL;TYPE=${vesc(s.name)} reviews:${s.url}`));
    const note = [p.headline, d.services?.length ? "Services: " + d.services.join(", ") : "", c.serviceArea ? "Service area: " + c.serviceArea : "", c.hours ? "Hours: " + c.hours : ""].filter(Boolean).join("\n");
    if (note && !opts.lean) L.push(`NOTE:${vesc(note)}`);
    if (opts.photo !== false && p.photo) {
      const b64 = await imageToJpegB64(new URL(p.photo, opts.base || location.href).href);
      if (b64) L.push(`PHOTO;ENCODING=b;TYPE=JPEG:${b64}`);
    }
    if (!opts.lean) L.push(`REV:${new Date().toISOString().replace(/[-:]|\.\d+/g, "")}`);
    L.push("END:VCARD");
    return L.map(fold).join("\r\n") + "\r\n";
  }
  async function downloadVCard(d, opts = {}) {
    const text = await buildVCard(d, { cardUrl: opts.cardUrl ?? cardUrl(), base: opts.base });
    const blob = new Blob([text], { type: "text/vcard;charset=utf-8" });
    const name = (fullName(d.profile) || "contact").replace(/\s+/g, "-").toLowerCase() + ".vcf";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---------- QR ----------
  function qrSvg(text, { fg = "#16181A", bg = "#FFFFFF", margin = 2 } = {}) {
    if (!window.qrcode) return "";
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    const q = qrcode(0, "M"); q.addData(text); q.make();
    const n = q.getModuleCount(), size = n + margin * 2;
    let path = "";
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) path += `M${col + margin} ${r + margin}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
  }
  function svgToPng(svg, px = 1024) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = px; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, px, px); c.toBlob(resolve, "image/png"); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  // ---------- render ----------
  function render(d, root) {
    const p = d.profile || {}, c = d.contact || {}, act = d.actions || {}, rv = d.reviews || {};
    const name = fullName(p);
    const agg = aggregate(rv.sources);
    const tel = e164(c.mobile), sms = e164(c.sms || c.mobile);
    const maps = mapsUrl(c);
    const estimateHref = act.estimateUrl || "#estimate";
    const theme = d.theme || {};
    document.documentElement.style.setProperty("--accent", theme.accent || "#A88553");
    document.documentElement.dataset.mode = theme.mode === "light" ? "light" : "dark";

    const actions = [
      tel && { href: `tel:${tel}`, ic: "phone", label: "Call" },
      sms && { href: `sms:${sms}`, ic: "sms", label: "Text" },
      c.email && { href: `mailto:${c.email}`, ic: "mail", label: "Email" },
      c.website && { href: c.website, ic: "globe", label: "Website", ext: 1 },
      !c.email && maps && { href: maps, ic: "pin", label: "Map", ext: 1 }
    ].filter(Boolean).slice(0, 4);

    const socials = (d.socials || []).filter((s) => s.url);
    const sources = (rv.sources || []).filter((s) => s.url || +s.rating > 0);
    const featured = (rv.featured || []).filter((f) => f.text);
    const gallery = (d.gallery || []).filter((g) => g.src);
    const links = (d.links || []).filter((l) => l.url && l.label);

    root.innerHTML = `
    <header class="cover">
      <img class="cover-img" src="${esc(p.cover)}" alt="" fetchpriority="high">
      <div class="cover-top">
        ${p.logo ? `<img class="logo" src="${esc(p.logo)}" alt="${esc(p.company)}">` : `<span class="logo-text">${esc(p.company)}</span>`}
        <button class="icon-btn" data-act="share" aria-label="Share this card">${icon("share")}</button>
      </div>
    </header>

    <section class="id">
      <div class="avatar"><img src="${esc(p.photo)}" alt="${esc(name)}" width="128" height="128"></div>
      <h1 class="name">${esc(name)}</h1>
      <p class="role">${esc([p.title, p.company].filter(Boolean).join(" · "))}</p>
      ${p.headline ? `<p class="headline">${esc(p.headline)}</p>` : ""}
      ${agg ? `<a class="rating-pill" href="#reviews">${stars(agg.avg)}<b>${agg.avg.toFixed(1)}</b><span>${agg.count} reviews · ${esc(agg.names.join(", "))}</span></a>` : ""}
    </section>

    <nav class="quick" aria-label="Contact">
      ${actions.map((a) => `<a href="${esc(a.href)}" ${a.ext ? 'target="_blank" rel="noopener"' : ""}>${icon(a.ic)}<span>${a.label}</span></a>`).join("")}
    </nav>

    <div class="cta">
      <button class="btn btn-primary" data-act="save">${icon("userplus")}<span>Save contact</span></button>
      <a class="btn btn-ghost" href="${esc(estimateHref)}" ${act.estimateUrl ? 'target="_blank" rel="noopener"' : ""}>${icon("calendar")}<span>${esc(act.estimateLabel || "Get a free estimate")}</span></a>
    </div>

    ${p.bio || (p.credentials || []).length ? `
    <section class="block">
      <h2 class="eyebrow">About</h2>
      ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}
      ${(p.credentials || []).length ? `<ul class="creds">${p.credentials.map((x) => `<li>${icon("shield")}${esc(x)}</li>`).join("")}</ul>` : ""}
    </section>` : ""}

    ${(d.services || []).length ? `
    <section class="block">
      <h2 class="eyebrow">Services</h2>
      <ul class="chips">${d.services.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    </section>` : ""}

    ${gallery.length ? `
    <section class="block bleed">
      <h2 class="eyebrow">Recent work</h2>
      <div class="gallery" tabindex="0" aria-label="Recent projects">
        ${gallery.map((g) => `<a class="shot" href="${esc(g.url || "#")}" ${g.url ? "" : 'aria-disabled="true"'}>
          <img src="${esc(g.src)}" alt="${esc(g.alt || [g.title, g.location].filter(Boolean).join(", "))}" loading="lazy">
          <span class="shot-cap"><b>${esc(g.title)}</b>${g.location ? `<small>${esc(g.location)}</small>` : ""}</span></a>`).join("")}
      </div>
    </section>` : ""}

    ${sources.length || featured.length ? `
    <section class="block" id="reviews">
      <h2 class="eyebrow">Reviews</h2>
      ${sources.length ? `<div class="sources">${sources.map((s) => `
        <a class="source" ${s.url ? `href="${esc(s.url)}" target="_blank" rel="noopener"` : ""}>
          <span class="src-name">${esc(s.name)}</span>
          ${+s.rating > 0 ? `<span class="src-rate"><b>${(+s.rating).toFixed(1)}</b>${stars(+s.rating)}</span><span class="src-count">${+s.count || 0} reviews</span>` : `<span class="src-count">Read reviews</span>`}
          ${s.url ? icon("ext", "i src-ext") : ""}
        </a>`).join("")}</div>` : ""}
      ${featured.length ? `<div class="quotes">${featured.map((f) => `
        <figure class="quote">
          ${+f.rating ? stars(+f.rating) : ""}
          <blockquote>${esc(f.text)}</blockquote>
          <figcaption>${esc(f.author)}${f.source ? ` · ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a>` : esc(f.source)}` : ""}</figcaption>
        </figure>`).join("")}</div>` : ""}
    </section>` : ""}

    ${links.length ? `
    <section class="block">
      <h2 class="eyebrow">Explore</h2>
      <div class="links">${links.map((l) => `<a class="link" href="${esc(l.url)}">${icon(l.icon || "link")}<span>${esc(l.label)}</span>${icon("arrow", "i link-arrow")}</a>`).join("")}</div>
    </section>` : ""}

    <section class="block details">
      <h2 class="eyebrow">Details</h2>
      <dl>
        ${c.mobile ? `<div><dt>${icon("phone")}Mobile</dt><dd><a href="tel:${tel}">${esc(c.mobile)}</a></dd></div>` : ""}
        ${c.office ? `<div><dt>${icon("phone")}Office</dt><dd><a href="tel:${e164(c.office)}">${esc(c.office)}</a></dd></div>` : ""}
        ${c.email ? `<div><dt>${icon("mail")}Email</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd></div>` : ""}
        ${c.website ? `<div><dt>${icon("globe")}Web</dt><dd><a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(host(c.website))}</a></dd></div>` : ""}
        ${c.serviceArea || addressLine(c.address || {}) ? `<div><dt>${icon("pin")}Area</dt><dd>${maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener">${esc(c.serviceArea || addressLine(c.address))}</a>` : esc(c.serviceArea)}</dd></div>` : ""}
        ${c.hours ? `<div><dt>${icon("clock")}Hours</dt><dd>${esc(c.hours)}</dd></div>` : ""}
      </dl>
      ${socials.length ? `<div class="socials">${socials.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(SOCIAL_LABELS[s.network] || s.network)}">${icon(s.network)}</a>`).join("")}</div>` : ""}
    </section>

    ${act.estimateUrl ? "" : `
    <section class="block" id="estimate">
      <h2 class="eyebrow">Free estimate</h2>
      <p class="muted">Tell ${esc(p.firstName || "us")} about your project. ${act.formEndpoint ? "We'll get back to you within one business day." : "This opens a text message to " + esc(p.firstName || "us") + " with your details filled in."}</p>
      <form class="estimate" novalidate>
        <label><span>Name</span><input name="name" autocomplete="name" required></label>
        <label><span>Phone</span><input name="phone" type="tel" autocomplete="tel" required></label>
        <label><span>Project</span><select name="project">${(d.services || []).map((s) => `<option>${esc(s)}</option>`).join("")}<option>Something else</option></select></label>
        <label><span>ZIP code</span><input name="zip" inputmode="numeric" autocomplete="postal-code" maxlength="10"></label>
        <label class="wide"><span>Details</span><textarea name="details" rows="3" placeholder="Rooms, rough size, timing…"></textarea></label>
        <button class="btn btn-primary wide" type="submit">${icon("arrow")}<span>Send request</span></button>
        <p class="form-msg wide" role="status"></p>
      </form>
    </section>`}

    <section class="block share-block">
      <h2 class="eyebrow">Share this card</h2>
      <div class="share-row">
        <button class="qr-mini" data-act="qr" aria-label="Show QR code"><span class="qr-slot"></span></button>
        <div class="share-btns">
          <button class="btn btn-ghost sm" data-act="share">${icon("share")}<span>Share</span></button>
          <button class="btn btn-ghost sm" data-act="copy">${icon("copy")}<span>Copy link</span></button>
          <button class="btn btn-ghost sm" data-act="qr">${icon("qr")}<span>QR code</span></button>
        </div>
      </div>
    </section>

    <footer class="foot">
      ${p.logo ? `<img src="${esc(p.logo)}" alt="" class="foot-logo">` : ""}
      <p>© ${new Date().getFullYear()} ${esc(p.company)}${c.website ? ` · <a href="${esc(c.website)}">${esc(host(c.website))}</a>` : ""}</p>
      <p>Site Developed and Maintained by <a href="https://rwmediapros.com/" target="_blank" rel="noopener">RW Media</a></p>
    </footer>

    <div class="dock" aria-hidden="false">
      <button class="btn btn-primary" data-act="save">${icon("userplus")}<span>Save contact</span></button>
      ${tel ? `<a class="btn btn-dark" href="tel:${tel}" aria-label="Call">${icon("phone")}</a>` : ""}
    </div>

    <dialog class="sheet" id="qr-sheet" aria-label="QR code">
      <button class="icon-btn sheet-x" data-act="close" aria-label="Close">${icon("close")}</button>
      <p class="eyebrow">Scan with a phone camera</p>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="true" data-qr="url">Open card</button>
        <button role="tab" aria-selected="false" data-qr="vcard">Save contact</button>
      </div>
      <div class="qr-big"></div>
      <p class="qr-hint muted"></p>
      <div class="sheet-btns">
        <button class="btn btn-ghost sm" data-act="qr-png">${icon("download")}<span>Save PNG</span></button>
        <button class="btn btn-ghost sm" data-act="qr-svg">${icon("download")}<span>Save SVG</span></button>
      </div>
    </dialog>

    <div class="toast" role="status" aria-live="polite"></div>`;

    // QR thumbnails
    const url = cardUrl();
    const mini = root.querySelector(".qr-slot");
    if (mini) mini.innerHTML = qrSvg(url, { margin: 1 });
  }

  // ---------- behavior ----------
  function wire(d, root) {
    const p = d.profile || {};
    let qrMode = "url";
    const toast = (msg) => { const t = root.querySelector(".toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200); };
    const sheet = root.querySelector("#qr-sheet");
    const qrText = async () => qrMode === "url" ? cardUrl() : await buildVCard(d, { photo: false, lean: true, cardUrl: cardUrl() });
    const drawQR = async () => {
      sheet.querySelector(".qr-big").innerHTML = qrSvg(await qrText());
      sheet.querySelector(".qr-hint").textContent = qrMode === "url"
        ? "Opens this card. It never changes, so it's safe to print on signs, trucks and yard signs."
        : "Adds the contact straight to their phone, no internet needed. Best for in-person hand-offs.";
      sheet.querySelectorAll("[data-qr]").forEach((b) => b.setAttribute("aria-selected", b.dataset.qr === qrMode));
    };
    const save = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
    const slug = (d.slug || "card") + (qrMode === "url" ? "-qr" : "-contact-qr");

    root.addEventListener("click", async (e) => {
      const qrBtn = e.target.closest("[data-qr]");
      if (qrBtn) { qrMode = qrBtn.dataset.qr; return drawQR(); }
      const b = e.target.closest("[data-act]"); if (!b) return;
      const act = b.dataset.act;
      if (act === "save") { await downloadVCard(d); toast("Contact card downloaded"); track("save_contact"); }
      if (act === "share") {
        const data = { title: `${fullName(p)} · ${p.company}`, text: p.headline || "", url: cardUrl() };
        if (navigator.share) { try { await navigator.share(data); track("share"); } catch {} }
        else { sheet.showModal(); drawQR(); }
      }
      if (act === "copy") { try { await navigator.clipboard.writeText(cardUrl()); toast("Link copied"); } catch { toast(cardUrl()); } }
      if (act === "qr") { sheet.showModal(); drawQR(); track("qr_open"); }
      if (act === "close") sheet.close();
      if (act === "qr-png") save(await svgToPng(qrSvg(await qrText())), slug + ".png");
      if (act === "qr-svg") save(new Blob([qrSvg(await qrText(), { margin: 2 })], { type: "image/svg+xml" }), slug + ".svg");
    });
    sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });

    const form = root.querySelector("form.estimate");
    if (form) form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const msg = form.querySelector(".form-msg");
      if (!f.name || !f.phone) { msg.textContent = "Please add your name and phone number."; return; }
      const endpoint = d.actions?.formEndpoint;
      if (endpoint) {
        try {
          const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ ...f, source: "digital-card" }) });
          if (!r.ok) throw 0;
          form.reset(); msg.textContent = "Thanks! Your request was sent."; track("estimate_sent"); return;
        } catch { msg.textContent = "Couldn't send online, opening a text message instead."; }
      }
      const body = `Hi ${p.firstName || ""}, I'd like a free estimate.\nName: ${f.name}\nPhone: ${f.phone}\nProject: ${f.project}${f.zip ? "\nZIP: " + f.zip : ""}${f.details ? "\n" + f.details : ""}`;
      location.href = `sms:${e164(d.contact?.sms || d.contact?.mobile)}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(body)}`;
      track("estimate_sms");
    });

    // Hide the docked bar when the in-page CTA is visible.
    const cta = root.querySelector(".cta"), dock = root.querySelector(".dock");
    if (cta && dock && "IntersectionObserver" in window) new IntersectionObserver(([en]) => dock.classList.toggle("on", !en.isIntersecting && en.boundingClientRect.top < 0)).observe(cta);
  }
  function track(name) { try { window.gtag?.("event", name, { event_category: "digital_card" }); window.va?.("event", { name }); } catch {} }

  function applySeo(d) {
    const p = d.profile || {}, c = d.contact || {}, s = d.seo || {};
    if (s.title) document.title = s.title;
    const set = (sel, attr, val) => { if (!val) return; let m = document.head.querySelector(sel); if (!m) { m = document.createElement("meta"); const [k, v] = sel.match(/\[(\w+)="([^"]+)"\]/).slice(1); m.setAttribute(k, v); document.head.appendChild(m); } m.setAttribute(attr, val); };
    set('meta[name="description"]', "content", s.description);
    set('meta[property="og:title"]', "content", s.title);
    set('meta[property="og:description"]', "content", s.description);
    set('meta[property="og:image"]', "content", s.image ? new URL(s.image, location.href).href : (p.cover ? new URL(p.cover, location.href).href : ""));
    set('meta[name="robots"]', "content", s.indexable === false ? "noindex, follow" : "index, follow");
    const ld = cardLD(d, { photo: p.photo && !/placeholder/.test(p.photo) ? new URL(p.photo, location.href).href : undefined, url: s.canonical || cardUrl() });
    let tag = document.getElementById("ld-card"); if (!tag) { tag = document.createElement("script"); tag.type = "application/ld+json"; tag.id = "ld-card"; document.head.appendChild(tag); }
    tag.textContent = JSON.stringify(ld);
    if (s.canonical) { let l = document.head.querySelector('link[rel="canonical"]'); if (!l) { l = document.createElement("link"); l.rel = "canonical"; document.head.appendChild(l); } l.href = s.canonical; }
  }

  // ProfilePage + Person schema. The business itself is described once, on the main site (#business),
  // so no ratings are self-served here. scripts/build.mjs writes the same markup into the static HTML.
  function cardLD(d, o) {
    const p = d.profile || {}, c = d.contact || {}, site = (c.website || "").replace(/\/$/, "");
    const sameAs = [...(d.socials || []).map((x) => x.url), ...(d.reviews?.sources || []).map((x) => x.url)].filter(Boolean);
    return {
      "@context": "https://schema.org", "@type": "ProfilePage", url: o.url,
      mainEntity: { "@type": "Person", name: [p.firstName, p.lastName].filter(Boolean).join(" "), jobTitle: p.title || undefined, image: o.photo,
        telephone: e164(c.mobile) || undefined, email: c.email || undefined, url: o.url, sameAs: sameAs.length ? sameAs : undefined,
        worksFor: site ? { "@type": "HomeAndConstructionBusiness", "@id": site + "/#business", name: p.company, url: site } : { "@type": "Organization", name: p.company } },
    };
  }

  function mount(d, root) { render(d, root); wire(d, root); applySeo(d); root.removeAttribute("aria-busy"); }

  window.RDCard = { load, render, mount, buildVCard, downloadVCard, qrSvg, svgToPng, aggregate, icon };
})();
