// Supabase version of window.store (archived). To switch: load this instead of
// assets/js/data.js in admin pages, fill RD_CONFIG with the project URL and anon key,
// run ../supabase/migrations, and have scripts/build.mjs read the tables via REST.
(function () {
  var cfg = window.RD_CONFIG || {};
  var SCRIPT = document.currentScript && document.currentScript.src;
  var ROOT = SCRIPT ? SCRIPT.replace(/assets\/js\/[^/]+$/, '') : '../';
  var SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var SETTING_SEEDS = { business: 'data/business.json', card: 'card/card.json' };
  var DEFAULT_ORDER = { projects: ['completed_on', false], media: ['sort', true], review_sources: ['sort', true], reviews: ['published_at', false], leads: ['created_at', false] };

  function slugify(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-'); }
  function loadScript(src) { return new Promise(function (ok, fail) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); }); }
  function getJSON(p) { return fetch(ROOT + p).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }); }
  function prepareImage(file, maxSide, quality) {
    return new Promise(function (ok, fail) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
        var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(function (b) { ok({ blob: b, width: w, height: h, ext: b.type === 'image/webp' ? 'webp' : 'jpg' }); }, 'image/webp', quality);
      };
      img.onerror = fail; img.src = URL.createObjectURL(file);
    });
  }

  var sb = null;
  var ready = (window.supabase ? Promise.resolve() : loadScript(SB_LIB)).then(function () { sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey); api.client = sb; });
  function q(p) { return p.then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; }); }

  var api = {
    mode: 'live', ready: ready, root: ROOT, slugify: slugify,
    list: function (table, opts) {
      return ready.then(function () {
        var o = (opts && opts.order) || DEFAULT_ORDER[table], query = sb.from(table).select('*');
        if (opts && opts.eq) Object.keys(opts.eq).forEach(function (k) { query = query.eq(k, opts.eq[k]); });
        if (o) query = query.order(o[0], { ascending: o[1], nullsFirst: false });
        return q(query);
      });
    },
    get: function (table, id) { return ready.then(function () { return q(sb.from(table).select('*').eq('id', id).maybeSingle()); }); },
    save: function (table, row) { return ready.then(function () { var r = Object.assign({}, row); delete r.media; delete r.cover; if (!r.id) delete r.id; return q(sb.from(table).upsert(r).select().single()); }); },
    remove: function (table, id) { return ready.then(function () { return q(sb.from(table).delete().eq('id', id)); }); },
    getSetting: function (key) {
      return ready.then(function () { return q(sb.from('site_settings').select('value').eq('key', key).maybeSingle()); })
        .then(function (row) { if (row) return row.value; var seed = SETTING_SEEDS[key]; return seed ? getJSON(seed).catch(function () { return null; }) : null; });
    },
    setSetting: function (key, value) { return ready.then(function () { return q(sb.from('site_settings').upsert({ key: key, value: value }).select().single()); }).then(function () { return value; }); },
    upload: function (file, folder, opts) {
      return ready.then(function () { return prepareImage(file, 2400, 0.82); }).then(function (p) {
        var base = slugify((opts && opts.name) || file.name.replace(/\.[^.]+$/, '')) || 'image';
        var path = (folder || 'uploads') + '/' + base + '-' + Math.random().toString(36).slice(2, 6) + '.' + p.ext;
        return q(sb.storage.from('media').upload(path, p.blob, { cacheControl: '31536000', contentType: p.blob.type, upsert: false }))
          .then(function () { return { url: sb.storage.from('media').getPublicUrl(path).data.publicUrl, path: path, width: p.width, height: p.height }; });
      });
    },
    removeFile: function (path) { return ready.then(function () { return path ? q(sb.storage.from('media').remove([path])) : null; }); },
    resolve: function (url) { return /^(https?:|data:|blob:)/.test(url || '') ? url : ROOT + String(url || '').replace(/^\//, ''); },
    user: function () { return ready.then(function () { return sb.auth.getUser(); }).then(function (r) { return r.data.user; }); },
    signIn: function (email, password) { return ready.then(function () { return sb.auth.signInWithPassword({ email: email, password: password }); }).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data.user; }); },
    resetPassword: function (email) { return ready.then(function () { return sb.auth.resetPasswordForEmail(email, { redirectTo: location.href }); }); },
    signOut: function () { return ready.then(function () { return sb.auth.signOut(); }); },
    invoke: function (fn, body) { return ready.then(function () { return sb.functions.invoke(fn, { body: body || {} }); }).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; }); },
    publish: function () { return api.invoke('publish'); },
    syncReviews: function () { return api.invoke('sync-reviews'); },
  };
  window.store = api;
  window.RDData = api;
})();
