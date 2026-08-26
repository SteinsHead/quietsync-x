setTimeout(() => {
  globalThis.__quietSyncFixture.listener({
    type: "QUIETSYNC_RUN",
    words: [
      { id: "one", term: "dm me", normalized: "dm me" },
      { id: "two", term: "already muted", normalized: "already muted" },
      { id: "three", term: "加微领取", normalized: "加微领取" }
    ],
    options: {
      homeTimeline: true,
      notifications: true,
      muteFrom: "everyone",
      duration: "forever",
      actionDelay: 10
    }
  }, {}, () => {});
}, 50);
