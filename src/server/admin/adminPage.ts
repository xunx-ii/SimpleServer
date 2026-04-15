export function renderAdminPage() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SimpleServer 管理后台</title>
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
    input, select {
      width:100%; padding:12px 14px; border-radius:12px; border:1px solid var(--line);
      background: rgba(255,255,255,.82); font:inherit;
    }
    button {
      border:0; border-radius:999px; padding:10px 14px; cursor:pointer; font:inherit;
      transition: transform .14s ease, opacity .14s ease;
    }
    button:hover { transform: translateY(-1px); }
    button:disabled { opacity:.48; cursor:not-allowed; transform:none; }
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
    .section-tools { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .filter-bar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; flex:1 1 680px; }
    .search-input { flex:1 1 280px; min-width:220px; }
    .inline-field { display:flex; gap:8px; align-items:center; color:var(--muted); }
    .inline-field span { font-size:13px; white-space:nowrap; }
    .inline-field select { min-width:92px; }
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
    .list-meta { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-top:12px; }
    .pagination { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
    .empty-state { padding:12px 2px; }
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
        <h2>后台登录</h2>
        <div id="loginBanner" class="banner"></div>
        <form id="loginForm">
          <label class="field"><span>用户名</span><input id="usernameInput" required autocomplete="username" /></label>
          <label class="field"><span>密码</span><input id="passwordInput" required type="password" autocomplete="current-password" /></label>
          <div class="toolbar" style="margin-top:16px;"><button class="primary" type="submit">登录</button></div>
        </form>
      </div>
    </section>

    <section id="dashboardView" class="hidden">
      <div class="hero">
        <div>
          <h1>SimpleServer 控制台</h1>
        </div>
        <div class="toolbar">
          <button id="refreshButton" class="ghost" type="button">刷新</button>
          <button id="logoutButton" class="danger" type="button">退出登录</button>
        </div>
      </div>
      <div id="dashboardBanner" class="banner"></div>
      <div id="statusStrip" class="card strip"></div>
      <div id="summaryGrid" class="summary"></div>

      <section class="card section">
        <div class="section-head">
          <div><h2>房间</h2><div class="muted">查看房间状态、踢出玩家或删除房间。</div></div>
        </div>
        <div id="roomsContainer"></div>
      </section>

      <section class="card section">
        <div class="section-head">
          <div><h2>玩家</h2><div class="muted">查看玩家状态，并修改显示名或存储数据。</div></div>
        </div>
        <div id="playersContainer"></div>
      </section>

      <section class="card section">
        <div class="section-head">
          <div><h2>存储</h2><div class="muted">查看并修改用户存储内容。</div></div>
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
    var listState = createInitialListState();

    document.getElementById('loginForm').addEventListener('submit', onLogin);
    document.getElementById('refreshButton').addEventListener('click', function () { void loadDashboard(); });
    document.getElementById('logoutButton').addEventListener('click', onLogout);
    dashboardView.addEventListener('click', onDashboardClick);
    dashboardView.addEventListener('submit', onDashboardSubmit);
    dashboardView.addEventListener('change', onDashboardChange);

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
        setBanner(loginBanner, 'error', response.error || '登录失败');
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

    async function onDashboardClick(event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') {
        return;
      }

      var button = target.closest('button[data-action]');
      if (!button) {
        return;
      }

      var action = button.dataset.action;
      if (action === 'change-page') {
        await changeListPage(button.dataset.list || '', button.dataset.page || '');
        return;
      }

      if (action === 'reset-list') {
        resetListState(button.dataset.list || '');
        await loadDashboard();
        return;
      }

      if (action === 'dismiss-room') {
        await dismissRoom(button.dataset.roomId || '');
        return;
      }

      if (action === 'kick-player') {
        await kickPlayer(button.dataset.roomId || '', button.dataset.userId || '');
        return;
      }

      if (action === 'edit-display-name') {
        await editDisplayName(button.dataset.userId || '', button.dataset.displayName || '');
        return;
      }

      if (action === 'save-storage') {
        await saveStorage(button.dataset.userId || '');
        return;
      }

      if (action === 'delete-storage-key') {
        await deleteStorageKey(button.dataset.userId || '');
      }
    }

    async function onDashboardSubmit(event) {
      var form = event.target;
      if (!form || typeof form.matches !== 'function' || !form.matches('form[data-list]')) {
        return;
      }

      event.preventDefault();
      applyListFormState(form, true);
      await loadDashboard();
    }

    async function onDashboardChange(event) {
      var target = event.target;
      if (!target || target.name !== 'pageSize') {
        return;
      }

      var form = typeof target.closest === 'function' ? target.closest('form[data-list]') : null;
      if (!form) {
        return;
      }

      applyListFormState(form, true);
      await loadDashboard();
    }

    function showLogin() {
      loginView.classList.remove('hidden');
      dashboardView.classList.add('hidden');
    }

    function showDashboard() {
      loginView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      if (!refreshTimer) {
        refreshTimer = setInterval(function () {
          if (!shouldPauseAutoRefresh()) {
            void loadDashboard();
          }
        }, 5000);
      }
    }

    async function loadDashboard() {
      var response = await api(buildDashboardUrl());
      if (!response.ok) {
        if (response.status === 401) {
          if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
          }
          showLogin();
          setBanner(loginBanner, 'error', '登录状态已过期，请重新登录。');
          return;
        }
        setBanner(dashboardBanner, 'error', response.error || '加载后台数据失败');
        return;
      }
      setBanner(dashboardBanner, '', '');
      renderDashboard(response.data);
    }

    function renderDashboard(data) {
      document.getElementById('statusStrip').innerHTML =
        '<span><strong>WS 端口:</strong> ' + esc(data.server.wsPort) + '</span>' +
        '<span><strong>后台地址:</strong> ' + esc(data.server.adminHost + ':' + data.server.adminPort) + '</span>' +
        '<span><strong>启动时间:</strong> ' + esc(fmtDate(data.server.startedAt)) + '</span>' +
        '<span><strong>运行时长:</strong> ' + esc(fmtDuration(data.server.uptimeMs)) + '</span>' +
        '<span><strong>连接数:</strong> ' + esc(String(data.server.openConnections)) + ' 已打开 / ' + esc(String(data.server.boundConnections)) + ' 已绑定</span>';

      var summary = document.getElementById('summaryGrid');
      summary.innerHTML = '';
      addSummary(summary, '账号数', data.summary.accountCount);
      addSummary(summary, '在线玩家', data.summary.onlinePlayerCount);
      addSummary(summary, '活跃房间', data.summary.roomCount);
      addSummary(summary, '存储记录', data.summary.storageCount);
      addSummary(summary, '活跃会话', data.summary.sessionCount);

      syncListState('rooms', data.roomPager);
      syncListState('players', data.playerPager);
      syncListState('storages', data.storagePager);

      renderRooms(data.rooms, data.roomPager);
      renderPlayers(data.players, data.playerPager);
      renderStorages(data.storages, data.storagePager);
    }

    function addSummary(parent, label, value) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<span>' + esc(label) + '</span><strong>' + esc(String(value)) + '</strong>';
      parent.appendChild(card);
    }

    function createInitialListState() {
      return {
        rooms: createListConfig(),
        players: createListConfig(),
        storages: createListConfig()
      };
    }

    function createListConfig() {
      return {
        search: '',
        page: 1,
        pageSize: 20
      };
    }

    function getListConfig(listKey) {
      return listState[listKey] || null;
    }

    function applyListFormState(form, resetPage) {
      var listKey = form.dataset.list || '';
      var state = getListConfig(listKey);
      if (!state) {
        return;
      }

      var searchInput = form.querySelector('input[name="search"]');
      var pageSizeSelect = form.querySelector('select[name="pageSize"]');
      state.search = searchInput ? searchInput.value.trim() : '';
      state.pageSize = parsePositiveInteger(pageSizeSelect ? pageSizeSelect.value : '', state.pageSize);
      if (resetPage) {
        state.page = 1;
      }
    }

    function resetListState(listKey) {
      var state = getListConfig(listKey);
      if (!state) {
        return;
      }

      state.search = '';
      state.page = 1;
    }

    function syncListState(listKey, pager) {
      var state = getListConfig(listKey);
      if (!state || !pager) {
        return;
      }

      state.search = pager.search || '';
      state.page = pager.page || 1;
      state.pageSize = pager.pageSize || state.pageSize;
    }

    async function changeListPage(listKey, pageValue) {
      var state = getListConfig(listKey);
      if (!state) {
        return;
      }

      var nextPage = parsePositiveInteger(pageValue, state.page);
      if (nextPage === state.page) {
        return;
      }

      state.page = nextPage;
      await loadDashboard();
    }

    function buildDashboardUrl() {
      var params = new URLSearchParams();
      appendListParams(params, 'room', listState.rooms);
      appendListParams(params, 'player', listState.players);
      appendListParams(params, 'storage', listState.storages);
      return '/admin/api/dashboard?' + params.toString();
    }

    function appendListParams(params, prefix, state) {
      params.set(prefix + 'Page', String(state.page));
      params.set(prefix + 'PageSize', String(state.pageSize));
      if (state.search) {
        params.set(prefix + 'Search', state.search);
      }
    }

    function shouldPauseAutoRefresh() {
      var active = document.activeElement;
      return !!(active && dashboardView.contains(active) && (
        active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA'
      ));
    }

    function renderRooms(rooms, pager) {
      var html = renderListTools('rooms', pager, '搜索房间名、房间 ID、房主、玩家');
      if (!rooms.length) {
        html += '<div class="muted empty-state">' + esc(resolveEmptyMessage(pager, '当前没有活跃房间。', '没有匹配的房间。')) + '</div>';
        html += renderListMeta('rooms', pager, '房间');
        document.getElementById('roomsContainer').innerHTML = html;
        return;
      }
      var rows = rooms.map(function (room) {
        var players = room.players.map(function (player) {
          return '<span class="pill ' + (player.isOnline ? '' : 'off') + '">' +
            esc(player.displayName) + ' · ' + esc(player.isReady ? '已准备' : '未准备') + ' · ' + esc(player.isOnline ? '在线' : '离线') +
            '</span>' +
            '<button class="danger" type="button" data-action="kick-player" data-room-id="' + esc(room.roomId) + '" data-user-id="' + esc(player.userId) + '">踢出</button>';
        }).join('');
        return '<tr>' +
          '<td><div><strong>' + esc(room.name) + '</strong></div><div class="mono">' + esc(room.roomId) + '</div></td>' +
          '<td>' + esc(formatRoomState(room.state)) + '<br/>房主: <span class="mono">' + esc(room.ownerUserId) + '</span></td>' +
          '<td><div class="stack">' + players + '</div></td>' +
          '<td>创建: ' + esc(fmtDate(room.createdAt)) + '<br/>更新: ' + esc(fmtDate(room.updatedAt)) + '<br/>倒计时结束: ' + esc(room.countdownEndAt ? fmtDate(room.countdownEndAt) : '-') + '</td>' +
          '<td><button class="danger" type="button" data-action="dismiss-room" data-room-id="' + esc(room.roomId) + '">删除房间</button></td>' +
          '</tr>';
      }).join('');
      html += '<div class="table-wrap"><table><thead><tr><th>房间</th><th>状态</th><th>玩家</th><th>时间</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      html += renderListMeta('rooms', pager, '房间');
      document.getElementById('roomsContainer').innerHTML = html;
    }

    function renderPlayers(players, pager) {
      var html = renderListTools('players', pager, '搜索玩家昵称、账号、用户 ID、房间 ID');
      if (!players.length) {
        html += '<div class="muted empty-state">' + esc(resolveEmptyMessage(pager, '当前没有注册玩家。', '没有匹配的玩家。')) + '</div>';
        html += renderListMeta('players', pager, '玩家');
        document.getElementById('playersContainer').innerHTML = html;
        return;
      }
      var rows = players.map(function (player) {
        return '<tr>' +
          '<td><div><strong>' + esc(player.displayName) + '</strong> (' + esc(player.username) + ')</div><div class="mono">' + esc(player.userId) + '</div><div>创建: ' + esc(fmtDate(player.createdAt)) + '</div><div>最近登录: ' + esc(fmtDate(player.lastLoginAt)) + '</div></td>' +
          '<td>' + esc(player.isOnline ? '在线' : '离线') + '<br/>会话数: ' + esc(String(player.sessionCount)) + '</td>' +
          '<td>' + esc(player.roomId || '-') + '</td>' +
          '<td>键数量: ' + esc(String(player.storageKeyCount)) + '<br/>更新时间: ' + esc(player.storageUpdatedAt ? fmtDate(player.storageUpdatedAt) : '-') + '</td>' +
          '<td><div class="stack"><button class="secondary" type="button" data-action="edit-display-name" data-user-id="' + esc(player.userId) + '" data-display-name="' + esc(player.displayName) + '">修改名称</button><button class="secondary" type="button" data-action="save-storage" data-user-id="' + esc(player.userId) + '">写入存储</button><button class="ghost" type="button" data-action="delete-storage-key" data-user-id="' + esc(player.userId) + '">删除键</button></div></td>' +
          '</tr>';
      }).join('');
      html += '<div class="table-wrap"><table><thead><tr><th>玩家</th><th>状态</th><th>所在房间</th><th>存储</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      html += renderListMeta('players', pager, '玩家');
      document.getElementById('playersContainer').innerHTML = html;
    }

    function renderStorages(storages, pager) {
      var html = renderListTools('storages', pager, '搜索用户、键名、键值');
      if (!storages.length) {
        html += '<div class="muted empty-state">' + esc(resolveEmptyMessage(pager, '当前还没有存储数据。', '没有匹配的存储记录。')) + '</div>';
        html += renderListMeta('storages', pager, '存储记录');
        document.getElementById('storagesContainer').innerHTML = html;
        return;
      }
      var rows = storages.map(function (storage) {
        return '<tr>' +
          '<td><div><strong>' + esc(storage.displayName || storage.username || storage.userId) + '</strong></div><div class="mono">' + esc(storage.userId) + '</div></td>' +
          '<td>键数量: ' + esc(String(storage.keyCount)) + '<br/>版本: ' + esc(String(storage.version || 0)) + '<br/>更新时间: ' + esc(fmtDate(storage.updatedAt)) + '</td>' +
          '<td><div class="code mono">' + esc(JSON.stringify(storage.data, null, 2)) + '</div></td>' +
          '<td><div class="stack"><button class="secondary" type="button" data-action="save-storage" data-user-id="' + esc(storage.userId) + '">合并 JSON</button><button class="ghost" type="button" data-action="delete-storage-key" data-user-id="' + esc(storage.userId) + '">删除键</button></div></td>' +
          '</tr>';
      }).join('');
      html += '<div class="table-wrap"><table><thead><tr><th>用户</th><th>元信息</th><th>数据</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      html += renderListMeta('storages', pager, '存储记录');
      document.getElementById('storagesContainer').innerHTML = html;
    }

    function renderListTools(listKey, pager, placeholder) {
      return '<div class="section-tools">' +
        '<form class="filter-bar" data-list="' + esc(listKey) + '">' +
        '<input class="search-input" type="search" name="search" placeholder="' + esc(placeholder) + '" value="' + esc(pager.search || '') + '" />' +
        '<label class="inline-field"><span>每页</span><select name="pageSize">' + renderPageSizeOptions(pager.pageSize || 20) + '</select></label>' +
        '<button class="secondary" type="submit">搜索</button>' +
        '<button class="ghost" type="button" data-action="reset-list" data-list="' + esc(listKey) + '">清空</button>' +
        '</form>' +
        '<div class="muted">筛选后 ' + esc(String(pager.filteredTotal || 0)) + ' / 总数 ' + esc(String(pager.total || 0)) + '</div>' +
        '</div>';
    }

    function renderPageSizeOptions(current) {
      var options = [20, 50, 100, 200];
      if (options.indexOf(current) === -1) {
        options.push(current);
        options.sort(function (a, b) { return a - b; });
      }

      return options.map(function (size) {
        return '<option value="' + esc(String(size)) + '"' + (size === current ? ' selected' : '') + '>' + esc(String(size)) + '</option>';
      }).join('');
    }

    function renderListMeta(listKey, pager, itemLabel) {
      var start = pager.filteredTotal ? ((pager.page - 1) * pager.pageSize + 1) : 0;
      var end = pager.filteredTotal ? Math.min(pager.filteredTotal, pager.page * pager.pageSize) : 0;
      return '<div class="list-meta">' +
        '<div class="muted">当前显示 ' + esc(String(start)) + ' - ' + esc(String(end)) + '，共 ' + esc(String(pager.filteredTotal || 0)) + ' 个' + esc(itemLabel) + '</div>' +
        '<div class="pagination">' +
        '<button class="ghost" type="button" data-action="change-page" data-list="' + esc(listKey) + '" data-page="' + esc(String(Math.max(1, pager.page - 1))) + '"' + (pager.page <= 1 ? ' disabled' : '') + '>上一页</button>' +
        '<span class="muted">第 ' + esc(String(pager.page || 1)) + ' / ' + esc(String(pager.totalPages || 1)) + ' 页</span>' +
        '<button class="ghost" type="button" data-action="change-page" data-list="' + esc(listKey) + '" data-page="' + esc(String(Math.min(pager.totalPages || 1, pager.page + 1))) + '"' + (pager.page >= pager.totalPages ? ' disabled' : '') + '>下一页</button>' +
        '</div>' +
        '</div>';
    }

    function resolveEmptyMessage(pager, emptyMessage, searchMessage) {
      return pager && pager.search ? searchMessage : emptyMessage;
    }

    async function dismissRoom(roomId) {
      if (!confirm('确认删除房间 ' + roomId + ' 吗？')) return;
      await handleAction(api('/admin/api/rooms/' + encodeURIComponent(roomId) + '/delete', { method: 'POST' }), '房间已删除。');
    }

    async function kickPlayer(roomId, userId) {
      if (!confirm('确认将玩家 ' + userId + ' 从房间 ' + roomId + ' 中踢出吗？')) return;
      await handleAction(api('/admin/api/rooms/' + encodeURIComponent(roomId) + '/kick', { method: 'POST', body: { userId: userId } }), '玩家已踢出。');
    }

    async function editDisplayName(userId, currentDisplayName) {
      var nextDisplayName = prompt('请输入新的显示名称', currentDisplayName || '');
      if (nextDisplayName === null) return;
      await handleAction(api('/admin/api/accounts/' + encodeURIComponent(userId) + '/display-name', { method: 'POST', body: { displayName: nextDisplayName } }), '显示名称已更新。');
    }

    async function saveStorage(userId) {
      var raw = prompt('请输入要合并到存储中的 JSON 对象', '{"key":"value"}');
      if (raw === null) return;
      var parsed;
      try { parsed = JSON.parse(raw); }
      catch { setBanner(dashboardBanner, 'error', 'JSON 格式不正确'); return; }
      await handleAction(api('/admin/api/storages/' + encodeURIComponent(userId) + '/save', { method: 'POST', body: { save: parsed } }), '存储已更新。');
    }

    async function deleteStorageKey(userId) {
      var key = prompt('请输入要删除的存储键');
      if (key === null) return;
      await handleAction(api('/admin/api/storages/' + encodeURIComponent(userId) + '/delete-key', { method: 'POST', body: { keys: [key] } }), '存储键已删除。');
    }

    async function handleAction(responsePromise, successMessage) {
      var response = await responsePromise;
      if (!response.ok) {
        setBanner(dashboardBanner, 'error', response.error || '操作失败');
        return;
      }
      setBanner(dashboardBanner, 'ok', successMessage);
      await loadDashboard();
    }

    async function api(url, options) {
      try {
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
      catch (error) {
        return {
          ok: false,
          status: 0,
          data: null,
          error: error instanceof Error ? error.message : '网络请求失败'
        };
      }
    }

    function setBanner(target, kind, message) {
      target.className = 'banner';
      target.textContent = message || '';
      if (kind) target.classList.add('show', kind);
    }

    function parsePositiveInteger(value, fallback) {
      var parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return fallback;
      }

      return parsed;
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
      return hours + '小时 ' + minutes + '分钟 ' + seconds + '秒';
    }

    function formatRoomState(state) {
      if (state === 'open') return '开放中';
      if (state === 'countdown') return '倒计时中';
      if (state === 'playing') return '游戏中';
      return state;
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
