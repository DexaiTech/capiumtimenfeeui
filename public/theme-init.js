// Applies the stored theme preference before first paint to avoid a flash.
// Kept as a static file (not inline) so a strict Content-Security-Policy can allow it.
// Light is the default of the Capium design; dark is opt-in from the user menu.
(function () {
  try {
    var stored = JSON.parse(localStorage.getItem('capium-theme') || '{}');
    var pref = (stored.state && stored.state.theme) || 'light';
    var dark =
      pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
})();
