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

  document.querySelector('[data-testid="addMutedWord"]').addEventListener("click", () => {
    const host = document.getElementById("editorHost");
    if (host.firstChild) return;
    const editor = document.createElement("section");
    editor.id = "editor";
    editor.innerHTML = `
      <input name="keyword" aria-label="Word or phrase">
      <label>Home timeline <span role="checkbox" aria-checked="true"></span></label>
      <label>Notifications <span role="checkbox" aria-checked="true"></span></label>
      <label>From anyone <span role="radio" aria-checked="true"></span></label>
      <label>Forever <span role="radio" aria-checked="true"></span></label>
      <button data-testid="settingsSave">Save</button>`;
    editor.querySelectorAll('[role="checkbox"], [role="radio"]').forEach((control) => {
      control.addEventListener("click", () => control.setAttribute("aria-checked", control.getAttribute("aria-checked") === "true" ? "false" : "true"));
    });
    editor.querySelector('[data-testid="settingsSave"]').addEventListener("click", () => {
      const term = editor.querySelector('input[name="keyword"]').value;
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
      editor.remove();
    });
    host.appendChild(editor);
  });
})();
