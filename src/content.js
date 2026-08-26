(() => {
  const ADD_SELECTORS = [
    '[data-testid="addMutedWord"]',
    '[data-testid="addMutedKeyword"]',
    'a[href="/settings/add_muted_keyword"]',
    'a[href$="/settings/add_muted_keyword"]',
    'a[href*="/settings/add_muted_keyword?"]'
  ];
  const INPUT_SELECTORS = [
    'input[name="keyword"]',
    'input[data-testid="mutedWordInput"]',
    '[data-testid="mutedWordInput"] input'
  ];
  const SAVE_SELECTORS = [
    '[data-testid="settingsSave"]',
    '[data-testid="settingsDetailSave"]',
    '[data-testid="saveMutedWord"]'
  ];
  const POLL_INTERVAL = 120;
  let running = false;
  let abortRequested = false;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "QUIETSYNC_CANCEL") {
      abortRequested = true;
      sendResponse({ accepted: running });
      return false;
    }
    if (message?.type !== "QUIETSYNC_RUN") return false;
    if (running) {
      sendResponse({ accepted: false, error: "Sync already running" });
      return false;
    }
    if (!location.pathname.includes("/settings/muted_keywords")) {
      sendResponse({ accepted: false, error: "Wrong X settings page" });
      return false;
    }
    running = true;
    abortRequested = false;
    sendResponse({ accepted: true });
    runSync(message.words, message.options).finally(() => {
      running = false;
    });
    return false;
  });

  async function runSync(words, options) {
    const hud = createHud(words.length);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    await report({ event: "started", total: words.length, completed, failed, skipped });

    try {
      const initialAddButton = await waitForElement(findAddButton, 15000);
      if (!initialAddButton) throw new Error("找不到 X 的添加屏蔽词按钮，请确认已登录并打开 Muted words 页面。");

      for (let index = 0; index < words.length; index += 1) {
        if (abortRequested) {
          updateHud(hud, { index, total: words.length, completed, failed, skipped, status: "已安全停止" });
          hud.classList.add("is-warning");
          await report({ event: "cancelled", total: words.length, completed, failed, skipped });
          setTimeout(() => hud.remove(), 6000);
          return;
        }
        const item = words[index];
        updateHud(hud, {
          index: index + 1,
          total: words.length,
          term: item.term,
          completed,
          failed,
          skipped,
          status: "正在写入"
        });
        await report({ event: "item-start", item, total: words.length, completed, failed, skipped });

        try {
          const outcome = await addMutedWordWithRetry(item.term, options);
          if (outcome === "skipped") {
            skipped += 1;
            await report({ event: "item-skipped", item, total: words.length, completed, failed, skipped });
          } else {
            completed += 1;
            await report({ event: "item-success", item, total: words.length, completed, failed, skipped });
          }
        } catch (error) {
          if (abortRequested) {
            updateHud(hud, { index, total: words.length, completed, failed, skipped, status: "已安全停止" });
            hud.classList.add("is-warning");
            await report({ event: "cancelled", total: words.length, completed, failed, skipped });
            setTimeout(() => hud.remove(), 6000);
            return;
          }
          failed += 1;
          await report({ event: "item-failed", item, error: error.message, total: words.length, completed, failed, skipped });
          await returnToList();
        }

        updateHud(hud, { index: index + 1, total: words.length, term: item.term, completed, failed, skipped });
        await sleep(withJitter(Number(options.actionDelay) || 1800));
      }

      updateHud(hud, {
        index: words.length,
        total: words.length,
        term: "",
        completed,
        failed,
        skipped,
        status: failed ? "同步完成，有少量失败" : "同步完成"
      });
      hud.classList.add(failed ? "is-warning" : "is-done");
      await report({ event: "done", total: words.length, completed, failed, skipped });
      setTimeout(() => hud.remove(), 8000);
    } catch (error) {
      updateHud(hud, { total: words.length, completed, failed, skipped, status: error.message });
      hud.classList.add("is-error");
      await report({ event: "fatal", error: error.message, total: words.length, completed, failed, skipped });
    }
  }

  async function addMutedWordWithRetry(term, options) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (abortRequested) throw new Error("同步已停止");
      try {
        await addMutedWord(term, options);
        return "success";
      } catch (error) {
        if (isDuplicateError(error.message)) return "skipped";
        lastError = error;
        await returnToList();
        if (attempt === 0) await sleep(700);
      }
    }
    throw lastError || new Error("写入失败");
  }

  async function addMutedWord(term, options) {
    const addButton = await waitForElement(findAddButton, 8000);
    if (!addButton) throw new Error("Add 按钮不可用");
    addButton.click();

    const input = await waitForElement(findKeywordInput, 6000);
    if (!input) throw new Error("屏蔽词输入框未出现");
    setReactInput(input, term);
    await sleep(250);

    setCheckboxByText(["home timeline", "主页时间线", "主頁時間軸"], options.homeTimeline !== false);
    setCheckboxByText(["notifications", "通知"], options.notifications !== false);
    setRadioByText(
      options.muteFrom === "people_you_dont_follow"
        ? ["people you don’t follow", "people you don't follow", "未关注", "未關注"]
        : ["from anyone", "anyone", "任何人", "所有人"]
    );
    setRadioByText(durationLabels(options.duration));

    const saveButton = await waitForElement(findSaveButton, 3000);
    if (!saveButton || saveButton.getAttribute("aria-disabled") === "true" || saveButton.disabled) {
      const message = readAlert() || "Save 按钮不可用，可能已存在同名屏蔽词";
      throw new Error(message);
    }
    saveButton.click();

    const outcome = await waitUntil(() => {
      if (!findKeywordInput()) return { status: "closed" };
      const alert = readAlert();
      return alert ? { status: "error", message: alert } : null;
    }, 7000);
    if (outcome?.status === "closed") return;
    throw new Error(outcome?.message || "X 未确认保存，请稍后重试");
  }

  function setReactInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    input.focus();
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      composed: true,
      inputType: "insertText",
      data: value
    }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setCheckboxByText(labels, desired) {
    for (const checkbox of document.querySelectorAll('[role="checkbox"], input[type="checkbox"]')) {
      const container = checkbox.closest("label") || checkbox.parentElement?.parentElement || checkbox.parentElement;
      const text = (container?.textContent || "").toLocaleLowerCase();
      if (!labels.some((label) => text.includes(label))) continue;
      const checked = checkbox.getAttribute("aria-checked") === "true" || checkbox.checked === true;
      if (checked !== desired) checkbox.click();
      return;
    }
  }

  function setRadioByText(labels) {
    for (const radio of document.querySelectorAll('[role="radio"], input[type="radio"]')) {
      const container = radio.closest("label") || radio.parentElement?.parentElement || radio.parentElement;
      const text = (container?.textContent || "").toLocaleLowerCase();
      if (!labels.some((label) => text.includes(label))) continue;
      const selected = radio.getAttribute("aria-checked") === "true" || radio.checked === true;
      if (!selected) radio.click();
      return;
    }
  }

  function durationLabels(duration) {
    if (duration === "24h") return ["24 hours", "24 小时", "24 小時"];
    if (duration === "7d") return ["7 days", "7 天"];
    if (duration === "30d") return ["30 days", "30 天"];
    return ["forever", "永久", "永远", "永遠"];
  }

  async function returnToList() {
    if (!findKeywordInput()) return;
    const candidates = [...document.querySelectorAll('button, [role="button"]')];
    const cancel = candidates.find((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.toLocaleLowerCase();
      return /back|close|cancel|返回|关闭|取消|關閉/.test(label);
    });
    if (cancel) cancel.click();
    await waitUntil(() => !findKeywordInput(), 2500);
  }

  function readAlert() {
    const alert = document.querySelector('[role="alert"], [data-testid="toast"]');
    return alert?.textContent?.trim() || "";
  }

  function isDuplicateError(message) {
    return /already|duplicate|exists|已存在|已经屏蔽|已屏蔽|重複|已靜音/i.test(String(message || ""));
  }

  function withJitter(base) {
    const safeBase = Math.max(250, base);
    return Math.round(safeBase * (0.85 + Math.random() * 0.3));
  }

  function findAddButton() {
    const directMatch = firstUsableMatch(ADD_SELECTORS);
    if (directMatch) return directMatch;

    const controls = document.querySelectorAll('main a, main button, main [role="button"], main [role="link"]');
    return [...controls].find((control) => {
      if (!isUsable(control)) return false;
      const label = controlLabel(control);
      return /add.*(muted|mute)|(?:muted|mute).*(?:word|keyword).*add|添加.*(?:屏蔽|隐藏|隱藏|靜音)|新增.*(?:屏蔽|靜音)|追加.*ミュート/i.test(label)
        || /^[+＋]$/.test(label);
    }) || null;
  }

  function findKeywordInput() {
    const directMatch = firstUsableMatch(INPUT_SELECTORS);
    if (directMatch) return directMatch;

    const scope = document.querySelector('[role="dialog"]') || document.querySelector("main");
    if (!scope) return null;
    const inputs = scope.querySelectorAll('input:not([type]), input[type="text"]');
    return [...inputs].find((input) => {
      if (!isUsable(input)) return false;
      const label = controlLabel(input);
      return !/search|搜索|搜尋|検索/.test(label);
    }) || null;
  }

  function findSaveButton() {
    const directMatch = firstUsableMatch(SAVE_SELECTORS);
    if (directMatch) return directMatch;

    const input = findKeywordInput();
    const scope = input?.closest('[role="dialog"]') || input?.closest("main") || document.querySelector("main");
    if (!scope) return null;
    const controls = scope.querySelectorAll('button, [role="button"]');
    return [...controls].find((control) => {
      if (!isUsable(control)) return false;
      return /^(save|保存|儲存|存储|儲存する)$/.test(controlLabel(control));
    }) || null;
  }

  function firstUsableMatch(selectors) {
    for (const selector of selectors) {
      const matches = document.querySelectorAll(selector);
      const match = [...matches].find(isUsable);
      if (match) return match;
    }
    return null;
  }

  function isUsable(element) {
    if (!element || element.closest("#quietsync-hud")) return false;
    if (element.disabled || element.getAttribute("aria-disabled") === "true") return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function controlLabel(element) {
    return `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""} ${element.textContent || ""}`
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
  }

  function waitForElement(find, timeout) {
    return waitUntil(find, timeout);
  }

  async function waitUntil(check, timeout) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const result = check();
      if (result) return result;
      await sleep(POLL_INTERVAL);
    }
    return null;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function report(payload) {
    try {
      await chrome.runtime.sendMessage({ type: "SYNC_PROGRESS", payload });
    } catch {
      // The X operation should continue even if the dashboard was closed.
    }
  }

  function createHud(total) {
    document.getElementById("quietsync-hud")?.remove();
    const hud = document.createElement("aside");
    hud.id = "quietsync-hud";
    hud.innerHTML = `
      <div class="quietsync-hud__top">
        <div class="quietsync-hud__mark">Q</div>
        <div>
          <strong>QuietSync</strong>
          <span data-role="status">准备同步</span>
        </div>
      </div>
      <div class="quietsync-hud__term" data-role="term">正在连接 X…</div>
      <div class="quietsync-hud__track"><i data-role="bar"></i></div>
      <div class="quietsync-hud__meta">
        <span data-role="count">0 / ${total}</span>
        <span data-role="result">0 成功 · 0 失败</span>
      </div>
      <button type="button" class="quietsync-hud__cancel" data-role="cancel">停止同步</button>`;
    hud.querySelector('[data-role="cancel"]').addEventListener("click", () => {
      abortRequested = true;
      hud.querySelector('[data-role="status"]').textContent = "将在当前词完成后停止";
      hud.querySelector('[data-role="cancel"]').disabled = true;
    });
    document.documentElement.appendChild(hud);
    return hud;
  }

  function updateHud(hud, data) {
    const total = data.total || 1;
    const index = data.index || data.completed || 0;
    hud.querySelector('[data-role="status"]').textContent = data.status || "正在同步";
    if (data.term !== undefined) hud.querySelector('[data-role="term"]').textContent = data.term || "全部处理完成";
    hud.querySelector('[data-role="bar"]').style.width = `${Math.min(100, (index / total) * 100)}%`;
    hud.querySelector('[data-role="count"]').textContent = `${index} / ${total}`;
    const skipped = data.skipped || 0;
    hud.querySelector('[data-role="result"]').textContent = `${data.completed || 0} 成功 · ${skipped} 跳过 · ${data.failed || 0} 失败`;
  }
})();
