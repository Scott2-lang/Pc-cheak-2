const API_BASE = String(window.PC_CHEAK_API || '').replace(/\/$/, '');
const api = (path) => {
  if (!API_BASE) throw new Error('API URL is not configured. Edit config.js.');
  return API_BASE + path;
};
const request = (path, options = {}) => fetch(api(path), { credentials: 'include', ...options });

const login = document.getElementById('login');
const panel = document.getElementById('panel');
const rows = document.getElementById('rows');
const detail = document.getElementById('detail');
const loginErr = document.getElementById('loginErr');
const keyMsg = document.getElementById('keyMsg');

async function checkSession() {
  try { const r = await request('/api/auth/me'); if (r.ok) showPanel(); } catch {}
}
async function showPanel() {
  login.classList.add('hidden');
  panel.classList.remove('hidden');
  await Promise.all([loadList(), loadKeys()]);
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  loginErr.textContent = '';
  try {
    const res = await request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      })
    });
    const j = await res.json();
    if (!res.ok) { loginErr.innerHTML = `<div class="banner error">${escapeHtml(j.error)}</div>`; return; }
    showPanel();
  } catch (e) { loginErr.innerHTML = `<div class="banner error">${escapeHtml(e.message)}</div>`; }
});

document.getElementById('logout').addEventListener('click', async () => {
  await request('/api/auth/logout', { method: 'POST' });
  panel.classList.add('hidden'); login.classList.remove('hidden');
});
document.getElementById('refresh').addEventListener('click', () => Promise.all([loadList(), loadKeys()]));

document.getElementById('createKey').addEventListener('click', async () => {
  keyMsg.textContent = '';
  const label = document.getElementById('keyLabel').value.trim();
  try {
    const r = await request('/api/staff/keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label })
    });
    const j = await r.json();
    if (!r.ok) { keyMsg.innerHTML = `<div class="banner error">${escapeHtml(j.error)}</div>`; return; }
    document.getElementById('keyLabel').value = '';
    keyMsg.innerHTML = `<div class="banner clear">Created key: <b>${escapeHtml(j.key)}</b></div>`;
    loadKeys();
  } catch (e) { keyMsg.innerHTML = `<div class="banner error">${escapeHtml(e.message)}</div>`; }
});

async function loadKeys() {
  const r = await request('/api/staff/keys');
  if (!r.ok) return;
  const j = await r.json();
  const el = document.getElementById('keys');
  el.innerHTML = (j.keys || []).map(k => `<tr><td><code>${escapeHtml(k.key)}</code></td><td>${escapeHtml(k.label)}</td><td>${k.used ? '<span class="tag high">Used</span>' : '<span class="tag low">Available</span>'}</td><td>${escapeHtml(k.createdAt)}</td></tr>`).join('') || '<tr><td colspan="4">No activation keys.</td></tr>';
}

async function loadList() {
  const r = await request('/api/staff/reports');
  if (r.status === 401) { panel.classList.add('hidden'); login.classList.remove('hidden'); return; }
  const j = await r.json(), list = j.reports || [];
  document.getElementById('total').textContent = list.length;
  document.getElementById('high').textContent = list.filter(x => ['high', 'critical'].includes(String(x.risk).toLowerCase())).length;
  document.getElementById('medium').textContent = list.filter(x => String(x.risk).toLowerCase() === 'medium').length;
  document.getElementById('low').textContent = list.filter(x => ['low', 'clean'].includes(String(x.risk).toLowerCase())).length;
  rows.innerHTML = list.map(r => `<tr><td>${escapeHtml(r.createdAt)}</td><td><a href="#" data-id="${escapeHtml(r.id)}">${escapeHtml(r.id)}</a></td><td>${escapeHtml(r.playerName)} ${escapeHtml(r.discord)}</td><td>${escapeHtml(r.computer)} / ${escapeHtml(r.user)}</td><td><span class="tag ${escapeHtml(r.risk)}">${escapeHtml(r.risk)}</span> (${r.flagCount})</td></tr>`).join('') || '<tr><td colspan="5">No reports yet.</td></tr>';
  rows.querySelectorAll('a[data-id]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openReport(a.dataset.id); }));
}

async function openReport(id) {
  const r0 = await request(`/api/staff/reports/${encodeURIComponent(id)}`), r = await r0.json();
  if (!r0.ok) { detail.classList.remove('hidden'); detail.textContent = r.error; return; }
  const flags = (r.flags || []).map(f => `<tr><td><span class="tag ${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span></td><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.detail)}</td></tr>`).join('');
  const windows = (r.scan.windows || []).map(w => `<tr><td>${w.pid}</td><td>${escapeHtml(w.processName)}</td><td>${escapeHtml(w.title)}</td></tr>`).join('');
  const files = (r.scan.interestFiles || []).map(f => `<tr><td>${escapeHtml(f.name)}</td><td>${escapeHtml(f.path)}</td><td>${escapeHtml(f.lastWrite)}</td></tr>`).join('');
  const procs = (r.scan.processes || []).filter(p => p.path).slice(0, 80).map(p => `<tr><td>${p.pid}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.path)}</td></tr>`).join('');
  detail.classList.remove('hidden');
  detail.innerHTML = `<h2>${escapeHtml(r.id)}</h2><p><span class="tag ${escapeHtml(r.risk)}">${escapeHtml(r.risk)}</span> ${escapeHtml(r.consent.playerName)} · ${escapeHtml(r.consent.discord)} · ${escapeHtml(r.consent.reason)}</p><p>Consent at ${escapeHtml(r.consent.at)} on ${escapeHtml(r.scan.computer)} (${escapeHtml(r.scan.user)}) · ${escapeHtml(r.scan.os)}</p><h3>Flags</h3><table><tbody>${flags || '<tr><td>No flags</td></tr>'}</tbody></table><h3>Window titles</h3><table><tbody>${windows || '<tr><td>None</td></tr>'}</tbody></table><h3>FiveM / GTA interest files</h3><table><tbody>${files || '<tr><td>None</td></tr>'}</tbody></table><h3>Processes</h3><table><tbody>${procs || '<tr><td>None</td></tr>'}</tbody></table><h3>Startup</h3><pre>${escapeHtml(JSON.stringify(r.scan.startup || [], null, 2))}</pre><h3>Application errors</h3><pre>${escapeHtml(r.scan.eventLogText || 'none')}</pre>`;
  detail.scrollIntoView({ behavior: 'smooth' });
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
checkSession();
