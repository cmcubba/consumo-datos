(async () => {
  const usage = await getUsage();
  const today = dayKey();
  const t = usage[today] || { total: 0, hosts: {} };
  const yest = usage[shiftDay(today, -1)]?.total || 0;
  const m = sumDays(usage, monthDays(today.slice(0, 7)));

  document.getElementById('today').textContent = fmt(t.total);
  document.getElementById('month').textContent = fmt(m.total);
  document.getElementById('yest').textContent = fmt(yest);
  document.getElementById('delta').textContent = yest
    ? `${t.total >= yest ? '▲' : '▼'} ${Math.abs(Math.round((t.total - yest) / yest * 100))}% vs. ayer`
    : '';

  const items = [];
  for (let i = 6; i >= 0; i--) {
    const k = shiftDay(today, -i);
    const [y, mo, d] = k.split('-').map(Number);
    const v = usage[k]?.total || 0;
    items.push({
      key: k, value: v,
      label: new Date(y, mo - 1, d).toLocaleDateString('es', { weekday: 'short' }),
      tip: `${k}: ${fmt(v)}`
    });
  }
  barChart(document.getElementById('chart'), items, { selected: today, width: 320, height: 120 });
  renderSites(document.getElementById('sites'), t.hosts, t.total, 5);
  document.getElementById('open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
})();
