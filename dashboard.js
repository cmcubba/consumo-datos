const $ = id => document.getElementById(id);
let usage = {};
let mode = 'day';
let selDay = dayKey();
let selMonth = dayKey().slice(0, 7);

const monthLabel = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' }); };
const monthShort = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'short' }); };
const dayLabel = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };

function renderDay() {
  const d = usage[selDay] || { total: 0, hosts: {}, unknown: 0 };
  $('dayInput').value = selDay;
  $('dayInput').max = dayKey();
  $('dayTitle').textContent = dayLabel(selDay);
  $('dayTotal').textContent = fmt(d.total);
  const prev = usage[shiftDay(selDay, -1)]?.total || 0;
  $('dayDelta').textContent = prev
    ? `${d.total >= prev ? '▲' : '▼'} ${Math.abs(Math.round((d.total - prev) / prev * 100))}% vs. día anterior`
    : 'Sin datos del día anterior';
  $('daySites').textContent = Object.keys(d.hosts).length;
  $('dayUnknown').textContent = d.unknown || 0;

  const items = [];
  for (let i = 29; i >= 0; i--) {
    const k = shiftDay(dayKey(), -i);
    const v = usage[k]?.total || 0;
    items.push({ key: k, value: v, label: k.slice(8), tip: `${k}: ${fmt(v)}` });
  }
  barChart($('dayChart'), items, { selected: selDay, onClick: k => { selDay = k; render(); } });
  renderSites($('daySitesList'), d.hosts, d.total, 50);
}

function renderMonth() {
  const keys = monthDays(selMonth);
  const s = sumDays(usage, keys);
  $('monthTitle').textContent = monthLabel(selMonth);
  $('monthTotal').textContent = fmt(s.total);
  $('monthSub').textContent = `${s.daysWithData} día(s) con actividad`;
  $('monthAvg').textContent = s.daysWithData ? fmt(s.total / s.daysWithData) : '—';
  $('monthPeak').textContent = s.peakDay ? fmt(s.peakValue) : '—';
  $('monthPeakDay').textContent = s.peakDay ? dayLabel(s.peakDay) : '';

  // selector de meses
  const months = new Set(Object.keys(usage).map(k => k.slice(0, 7)));
  months.add(dayKey().slice(0, 7));
  months.add(selMonth);
  const list = [...months].sort().reverse();
  $('monthSelect').innerHTML = list.map(m => `<option value="${m}" ${m === selMonth ? 'selected' : ''}>${monthLabel(m)}</option>`).join('');

  barChart($('monthDaysChart'), keys.map(k => {
    const v = usage[k]?.total || 0;
    return { key: k, value: v, label: String(+k.slice(8)), tip: `${k}: ${fmt(v)}` };
  }), { onClick: k => { selDay = k; mode = 'day'; render(); } });

  const now = dayKey().slice(0, 7);
  const items = [];
  for (let i = 11; i >= 0; i--) {
    const mk = shiftMonth(now, -i);
    const v = sumDays(usage, monthDays(mk)).total;
    items.push({ key: mk, value: v, label: monthShort(mk), tip: `${monthLabel(mk)}: ${fmt(v)}` });
  }
  barChart($('months12Chart'), items, { selected: selMonth, onClick: k => { selMonth = k; render(); } });
  renderSites($('monthSitesList'), s.hosts, s.total, 50);
}

function render() {
  $('viewDay').classList.toggle('hidden', mode !== 'day');
  $('viewMonth').classList.toggle('hidden', mode !== 'month');
  $('tabDay').classList.toggle('active', mode === 'day');
  $('tabMonth').classList.toggle('active', mode === 'month');
  if (mode === 'day') renderDay(); else renderMonth();
}

async function load() { usage = await getUsage(); render(); }

$('tabDay').onclick = () => { mode = 'day'; render(); };
$('tabMonth').onclick = () => { mode = 'month'; selMonth = selDay.slice(0, 7); render(); };
$('dPrev').onclick = () => { selDay = shiftDay(selDay, -1); render(); };
$('dNext').onclick = () => { if (selDay < dayKey()) { selDay = shiftDay(selDay, 1); render(); } };
$('dToday').onclick = () => { selDay = dayKey(); render(); };
$('dayInput').onchange = e => { if (e.target.value) { selDay = e.target.value; render(); } };
$('mPrev').onclick = () => { selMonth = shiftMonth(selMonth, -1); render(); };
$('mNext').onclick = () => { if (selMonth < dayKey().slice(0, 7)) { selMonth = shiftMonth(selMonth, 1); render(); } };
$('mNow').onclick = () => { selMonth = dayKey().slice(0, 7); render(); };
$('monthSelect').onchange = e => { selMonth = e.target.value; render(); };

$('csv').onclick = () => {
  const rows = ['fecha,sitio,bytes'];
  for (const day of Object.keys(usage).sort())
    for (const [h, b] of Object.entries(usage[day].hosts)) rows.push(`${day},${h},${b}`);
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'consumo-datos.csv';
  a.click();
};
$('reset').onclick = async () => {
  if (!confirm('¿Borrar todo el historial de consumo?')) return;
  await chrome.storage.local.set({ usage: {} });
  chrome.action.setBadgeText({ text: '' });
  load();
};

chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.usage) { usage = c.usage.newValue || {}; render(); } });
load();
