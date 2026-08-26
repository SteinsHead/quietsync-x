import { buildSyncQueue } from "./shared/core.js";

const extensionMode = Boolean(globalThis.chrome?.runtime?.id);

const pendingCount = document.getElementById("pendingCount");
const totalCount = document.getElementById("totalCount");
const syncedCount = document.getElementById("syncedCount");
const meterBar = document.getElementById("meterBar");
const statusIcon = document.getElementById("statusIcon");
const statusTitle = document.getElementById("statusTitle");
const statusDetail = document.getElementById("statusDetail");
const syncButton = document.getElementById("syncButton");
const buttonCount = document.getElementById("buttonCount");
const refreshButton = document.getElementById("refreshButton");
const dashboardButton = document.getElementById("dashboardButton");
let state;

async function send(message) {
  if (!extensionMode) return mockSend(message);
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "QuietSync request failed");
  return response;
}

async function load() {
  try {
    state = (await send({ type: "GET_STATE" })).state;
    render();
  } catch (error) {
    showError(error.message);
  }
}

function render() {
  const active = state.entries.filter((entry) => !entry.stale);
  const queue = buildSyncQueue(state.entries, state.knownMuted);
  const synced = state.entries.filter((entry) => entry.status === "synced").length;
  pendingCount.textContent = queue.length.toLocaleString();
  totalCount.textContent = `${active.length.toLocaleString()} 个远程词条`;
  syncedCount.textContent = `${synced.toLocaleString()} 个已同步`;
  buttonCount.textContent = queue.length > 999 ? "999+" : queue.length;
  meterBar.style.width = active.length ? `${Math.min(100, (synced / active.length) * 100)}%` : "0%";
  syncButton.disabled = queue.length === 0 || ["opening", "running", "cancelling"].includes(state.sync.status);

  if (["opening", "running", "cancelling"].includes(state.sync.status)) {
    statusIcon.textContent = "↻";
    statusTitle.textContent = "正在同步到 X";
    statusDetail.textContent = `${state.sync.completed + state.sync.failed + (state.sync.skipped || 0)} / ${state.sync.total} · ${state.sync.current || "正在连接"}`;
  } else if (state.sync.status === "cancelled") {
    statusIcon.textContent = "■";
    statusTitle.textContent = "上次同步已停止";
    statusDetail.textContent = "已完成部分已保留，可继续同步剩余词。";
  } else if (state.sync.status === "error") {
    statusIcon.textContent = "!";
    statusTitle.textContent = "上次同步未完成";
    statusDetail.textContent = state.sync.error || "请检查 X 登录状态";
  } else if (state.refresh.error) {
    statusIcon.textContent = "!";
    statusTitle.textContent = "词库拉取失败";
    statusDetail.textContent = state.refresh.error;
  } else {
    statusIcon.textContent = "✓";
    statusTitle.textContent = queue.length ? "词库已更新" : "现在很安静";
    statusDetail.textContent = queue.length ? `${queue.length} 个新增词等待写入` : "远程词库与本地记录一致";
  }
}

function showError(message) {
  statusIcon.textContent = "!";
  statusTitle.textContent = "QuietSync 出错了";
  statusDetail.textContent = message;
}

syncButton.addEventListener("click", async () => {
  syncButton.disabled = true;
  try {
    const queue = buildSyncQueue(state.entries, state.knownMuted);
    await send({ type: "START_SYNC", entryIds: queue.map((entry) => entry.id), manual: true });
    window.close();
  } catch (error) {
    showError(error.message);
    syncButton.disabled = false;
  }
});

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = "正在拉取…";
  try {
    state = (await send({ type: "REFRESH_SOURCES" })).state;
    render();
  } catch (error) {
    showError(error.message);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "↻ 拉取词库";
  }
});

dashboardButton.addEventListener("click", async () => {
  if (!extensionMode) {
    location.href = "dashboard.html";
    return;
  }
  await send({ type: "OPEN_DASHBOARD" });
  window.close();
});

if (extensionMode) {
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.quietsyncState) return;
    state = changes.quietsyncState.newValue;
    render();
  });
}

function mockSend(message) {
  const entries = Array.from({ length: 1527 }, (_, index) => ({
    id: `preview_${index}`,
    term: `preview-${index}`,
    normalized: `preview-${index}`,
    category: "spam",
    confidence: 0.84,
    sourceIds: ["preview"],
    enabled: true,
    stale: false,
    status: index < 92 ? "pending" : "synced"
  }));
  const previewState = {
    entries,
    knownMuted: entries.slice(92).map((entry) => entry.normalized),
    refresh: { status: "idle", error: null },
    sync: { status: "idle", completed: 0, failed: 0, skipped: 0, total: 0, current: null }
  };
  if (message.type === "GET_STATE" || message.type === "REFRESH_SOURCES") return { ok: true, state: previewState };
  if (message.type === "START_SYNC") throw new Error("预览模式不会操作 X");
  return { ok: true, state: previewState };
}

load();
