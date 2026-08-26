# Contributing to QuietSync

Thanks for helping make X content controls safer and easier to use.

## Before opening an issue

- Search existing issues first.
- Do not attach exported QuietSync backups, X cookies, browser profiles, passwords, tokens, private source URLs, or personal mute terms.
- If a screenshot is necessary, redact account identity, custom terms, browser tabs, and system paths.
- Report security issues through GitHub private vulnerability reporting as described in `SECURITY.md`.

## Development

QuietSync is a dependency-free Manifest V3 extension. Node.js is used only for checks and tests.

```bash
npm run check
```

Load the repository directory through Chrome or Edge's **Load unpacked** flow for manual testing. Use a test X account and a small group of harmless temporary words.

## Pull requests

1. Keep permissions least-privilege. New fixed or optional permissions require a clear user-facing reason.
2. Treat remote dictionaries as untrusted data. Never evaluate remote code or render remote strings with `innerHTML`.
3. Preserve Add-only behavior unless a separate, explicit opt-in removal design is reviewed.
4. Add or update tests for parser, normalization, queue, and security-boundary changes.
5. Update `CHANGELOG.md`, `PRIVACY.md`, or `THIRD_PARTY_NOTICES.md` when behavior or provenance changes.
