// Public site behavior: menu, project filters, lightbox, estimate form.
(function () {
  var toggle = document.getElementById('menu-toggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Project filters (room type)
  var grid = document.getElementById('project-grid');
  if (grid) {
    var state = { tag: 'all' };
    var apply = function () {
      grid.querySelectorAll('.project').forEach(function (el) {
        el.hidden = !(state.tag === 'all' || (' ' + el.dataset.tags + ' ').indexOf(' ' + state.tag + ' ') > -1);
      });
    };
    document.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tag = b.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        apply();
      });
    });
  }

  // Lightbox
  document.addEventListener('click', function (e) {
    var f = e.target.closest('[data-lightbox]');
    if (!f) return;
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    var img = f.querySelector('img');
    box.innerHTML = '<img alt=""><button type="button">CLOSE</button>';
    box.querySelector('img').src = f.dataset.lightbox;
    box.querySelector('img').alt = img ? img.alt : '';
    var close = function () { box.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (ev) { if (ev.key === 'Escape') close(); };
    box.addEventListener('click', function (ev) { if (ev.target === box || ev.target.tagName === 'BUTTON') close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    box.querySelector('button').focus();
  });

  // dataLayer events for Google Tag Manager (use as Custom Event triggers for GA4 / Google Ads conversions).
  var track = function (o) { (window.dataLayer = window.dataLayer || []).push(o); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var where = a.closest('.mobile-bar') ? 'mobile_bar' : a.closest('header') ? 'header' : a.closest('footer') ? 'footer' : 'content';
    if (/^tel:/.test(a.getAttribute('href'))) track({ event: 'phone_click', click_location: where });
    else if (/^mailto:/.test(a.getAttribute('href'))) track({ event: 'email_click', click_location: where });
  });

  // Estimate form -> /api/estimate (worker/index.js), which emails Rafal via Cloudflare Email Routing.
  document.querySelectorAll('[data-lead-form]').forEach(function (form) {
    var status = form.querySelector('.form-status');
    var endpoint = form.dataset.endpoint;
    var phone = form.dataset.phone || '';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(form).entries());
      status.hidden = false;
      if (!d.name || !d.phone) { status.textContent = 'Please add your name and phone number so Rafal can call you back.'; return; }
      if (!endpoint) { status.textContent = 'Thanks, ' + d.name.split(' ')[0] + '. Online requests are almost ready. For now, please call ' + phone + '.'; return; }
      d.page = location.pathname;
      d._subject = 'Estimate request from ' + d.name;
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(d) })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          track({ event: 'generate_lead', form_id: form.id, project: d.project || '' });
          form.reset();
          status.textContent = 'Thanks, ' + d.name.split(' ')[0] + '. Rafal will call you within one business day.';
        })
        .catch(function () { status.textContent = 'That didn’t go through. Please call ' + phone + ' instead.'; })
        .finally(function () { btn.disabled = false; });
    });
  });
})();
