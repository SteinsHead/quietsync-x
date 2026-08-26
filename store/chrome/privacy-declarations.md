# Chrome Web Store 隐私与权限填写参考

这份文件是给发布者填写 Chrome Web Store「Privacy」页面时看的，不会打进扩展安装包。

## Single purpose

QuietSync has one purpose: it lets a user review remote mute lists locally and sync approved terms to X's native Muted words.

## 权限说明

### `storage`

Stores the user's dictionary sources, parsed terms, review choices, sync preferences, and recent sync state locally in the browser. QuietSync has no account or telemetry service.

### `alarms`

Schedules refreshes for dictionary sources at the interval chosen by the user. Automatic syncing is disabled by default.

### `https://x.com/*` and `https://twitter.com/*`

Allows QuietSync to open and operate the visible Muted words settings form after the user starts or explicitly enables a sync. The content script is limited to the `/settings/muted_keywords` route. It does not read cookies, passwords, direct messages, the timeline, or browsing history, and does not use a private X API.

### Optional `https://*/*`

Remote dictionaries can be hosted on different HTTPS origins. QuietSync requests access only to the origin of a source the user chooses to add. Fetches omit credentials and referrer information. No remote code is downloaded or executed; responses are parsed only as plain-text or JSON mute-list data.

## Remote code

No. All executable JavaScript and CSS is included in the submitted package. Remote responses are treated only as data and are never evaluated as code.

## Data handling

QuietSync does not sell, share, or transmit user data to the developer or to advertising, analytics, or telemetry services. It stores user-provided source URLs, mute terms, classifications, preferences, and sync state locally in `chrome.storage.local`.

At the user's request, it sends ordinary credential-free HTTPS requests to dictionary sources selected by that user. A source host can observe standard connection metadata such as IP address and user agent. During a user-requested sync, approved terms are entered into X's visible Muted words form and therefore become part of the user's X account settings.

## Privacy policy URL

https://github.com/SteinsHead/quietsync-x/blob/main/PRIVACY.md

## Homepage / support URL

https://github.com/SteinsHead/quietsync-x

