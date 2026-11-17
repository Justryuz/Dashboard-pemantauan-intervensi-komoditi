(function () {
  var t = 'gelap';
  try {
    var s = localStorage.getItem('fama_tema');
    if (s === 'cerah' || s === 'gelap') t = s;
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
  var m = document.getElementById('metaScheme');
  if (m) m.content = t === 'cerah' ? 'light' : 'dark';
})();
