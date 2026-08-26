# Security policy

## Design boundaries

- Remote dictionaries are treated as untrusted text or JSON data, never executable code.
- Responses are capped at 2 MB and 10,000 valid entries per source.
- Terms are normalized, stripped of control and invisible characters, and limited to 140 characters.
- UI rendering uses `textContent` for remote terms and source metadata.
- Optional host permission is requested per dictionary origin.
- Remote dictionaries must use HTTPS; URLs containing embedded credentials are rejected.
- Dictionary fetches omit cookies, HTTP authentication credentials, and referrer information.
- The content script is limited to X's Muted words settings route.
- Native X sync is add-only. QuietSync never bulk-unmutes terms.
- Regex entries are explicitly excluded because X native Muted words does not implement regex semantics.
- Automatic sync excludes low-confidence and unreviewed custom classifications.

## Reporting a vulnerability

Use GitHub private vulnerability reporting. Include the extension version, browser version, reproduction steps, and whether the issue requires a malicious dictionary source or a changed X page.

Do not include X cookies, passwords, exported browser profiles, or other account secrets in a report.
