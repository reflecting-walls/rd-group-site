// RD Group admin: projects, media library, reviews, business info and publishing.
(function () {
  var store = window.store;
  var view = document.getElementById('view');
  var ROOMS = ['kitchen', 'bathroom', 'basement', 'laundry', 'flooring', 'other'];
  var STYLES = ['', 'modern', 'transitional', 'traditional', 'contemporary', 'farmhouse', 'industrial', 'mid-century'];
  var BUDGETS = ['', 'Under $25k', '$25k–$50k', '$50k–$75k', '$75k–$100k', '$100k–$150k', '$150k+'];
  var KINDS = [['after', 'After'], ['before', 'Before'], ['progress', 'In progress']];
  var SOURCE_KINDS = [['manual', 'Typed in'], ['google_places', 'Google (refresh on rebuild)'], ['yelp_fusion', 'Yelp (refresh on rebuild)']];
  var towns = [];

  // ---------- helpers ----------
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function toast(msg, isErr) {
    var t = document.createElement('div'); t.className = 'toast' + (isErr ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, isErr ? 6000 : 3200);
  }
  function fail(e) { console.error(e); toast(e.message || String(e), true); }
  function stars(n) { n = Math.round(n || 0); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function imgSrc(url) { return store.resolve(url); }
  function fmtDate(d) { if (!d) return ''; var x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d); return isNaN(x) ? d : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function words(s) { return (String(s || '').trim().match(/\S+/g) || []).length; }
  function townSlug(t) { return store.slugify(t || 'home'); }

  function field(name, label, value, opts) {
    opts = opts || {};
    var id = 'f-' + name, v = value == null ? '' : value, input;
    if (opts.type === 'textarea') input = '<textarea id="' + id + '" name="' + name + '"' + (opts.rows ? ' rows="' + opts.rows + '"' : '') + (opts.placeholder ? ' placeholder="' + h(opts.placeholder) + '"' : '') + '>' + h(v) + '</textarea>';
    else if (opts.type === 'select') input = '<select id="' + id + '" name="' + name + '">' + opts.options.map(function (o) { var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : (o || '—'); return '<option value="' + h(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + h(lab) + '</option>'; }).join('') + '</select>';
    else input = '<input id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '" value="' + h(v) + '"' + (opts.placeholder ? ' placeholder="' + h(opts.placeholder) + '"' : '') + (opts.list ? ' list="' + opts.list + '"' : '') + (opts.step ? ' step="' + opts.step + '"' : '') + '>';
    return '<label class="field"' + (opts.full ? ' style="grid-column:1/-1"' : '') + '><span>' + h(label) + (opts.counter ? ' <em data-counter="' + name + '"></em>' : '') + '</span>' + input + (opts.help ? '<small>' + opts.help + '</small>' : '') + '</label>';
  }
  function check(name, label, on) { return '<label class="check"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '> ' + h(label) + '</label>'; }
  function readForm(form) {
    var o = {};
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
      else if (el.dataset.list === 'comma') o[el.name] = el.value.split(',').map(function (s) { return s.trim().toLowerCase().replace(/\s+/g, '-'); }).filter(Boolean);
      else if (el.dataset.list === 'lines') o[el.name] = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      else o[el.name] = el.value === '' ? (el.type === 'date' ? null : '') : el.value;
    });
    return o;
  }
  function counter(form, name, min, max) {
    var el = form.elements[name], out = $('[data-counter="' + name + '"]', form);
    if (!el || !out) return;
    var upd = function () {
      var n = name === 'description' ? words(el.value) : el.value.length;
      var unit = name === 'description' ? ' words' : ' chars';
      out.textContent = n + unit + (min ? ' · aim ' + min + '–' + max : ' · max ' + max);
      out.className = (min && n < min) || n > max ? 'warn' : '';
    };
    el.addEventListener('input', upd); upd();
  }
  function openDrawer(title, bodyHtml, onSave, extra) {
    var bg = document.createElement('div'); bg.className = 'drawer-bg';
    var d = document.createElement('form'); d.className = 'drawer'; d.noValidate = true;
    d.innerHTML = '<div class="topline" style="margin:0"><h2>' + h(title) + '</h2><button type="button" class="btn line sm" data-close>Close</button></div>' + bodyHtml +
      '<div class="btns"><button class="btn" type="submit">Save</button>' + (extra || '') + '</div>';
    var close = function () { bg.remove(); d.remove(); };
    bg.onclick = close; $('[data-close]', d).onclick = close;
    d.addEventListener('submit', function (e) { e.preventDefault(); Promise.resolve(onSave(readForm(d), d)).then(function (r) { if (r !== false) close(); }).catch(fail); });
    document.body.append(bg, d);
    var first = $('input, select, textarea', d); if (first) first.focus();
    return { el: d, close: close };
  }
  function dropzone(label, onFiles) {
    var wrap = document.createElement('label'); wrap.className = 'drop';
    wrap.innerHTML = '<strong>' + h(label) + '</strong><span class="muted small">Drag photos here or tap to choose. JPG, PNG, WebP or iPhone photos. They’re resized and converted to WebP automatically.</span><input type="file" accept="image/*" multiple>';
    var input = $('input', wrap);
    input.onchange = function () { if (input.files.length) onFiles(Array.prototype.slice.call(input.files)); input.value = ''; };
    ['dragenter', 'dragover'].forEach(function (ev) { wrap.addEventListener(ev, function (e) { e.preventDefault(); wrap.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { wrap.addEventListener(ev, function (e) { e.preventDefault(); wrap.classList.remove('over'); }); });
    wrap.addEventListener('drop', function (e) { var f = Array.prototype.slice.call(e.dataTransfer.files).filter(function (x) { return /^image\//.test(x.type); }); if (f.length) onFiles(f); });
    return wrap;
  }
  function setActive(route) { $$('#admin-nav a').forEach(function (a) { var r = a.getAttribute('href').replace('#', ''); a.toggleAttribute('aria-current', r === route); if (r === route) a.setAttribute('aria-current', 'page'); }); }

  // ---------- dashboard ----------
  function dashboard() {
    setActive('dashboard');
    return Promise.all([store.list('projects'), store.list('media'), store.list('reviews'), store.list('review_sources'), store.getSetting('business')]).then(function (r) {
      var projects = r[0], media = r[1], reviews = r[2], sources = r[3], biz = r[4] || {};
      var st = store.status();
      var todo = [];
      if (!biz.email) todo.push(['Add the new business email', '#settings']);
      if (!biz.formEndpoint) todo.push(['Connect the estimate form to email (form service link)', '#settings']);
      if (!biz.license) todo.push(['Add the license number', '#settings']);
      sources.forEach(function (s) { if (!s.profile_url) todo.push(['Add the ' + s.name + ' profile link', '#reviews']); if (!s.rating) todo.push(['Add the ' + s.name + ' rating and review count', '#reviews']); });
      if (projects.some(function (p) { return p.sample; })) todo.push(['Replace the sample projects with real ones', '#projects']);
      if (reviews.some(function (x) { return x.sample; })) todo.push(['Replace the sample reviews with real ones', '#reviews']);
      view.innerHTML = '<div class="topline"><h1>Dashboard</h1><a class="btn" href="#publish">' + (st.files.length ? 'Download update (' + st.files.length + ')' : 'Publish') + '</a></div>' +
        '<div class="stats">' +
        '<a class="stat" href="#projects"><b>' + projects.filter(function (p) { return p.published; }).length + '</b><span>Published projects</span></a>' +
        '<a class="stat" href="#media"><b>' + media.length + '</b><span>Photos</span></a>' +
        '<a class="stat" href="#reviews"><b>' + reviews.filter(function (x) { return !x.hidden; }).length + '</b><span>Reviews shown</span></a>' +
        '<a class="stat" href="#publish"><b>' + st.files.length + '</b><span>Unpublished changes</span></a></div>' +
        '<div class="grid-2"><section class="panel"><h2>Setup to finish</h2>' + (todo.length ? '<ul style="margin:0;padding-left:1.1rem;display:grid;gap:.4rem">' + todo.map(function (t) { return '<li><a href="' + t[1] + '">' + h(t[0]) + '</a></li>'; }).join('') + '</ul>' : '<p class="muted">All set.</p>') + '</section>' +
        '<section class="panel"><h2>How publishing works</h2><ol class="muted small" style="margin:0;padding-left:1.1rem;display:grid;gap:.4rem"><li>Make your edits here. They save as a draft in this browser.</li><li>Press <b>Download update</b>. You get a .zip with the changed files and new photos.</li><li>Upload the zip’s contents to the site’s GitHub repository. The site rebuilds in about a minute.</li></ol><p class="muted small">Estimate requests go straight to your email, and they’re not stored here.</p></section></div>';
    });
  }

  // ---------- publish (download update) ----------
  function publishView() {
    setActive('publish');
    var st = store.status();
    view.innerHTML = '<div class="topline"><h1>Publish changes</h1></div>' +
      '<section class="panel"><h2>' + (st.files.length ? st.files.length + ' unpublished change' + (st.files.length > 1 ? 's' : '') : 'Everything is published') + '</h2>' +
      (st.stale.length ? '<p class="small" style="color:#9B5A00">The live site changed since you started this draft (' + st.stale.map(h).join(', ') + '). Downloading will replace those files with your version.</p>' : '') +
      (st.files.length ? '<div class="table-wrap"><table><tbody>' + st.files.map(function (f) { return '<tr><td>' + h(f) + '</td><td class="small muted">' + (/\.json$/.test(f) ? 'Content' : 'New photo') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="btns"><button class="btn" id="dl">Download update (.zip)</button></div>' : '<p class="muted">Edits you make in the admin show up here.</p>') + '</section>' +
      '<section class="panel"><h2>Upload it to the site</h2><ol style="margin:0;padding-left:1.2rem;display:grid;gap:.5rem"><li>Unzip the download.</li><li>Open the site’s repository on GitHub and choose <b>Add file → Upload files</b>.</li><li>Drag everything from inside the unzipped folder (the <code>data</code>, <code>card</code> and <code>assets</code> folders) into the page and press <b>Commit changes</b>.</li><li>The site rebuilds automatically. Check it in a minute or two, then press <b>I uploaded it</b> below.</li></ol>' +
      '<div class="btns"><button class="btn line" id="done"' + (st.files.length ? '' : ' disabled') + '>I uploaded it</button></div></section>' +
      '<section class="panel"><h2>Other options</h2><p class="muted small">Working on another computer? Import an update .zip you downloaded earlier to pick up where you left off. Discarding throws away every unpublished change in this browser.</p>' +
      '<div class="btns"><label class="btn line" style="cursor:pointer">Import update<input type="file" id="imp" accept=".zip,.json" hidden></label><button class="btn danger" id="discard"' + (st.files.length ? '' : ' disabled') + '>Discard draft</button></div></section>';
    var dl = $('#dl');
    if (dl) dl.onclick = function () { dl.disabled = true; store.downloadUpdate().then(function () { toast('Update downloaded. Upload it to the repository next.'); }).catch(fail).finally(function () { dl.disabled = false; }); };
    $('#done').onclick = function () {
      if (!window.confirm || !confirm('Clear the draft? Do this only after the update is uploaded and the site has rebuilt.')) return;
      store.markPublished().then(function () { location.hash = 'dashboard'; location.reload(); }).catch(fail);
    };
    $('#discard').onclick = function () { if (!window.confirm || !confirm('Throw away all unpublished changes?')) return; store.discardDraft(); };
    $('#imp').onchange = function (e) { var f = e.target.files[0]; if (!f) return; store.importFile(f).then(function (n) { toast('Imported ' + n + ' file' + (n === 1 ? '' : 's') + '.'); publishView(); }).catch(fail); };
  }

  // ---------- projects ----------
  function projects() {
    setActive('projects');
    return Promise.all([store.list('projects'), store.list('media')]).then(function (r) {
      var list = r[0], media = r[1];
      var cover = function (p) { var m = media.find(function (x) { return x.id === p.cover_media_id; }) || media.find(function (x) { return x.project_id === p.id; }); return m ? '<img class="thumb" src="' + h(imgSrc(m.url)) + '" alt="">' : '<span class="thumb"></span>'; };
      view.innerHTML = '<div class="topline"><h1>Projects</h1><a class="btn" href="#project/new">New project</a></div>' +
        (list.length ? '<div class="table-wrap"><table><thead><tr><th></th><th>Project</th><th>Town</th><th>Tags</th><th>Completed</th><th>Status</th></tr></thead><tbody>' +
          list.map(function (p) {
            return '<tr class="clickable" data-id="' + h(p.id) + '"><td>' + cover(p) + '</td><td><b>' + h(p.title || 'Untitled') + '</b>' + (p.featured ? ' <span class="pill brass">Featured</span>' : '') + (p.sample ? ' <span class="pill">Sample</span>' : '') + '</td><td>' + h(p.town || '') + '</td><td><div class="chips">' + (p.tags || []).map(function (t) { return '<span class="pill">' + h(t) + '</span>'; }).join('') + '</div></td><td>' + fmtDate(p.completed_on) + '</td><td>' + (p.published ? '<span class="pill ok">Published</span>' : '<span class="pill warn">Draft</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty">No projects yet. <a href="#project/new">Add your first project</a>.</div>');
      $$('tr.clickable').forEach(function (tr) { tr.onclick = function () { location.hash = 'project/' + tr.dataset.id; }; });
    });
  }

  function editProject(id) {
    setActive('projects');
    var isNew = id === 'new';
    return Promise.all([isNew ? Promise.resolve(null) : store.get('projects', id), isNew ? Promise.resolve([]) : store.list('media', { eq: { project_id: id } }), store.list('reviews'), store.list('review_sources')]).then(function (r) {
      var p = r[0] || { title: '', slug: '', state: 'IL', room: 'kitchen', tags: [], published: false, featured: false };
      var media = r[1], reviews = r[2], sources = r[3];
      var srcName = function (sid) { var s = sources.find(function (x) { return x.id === sid; }); return s ? s.name : ''; };
      var slugTouched = !!p.slug;
      var townNames = towns.map(function (t) { return t.name; });
      view.innerHTML = '<div class="topline"><div><a class="muted small" href="#projects">← All projects</a><h1>' + (isNew ? 'New project' : h(p.title)) + '</h1></div><div class="btns">' + (!isNew && p.published ? '<a class="btn line" target="_blank" rel="noopener" href="' + store.root + 'projects/' + h(p.slug) + '/">View page ↗</a>' : '') + '<button class="btn" form="pform" type="submit">Save</button></div></div>' +
        '<form id="pform" class="editor" novalidate><div>' +
        '<section class="panel"><h2>Project</h2><div class="grid-2">' +
        field('title', 'Title', p.title, { full: true, placeholder: 'Walnut vanity primary bath' }) +
        field('slug', 'Page address', p.slug, { full: true, help: 'rdgroup.info/projects/<b data-slug-preview>' + h(p.slug || '…') + '</b>/' }) +
        field('summary', 'One-line summary', p.summary, { full: true, help: 'Shown under the title and on project cards.' }) +
        field('description', 'Description', p.description, { type: 'textarea', full: true, counter: true, rows: 8, help: 'What the room was like before, what changed, and why. Mention the town and key materials. Search engines and AI assistants read this.' }) +
        '</div></section>' +
        '<section class="panel"><h2>Details</h2><div class="grid-3">' +
        field('room', 'Room', p.room, { type: 'select', options: ROOMS }) +
        field('style', 'Style', p.style, { type: 'select', options: STYLES }) +
        field('tags', 'Tags', (p.tags || []).join(', '), { help: 'Comma separated: bathroom, shower, tile' }) +
        field('town', 'Town', p.town, { list: 'town-list', placeholder: 'Palatine' }) +
        field('neighborhood', 'Neighborhood', p.neighborhood, { placeholder: 'Optional' }) +
        field('state', 'State', p.state || 'IL') +
        field('completed_on', 'Completed', p.completed_on, { type: 'date' }) +
        field('duration_weeks', 'Weeks on site', p.duration_weeks, { type: 'number', step: '0.5' }) +
        field('budget_range', 'Budget range', p.budget_range, { type: 'select', options: BUDGETS, help: 'Optional. Shown on the page.' }) +
        '</div><div class="grid-2">' +
        field('scope', 'Scope of work', p.scope, { type: 'textarea', rows: 3 }) +
        field('materials', 'Materials', p.materials, { type: 'textarea', rows: 3 }) +
        '</div><datalist id="town-list">' + townNames.map(function (t) { return '<option value="' + h(t) + '">'; }).join('') + '</datalist></section>' +
        '<section class="panel" id="photos"><div class="topline" style="margin:0"><h2>Photos</h2><button type="button" class="btn line sm" id="from-lib">Add from library</button></div><div id="drop"></div><div class="media-grid" id="pmedia"></div></section>' +
        '</div><div>' +
        '<section class="panel"><h2>Publish</h2>' + check('published', 'Published on the site', p.published) + check('featured', 'Feature on the home page', p.featured) +
        '<div class="btns"><button class="btn" type="submit">Save</button>' + (!isNew ? '<button class="btn danger" type="button" id="del">Delete</button>' : '') + '</div></section>' +
        '<section class="panel"><h2>Search preview</h2>' +
        field('seo_title', 'SEO title', p.seo_title, { counter: true, placeholder: 'Leave blank to use the default' }) +
        field('seo_description', 'Meta description', p.seo_description, { type: 'textarea', rows: 3, counter: true, placeholder: 'Leave blank to use the summary' }) +
        '<div class="serp"><div class="u">www.rdgroup.info › projects › <span data-s="slug"></span></div><div class="t" data-s="title"></div><div class="d" data-s="desc"></div></div></section>' +
        '<section class="panel"><h2>Linked review</h2>' + field('review_link', 'Show this review on the project page', (reviews.find(function (x) { return x.project_id === p.id; }) || {}).id || '', { type: 'select', options: [['', 'None']].concat(reviews.map(function (x) { return [x.id, srcName(x.source_id) + ' · ' + x.author_name + ' · ' + String(x.text || '').slice(0, 40) + '…']; })) }) + '</section>' +
        '</div></form>';
      var form = $('#pform');
      counter(form, 'description', 150, 300); counter(form, 'seo_title', 0, 60); counter(form, 'seo_description', 0, 155);
      var serp = function () {
        var d = readForm(form);
        $('[data-s="slug"]').textContent = d.slug || '';
        $('[data-s="title"]').textContent = d.seo_title || (d.title + (d.town ? ' | ' + d.town + ', ' + (d.state || 'IL') + ' Remodel' : '') + ' | RD Group');
        $('[data-s="desc"]').textContent = (d.seo_description || d.summary || d.description || '').slice(0, 155);
        $('[data-slug-preview]').textContent = d.slug || '…';
      };
      form.addEventListener('input', function (e) {
        if (e.target.name === 'slug') slugTouched = true;
        if ((e.target.name === 'title' || e.target.name === 'town') && !slugTouched) {
          var d = readForm(form); form.elements.slug.value = store.slugify([d.title, d.town, d.town ? (d.state || 'il') : ''].filter(Boolean).join(' '));
        }
        serp();
      });
      serp();

      var current = p;
      function save(quiet) {
        var d = readForm(form);
        var reviewLink = d.review_link; delete d.review_link;
        if (!d.title) { toast('Add a title first.', true); return Promise.reject(new Error('Add a title first.')); }
        d.slug = store.slugify(d.slug || d.title);
        var row = Object.assign({}, current, d);
        return store.save('projects', row).then(function (saved) {
          current = saved;
          var jobs = reviews.filter(function (x) { return x.project_id === saved.id && x.id !== reviewLink; }).map(function (x) { return store.save('reviews', { id: x.id, project_id: null }); });
          if (reviewLink) jobs.push(store.save('reviews', { id: reviewLink, project_id: saved.id }));
          return Promise.all(jobs).then(function () {
            if (!quiet) toast('Saved to your draft. Download the update when you\u2019re ready to publish.');
            if (isNew) { isNew = false; history.replaceState(null, '', '#project/' + saved.id); }
            return saved;
          });
        });
      }
      form.addEventListener('submit', function (e) { e.preventDefault(); save().catch(function () {}); });
      if ($('#del')) $('#del').onclick = function () {
        if (!window.confirm || !confirm('Delete this project? Its photos stay in the media library.')) return;
        Promise.all(media.map(function (m) { return store.save('media', { id: m.id, project_id: null }); })).then(function () { return store.remove('projects', current.id); }).then(function () { toast('Project deleted.'); location.hash = 'projects'; }).catch(fail);
      };

      // Photos
      var grid = $('#pmedia');
      function renderMedia() {
        media.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
        grid.innerHTML = media.length ? '' : '<p class="muted small" style="grid-column:1/-1">No photos yet.</p>';
        media.forEach(function (m, i) { grid.appendChild(mediaCard(m, { project: current, index: i, total: media.length, onChange: renderMedia, list: media })); });
      }
      function ensureSaved() { return current.id ? Promise.resolve(current) : save(true); }
      $('#drop').appendChild(dropzone('Upload project photos', function (files) {
        ensureSaved().then(function (proj) { return uploadMany(files, proj, media); }).then(renderMedia).catch(fail);
      }));
      $('#from-lib').onclick = function () {
        ensureSaved().then(function (proj) { return pickFromLibrary(proj, media); }).then(renderMedia).catch(fail);
      };
      renderMedia();
    });
  }

  function autoAlt(project, m) {
    var room = project.room && project.room !== 'other' ? project.room + ' remodel' : 'remodel';
    var kind = m && m.kind === 'before' ? 'Before: ' : '';
    return kind + (project.title ? project.title + ', ' : '') + room + ' in ' + (project.town || 'Palatine') + ', ' + (project.state || 'IL');
  }

  function uploadMany(files, project, list) {
    var start = list.length;
    toast('Uploading ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…');
    return files.reduce(function (chain, file, i) {
      return chain.then(function () {
        var n = String(start + i + 1).padStart(2, '0');
        var name = project ? townSlug(project.town) + '-' + (project.room || 'remodel') + '-' + n : file.name.replace(/\.[^.]+$/, '');
        return store.upload(file, project ? 'projects/' + project.slug : 'library', { name: name }).then(function (up) {
          return store.save('media', {
            project_id: project ? project.id : null, url: up.url, path: up.path, width: up.width, height: up.height,
            alt: project ? autoAlt(project, { kind: 'after' }) : '', caption: '', kind: 'after',
            tags: project ? [project.room].filter(Boolean) : [], town: project ? project.town || '' : '', sort: start + i,
          });
        }).then(function (m) {
          list.push(m);
          if (project && !project.cover_media_id) { project.cover_media_id = m.id; return store.save('projects', { id: project.id, cover_media_id: m.id }); }
        });
      });
    }, Promise.resolve()).then(function () { toast('Uploaded.'); });
  }

  function mediaCard(m, ctx) {
    var card = document.createElement('div'); card.className = 'media-card';
    var isCover = ctx.project && ctx.project.cover_media_id === m.id;
    card.innerHTML = '<div class="img"><img src="' + h(imgSrc(m.url)) + '" alt="' + h(m.alt) + '" loading="lazy"><div class="badges">' + (isCover ? '<span class="pill brass">Cover</span>' : '') + (m.kind && m.kind !== 'after' ? '<span class="pill">' + h(m.kind) + '</span>' : '') + (m.sample ? '<span class="pill">Sample</span>' : '') + '</div></div>' +
      '<div class="body">' + field('alt', 'Alt text', m.alt, { type: 'textarea', help: ctx.project ? '<a href="#" data-suggest>Suggest from room + town</a>' : '' }) + field('caption', 'Caption', m.caption) +
      (ctx.project ? field('kind', 'Type', m.kind || 'after', { type: 'select', options: KINDS }) :
        '<div class="grid-2">' + field('kind', 'Type', m.kind || 'after', { type: 'select', options: KINDS }) + field('town', 'Town', m.town, { list: 'town-list' }) + '</div>' + field('tags', 'Tags', (m.tags || []).join(', ')) + field('project_id', 'Project', m.project_id || '', { type: 'select', options: [['', 'Not in a project']].concat(ctx.projects.map(function (p) { return [p.id, p.title]; })) })) +
      '<div class="btns">' + (ctx.project ? (isCover ? '' : '<button type="button" class="btn line sm" data-a="cover">Make cover</button>') + (ctx.index > 0 ? '<button type="button" class="btn line sm" data-a="left" aria-label="Move earlier">←</button>' : '') + (ctx.index < ctx.total - 1 ? '<button type="button" class="btn line sm" data-a="right" aria-label="Move later">→</button>' : '') + '<button type="button" class="btn danger sm" data-a="detach">Remove</button>' : '<button type="button" class="btn danger sm" data-a="delete">Delete</button>') + '</div></div>';
    $$('input, select, textarea', card).forEach(function (el) {
      if (el.name === 'tags') el.dataset.list = 'comma';
      el.addEventListener('change', function () {
        var d = readForm(card); d.id = m.id;
        if (d.project_id === '') d.project_id = null;
        store.save('media', d).then(function (saved) { Object.assign(m, saved); toast('Photo saved.'); if (ctx.onChange && 'project_id' in d) ctx.onChange(); }).catch(fail);
      });
    });
    var sug = $('[data-suggest]', card);
    if (sug) sug.onclick = function (e) { e.preventDefault(); var ta = $('[name=alt]', card); ta.value = autoAlt(ctx.project, { kind: $('[name=kind]', card).value }); ta.dispatchEvent(new Event('change')); };
    $$('[data-a]', card).forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.a, list = ctx.list, i = ctx.index, job;
        if (a === 'cover') { ctx.project.cover_media_id = m.id; job = store.save('projects', { id: ctx.project.id, cover_media_id: m.id }); }
        else if (a === 'left' || a === 'right') {
          var j = a === 'left' ? i - 1 : i + 1, other = list[j];
          var si = m.sort == null ? i : m.sort, sj = other.sort == null ? j : other.sort; if (si === sj) { si = i; sj = j; }
          m.sort = sj; other.sort = si;
          job = Promise.all([store.save('media', { id: m.id, sort: m.sort }), store.save('media', { id: other.id, sort: other.sort })]);
        } else if (a === 'detach') { job = store.save('media', { id: m.id, project_id: null }).then(function () { list.splice(i, 1); }); }
        else if (a === 'delete') {
          if (!window.confirm || !confirm('Delete this photo permanently?')) return;
          job = store.remove('media', m.id).then(function () { return store.removeFile(m.path); }).then(function () { list.splice(list.indexOf(m), 1); });
        }
        job.then(function () { ctx.onChange && ctx.onChange(); }).catch(fail);
      };
    });
    return card;
  }

  function pickFromLibrary(project, list) {
    return store.list('media').then(function (all) {
      var avail = all.filter(function (m) { return m.project_id !== project.id; });
      return new Promise(function (resolve) {
        var picked = {};
        var d = openDrawer('Add photos from the library', avail.length ? '<p class="muted small">Tap photos to select them.</p><div class="media-grid">' + avail.map(function (m) { return '<button type="button" class="media-card" data-id="' + h(m.id) + '" style="padding:0;border:1px solid var(--line);cursor:pointer;text-align:left"><div class="img"><img src="' + h(imgSrc(m.url)) + '" alt="" loading="lazy"></div><div class="body small">' + h(m.alt || 'No alt text') + (m.project_id ? '<br><span class="muted">In another project</span>' : '') + '</div></button>'; }).join('') + '</div>' : '<p class="empty">The library is empty. Upload photos in the Media library first.</p>', function () {
          var ids = Object.keys(picked);
          return Promise.all(ids.map(function (id, k) { return store.save('media', { id: id, project_id: project.id, sort: list.length + k, town: project.town, tags: [project.room].filter(Boolean) }); })).then(function (rows) { rows.forEach(function (r) { list.push(r); }); resolve(); });
        });
        $$('[data-id]', d.el).forEach(function (b) { b.onclick = function () { var id = b.dataset.id; if (picked[id]) delete picked[id]; else picked[id] = 1; b.classList.toggle('selected', !!picked[id]); }; });
      });
    });
  }

  // ---------- media library ----------
  function mediaLibrary() {
    setActive('media');
    return Promise.all([store.list('media'), store.list('projects')]).then(function (r) {
      var all = r[0], projs = r[1], filter = sessionGet('mediaFilter') || 'all', q = '';
      view.innerHTML = '<div class="topline"><h1>Media library</h1><div class="btns"><label class="field" style="min-width:12rem"><span>Show</span><select id="mfilter"><option value="all">All photos</option><option value="none">Not in a project</option>' + projs.map(function (p) { return '<option value="' + h(p.id) + '">' + h(p.title) + '</option>'; }).join('') + '</select></label><label class="field" style="min-width:12rem"><span>Search</span><input id="mq" type="search" placeholder="Alt text, town, tag"></label></div></div><div id="mdrop" style="margin-bottom:1rem"></div><div class="media-grid" id="mgrid"></div>' +
        '<datalist id="town-list">' + towns.map(function (t) { return '<option value="' + h(t.name) + '">'; }).join('') + '</datalist>';
      $('#mfilter').value = filter;
      var grid = $('#mgrid');
      function render() {
        var rows = all.filter(function (m) { return filter === 'all' || (filter === 'none' ? !m.project_id : m.project_id === filter); })
          .filter(function (m) { return !q || [m.alt, m.caption, m.town, (m.tags || []).join(' ')].join(' ').toLowerCase().indexOf(q) > -1; });
        grid.innerHTML = rows.length ? '' : '<div class="empty" style="grid-column:1/-1">No photos match.</div>';
        rows.forEach(function (m) { grid.appendChild(mediaCard(m, { projects: projs, list: all, onChange: render })); });
      }
      $('#mfilter').onchange = function (e) { filter = e.target.value; sessionSet('mediaFilter', filter); render(); };
      $('#mq').oninput = function (e) { q = e.target.value.trim().toLowerCase(); render(); };
      $('#mdrop').appendChild(dropzone('Upload to the library', function (files) {
        var proj = projs.find(function (p) { return p.id === filter; }) || null;
        uploadMany(files, proj, all).then(render).catch(fail);
      }));
      render();
    });
  }
  function sessionGet(k) { try { return sessionStorage.getItem('rd-' + k); } catch (e) { return null; } }
  function sessionSet(k, v) { try { sessionStorage.setItem('rd-' + k, v); } catch (e) {} }

  // ---------- reviews ----------
  function reviewsView() {
    setActive('reviews');
    return Promise.all([store.list('review_sources'), store.list('reviews'), store.list('projects')]).then(function (r) {
      var sources = r[0], reviews = r[1], projs = r[2], filter = 'all';
      var byId = {}; sources.forEach(function (s) { byId[s.id] = s; });
      view.innerHTML = '<div class="topline"><h1>Reviews</h1><div class="btns"><button class="btn" id="add-review">Add a review</button></div></div>' +
        '<section class="panel"><div class="topline" style="margin:0"><h2>Review platforms</h2><button class="btn line sm" id="add-source">Add a platform</button></div>' +
        '<p class="muted small">Type each platform’s star rating and review count from its profile, and paste your best reviews below with a link to the original. Optional: if Google and Yelp API keys are added to the hosting settings, their ratings and newest reviews refresh automatically every time the site rebuilds (Google shares up to 5 reviews, Yelp 3 excerpts).</p>' +
        '<div class="table-wrap"><table><thead><tr><th>Platform</th><th>Type</th><th>Rating</th><th>Reviews</th><th>Profile link</th><th>Status</th></tr></thead><tbody>' +
        sources.map(function (s) { return '<tr class="clickable" data-sid="' + h(s.id) + '"><td><b><span style="display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:' + h(s.color || '#A88553') + '"></span> ' + h(s.name) + '</b></td><td>' + h((SOURCE_KINDS.find(function (k) { return k[0] === s.kind; }) || [, s.kind])[1]) + '</td><td>' + (s.rating ? '<span class="stars">' + stars(s.rating) + '</span> ' + Number(s.rating).toFixed(1) : '—') + '</td><td>' + (s.review_count || '—') + '</td><td>' + (s.profile_url ? '<a href="' + h(s.profile_url) + '" target="_blank" rel="noopener">Open ↗</a>' : '<span class="pill warn">Missing</span>') + '</td><td>' + (s.enabled ? '<span class="pill ok">Shown</span>' : '<span class="pill">Hidden</span>') + (s.last_synced_at ? '<br><span class="muted small">Synced ' + fmtDate(s.last_synced_at) + '</span>' : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div></section>' +
        '<section class="panel"><div class="topline" style="margin:0"><h2>Reviews</h2><label class="field"><span>Platform</span><select id="rfilter"><option value="all">All</option>' + sources.map(function (s) { return '<option value="' + h(s.id) + '">' + h(s.name) + '</option>'; }).join('') + '</select></label></div>' +
        '<p class="muted small">Featured reviews show first on the site. Hidden reviews never show. Link a review to a project to show it on that project’s page.</p><div class="table-wrap"><table><thead><tr><th>Platform</th><th>Rating</th><th>Review</th><th>Date</th><th>Featured</th><th>Hidden</th></tr></thead><tbody id="rrows"></tbody></table></div></section>';
      function renderRows() {
        var rows = reviews.filter(function (x) { return filter === 'all' || x.source_id === filter; });
        $('#rrows').innerHTML = rows.length ? rows.map(function (x) { var s = byId[x.source_id] || {}; return '<tr data-rid="' + h(x.id) + '"><td>' + h(s.name || '?') + (x.external_id ? ' <span class="pill">synced</span>' : '') + (x.sample ? ' <span class="pill">sample</span>' : '') + '</td><td class="stars">' + stars(x.rating) + '</td><td class="clickable" data-edit style="cursor:pointer"><b>' + h(x.author_name) + '</b><br><span class="muted small">' + h(String(x.text || '').slice(0, 110)) + (String(x.text || '').length > 110 ? '…' : '') + '</span></td><td class="small">' + fmtDate(x.published_at) + '</td><td><input type="checkbox" data-flag="featured"' + (x.featured ? ' checked' : '') + ' aria-label="Featured"></td><td><input type="checkbox" data-flag="hidden"' + (x.hidden ? ' checked' : '') + ' aria-label="Hidden"></td></tr>'; }).join('') : '<tr><td colspan="6" class="muted">No reviews yet.</td></tr>';
        $$('#rrows [data-flag]').forEach(function (cb) { cb.onchange = function () { var id = cb.closest('tr').dataset.rid, patch = { id: id }; patch[cb.dataset.flag] = cb.checked; store.save('reviews', patch).then(function (s) { Object.assign(reviews.find(function (x) { return x.id === id; }), s); toast('Saved.'); }).catch(fail); }; });
        $$('#rrows [data-edit]').forEach(function (td) { td.onclick = function () { editReview(reviews.find(function (x) { return x.id === td.closest('tr').dataset.rid; })); }; });
      }
      function editReview(x) {
        var isNew = !x; x = x || { source_id: (sources.find(function (s) { return s.kind === 'manual'; }) || sources[0] || {}).id, rating: 5, published_at: new Date().toISOString().slice(0, 10) };
        openDrawer(isNew ? 'Add a review' : 'Edit review',
          
          '<div class="grid-2">' + field('source_id', 'Platform', x.source_id, { type: 'select', options: sources.map(function (s) { return [s.id, s.name]; }) }) + field('rating', 'Stars', x.rating, { type: 'select', options: [5, 4, 3, 2, 1] }) +
          field('author_name', 'Reviewer name', x.author_name, { placeholder: 'First name, last initial' }) + field('published_at', 'Date', String(x.published_at || '').slice(0, 10), { type: 'date' }) + '</div>' +
          field('text', 'Review text', x.text, { type: 'textarea', rows: 6, help: 'Paste it exactly as written on the platform.' }) +
          field('review_url', 'Link to the review', x.review_url, { type: 'url', placeholder: 'https://', help: 'Each review on the site links here. Leave blank to link to the platform profile.' }) +
          field('project_id', 'Project', x.project_id || '', { type: 'select', options: [['', 'None']].concat(projs.map(function (p) { return [p.id, p.title]; })) }) +
          check('featured', 'Featured', x.featured) + check('hidden', 'Hidden', x.hidden),
          function (d) {
            if (!d.text || !d.author_name) { toast('Add the reviewer name and text.', true); return false; }
            d.rating = Number(d.rating); if (!d.project_id) d.project_id = null; if (!isNew) d.id = x.id;
            return store.save('reviews', d).then(function (s) { if (isNew) reviews.unshift(s); else Object.assign(x, s); renderRows(); toast('Review saved.'); });
          }, isNew ? '' : '<button type="button" class="btn danger" data-del>Delete</button>');
        var del = $('.drawer [data-del]'); if (del) del.onclick = function () { if (!window.confirm || !confirm('Delete this review from the site?')) return; store.remove('reviews', x.id).then(function () { reviews.splice(reviews.indexOf(x), 1); renderRows(); $('.drawer [data-close]').click(); toast('Deleted.'); }).catch(fail); };
      }
      function editSource(s) {
        var isNew = !s; s = s || { kind: 'manual', enabled: true, sort: sources.length + 1, color: '#A88553' };
        var d = openDrawer(isNew ? 'Add a review platform' : s.name,
          '<div class="grid-2">' + field('name', 'Platform name', s.name, { placeholder: 'Houzz' }) + field('kind', 'Type', s.kind, { type: 'select', options: SOURCE_KINDS }) + '</div>' +
          field('external_id', 'Platform ID', s.external_id, { help: '<span data-idhelp></span>' }) +
          field('profile_url', 'Public profile link', s.profile_url, { type: 'url', placeholder: 'https://', help: 'The “See all reviews” link on the site.' }) +
          '<div class="grid-3">' + field('rating', 'Rating', s.rating, { type: 'number', step: '0.1' }) + field('review_count', 'Review count', s.review_count, { type: 'number' }) + field('color', 'Badge color', s.color, { type: 'color' }) + '</div>' +
          '<p class="muted small" data-ratinghelp></p>' + field('sort', 'Order', s.sort, { type: 'number' }) + check('enabled', 'Show on the site', s.enabled),
          function (v) {
            if (!v.name) { toast('Add a platform name.', true); return false; }
            if (!isNew) v.id = s.id; else v.id = store.slugify(v.name) + (sources.some(function (x) { return x.id === store.slugify(v.name); }) ? '-' + Date.now().toString(36) : '');
            return store.save('review_sources', v).then(function () { toast('Saved.'); route(); });
          }, isNew ? '' : '<button type="button" class="btn danger" data-del>Delete</button>');
        var kindSel = d.el.elements.kind;
        var help = function () {
          var k = kindSel.value;
          $('[data-idhelp]', d.el).innerHTML = k === 'google_places' ? 'Your Google Place ID, like ChIJ… Find it with <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener">Google’s Place ID finder</a>. Used only if a Google API key is set on the host.' : k === 'yelp_fusion' ? 'The part after yelp.com/biz/ in your Yelp page address. Used only if a Yelp API key is set on the host.' : 'Not needed.';
          $('[data-ratinghelp]', d.el).textContent = k === 'manual' ? 'Copy the rating and count from the platform profile. Update them now and then.' : 'Type the current rating and count too. They\u2019re replaced automatically when the API refresh runs.';
        };
        kindSel.onchange = help; help();
        var del = $('[data-del]', d.el); if (del) del.onclick = function () { if (!window.confirm || !confirm('Delete ' + s.name + ' and all its reviews from the site?')) return; store.list('reviews', { eq: { source_id: s.id } }).then(function (rs) { return Promise.all(rs.map(function (x) { return store.remove('reviews', x.id); })); }).then(function () { return store.remove('review_sources', s.id); }).then(function () { d.close(); toast('Deleted.'); route(); }).catch(fail); };
      }
      $$('[data-sid]').forEach(function (tr) { tr.onclick = function () { editSource(sources.find(function (s) { return s.id === tr.dataset.sid; })); }; });
      $('#add-source').onclick = function () { editSource(null); };
      $('#add-review').onclick = function () { editReview(null); };
      $('#rfilter').onchange = function (e) { filter = e.target.value; renderRows(); };
      renderRows();
    });
  }

  // ---------- business info ----------
  function settings() {
    setActive('settings');
    return store.getSetting('business').then(function (b) {
      b = b || {};
      var hours = (b.hours || []).map(function (x) { return [x.days, x.open, x.close].join(' | '); }).join('\n');
      view.innerHTML = '<div class="topline"><h1>Business info</h1><button class="btn" form="bform" type="submit">Save</button></div>' +
        '<form id="bform" novalidate><section class="panel"><h2>Contact</h2><div class="grid-3">' +
        field('legalName', 'Company name', b.legalName) + field('founder', 'Owner', b.founder) + field('phone', 'Phone (as shown)', b.phone) +
        field('phoneE164', 'Phone (for links)', b.phoneE164, { placeholder: '+17739369244' }) + field('email', 'Email', b.email, { type: 'email', placeholder: 'New email address' }) + field('website', 'Website', b.website, { type: 'url' }) +
        field('formEndpoint', 'Estimate form link', b.formEndpoint, { type: 'url', full: true, placeholder: 'https://formspree.io/f/…', help: 'Where the website\u2019s estimate form sends requests. Create a free form at Formspree (or Web3Forms) with Rafal\u2019s email and paste its link here. Until then the form asks visitors to call.' }) +
        field('streetAddress', 'Street address', b.streetAddress, { placeholder: 'Optional, hidden if blank' }) + field('city', 'City', b.city) + field('state', 'State', b.state) +
        '</div></section><section class="panel"><h2>Credentials</h2><div class="grid-3">' +
        field('license', 'License number', b.license) + field('foundedYear', 'Year founded', b.foundedYear) + field('yearsExperience', 'Years of experience', b.yearsExperience) +
        field('projectsCompleted', 'Projects completed', b.projectsCompleted) + field('warrantyYears', 'Warranty (years)', b.warrantyYears) + field('priceRange', 'Price range', b.priceRange, { type: 'select', options: ['$$', '$$$', '$$$$'] }) +
        '</div><p class="muted small">Numbers you fill in here appear on the home page. Blank ones stay hidden.</p></section>' +
        '<section class="panel"><h2>Hours and profiles</h2><div class="grid-2">' +
        field('hours_text', 'Hours', hours, { type: 'textarea', rows: 4, help: 'One line per row: Days | open | close. Leave open blank for Closed.' }) +
        field('sameAs', 'Social and directory links', (b.sameAs || []).join('\n'), { type: 'textarea', rows: 4, help: 'One link per line: Facebook, Instagram, BBB and so on. Search engines use these to confirm the business.' }) +
        '</div>' + field('summary', 'Business summary', b.summary, { type: 'textarea', rows: 4, help: 'One plain paragraph shown in the footer and read by search engines and AI assistants. Include the town, services and phone number.' }) + '</section></form>';
      var form = $('#bform');
      form.elements.sameAs.dataset.list = 'lines';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = readForm(form);
        var dayCodes = { monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su' };
        d.hours = d.hours_text.split('\n').map(function (line) {
          var p = line.split('|').map(function (s) { return s.trim(); }); if (!p[0]) return null;
          var t24 = function (t) { var m = /(\d{1,2})(?::(\d\d))?\s*(am|pm)?/i.exec(t || ''); if (!m) return ''; var hh = Number(m[1]) % 12 + (/pm/i.test(m[3] || '') ? 12 : 0); return String(hh).padStart(2, '0') + ':' + (m[2] || '00'); };
          var days = p[0].toLowerCase().split(/\s*[–-]\s*/).map(function (x) { return dayCodes[x.trim()] || ''; }).filter(Boolean).join('-');
          return { days: p[0], open: p[1] || '', close: p[2] || '', schema: p[1] && days ? days + ' ' + t24(p[1]) + '-' + t24(p[2]) : '' };
        }).filter(Boolean);
        delete d.hours_text;
        store.setSetting('business', Object.assign({}, b, d)).then(function () { toast('Saved to your draft. Download the update when you\u2019re ready to publish.'); }).catch(fail);
      });
    });
  }

  // ---------- router ----------
  function route() {
    var hash = location.hash.replace(/^#/, '') || 'dashboard';
    var parts = hash.split('/');
    var views = { dashboard: dashboard, projects: projects, media: mediaLibrary, reviews: reviewsView, settings: settings, publish: publishView };
    var job = parts[0] === 'project' ? editProject(parts[1] || 'new') : (views[parts[0]] || dashboard)();
    Promise.resolve(job).catch(function (e) { view.innerHTML = '<div class="empty">Couldn’t load this page: ' + h(e.message) + '</div>'; });
    window.scrollTo(0, 0);
  }

  (window.requireAdmin ? window.requireAdmin() : store.ready).then(function () {
    return fetch(store.root + 'data/towns.json').then(function (r) { return r.json(); }).then(function (t) { towns = t; }).catch(function () {});
  }).then(function () {
    window.addEventListener('hashchange', route);
    route();
  });
})();
