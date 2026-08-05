# Kuku Coffee 七屏切片：售货机前端完整开发文档

> 文档版本：1.1（Greenfield 修订版）  
> 编写日期：2026-07-26  
> 项目性质：完全新建的 greenfield 前端，不基于或复用任何现有项目  
> 建议新项目目录：`/Users/cj/polyugdut/kuku-vending-frontend`（目录名可在启动前调整）  
> 目标终端：竖屏触控咖啡售货机 / kiosk  
> 推荐基准视口：1080 × 1920（CSS 逻辑尺寸可使用 540 × 960）  
> 输入切片：`k1.png` → `k7.png`，严格按用户提供顺序实现  
> 文档用途：产品规格、视觉还原、前端架构、动画规范、硬件集成边界、稳定性要求、测试验收与多 Agent 分工

---

## 0. 交付目标

本项目要开发一个可长期运行在咖啡售货机上的竖屏触控前端。用户从欢迎页进入，依次了解品牌公益信息、选择饮品、完成定制、确认订单、等待机器制作并取杯。

最终交付不应只是七张静态页面的复刻，而应是一个具备以下能力的可靠 kiosk 应用：

- 严格还原七张切片的视觉层级、文案、色彩、间距与品牌气质。
- 用明确状态机管理完整购买流程，禁止依赖散落的布尔值和临时定时器拼接流程。
- 页面间转场流畅、连续、可中断，避免白屏、跳动、布局重排和重复点击。
- Kuku mascot 在全流程中是持续存在的互动角色，后续可从静态图平滑升级为 Rive、Lottie、Spine 或 Web 原生分层动画。
- 机器、网络、摄像头或互动服务异常时，点单主流程仍可安全运行或进入明确的维护状态。
- 支持长时间无人值守运行、自动复位、资源回收、故障恢复和离线启动。
- 具备自动化测试、视觉回归、硬件事件模拟、长稳测试与可观测性。

### 0.1 本文档中的已确认流程

七张图片按用户提供的顺序解释为：

```text
k1 欢迎
  → k2 品牌公益 / 第二欢迎屏
  → k3 选择饮品（步骤 1）
  → k4 基础定制（步骤 2）
  → k5 确认订单（步骤 3）
  → k6 制作中（步骤 4）
  → k7 取杯完成（步骤 5）
  → 自动或手动回到 k1
```

k1 与 k2 都有“开始点单”按钮。为保留用户给出的严格顺序，本规格定义：

- k1 点击“开始点单”进入 k2。
- k2 点击“开始点单”进入 k3。
- 可配置 `impactScreenAutoAdvanceMs`；默认关闭自动跳转，避免用户来不及阅读。
- 若后续产品决定减少一步，可通过 feature flag 跳过 k2，状态机和路由结构无需重写。

### 0.2 本期范围

本期包含：

- 七屏前端页面与交互。
- 本地订单状态。
- 本地模拟制作流程。
- 售货机硬件适配接口和 mock 实现。
- Kuku 静态资源与可替换动画容器。
- 触控、键盘、Reduced Motion 与基础无障碍。
- 离线运行、异常状态、自动复位、日志和测试。

本期默认不包含：

- 真实支付和退款。
- 云端会员与账号系统。
- 真实库存、价格后台和优惠系统。
- 真实机器控制协议的最终实现。
- 人脸身份识别、年龄/性别/情绪推断。
- 麦克风录音或自动语音对话。

如真实硬件协议已经存在，只替换 `MachineAdapter`，不要把串口、PLC、MQTT 或厂商 SDK 逻辑写进 React 组件。

---

## 1. 切片清单与设计事实

| 顺序 | 原始文件 | 尺寸 | 页面职责 | 主要操作 |
|---:|---|---:|---|---|
| 1 | `/Users/cj/Downloads/k1.png` | 979 × 1606 | 欢迎与品牌主张 | 开始点单 |
| 2 | `/Users/cj/Downloads/k2.png` | 979 × 1606 | 公益信息与情感建立 | 开始点单 |
| 3 | `/Users/cj/Downloads/k3.png` | 1150 × 1368 | 选择饮品 | 返回首页 / 下一步 |
| 4 | `/Users/cj/Downloads/k4.png` | 1148 × 1371 | 基础定制 | 返回饮品 / 确认定制 |
| 5 | `/Users/cj/Downloads/k5.png` | 1149 × 1369 | 确认订单 | 修改定制 / 开始制作 |
| 6 | `/Users/cj/Downloads/k6.png` | 975 × 1612 | 制作进度 | 无主操作，等待机器事件 |
| 7 | `/Users/cj/Downloads/k7.png` | 966 × 1628 | 取杯与完成 | 完成 |

### 1.1 画布比例处理

切片存在两组明显不同的纵横比，不能把每张图的像素坐标直接写入 CSS：

- k1、k2、k6、k7 接近长竖屏。
- k3、k4、k5 更接近较宽的设计画布。

工程应以实际售货机的 `viewport width`、`viewport height` 和安全区为准，采用同一套流式布局：

- 默认设计基准：`540 × 960` CSS px。
- 支持范围：宽高比约 `0.50–0.75`。
- 根布局使用 `100dvh`，禁止固定写死为截图高度。
- 关键区域使用 CSS Grid、Flex、`clamp()`、`minmax()` 和容器查询。
- k3–k5 在窄屏上允许内容区内部滚动，但底部主操作始终可见。
- 禁止对整张切片进行 `<img>` 铺满并在上方叠加热点；所有可交互内容必须是语义化组件。

### 1.2 视觉语言总结

设计关键词：

- 奶油白、暖米色、浅杏色背景。
- 深咖啡色标题和主按钮。
- 橙色作为品牌强调、当前步骤、价格和进度色。
- 大留白、柔和阴影、大圆角、轻描边。
- 标题偏宋体/衬线风格，正文偏现代中文无衬线。
- Kuku 为视觉中心，页面信息围绕角色展开。

---

## 2. 产品与体验原则

### 2.1 快速、确定、可恢复

- 任意有效触控应在 100ms 内出现视觉反馈。
- 页面推进只由明确的领域事件触发。
- 用户返回上一步时保留已经选择的内容。
- 非制作阶段长时间无操作自动清空并回到欢迎页。
- 制作阶段不得因前端刷新而伪造制作完成；必须重新向机器查询当前订单状态。
- 所有失败均显示可理解的下一步，不显示技术堆栈或空白页。

### 2.2 Kuku 是陪伴者，不是流程阻塞器

- 角色可以欢迎、看向用户、指向选项、回应选择、陪伴等待和庆祝完成。
- 角色动画失败、资源加载失败或互动服务离线时，点单仍能继续。
- Kuku 不替用户自动选择，不制造倒计时压力，不推断用户身份或情绪。
- 对话文案短、温暖、明确；公共空间第一期默认不自动播放声音。

### 2.3 页面转场必须服务于方向感

- 前进：当前内容轻微向左淡出，下一页从右侧轻微进入。
- 后退：反向移动。
- k5 → k6：使用“确认后下沉/缩放 + 制作页淡入”，强调状态已提交。
- k6 → k7：进度完成后使用暖色光晕和 Kuku 庆祝过渡，不突然切页。
- 转场期间锁定重复提交，但保留紧急硬件故障事件的抢占能力。
- Reduced Motion 下改为 120–160ms 交叉淡化，不使用位移、缩放和弹性运动。

### 2.4 售货机优先

- 不依赖网络字体、CDN、远程图片或在线动画运行时。
- 禁用浏览器默认上下文菜单、双击缩放、文字选择和拖拽图片。
- 不依赖 hover；所有交互必须适用于触控。
- 点击区域建议不小于 56 × 56 CSS px；绝对下限 44 × 44。
- 屏幕边缘保留 `safe-area` 与机壳遮挡余量。
- 关键按钮不要紧贴底边，避免难以触达或被系统导航遮挡。

---

## 3. 推荐技术方案

这是一个完全新建的独立项目。不得复制、导入或依赖当前工作区中其他 Kuku 原型、组件、状态机、样式、测试、动画代码或构建配置。七张切片是新项目唯一的 UI/流程参考；本文档是新项目的工程规格。

推荐从零使用：

- Vite + React + TypeScript 单页应用。
- Node.js 22 LTS。
- 纯 TypeScript reducer/state machine 管理领域状态；第一版不引入服务端渲染。
- 本地静态资源 + kiosk 宿主或本机静态服务器部署。
- Playwright 进行真实浏览器 E2E、视觉回归和触控测试。

选择 Vite SPA 而不是 Next.js 的原因：该终端是固定硬件上的离线优先 kiosk，不需要 SEO、服务端渲染或动态路由；更小、更直接的静态产物便于本地启动、版本回滚和离线审计。

### 3.1 推荐依赖边界

- UI：React + TypeScript。
- 样式：CSS Modules + 全局 design tokens；不引入大型 UI 组件库。
- 状态：领域状态机 + React bridge。可使用纯 TypeScript reducer；如采用 XState，需先评估包体和离线依赖。
- 测试：Vitest + Testing Library + Playwright，统一由 Foundation Agent 配置。
- 动画：
  - 页面转场优先 Web Animations API 或 CSS transition。
  - Mascot 动画通过抽象 renderer 接入。
  - 不允许业务状态依赖动画库 callback 才能完成。
- 数据：运行时内存 + 小型持久化快照。严禁持久化摄像头帧或敏感身份数据。
- 机器通信：`MachineAdapter` 接口 + WebSocket/HTTP/IPC/串口桥接实现。

### 3.2 新项目初始化

由 Foundation Agent 在空目录中执行一次初始化，其他 Agent 必须等基础提交完成后再并行开发：

```bash
cd /Users/cj/polyugdut
npm create vite@latest kuku-vending-frontend -- --template react-ts
cd kuku-vending-frontend
npm install
npm install -D @playwright/test
npx playwright install chromium
```

推荐 `package.json` 脚本：

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "lint": "eslint .",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:visual": "playwright test --grep @visual",
    "test:soak": "playwright test --grep @soak"
  }
}
```

Foundation Agent 应补齐 Vitest、Testing Library、ESLint、Prettier（如采用）、Playwright 配置，而不是由各页面 Agent 分别安装依赖。版本必须在 lockfile 中固定。

### 3.3 Greenfield 边界

- 新建自己的 `package.json`、lockfile、TypeScript、Vite、ESLint、测试和构建配置。
- 不通过相对路径引用 `/Users/cj/polyugdut` 下其他项目的源码或 `node_modules`。
- 不复制其他项目的业务代码作为“起点”。
- 允许使用用户明确提供的七张切片作为参考；生产 UI 仍需独立组件化实现。
- Mascot、饮品和公益生产素材如未单独提供，先使用本项目内的明确占位资源与 manifest，并在上线前替换，不从其他项目偷取或默认为已授权。
- 所有 Agent 只在新项目目录工作；规格文档保留在父目录作为只读输入。

### 3.4 建议目录

```text
src/
  animation/
    motionTokens.ts
    pageTransition.ts
    mascot/
      MascotRenderer.ts
      StaticMascotRenderer.tsx
      AnimatedMascotRenderer.tsx
      mascotStateMachine.ts
  components/
    kiosk/
      KioskShell.tsx
      StepProgress.tsx
      BottomActionBar.tsx
      ScreenTransition.tsx
      ErrorBoundary.tsx
    mascot/
      KukuStage.tsx
      KukuSpeechBubble.tsx
    order/
      DrinkCard.tsx
      OptionGroup.tsx
      OrderSummary.tsx
      BrewingProgress.tsx
  content/
    copy.zh-CN.ts
    drinks.ts
    impact.ts
  domain/
    kioskState.ts
    order.ts
    transitions.ts
    validation.ts
  hooks/
    useIdleReset.ts
    useMachineEvents.ts
    useKioskRecovery.ts
    useReducedMotion.ts
  infrastructure/
    machine/
      MachineAdapter.ts
      MockMachineAdapter.ts
      RealMachineAdapter.ts
      machineProtocol.ts
    persistence/
      SessionSnapshotStore.ts
    telemetry/
      kioskLogger.ts
  screens/
    WelcomeScreen.tsx
    ImpactScreen.tsx
    DrinkScreen.tsx
    CustomizeScreen.tsx
    ConfirmScreen.tsx
    BrewingScreen.tsx
    PickupScreen.tsx
  styles/
    tokens.css
    kiosk.css
public/
  assets/
    drinks/
    impact/
    mascot/
tests/
  domain/
  component/
  integration/
  e2e/
  visual/
  soak/
```

### 3.5 组件职责

| 组件 | 职责 | 禁止承担 |
|---|---|---|
| `KioskShell` | 安全区、全屏、背景、全局状态与错误边界 | 订单业务规则 |
| `ScreenTransition` | 前进/后退/Reduced Motion 转场 | 决定下一业务步骤 |
| `StepProgress` | 渲染五步状态与完成标记 | 修改流程状态 |
| `KukuStage` | 渲染角色、对话、姿态和互动热点 | 直接调用真实硬件 |
| `DrinkCard` | 显示饮品并上抛选择事件 | 自行写入 sessionStorage |
| `OptionGroup` | 单选组选中状态与键盘语义 | 推断默认订单 |
| `BrewingProgress` | 显示机器事件映射后的进度 | 用定时器伪造真实机器完成 |
| `MachineAdapter` | 隔离硬件协议 | 渲染 UI |
| `KioskController` | 校验并执行领域转换 | 操作 DOM |

---

## 4. 设计系统

### 4.1 颜色 Token

以下为从切片视觉估算的起始值，开发时需通过视觉回归微调：

```css
:root {
  --color-bg: #fcf8f2;
  --color-bg-warm: #fff3e5;
  --color-surface: #fffdf9;
  --color-surface-soft: #f7eee4;
  --color-ink: #2c211c;
  --color-ink-muted: #776b64;
  --color-coffee: #35231a;
  --color-coffee-pressed: #241711;
  --color-brand: #d95621;
  --color-brand-bright: #ed6f09;
  --color-success: #668775;
  --color-border: #dfccba;
  --color-disabled-bg: #e7e1dc;
  --color-disabled-text: #b5aaa1;
  --color-danger: #b53b32;
  --shadow-soft: 0 12px 32px rgb(74 42 24 / 10%);
}
```

要求：

- 文本与背景对比度满足 WCAG AA；大字最低 3:1，普通文本最低 4.5:1。
- 禁用态不能只降低到不可辨识；按钮文案仍需清晰。
- 完成态绿色、当前态橙色、未完成态灰色同时配合图标和文字，不能只靠颜色。

### 4.2 字体

```css
--font-display:
  "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", STSong, serif;
--font-sans:
  "Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC",
  "Microsoft YaHei", sans-serif;
```

- 字体必须随应用本地打包或使用系统回退，不能依赖 Google Fonts 等公网服务。
- 标题使用衬线体增强品牌感，操作与状态信息使用无衬线体保证清晰度。
- 价格数字使用等宽或 tabular number，避免数值变化引发布局抖动。

### 4.3 字号建议

基于 540px CSS 宽度：

| 角色 | 建议字号 |
|---|---:|
| 欢迎主标题 | `clamp(36px, 8vw, 58px)` |
| 页面标题 | `clamp(30px, 6vw, 46px)` |
| 卡片名称 | `24–30px` |
| 正文 | `16–22px` |
| 步骤标签 | `14–18px` |
| 主按钮 | `22–28px` |
| 制作百分比 | `38–48px` |

### 4.4 圆角、边框与阴影

- 主卡片：20–32px 圆角。
- 主按钮：20–28px 圆角。
- 小胶囊：999px。
- 边框：1–2px 暖灰/浅棕。
- 避免多层重阴影；切片整体是柔和、轻盈而非玻璃拟态。

### 4.5 触控状态

每个可点击元素必须具备：

- `default`
- `pressed`
- `selected`
- `disabled`
- `focus-visible`
- `loading`（如操作会触发机器或异步过程）

按压反馈建议：

```css
transform: scale(0.985);
filter: brightness(0.97);
transition: transform 80ms ease-out, filter 80ms ease-out;
```

禁止在按钮按下时做超过 4px 的位移，避免用户误以为触控漂移。

---

## 5. 全局布局与安全区

### 5.1 根节点

```css
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  overscroll-behavior: none;
  background: var(--color-bg);
}

.kiosk-shell {
  width: 100vw;
  height: 100dvh;
  box-sizing: border-box;
  padding:
    max(env(safe-area-inset-top), var(--safe-top))
    max(env(safe-area-inset-right), var(--safe-right))
    max(env(safe-area-inset-bottom), var(--safe-bottom))
    max(env(safe-area-inset-left), var(--safe-left));
  touch-action: manipulation;
  user-select: none;
}
```

### 5.2 机壳安全区

设备部署前必须实测：

- 屏幕可视边界是否被金属边框遮挡。
- Android 系统导航栏是否隐藏。
- 顶部状态栏是否真正沉浸。
- 触控边缘是否存在死区。
- 取杯口位置是否需要在界面中做方向提示。

配置项：

```ts
type KioskDisplayConfig = {
  logicalWidth: number;
  logicalHeight: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  devicePixelRatioCap: number;
};
```

### 5.3 层级

```text
z-index 0   背景与暖色光晕
z-index 10  页面内容
z-index 20  Kuku 舞台
z-index 30  固定底部操作
z-index 40  转场层
z-index 50  非阻塞 toast
z-index 60  阻塞错误 / 维护页
z-index 70  技术诊断页，仅管理员手势进入
```

---

## 6. 七屏详细开发规格

## 6.1 k1 欢迎屏

### 页面目标

在 2–3 秒内让用户理解：

- 这是 Kuku Coffee。
- 可以在本机完成选择与定制。
- Kuku 会帮助用户快速完成点单。

### 内容结构

```text
品牌 eyebrow：
欢迎来到 KUKU COFFEE

主标题：
现在，来一杯刚刚好的咖啡

说明：
几步完成选择与定制，Kuku 的互动全部在本机处理。

Kuku 主视觉

气泡：
嗨，想喝杯咖啡吗？我来帮你快速选好。

主按钮：
开始点单
```

### 布局

- 顶部文案约占可用高度 22%–26%。
- Kuku 舞台约占 38%–44%。
- 气泡约占 10%–13%。
- 底部 CTA 与留白约占 18%–22%。
- 主按钮宽度约屏幕 74%–82%，高度 64–84 CSS px。

### 交互

- 页面进入 250ms 后 Kuku 播放 `welcome`。
- 用户触摸 Kuku：播放 600–900ms 的 `tap-delight`，不改变页面。
- 点击 CTA：
  1. 立即显示 pressed。
  2. 禁止第二次提交。
  3. 触发 `START_INTRO`.
  4. 进入 k2。

### 无操作

- 欢迎页可永久停留。
- Kuku 的待机动画必须低功耗、低幅度，并随机化间隔，避免持续机械重复。
- 若有注意力互动服务，可在检测到匿名 presence 后播放一次欢迎；每个 presence session 最多一次。

---

## 6.2 k2 品牌公益屏

### 页面目标

用轻量信息建立品牌好感，不阻塞用户点单。

### 内容结构

- 左侧/上方公益照片组合。
- 右侧/上方信息气泡：
  - 年度动保行动
  - 救助动物 326 只
  - 合作机构 12 家
  - 公益投入 48 万元
- Kuku 感谢/微笑姿态。
- 气泡文案：
  - 守护每一个小生命，
  - 是我们一直认真在做的事。
- 底部“开始点单”。

### 数据与合规

- 数字必须来自配置或内容文件，不写死在 JSX。
- 如果这些数字不是可审计的真实数据，生产发布前必须由品牌方确认。
- 照片必须有合法使用权并本地打包。
- 图片中人物信息需经过授权；不附带定位、EXIF 或其他不必要元数据。

### 交互

- 点击 CTA 触发 `START_ORDER`，进入 k3。
- 该页不允许横向轮播，避免用户误以为必须浏览多屏。
- 图片资源未加载时显示暖色占位和信息卡，CTA 仍可用。
- 可配置 `skipImpactScreen` 以便运营后续 A/B 或直接进入点单。

### 动画

- 公益图片：180–240ms 淡入，不做大范围视差。
- 统计数字：可从 0 轻量过渡至目标值，时长不超过 700ms；Reduced Motion 下直接显示。
- Kuku：`grateful`，幅度小于欢迎页。

---

## 6.3 k3 选择饮品

### 页面目标

用户从三款饮品中选择一款，并清楚看到名称、风味、描述和价格。

### 五步进度

```text
1 饮品 → 2 定制 → 3 确认 → 4 制作 → 5 取杯
```

状态规则：

- 当前步骤：橙色实心圆 + 深色文字。
- 已完成：绿色或橙色 check。
- 未开始：浅灰描边。
- 顶部进度条与步骤状态同步。
- 对屏幕阅读器输出“当前第 1 步，共 5 步：饮品”。

### Kuku 引导区

- 位于步骤条下方的浅杏色大圆角容器。
- k3 切片仅展示 Kuku 靠左，可为未来对话文案预留右侧空间。
- 第一版可显示短句：“先选一杯今天最想喝的吧。”
- Kuku 状态：`point-options`。

### 饮品数据

```ts
type DrinkId = "americano" | "latte" | "mocha";

type Drink = {
  id: DrinkId;
  name: string;
  tagline: string;
  description: string;
  priceCents: number;
  imageSrc: string;
  available: boolean;
  capabilities: {
    temperature: readonly Temperature[];
    sweetness: readonly Sweetness[];
    milkBase: readonly MilkBase[];
    latteArt: boolean;
  };
};
```

初始内容：

| ID | 名称 | 标签 | 描述 | 价格 |
|---|---|---|---|---:|
| americano | 美式 | 清爽醒神 | 浓郁咖啡香，口感干净利落。 | ¥15 |
| latte | 拿铁 | 柔和顺滑 | 醇香咖啡与奶香平衡融合。 | ¥18 |
| mocha | 摩卡 | 可可香甜 | 咖啡融入温柔可可风味。 | ¥20 |

### 饮品卡

- 整张卡可点击，不只点击右侧圆圈。
- 图片使用本地透明 PNG/WebP/AVIF；提供固定 aspect-ratio，避免加载后抖动。
- 单选语义使用 `radiogroup` + `radio` 或原生 radio 包裹整卡。
- 选中状态同时改变边框、背景、圆点和文字。
- 售罄状态显示“暂时售罄”，禁用选择，保留饮品信息。

### 按钮

- “返回首页”：二级按钮，触发确认性重置。
- “下一步：定制”：未选饮品时禁用。
- 用户选中饮品后：
  - 100ms 内更新卡片状态。
  - 更新 Kuku 为 `approve`。
  - 下一步按钮启用。
- 点击下一步时再次校验可售状态，防止选择后库存状态变化。

### 失败分支

- 所有饮品售罄：阻止进入定制，显示“当前饮品暂不可制作”，提供返回欢迎页。
- 价格或库存服务超时：使用最后一次可信快照；无快照时进入服务暂不可用页，不展示错误价格。

---

## 6.4 k4 基础定制

### 页面目标

对已选饮品完成甜度、冷热、奶基和奶盖图案选择。

### 当前饮品

- 清晰显示“当前饮品”和名称。
- 返回饮品页时保留定制草稿；改选饮品后重新按其 capability 校验并迁移合法选项。

### 默认值

切片示例中选中：

- 甜度 0%
- 热
- 鲜奶
- 星芒

但默认值不能只因视觉切片而盲目决定。领域层应定义：

```ts
const defaultsByDrink: Record<DrinkId, Customization> = {
  americano: {
    sweetness: 0,
    temperature: "hot",
    milkBase: "none",
    latteArt: "none",
  },
  latte: {
    sweetness: 0,
    temperature: "hot",
    milkBase: "dairy",
    latteArt: "star",
  },
  mocha: {
    sweetness: 50,
    temperature: "iced",
    milkBase: "oat",
    latteArt: "none",
  },
};
```

最终默认值必须由产品、配方与机器能力共同确认。

### 选项

- 甜度：0%、30%、50%。
- 冷热：热、冰。
- 奶基：鲜奶、燕麦奶。
- 奶盖图案：星芒、爱心、笑脸、自定义。

### 奶盖图案的能力降级

k4 显示可选择图案，而 k5 又写着“奶盖图案功能已预留，后续开放”。这是切片中的产品冲突。建议第一期采用以下明确规则：

- 若机器未支持：整组显示为“即将开放”，不可选择；订单摘要不写入具体图案。
- 若仅部分饮品支持：根据 drink capability 显示。
- “自定义”在没有编辑器和硬件协议时必须禁用，不能造成已提交的错觉。
- k5 的订单摘要按实际 capability 输出，不固定显示占位句。

### 当前选择摘要

底部浅色区域实时显示：

```text
甜度 0% · 热 · 鲜奶 · 星芒
```

- 只展示已确认且机器可执行的选项。
- 更改任意选项后即时同步。

### 按钮

- “返回饮品”：保留草稿。
- “确认定制”：校验全部必选项后进入 k5。
- 不支持的组合在用户点击时立即解释，例如“冰美式不支持奶盖图案”，不等到确认页才报错。

---

## 6.5 k5 确认订单

### 页面目标

让用户在向机器提交前，最后核对饮品、价格和定制。

### 摘要内容

- 饮品名称。
- 风味标签。
- 单价/总价。
- 甜度。
- 冷热。
- 奶基。
- 奶盖图案或“当前饮品不支持”。

### 一致性要求

切片 k4 示例是“美式 / 甜度 0% / 热 / 鲜奶 / 星芒”，k5 示例是“摩卡 / 甜度 50% / 冰 / 燕麦奶”。实现时必须展示用户真实选择，绝不能复制切片中的固定示例值。

### 提交过程

点击“开始制作”：

1. 立即进入按钮 loading，防止重复点击。
2. 冻结订单快照并生成 `clientOrderId`。
3. 再次校验饮品、配方、价格和机器 readiness。
4. 调用 `MachineAdapter.submitOrder(order, idempotencyKey)`。
5. 收到 `accepted` 后进入 k6。
6. 若超时，先查询订单状态，不能盲目再次提交。
7. 若明确 rejected，留在 k5 并显示可理解原因。

### 幂等性

```ts
type SubmitOrderRequest = {
  clientOrderId: string;
  idempotencyKey: string;
  submittedAt: string;
  order: OrderSnapshot;
};
```

- 同一个订单重复点击、网络重试或页面恢复都使用同一幂等键。
- 前端不得仅因为 HTTP 超时就认定提交失败。
- 状态不确定时显示“正在确认机器状态”，并轮询/订阅真实状态。

### 按钮

- “修改定制”：回到 k4，订单仍未提交。
- “开始制作”：唯一提交入口。
- 一旦机器 accepted，不允许返回修改；如需取消必须由机器协议明确支持。

---

## 6.6 k6 制作中

### 页面目标

准确、稳定地反映机器真实状态，并用 Kuku 降低等待焦虑。

### 进度映射

切片展示：

- 研磨
- 萃取
- 出杯

建议事件模型：

```ts
type BrewStage =
  | "queued"
  | "grinding"
  | "extracting"
  | "dispensing"
  | "completed"
  | "failed"
  | "cancelled";

type MachineOrderStatus = {
  machineOrderId: string;
  clientOrderId: string;
  stage: BrewStage;
  progress?: number;
  updatedAt: string;
  recoverable: boolean;
  errorCode?: string;
};
```

规则：

- 如果机器提供真实百分比，做单调递增和有界平滑。
- 如果机器只提供阶段，不伪装为精确物理百分比；使用阶段范围估算并标注为视觉进度：
  - queued：0–8%
  - grinding：8–35%
  - extracting：35–75%
  - dispensing：75–95%
  - completed：100%
- UI 进度不可倒退；若机器回报倒退，记录异常但保留最后可信进度。
- 只有收到 `completed` 或取杯传感器相关可用事件后才进入 k7。

### Kuku 状态

| 机器状态 | Kuku cue | 文案示例 |
|---|---|---|
| queued | wait | 已经收到订单，马上开始。 |
| grinding | grind | 正在研磨，香气快来啦。 |
| extracting | extract | 正在萃取，请稍等一会儿。 |
| dispensing | dispense | 最后一步，正在出杯。 |
| temporary pause | reassure | 机器正在确认状态，请稍等。 |
| failed | concern | 没能顺利完成，请按屏幕提示处理。 |

### 异常

- 机器断连：
  - 保留最后状态。
  - 显示“正在重新连接机器”。
  - 指数退避重连并限制上限。
  - 不自动跳回欢迎页。
- 明确制作失败：
  - 进入阻塞故障页。
  - 展示订单编号后 6 位。
  - 提供“呼叫工作人员”或设备配置的处理方式。
- 前端刷新：
  - 从本地恢复 `clientOrderId`。
  - 查询机器状态。
  - 查询完成前显示恢复界面，不能重新提交。

### 动画

- Kuku 主体保持在 GPU 合成层，但不要长期使用高强度滤镜。
- 进度条只动画 `transform: scaleX()`，减少 layout/paint。
- 百分比更新使用 tabular number。
- 背景呼吸光晕低于 0.12 opacity。

---

## 6.7 k7 取杯与完成

### 页面目标

明确告诉用户咖啡已准备好、从哪里取杯，以及何时结束当前 session。

### 内容

- Kuku 庆祝姿态。
- 气泡：
  - 完成啦，请从取杯口拿走你的咖啡。
- 状态胶囊：
  - 咖啡已准备好 / 制作完成。
- 主标题：
  - 咖啡准备好了
- 饮品名。
- 取杯说明。
- “完成”按钮。

切片中的“制作模拟完成”只适用于原型环境。生产售货机必须改为真实状态文案，不能向终端用户显示“模拟”。

### 取杯传感器

如果硬件提供 cup removed 事件：

- `completed` 后进入 k7。
- `cup_removed` 后延迟 800–1500ms 自动完成并回欢迎页。
- 仍保留“完成”按钮以处理传感器失效。

如果无取杯传感器：

- 用户点击“完成”即清空 session。
- 可配置 20–45 秒后自动回欢迎页。
- 自动回首页前最后 5 秒给出轻量提示，防止用户仍在阅读。

### 清理

回到欢迎页前：

- 清空订单与幂等键。
- 清理制作订阅、计时器和 abort controller。
- 清空用户级互动 session，不清除设备配置和最后可用库存快照。
- 记录匿名 `order_flow_completed`。
- Kuku 回到 idle，而不是重新加载全部资源。

---

## 7. 领域状态机

### 7.1 页面状态

```ts
type KioskScreen =
  | "welcome"
  | "impact"
  | "drink"
  | "customize"
  | "confirm"
  | "submitting"
  | "brewing"
  | "pickup"
  | "recovering"
  | "out_of_service";
```

### 7.2 核心上下文

```ts
type KioskContext = {
  sessionId: string;
  screen: KioskScreen;
  navigationDirection: "forward" | "backward" | "replace";
  selectedDrinkId: DrinkId | null;
  customization: Customization | null;
  orderDraft: OrderDraft | null;
  submittedOrder: OrderSnapshot | null;
  clientOrderId: string | null;
  machineOrderId: string | null;
  machineStatus: MachineOrderStatus | null;
  lastInteractionAt: number;
  lastTransitionAt: number;
  transitionLocked: boolean;
  recoveryReason: string | null;
};
```

### 7.3 合法事件

```ts
type KioskEvent =
  | { type: "START_INTRO" }
  | { type: "START_ORDER" }
  | { type: "SELECT_DRINK"; drinkId: DrinkId }
  | { type: "CONTINUE_TO_CUSTOMIZE" }
  | { type: "UPDATE_CUSTOMIZATION"; patch: Partial<Customization> }
  | { type: "CONTINUE_TO_CONFIRM" }
  | { type: "EDIT_CUSTOMIZATION" }
  | { type: "SUBMIT_ORDER" }
  | { type: "ORDER_ACCEPTED"; machineOrderId: string }
  | { type: "ORDER_REJECTED"; reason: string }
  | { type: "MACHINE_STATUS"; status: MachineOrderStatus }
  | { type: "CUP_REMOVED" }
  | { type: "FINISH_SESSION" }
  | { type: "IDLE_TIMEOUT" }
  | { type: "RESET_CONFIRMED" }
  | { type: "FATAL_MACHINE_ERROR"; code: string }
  | { type: "RECOVERY_SUCCEEDED"; status: MachineOrderStatus };
```

### 7.4 转换表

| 当前状态 | 事件 | 条件 | 下一状态 |
|---|---|---|---|
| welcome | START_INTRO | 设备可接单 | impact |
| impact | START_ORDER | 设备可接单 | drink |
| drink | CONTINUE_TO_CUSTOMIZE | 已选且可售 | customize |
| customize | CONTINUE_TO_CONFIRM | 定制合法 | confirm |
| confirm | EDIT_CUSTOMIZATION | 尚未提交 | customize |
| confirm | SUBMIT_ORDER | 机器 ready | submitting |
| submitting | ORDER_ACCEPTED | id 匹配 | brewing |
| submitting | ORDER_REJECTED | 明确拒绝 | confirm |
| brewing | MACHINE_STATUS(completed) | id 匹配 | pickup |
| pickup | CUP_REMOVED | 传感器有效 | welcome |
| pickup | FINISH_SESSION | 任意 | welcome |
| drink/customize/confirm | IDLE_TIMEOUT | 无在途提交 | welcome |
| submitting/brewing | reload/disconnect | 有订单 id | recovering |
| recovering | RECOVERY_SUCCEEDED | 状态未完成 | brewing |
| recovering | RECOVERY_SUCCEEDED | 已完成 | pickup |
| 任意 | FATAL_MACHINE_ERROR | 不可恢复 | out_of_service |

### 7.5 不变量

- 未选饮品不能进入 customize。
- 定制不合法不能进入 confirm。
- 没有冻结订单快照不能 submit。
- 同一 `clientOrderId` 只能有一个有效提交。
- brewing 中用户操作不能重置订单。
- pickup 之前必须有可信的 completed 状态。
- 回到 welcome 后不得残留用户订单信息。
- UI 当前屏与状态机状态必须一一对应。

---

## 8. 页面转场与动画规范

### 8.1 Motion Token

```ts
export const motion = {
  duration: {
    instant: 80,
    fast: 160,
    normal: 260,
    page: 360,
    celebrate: 680,
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    enter: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    gentleSpring: "linear(...)", // 若不支持则使用 enter 曲线
  },
};
```

### 8.2 页面级转场

| 场景 | 离场 | 入场 | 总时长 |
|---|---|---|---:|
| 普通前进 | `x: 0 → -3%`, opacity `1 → 0` | `x: 4% → 0`, opacity `0 → 1` | 280–360ms |
| 普通后退 | 方向相反 | 方向相反 | 240–320ms |
| 提交制作 | 当前卡片 `scale 1 → .98` | 制作页交叉淡入 | 360–480ms |
| 制作完成 | 暖色光晕增强，Kuku celebrate | pickup 内容上移淡入 | 520–700ms |
| 故障抢占 | 当前内容 120ms 淡出 | 故障层 160ms 淡入 | 160–220ms |

### 8.3 转场实现约束

- 同时最多存在 outgoing 与 incoming 两个页面。
- 旧页面动画结束后必须卸载并释放监听器。
- 转场状态不得阻止机器 `failed/completed` 事件。
- 机器事件可以更新 store，转场结束后渲染最新状态。
- 按钮点击后立即锁定业务提交，锁定时间不得依赖动画时长。
- 不使用 `transition: all`。
- 不动画 width、height、top、left 等高成本属性。
- 图片、字体和下一页关键资源应在上一步空闲时预加载。

### 8.4 流畅度指标

- 目标刷新率：60fps；120Hz 屏可自然提高，但不作为硬依赖。
- p95 单帧时间：≤ 16.7ms（60Hz）。
- 页面转场期间 dropped frame 比例：< 1% 为目标，< 3% 为最低验收。
- 触控到视觉反馈：p95 < 100ms。
- 屏幕切换到可操作：p95 < 500ms。
- 首次冷启动到欢迎页可操作：目标 < 3s，最低验收 < 5s。
- 动画不能造成 CLS；生产流程 CLS 目标为 0。

---

## 9. Kuku Mascot 动态化架构

### 9.1 目标

Kuku 后续会具备动画并与用户互动，因此第一版不能把角色写成每页各自独立的普通 `<img>`。

推荐全局只存在一个 `KukuStage`：

```tsx
<KioskShell>
  <PersistentMascotLayer
    state={mascotState}
    target={interactionTarget}
    reducedMotion={reducedMotion}
  />
  <ScreenTransition screenKey={screen}>
    {screenContent}
  </ScreenTransition>
</KioskShell>
```

如果切片布局要求每页角色位置不同，使用共享舞台的 layout presets 或 shared-element transition，不要每次销毁再加载动画实例。

### 9.2 Renderer 抽象

```ts
type MascotCue =
  | "idle"
  | "welcome"
  | "grateful"
  | "point-options"
  | "listen"
  | "approve"
  | "recap"
  | "grind"
  | "extract"
  | "dispense"
  | "celebrate"
  | "goodbye"
  | "concern"
  | "tap-delight";

interface MascotRenderer {
  load(): Promise<void>;
  setCue(cue: MascotCue): void;
  setLookTarget(target: { x: number; y: number } | null): void;
  setEnergy(value: number): void;
  trigger(name: "tap" | "notice" | "welcome" | "goodbye"): void;
  setReducedMotion(enabled: boolean): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
```

实现顺序：

1. `StaticMascotRenderer`：按 cue 切换本地静态姿态图。
2. `LayeredCssMascotRenderer`：分层 PNG + CSS/Web Animations。
3. `RiveMascotRenderer` 或其他运行时：只替换 renderer，不更改购买流程。

### 9.3 互动输入

允许：

- 触摸 Kuku。
- 当前页面和订单状态。
- 匿名 presence、屏幕内标准化注视目标、接近程度、运动量。
- 机器制作事件。

禁止：

- 把摄像头原始帧发送到云端。
- 保存人脸图像、landmark 或可复识别身份数据。
- 推断用户年龄、性别、族群、健康和情绪。
- 因检测不到用户而阻止点单。

### 9.4 动作优先级

```text
机器严重故障 concern
  > 制作阶段 cue
  > 页面引导 cue
  > 用户点击触发
  > presence 互动
  > idle
```

- 高优先级动作可安全打断低优先级动作。
- 用户点击 burst 不能中断机器故障提示。
- 频繁 telemetry 只更新连续参数，不重复触发同一离散动画。
- 同一 trigger 设置冷却时间，避免每帧重播。

### 9.5 性能与生命周期

- Mascot 资源在欢迎页加载，空闲时预解码后续姿态。
- 使用 `createImageBitmap` 或浏览器图片 decode 时必须提供失败回退。
- 页面不可见、设备进入维护模式或温度过高时暂停非必要动画。
- 所有 rAF、timer、WebSocket 和 event listener 在卸载/重置时清理。
- 角色纹理总显存需按目标设备测试；避免多张超大透明 PNG 长期驻留。
- 动画运行时加载失败则显示静态 `idle.png`。

### 9.6 Reduced Motion

- 关闭持续起伏、弹跳、大范围位移、视差和频繁眨眼。
- 保留状态变化的短淡入、选中反馈和必要进度。
- 不因 Reduced Motion 关闭功能或隐藏信息。

---

## 10. 售货机稳定性与耐用性

### 10.1 离线优先

生产包必须包含：

- 所有 JS/CSS。
- 字体。
- Kuku 与饮品图片。
- 动画运行时。
- 错误页与维护页。
- 必要的本地配置默认值。

禁止：

- 运行时从 CDN 拉核心资源。
- 依赖公网才能显示欢迎或完成页。
- 网络失败导致无限 loading。

### 10.2 自动恢复

- React 根节点设置 Error Boundary。
- 捕获 `window.onerror` 与 `unhandledrejection`，写入本地滚动日志。
- 非制作阶段发生不可恢复 UI 错误：显示 5 秒恢复提示后重新初始化 session。
- 制作/提交阶段发生 UI 错误：保留订单 ID，重启后进入 `recovering` 并查询机器。
- kiosk 宿主进程可配置 watchdog；页面心跳超时后重启 WebView/浏览器。
- 重启不能等同于新订单提交。

### 10.3 无操作策略

建议：

- welcome：不自动重置。
- impact：30 秒回 welcome。
- drink/customize/confirm：45 秒无操作提示，60 秒重置。
- submitting/brewing：禁止无操作重置。
- pickup：20–45 秒后回 welcome，优先使用 cup removed。
- 任意触控、按键或合法辅助输入刷新用户活动时间。

重置前提示：

> 还在选择吗？若没有操作，本次内容将在 15 秒后清空。

### 10.4 定时器规范

- 使用单一 clock abstraction，便于 fake timer 测试。
- 页面退出立即清理页面定时器。
- 不允许多个组件各自创建全局 idle timer。
- 后台标签页 timer 节流后恢复时必须根据绝对时间计算，而非累加 tick。
- 制作进度以机器 timestamp 为准，不以页面 interval 为准。

### 10.5 内存与长稳

最低长稳验收：

- 连续运行 72 小时无崩溃。
- 自动执行至少 1,000 次完整模拟订单。
- JS heap 在热身后不持续线性增长。
- WebSocket 重连、页面转场、Kuku trigger 和图片解码无资源泄漏。
- 一次 session 结束后监听器、timer、abort controller 回到基线。

建议设定：

- 单页压缩资源包尽量 < 15MB；Kuku 动画资源需单独评估。
- 首屏关键资源 < 3MB。
- JS gzip/brotli 目标 < 500KB，若超过需给出原因。
- 长稳后 heap 增长 < 20% 或 < 50MB，取更严格且适配设备的指标。

### 10.6 设备状态

启动时检查：

- 机器控制服务可达。
- 可接单。
- 杯、咖啡豆、水、奶等关键资源状态满足最低条件。
- 废水箱/渣盒/门锁/温度等设备状态正常。

若不可接单：

- 欢迎页替换为明确的“暂时无法提供服务”。
- 不允许用户走到确认页才发现机器故障。
- 管理员诊断信息不直接展示给顾客。

### 10.7 防重复与防误触

- 提交按钮使用幂等键。
- 所有页面推进只接收一次有效事件。
- 转场期间禁用同一 CTA。
- 触控抬起后再触发关键动作，避免滑动误触。
- 避免在按钮位置切换后让同一根手指触发下一页按钮（ghost click）。
- 关键危险操作如取消已提交订单必须二次确认并由硬件支持。

---

## 11. MachineAdapter 规格

### 11.1 接口

```ts
interface MachineAdapter {
  initialize(signal?: AbortSignal): Promise<MachineSnapshot>;
  getSnapshot(signal?: AbortSignal): Promise<MachineSnapshot>;
  submitOrder(
    request: SubmitOrderRequest,
    signal?: AbortSignal,
  ): Promise<
    | { status: "accepted"; machineOrderId: string }
    | { status: "rejected"; code: string; userMessage: string }
    | { status: "unknown"; retryAfterMs: number }
  >;
  getOrderStatus(
    clientOrderId: string,
    signal?: AbortSignal,
  ): Promise<MachineOrderStatus | null>;
  subscribe(
    listener: (event: MachineEvent) => void,
  ): () => void;
  requestAssistance?(): Promise<void>;
  dispose(): void;
}
```

### 11.2 事件

```ts
type MachineEvent =
  | { type: "ready_changed"; ready: boolean; reason?: string }
  | { type: "inventory_changed"; snapshot: InventorySnapshot }
  | { type: "order_status"; payload: MachineOrderStatus }
  | { type: "cup_removed"; machineOrderId: string; at: string }
  | { type: "fault"; severity: "warning" | "fatal"; code: string }
  | { type: "connection_changed"; connected: boolean };
```

### 11.3 协议安全

- 校验所有入站事件 schema、范围、订单 ID 和 timestamp。
- 未知字段按策略忽略或拒绝，不得直接展开到 UI。
- 只接受预期 loopback/局域网 endpoint。
- 不把厂商错误文本直接展示给用户。
- 日志不记录完整个人信息或摄像头内容。
- `dispose()` 必须关闭订阅与 socket。

### 11.4 Mock 模式

开发与测试必须提供可控场景：

- 正常制作。
- 接单拒绝。
- 接单超时但实际已接受。
- 研磨失败。
- 进度乱序。
- WebSocket 断线重连。
- 制作完成后 cup sensor 无事件。
- 页面刷新后恢复。
- 全部饮品售罄。

Mock 使用确定性 seed，自动化测试不得依赖随机时间。

---

## 12. 状态持久化与恢复

### 12.1 可持久化

只保存恢复必要信息：

```ts
type RecoverySnapshot = {
  schemaVersion: 1;
  savedAt: string;
  clientOrderId: string;
  machineOrderId: string | null;
  submittedOrder: OrderSnapshot;
  lastKnownStatus: MachineOrderStatus | null;
};
```

### 12.2 不应持久化

- 未提交的长期用户偏好。
- 摄像头图像、landmarks 或身份数据。
- 互动轨迹。
- 完整长期订单历史。
- 管理员凭据。

### 12.3 恢复流程

```text
应用启动
  → 检查 recovery snapshot
  → 无 snapshot：检查机器 ready，进入 welcome
  → 有 snapshot：进入 recovering
      → 查询机器订单
      → brewing：恢复 k6
      → completed：恢复 k7
      → failed：显示失败处理
      → not found：记录协议异常，禁止自动重提
```

- snapshot 需有 schema version 和 TTL。
- 完成 session 后原子清除。
- localStorage 不可用时使用内存并记录降级；生产 kiosk 可由宿主提供更可靠存储。

---

## 13. 可访问性与触控易用性

- 全流程支持单指触控。
- 可用键盘完成，方便开发、测试和部分辅助设备。
- 单选项具有正确 `role`、`aria-checked` 和组标签。
- 当前步骤使用 `aria-current="step"`。
- 制作进度使用 `role="progressbar"`，提供 value。
- 动态状态使用克制的 `aria-live="polite"`；严重故障使用 assertive。
- 禁用按钮提供可见原因，如“请先选择一款饮品”。
- 不使用仅靠颜色表达选中、完成和错误。
- 正文不小于设备实测可读尺寸。
- 触控目标间保留至少 8px 间距，减少误触。
- 页面不允许双指缩放并非通用 Web 最佳实践，但封闭 kiosk 可由宿主层控制；不要用破坏性 viewport 设置影响辅助测试。

---

## 14. 文案与本地化

### 14.1 集中管理

所有用户文案进入 `copy.zh-CN.ts`，禁止散落在 JSX：

```ts
export const copy = {
  welcome: {
    eyebrow: "欢迎来到 KUKU COFFEE",
    title: "现在，来一杯刚刚好的咖啡",
    description: "几步完成选择与定制，Kuku 的互动全部在本机处理。",
    mascot: "嗨，想喝杯咖啡吗？我来帮你快速选好。",
    cta: "开始点单",
  },
  // ...
} as const;
```

### 14.2 文案原则

- 简短、主动、无压力。
- 不虚构支付、库存或制作状态。
- 不推断用户情绪。
- 错误信息告诉用户接下来能做什么。
- “模拟制作”只用于开发/演示模式，生产构建自动替换或禁止出现。

### 14.3 国际化预留

- 数据模型使用稳定 ID，不使用中文作为 key。
- 布局允许英文文本增宽 30%–50%。
- 金额使用 `Intl.NumberFormat`。
- 日期/时间仅用于日志，不在用户界面硬编码格式。

---

## 15. 资源处理

### 15.1 建议命名

```text
public/assets/reference/k1-welcome.png
public/assets/reference/k2-impact.png
public/assets/reference/k3-drinks.png
public/assets/reference/k4-customize.png
public/assets/reference/k5-confirm.png
public/assets/reference/k6-brewing.png
public/assets/reference/k7-pickup.png

public/assets/mascot/kuku-idle.png
public/assets/mascot/kuku-welcome.png
public/assets/mascot/kuku-grateful.png
public/assets/mascot/kuku-brewing.png
public/assets/mascot/kuku-celebrate.png

public/assets/drinks/americano.webp
public/assets/drinks/latte.webp
public/assets/drinks/mocha.webp
```

### 15.2 优化

- 保留源 PNG，生产生成 WebP/AVIF 与必要的 PNG fallback。
- 不放大低分辨率图作为最终生产资源。
- 所有图片指定宽高或 aspect ratio。
- 删除不必要 EXIF。
- 透明角色图裁去过大空白边缘。
- 为弱 GPU 设备准备较低分辨率纹理。

### 15.3 资源失败

- 饮品图失败：显示 CSS 杯型占位，名称/价格/选择仍可用。
- Kuku 动画失败：回退静态图。
- 字体失败：使用系统字体，布局不能崩溃。
- 公益照片失败：保留统计信息与 CTA。

---

## 16. 可观测性

### 16.1 日志事件

建议匿名事件：

```text
app_started
machine_ready_changed
screen_entered
drink_selected
customization_changed
order_submit_started
order_submit_result
brew_stage_changed
cup_removed
session_completed
session_idle_reset
recovery_started
recovery_result
frontend_error
asset_fallback_used
mascot_renderer_fallback
```

### 16.2 日志字段

- app version
- device ID（设备级，不是用户级）
- session ID（短期随机）
- screen
- event timestamp
- client order ID 的截断/哈希形式
- error code
- duration
- offline/online

禁止记录：

- 摄像头帧。
- 人脸坐标的长期轨迹。
- 用户身份。
- 完整支付信息。
- 未脱敏厂商 token。

### 16.3 本地滚动日志

- 设定上限和轮转，避免磁盘写满。
- 关键订单状态优先，动画 debug 默认关闭。
- 管理员诊断页可导出最近日志，但需权限入口。

---

## 17. 性能预算

| 指标 | 目标 | 最低验收 |
|---|---:|---:|
| 冷启动可操作 | < 3s | < 5s |
| 热启动可操作 | < 1s | < 2s |
| 触控反馈 p95 | < 100ms | < 150ms |
| 页面切换完成 | 280–480ms | < 700ms |
| 转场平均帧率 | 60fps | ≥ 50fps |
| CLS | 0 | < 0.02 |
| 关键资源离线可用 | 100% | 100% |
| 连续运行 | 72h | 24h 不崩溃 |
| 模拟订单 | 1,000 次 | 300 次 |
| session 后资源回收 | 回到基线 | 无线性增长 |

生产设备性能低于开发机时，以生产设备测试结果为准。

---

## 18. 测试策略

### 18.1 单元测试

必须覆盖：

- 每个合法状态转换。
- 每个非法状态转换被拒绝。
- 默认定制与饮品 capability。
- 价格计算。
- 定制组合校验。
- 幂等键在重试时不变化。
- 进度单调映射。
- idle timeout 规则。
- recovery snapshot schema 与 TTL。
- Kuku cue 优先级。

### 18.2 组件测试

- DrinkCard 整卡可选择。
- 单选组正确语义。
- 未选择时下一步禁用并有说明。
- 定制摘要同步。
- 确认页显示真实订单而非固定示例。
- 制作进度与机器事件同步。
- Reduced Motion 样式生效。
- 图片失败时 fallback 可用。
- Error Boundary 显示安全恢复。

### 18.3 集成测试

```text
正常路径：
welcome → impact → drink → customize → confirm
→ submit accepted → grinding → extracting → dispensing
→ completed → pickup → cup removed → welcome
```

另需覆盖：

- k3 返回首页并清空。
- k4 返回饮品后保留合法草稿。
- k5 返回修改后重新确认。
- 双击提交只创建一个订单。
- submit timeout + status 查询发现已接受。
- brewing 中 socket 断线并恢复。
- brewing 中刷新后恢复。
- progress 乱序不倒退。
- 机器失败进入故障处理。
- pickup 无传感器时按钮/超时完成。
- 无操作重置不影响 brewing。

### 18.4 E2E 触控测试

用 Playwright 的 touchscreen/device emulation：

- 540 × 960。
- 1080 × 1920。
- 较窄视口 390 × 693。
- 实际设备分辨率。
- 连续快速点击。
- 长按、轻微滑动后松手。
- 页面底部边缘点击。
- 网络离线启动。
- 资源加载失败。

### 18.5 视觉回归

每一屏至少保存：

- 默认。
- 选中。
- 禁用。
- 错误/降级。
- Reduced Motion 不需截图动画，但需验证最终静态状态。

视觉基准以切片为参考，使用允许差异：

- 关键布局区域：±4 CSS px。
- 字号/行高：±2 CSS px。
- 色差：按 perceptual diff 阈值调整。
- 角色尺寸与位置：±2% 视口。
- 不接受明显字体替换、图片拉伸、按钮变形、溢出和遮挡。

### 18.6 动画测试

- 转场只触发一次。
- outgoing 页面按时卸载。
- 高频 machine event 不重复触发 Kuku 动作。
- Reduced Motion 不包含大幅位移。
- 页面快速前进/后退后无残留动画类。
- rAF/timer 在 session 结束后清零。
- 实机录制 60fps 视频检查卡顿。

### 18.7 长稳与故障注入

自动化脚本循环 1,000 次：

```text
进入 → 选饮品 → 定制 → 确认 → 模拟制作 → 取杯 → 完成
```

每 N 次注入：

- socket 断开。
- 机器响应延迟。
- 进度乱序。
- 图片加载失败。
- 页面 reload。
- 设备离线。
- companion 离线。

记录：

- heap。
- DOM 节点数。
- listener 数。
- timer 数。
- socket 数。
- 每次流程耗时。
- dropped frames。

### 18.8 实机验收

- 戴手套/湿手场景触控。
- 站立距离与视角。
- 强光、暗光和屏幕反光。
- 风扇噪音环境下是否仍不依赖声音。
- 连续点单后机身温度。
- 屏幕烧屏风险：欢迎页元素轻微位移或屏保策略。
- 断电重启。
- 网络拔线。
- 机器控制进程重启。
- 取杯传感器异常。

---

## 19. Definition of Done

只有同时满足以下条件，任务才算完成：

- 七屏均为真实组件，不是整图热点。
- 严格按 k1 → k7 顺序完成主流程。
- 视觉在目标设备上与切片高度一致。
- 订单数据贯穿 k3–k7，无固定示例串页。
- 正常、返回、无操作、售罄、提交未知、制作失败和恢复路径可用。
- 页面转场符合 motion 规范并通过 Reduced Motion。
- Kuku 使用可替换 renderer，主流程不依赖动画成功。
- 所有核心资源离线可用。
- 真实提交具备幂等保护。
- brewing 不由普通 idle timeout 重置。
- 生产文案不出现“模拟完成”。
- lint、typecheck、unit、integration、E2E、visual 和 build 全部通过。
- 完成长稳与实机验收，严重错误为 0。
- README 包含启动、构建、mock、实机配置、恢复和测试说明。

---

## 20. 多 Agent 协作方式

建议 1 个 Foundation Agent + 8 个实现 Agent + 1 个集成 Agent + 1 个独立 Test Agent。Foundation Agent 必须首先单独完成项目初始化；其他 Agent 只在基础提交上开发。若并发槽位有限，按以下批次执行：

```text
批次 0（不得并行）：
Foundation Agent 新建项目、锁定工具链、建立测试骨架

批次 A：
Agent 1 架构状态机
Agent 2 设计系统与壳层
Agent 3 资源整理

批次 B：
Agent 4 k1-k2
Agent 5 k3-k5
Agent 6 k6-k7 与硬件状态
Agent 7 Kuku 动画架构

批次 C：
Agent 8 稳定性/恢复/可观测性
Integration Agent 合并与修复

批次 D：
Test Agent 独立验收
```

### 20.1 协作规则

所有 Agent 必须遵守：

- 先阅读本开发文档和仓库 `AGENTS.md`。
- 新项目是 greenfield；不得引用、复制或依赖工作区中其他前端项目。
- 不修改不属于自己范围的文件，除非接口编译所必需。
- 不覆盖其他 Agent 的改动。
- 只复用 Foundation Agent 或本项目上游 Agent 已在新项目内建立的公共接口。
- 新增共享类型先落到约定目录，再通知其他 Agent。
- 每次提交/交付说明修改文件、关键决策和已运行测试。
- 不通过跳过测试、删除断言或放宽规则来“修复”失败。
- 不把切片整图当成最终 UI。
- 不引入公网运行时依赖。

---

## 21. 可直接分发的 Subagent Prompts

以下 Prompt 均可直接复制给对应 Agent。将 `<NEW_PROJECT_ROOT>` 替换为新项目路径；本文建议使用 `/Users/cj/polyugdut/kuku-vending-frontend`。除 Foundation Agent 外，其他 Agent 开始前必须确认该目录已由 Foundation Agent 初始化完成。

### Prompt 0：Foundation / Greenfield 初始化 Agent

```text
你是 Kuku Coffee 售货机前端的 Foundation Agent。你负责在空目录中创建一个
全新的独立项目，不得复用当前工作区中任何其他项目的源码、组件、状态机、样式、
动画、测试或构建配置。

父工作区：/Users/cj/polyugdut
新项目目录：<NEW_PROJECT_ROOT>
规格文档：
/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md
视觉参考：/Users/cj/Downloads/k1.png 至 /Users/cj/Downloads/k7.png

任务：
1. 完整阅读规格文档与父工作区 AGENTS.md。
2. 确认 <NEW_PROJECT_ROOT> 不存在或为空；若已存在且含未知文件，不得覆盖，
   立即报告阻塞。
3. 使用 Vite + React + TypeScript 从零初始化新项目，Node 版本要求 >=22。
4. 配置严格 TypeScript、ESLint、Vitest、Testing Library 和 Playwright Chromium。
5. 建立规格第 3.4 节目录骨架；目录内可用 README/.gitkeep 或最小 index，
   但不要提前实现其他 Agent 的功能。
6. 建立最小 App 启动页、全局错误边界占位、测试 setup、Playwright webServer、
   540×960/1080×1920/390×693 三种 project/viewport 配置。
7. 建立 package scripts：dev、build、preview、lint、typecheck、test、
   test:e2e、test:visual、test:soak。
8. 添加 .gitignore、.nvmrc 或等价 Node 版本约束、README 初始运行说明。
9. 固定 lockfile，执行一次完整 lint/typecheck/unit/build/E2E smoke。
10. 输出项目树、依赖理由、命令结果和交给下游 Agent 的接口约定。

约束：
- 不引用父目录其他项目源码或 node_modules。
- 不复制其他 Kuku 项目文件。
- 不安装大型 UI 库、Next.js、SSR 框架或在线运行时。
- 不实现七个业务页面。
- 不把切片复制成生产背景。
- 如使用任何 Python 辅助，必须通过 uv。

验收：
- 在新项目目录内 npm install 后可独立 build。
- 断开网络后，已安装依赖的项目仍可启动生产静态包。
- smoke test 可打开最小页面，无 console error。
- 下游 Agent 能在同一 lockfile 与测试体系上并行工作。
```

### Prompt 1：架构与领域状态机 Agent

```text
你是 Kuku Coffee 售货机前端的架构与领域状态机负责人。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md

任务：
1. 完整阅读规格文档、AGENTS.md、Foundation Agent 交接、package.json 和测试配置。
2. 在新项目中从零实现七屏流程的类型安全状态机：
   welcome → impact → drink → customize → confirm → submitting
   → brewing → pickup → welcome。
3. 定义 Drink、Customization、OrderDraft、OrderSnapshot、KioskContext、
   KioskEvent、MachineOrderStatus 等类型。
4. 实现所有合法转换、不变量、返回规则、默认定制、capability 校验、
   session reset 和幂等提交上下文。
5. 确保 brewing/submitting 不会被普通 idle timeout 重置。
6. 提供纯函数或 Controller API，React 组件不得直接拼接业务状态。
7. 补充单元测试，覆盖正常流程、非法转换、返回、重置、价格、默认值、
   组合校验、重复提交和恢复所需状态。

约束：
- 不实现页面视觉。
- 不直接连接真实硬件。
- 不修改 Foundation Agent 的工具链，除非发现阻塞且给出说明。
- 不引用父目录中任何其他项目。
- 避免把中文文案作为业务 key。
- 所有时间相关逻辑可注入 clock，便于 fake timer 测试。

验收：
- typecheck/lint 通过。
- domain 单测全部通过。
- 输出修改文件清单、状态图摘要、关键不变量和执行过的命令。
```

### Prompt 2：设计系统、Kiosk Shell 与转场 Agent

```text
你是 Kuku Coffee 售货机前端的设计系统与全局壳层负责人。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md
参考切片：/Users/cj/Downloads/k1.png 至 /Users/cj/Downloads/k7.png

任务：
1. 阅读规格、Foundation Agent 交接与新项目的基础样式入口。
2. 建立颜色、字体、间距、圆角、阴影、z-index、safe-area 和 motion tokens。
3. 实现 KioskShell、StepProgress、BottomActionBar、ScreenTransition、
   Loading/Recovery/OutOfService 等共享组件。
4. 根页面适配 100dvh、机壳安全区、540×960、1080×1920、390×693，
   禁止全局横向滚动和浏览器 overscroll。
5. 实现前进、后退、提交、制作完成四类转场；动画只使用 opacity/transform。
6. 实现 prefers-reduced-motion 降级。
7. 避免 transition: all、布局属性动画和页面切换白屏。
8. 为共享组件补充组件测试。

约束：
- 不决定业务状态转换，只消费 direction/screen props。
- 不把切片当背景图。
- 不引入需要公网的字体、CSS 或动画库。
- 触控目标默认至少 56px，最低不得小于 44px。

验收：
- 三种视口无溢出、遮挡和底部按钮不可触达。
- 转场完成后旧页面卸载。
- Reduced Motion 下不做大幅位移。
- 输出修改文件、视觉 token、运行测试和已知差异。
```

### Prompt 3：资源与视觉基准 Agent

```text
你是 Kuku Coffee 项目的视觉资源与基准负责人。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md
输入：/Users/cj/Downloads/k1.png 至 /Users/cj/Downloads/k7.png

任务：
1. 检查七张切片尺寸、画布比例、主要颜色、图片边界和字体特征。
2. 把参考切片复制到项目约定的 reference 目录，只用于视觉回归，不用于生产页面铺图。
3. 仅清点新项目内由 Foundation Agent 建立的占位资源；根据七张切片列出仍需
   用户/设计方提供的 Kuku、饮品和公益生产素材，并建立 asset manifest。
4. 对生产资源生成合理尺寸的 WebP/AVIF 或项目支持格式，同时保留必要 fallback。
5. 固定图片 width/height/aspect-ratio，提供加载失败 fallback 规范。
6. 建立七屏视觉回归基准与截图命名约定。
7. 写明缺失素材、授权风险、需要设计方补充的项目。

约束：
- 如使用 Python 工具，必须通过 uv 运行。
- 不生成或虚构公益照片。
- 不从父工作区其他项目复制角色、饮品、公益或动画素材。
- 不在 JSX 中使用 /Users/... 的绝对路径。
- 不把整张切片用于生产 UI。

验收：
- 资源离线可读取。
- manifest 可被 TypeScript 校验。
- 输出资源清单、转换前后体积、缺失项与测试方法。
```

### Prompt 4：欢迎与公益页 Agent（k1–k2）

```text
你负责实现 Kuku Coffee 七屏流程的 k1 欢迎页与 k2 公益页。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md
视觉参考：/Users/cj/Downloads/k1.png、/Users/cj/Downloads/k2.png

任务：
1. 使用 Agent 1/2 在这个新项目内建立的 KioskShell、ScreenTransition、
   KukuStage 和领域事件；如果接口尚未就绪，按规格定义最小契约并通知集成 Agent。
2. 实现 k1 的 eyebrow、主标题、说明、Kuku、气泡与“开始点单”。
3. 点击 k1 CTA 派发 START_INTRO，进入 k2。
4. 实现 k2 的公益图片组合、年度统计、Kuku 感谢状态、气泡与 CTA。
5. 点击 k2 CTA 派发 START_ORDER，进入 k3。
6. 所有文案和公益数据进入 content 文件。
7. 公益图片失败时保留统计与 CTA。
8. 实现触控反馈、重复点击保护、键盘语义和 Reduced Motion。
9. 补充组件与流程测试。

约束：
- 严格保持 k1→k2 顺序。
- 不新增自动语音。
- 不让 Kuku 动画失败阻塞 CTA。
- 不硬编码公益统计在 JSX。
- 不使用整屏截图作为背景。

验收：
- 540×960 和实际目标视口视觉接近切片。
- CTA 首次点击只推进一次。
- 无网络仍可显示。
- 输出修改文件、视觉差异和测试结果。
```

### Prompt 5：饮品、定制、确认 Agent（k3–k5）

```text
你负责 Kuku Coffee 七屏流程的 k3 选择饮品、k4 基础定制和 k5 确认订单。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md
视觉参考：/Users/cj/Downloads/k3.png、k4.png、k5.png

任务：
1. 实现五步 StepProgress 在第 1、2、3 步的状态。
2. k3 渲染美式/拿铁/摩卡数据驱动卡片、价格、售罄、单选和下一步禁用。
3. k4 渲染甜度、冷热、奶基和奶盖 capability；所有组合由 domain 校验。
4. k4 当前选择摘要实时更新；返回饮品保留合法草稿。
5. k5 完整显示真实订单，不复制切片示例值。
6. k5 “修改定制”返回 k4；“开始制作”触发 SUBMIT_ORDER。
7. 实现 submitting、失败、unknown 状态下的按钮反馈和重复提交保护。
8. 整卡可点击，所有选项具备 radio 语义、focus-visible 和可见禁用原因。
9. 窄屏只允许内容区滚动，底部操作保持可达。
10. 补充组件和集成测试。

特别注意：
- k4 与 k5 的示例订单不一致，必须以 store 的用户选择为唯一真相。
- 奶盖功能未开放时必须明确禁用，不得假装提交成功。
- 价格使用整数分，不使用浮点数。
- 不在组件中直接调用真实 MachineAdapter。

验收：
- 正常、返回、售罄、不支持组合、重复点击全部测试通过。
- 三种视口无横向溢出。
- 输出修改文件、状态来源和测试结果。
```

### Prompt 6：制作、取杯与机器适配 Agent（k6–k7）

```text
你负责 Kuku Coffee 的 k6 制作页、k7 取杯页与 MachineAdapter 边界。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md
视觉参考：/Users/cj/Downloads/k6.png、k7.png

任务：
1. 定义/实现 MachineAdapter、MachineEvent 和 MockMachineAdapter。
2. Mock 必须支持正常、拒绝、submit unknown、断线、乱序进度、
   制作失败、cup removed 缺失和恢复场景。
3. k6 只根据机器状态渲染 queued/grinding/extracting/dispensing/completed；
   不用普通 timer 伪造真实完成。
4. 若 mock 模式使用定时推进，必须明确隔离在 MockMachineAdapter。
5. 进度单调、范围有界，乱序事件不造成 UI 倒退。
6. 断线保留最后状态并重连；严重失败进入明确处理页。
7. k7 显示真实完成状态、饮品和取杯提示；生产模式禁止“模拟完成”。
8. 支持 cup_removed 自动完成和无传感器 fallback。
9. 所有订阅、socket、timer 和 abort controller 正确清理。
10. 补充协议、集成与故障测试。

约束：
- 订单 ID 不匹配的机器事件必须拒绝。
- submit 超时不能直接重提；先查询状态。
- brewing 不能被 idle reset。
- 不把厂商错误原文直接展示给顾客。

验收：
- 正常与所有故障 mock 场景可重复运行。
- 刷新恢复不重复下单。
- 输出接口文档、修改文件、测试和仍需厂商确认的字段。
```

### Prompt 7：Kuku 动画与用户互动 Agent

```text
你负责 Kuku Coffee 的持续 Mascot 舞台、动画抽象和安全互动。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md

任务：
1. 从零建立 Mascot 动画模块。只检查新项目 asset manifest 和用户为本项目
   明确提供的素材，不读取或复制父工作区其他项目的动画代码与分层素材。
2. 建立 MascotRenderer 抽象，至少提供静态 fallback。
3. 全流程尽量保持一个持续 Kuku 实例；页面只改变 layout preset、cue、
   对话、look target 和 energy。
4. 实现 cue：idle、welcome、grateful、point-options、listen、approve、
   recap、grind、extract、dispense、celebrate、goodbye、concern、tap-delight。
5. 定义 cue 优先级、打断、冷却与去重。
6. 高频 telemetry 只能更新连续参数，不得逐包重播 trigger。
7. 点击 Kuku 在互动服务离线时也应有本地反馈。
8. Reduced Motion 关闭持续高幅动作，保留短状态反馈。
9. 动画/素材失败自动回退静态角色，购买流程不受影响。
10. 补充 trigger 生命周期、资源清理、reduced motion 和 fallback 测试。

隐私与安全：
- 不上传摄像头图像。
- 不存储人脸帧或身份数据。
- 不推断年龄、性别、情绪等属性。
- 检测不到用户不能阻止点单。

验收：
- 页面切换不出现 Kuku 白闪和重复加载。
- 高频事件不导致动作抖动。
- session 完成后 rAF/timer/listener 回到基线。
- 输出 renderer 接口、cue 表、修改文件和测试结果。
```

### Prompt 8：稳定性、恢复与可观测性 Agent

```text
你负责 Kuku Coffee kiosk 的长期运行稳定性、恢复、离线与日志。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md

任务：
1. 实现统一 idle reset：welcome 不重置，impact 30s，
   drink/customize/confirm 45s 提示、60s 重置，
   submitting/brewing 禁止 idle reset，pickup 配置化完成。
2. 使用绝对时间和可注入 clock，后台 timer 节流后仍准确。
3. 实现 Error Boundary、unhandled error logging 和安全恢复。
4. 实现 RecoverySnapshotStore；提交后保存最小恢复快照，
   完成后原子清理。
5. 启动时有快照则进入 recovering，查询机器而不是重新提交。
6. 实现离线核心资源检查、asset fallback 与服务不可用页。
7. 建立匿名滚动日志和事件结构，限制磁盘/存储占用。
8. 提供 watchdog heartbeat 接口供 kiosk 宿主使用。
9. 编写自动循环流程和故障注入脚本，为 72 小时/1000 单长稳测试做准备。
10. 补充 timer 清理、恢复、离线和日志轮转测试。

约束：
- 不记录摄像头图像、身份或完整敏感订单信息。
- 不把刷新当成新订单。
- 不在故障时无限 loading。
- 如使用 Python 脚本，必须通过 uv 管理和运行。

验收：
- reload/断线/前端错误不会重复提交。
- session 完成后快照、timer、listener 清理。
- 输出运行手册、故障注入方式、修改文件和测试结果。
```

### Prompt 9：Integration Agent

```text
你是 Kuku Coffee 七屏售货机前端的集成负责人。多个 Agent 已分别完成
状态机、壳层、七屏页面、机器适配、Mascot 和稳定性代码。

新项目：<NEW_PROJECT_ROOT>
规格文档：/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md

任务：
1. 阅读全部改动、Agent 交付说明和 git diff，禁止直接丢弃他人改动。
2. 统一共享类型、事件名、组件 props、路径、tokens 和 content 数据。
3. 解决编译、lint、测试和视觉冲突。
4. 手动走通：
   k1→k2→k3→k4→k5→k6→k7→k1。
5. 验证返回、售罄、重复提交、submit unknown、断线恢复、制作失败、
   cup sensor 缺失、idle reset、Reduced Motion 和离线。
6. 确认 Kuku 在全流程中无白闪，动画失败可降级。
7. 确认生产模式不出现“模拟完成”，也不依赖公网。
8. 运行全量 lint、typecheck、unit、integration、E2E、visual 和 build。
9. 更新 README：运行、mock 场景、环境变量、实机配置、恢复与测试。
10. 输出剩余风险；不得用跳过测试掩盖问题。

验收：
- 全量检查通过。
- 主流程及异常流程有可复现证据。
- 无未解释的 console error、未处理 promise、重复订阅和资源泄漏。
- 提交最终修改文件清单、命令结果和已知设备依赖。
```

---

## 22. 独立 Test Agent Prompt

```text
你是独立 Test Agent，不参与功能开发。你的目标是以对抗性方式验证
Kuku Coffee 七屏售货机前端是否满足规格，而不是证明开发者的实现正确。

新项目：<NEW_PROJECT_ROOT>
唯一产品规格：
/Users/cj/polyugdut/Kuku_Coffee_七屏切片_售货机前端完整开发文档.md
视觉参考：
/Users/cj/Downloads/k1.png 至 /Users/cj/Downloads/k7.png

测试职责：

A. 静态检查
1. 阅读 AGENTS.md、package.json、README、状态机、MachineAdapter、Mascot、
   页面和测试代码。
2. 搜索整图热点、硬编码示例订单、中文业务 key、transition: all、
   公网资源、未清理 timer/socket/listener、模拟文案泄漏和重复提交风险。
3. 检查生产代码是否绕过领域状态机。

B. 构建与基础质量
1. 从干净依赖状态执行项目规定的 install/build/typecheck/lint/test。
2. 不删除测试、不更新 snapshot 来掩盖视觉差异。
3. 记录每个失败的原始命令、退出码与最小复现。

C. 状态机和订单正确性
1. 验证合法路径和所有非法跳转。
2. 验证 k4 与 k5 始终显示用户真实选择。
3. 验证价格用整数分且提交快照冻结。
4. 双击、三击“开始制作”只产生一个 clientOrderId/机器订单。
5. submit 超时但已接受时不得重新下单。

D. 页面与视觉
1. 在 540×960、1080×1920、390×693 和真实设备视口截图。
2. 对 k1-k7 做视觉 diff，检查字体、留白、角色尺寸、按钮、卡片、
   步骤条、进度条、溢出和遮挡。
3. 检查窄屏内容区滚动与底部 CTA 可达。
4. 验证所有图片失败 fallback。

E. 动画与性能
1. 录制所有前进、后退、提交、完成转场。
2. 检查重复点击、快速返回、转场中机器 completed/failed 抢占。
3. 统计 frame time、dropped frames、触控反馈和 CLS。
4. Reduced Motion 下验证无大幅位移、弹跳或持续动画。
5. 验证 Kuku 高频 telemetry 不导致 trigger 重播。

F. 硬件与恢复
使用 MockMachineAdapter 逐项测试：
1. 正常制作。
2. 接单拒绝。
3. submit unknown 但查询发现已接受。
4. 进度乱序。
5. socket 断开/恢复。
6. 制作失败。
7. completed 后无 cup sensor。
8. brewing 刷新恢复。
9. recovery 中订单 not found。
10. 所有饮品售罄。

G. 无操作与长稳
1. fake clock 验证所有页面 timeout。
2. brewing/submitting 绝不能被 idle reset。
3. 循环至少 300 单作为 CI 验收；条件允许执行 1000 单/72h。
4. 对比热身后与结束后的 heap、DOM、listener、timer、socket。

H. 离线与隐私
1. 完全断网冷启动，七屏核心流程仍可加载。
2. 搜索并监控所有网络请求，不允许核心资源走 CDN。
3. 确认不上传/保存摄像头帧、人脸身份或属性。
4. 日志轮转有效且不含敏感数据。

缺陷报告格式：
- ID：
- 严重级别：Blocker / Critical / Major / Minor
- 标题：
- 规格条款：
- 环境与构建版本：
- 前置条件：
- 复现步骤：
- 实际结果：
- 期望结果：
- 证据：截图、视频、日志、trace
- 最可能模块：
- 是否稳定复现：

放行标准：
- Blocker = 0
- Critical = 0
- Major 必须全部关闭或有产品负责人书面接受
- 主流程、恢复、幂等、离线和制作状态不得有已知缺陷
- 全量自动化测试通过
- 视觉差异在规格容差内
- 至少完成规定的最低长稳测试

最终输出：
1. 总体结论：PASS / PASS WITH ACCEPTED RISKS / FAIL。
2. 覆盖矩阵。
3. 缺陷列表。
4. 性能与长稳数据。
5. 未覆盖项及原因。
6. 明确建议是否允许部署到售货机。

注意：不要直接修复产品代码。发现缺陷后提供最小复现和证据，交还对应实现
Agent；只有测试本身错误时才可修改测试。
```

---

## 23. Agent 交接模板

每个实现 Agent 完成后使用以下格式：

```text
任务：

完成内容：
- 

修改文件：
- 

关键接口/决策：
- 

已运行：
- command → result

未完成或风险：
- 

需要下游 Agent 注意：
- 
```

Test Agent 缺陷发回对应实现 Agent 时，应只发送：

```text
请修复缺陷 <ID>。
规格条款：
最小复现：
实际/期望：
证据路径：
只修改与你模块相关的代码；修复后补回归测试并返回命令结果。
```

---

## 24. 推荐实施顺序

1. 冻结内容、饮品价格、默认定制和奶盖能力。
2. 建立领域状态机、机器接口和 mock。
3. 建立 tokens、KioskShell、StepProgress 和 ScreenTransition。
4. 整理与优化 Kuku、饮品、公益资源。
5. 实现 k1–k5 可操作流程。
6. 实现 k6–k7 机器驱动流程。
7. 接入持续 Kuku renderer 与 cue。
8. 加入恢复、idle、错误边界、日志和 watchdog。
9. 完成全量自动化与视觉回归。
10. 在目标售货机上做触控、性能、断电和长稳验收。

---

## 25. 上线前必须由产品/硬件确认的事项

- 真实设备分辨率、DPR、系统和 WebView/浏览器版本。
- 屏幕机壳四边安全区。
- 三款饮品的真实价格、配方与售罄规则。
- 甜度、冷热、奶基的真实机器能力。
- 奶盖图案是否真的可用；“自定义”是否存在编辑器与硬件协议。
- 公益图片授权与 326/12/48 万的真实性及更新机制。
- 真实 MachineAdapter 协议、错误码、重试、幂等和状态查询。
- 是否存在 cup removed 传感器。
- 制作失败、扣费、退款和人工协助流程。
- 无操作时间和 pickup 自动返回时间。
- 是否启用摄像头互动；隐私告知、数据边界和当地合规要求。
- 生产界面是否保留价格；如有支付，支付步骤插入位置和安全合规另立规格。

---

## 26. 最终验收摘要

该前端的正确完成标准不是“七张图看起来差不多”，而是：

```text
视觉上：
像切片，比例稳定，触控清晰，Kuku 连续且有生命力。

交互上：
每一步只有明确任务，前进与返回有方向感，转场丝滑且不误触。

业务上：
订单状态唯一、提交幂等、制作由机器事件驱动、刷新可恢复。

设备上：
离线可启动、长期运行不泄漏、故障可解释、异常不重复下单。

未来上：
Kuku 动画和互动可替换升级，而无需重写点单状态机。
```
