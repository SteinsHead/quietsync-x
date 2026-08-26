# Chrome Web Store reviewer notes

QuietSync has no test account, paid feature, server component, or hidden setup step. An ordinary X account is needed only to verify the final form-filling step on X's Muted words settings page.

## Basic review without an X account

1. Install the extension and open its toolbar popup.
2. Click **打开审核台**.
3. The dashboard opens with synthetic preview terms. They do not contain real account or user data.
4. Open **订阅来源** to inspect source management and **同步设置** to inspect the available X mute options.
5. No data is sent to the developer. The dashboard works without a QuietSync account because no such account exists.

## End-to-end review with an X account

1. Sign in to X in the same browser profile.
2. In QuietSync, open **订阅来源** and add an HTTPS TXT file containing one harmless test term on its own line. Grant access to that source origin when Chrome asks.
3. Refresh the source, return to **屏蔽词库**, select the test term, and choose **同步到 X**.
4. QuietSync opens `https://x.com/settings/muted_keywords` and uses the visible Add / Save form.
5. The progress panel reports whether the term was saved, already existed, or failed. The reviewer may remove the harmless test term normally in X afterward.

## Scope and safety details

- The content script matches only X's `/settings/muted_keywords` route.
- Automatic syncing is disabled by default.
- The default policy is add-only. QuietSync does not automatically unmute terms removed from a remote list.
- Dictionary fetches omit credentials and referrer information.
- Remote responses are parsed as TXT or JSON data and are never executed.
- There are no analytics, ads, telemetry, obfuscated scripts, or remotely hosted executable files.

Source and privacy documentation:
https://github.com/SteinsHead/quietsync-x

