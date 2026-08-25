---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "不中断当前开发主线，快速记下暂时不做的旁支，稍后让新的 Codex 会话接手"
destination: website-and-social
aspect: 1920x1080
language: zh-CN
audience: "正在使用 Codex 或其他 AI Coding 工具的个人开发者"
length: "55-58s master; 30s cutdown"
angle: capture-now-agent-later
narration: yes
vo_mode: restructured
style_preset: code-editorial
---

## Intent

为 Sidequest 制作一支真实、克制的产品宣传片。核心场景是：Codex 正在执行当前主任务时，开发者突然想到一个值得做、但不该现在处理的优化；立即追加会扩大当前会话范围，等会话结束又可能忘记。开发者用全局快速记录把旁支保存为项目内 Quest，继续主线；以后再把 Quest 移至就绪，并在新的 Codex 会话中通过自然语言让 Agent 找到、实现、验证并标记完成。

视觉气质为 70% 深色开发者工具发布片、30% Apple 式克制感。中文界面、中文旁白、逐字字幕和少量操作标签。先完成 16:9 母版，再为 9:16 竖版做局部重构，并从母版裁出约 30 秒传播版。

## Assets

- `../../docs/desktop/design-system.md` — Sidequest Desktop 的品牌、色彩、字体、密度与动效基线。
- `../../apps/desktop/src-tauri/icons/brand/SidequestMark@2x.png` — 结尾品牌标记。
- `../../website/public/sidequest-icon.png` — 官网 CTA 可用的产品图标。
- `../../assets/readme/hero-zh-cn-dark.svg` — 中文深色品牌文案参考，不替代真实产品画面。
- 真实 Sidequest Desktop 与 Codex 操作画面 — Storyboard 通过后，在独立演示环境中录制或重构。

## Customizations

- Storyboard 与关键布局先在 live board 审稿；通过后自动推进首版成片。
- 真实产品画面是主角，不抓取官网作为主体素材；官网只用于结尾 CTA。
- 完整中文字幕；`⌘⇧Space`、`稍后`、`Codex Skill + sq CLI` 使用独立操作标签。
- 克制的轻电子音乐，以及快捷键、Quest 提交、拖拽落位、状态完成等轻微操作音效。
- 横版构图保留竖版安全区；竖版对 Quick Capture、Quest 卡片和 Codex 提示单独重构，不做机械中央裁切。

## Notes

- 开场标题：`别让支线打断主线`。
- 当前主任务：Codex 正在“给 Quest 搜索增加键盘导航”。
- 捕获的旁支 Quest：`搜索没有结果时，显示搜索词，并提供清除搜索按钮。`
- 时间转场：`稍后`。
- 新 Codex 会话提示词：`看看这个项目有哪些 Ready 的 Sidequest，接手搜索无结果状态那条。实现并验证后，把它标记为完成。`
- 证据链必须同时出现：测试通过、Quest 自动同步至已完成、实际操作新的搜索无结果界面与清除搜索按钮。
- 结尾文案：`把旁支留在项目里，继续你的主线。`
- CTA：`sidequest.xuzhang3371.chatgpt.site/zh`，按钮文案 `下载 macOS 版 →`。
- 不展示 Skill 安装流程和底层 CLI 命令；只用一行标签说明 `Codex Skill + sq CLI`。
- 不暗示 Sidequest 自动执行 Quest、自动识别当前项目、自动执行 Git 操作或提供团队云协作。
- Codex 执行使用真实但提前预演的流程；录制在 `codex/sidequest-promo-video` 分支与隔离的演示数据中进行。
- 用户将按最终逐字稿录制本人干声旁白；在旁白到达前可用临时音轨做节奏占位。
