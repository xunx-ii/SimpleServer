export function renderAdminPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SimpleServer Admin</title>
  <style>
    :root {
      --bg: #f2efe8;
      --panel: rgba(255,255,255,.84);
      --line: rgba(52,40,26,.14);
      --text: #2c241a;
      --muted: #6d6256;
      --accent: #1f6b52;
      --danger: #a64532;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(31,107,82,.18), transparent 30%),
        radial-gradient(circle at 90% 10%, rgba(166,69,50,.12), transparent 24%),
        linear-gradient(160deg, #f5f0e6, #dde9df);
      font-family: "Segoe UI Variable", "Trebuchet MS", "Segoe UI", sans-serif;
    }
    .page { max-width: 1380px; margin: 0 auto; padding: 20px; }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: 0 18px 44px rgba(52,40,26,.10);
      backdrop-filter: blur(12px);
    }
    .hero { display:flex; justify-content:space-between; gap:16px; align-items:center; margin-bottom:16px; }
    .hero h1 { margin:0; font-size: clamp(28px, 4vw, 42px); }
    .muted { color: var(--muted); }
    .hidden { display:none !important; }
    .login { min-height: calc(100vh - 40px); display:flex; align-items:center; justify-content:center; }
    .login .card { width:min(420px,100%); padding:24px; }
    .field { display:grid; gap:6px; margin-top:12px; }
    input {
      width:100%; padding:12px 14px; border-radius:12px; border:1px solid var(--line);
      background: rgba(255,255,255,.82); font:inherit;
    }
    button {
      border:0; border-radius:999px; padding:10px 14px; cursor:pointer; font:inherit;
      transition: transform .14s ease, opacity .14s ease;
    }
    button:hover { transform: translateY(-1px); }
    .primary { background: var(--accent); color:#fff; }
    .secondary { background: rgba(31,107,82,.12); color: var(--accent); }
    .danger { background: rgba(166,69,50,.14); color: var(--danger); }
    .ghost { background: rgba(255,255,255,.70); color: var(--text); border:1px solid var(--line); }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; }
    .banner { margin:0 0 12px; padding:10px 12px; border-radius:14px; display:none; }
    .banner.show { display:block; }
    .banner.ok { background: rgba(31,107,82,.12); color: var(--accent); }
    .banner.error { background: rgba(166,69,50,.12); color: var(--danger); }
    .strip, .section { padding:16px 18px; margin-bottom:16px; }
    .strip { display:flex; flex-wrap:wrap; gap:16px; }
    .summary { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:16px; }
    .summary .card { padding:16px; }
    .summary strong { display:block; margin-top:10px; font-size:28px; }
    .section-head { display:flex; justify-content:space-between; gap:12px; align-items:end; margin-bottom:12px; }
    .table-wrap { overflow:auto; }
    table { width:100%; border-collapse: collapse; }
    th, td { padding:12px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; font-size:14px; }
    th { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
    tr:last-child td { border-bottom:0; }
    .mono { font-family: Consolas, "SFMono-Regular", monospace; font-size:12px; }
    .pill { display:inline-block; padding:4px 10px; margin:0 6px 6px 0; border-radius:999px; background:rgba(31,107,82,.10); color:var(--accent); }
    .pill.off { background:rgba(109,98,86,.12); color:var(--muted); }
    .stack { display:flex; flex-wrap:wrap; gap:8px; }
    .code { max-height:210px; overflow:auto; padding:10px 12px; border-radius:12px; background:rgba(0,0,0,.05); white-space:pre-wrap; word-break:break-word; }
    @media (max-width: 900px) {
      .page { padding: 14px; }
      .hero, .section-head { flex-direction:column; align-items:stretch; }
    }
  </style>
</head>
<body>
  <div class="page">
    <section id="loginView" class="login">
      <div class="card">
        <h2>Admin Login</h2>
        <p class="muted">Credentials come from local config.json.</p>
        <div id="loginBanner" class="banner"></div>
        <form id="loginForm">
          <label class="field"><span>Username</span><input id="usernameInput" required autocomplete="username" /></label>
          <label class="field"><span>Password</span><input id="passwordInput" required type="password" autocomplete="current-password" /></label>
          <div class="toolbar" style="margin-top:16px;"><button class="primary" type="submit">Login</button></div>
        </form>
      </div>
    </section>

    <section id="dashboardView" class="hidden">
      <div class="hero">
        <div>
          <h1>SimpleServer Control Deck</h1>
          <p class="muted">Monitor rooms, players, sessions and user storage from one local page.</p>
        </div>
        <div class="toolbar">
          <button id="refreshButton" class="ghost" type="button">Refresh</button>
          <button id="logoutButton" class="danger" type="button">Logout</button>
        </div>
      </div>
      <div id="dashboardBanner" class="banner"></div>
      <div id="statusStrip" class="card strip"></div>
      <div id="summaryGrid" class="summary"></div>

      <section class="card section">
        <div class="section-head">
          <div><h2>Rooms</h2><div class="muted">View state, kick players, or delete a room.</div></div>
        </div>
        <div id="roomsContainer"></div>
      </section>

      <section class="card section">
        <div class="section-head">
          <div><h2>Players</h2><div class="muted">Inspect player state and edit display names or storage.</div></div>
        </div>
        <div id="playersContainer"></div>
      </section>

      <section class="card section">
        <div class="section-head">
          <div><h2>Storages</h2><div class="muted">Inspect and patch user storage payloads.</div></div>
        </div>
        <div id="storagesContainer"></div>
      </section>
    </section>
  </div>

  <script>
    var loginView = document.getElementById('loginView');
    var dashboardView = document.getElementById('dashboardView');
    var loginBanner = document.getElementById('loginBanner');
    var dashboardBanner = document.getElementById('dashboardBanner');
    var refreshTimer = null;

    document.getElementById('loginForm').addEventListener('submit', onLogin);
    document.getElementById('refreshButton').addEventListener('click', function () { void loadDashboard(); });
    document.getElementById('logoutButton').addEventListener('click', onLogout);

    void init();

    async function init() {
      var me = await api('/admin/api/me');
      if (!me.ok) {
        showLogin();
        return;
      }
      showDashboard();
      await loadDashboard();
    }

    async function onLogin(event) {
      event.preventDefault();
      setBanner(loginBanner, '', '');
      var response = await api('/admin/api/login', {
        method: 'POST',
        body: {
          username: document.getElementById('usernameInput').value,
          password: document.getElementById('passwordInput').value
        }
      });
      if (!response.ok) {
        setBanner(loginBanner, 'error', response.error || 'Login failed');
        return;
      }
      document.getElementById('passwordInput').value = '';
      showDashboard();
      await loadDashboard();
    }

    async function onLogout() {
      await api('/admin/api/logout', { method: 'POST' });
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      showLogin();
    }

    function showLogin() {
      loginView.classList.remove('hidden');
      dashboardView.classList.add('hidden');
    }

    function showDashboard() {
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      if (!refreshTimer) {
        refreshTimer = setInterval(function () { void loadDashboard(); }, 5000);
      }
    }

    async function loadDashboard() {
      var response = await api('/admin/api/dashboard');
      if (!response.ok) {
        if (response.status === 401) {
          if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
          }
          showLogin();
          setBanner(loginBanner, 'error', 'Session expired, please login again.');
          return;
        }
        setBanner(dashboardBanner, 'error', response.error || 'Failed to load dashboard');
        return;
      }
      setBanner(dashboardBanner, '', '');
      renderDashboard(response.data);
    }

    function renderDashboard(data) {
      document.getElementById('statusStrip').innerHTML =
        '<span><strong>WS:</strong> ' + esc(data.server.wsPort) + '</span>' +
        '<span><strong>Admin:</strong> ' + esc(data.server.adminHost + ':' + data.server.adminPort) + '</span>' +
        '<span><strong>Started:</strong> ' + esc(fmtDate(data.server.startedAt)) + '</span>' +
        '<span><strong>Uptime:</strong> ' + esc(fmtDuration(data.server.uptimeMs)) + '</span>' +
        '<span><strong>Connections:</strong> ' + esc(String(data.server.openConnections)) + ' opened / ' + esc(String(data.server.boundConnections)) + ' bound</span>';

      var summary = document.getElementById('summaryGrid');
      summary.innerHTML = '';
      addSummary(summary, 'Accounts', data.summary.accountCount);
      addSummary(summary, 'Online Players', data.summary.onlinePlayerCount);
      addSummary(summary, 'Active Rooms', data.summary.roomCount);
      addSummary(summary, 'Storages', data.summary.storageCount);
      addSummary(summary, 'Active Sessions', data.summary.sessionCount);

      renderRooms(data.rooms);
      renderPlayers(data.players);
      renderStorages(data.storages);
    }

    function addSummary(parent, label, value) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<span>' + esc(label) + '</span><strong>' + esc(String(value)) + '</strong>';
      parent.appendChild(card);
    }

    function renderRooms(rooms) {
      if (!rooms.length) {
        document.getElementById('roomsContainer').innerHTML = '<div class="muted">No active rooms.</div>';
        return;
      }
      var rows = rooms.map(function (room) {
        var players = room.players.map(function (player) {
          return '<span class="pill ' + (player.isOnline ? '' : 'off') + '">' +
            esc(player.displayName) + ' · ' + esc(player.isReady ? 'Ready' : 'Idle') + ' · ' + esc(player.isOnline ? 'Online' : 'Offline') +
            '</span>' +
            '<button class="danger" type="button" onclick="kickPlayer(' + JSON.stringify(room.roomId) + ',' + JSON.stringify(player.userId) + ')">Kick</button>';
        }).join('');
        return '<tr>' +
          '<td><div><strong>' + esc(room.name) + '</strong></div><div class="mono">' + esc(room.roomId) + '</div></td>' +
          '<td>' + esc(room.state) + '<br/>Owner: <span class="mono">' + esc(room.ownerUserId) + '</span></td>' +
          '<td><div class="stack">' + players + '</div></td>' +
          '<td>Created: ' + esc(fmtDate(room.createdAt)) + '<br/>Updated: ' + esc(fmtDate(room.updatedAt)) + '<br/>Countdown: ' + esc(room.countdownEndAt ? fmtDate(room.countdownEndAt) : '-') + '</td>' +
          '<td><button class="danger" type="button" onclick="dismissRoom(' + JSON.stringify(room.roomId) + ')">Delete Room</button></td>' +
          '</tr>';
      }).join('');
      document.getElementById('roomsContainer').innerHTML = '<div class="table-wrap"><table><thead><tr><th>Room</th><th>Status</th><th>Players</th><th>Timing</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function renderPlayers(players) {
      if (!players.length) {
        document.getElementById('playersContainer').innerHTML = '<div class="muted">No registered players.</div>';
        return;
      }
      var rows = players.map(function (player) {
        return '<tr>' +
          '<td><div><strong>' + esc(player.displayName) + '</strong> (' + esc(player.username) + ')</div><div class="mono">' + esc(player.userId) + '</div><div>Created: ' + esc(fmtDate(player.createdAt)) + '</div><div>Last Login: ' + esc(fmtDate(player.lastLoginAt)) + '</div></td>' +
          '<td>' + esc(player.isOnline ? 'Online' : 'Offline') + '<br/>Sessions: ' + esc(String(player.sessionCount)) + '</td>' +
          '<td>' + esc(player.roomId || '-') + '</td>' +
          '<td>Keys: ' + esc(String(player.storageKeyCount)) + '<br/>Updated: ' + esc(player.storageUpdatedAt ? fmtDate(player.storageUpdatedAt) : '-') + '</td>' +
          '<td><div class="stack"><button class="secondary" type="button" onclick="editDisplayName(' + JSON.stringify(player.userId) + ',' + JSON.stringify(player.displayName) + ')">Edit Name</button><button class="secondary" type="button" onclick="saveStorage(' + JSON.stringify(player.userId) + ')">Save Storage</button><button class="ghost" type="button" onclick="deleteStorageKey(' + JSON.stringify(player.userId) + ')">Delete Key</button></div></td>' +
          '</tr>';
      }).join('');
      document.getElementById('playersContainer').innerHTML = '<div class="table-wrap"><table><thead><tr><th>Player</th><th>Status</th><th>Room</th><th>Storage</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function renderStorages(storages) {
      if (!storages.length) {
        document.getElementById('storagesContainer').innerHTML = '<div class="muted">No storage data yet.</div>';
        return;
      }
      var rows = storages.map(function (storage) {
        return '<tr>' +
          '<td><div><strong>' + esc(storage.displayName || storage.username || storage.userId) + '</strong></div><div class="mono">' + esc(storage.userId) + '</div></td>' +
          '<td>Keys: ' + esc(String(storage.keyCount)) + '<br/>Version: ' + esc(String(storage.version || 0)) + '<br/>Updated: ' + esc(fmtDate(storage.updatedAt)) + '</td>' +
          '<td><div class="code mono">' + esc(JSON.stringify(storage.data, null, 2)) + '</div></td>' +
          '<td><div class="stack"><button class="secondary" type="button" onclick="saveStorage(' + JSON.stringify(storage.userId) + ')">Merge JSON</button><button class="ghost" type="button" onclick="deleteStorageKey(' + JSON.stringify(storage.userId) + ')">Delete Key</button></div></td>' +
          '</tr>';
      }).join('');
      document.getElementById('storagesContainer').innerHTML = '<div class="table-wrap"><table><thead><tr><th>User</th><th>Meta</th><th>Data</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    async function dismissRoom(roomId) {
      if (!confirm('Delete room ' + roomId + '?')) return;
      await handleAction(api('/admin/api/rooms/' + encodeURIComponent(roomId) + '/delete', { method: 'POST' }), 'Room deleted.');
    }

    async function kickPlayer(roomId, userId) {
      if (!confirm('Kick player ' + userId + ' from room ' + roomId + '?')) return;
      await handleAction(api('/admin/api/rooms/' + encodeURIComponent(roomId) + '/kick', { method: 'POST', body: { userId: userId } }), 'Player kicked.');
    }

    async function editDisplayName(userId, currentDisplayName) {
      var nextDisplayName = prompt('New display name', currentDisplayName || '');
      if (nextDisplayName === null) return;
      await handleAction(api('/admin/api/accounts/' + encodeURIComponent(userId) + '/display-name', { method: 'POST', body: { displayName: nextDisplayName } }), 'Display name updated.');
    }

    async function saveStorage(userId) {
      var raw = prompt('Enter JSON object to merge into storage', '{"key":"value"}');
      if (raw === null) return;
      var parsed;
      try { parsed = JSON.parse(raw); }
      catch { setBanner(dashboardBanner, 'error', 'Invalid JSON payload'); return; }
      await handleAction(api('/admin/api/storages/' + encodeURIComponent(userId) + '/save', { method: 'POST', body: { save: parsed } }), 'Storage updated.');
    }

    async function deleteStorageKey(userId) {
      var key = prompt('Storage key to delete');
      if (key === null) return;
      await handleAction(api('/admin/api/storages/' + encodeURIComponent(userId) + '/delete-key', { method: 'POST', body: { keys: [key] } }), 'Storage key deleted.');
    }

    async function handleAction(responsePromise, successMessage) {
      var response = await responsePromise;
      if (!response.ok) {
        setBanner(dashboardBanner, 'error', response.error || 'Action failed');
        return;
      }
      setBanner(dashboardBanner, 'ok', successMessage);
      await loadDashboard();
    }

    async function api(url, options) {
      var init = options || {};
      var headers = { 'Accept': 'application/json' };
      if (init.body !== undefined) headers['Content-Type'] = 'application/json';
      var response = await fetch(url, {
        method: init.method || 'GET',
        credentials: 'same-origin',
        headers: headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined
      });
      var payload = response.status === 204 ? null : await response.json().catch(function () { return {}; });
      return { ok: response.ok, status: response.status, data: payload, error: payload && payload.error };
    }

    function setBanner(target, kind, message) {
      target.className = 'banner';
      target.textContent = message || '';
      if (kind) target.classList.add('show', kind);
    }

    function fmtDate(value) {
      if (!value) return '-';
      var date = new Date(value);
      return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
    }

    function fmtDuration(durationMs) {
      var totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
      var hours = Math.floor(totalSeconds / 3600);
      var minutes = Math.floor((totalSeconds % 3600) / 60);
      var seconds = totalSeconds % 60;
      return hours + 'h ' + minutes + 'm ' + seconds + 's';
    }

    function esc(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  </script>
</body>
</html>`;
}
