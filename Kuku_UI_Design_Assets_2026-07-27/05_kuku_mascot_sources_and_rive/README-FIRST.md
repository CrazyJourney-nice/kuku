# Mascot Rive Tracking Pilot v1 — Transfer Package

呢個 ZIP 已經包含可直接運行嘅 production build、local Rive WASM、
runtime `.riv`、TypeScript source、automated tests、QA reports、source artwork
同 reference angles。

一般 preview **唔需要 `npm install`，亦唔需要 Internet**。收件人只需要安裝
[Node.js](https://nodejs.org/) 18 或以上版本。

## 最快啟動

### macOS

1. 解壓整個 ZIP。
2. Double-click `START-MAC.command`。
3. 如 macOS 第一次阻擋，right-click 檔案、選擇 **Open**。

### Windows

1. 解壓整個 ZIP。
2. Double-click `START-WINDOWS.bat`。

### Linux

在 package folder 執行：

```bash
chmod +x start-linux.sh
./start-linux.sh
```

Browser 會打開 `http://127.0.0.1:4173/`。畫面上方應顯示：

```text
Rive runtime active
MascotTracking_1254 · SM_MascotTracking · VM_MascotTracking
```

停止 preview：返回 Terminal／Command Prompt，按 `Ctrl+C`。

如果 port `4173` 已被佔用，可執行：

```bash
node server.mjs --port 4174 --open
```

請勿直接 double-click `harness/dist/index.html`；WebAssembly 同 `.riv`
必須經本 package 嘅 local HTTP server 載入。

## 驗證 package

macOS / Linux：

```bash
node verify-package.mjs
```

Windows：

```bat
node verify-package.mjs
```

Verifier 會檢查 required files、SHA-256、local Rive WASM、MIME type，
並短暫啟動 local server 做 HTTP smoke test。

## Controls

- `targetPresent`、`targetX/Y`、`confidence` 模擬 ML input。
- Nine-point presets 測試 horizontal、vertical 同 diagonal poses。
- `Slow walk`、`Fast crossing`、`Left edge entry` 測試 tracking path。
- `Lose target`、`Reacquire`、`Inject fault`、`Reset pilot` 測試 lifecycle。
- `Jitter injection` 測試 dead zone 同 One Euro Filter。

Controller flow：

```text
IDLE → ACQUIRE → TRACK → HOLD → RETURN → IDLE
```

Eyes 使用較快 response，body 使用較慢 damping，所以 eyes 會先 capture
target，body 跟上之後 eyes residual 會自然減少。

## Developer rebuild

Rebuild 需要 Node.js `^20.19.0` 或 `>=22.12.0`、npm 同 Internet：

```bash
cd harness
npm ci
npm test
npm run build
```

Expected result：

```text
Test Files  3 passed
Tests       18 passed
Build       PASS
```

`harness/` 同 `rive/` 必須保持 sibling folders，因為 Vite build 會由
`../rive` 複製 runtime asset。

## ML integration

Production ML adapter 應輸出：

```ts
interface NormalizedTrackingSample {
  targetPresent: boolean;
  targetX: number;       // -1 viewer-left → +1 viewer-right
  targetY: number;       // -1 down → +1 up
  confidence: number;    // 0...1
  timestampMs: number;
}
```

請參閱 `rive/mascot-tracking-pilot-v1-integration-contract.md`。Camera
mirroring、multi-person selection、confidence gating 同 transport 留喺 host
controller；Rive runtime 只接收 normalized values。

## Package contents

```text
harness/           production build、TypeScript source、tests
rive/              canonical .riv 同 integration contract
qa/rive/           runtime/import reports 同 3×3 pose screenshots
qa/source-validation/
source-assets/     corrected Illustrator master 同 runtime SVG
reference-angles/  supplied direction references
server.mjs         zero-dependency local HTTP server
verify-package.mjs package integrity and HTTP verifier
SHA256SUMS.txt     file integrity manifest
```

## 已知限制（重要）

- 呢個係可運行嘅 **2.5D tracking pilot**。現有 `.riv` 使用 transform /
  parallax deformation；唔係完整 hand-authored ±45° topology-preserving
  shell morph。
- Lifecycle 同 filtering 主要由 TypeScript host controller 管理，唔係全部
  transition logic 都封裝喺 Rive State Machine。
- 現有 runtime 冇完整 explicit pupil clipping。
- Package 有 runtime `.riv`，但 **冇 editable `.rev` backup**。`.rev` 必須
  由 Rive Editor 建立並 export；本 package 冇虛構或改名代替。
- Final vending-machine hardware FPS、camera calibration 同 ML transport
  仍需喺實機驗收。

詳細證據請參閱 `qa/rive/rive-runtime-validation-report.md`。
