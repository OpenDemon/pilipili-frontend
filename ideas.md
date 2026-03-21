# 噼哩噼哩 Pilipili-AutoVideo 设计方案

## 设计方案一：暗黑工作站风格
<response>
<idea>
**Design Movement**: 专业创作工具美学（Figma / Linear / Vercel Dashboard 风格）

**Core Principles**:
- 深色背景为主，信息密度高但不拥挤
- 强调功能性与专业感，减少装饰性元素
- 三栏布局清晰分工，每一栏有明确的视觉权重

**Color Philosophy**:
- 背景：深灰 #0F0F0F / #1A1A1A
- 主色调：电光蓝 oklch(0.65 0.2 250)，代表科技与精准
- 强调色：琥珀橙 oklch(0.75 0.18 70)，用于进度和状态
- 文字：冷白 oklch(0.92 0 0)

**Layout Paradigm**:
- 左侧固定导航栏（64px），图标 + tooltip
- 中间主区域（flex-1），自然语言对话 + 分镜卡片
- 右侧 Agent Console（320px），可折叠

**Signature Elements**:
- 代码终端风格的 Agent Console（等宽字体，绿色日志）
- 分镜卡片：图片预览 + 可编辑文本框的组合
- 进度条：细线风格，带脉冲动画

**Interaction Philosophy**:
- 所有操作有即时反馈
- 审核关卡：全屏模态框，强制用户注意
- 悬停时显示操作按钮

**Animation**:
- 消息流入：从底部滑入
- Agent 状态：打字机效果
- 进度更新：平滑数字滚动

**Typography System**:
- 标题：JetBrains Mono（等宽，科技感）
- 正文：Inter（清晰易读）
- 代码/日志：JetBrains Mono
</idea>
<text>暗黑工作站风格，专业创作工具美学</text>
<probability>0.08</probability>
</response>

## 设计方案二：温暖创意工作室风格
<response>
<idea>
**Design Movement**: 创意工作室美学（Notion / Bear / Craft 风格）

**Core Principles**:
- 浅色背景，温暖而专注
- 强调内容本身，界面退到背景
- 手工感与精致感并存

**Color Philosophy**:
- 背景：暖白 oklch(0.98 0.005 80)
- 主色调：深靛蓝 oklch(0.35 0.15 260)
- 强调色：珊瑚红 oklch(0.65 0.18 30)
- 分镜卡片：淡米色背景

**Layout Paradigm**:
- 左侧宽导航（220px），带项目列表
- 中间内容区，卡片式分镜布局
- 右侧面板，Agent 状态 + 资产预览

**Signature Elements**:
- 分镜卡片：圆角大卡片，图片占主导
- 对话气泡：区分用户/AI 的视觉风格
- 状态徽章：彩色小圆点

**Interaction Philosophy**:
- 拖拽排序分镜
- 点击卡片内联编辑
- 平滑过渡动画

**Animation**:
- 卡片出现：淡入 + 轻微上移
- 加载状态：骨架屏
- 审核关卡：侧边抽屉

**Typography System**:
- 标题：Playfair Display（优雅衬线）
- 正文：Source Han Sans（中文优化）
- 代码：Fira Code
</idea>
<text>温暖创意工作室风格，内容优先</text>
<probability>0.07</probability>
</response>

## 设计方案三：极简未来主义风格（选定）
<response>
<idea>
**Design Movement**: 极简未来主义（Manus / Perplexity / Arc Browser 风格）

**Core Principles**:
- 深色背景 + 极细边框，营造沉浸感
- 信息层级清晰：主操作 > 状态反馈 > 历史记录
- 三栏布局，每栏有独立的视觉语言

**Color Philosophy**:
- 背景：近黑 oklch(0.12 0.008 260)
- 侧边栏：略亮 oklch(0.16 0.008 260)
- 主色调：亮紫蓝 oklch(0.68 0.22 270)，用于主要操作
- 强调色：翠绿 oklch(0.72 0.18 160)，用于成功/完成状态
- 警告色：琥珀 oklch(0.78 0.16 75)，用于审核等待
- 文字：冷白 oklch(0.94 0.005 260)

**Layout Paradigm**:
- 左侧固定导航（72px），纯图标，悬停展开
- 中间主区域（flex-1），顶部工具栏 + 对话区 + 底部输入框
- 右侧 Agent Console（340px），可折叠，独立滚动

**Signature Elements**:
- 分镜审核卡片：横向滚动的卡片列表，每张卡片含图片预览 + 编辑区
- Agent Console：终端风格，带时间戳和状态图标
- 进度指示器：细线 + 脉冲点，显示当前阶段

**Interaction Philosophy**:
- 审核关卡：内联展开，不打断对话流
- 所有 API 调用有实时进度反馈
- 错误状态有清晰的重试入口

**Animation**:
- 消息流入：从底部滑入 + 淡入
- Agent 日志：逐行出现，打字机效果
- 卡片展开：高度动画
- 进度更新：平滑过渡

**Typography System**:
- 标题/Logo：Space Grotesk（现代几何无衬线）
- 正文/UI：Geist（清晰，Vercel 出品）
- 代码/日志：Geist Mono
- 中文：系统字体栈（-apple-system, "PingFang SC"）
</idea>
<text>极简未来主义风格，深色沉浸感，三栏 Manus 范式</text>
<probability>0.09</probability>
</response>

---

## 选定方案：极简未来主义（方案三）

选择理由：
1. 与 Manus 的交互范式最接近，用户有认知基础
2. 深色背景适合长时间创作工作，减少视觉疲劳
3. 三栏布局完美匹配"导航 + 对话 + Agent Console"的功能分工
4. Space Grotesk + Geist 的字体组合既现代又专业
