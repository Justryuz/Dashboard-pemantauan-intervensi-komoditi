(function () {
  var h = document.documentElement,
    bs = document.querySelectorAll('.tema-toggle button'),
    m = document.getElementById('metaScheme');
  function ap(t) {
    h.setAttribute('data-theme', t);
    if (m) m.content = t === 'cerah' ? 'light' : 'dark';
    bs.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.tema === t ? 'true' : 'false');
    });
  }
  ap(h.getAttribute('data-theme') === 'cerah' ? 'cerah' : 'gelap');
  bs.forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.dataset.tema;
      ap(t);
      try {
        localStorage.setItem('fama_tema', t);
      } catch (e) {}
    });
  });
})();
