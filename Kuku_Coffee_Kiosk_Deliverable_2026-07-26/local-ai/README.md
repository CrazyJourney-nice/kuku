# Kuku 本地视觉与语音运行包

本目录是主 Kuku 前端的本地算法运行时，不包含独立的人脸展示或摄像头预览页面。

```text
本机摄像头
→ MediaPipe 人脸关键点
→ 匿名几何跟踪
→ OpenCV 头部姿态 + OpenVINO 视线估计
→ 接近度与注意力决策
→ 主前端 Kuku 眼睛
→ 两阶段视觉语音 + Kuku 页面／订单事件语音
```

## 边界

- 服务只监听 `127.0.0.1:8765`。
- 摄像头帧、关键点和跟踪数据不持久化、不上传。
- 不做人脸身份识别，不保存 embedding 或生物特征标识。
- 语音默认开启，可随时在主界面关闭。
- 接近度使用归一化人脸宽度比例，不代表物理距离。

## 内容

- `backend/app/`：感知、匿名跟踪、决策、运行时与本地 API。
- `backend/tests/`：注意力、接近度、语音旅程与数据包测试。
- `backend/pyproject.toml`、`backend/uv.lock`：UV Python 环境。
- `models/`：MediaPipe 与 OpenVINO 本地模型。
- `config/`：固定演示策略。
- `demo_assets/audio/`：附近问候、进入第二页提示与订单确认致谢三段本地语音。
- `contracts/`：遥测数据契约。

主项目根目录执行 `npm run dev:local` 会同时启动本目录的算法服务与 Kuku 前端。
