(() => {
  const progress = [];
  const saved = [];
  let messageListener = null;
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener(listener) { messageListener = listener; } },
      sendMessage(message) {
        progress.push(message.payload);
        if (["done", "fatal", "cancelled"].includes(message.payload?.event)) {
          const status = document.querySelector('[data-testid="fixture-status"]');
          status.textContent = message.payload.event;
          status.dataset.completed = String(message.payload.completed || 0);
          status.dataset.skipped = String(message.payload.skipped || 0);
          status.dataset.failed = String(message.payload.failed || 0);
        }
        return Promise.resolve({ ok: true });
      },
      getURL(path) { return path; }
    }
  };

  globalThis.__quietSyncFixture = { progress, saved, get listener() { return messageListener; } };

  document.querySelector('[data-fixture="add-muted-word"]').addEventListener("click", (event) => {
    event.preventDefault();
    history.pushState({}, "", "/settings/add_muted_keyword");
    const host = document.getElementById("editorHost");
    if (host.firstChild) return;
    const editor = document.createElement("section");
    editor.id = "editor";
    editor.setAttribute("role", "dialog");
    editor.innerHTML = `
      <button type="button" data-fixture="close-editor" aria-label="返回">←</button>
      <input data-testid="mutedKeywordTextInput" aria-label="字词或短语">
      <label>Home timeline <span role="checkbox" aria-checked="true"></span></label>
      <label>Notifications <span role="checkbox" aria-checked="true"></span></label>
      <label>From anyone <span role="radio" aria-checked="true"></span></label>
      <label>Forever <span role="radio" aria-checked="true"></span></label>
      <button data-testid="saveMutedWord">保存</button>`;
    const closeEditor = () => {
      editor.remove();
      history.pushState({}, "", "/settings/muted_keywords");
    };
    editor.querySelector('[data-fixture="close-editor"]').addEventListener("click", closeEditor);
    editor.querySelectorAll('[role="checkbox"], [role="radio"]').forEach((control) => {
      control.addEventListener("click", () => control.setAttribute("aria-checked", control.getAttribute("aria-checked") === "true" ? "false" : "true"));
    });
    editor.querySelector('[data-testid="saveMutedWord"]').addEventListener("click", () => {
      const term = editor.querySelector('[data-testid="mutedKeywordTextInput"]').value;
      if (term === "already muted") {
        let alert = editor.querySelector('[role="alert"]');
        if (!alert) {
          alert = document.createElement("p");
          alert.setAttribute("role", "alert");
          editor.appendChild(alert);
        }
        alert.textContent = "This word is already muted";
        return;
      }
      saved.push(term);
      const item = document.createElement("li");
      item.textContent = term;
      document.querySelector('[data-testid="fixture-saved"]').appendChild(item);
      closeEditor();
    });
    host.appendChild(editor);
  });
})();
