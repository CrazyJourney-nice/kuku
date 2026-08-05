# Kuku Coffee UI 设计资产使用说明

## 1. 这是什么

这是当前 Kuku Coffee 七屏售货机 UI 的设计交接包，包含设计与开发文档、七屏参考切片、三种目标尺寸的视觉基线、前端视觉实现参考，以及 Kuku 吉祥物的 Illustrator、SVG、Rive 和 QA 文件。

仓库中没有发现 `.fig`、`.sketch`、`.xd` 或 `.psd` 文件；现有最高层级的可编辑吉祥物源文件是 `.ai`，七屏 UI 的主要原始输入是 PNG 参考切片，当前可执行设计规则集中在 CSS 和 React 组件中。

## 2. 目录说明

### `01_design_docs/`

- `Kuku_Coffee_Seven_Screen_Frontend_Development_Guide_CN.md`：页面结构、状态、组件、布局、资产和验收说明。
- `Current_Frontend_README_CN.md`：当前实现范围、运行方式和产品约束。

建议设计师先阅读完整开发文档中的七屏顺序、目标分辨率、交互状态和视觉验收章节。

### `02_screen_reference_slices/`

包含当前项目保存的所有七屏参考 PNG：

- `k1.png`：欢迎
- `k2.png`、`k2-impact.png`：品牌公益
- `k3.png`：选择饮品
- `k4.png`：基础定制
- `k5.png`：确认订单
- `k6.png`：制作进度
- `k7.png`：取杯完成

这些文件既用于视觉对照，也被当前前端以语义化裁切方式使用。替换时应保留原文件，并以新版本号或日期另存。

### `03_visual_regression_baselines/`

`visual.smoke.spec.ts-snapshots/` 内有七个页面在三种尺寸下的当前实装截图，共 21 张：

- `1080 × 1920`：售货机完整目标尺寸
- `540 × 960`：逻辑半尺寸
- `390 × 693`：窄屏验证尺寸

文件名格式为：

```text
k[页面]-[名称]-[视口]-darwin.png
```

`visual.smoke.spec.ts` 是生成和比对这些截图的 Playwright 测试，可供开发人员确认设计还原结果。

### `04_frontend_visual_implementation/`

这是设计交接所需的实现参考，不是独立可运行项目：

- `app/globals.css`：颜色、字体、间距、圆角、阴影、动效和响应式规则。
- `app/KioskApp.tsx`：七屏组件结构与状态界面。
- `src/components/`：Kuku 舞台、步骤条、转场、切片和错误界面。
- `src/content/`：界面文案、饮品和公益内容。
- `src/features/`：本地视觉隐私栏和语音控制状态。

需要实际运行或继续开发时，请使用单独的 Frontend 包。

### `05_kuku_mascot_sources_and_rive/`

重点文件：

- `source-assets/mascot-interactive-topology-v1-master.ai`：Illustrator 主源文件。
- `source-assets/mascot-interactive-topology-v1-runtime.svg`：运行时 SVG。
- `rive/mascot-tracking-pilot-v1.riv`：Rive 文件。
- `rive/mascot-tracking-pilot-v1-integration-contract.md`：动画与前端接入约定。
- `reference-angles/`：正面、左右 45°、抬头、低头和侧面参考。
- `qa/`：Rive 姿态与 Illustrator 源文件验证结果。
- `harness/`：可运行的 Rive/注视追踪演示与源码。

使用前先阅读该目录中的 `README-FIRST.md`。需要验证交付完整性时，可按照该目录文档执行 `verify-package.mjs`。

### `06_brand_preview/`

`og.png` 是当前项目的品牌/分享预览图，可用于交付预览或页面分享图对照。

## 3. 推荐设计工作流

1. 先阅读 `01_design_docs/`，确认七屏业务顺序和设备约束。
2. 用 `02_screen_reference_slices/` 作为视觉意图输入。
3. 用 `03_visual_regression_baselines/` 检查当前实装效果，而不是把基线截图当作新的可编辑源文件。
4. 对照 `04_frontend_visual_implementation/app/globals.css`，整理或修改设计 token。
5. 吉祥物改动从 `.ai` 主文件开始，更新 SVG/Rive 后重新执行 `05_kuku_mascot_sources_and_rive/qa/` 中对应验证。
6. 将确认后的设计变化交给 Frontend 包实现，并重新生成三种尺寸的视觉基线。

## 4. 设计约束

- 主目标为 `1080 × 1920` 竖屏触控设备。
- 需要同时检查 `540 × 960` 和 `390 × 693`。
- 需考虑 safe-area、`100dvh`、触控目标尺寸和 Reduced Motion。
- Kuku 是跨七屏持续存在的角色，不应在页面切换时无故重置。
- 公益数字、饮品价格、图片和字体授权在生产发布前仍需品牌方确认。
- 七屏 PNG 是参考输入，不应作为整屏点击热区直接上线。

## 5. 打开文件所需软件

- `.md`：任意 Markdown 编辑器或 VS Code。
- `.png`：任意图片查看器、Photoshop、Affinity Photo 等。
- `.ai`：Adobe Illustrator。
- `.svg`：Illustrator、Figma 导入、Affinity Designer 或浏览器。
- `.riv`：Rive Editor。
- `.tsx`、`.css`：VS Code 或其他代码编辑器。

## 6. 版本管理建议

- 不要覆盖原始资产；新版本使用日期或版本号。
- 每次改动同时记录：源文件、导出文件、目标尺寸截图和变更说明。
- Rive/AI 更新后同步更新校验报告或 SHA-256 清单。
- 视觉基线只在设计变更已确认后更新，避免把意外回归固化为“正确结果”。
