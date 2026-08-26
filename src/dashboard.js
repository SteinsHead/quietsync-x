import { buildSyncQueue, CATEGORY_META, sourceOriginPattern } from "./shared/core.js";

const extensionMode = Boolean(globalThis.chrome?.runtime?.id);
let state = null;
let filteredEntries = [];
let toastTimer = null;
let reloadTimer = null;
let previewQueue = [];
const CATALOG_SOURCE = Object.freeze({
  name: "x-comment-blocker 公共词库",
  url: "https://raw.githubusercontent.com/amahteru/x-comment-blocker/main/keywords.txt"
});

const elements = Object.fromEntries([
  "viewTitle", "navPending", "refreshButton", "syncButton", "syncCount", "totalCount",
  "sourceSummary", "pendingCount", "syncedCount", "lastSyncText", "attentionCount",
  "categoryChart", "syncStatus", "syncRing", "syncPercent", "syncHeadline", "syncDetail",
  "syncBar", "searchInput", "categoryFilter", "statusFilter", "selectAll", "selectionText",
  "resultCount", "entryRows", "emptyState", "sourceGrid", "addSourceButton", "sourceDialog",
  "sourceForm", "sourceName", "sourceUrl", "refreshHours", "autoSync", "homeTimeline",
  "notifications", "muteFrom", "duration", "actionDelay", "saveSettingsButton", "toast",
  "onboardingBanner", "exploreSourcesButton", "cancelSyncButton", "subscribeCatalogButton",
  "autoSyncMinConfidence", "exportBackupButton", "exportWordsButton", "syncDialog", "syncForm",
  "previewCount", "previewTime", "previewCategories", "previewList", "confirmSyncButton",
  "viewSubtitle", "runtimeMode", "themeToggle", "themeIcon", "themeLabel",
  "closeSourceDialogButton", "cancelSourceDialogButton", "closeSyncDialogButton", "cancelSyncDialogButton"
].map((id) => [id, document.getElementById(id)]));

elements.runtimeMode.textContent = extensionMode ? "仅本地处理" : "界面预览模式";

for (const [key, meta] of Object.entries(CATEGORY_META)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = meta.label;
  elements.categoryFilter.appendChild(option);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});
elements.refreshButton.addEventListener("click", refreshSources);
elements.syncButton.addEventListener("click", openSyncPreview);
elements.cancelSyncButton.addEventListener("click", cancelSync);
elements.searchInput.addEventListener("input", renderEntries);
elements.categoryFilter.addEventListener("change", renderEntries);
elements.statusFilter.addEventListener("change", renderEntries);
elements.selectAll.addEventListener("change", toggleAllVisible);
elements.addSourceButton.addEventListener("click", () => elements.sourceDialog.showModal());
elements.sourceForm.addEventListener("submit", addSource);
elements.saveSettingsButton.addEventListener("click", saveSettings);
elements.exploreSourcesButton.addEventListener("click", () => switchView("sources"));
elements.subscribeCatalogButton.addEventListener("click", subscribeCatalog);
elements.confirmSyncButton.addEventListener("click", executeSync);
elements.exportBackupButton.addEventListener("click", exportBackup);
elements.exportWordsButton.addEventListener("click", exportWords);
elements.themeToggle.addEventListener("click", toggleTheme);
elements.closeSourceDialogButton.addEventListener("click", closeSourceDialog);
elements.cancelSourceDialogButton.addEventListener("click", closeSourceDialog);
elements.closeSyncDialogButton.addEventListener("click", closeSyncDialog);
elements.cancelSyncDialogButton.addEventListener("click", closeSyncDialog);
elements.sourceDialog.addEventListener("close", () => elements.sourceForm.reset());
elements.syncDialog.addEventListener("close", () => { previewQueue = []; });
elements.sourceDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSourceDialog();
});
elements.syncDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSyncDialog();
});
elements.sourceDialog.addEventListener("click", (event) => {
  if (event.target === elements.sourceDialog) closeSourceDialog();
});
elements.syncDialog.addEventListener("click", (event) => {
  if (event.target === elements.syncDialog) closeSyncDialog();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (elements.sourceDialog.open) {
    event.preventDefault();
    closeSourceDialog();
  } else if (elements.syncDialog.open) {
    event.preventDefault();
    closeSyncDialog();
  }
});

if (extensionMode) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "SYNC_PROGRESS") return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(loadState, 120);
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.quietsyncState) return;
    state = changes.quietsyncState.newValue;
    render();
  });
}

await loadState();

async function send(message) {
  if (!extensionMode) return mockSend(message);
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "QuietSync request failed");
  return response;
}

async function loadState() {
  try {
    const response = await send({ type: "GET_STATE" });
    state = response.state;
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

function render() {
  if (!state) return;
  applyTheme(state.settings?.theme || "light");
  const activeEntries = state.entries.filter((entry) => !entry.stale);
  const queue = buildSyncQueue(state.entries, state.knownMuted);
  const synced = state.entries.filter((entry) => entry.status === "synced").length;
  const attention = state.entries.filter((entry) =>
    entry.status === "failed" || entry.status === "unsupported" || (!entry.stale && entry.confidence < 0.6)
  ).length;
  const healthySources = state.sources.filter((source) => source.enabled && source.status !== "error").length;
  const enabledSources = state.sources.filter((source) => source.enabled).length;

  elements.totalCount.textContent = activeEntries.length.toLocaleString();
  elements.pendingCount.textContent = queue.length.toLocaleString();
  elements.syncedCount.textContent = synced.toLocaleString();
  elements.attentionCount.textContent = attention.toLocaleString();
  elements.syncCount.textContent = queue.length.toLocaleString();
  elements.navPending.textContent = queue.length > 999 ? "999+" : queue.length;
  elements.sourceSummary.textContent = `${healthySources} / ${enabledSources} 个来源在线`;
  elements.lastSyncText.textContent = state.sync.finishedAt ? `${formatDate(state.sync.finishedAt)} 完成` : "尚未执行同步";
  elements.syncButton.disabled = queue.length === 0 || ["opening", "running", "cancelling"].includes(state.sync.status);
  elements.onboardingBanner.hidden = state.sources.some((source) => !source.builtIn);
  const catalogSubscribed = state.sources.some((source) => source.url === CATALOG_SOURCE.url);
  elements.subscribeCatalogButton.disabled = catalogSubscribed;
  elements.subscribeCatalogButton.textContent = catalogSubscribed ? "已订阅" : "一键订阅";

  renderCategoryChart(activeEntries);
  renderSyncState();
  renderEntries();
  renderSources();
  renderSettings();
}

function renderCategoryChart(entries) {
  const counts = Object.fromEntries(Object.keys(CATEGORY_META).map((key) => [key, 0]));
  for (const entry of entries) counts[entry.category] = (counts[entry.category] || 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  elements.categoryChart.replaceChildren();
  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    const column = document.createElement("div");
    column.className = "category-column";
    const value = counts[key] || 0;
    const count = document.createElement("strong");
    count.textContent = value;
    const bar = document.createElement("i");
    bar.style.height = `${Math.max(4, (value / max) * 78)}px`;
    bar.style.background = meta.color;
    const label = document.createElement("span");
    label.textContent = meta.short;
    column.append(count, bar, label);
    elements.categoryChart.appendChild(column);
  }
}

function renderSyncState() {
  const sync = state.sync;
  const total = sync.total || 0;
  const finished = (sync.completed || 0) + (sync.failed || 0) + (sync.skipped || 0);
  const percent = total ? Math.round((finished / total) * 100) : sync.status === "done" ? 100 : 0;
  const labels = {
    idle: "空闲", opening: "正在打开 X", running: "同步中", cancelling: "正在停止",
    cancelled: "已停止", done: "已完成", partial: "部分完成", error: "出错"
  };
  elements.syncStatus.textContent = labels[sync.status] || sync.status;
  elements.syncPercent.textContent = `${percent}%`;
  elements.syncRing.style.setProperty("--progress", `${percent * 3.6}deg`);
  elements.syncBar.style.width = `${percent}%`;
  const isRunning = ["opening", "running", "cancelling"].includes(sync.status);
  elements.cancelSyncButton.hidden = !isRunning;
  if (isRunning) {
    elements.syncHeadline.textContent = `${finished} / ${total} 个词`;
    elements.syncDetail.textContent = sync.current ? `正在写入 “${sync.current}”` : "正在连接 X Muted words…";
  } else if (sync.status === "error") {
    elements.syncHeadline.textContent = "同步未完成";
    elements.syncDetail.textContent = sync.error || "请打开 X 页面检查登录状态。";
  } else if (["done", "partial", "cancelled"].includes(sync.status)) {
    elements.syncHeadline.textContent = sync.status === "cancelled" ? "同步已安全停止" : `${sync.completed} 个词已写入`;
    elements.syncDetail.textContent = sync.failed
      ? `${sync.failed} 个失败，可在列表中重试。`
      : sync.skipped ? `${sync.skipped} 个已存在，因此自动跳过。` : "你的 X 账户已更新。";
  } else {
    elements.syncHeadline.textContent = "准备就绪";
    elements.syncDetail.textContent = "选择词条后开始增量同步。";
  }
}

function getFilteredEntries() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase();
  const category = elements.categoryFilter.value;
  const status = elements.statusFilter.value;
  return state.entries.filter((entry) => {
    const sourceNames = entry.sourceIds.map((id) => state.sources.find((source) => source.id === id)?.name || "").join(" ");
    const matchesQuery = !query || `${entry.term} ${sourceNames}`.toLocaleLowerCase().includes(query);
    const matchesCategory = category === "all" || entry.category === category;
    const matchesStatus = status === "all" || (status === "stale" ? entry.stale : entry.status === status);
    return matchesQuery && matchesCategory && matchesStatus;
  });
}

function renderEntries() {
  if (!state) return;
  filteredEntries = getFilteredEntries();
  elements.entryRows.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const entry of filteredEntries.slice(0, 500)) fragment.appendChild(createEntryRow(entry));
  elements.entryRows.appendChild(fragment);
  elements.emptyState.hidden = filteredEntries.length > 0;
  elements.resultCount.textContent = filteredEntries.length > 500
    ? `显示前 500 / ${filteredEntries.length.toLocaleString()} 个词条`
    : `${filteredEntries.length.toLocaleString()} 个词条`;
  const selectedCount = filteredEntries.filter((entry) => entry.enabled !== false).length;
  elements.selectAll.checked = filteredEntries.length > 0 && selectedCount === filteredEntries.length;
  elements.selectAll.indeterminate = selectedCount > 0 && selectedCount < filteredEntries.length;
  elements.selectionText.textContent = selectedCount ? `已启用 ${selectedCount.toLocaleString()} 个` : "选择当前列表";
}

function createEntryRow(entry) {
  const row = document.createElement("tr");
  const checkCell = document.createElement("td");
  checkCell.className = "check-col";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = entry.enabled !== false;
  checkbox.disabled = entry.status === "unsupported";
  checkbox.ariaLabel = `启用 ${entry.term}`;
  checkbox.addEventListener("change", () => updateEntry(entry.id, { enabled: checkbox.checked }));
  checkCell.appendChild(checkbox);

  const termCell = document.createElement("td");
  termCell.className = "term-cell";
  const term = document.createElement("strong");
  term.textContent = entry.term;
  const confidence = document.createElement("span");
  confidence.textContent = entry.categoryLocked ? "手动分类" : `置信度 ${Math.round(entry.confidence * 100)}%`;
  termCell.append(term, confidence);

  const categoryCell = document.createElement("td");
  const select = document.createElement("select");
  select.className = "category-select";
  select.style.setProperty("--category-color", CATEGORY_META[entry.category]?.color || "#aeb6b0");
  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = meta.label;
    option.selected = key === entry.category;
    select.appendChild(option);
  }
  select.addEventListener("change", () => updateEntry(entry.id, { category: select.value }));
  categoryCell.appendChild(select);

  const sourceCell = document.createElement("td");
  const sourceCount = document.createElement("span");
  sourceCount.className = "source-count";
  const sourceDot = document.createElement("i");
  const sourceText = document.createElement("span");
  sourceText.textContent = `${entry.sourceIds.length} 个来源`;
  sourceCount.title = entry.sourceIds.map((id) => state.sources.find((source) => source.id === id)?.name || id).join("\n");
  sourceCount.append(sourceDot, sourceText);
  sourceCell.appendChild(sourceCount);

  const statusCell = document.createElement("td");
  const status = document.createElement("span");
  const statusKey = entry.stale ? "stale" : entry.status;
  status.className = `row-status ${statusKey}`;
  status.textContent = ({ pending: "待同步", synced: "已同步", failed: "失败", ignored: "已忽略", unsupported: "X 不支持正则", stale: "远程已移除" })[statusKey] || statusKey;
  if (entry.lastError) status.title = entry.lastError;
  statusCell.appendChild(status);

  const actionCell = document.createElement("td");
  const action = document.createElement("button");
  action.className = "row-action";
  if (entry.status === "unsupported") {
    action.textContent = "—";
    action.disabled = true;
    action.title = "X 原生屏蔽词不支持正则表达式";
  } else {
    action.textContent = entry.status === "ignored" ? "↶" : "×";
    action.title = entry.status === "ignored" ? "恢复" : "忽略";
    action.addEventListener("click", () => updateEntry(entry.id, { status: entry.status === "ignored" ? "pending" : "ignored" }));
  }
  actionCell.appendChild(action);
  row.append(checkCell, termCell, categoryCell, sourceCell, statusCell, actionCell);
  return row;
}

function renderSources() {
  elements.sourceGrid.replaceChildren();
  for (const source of state.sources) {
    const card = document.createElement("article");
    card.className = "source-card";
    const head = document.createElement("div");
    head.className = "source-card-head";
    const titleWrap = document.createElement("div");
    const kicker = document.createElement("span");
    kicker.className = "kicker";
    kicker.textContent = source.builtIn ? "BUNDLED" : source.status === "error" ? "NEEDS ATTENTION" : "REMOTE";
    const title = document.createElement("h3");
    title.textContent = source.name;
    titleWrap.append(kicker, title);
    const toggle = document.createElement("label");
    toggle.className = "source-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = source.enabled;
    input.addEventListener("change", () => toggleSource(source.id, input.checked));
    toggle.append(input, document.createElement("i"));
    head.append(titleWrap, toggle);
    const url = document.createElement("p");
    url.className = "source-url";
    url.textContent = source.builtIn ? "本地内置示例词库" : source.url;
    const metrics = document.createElement("div");
    metrics.className = "source-metrics";
    metrics.innerHTML = `<div><strong>${Number(source.count || 0).toLocaleString()}</strong><span>词条</span></div><div><strong>${source.lastFetchedAt ? formatDate(source.lastFetchedAt, true) : "—"}</strong><span>最近拉取</span></div>`;
    card.append(head, url, metrics);
    if (source.error) {
      const error = document.createElement("p");
      error.className = "source-error";
      error.textContent = source.error;
      error.title = source.error;
      card.appendChild(error);
    }
    if (!source.builtIn) {
      const remove = document.createElement("button");
      remove.className = "source-remove";
      remove.textContent = "移除来源";
      remove.addEventListener("click", () => removeSource(source.id));
      card.appendChild(remove);
    }
    elements.sourceGrid.appendChild(card);
  }
}

function renderSettings() {
  const settings = state.settings;
  setSelectValue(elements.refreshHours, settings.refreshHours);
  elements.autoSync.checked = Boolean(settings.autoSync);
  setSelectValue(elements.autoSyncMinConfidence, settings.autoSyncMinConfidence ?? 0.72);
  elements.homeTimeline.checked = settings.homeTimeline !== false;
  elements.notifications.checked = settings.notifications !== false;
  setSelectValue(elements.muteFrom, settings.muteFrom);
  setSelectValue(elements.duration, settings.duration);
  setSelectValue(elements.actionDelay, settings.actionDelay);
}

function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  elements.themeIcon.textContent = resolved === "dark" ? "☾" : "☀";
  elements.themeLabel.textContent = resolved === "dark" ? "夜间" : "清新";
  const target = resolved === "dark" ? "清新" : "夜间";
  elements.themeToggle.ariaLabel = `切换到${target}模式`;
  elements.themeToggle.title = `切换到${target}模式`;
}

async function toggleTheme() {
  const previous = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = previous === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    const response = await send({ type: "SAVE_SETTINGS", settings: { theme: next } });
    state = response.state;
    render();
  } catch (error) {
    applyTheme(previous);
    showToast("外观设置没有保存，请再试一次。", true);
  }
}

function switchView(view) {
  const titles = { library: "屏蔽词库", sources: "订阅来源", settings: "同步设置" };
  const subtitles = {
    library: "把嘈杂留在词库，把安静同步到每一台设备。",
    sources: "只订阅你信任的 HTTPS 词库，来源权限逐个授权。",
    settings: "决定何时拉取、哪些词可自动写入，以及 X 的原生屏蔽范围。"
  };
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
  elements.viewTitle.textContent = titles[view];
  elements.viewSubtitle.textContent = subtitles[view];
  history.replaceState(null, "", `#${view}`);
}

async function refreshSources() {
  setBusy(elements.refreshButton, true, "正在拉取…");
  try {
    const response = await send({ type: "REFRESH_SOURCES" });
    state = response.state;
    render();
    const errors = state.sources.filter((source) => source.enabled && source.status === "error");
    showToast(errors.length ? `${errors.length} 个来源拉取失败，请检查来源卡片。` : "词库已拉取并完成分类。", errors.length > 0);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(elements.refreshButton, false, "↻ 拉取词库");
  }
}

function openSyncPreview() {
  previewQueue = buildSyncQueue(state.entries, state.knownMuted);
  if (!previewQueue.length) return;
  elements.previewCount.textContent = previewQueue.length.toLocaleString();
  const seconds = Math.ceil(previewQueue.length * ((Number(state.settings.actionDelay) || 1800) + 500) / 1000);
  elements.previewTime.textContent = formatDuration(seconds);
  const counts = {};
  for (const entry of previewQueue) counts[entry.category] = (counts[entry.category] || 0) + 1;
  elements.previewCategories.replaceChildren();
  for (const [category, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    const chip = document.createElement("span");
    chip.textContent = `${CATEGORY_META[category]?.short || category} ${count}`;
    elements.previewCategories.appendChild(chip);
  }
  elements.previewList.replaceChildren();
  for (const entry of previewQueue.slice(0, 12)) {
    const row = document.createElement("div");
    const term = document.createElement("strong");
    term.textContent = entry.term;
    const category = document.createElement("span");
    category.textContent = CATEGORY_META[entry.category]?.short || entry.category;
    row.append(term, category);
    elements.previewList.appendChild(row);
  }
  if (previewQueue.length > 12) {
    const more = document.createElement("div");
    more.textContent = `还有 ${previewQueue.length - 12} 个词…`;
    elements.previewList.appendChild(more);
  }
  elements.syncDialog.showModal();
}

function closeSourceDialog() {
  elements.sourceDialog.close("cancel");
}

function closeSyncDialog() {
  elements.syncDialog.close("cancel");
}

async function executeSync() {
  const queue = previewQueue;
  if (!queue.length) return;
  elements.syncDialog.close();
  elements.syncButton.disabled = true;
  elements.syncButton.setAttribute("aria-busy", "true");
  try {
    await send({ type: "START_SYNC", entryIds: queue.map((entry) => entry.id), manual: true });
    showToast(`已把 ${queue.length} 个词交给 X，同步进度会实时显示。`);
    await loadState();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.syncButton.removeAttribute("aria-busy");
    render();
  }
}

async function cancelSync() {
  elements.cancelSyncButton.disabled = true;
  try {
    const response = await send({ type: "CANCEL_SYNC" });
    state = response.state;
    render();
    showToast("已请求停止；当前正在保存的词完成后会退出。")
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.cancelSyncButton.disabled = false;
  }
}

async function updateEntry(id, change) {
  try {
    const response = await send({ type: "UPDATE_ENTRIES", updates: [{ id, ...change }] });
    state = response.state;
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function toggleAllVisible() {
  const enabled = elements.selectAll.checked;
  const updates = filteredEntries.map((entry) => ({ id: entry.id, enabled }));
  if (!updates.length) return;
  try {
    const response = await send({ type: "UPDATE_ENTRIES", updates });
    state = response.state;
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function addSource(event) {
  event.preventDefault();
  try {
    const url = elements.sourceUrl.value.trim();
    const origin = sourceOriginPattern(url);
    if (extensionMode) {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) throw new Error("未获得该词库域名的读取权限");
    }
    const source = {
      id: `src_${crypto.randomUUID()}`,
      name: elements.sourceName.value.trim(),
      url,
      enabled: true,
      status: "new",
      count: 0,
      lastFetchedAt: null,
      error: null
    };
    const response = await send({ type: "SAVE_SOURCES", sources: [...state.sources, source] });
    state = response.state;
    elements.sourceDialog.close();
    elements.sourceForm.reset();
    switchView("sources");
    await refreshSources();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function subscribeCatalog() {
  if (state.sources.some((source) => source.url === CATALOG_SOURCE.url)) return;
  setBusy(elements.subscribeCatalogButton, true, "申请权限…");
  try {
    const origin = sourceOriginPattern(CATALOG_SOURCE.url);
    if (extensionMode) {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) throw new Error("未获得 raw.githubusercontent.com 的读取权限");
    }
    const source = {
      id: `src_${crypto.randomUUID()}`,
      ...CATALOG_SOURCE,
      enabled: true,
      status: "new",
      count: 0,
      lastFetchedAt: null,
      error: null,
      catalog: true
    };
    state = (await send({ type: "SAVE_SOURCES", sources: [...state.sources, source] })).state;
    render();
    await refreshSources();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.subscribeCatalogButton.disabled = state.sources.some((source) => source.url === CATALOG_SOURCE.url);
    elements.subscribeCatalogButton.textContent = elements.subscribeCatalogButton.disabled ? "已订阅" : "一键订阅";
  }
}

async function toggleSource(id, enabled) {
  const sources = state.sources.map((source) => source.id === id ? { ...source, enabled } : source);
  try {
    const response = await send({ type: "SAVE_SOURCES", sources });
    state = response.state;
    render();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function removeSource(id) {
  const source = state.sources.find((item) => item.id === id);
  if (!source || !confirm(`移除来源“${source.name}”？已有词条不会立刻从 X 删除。`)) return;
  try {
    const response = await send({ type: "SAVE_SOURCES", sources: state.sources.filter((item) => item.id !== id) });
    state = response.state;
    render();
    showToast("来源已移除；下次拉取后，其独有词条会标记为已移除。")
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveSettings() {
  const settings = {
    refreshHours: Number(elements.refreshHours.value),
    autoSync: elements.autoSync.checked,
    autoSyncMinConfidence: Number(elements.autoSyncMinConfidence.value),
    addOnly: true,
    homeTimeline: elements.homeTimeline.checked,
    notifications: elements.notifications.checked,
    muteFrom: elements.muteFrom.value,
    duration: elements.duration.value,
    actionDelay: Number(elements.actionDelay.value)
  };
  setBusy(elements.saveSettingsButton, true, "保存中…");
  try {
    const response = await send({ type: "SAVE_SETTINGS", settings });
    state = response.state;
    render();
    showToast("同步设置已保存。")
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(elements.saveSettingsButton, false, "保存设置");
  }
}

function exportBackup() {
  const safeState = structuredClone(state);
  safeState.exportedAt = new Date().toISOString();
  downloadText(`quietsync-backup-${dateStamp()}.json`, JSON.stringify(safeState, null, 2), "application/json");
  showToast("JSON 备份已导出。")
}

function exportWords() {
  const words = state.entries
    .filter((entry) => entry.enabled !== false && !entry.stale && entry.status !== "unsupported")
    .map((entry) => entry.term);
  downloadText(`quietsync-words-${dateStamp()}.txt`, `${words.join("\n")}\n`, "text/plain");
  showToast(`已导出 ${words.length} 个启用词。`)
}

function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `约 ${minutes} 分钟`;
  return `约 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}

function setSelectValue(select, value) {
  if ([...select.options].some((option) => String(option.value) === String(value))) select.value = String(value);
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}

function formatDate(value, compact = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", compact
    ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }
  ).format(date);
}

function showToast(message, error = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", error);
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3800);
}

function mockSend(message) {
  if (!state) state = createMockState();
  if (message.type === "GET_STATE") return { ok: true, state };
  if (message.type === "UPDATE_ENTRIES") {
    const changes = new Map(message.updates.map((item) => [item.id, item]));
    state.entries = state.entries.map((entry) => changes.has(entry.id) ? { ...entry, ...changes.get(entry.id) } : entry);
  }
  if (message.type === "SAVE_SOURCES") state.sources = message.sources;
  if (message.type === "SAVE_SETTINGS") state.settings = { ...state.settings, ...message.settings };
  if (message.type === "REFRESH_SOURCES") state.refresh.lastSuccessAt = new Date().toISOString();
  if (message.type === "START_SYNC") throw new Error("预览模式不会操作 X；加载为 Chrome 扩展后即可同步。");
  if (message.type === "CANCEL_SYNC") state.sync.status = "cancelled";
  return { ok: true, state };
}

function createMockState() {
  const terms = [
    ["connect your wallet", "scam", 0.96], ["claim airdrop now", "scam", 0.84],
    ["dm me for promo", "spam", 0.82], ["加微领取", "spam", 0.72],
    ["follow me for follow back", "engagement", 0.84], ["like and repost", "engagement", 0.72],
    ["memecoin presale", "crypto", 0.72], ["百倍币", "crypto", 0.72],
    ["AI美女", "ai_slop", 0.72], ["made with AI", "ai_slop", 0.72],
    ["NSFW", "adult", 0.72], ["election fraud", "politics", 0.72],
    ["提示词免费领取", "ai_slop", 0.84], ["转发抽奖", "engagement", 0.72]
  ];
  const entries = Array.from({ length: 1527 }, (_, index) => {
    const item = terms[index % terms.length];
    const variant = Math.floor(index / terms.length);
    const term = variant ? `${item[0]} · ${String(variant + 1).padStart(3, "0")}` : item[0];
    const status = index < 84 ? "pending" : index < 92 ? "failed" : index < 96 ? "unsupported" : "synced";
    return {
      id: `mock_${index}`,
      term: status === "unsupported" ? `/spam_${index}/i` : term,
      normalized: status === "unsupported" ? `/spam_${index}/i` : term,
      category: item[1],
      confidence: status === "failed" ? 0.54 : item[2],
      sourceIds: index % 3 ? ["community"] : ["starter", "community"],
      enabled: status !== "unsupported",
      status,
      stale: false,
      lastError: status === "failed" ? "上次写入未获得 X 页面确认，可安全重试" : null,
      firstSeenAt: new Date().toISOString()
    };
  });
  return {
    sources: [
      { id: "starter", name: "QuietSync Starter", url: "sample/keywords.txt", enabled: true, builtIn: true, status: "ready", count: 12, lastFetchedAt: new Date().toISOString(), error: null },
      { id: "community", name: "Community Signal List", url: "https://raw.githubusercontent.com/example/x-mute-list/main/keywords.json", enabled: true, status: "ready", count: 1515, lastFetchedAt: new Date().toISOString(), error: null }
    ],
    entries,
    knownMuted: entries.filter((entry) => entry.status === "synced").map((entry) => entry.normalized),
    settings: { refreshHours: 6, autoSync: false, autoSyncMinConfidence: 0.72, addOnly: true, duration: "forever", muteFrom: "everyone", homeTimeline: true, notifications: true, actionDelay: 1800, theme: "light" },
    refresh: { status: "idle", lastSuccessAt: new Date().toISOString(), error: null },
    sync: { status: "idle", total: 0, completed: 0, failed: 0, current: null, finishedAt: null, error: null }
  };
}

const initialView = location.hash.slice(1);
if (["library", "sources", "settings"].includes(initialView)) switchView(initialView);
