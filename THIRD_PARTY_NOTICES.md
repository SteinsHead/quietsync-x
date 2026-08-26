# Third-party notices and acknowledgements

QuietSync has no runtime package dependencies and does not bundle third-party source code. Its implementation is original to this repository.

## Optional remote dictionary

The source catalog offers an opt-in link to the public keyword list maintained by [amahteru/x-comment-blocker](https://github.com/amahteru/x-comment-blocker), which is published under the [MIT License](https://github.com/amahteru/x-comment-blocker/blob/main/LICENSE).

QuietSync does not redistribute that list. When a user chooses **一键订阅**, the extension requests permission for `raw.githubusercontent.com` and fetches the current list directly from its maintainer's repository. The list remains subject to its upstream project and license.

## Research and prior art

The following public projects informed the ecosystem review, product boundaries, or browser-automation research. No code from them is included in QuietSync:

- [nirholas/XActions](https://github.com/nirholas/XActions) — public X automation toolkit, Apache-2.0.
- [IanColdwater bulk muted-words Gist](https://gist.github.com/IanColdwater/88b3341a7c4c0cf71c73ac56f9bd36ec) — early duplicate-aware browser workflow reference.
- [sogud/x-muted-words](https://github.com/sogud/x-muted-words) — local-first categorized word-pack synchronization, MIT.
- [watermelon-ping/x-muted-keyword-sync](https://github.com/watermelon-ping/x-muted-keyword-sync) — local keyword list synchronization.
- [fyzanshaik/x-mute-helper](https://github.com/fyzanshaik/x-mute-helper) — CSV-to-X workflow.
- [cvarrasi/better-muted-words-twitter-extension](https://github.com/cvarrasi/better-muted-words-twitter-extension) — batch-add UI and presets.
- [Azoroh/x-mute-manager](https://github.com/Azoroh/x-mute-manager) — Playwright-based local list synchronization.

## Product behavior reference

Muted-word behavior and limitations are documented by the [X Help Center](https://help.x.com/en/using-x/advanced-x-mute-options).

## Brand asset provenance

The original QuietSync raster mark in `assets/icons/quietsync-mark.png` was generated specifically for this project using OpenAI's image generation tool, then reviewed and resized locally for the extension icon set. It does not reproduce a third-party logo. Product screenshots were captured from QuietSync's local preview mode and contain synthetic demo data only.
