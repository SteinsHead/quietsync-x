<p align="center">
  <img src="assets/icons/icon-128.png" width="112" height="112" alt="QuietSync logo">
</p>

<h1 align="center">QuietSync for X</h1>

<p align="center"><strong>把远程词库变成真正跟随 X 账户的安静层。</strong></p>

<p align="center">
  <a href="https://github.com/SteinsHead/quietsync-x/actions/workflows/ci.yml"><img src="https://github.com/SteinsHead/quietsync-x/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/SteinsHead/quietsync-x/releases"><img src="https://img.shields.io/github/v/release/SteinsHead/quietsync-x?display_name=tag" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-6ff2a6" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-b5a8ff" alt="Manifest V3">
</p>

QuietSync 是一个 local-first 的 Chrome / Edge 扩展。它定时拉取你订阅的远程屏蔽词库，在浏览器本地完成清洗、去重、分类和审核，再通过 X 的可见网页界面把新增词逐条写入原生 **Muted words**。

它不是仅在当前浏览器隐藏 DOM 的过滤器。成功写入后，屏蔽词属于你的 X 账户，因此会同步影响手机、平板与其他电脑上的 Home timeline 和 Notifications。

> QuietSync 与 X Corp. 无关联，也不是 X 官方产品。X 官方说明 Muted words 不会过滤搜索结果。

## 产品界面

![QuietSync 屏蔽词库审核台](docs/images/dashboard-library.png)

<table>
  <tr>
    <td width="50%"><img src="docs/images/dashboard-sources.png" alt="QuietSync 订阅来源界面"></td>
    <td width="50%"><img src="docs/images/dashboard-settings.png" alt="QuietSync 同步设置界面"></td>
  </tr>
  <tr>
    <td align="center">按来源授权、拉取和缓存远程词库</td>
    <td align="center">控制自动化阈值、X 原生范围与备份</td>
  </tr>
</table>

截图来自项目内置的本地预览数据，不含真实账号、私人词条、浏览记录或访问令牌。

## 核心能力

- 支持远程 TXT、JSON 数组、对象数组和按分类分组的 JSON
- 每 1 小时至每周自动拉取，也可手动刷新
- Unicode 归一化、大小写无关去重、多来源合并
- 自动清理常用于绕过匹配的不可见字符
- 识别 `# [分类]` 社区词库；用户名组自动转换为 `@handle`
- 本地规则分类：诈骗、推广、互动诱导、加密、成人、骚扰、政治、AI 低质和自定义
- 支持逐词复核分类、启用、停用和忽略
- Add-only 增量同步：不会因为远程词库删词就自动解除屏蔽
- 写入前预览，一键 Add → Save，提供进度、取消、重试、随机限速和中断恢复
- 可选自动写入；默认关闭，并通过置信度门槛排除高风险条目
- 正则条目会留在审核台，但不会错误写入不支持正则的 X 原生设置
- JSON 完整备份与 TXT 词表导出

## 安装

### 从 Release 安装

1. 打开 [Releases](https://github.com/SteinsHead/quietsync-x/releases) 并下载最新的 `quietsync-x-*.zip`。
2. 解压到一个固定目录。
3. 打开 `chrome://extensions/` 或 `edge://extensions/`。
4. 开启「开发者模式」，点击「加载已解压的扩展程序」。
5. 选择包含 `manifest.json` 的 QuietSync 目录。

### 从源码安装

```bash
git clone https://github.com/SteinsHead/quietsync-x.git
cd quietsync-x
npm test
```

随后按上面的开发者模式步骤加载仓库目录。本项目没有运行时构建依赖，浏览器直接加载源码。

## 使用流程

1. 点击扩展图标，打开「审核台」。
2. 在「订阅来源」一键订阅社区词库，或添加自己的 GitHub Raw / HTTPS 静态 URL。
3. 点击「拉取词库」，检查自动分类、置信度和不支持项。
4. 按需修改分类、关闭误伤条目或使用筛选器批量审核。
5. 点击「同步到 X」，确认新增词和预计时间。
6. QuietSync 打开 `x.com/settings/muted_keywords`，通过可见表单逐条保存。

首次建议只同步 20–50 个词，确认 X 当前网页结构和账号设置正常后再扩大范围。

## 词库格式

最简单的 TXT 是每行一个词：

```text
follow me for follow back
connect your wallet
#giveaway
加微领取
```

带分类的社区 TXT：

```text
# [仇恨用语]
example phrase

# [用户名]
spam_bot
```

用户名会转换为 `@spam_bot`。形如 `/pattern/i` 的正则会标记为「X 不支持」，不会被当作普通文本写入。

JSON 可以是字符串数组，也可以直接分组：

```json
{
  "scam": ["connect wallet", "claim airdrop"],
  "spam": ["dm me", "加微领取"],
  "ai_slop": ["AI美女", "made with AI"]
}
```

分类键：`scam`、`spam`、`engagement`、`crypto`、`adult`、`harassment`、`politics`、`ai_slop`、`custom`。

## 隐私与安全

QuietSync 没有账号系统、广告、分析 SDK、遥测或远程代码加载器。

- 本地状态只存储在 `chrome.storage.local`
- 远程来源仅接受 HTTPS，按来源域名单独请求可选权限
- 词库请求使用 `credentials: omit` 与 `referrerPolicy: no-referrer`
- 内容脚本只注入 X 的 Muted words 设置页
- 不读取 Cookie、密码或浏览器历史，不调用 X 私有 API
- 远程响应上限为 2 MB / 10,000 个有效词条，并始终按不可信文本解析
- 完整 JSON 备份包含私人词条、来源 URL 和错误记录，属于敏感文件，请勿直接上传到公开 Issue

远程词库服务器仍然可以看到正常 HTTPS 连接所必需的 IP 地址和 User-Agent。完整边界见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

## 已知限制

- X 的网页 DOM 会变化，选择器失效时同步会停止并保留已完成部分
- X 原生 Muted words 不过滤搜索结果
- 首次同步大词库需要逐条写入，可能耗时较长
- QuietSync 目前面向 Chromium 桌面浏览器，尚未发布到浏览器商店
- 自动分类是透明的本地规则，不是语义模型；低置信度结果应人工检查

## 致谢与来源

QuietSync 的实现是独立完成的，没有复制下列项目的源代码；它们提供了词库、产品思路或同类项目经验，值得明确感谢：

- [amahteru/x-comment-blocker](https://github.com/amahteru/x-comment-blocker)：可选的一键订阅公共词库来源；项目采用 MIT License。
- [nirholas/XActions](https://github.com/nirholas/XActions)：X 网页端批量自动化方案的公开先例与早期调研来源。
- [IanColdwater 的批量 Muted words Gist](https://gist.github.com/IanColdwater/88b3341a7c4c0cf71c73ac56f9bd36ec)：跳过重复项并逐条填写的早期公开实践。
- [sogud/x-muted-words](https://github.com/sogud/x-muted-words)、[watermelon-ping/x-muted-keyword-sync](https://github.com/watermelon-ping/x-muted-keyword-sync)、[fyzanshaik/x-mute-helper](https://github.com/fyzanshaik/x-mute-helper)、[cvarrasi/better-muted-words-twitter-extension](https://github.com/cvarrasi/better-muted-words-twitter-extension) 与 [Azoroh/x-mute-manager](https://github.com/Azoroh/x-mute-manager)：同类项目与生态参考。
- [X Help Center — Advanced muting options](https://help.x.com/en/using-x/advanced-x-mute-options)：原生 Muted words 行为说明。

详细的来源边界与许可证说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。感谢这些维护者让 X 的内容控制体验不断变好。

## 开发

```bash
npm test
npm run check
```

`tests/fixtures/settings/muted_keywords.html` 是本地 X UI 模拟页，用于验证完整的 Add → Save、重复跳过和进度上报链路。

欢迎阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 后提交 Issue 或 Pull Request。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要在公开 Issue 中附带账号信息或完整备份。

## License

[MIT](LICENSE) © 2026 QuietSync contributors
