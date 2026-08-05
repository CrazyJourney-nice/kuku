# Kuku Coffee 七屏售货机前端

面向 1080×1920 竖屏触控咖啡售货机的单页应用。产品严格按以下顺序运行：

```text
欢迎 → 品牌公益 → 选择饮品 → 基础定制 → 确认订单
→ 制作中 → 取杯完成 → 欢迎
```

七个页面均为真实 React 组件，不使用整屏切片热点。核心业务由纯 TypeScript 状态机驱动，机器协议隔离在 `MachineAdapter`，开发环境使用确定性的 `MockMachineAdapter`。

## 环境与启动

- Node.js `>=22.13.0`
- 首次安装：`npm install`
- 本地开发：`npm run dev`
- 生产构建：`npm run build`

本地预览默认由 Vite/Vinext 启动。界面业务全部在客户端运行，不需要数据库、登录、远程字体、CDN 或在线图片。

## 已实现能力

- 七屏主流程、返回修改、重置确认和重复提交保护
- 美式、拿铁、摩卡的数据驱动选择与 capability 校验
- 甜度、冷热、奶基、奶盖图案定制；不支持选项即时禁用
- 订单冻结快照、整数分价格和稳定幂等键
- 制作阶段、单调进度、乱序事件过滤与订单 ID 校验
- 提交未知、断线恢复、制作失败、售罄和服务不可用场景
- 本地 RecoverySnapshot，含 schema、TTL 与存储降级
- 统一 idle 策略：welcome 永不重置，impact 30 秒，点单页 45/60 秒，制作阶段不重置，pickup 30 秒
- 持续 Kuku 舞台、cue 状态、点击反馈与 Reduced Motion
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
npm run test:e2e
npm run test:visual
KUKU_SOAK_CYCLES=300 npm run test:soak
npm run build
```

- `npm test`：Vitest 组件基础检查 + Node 领域/机器/恢复/日志测试
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
tests/domain/                领域与基础设施测试
tests/e2e/                   触控、视觉与长稳测试
```
