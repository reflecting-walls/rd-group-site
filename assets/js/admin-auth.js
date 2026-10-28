// Admin status bar. There's no login (no backend): the admin edits a draft in this
// browser, and nothing changes on the live site until the downloaded update is uploaded.
(function () {
  var css = '.rd-draft{position:relative;z-index:999;background:#16181A;color:#F3F2EE;font:500 .85rem/1.4 "Hanken Grotesk",system-ui,sans-serif;padding:.6rem max(16px,env(safe-area-inset-left,0px));display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;justify-content:center;text-align:center}' +
    '.rd-draft b{color:#C9A777;font-weight:600}.rd-draft a,.rd-draft button{font:inherit;color:#F3F2EE;background:none;border:1px solid rgba(255,255,255,.3);padding:.3rem .7rem;cursor:pointer;text-decoration:none}' +
    '.rd-draft.clean{background:#EEECE7;color:#55595E}.rd-draft.clean b{color:#2F6B45}';

  window.requireAdmin = function () {
    var store = window.store;
    if (!store) return Promise.resolve();
    var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    var bar = document.createElement('div'); bar.className = 'rd-draft'; bar.setAttribute('role', 'status');
    var inShell = /\/admin\/(index\.html)?$/.test(location.pathname);
    var render = function (st) {
      var n = st.files.length;
      bar.classList.toggle('clean', !n);
      bar.innerHTML = n
        ? '<span><b>' + n + ' unpublished change' + (n > 1 ? 's' : '') + '</b> saved in this browser.</span>' + (inShell ? '<a href="#publish">Download update</a>' : '<a href="index.html#publish">Download update</a>')
        : '<span><b>Up to date.</b> Edits save as a draft in this browser until you download and upload the update.</span>';
    };
    document.body.prepend(bar);
    return store.ready.then(function () { render(store.status()); store.onChange(render); });
  };
})();
