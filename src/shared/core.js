export const CATEGORY_META = Object.freeze({
  scam: { label: "诈骗与钓鱼", short: "诈骗", color: "#ff6b52" },
  spam: { label: "垃圾推广", short: "推广", color: "#f6a93b" },
  engagement: { label: "互动诱导", short: "诱导", color: "#d98ef8" },
  crypto: { label: "加密投机", short: "加密", color: "#70a8ff" },
  adult: { label: "成人内容", short: "成人", color: "#f477ad" },
  harassment: { label: "骚扰攻击", short: "骚扰", color: "#fa6f82" },
  politics: { label: "政治争议", short: "政治", color: "#7b8cff" },
  ai_slop: { label: "AI 低质内容", short: "AI 低质", color: "#4ecdc4" },
  custom: { label: "自定义", short: "自定义", color: "#9ba4b5" }
});

const CATEGORY_ALIASES = Object.freeze({
  scam: "scam", "诈骗": "scam", "诈骗与钓鱼": "scam", "钓鱼": "scam",
  spam: "spam", "垃圾推广": "spam", "广告推广": "spam",
  engagement: "engagement", "互动诱导": "engagement", "引流": "engagement",
  crypto: "crypto", "加密": "crypto", "加密投机": "crypto", "币圈": "crypto",
  adult: "adult", "成人": "adult", "成人内容": "adult", "色情": "adult",
  harassment: "harassment", "骚扰": "harassment", "骚扰攻击": "harassment", "仇恨用语": "harassment",
  politics: "politics", "政治": "politics", "政治争议": "politics",
  ai_slop: "ai_slop", "AI 低质": "ai_slop", "AI低质": "ai_slop", "AI 低质内容": "ai_slop",
  custom: "custom", "自定义": "custom", "用户名": "custom", usernames: "custom",
  "常规屏蔽词": "", keywords: ""
});

const invisibleCharsRegex = /\p{Default_Ignorable_Code_Point}/gu;

const RULES = Object.freeze({
  scam: [
    /airdrop/i, /claim\s+(?:now|reward)/i, /connect\s+(?:your\s+)?wallet/i,
    /seed\s*phrase/i, /double\s+your/i, /稳赚|保本|内部消息|带单|资金盘|杀猪盘|刷单|高收益|投资返利|兼职返现/
  ],
  spam: [
    /dm\s+me/i, /link\s+in\s+bio/i, /promo\s*code/i, /limited\s+offer/i,
    /contact\s+me/i, /加微|加v|私聊|代购|返现|优惠券|免费领取|扫码|进群|官方群|客服|飞机群|电报群|telegram|资源自取|主页自取/
  ],
  engagement: [
    /follow\s+(?:me|back|for\s+follow)/i, /f4f/i, /like\s+(?:and|&)?\s*repost/i,
    /drop\s+your/i, /互关|回关|求赞|点赞关注|转发抽奖|评论区见|点我主页|到主页|主页搜索|看置顶|点头像/
  ],
  crypto: [
    /\b(?:bitcoin|btc|ethereum|eth|solana|memecoin|web3|defi|nft)\b/i,
    /币圈|虚拟币|比特币|以太坊|山寨币|合约交易|百倍币|土狗币/
  ],
  adult: [
    /\b(?:nsfw|onlyfans|porn|xxx|nudes?)\b/i,
    /成人内容|成人ai|ai成人|裸照|约[炮p]|色情|成人视频|做爱|破处|固[炮泡]|[炮泡]友|催情|手淫|调教|涩播|騷|骚|sao货|线下资源|同城匹配|找主人|求主人|单男|处男|大秀|福利合集/
  ],
  harassment: [
    /kill\s+yourself/i, /\bkys\b/i, /人身攻击|网暴|去死|废物|垃圾人/
  ],
  politics: [
    /\b(?:maga|democrat|republican|election fraud)\b/i, /政治宣传|选举舞弊|极左|极右/
  ],
  ai_slop: [
    /ai\s+(?:generated|influencer|girl)/i, /made\s+with\s+ai/i,
    /ai生成|ai美女|数字人带货|提示词领取|一键生成/
  ]
});

export function normalizeTerm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(invisibleCharsRegex, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function sanitizeTerm(value) {
  const original = String(value ?? "")
    .normalize("NFKC")
    .replace(invisibleCharsRegex, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!original || original.length > 140) return "";
  return original;
}

export function classifyTerm(term, categoryHint = "") {
  const resolvedHint = resolveCategoryHint(categoryHint);
  if (resolvedHint) {
    return { category: resolvedHint, confidence: 1, reason: "source" };
  }

  const scores = Object.entries(RULES).map(([category, rules]) => ({
    category,
    matches: rules.filter((rule) => rule.test(term)).length
  }));
  scores.sort((a, b) => b.matches - a.matches);
  const winner = scores[0];
  if (!winner || winner.matches === 0) {
    const fallback = fallbackCategoryForLabel(categoryHint);
    if (fallback) return { category: fallback, confidence: 0.62, reason: "source-fallback" };
    return { category: "custom", confidence: 0.45, reason: "fallback" };
  }

  return {
    category: winner.category,
    confidence: Math.min(0.72 + (winner.matches - 1) * 0.12, 0.96),
    reason: "rules"
  };
}

function fallbackCategoryForLabel(value) {
  return /^(?:常规屏蔽词|keywords?)$/i.test(String(value || "").trim()) ? "spam" : "";
}

function unpackJson(value, inheritedCategory = "") {
  if (typeof value === "string") {
    return [{ term: value, categoryHint: inheritedCategory }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => unpackJson(item, inheritedCategory));
  }
  if (!value || typeof value !== "object") return [];

  const term = value.term ?? value.word ?? value.keyword ?? value.text;
  if (typeof term === "string") {
    return [{
      term,
      categoryHint: value.category ?? value.type ?? inheritedCategory,
      kind: value.kind ?? ""
    }];
  }

  const entries = Object.entries(value);
  const routed = entries.filter(([key]) =>
    ["keywords", "words", "items", "data", "usernames"].includes(key) || isCategoryLabel(key)
  );
  return (routed.length ? routed : entries).flatMap(([key, nested]) => {
    if (["version", "name", "description", "updatedAt", "updated_at"].includes(key)) return [];
    const hint = isCategoryLabel(key) ? key : inheritedCategory;
    return unpackJson(nested, hint).map((item) => ({
      ...item,
      kind: key === "usernames" || key === "用户名" ? "username" : item.kind
    }));
  });
}

function resolveCategoryHint(value) {
  const key = String(value || "").trim();
  if (Object.hasOwn(CATEGORY_ALIASES, key)) return CATEGORY_ALIASES[key];
  const lowered = key.toLocaleLowerCase();
  return CATEGORY_META[lowered] ? lowered : "";
}

function isCategoryLabel(value) {
  const key = String(value || "").trim();
  return Object.hasOwn(CATEGORY_ALIASES, key) || Boolean(CATEGORY_META[key.toLocaleLowerCase()]);
}

function parsePlainRows(body) {
  const rows = body.split(/\r?\n/);
  if (rows.length === 1 && rows[0].includes(",")) {
    return rows[0].split(",").map((term) => ({ term, categoryHint: "", kind: "" }));
  }

  const entries = [];
  let categoryHint = "";
  let kind = "";
  for (const row of rows) {
    const cleaned = String(row).normalize("NFKC").replace(invisibleCharsRegex, "").trim();
    if (!cleaned || /^(?:\/\/|;)\s*/.test(cleaned)) continue;
    const header = cleaned.match(/^#\s*\[([^\]]+)\]\s*$/) || cleaned.match(/^#\s*(?:category|分类)\s*:\s*(.+)$/i);
    if (header) {
      categoryHint = header[1].trim();
      kind = /^(?:用户名|usernames?)$/i.test(categoryHint) ? "username" : "";
      continue;
    }
    entries.push({ term: cleaned, categoryHint, kind });
  }
  return entries;
}

function normalizeUsername(term) {
  const handle = String(term).trim().replace(/^[@/]+/, "");
  return /^[a-zA-Z0-9_]{1,15}$/.test(handle) ? `@${handle}` : term;
}

export function parseDictionary(text, contentType = "") {
  const body = String(text ?? "").replace(/^\uFEFF/, "");
  let rawEntries = [];
  const looksJson = contentType.includes("json") || /^[\s]*[\[{]/.test(body);

  if (looksJson) {
    try {
      rawEntries = unpackJson(JSON.parse(body));
    } catch {
      rawEntries = [];
    }
  }

  if (rawEntries.length === 0) {
    rawEntries = parsePlainRows(body);
  }

  const unique = new Map();
  for (const item of rawEntries) {
    const term = sanitizeTerm(item.kind === "username" ? normalizeUsername(item.term) : item.term);
    const normalized = normalizeTerm(term);
    if (!term || !normalized || unique.has(normalized)) continue;
    const classification = classifyTerm(term, item.categoryHint);
    const kind = item.kind || (/^\/.+\/[a-z]*$/i.test(term) ? "regex" : "keyword");
    unique.set(normalized, { term, normalized, kind, ...classification });
  }
  return [...unique.values()];
}

export function mergeDictionary(
  existingEntries,
  incomingBySource,
  now = new Date().toISOString(),
  refreshedSourceIds = incomingBySource.map((item) => item.sourceId)
) {
  const refreshed = new Set(refreshedSourceIds);
  const merged = new Map(
    (existingEntries ?? []).map((entry) => [entry.normalized, {
      ...entry,
      sourceIds: (entry.sourceIds ?? []).filter((sourceId) => !refreshed.has(sourceId)),
      seenInRefresh: false
    }])
  );

  for (const { sourceId, entries } of incomingBySource) {
    for (const incoming of entries) {
      const current = merged.get(incoming.normalized);
      if (current) {
        const sourceIds = new Set(current.sourceIds ?? []);
        sourceIds.add(sourceId);
        merged.set(incoming.normalized, {
          ...current,
          term: current.term || incoming.term,
          category: current.categoryLocked ? current.category : incoming.category,
          confidence: current.categoryLocked ? current.confidence : incoming.confidence,
          sourceIds: [...sourceIds],
          lastSeenAt: now,
          stale: false,
          seenInRefresh: true
        });
      } else {
        merged.set(incoming.normalized, {
          id: stableId(incoming.normalized),
          ...incoming,
          sourceIds: [sourceId],
          enabled: incoming.kind !== "regex" && incoming.confidence >= 0.6,
          status: incoming.kind === "regex" ? "unsupported" : "pending",
          stale: false,
          firstSeenAt: now,
          lastSeenAt: now,
          seenInRefresh: true
        });
      }
    }
  }

  return [...merged.values()]
    .map(({ seenInRefresh, ...entry }) => {
      return {
        ...entry,
        stale: seenInRefresh ? false : (entry.sourceIds ?? []).length === 0 ? true : Boolean(entry.stale)
      };
    })
    .sort((a, b) => a.term.localeCompare(b.term, "zh-CN"));
}

export function buildSyncQueue(entries, knownMuted = []) {
  const known = new Set(knownMuted.map(normalizeTerm));
  return (entries ?? []).filter((entry) =>
    entry.enabled !== false &&
    entry.status !== "ignored" &&
    entry.status !== "unsupported" &&
    !entry.stale &&
    !known.has(normalizeTerm(entry.normalized ?? entry.term))
  );
}

export function buildAutoSyncQueue(entries, knownMuted = [], minConfidence = 0.72) {
  return buildSyncQueue(entries, knownMuted).filter((entry) =>
    entry.categoryLocked || (entry.category !== "custom" && entry.confidence >= minConfidence)
  );
}

export function stableId(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `q_${(hash >>> 0).toString(36)}`;
}

export function sourceOriginPattern(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS dictionary URLs are supported");
  }
  if (parsed.username || parsed.password) throw new Error("Dictionary URLs cannot contain credentials");
  return `${parsed.protocol}//${parsed.host}/*`;
}
