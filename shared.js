const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => d.toLocaleDateString('sv-SE');
const fmt = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB'
               : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB'
               : (b / 1024).toFixed(0) + ' KB';

async function getUsage() {
  const { usage = {} } = await chrome.storage.local.get('usage');
  return usage;
}

function shiftDay(k, n) {
  const [y, m, d] = k.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
function shiftMonth(k, n) {
  const [y, m] = k.split('-').map(Number);
  return dayKey(new Date(y, m - 1 + n, 1)).slice(0, 7);
}
function daysInMonth(k) {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function monthDays(k) {
  return Array.from({ length: daysInMonth(k) }, (_, i) => `${k}-${pad(i + 1)}`);
}

function sumDays(usage, keys) {
  const r = { total: 0, hosts: {}, unknown: 0, daysWithData: 0, peakDay: null, peakValue: 0 };
  for (const k of keys) {
    const d = usage[k];
    if (!d) continue;
    r.total += d.total;
    r.unknown += d.unknown || 0;
    if (d.total > 0) r.daysWithData++;
    if (d.total > r.peakValue) { r.peakValue = d.total; r.peakDay = k; }
    for (const h in d.hosts) r.hosts[h] = (r.hosts[h] || 0) + d.hosts[h];
  }
  return r;
}

function favicon(host) {
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent('https://' + host)}&size=32`;
}

// Lista de sitios con barra de porcentaje
function renderSites(el, hosts, total, limit) {
  el.textContent = '';
  const entries = Object.entries(hosts).sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (!entries.length) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'Sin datos todavía';
    el.appendChild(p);
    return;
  }
  const max = entries[0][1];
  for (const [host, bytes] of entries) {
    const row = document.createElement('div');
    row.className = 'site';

    const img = document.createElement('img');
    img.className = 'fav';
    img.src = favicon(host);
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });

    const main = document.createElement('div');
    main.className = 'site-main';
    const name = document.createElement('div');
    name.className = 'site-name';
    name.textContent = host;
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.style.width = Math.max(2, bytes / max * 100) + '%';
    bar.appendChild(fill);
    main.append(name, bar);

    const size = document.createElement('div');
    size.className = 'site-size';
    size.textContent = fmt(bytes);
    const pct = document.createElement('div');
    pct.className = 'site-pct';
    pct.textContent = total ? Math.round(bytes / total * 100) + '%' : '';
    const right = document.createElement('div');
    right.className = 'site-right';
    right.append(size, pct);

    row.append(img, main, right);
    el.appendChild(row);
  }
}

// Gráfico de barras en SVG. items: [{key, value, label, tip}]
function barChart(el, items, { selected, onClick, width = 600, height = 150 } = {}) {
  const pb = 22, pt = 8;
  const max = Math.max(...items.map(i => i.value), 1);
  const bw = width / items.length;
  const step = Math.ceil(items.length / Math.floor(width / 34));
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img">`;
  items.forEach((it, i) => {
    const h = it.value > 0 ? Math.max(3, it.value / max * (height - pb - pt)) : 2;
    const x = i * bw + bw * 0.14;
    const w = bw * 0.72;
    const y = height - pb - h;
    const cls = 'b' + (it.key === selected ? ' sel' : '') + (it.value === 0 ? ' zero' : '');
    s += `<g data-key="${it.key}" class="${cls}"><title>${it.tip || ''}</title>` +
         `<rect x="${i * bw}" y="0" width="${bw}" height="${height}" class="hit"/>` +
         `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(4, w / 2)}" class="bar-rect"/></g>`;
    if (i % step === 0 || i === items.length - 1) {
      s += `<text x="${i * bw + bw / 2}" y="${height - 6}" text-anchor="middle" class="lbl">${it.label}</text>`;
    }
  });
  s += '</svg>';
  el.innerHTML = s;
  if (onClick) {
    el.querySelectorAll('g[data-key]').forEach(g =>
      g.addEventListener('click', () => onClick(g.getAttribute('data-key'))));
  }
}
