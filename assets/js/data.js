// Data layer shared by the admin and the business card (window.store).
// No backend: the site's content lives in JSON files (data/*.json, card/card.json).
// The admin loads them, keeps your edits in this browser as a draft, and
// "Download update" packs the changed JSON plus new photos into a .zip that
// mirrors the site's folders, ready to upload to the repo.
(function () {
  var SCRIPT = document.currentScript && document.currentScript.src;
  var ROOT = SCRIPT ? SCRIPT.replace(/assets\/js\/data\.js.*$/, '') : '../';
  var ZIPJS = ROOT + 'assets/js/zip.js';
  var KEY = 'rdgroup-draft-v2';

  var TABLES = { projects: 'data/projects.json', media: 'data/media.json', review_sources: 'data/review-sources.json', reviews: 'data/reviews.json', towns: 'data/towns.json' };
  var SETTINGS = { business: 'data/business.json', card: 'card/card.json' };
  var DEFAULT_ORDER = { projects: ['completed_on', false], media: ['sort', true], review_sources: ['sort', true], reviews: ['published_at', false] };

  function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
  function slugify(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-'); }
  function getJSON(p) { return fetch(ROOT + p, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }); }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function sortBy(rows, order) {
    if (!order) return rows;
    var k = order[0], asc = order[1];
    return rows.slice().sort(function (a, b) { var x = a[k], y = b[k]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); });
  }
  function loadScript(src) { return new Promise(function (ok, fail) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); }); }

  // ---- photo files live in IndexedDB until they are downloaded with the update ----
  var idb = new Promise(function (ok) {
    try {
      var req = indexedDB.open('rdgroup-files', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('files'); };
      req.onsuccess = function () { ok(req.result); };
      req.onerror = function () { ok(null); };
    } catch (e) { ok(null); }
  });
  function fileOp(mode, fn) { return idb.then(function (db) { if (!db) return null; return new Promise(function (ok, fail) { var tx = db.transaction('files', mode); var r = fn(tx.objectStore('files')); tx.oncomplete = function () { ok(r && r.result); }; tx.onerror = function () { fail(tx.error); }; }); }); }
  var objectUrls = {};
  function cacheUrls() {
    return idb.then(function (db) {
      if (!db) return;
      return new Promise(function (ok) {
        var tx = db.transaction('files', 'readonly'), st = tx.objectStore('files'), cur = st.openCursor();
        cur.onsuccess = function () { var c = cur.result; if (!c) return; if (!objectUrls[c.key]) objectUrls[c.key] = URL.createObjectURL(c.value); c.continue(); };
        tx.oncomplete = ok; tx.onerror = ok;
      });
    });
  }

  // Resize an image in the browser and return a WebP (or JPEG) Blob plus its size.
  function prepareImage(file, maxSide, quality) {
    maxSide = maxSide || 2400; quality = quality || 0.82;
    if (!/^image\//.test(file.type) || /svg/.test(file.type)) return Promise.resolve({ blob: file, width: null, height: null, ext: (file.name.split('.').pop() || 'bin').toLowerCase() });
    return new Promise(function (ok, fail) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(function (b) {
          if (b && b.type === 'image/webp') return ok({ blob: b, width: w, height: h, ext: 'webp' });
          c.toBlob(function (j) { ok({ blob: j, width: w, height: h, ext: 'jpg' }); }, 'image/jpeg', quality);
        }, 'image/webp', quality);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { fail(new Error('This photo format can’t be read in this browser. Try a JPG or PNG.')); };
      img.src = URL.createObjectURL(file);
    });
  }

  // Replace data: URLs inside the card with files at card/media/<name>, referenced as media/<name>.
  function extractDataUrls(value, zip) {
    var n = 0;
    var walk = function (v, key) {
      if (typeof v === 'string' && /^data:image\//.test(v)) {
        var m = /^data:image\/([a-z+]+);base64,(.*)$/.exec(v); if (!m) return v;
        var ext = m[1] === 'jpeg' ? 'jpg' : m[1].replace('+xml', '');
        var name = slugify(key || 'image') + '-' + hash(m[2].slice(0, 2000)).replace('-', '') + '.' + ext;
        zip.file('card/media/' + name, m[2], { base64: true }); n++;
        return 'media/' + name;
      }
      if (Array.isArray(v)) return v.map(function (x, i) { return walk(x, (key || 'item') + '-' + (i + 1)); });
      if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = walk(v[k], k === 'src' || k === 'url' ? key : k); }); return o; }
      return v;
    };
    return walk(clone(value), 'card');
  }

  // ---- draft state ----
  var draft = null; // { tables, settings, dirty: {file: true}, base: {file: hash} }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch (e) { throw new Error('This browser’s storage is full. Download your update, then press Discard draft.'); } }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
  function markDirty(file) { draft.dirty[file] = true; persist(); emit(); }
  var listeners = [];
  function emit() { listeners.forEach(function (fn) { try { fn(api.status()); } catch (e) {} }); }

  var ready = (function () {
    try { draft = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { draft = null; }
    var files = Object.keys(TABLES).map(function (t) { return ['t', t, TABLES[t]]; }).concat(Object.keys(SETTINGS).map(function (k) { return ['s', k, SETTINGS[k]]; }));
    return Promise.all(files.map(function (f) { return getJSON(f[2]).then(function (v) { return [f, v]; }).catch(function () { return [f, f[0] === 't' ? [] : null]; }); }))
      .then(function (loaded) {
        var fresh = { tables: {}, settings: {}, dirty: {}, base: {} };
        loaded.forEach(function (x) { var f = x[0], v = x[1]; (f[0] === 't' ? fresh.tables : fresh.settings)[f[1]] = v; fresh.base[f[2]] = hash(JSON.stringify(v)); });
        if (!draft || !draft.dirty || !Object.keys(draft.dirty).length) { draft = fresh; }
        else {
          // Keep drafted files; refresh everything else from the live site.
          var dirtyFiles = draft.dirty;
          Object.keys(TABLES).forEach(function (t) { if (!dirtyFiles[TABLES[t]]) draft.tables[t] = fresh.tables[t]; });
          Object.keys(SETTINGS).forEach(function (k) { if (!dirtyFiles[SETTINGS[k]]) draft.settings[k] = fresh.settings[k]; });
          draft.stale = Object.keys(dirtyFiles).filter(function (f) { return draft.base[f] && fresh.base[f] !== draft.base[f]; });
          Object.keys(fresh.base).forEach(function (f) { if (!dirtyFiles[f]) draft.base[f] = fresh.base[f]; });
        }
        try { persist(); } catch (e) {}
        return cacheUrls();
      });
  })();

  var api = {
    mode: 'files',
    ready: ready,
    root: ROOT,
    slugify: slugify,
    list: function (table, opts) {
      return ready.then(function () {
        var rows = clone(draft.tables[table] || []);
        if (opts && opts.eq) Object.keys(opts.eq).forEach(function (k) { rows = rows.filter(function (r) { return r[k] === opts.eq[k]; }); });
        return sortBy(rows, (opts && opts.order) || DEFAULT_ORDER[table]);
      });
    },
    get: function (table, id) { return ready.then(function () { return clone((draft.tables[table] || []).find(function (r) { return r.id === id; }) || null); }); },
    save: function (table, row) {
      return ready.then(function () {
        var rows = draft.tables[table] = draft.tables[table] || [];
        row = clone(row); delete row.media; delete row.cover;
        var now = new Date().toISOString();
        if (!row.id) { row.id = uid(); row.created_at = now; rows.push(row); }
        else { var i = rows.findIndex(function (r) { return r.id === row.id; }); if (i > -1) rows[i] = Object.assign({}, rows[i], row); else { row.created_at = now; rows.push(row); } }
        var saved = rows.find(function (r) { return r.id === row.id; });
        saved.updated_at = now;
        markDirty(TABLES[table]);
        return clone(saved);
      });
    },
    remove: function (table, id) { return ready.then(function () { draft.tables[table] = (draft.tables[table] || []).filter(function (r) { return r.id !== id; }); markDirty(TABLES[table]); }); },
    getSetting: function (key) { return ready.then(function () { return clone(draft.settings[key]); }); },
    setSetting: function (key, value) { return ready.then(function () { draft.settings[key] = clone(value); markDirty(SETTINGS[key] || 'data/' + key + '.json'); return value; }); },

    // Returns a site-root path like "/assets/uploads/projects/palatine-kitchen-01.webp".
    upload: function (file, folder, opts) {
      if (folder === 'card') {
        // Card images stay as data: URLs in the draft and become card/media/<name> files at export.
        return prepareImage(file, 1600, 0.82).then(function (p) {
          return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok({ url: fr.result, path: '', width: p.width, height: p.height }); }; fr.readAsDataURL(p.blob); });
        });
      }
      return prepareImage(file, 2400, 0.82).then(function (p) {
        var base = slugify((opts && opts.name) || file.name.replace(/\.[^.]+$/, '')) || 'image';
        var path = 'assets/uploads/' + (folder ? String(folder).split('/').map(slugify).filter(Boolean).join('/') + '/' : '') + base + '-' + Math.random().toString(36).slice(2, 6) + '.' + p.ext;
        return fileOp('readwrite', function (st) { return st.put(p.blob, path); }).then(function () {
          objectUrls[path] = URL.createObjectURL(p.blob);
          draft.dirty[path] = true; persist(); emit();
          return { url: '/' + path, path: path, width: p.width, height: p.height };
        });
      });
    },
    removeFile: function (path) {
      if (!path) return Promise.resolve();
      path = path.replace(/^\//, '');
      return fileOp('readwrite', function (st) { return st.delete(path); }).then(function () { delete draft.dirty[path]; persist(); emit(); });
    },
    // Turn any stored url into something an <img> can show right now (draft photos come from this browser).
    resolve: function (url) {
      if (!url) return '';
      if (/^(https?:|data:|blob:)/.test(url)) return url;
      var p = url.replace(/^\//, '');
      return objectUrls[p] || ROOT + p;
    },

    status: function () {
      var d = draft ? Object.keys(draft.dirty) : [];
      return { files: d, json: d.filter(function (f) { return /\.json$/.test(f); }), photos: d.filter(function (f) { return !/\.json$/.test(f); }), stale: (draft && draft.stale) || [] };
    },
    onChange: function (fn) { listeners.push(fn); },

    // Build the .zip: changed JSON files + new photos, at their paths in the site folder.
    exportZip: function (all) {
      return ready.then(function () { return window.MiniZip ? null : loadScript(ZIPJS); }).then(function () {
        var zip = window.MiniZip.create();
        var want = all ? null : draft.dirty;
        Object.keys(TABLES).forEach(function (t) { var f = TABLES[t]; if (!want || want[f]) zip.file(f, JSON.stringify(draft.tables[t], null, 1) + '\n'); });
        Object.keys(SETTINGS).forEach(function (k) {
          var f = SETTINGS[k]; if ((want && !want[f]) || draft.settings[k] == null) return;
          var value = draft.settings[k];
          if (k === 'card') value = extractDataUrls(value, zip);
          zip.file(f, JSON.stringify(value, null, 2) + '\n');
        });
        var photoPaths = Object.keys(draft.dirty).filter(function (f) { return !/\.json$/.test(f); });
        return Promise.all(photoPaths.map(function (p) { return fileOp('readonly', function (st) { return st.get(p); }).then(function (blob) { if (blob) zip.file(p, blob); }); }))
          .then(function () {
            zip.file('UPDATE-README.txt', 'RD Group site update, ' + new Date().toLocaleString() + '\n\nUpload these folders to the root of the site repository (GitHub: Add file > Upload files, then drag the contents of this zip in and press Commit changes).\nThe site rebuilds by itself in about a minute.\n\nFiles in this update:\n' + zip.names().filter(function (f) { return f !== 'UPDATE-README.txt'; }).join('\n') + '\n');
            return zip.generate();
          });
      });
    },
    // After the update is uploaded: clear the draft so the admin reads the live files again.
    downloadUpdate: function () {
      return api.exportZip().then(function (blob) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'rdgroup-update-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        return blob;
      });
    },
    markPublished: function () {
      var photos = Object.keys(draft.dirty).filter(function (f) { return !/\.json$/.test(f); });
      localStorage.removeItem(KEY);
      return Promise.all(photos.map(function (p) { return fileOp('readwrite', function (st) { return st.delete(p); }); }));
    },
    discardDraft: function () { return api.markPublished().then(function () { location.reload(); }); },
    // Load a previously downloaded update .zip (or a single .json) back into the draft, e.g. on another computer.
    importFile: function (file) {
      return ready.then(function () { return window.MiniZip ? null : loadScript(ZIPJS); }).then(function () {
        var byPath = {};
        Object.keys(TABLES).forEach(function (t) { byPath[TABLES[t]] = ['t', t]; });
        Object.keys(SETTINGS).forEach(function (k) { byPath[SETTINGS[k]] = ['s', k]; });
        var apply = function (path, text) {
          var target = byPath[path] || byPath['data/' + path.split('/').pop()] || byPath['card/' + path.split('/').pop()];
          if (!target) return false;
          var v = JSON.parse(text);
          if (target[0] === 't') draft.tables[target[1]] = v; else draft.settings[target[1]] = v;
          draft.dirty[TABLES[target[1]] || SETTINGS[target[1]]] = true;
          return true;
        };
        if (/\.json$/i.test(file.name)) return file.text().then(function (t) { if (!apply(file.name, t)) throw new Error('That file isn’t one of the site’s data files.'); persist(); emit(); return 1; });
        return window.MiniZip.read(file).then(function (entries) {
          var jobs = [], n = 0;
          entries.forEach(function (entry) {
            var path = entry.name.replace(/^[^/]*rdgroup-update[^/]*\//, '');
            if (/\.json$/i.test(path)) jobs.push(entry.text().then(function (t) { if (apply(path, t)) n++; }));
            else if (/^assets\/uploads\//.test(path)) jobs.push(entry.blob().then(function (b) { return fileOp('readwrite', function (st) { return st.put(b, path); }).then(function () { objectUrls[path] = URL.createObjectURL(b); draft.dirty[path] = true; n++; }); }));
          });
          return Promise.all(jobs).then(function () { persist(); emit(); return n; });
        });
      });
    },
  };

  window.store = api;
  window.RDData = api;
})();
