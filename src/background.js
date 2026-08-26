import {
  buildAutoSyncQueue,
  buildSyncQueue,
  mergeDictionary,
  normalizeTerm,
  parseDictionary
} from "./shared/core.js";

const STORAGE_KEY = "quietsyncState";
const REFRESH_ALARM = "quietsync-refresh";
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES_PER_SOURCE = 10000;

function defaultState() {
  return {
    schemaVersion: 2,
    sources: [{
      id: "starter",
      name: "QuietSync Starter",
      url: chrome.runtime.getURL("sample/keywords.txt"),
      enabled: true,
      builtIn: true,
      status: "ready",
      count: 0,
      lastFetchedAt: null,
      error: null
    }],
    entries: [],
    knownMuted: [],
    settings: {
      refreshHours: 6,
      autoSync: false,
      autoSyncMinConfidence: 0.72,
      addOnly: true,
      duration: "forever",
      muteFrom: "everyone",
      homeTimeline: true,
      notifications: true,
      actionDelay: 1800
    },
    refresh: {
      status: "idle",
      lastRunAt: null,
      lastSuccessAt: null,
      error: null
    },
    sync: {
      status: "idle",
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      current: null,
      startedAt: null,
      finishedAt: null,
      error: null
    }
  };
}

async function readState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) return hydrateState(stored[STORAGE_KEY]);
  const state = defaultState();
  await writeState(state);
  return state;
}

function hydrateState(stored) {
  const fallback = defaultState();
  return {
    ...fallback,
    ...stored,
    schemaVersion: fallback.schemaVersion,
    sources: Array.isArray(stored.sources) ? stored.sources : fallback.sources,
    entries: Array.isArray(stored.entries) ? stored.entries : [],
    knownMuted: Array.isArray(stored.knownMuted) ? stored.knownMuted : [],
    settings: { ...fallback.settings, ...(stored.settings || {}) },
    refresh: { ...fallback.refresh, ...(stored.refresh || {}) },
    sync: { ...fallback.sync, ...(stored.sync || {}) }
  };
}

async function writeState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}

async function updateState(mutator) {
  const state = await readState();
  const next = await mutator(structuredClone(state)) ?? state;
  await writeState(next);
  return next;
}

async function configureAlarm(hours) {
  await chrome.alarms.clear(REFRESH_ALARM);
  await chrome.alarms.create(REFRESH_ALARM, {
    delayInMinutes: Math.max(1, Math.round(hours * 60)),
    periodInMinutes: Math.max(30, Math.round(hours * 60))
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const state = await readState();
  await configureAlarm(state.settings.refreshHours);
  if (state.entries.length === 0) await refreshSources({ reason: "install" });
  if (details.reason === "install") await chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await readState();
  await configureAlarm(state.settings.refreshHours);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) refreshSources({ reason: "alarm" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_STATE":
      return { state: await recoverStalledSync() };
    case "REFRESH_SOURCES":
      return { state: await refreshSources({ reason: "manual" }) };
    case "SAVE_SOURCES":
      return { state: await saveSources(message.sources) };
    case "SAVE_SETTINGS":
      return { state: await saveSettings(message.settings) };
    case "UPDATE_ENTRIES":
      return { state: await updateEntries(message.updates) };
    case "START_SYNC":
      return startSync({ entryIds: message.entryIds, manual: message.manual !== false });
    case "CANCEL_SYNC":
      return { state: await cancelSync() };
    case "SYNC_PROGRESS":
      return { state: await recordSyncProgress(message.payload) };
    case "OPEN_DASHBOARD":
      await chrome.runtime.openOptionsPage();
      return {};
    default:
      throw new Error("Unknown QuietSync message");
  }
}

async function saveSources(sources) {
  return updateState((state) => {
    state.sources = sources.map((source) => ({
      ...source,
      name: String(source.name || "Untitled list").slice(0, 80),
      url: String(source.url || ""),
      enabled: source.enabled !== false
    }));
    const enabledSourceIds = new Set(state.sources.filter((source) => source.enabled).map((source) => source.id));
    state.entries = state.entries.map((entry) =>
      entry.sourceIds.some((sourceId) => enabledSourceIds.has(sourceId))
        ? entry
        : { ...entry, stale: true }
    );
    return state;
  });
}

async function saveSettings(settings) {
  const state = await updateState((current) => {
    current.settings = { ...current.settings, ...settings };
    current.settings.refreshHours = Math.min(168, Math.max(0.5, Number(current.settings.refreshHours) || 6));
    current.settings.actionDelay = Math.min(10000, Math.max(900, Number(current.settings.actionDelay) || 1800));
    return current;
  });
  await configureAlarm(state.settings.refreshHours);
  return state;
}

async function updateEntries(updates = []) {
  const changes = new Map(updates.map((update) => [update.id, update]));
  return updateState((state) => {
    state.entries = state.entries.map((entry) => {
      const change = changes.get(entry.id);
      if (!change) return entry;
      const next = { ...entry };
      if (typeof change.enabled === "boolean") next.enabled = change.enabled;
      if (change.status === "ignored" || change.status === "pending") next.status = change.status;
      if (change.category) {
        next.category = change.category;
        next.categoryLocked = true;
        next.confidence = 1;
      }
      return next;
    });
    return state;
  });
}

let refreshInFlight = null;

async function refreshSources({ reason }) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh(reason).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function performRefresh(reason) {
  let state = await updateState((current) => {
    current.refresh = {
      ...current.refresh,
      status: "running",
      startedAt: new Date().toISOString(),
      error: null
    };
    return current;
  });

  const enabledSources = state.sources.filter((source) => source.enabled);
  const results = await Promise.all(enabledSources.map(fetchSource));
  const successful = results.filter((result) => result.ok);
  const changed = successful.filter((result) => !result.notModified);
  const now = new Date().toISOString();

  state = await updateState((current) => {
    const resultMap = new Map(results.map((result) => [result.sourceId, result]));
    current.sources = current.sources.map((source) => {
      const result = resultMap.get(source.id);
      if (!result) return source;
      return result.ok
        ? {
            ...source,
            status: "ready",
            count: result.notModified ? source.count : result.entries.length,
            lastFetchedAt: now,
            error: null,
            etag: result.etag ?? source.etag ?? ""
          }
        : { ...source, status: "error", error: result.error };
    });

    if (changed.length > 0) {
      current.entries = mergeDictionary(
        current.entries,
        changed.map((result) => ({ sourceId: result.sourceId, entries: result.entries })),
        now,
        changed.map((result) => result.sourceId)
      );
    }

    const allFailed = enabledSources.length > 0 && successful.length === 0;
    current.refresh = {
      status: allFailed ? "error" : "idle",
      lastRunAt: now,
      lastSuccessAt: allFailed ? current.refresh.lastSuccessAt : now,
      error: allFailed ? results.map((result) => result.error).filter(Boolean).join(" · ") : null,
      reason
    };
    return current;
  });

  if (state.settings.autoSync && successful.length > 0) {
    const queue = buildAutoSyncQueue(
      state.entries,
      state.knownMuted,
      Number(state.settings.autoSyncMinConfidence) || 0.72
    );
    if (queue.length > 0) await startSync({ manual: false });
  }
  return state;
}

async function fetchSource(source) {
  try {
    const headers = source.etag ? { "If-None-Match": source.etag } : {};
    const response = await fetchWithTimeout(source.url, 15000, headers);
    if (response.status === 304) {
      return { ok: true, notModified: true, sourceId: source.id, etag: source.etag, entries: [] };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_SOURCE_BYTES) throw new Error("Dictionary exceeds 2 MB limit");
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_SOURCE_BYTES) {
      throw new Error("Dictionary exceeds 2 MB limit");
    }
    const entries = parseDictionary(text, response.headers.get("content-type") || "");
    if (entries.length === 0) throw new Error("No valid words found");
    if (entries.length > MAX_ENTRIES_PER_SOURCE) throw new Error("Dictionary exceeds 10,000 entry limit");
    return { ok: true, sourceId: source.id, entries, etag: response.headers.get("etag") || "" };
  } catch (error) {
    return { ok: false, sourceId: source.id, error: error.message };
  }
}

async function fetchWithTimeout(url, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      headers,
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function startSync({ entryIds, manual }) {
  const state = await readState();
  const selected = Array.isArray(entryIds) ? new Set(entryIds) : null;
  const queue = buildSyncQueue(state.entries, state.knownMuted)
    .filter((entry) => !selected || selected.has(entry.id));
  if (queue.length === 0) return { state, empty: true };
  if (["opening", "running"].includes(state.sync.status)) {
    throw new Error("A sync is already running");
  }

  await updateState((current) => {
    current.sync = {
      status: "opening",
      total: queue.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      current: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      updatedAt: new Date().toISOString()
    };
    return current;
  });

  const tab = await findOrCreateMutedWordsTab(Boolean(manual));
  await waitForTab(tab.id);
  const payload = {
    type: "QUIETSYNC_RUN",
    words: queue.map(({ id, term, normalized }) => ({ id, term, normalized })),
    options: state.settings
  };

  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, payload);
      if (response?.accepted) return { state: await readState(), tabId: tab.id };
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await updateState((current) => {
    current.sync.status = "error";
    current.sync.error = lastError?.message || "Could not connect to the X settings page";
    current.sync.finishedAt = new Date().toISOString();
    return current;
  });
  throw lastError || new Error("Could not connect to the X settings page");
}

async function findOrCreateMutedWordsTab(active) {
  const existing = await chrome.tabs.query({ url: [
    "https://x.com/settings/muted_keywords*",
    "https://twitter.com/settings/muted_keywords*"
  ] });
  if (existing[0]) {
    await chrome.tabs.update(existing[0].id, { active });
    return existing[0];
  }
  return chrome.tabs.create({ url: "https://x.com/settings/muted_keywords", active });
}

async function waitForTab(tabId) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise((resolve) => {
    const listener = (updatedId, changeInfo) => {
      if (updatedId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function recordSyncProgress(payload = {}) {
  return updateState((state) => {
    const { event, item, error, completed, failed, skipped, total } = payload;
    if (event === "started") state.sync.status = "running";
    state.sync.updatedAt = new Date().toISOString();
    if (event === "item-start") state.sync.current = item?.term ?? null;
    if (event === "item-success" && item) {
      state.knownMuted = [...new Set([...state.knownMuted, normalizeTerm(item.term)])];
      state.entries = state.entries.map((entry) =>
        entry.id === item.id ? { ...entry, status: "synced", syncedAt: new Date().toISOString() } : entry
      );
    }
    if (event === "item-skipped" && item) {
      state.knownMuted = [...new Set([...state.knownMuted, normalizeTerm(item.term)])];
      state.entries = state.entries.map((entry) =>
        entry.id === item.id ? { ...entry, status: "synced", syncNote: "already-muted" } : entry
      );
    }
    if (event === "item-failed" && item) {
      state.entries = state.entries.map((entry) =>
        entry.id === item.id ? { ...entry, status: "failed", lastError: error } : entry
      );
    }
    if (Number.isFinite(completed)) state.sync.completed = completed;
    if (Number.isFinite(failed)) state.sync.failed = failed;
    if (Number.isFinite(skipped)) state.sync.skipped = skipped;
    if (Number.isFinite(total)) state.sync.total = total;
    if (event === "done") {
      state.sync.status = failed > 0 ? "partial" : "done";
      state.sync.current = null;
      state.sync.finishedAt = new Date().toISOString();
    }
    if (event === "cancelled") {
      state.sync.status = "cancelled";
      state.sync.current = null;
      state.sync.finishedAt = new Date().toISOString();
    }
    if (event === "fatal") {
      state.sync.status = "error";
      state.sync.error = error || "X page automation failed";
      state.sync.finishedAt = new Date().toISOString();
    }
    return state;
  });
}

async function cancelSync() {
  const state = await readState();
  if (!["opening", "running", "cancelling"].includes(state.sync.status)) return state;
  await updateState((current) => {
    current.sync.status = "cancelling";
    current.sync.updatedAt = new Date().toISOString();
    return current;
  });
  const tabs = await chrome.tabs.query({ url: [
    "https://x.com/settings/muted_keywords*",
    "https://twitter.com/settings/muted_keywords*"
  ] });
  let delivered = false;
  for (const tab of tabs) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "QUIETSYNC_CANCEL" });
      delivered ||= Boolean(response?.accepted);
    } catch {
      // A page without the content script is treated as already stopped.
    }
  }
  if (delivered) return readState();
  return updateState((current) => {
    current.sync.status = "cancelled";
    current.sync.current = null;
    current.sync.finishedAt = new Date().toISOString();
    current.sync.updatedAt = current.sync.finishedAt;
    return current;
  });
}

async function recoverStalledSync() {
  const state = await readState();
  if (!["opening", "running", "cancelling"].includes(state.sync.status)) return state;
  const heartbeat = new Date(state.sync.updatedAt || state.sync.startedAt || 0).getTime();
  if (Date.now() - heartbeat < 120000) return state;
  return updateState((current) => {
    current.sync.status = "error";
    current.sync.current = null;
    current.sync.error = "上次同步意外中断；已完成的词仍会保留，可安全重试剩余词条。";
    current.sync.finishedAt = new Date().toISOString();
    current.sync.updatedAt = current.sync.finishedAt;
    return current;
  });
}
