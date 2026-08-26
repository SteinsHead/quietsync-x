# QuietSync Privacy

QuietSync is local-first. It has no account system, analytics SDK, telemetry endpoint, advertising code, or remote-code loader.

## Data stored locally

The extension stores these items in `chrome.storage.local`:

- dictionary source URLs and source health metadata;
- parsed mute terms, categories, review choices, and source attribution;
- refresh and sync settings;
- normalized terms that QuietSync successfully wrote or found already present;
- recent error and progress state needed for safe retry.

This data stays in the local Chrome profile unless the user explicitly exports a backup. A full backup contains source URLs, mute terms, categories, errors, and sync history; treat it as sensitive and redact it before sharing.

## Network requests

QuietSync makes outbound requests only to:

1. dictionary URLs explicitly added or subscribed to by the user; and
2. `x.com` / `twitter.com` through their normal visible web interface during a user-requested or explicitly enabled automatic sync.

Adding a remote source requests access only to that HTTPS origin. Dictionary fetches explicitly omit credentials and referrer information. The remote server still receives a normal HTTPS request and may observe connection metadata such as IP address and user agent. QuietSync does not attach X account data, browsing history, custom terms, or sync results to dictionary requests.

## X access

QuietSync does not read browser cookies or passwords and does not call a private X API. Its content script is injected only on X's Muted words settings route and uses the visible form. It reads and changes only the controls needed to add reviewed words.

Because QuietSync parses user-chosen dictionary responses and operates the visible X settings form, Chrome Web Store disclosures classify this locally handled information as website content. QuietSync does not collect browsing history or monitor activity on other pages.

## Chrome Web Store Limited Use

QuietSync uses handled information only to provide or improve its single purpose: reviewing mute-list data locally and syncing terms approved by the user to X's native Muted words. It does not sell user data, use it for advertising or credit decisions, transfer it for an unrelated purpose, or allow the developer or other people to read it.

## Removal

Removing the extension through Chrome removes its local extension storage. Export a backup first if the data should be retained.
