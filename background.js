const dayKey = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD (hora local)
const KEEP_DAYS = 400;
let queue = Promise.resolve();

function fmtBadge(bytes) {
  const mb = bytes / 1048576;
  if (mb < 10) return mb.toFixed(1);
  if (mb < 1000) return Math.round(mb) + 'M';
  return (mb / 1024).toFixed(1) + 'G';
}

function add(host, bytes) {
  queue = queue.then(async () => {
    const { usage = {} } = await chrome.storage.local.get('usage');
    const k = dayKey();
    const d = (usage[k] ||= { total: 0, hosts: {}, unknown: 0 });
    if (bytes > 0) {
      d.total += bytes;
      d.hosts[host] = (d.hosts[host] || 0) + bytes;
    } else {
      d.unknown += 1;
    }
    Object.keys(usage).sort().slice(0, -KEEP_DAYS).forEach(old => delete usage[old]);
    await chrome.storage.local.set({ usage });
    chrome.action.setBadgeText({ text: fmtBadge(d.total) });
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  }).catch(() => {});
}

chrome.webRequest.onCompleted.addListener(
  (d) => {
    if (d.fromCache) return;
    const h = (d.responseHeaders || []).find(x => x.name.toLowerCase() === 'content-length');
    const bytes = h ? parseInt(h.value, 10) || 0 : 0;
    let host = 'otros';
    try { host = new URL(d.url).hostname; } catch {}
    add(host, bytes);
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

async function refreshBadge() {
  const { usage = {} } = await chrome.storage.local.get('usage');
  const d = usage[dayKey()];
  chrome.action.setBadgeText({ text: d ? fmtBadge(d.total) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
}
chrome.runtime.onStartup.addListener(refreshBadge);
chrome.runtime.onInstalled.addListener(refreshBadge);
