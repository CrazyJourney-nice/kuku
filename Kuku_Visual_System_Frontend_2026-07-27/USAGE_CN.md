# Kuku Coffee 视觉系统 Frontend 使用说明

## 1. 这是什么

这是当前 Kuku Coffee 七屏竖屏售货机前端的可开发源码包。它保留了界面运行、视觉呈现、交互流程、机器 Mock、状态恢复、测试和 Cloudflare/Vinext 构建所需的目录结构。

交互顺序为：

`欢迎 → 品牌公益 → 选择饮品 → 基础定制 → 确认订单 → 制作中 → 取杯完成`

目标设备为 `1080 × 1920` 竖屏触控屏，同时提供 `540 × 960` 和 `390 × 693` 的响应式验证。

## 2. 环境要求

- Node.js `>= 22.13.0`
- npm
- macOS、Windows 或 Linux

本包没有包含 `node_modules`、构建产物或本机缓存，避免交付体积过大及平台依赖污染。

## 3. 安装与启动

在本文件所在目录打开终端：

```bash
npm install
npm run dev
```

终端显示地址后，用浏览器打开该地址即可。

如需指定本地端口：

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

## 4. 生产构建与质量检查

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:visual
```

Playwright 首次使用时，如果本机尚未安装 Chromium，需要先执行：

```bash
npx playwright install chromium
```

## 5. 主要文件与修改入口

| 路径 | 用途 |
| --- | --- |
| `app/KioskApp.tsx` | 七屏界面、主要交互与界面组合入口 |
| `app/globals.css` | 当前颜色、字体、间距、组件外观、动效与响应式规则 |
| `app/layout.tsx` | 页面布局、viewport 与全局样式载入 |
| `src/components/` | 步骤条、转场、错误边界、Kuku 舞台与图片切片组件 |
| `src/content/` | 中文文案、饮品资料、价格和公益内容 |
| `src/domain/` | 点单状态机、订单结构、校验、进度和 idle 策略 |
| `src/features/localVision/` | 本地视觉状态、Kuku 注视目标与语音开关界面连接 |
| `src/infrastructure/` | Mock 机器、恢复快照与匿名日志 |
| `public/assets/reference/` | 当前七屏实际使用的原始视觉参考图 |
| `tests/e2e/visual.smoke.spec.ts-snapshots/` | 三种屏幕尺寸下的视觉基线图 |
| `worker/`、`build/`、`.openai/` | Vinext/Cloudflare 构建和托管支持 |

## 6. 常见修改方式

### 修改颜色、圆角、字号或间距

优先编辑 `app/globals.css`。修改后至少运行：

```bash
npm run typecheck
npm run test:visual
```

### 修改页面文案、饮品或价格

- 通用文案：`src/content/copy.zh-CN.ts`
- 饮品、价格和可选能力：`src/content/drinks.ts`
- 公益内容：`src/content/impact.ts`

价格使用整数分，不要使用浮点元。

### 修改页面结构或交互

入口为 `app/KioskApp.tsx`。业务状态变化应继续放在 `src/domain/`，不要把机器协议直接写进 React 组件。

### 替换 k1–k7 参考图

替换 `public/assets/reference/` 中同名文件，并保持文件名不变。随后在三种目标尺寸上运行视觉测试，检查裁切位置、文字溢出和触控区域。

## 7. 本地视觉与语音说明

界面会尝试连接：

- HTTP：`http://127.0.0.1:8765`
- WebSocket：`ws://127.0.0.1:8765/ws/telemetry`

该地址对应独立的本地视觉/语音算法运行时，不属于 frontend 源码，因此没有放入本包。运行时未启动时，点单主流程仍可使用，隐私栏会显示“本地视觉模型未连接”。

## 8. Mock 机器场景

可在 URL 后增加以下参数：

```text
?scenario=normal
?scenario=rejected
?scenario=unknown
?scenario=failure
?scenario=disconnect
?scenario=out-of-order
?scenario=sold-out
```

实机接入时，请实现 `src/infrastructure/machine/MachineAdapter.ts` 定义的接口，再替换当前 Mock 实例。

## 9. 托管注意事项

`.openai/hosting.json` 记录当前 Sites 项目关联。转交给其他账号或新项目时，应使用接收方自己的托管项目配置；不要误覆盖原项目。

## 10. 包内未包含内容

- `node_modules/`
- `.git/`
- `.vinext/`、`dist/`、`outputs/`、`.wrangler/`
- 历史整包交付副本
- 独立的视觉/语音算法后端及 Python 虚拟环境
- Kuku 的 Illustrator/Rive 设计源文件（这些位于单独的 UI 设计资产包）

更完整的产品与开发背景见 `README.md` 和 `Kuku_Coffee_Seven_Screen_Frontend_Development_Guide_CN.md`。
