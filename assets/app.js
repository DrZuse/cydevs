// Тема
(function () {
  var saved = localStorage.getItem('cydevs-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  window.toggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' :
      cur === 'light' ? 'dark' :
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('cydevs-theme', next);
  };
})();

// Фильтр каталога проектов
function initProjectFilter() {
  var f = document.getElementById('pf');
  if (!f) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-proj]'));
  function num(v) { v = parseFloat(v); return isNaN(v) ? null : v; }
  function apply() {
    var region = f.region.value, type = f.type.value, status = f.status.value;
    var beds = f.beds.value, pmax = num(f.pmax.value);
    var pv = f.pv.checked, uf = f.uf.checked;
    var shown = 0;
    cards.forEach(function (c) {
      var ok = true;
      if (region && c.dataset.region !== region) ok = false;
      if (type && c.dataset.type !== type) ok = false;
      if (status && c.dataset.status !== status) ok = false;
      if (beds && (c.dataset.beds || '').split(',').indexOf(beds) < 0) ok = false;
      if (pmax !== null) { var pm = num(c.dataset.pmin); if (pm === null || pm > pmax) ok = false; }
      if (pv && c.dataset.pv !== '1') ok = false;
      if (uf && c.dataset.uf !== '1') ok = false;
      c.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    var cnt = document.getElementById('pf-count');
    if (cnt) cnt.textContent = shown;
  }
  f.addEventListener('input', apply);
  f.addEventListener('change', apply);
  apply();
}

// Фильтр новостей
function initNewsFilter() {
  var f = document.getElementById('nf');
  if (!f) return;
  var rows = Array.prototype.slice.call(document.querySelectorAll('[data-news]'));
  function apply() {
    var dev = f.dev.value, cat = f.cat.value;
    rows.forEach(function (r) {
      var ok = true;
      if (dev && (r.dataset.devs || '').split(',').indexOf(dev) < 0) ok = false;
      if (cat && r.dataset.cat !== cat) ok = false;
      r.style.display = ok ? '' : 'none';
    });
  }
  f.addEventListener('input', apply); f.addEventListener('change', apply); apply();
}

// Сортировка таблицы кликом по заголовку (th[data-sort])
function initSortableTable(tableId) {
  var table = document.getElementById(tableId);
  if (!table) return;
  var tbody = table.tBodies[0];
  var ths = Array.prototype.slice.call(table.querySelectorAll('th[data-sort]'));
  var state = null;
  ths.forEach(function (th) {
    if (th.classList.contains('sort-asc')) state = { key: th.dataset.sort, dir: 1 };
    if (th.classList.contains('sort-desc')) state = { key: th.dataset.sort, dir: -1 };
    th.addEventListener('click', function () {
      var key = th.dataset.sort;
      var dir = (state && state.key === key) ? -state.dir :
        (th.dataset.sortDefault === 'asc' ? 1 : -1);
      state = { key: key, dir: dir };
      var rows = Array.prototype.slice.call(tbody.rows);
      rows.sort(function (a, b) {
        var av = a.dataset[key], bv = b.dataset[key];
        var an = parseFloat(av), bn = parseFloat(bv);
        var cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av || '').localeCompare(String(bv || ''), 'ru');
        return cmp * dir;
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
      ths.forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc'); });
      th.classList.add(dir === 1 ? 'sort-asc' : 'sort-desc');
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initProjectFilter();
  initNewsFilter();
  initSortableTable('dev-table');
  if (window.CYDEVS_MAP && window.L) initMap(window.CYDEVS_MAP);
});

// Leaflet-карта (OSM). Загружается только если библиотека доступна офлайн.
// Многие проекты геокодированы только до района/города (нет точного адреса),
// поэтому у них совпадают координаты — без группировки один маркер перекрывает
// другой и часть точек становится невидимой/некликабельной.
function pinPopupHtml(p) {
  return '<div class="map-pin-item"><b><a href="projects/' + p.id + '.html">' + p.name + '</a></b><br>' +
    (p.dev || '') + '<br>' + (p.type || '') + ' · ' + (p.price || '') + '</div>';
}

function initMap(points) {
  var el = document.getElementById('map');
  if (!el || typeof L === 'undefined') { if (el) el.style.display = 'none'; return; }
  var map = L.map('map').setView([34.9, 33.2], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© OpenStreetMap'
  }).addTo(map);

  // группируем точки с одинаковыми (до ~11 м) координатами
  var groups = {};
  points.forEach(function (p) {
    var key = p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
    (groups[key] = groups[key] || []).push(p);
  });

  var markers = [];
  Object.keys(groups).forEach(function (key) {
    var g = groups[key];
    var first = g[0];
    var icon = g.length > 1 ? L.divIcon({
      className: 'map-cluster-pin',
      html: '<span>' + g.length + '</span>',
      iconSize: [28, 28]
    }) : undefined;
    var m = L.marker([first.lat, first.lng], icon ? { icon: icon } : undefined).addTo(map);
    var popup = g.length === 1
      ? pinPopupHtml(first)
      : '<div class="map-cluster-popup"><b>' + g.length + ' объектов в этой точке</b>' +
        '<div class="map-cluster-list">' + g.map(pinPopupHtml).join('') + '</div></div>';
    m.bindPopup(popup, { maxWidth: 280 });
    markers.push(m);
  });
  if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
}
