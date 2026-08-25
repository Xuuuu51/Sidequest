---
format: 1920x1080
duration: 58s
message: "不中断当前开发主线，快速记下暂时不做的旁支，稍后让新的 Codex 会话接手"
arc: "PAS with demo-loop proof — hook → pain → product setup → capture → later handoff → agent execution → result → CTA"
audience: "正在使用 Codex 或其他 AI Coding 工具的个人开发者"
mode: collaborative
music: "restrained electronic developer-tool pulse with light interaction accents"
---

## Frame 1 — 别让支线打断主线

- status: built
- src: compositions/frames/01-hook.html
- duration: 6s
- transition_in: cut
- scene: 深色 Codex 任务流在背景持续输出，画面压暗；“现在做会跑偏 / 不记又怕忘”两组文字先后替换，最终锁定标题“别让支线打断主线”。
- voiceover: "写代码做到一半，突然想到一个值得做的优化。现在做会跑偏，不记又怕忘。"
- poster: 5s
- type: hook
- persuasion: Pain validation
- beat: recognition + tension
- blueprint: kinetic-type-beats — two pain clauses swap in place, then resolve on the hook title
- asset_candidates:

narrativeRole: 让使用 AI Coding 工具的开发者立即认出“当前会话不能被新想法带偏”的真实瞬间。
keyMessage: 临时想到的旁支，既不该马上做，也不该丢。

## Frame 2 — 项目收下旁支

- status: built
- src: compositions/frames/02-add-project.html
- duration: 5s
- transition_in: zoom-through
- scene: Sidequest 首次启动界面成为主画面；选择 Sidequest 项目文件夹后，看板就位，角落短暂出现“项目级 TODO”标签。
- voiceover: "把项目加入 Sidequest，旁支就有了一个属于项目的位置。"
- poster: 4s
- type: product_intro
- persuasion: Friction reduction
- beat: relief + clarity
- blueprint: device-surface-showcase — introduce the product by completing its short setup loop inside the real interface
- asset_candidates: assets/brand/sidequest-icon.png — square Sidequest product icon for restrained identity support

narrativeRole: 在第二拍给出承诺：Sidequest 是项目内承接暂不处理想法的位置，而不是另一个聊天窗口。
keyMessage: 想法跟着项目保存，稍后仍能被找到。

## Frame 3 — 主线仍在运行

- status: built
- src: compositions/frames/03-main-quest.html
- duration: 5s
- transition_in: crossfade
- scene: Codex 正在执行“给 Quest 搜索增加键盘导航”，输出和进度保持真实节奏；屏幕标签“MAIN QUEST IN PROGRESS”固定在边缘。
- voiceover: "Codex 正在给 Quest 搜索增加键盘导航。这是现在的主线。"
- poster: 4s
- type: feature_showcase
- persuasion: Context anchoring
- beat: focus + control
- blueprint: agent-progress-theater — the current agent visibly works while the task title stays anchored
- asset_candidates:

narrativeRole: 明确旁支出现时主任务仍在执行，建立“不适合现在直接告诉 Codex”的前提。
keyMessage: 当前会话有清晰范围，新增优化会扩大任务。

## Frame 4 — 快速记下，不打断

- status: built
- src: compositions/frames/04-quick-capture.html
- duration: 9s
- transition_in: crossfade
- scene: Codex 输出不停；按下 ⌘⇧Space，Quick Capture 覆盖出现。输入“搜索没有结果时，显示搜索词，并提供清除搜索按钮。”并提交，覆盖层立即退场，原会话仍在继续。
- voiceover: "又想到搜索无结果时，应该显示搜索词和清除按钮。按下快捷键，记下来，继续当前会话。"
- poster: 7s
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: ease + control
- blueprint: cursor-ui-demo — one end-to-end shortcut, type, submit, return-to-work workflow on the real surface
- asset_candidates:

narrativeRole: 展示 Sidequest 的核心动作：在不等待当前 Agent 完成、不扩大会话范围的情况下捕获旁支。
keyMessage: ⌘⇧Space 把额外想法留给以后，主线不暂停。

## Frame 5 — 稍后，准备接手

- status: built
- src: compositions/frames/05-ready-later.html
- duration: 6s
- transition_in: blur-crossfade
- scene: “稍后”作为安静的时间卡一闪而过；Sidequest 看板接续出现，刚才的卡片从“待整理”拖到“就绪”。
- voiceover: "以后，准备处理时，把它从待整理移到就绪。"
- poster: 5s
- type: feature_showcase
- persuasion: Progressive commitment
- beat: calm + readiness
- blueprint: cursor-ui-demo — one deliberate drag changes the Quest's lifecycle state
- asset_candidates:

narrativeRole: 把“立即记录”与“真正开始处理”分开，证明 Sidequest 支持延迟决策而非自动执行。
keyMessage: Ready 是以后交给 Agent 的明确入口。

## Frame 6 — 新会话找到它

- status: built
- src: compositions/frames/06-codex-handoff.html
- duration: 7s
- transition_in: zoom-through
- scene: 新 Codex 会话中，自然语言提示逐段输入：“看看这个项目有哪些 Ready 的 Sidequest，接手搜索无结果状态那条。实现并验证后，把它标记为完成。”提交后出现标签“Codex Skill + sq CLI”。
- voiceover: "新的会话里，只要让 Codex 查看 Ready 的 Sidequest，接手这条任务。"
- poster: 6s
- type: feature_showcase
- persuasion: Capability demonstration
- beat: confidence + anticipation
- blueprint: prompt-type-submit-generate — a natural-language handoff types into a fresh Codex composer and submits
- asset_candidates:

narrativeRole: 证明项目里的 Quest 能被未来的新 Agent 会话共享，不依赖原会话记忆。
keyMessage: 新会话通过 Skill 和 sq CLI 找到 Ready Quest。

## Frame 7 — 实现、验证、更新

- status: built
- src: compositions/frames/07-agent-proof.html
- duration: 7s
- transition_in: crossfade
- scene: Codex 工作记录纵向推进：读取 Quest、修改空状态、运行测试；最后“Tests passed”与“Quest → Done”两条收据依次勾选。
- voiceover: "它找到 Quest，完成实现和验证，再把状态更新为完成。"
- poster: 6s
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: trust + momentum
- blueprint: transcript-scroll-artifact-reveal — traverse the real agent transcript, then land on tests and status receipts
- asset_candidates:

narrativeRole: 用可验证的工作证据兑现“Agent 稍后接手”，避免只展示一个完成标签。
keyMessage: 找到、实现、验证、更新状态构成完整闭环。

## Frame 8 — 旁支真正落地

- status: built
- src: compositions/frames/08-result.html
- duration: 7s
- transition_in: push-slide LEFT
- scene: 左侧 Sidequest 卡片进入“已完成”；右侧真实搜索界面查询不存在的词，空状态显示搜索词与“清除搜索”，点击后看板恢复。两块证据在同一画面汇合。
- voiceover: "测试通过，卡片进入已完成。新的空状态显示搜索词，也能一键清除。"
- poster: 6s
- type: benefit_highlight
- persuasion: Outcome proof
- beat: triumph + closure
- blueprint: comparison-split — lifecycle completion and shipped product behavior hold side by side as equal proof
- asset_candidates:

narrativeRole: 同时给出任务管理结果与产品结果，证明 Quest 不是一张脱离实现的 TODO 卡。
keyMessage: 旁支已经变成经过验证、可操作的真实改进。

## Frame 9 — 继续你的主线

- status: built
- src: compositions/frames/09-cta.html
- duration: 6s
- transition_in: blur-crossfade
- scene: UI 元素向四周清场，Sidequest 标志落位；主张、网址与“下载 macOS 版 →”依次出现，最后停留两秒。
- voiceover: "把旁支留在项目里，继续你的主线。"
- poster: 5s
- type: cta
- persuasion: Identity close + direct response
- beat: peace of mind + motivation
- blueprint: logo-assemble-lockup — product surfaces clear into the brand mark, then resolve on URL and download action
- asset_candidates: assets/brand/sidequest-mark.png — transparent Sidequest mark for the closing lockup; assets/brand/sidequest-icon.png — product icon for the macOS download CTA

narrativeRole: 把完整闭环收束为一句可记忆的品牌主张，并给出明确下载入口。
keyMessage: 把旁支留在 Sidequest，继续当前开发主线。
