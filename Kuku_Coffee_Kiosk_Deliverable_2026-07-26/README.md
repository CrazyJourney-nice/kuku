# Kuku Coffee 一体化智能售货机

面向 1080×1920 竖屏触控咖啡售货机的单页应用。产品严格按以下顺序运行：

```text
品牌公益 → 欢迎 → 选择饮品 → 基础定制 → 确认订单
→ 制作中 → 取杯完成 → 欢迎
```

七个页面均为真实 React 组件，不使用整屏切片热点。核心业务由纯 TypeScript 状态机驱动，机器协议隔离在 `MachineAdapter`，开发环境使用确定性的 `MockMachineAdapter`。本交付包同时包含本地视觉识别、匿名跟踪、Kuku 眼神跟随和三段本地 voice，不再依赖外部测试 bundle。

## 环境与启动

- Node.js `>=22.13.0`
- Apple Silicon macOS 14+
- Python 3.11/3.12
- UV Python 包与项目管理器
- 首次安装：

```bash
npm install
npm run local-ai:sync
```

- 一体化本地启动：

```bash
npm run dev:local
```

浏览器打开 <http://127.0.0.1:4174>。该命令同时启动主前端与 `127.0.0.1:8765` 本地算法服务；按 `Ctrl+C` 会一起停止两个子进程。

- 如果 `4174` 已占用，可用 `KUKU_FRONTEND_PORT=4176 npm run dev:local` 覆盖前端端口。
- 仅启动前端（不含视觉/voice）：`npm run dev`
- 生产构建：`npm run build`
- 快速验证闲置返回：打开 <http://127.0.0.1:4174/?idleTest=1>，进入第二页或点单页后停止操作；2 秒出现“即将回到首页”，再过 3 秒自动返回。此参数只在本机/私有局域网地址生效，普通地址仍严格使用 90 秒等待 + 10 秒倒计时。

本地预览默认由 Vite/Vinext 启动。界面业务全部在客户端运行，不需要数据库、登录、远程字体、CDN 或在线图片。视觉模型、摄像头推理和音频只在本机运行；页面不会展示摄像头画面或人脸框，也不会持久化相关数据。

## 已实现能力

- 七屏主流程、返回修改、重置确认和重复提交保护
- 下一页从右侧滑入、上一页从左侧滑入；单页合成转场与图片预解码
- 美式、拿铁、摩卡的数据驱动选择与 capability 校验
- 甜度、冷热、奶基、奶盖图案定制；不支持选项即时禁用
- 订单冻结快照、整数分价格和稳定幂等键
- 制作阶段、单调进度、乱序事件过滤与订单 ID 校验
- 提交未知、断线恢复、制作失败、售罄和服务不可用场景
- 本地 RecoverySnapshot，含 schema、TTL 与存储降级
- 统一 idle 策略：安全页面连续 90 秒无点击后显示 10 秒返回首页倒计时；提交、制作与恢复阶段不会中断订单；自动返回首页 5 秒后 Kuku 闭眼瞌睡
- 持续 Kuku 舞台、cue 状态、点击反馈与 Reduced Motion
- 饮品选择、定制选择、直接点击 Kuku 与所有页面每隔随机 8–14 秒的自主互动，统一使用相同的 `tap-delight` 表情、动作时长和恢复逻辑
- Kuku 原始外观上的分页面眼睛锚点、平滑视觉目标跟随与 settled 回执
- 首页默认保留闭眼表情；本地接近问候语音触发后用 3 秒睁眼
- 睁眼后显示真实 10 秒自动进入欢迎页倒计时，可取消并在 2 分钟后再次提示
- 首页“开始点单”按钮直接进入饮品选择页，自动倒计时仍进入欢迎页
- 清晰的“正在识别 / 已识别到访客 / 摄像头已关闭”本地视觉状态
- MediaPipe、OpenCV、OpenVINO 本地视觉推理与匿名几何跟踪
- 接近时播放附近问候；首页等待 10 秒并进入第二页时播放快速购买提示
- 订单确认进入制作状态后播放购买致谢；三段语音均在本机播放
- 前两页显示隐私说明；全程提供语音开关和临时摄像头关闭/重开按钮
- 不展示人脸、摄像头画面或人脸框
- safe-area、100dvh、390×693 / 540×960 / 1080×1920 触控布局
- Error Boundary、脱敏滚动日志与离线核心资源

Kuku 姿态、三款饮品和公益照片均直接使用用户提供的 `k1.png`–`k7.png` 原始像素，并在语义化组件中裁切显示；没有使用 CSS 重绘替代物，也没有把整屏切片当作点击热区。公益数字目前来自 `src/content/impact.ts`，生产发布前仍须由品牌方确认真实性与图片授权。

## Mock 机器场景

在 URL 增加 `scenario` 参数可切换：

```text
?scenario=normal
?scenario=rejected
?scenario=unknown
?scenario=failure
?scenario=disconnect
?scenario=out-of-order
?scenario=sold-out
```

场景均由 `src/infrastructure/machine/MockMachineAdapter.ts` 提供固定时序，不依赖随机数。接入实机时，实现相同的 `MachineAdapter` 接口并替换实例，不要把 PLC、串口、HTTP、WebSocket 或厂商 SDK 写入 React 组件。

## 恢复与实机接入

提交后仅保存恢复必需的订单快照、订单 ID 和最后机器状态。启动发现快照时进入恢复界面，并查询机器订单；不会重新提交。完成 session 后原子清除快照、订单 ID 和订阅。

上线前仍需由产品/硬件确认：

- 实机分辨率、DPR、WebView 版本和四边 safe-area
- 饮品真实价格、配方、库存及各定制能力
- 奶盖图案与自定义图案是否真实可用
- 机器 ready、提交、查询、幂等、错误码和重连协议
- cup removed 传感器及制作失败后的人工/退款流程
- 公益数字与图片授权

## 测试

```bash
npm run lint
npm run typecheck
npm test
npm run local-ai:test
npm run verify:local
npm run test:e2e
npm run test:visual
KUKU_SOAK_CYCLES=300 npm run test:soak
npm run build
```

- `npm test`：Vitest 组件基础检查 + Node 领域/机器/恢复/日志测试
- `local-ai:test`：本地视觉、匿名跟踪、接近度、注意力与 voice 策略测试
- `test:e2e`：三种触控视口的主流程、返回确认、数据一致性和溢出检查
- `test:visual`：三种视口下的 k1–k7 截图附件
- `test:soak`：完整 session 循环，可用 `KUKU_SOAK_CYCLES` 调整次数

300 次是 CI 最低长稳门槛；1000 次/72 小时和真实设备的湿手、手套、断电、拔网、强光与温升测试需要在目标售货机上执行。

## 主要目录

```text
app/                         页面入口、KioskApp 与全局视觉系统
src/components/              步骤条、错误边界、持续 Kuku 舞台
src/content/                 中文文案、饮品与公益配置
src/domain/                  状态机、订单、校验、进度、idle
src/infrastructure/machine/  MachineAdapter 与确定性 Mock
src/infrastructure/          恢复快照与匿名日志
local-ai/backend/            本地视觉、匿名跟踪、决策、voice 与 API
local-ai/models/             MediaPipe 与 OpenVINO 本地模型
local-ai/config/             视觉、接近度与 voice 固定策略
scripts/dev-local.mjs        一键启动/停止前端与本地算法
tests/domain/                领域与基础设施测试
tests/e2e/                   触控、视觉与长稳测试
```
