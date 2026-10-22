export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function pageShell({ title, body, wide = false }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · MCP Device</title>
<style>
:root{color-scheme:dark;--bg:#07090d;--panel:#0d1117;--line:#27303b;--text:#e6edf3;--muted:#8b949e;--accent:#5ba7ff;--good:#3fb950;--bad:#ff7b72}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px ui-monospace,SFMono-Regular,Consolas,monospace}a{color:var(--accent)}.wrap{width:min(${wide ? '1500px' : '760px'},92vw);margin:0 auto;padding:28px 0 48px}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:26px}.brand{font-weight:700;letter-spacing:.08em;color:var(--text);text-decoration:none}.links{display:flex;gap:14px;flex-wrap:wrap}.links a{color:var(--muted);text-decoration:none}.links a:hover{color:var(--text)}.card{background:var(--panel);border:1px solid var(--line);padding:20px;margin:16px 0}.stack{display:grid;gap:12px}h1{font-size:24px;margin:0 0 8px}h2{font-size:15px;margin:0 0 10px}p{line-height:1.55}.muted{color:var(--muted)}.error{color:#ffb4ad}.notice{border-left:3px solid var(--accent);padding-left:12px}.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}form.stack{display:grid}.inline{display:flex;gap:10px;flex-wrap:wrap}input{min-width:0;background:#090c11;color:var(--text);border:1px solid var(--line);padding:11px 12px;font:inherit}input:focus{outline:none;border-color:var(--accent)}button,.button{display:inline-block;border:1px solid #3b4654;background:#18202b;color:var(--text);padding:10px 13px;text-decoration:none;font:inherit;cursor:pointer}button.primary,.button.primary{background:#1769aa;border-color:#2586d7}.danger{color:#ffb4ad;border-color:#613038}code,pre{font:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#090c11;border:1px solid var(--line);padding:12px}.footer{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}@media(max-width:640px){.wrap{width:min(94vw,760px);padding-top:18px}.inline{display:grid}.inline>*{width:100%}}
</style></head><body><main class="wrap"><nav class="nav"><a class="brand" href="/">MCP Device</a><div class="links"><a href="/dashboard">Dashboard</a><a href="/pair">Pair device</a><a href="/help">Help</a></div></nav>${body}<div class="footer">Your account only exposes devices paired to it. Device private keys stay on the device.</div></main></body></html>`;
}

export function quickGuide(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '') || 'https://your-mcp-host.example';
  const escaped = escapeHtml(base);
  const dashboardUrl = escapeHtml(`${base}/dashboard`);
  const pairUrl = escapeHtml(`${base}/pair`);
  const helpUrl = escapeHtml(`${base}/help`);
  return `<div class="card"><h2>Quick start</h2><p class="muted">Server: <code>${escaped}</code></p><div class="actions"><a href="${dashboardUrl}">Dashboard</a><a href="${pairUrl}">Pair device</a><a href="${helpUrl}">Help</a></div><pre># Clone the current MCP Device v12 branch
git clone -b feat/v12-platform-20261022 https://github.com/Hiroshimeow/agent-mcp-device.git
cd agent-mcp-device
npm ci
npm run build

# Point this device at the LAN server
# PowerShell:
$env:MCP_GATEWAY_URL="${escaped}"
# macOS / Linux:
export MCP_GATEWAY_URL="${escaped}"

# Run the Device CLI from this checkout
node ./dist/mcp-device.js login
node ./dist/mcp-device.js install
node ./dist/mcp-device.js status

# Stop or uninstall without deleting account/device identity
node ./dist/mcp-device.js stop
node ./dist/mcp-device.js uninstall</pre><p class="muted"><code>login</code> links this device to your account, <code>install</code> enables the background service, and <code>status</code> verifies the connection. The device connects outbound to the MCP Device server; no inbound port is required.</p></div>`;
}
