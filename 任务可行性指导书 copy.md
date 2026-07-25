# 街边 AI 公仔互动咖啡售卖机：任务可行性指导书
# Street-side AI Character Interactive Coffee Vending Machine: Feasibility Guide

**版本 / Version：** 1.0  
**依据 / Basis：** `design.md`——大屏、AI 公仔视觉互动、人脸检测与类似 Center Stage 的跟随效果。  
**核心原则 / Core principle：** 用“可被用户感知的陪伴与便利”推动购买，而非把摄像头或动画本身当作卖点。  

---

## 1. 产品定位 / Product positioning

这是一台部署于街边、园区、商场入口、交通枢纽等高流量场景的**AI 互动咖啡售卖机**。它以高可见度大屏和有生命感的 AI 公仔吸引路人，通过简短、可跳过的互动，将“想喝咖啡”转化为“现在就买一杯”的即时行动。

This is an **AI-interactive coffee vending machine** for high-footfall locations such as streets, campuses, mall entrances, and transit hubs. A prominent screen and lively AI character draw attention, then turn “I might want coffee” into “I’ll buy one now” through brief, skippable interaction.

**一句话价值主张 / One-line value proposition**  
在你需要提神、犹豫选择或只是路过的几十秒里，给你一杯适合当下状态的咖啡，以及一次轻松、有回应的微型体验。  
In the few seconds when a person needs a boost, hesitates over a choice, or simply passes by, offer a coffee suited to the moment and a light, responsive micro-experience.

---

## 2. 市场痛点 / Market pain points

| 市场痛点 / Pain point | 对顾客的影响 / Customer impact | 对企业的影响 / Business impact |
| --- | --- | --- |
| 自动售卖机同质化、容易被忽略 / Vending machines look alike and are easily ignored | 路过但没有购买动机 / People pass by without a reason to buy | 低驻足率与低转化 / Low stop and conversion rates |
| 咖啡选择多，用户决策成本高 / Many choices create decision friction | 不知道选什么，转而放弃 / Users do not know what to choose and abandon | 菜单价值未被看见 / Menu value goes unseen |
| 街边购买强调时间与确定性 / Street purchases demand speed and certainty | 担心排队、操作复杂、品质未知 / Concerns about queues, complexity, and quality | 错失即时消费 / Lost impulse purchases |
| 城市公共空间缺少温度 / Urban public spaces can feel impersonal | 购买只是交易，没有记忆点 / Transactional experience with no memory | 难以形成复购与传播 / Hard to build repeat purchase and word of mouth |
| 摄像头互动可能引发隐私担忧 / Camera interaction can raise privacy concerns | 害怕被识别、记录或强制关注 / Fear of identification, recording, or forced attention | 信任下降，带来合规风险 / Reduced trust and compliance risk |

---

## 3. 产品设计 / Product design

### 3.1 用户旅程与功能设计 / User journey and functional design

| 阶段 / Stage | 设计动作 / Design action | 用户收益 / User benefit | 企业目的 / Business purpose |
| --- | --- | --- | --- |
| 发现 / Discover | 大屏播放安静、有辨识度的公仔待机动画与清晰价格 / Large screen shows calm character idle animation and clear pricing | 迅速理解“这里可以买什么” / Instant understanding | 提升可见度 / Increase visibility |
| 注意 / Engage | 本地检测到有人靠近后，公仔转向或眼神跟随；无接触也可继续 / When a person approaches, character turns or gazes toward them; it also works without interaction | 获得轻微回应，而非被打扰 / Feel acknowledged, not interrupted | 提升驻足 / Increase dwell |
| 选择 / Choose | 用“提神 / 轻负担 / 犒赏自己”等情境入口，提供 3 个以内推荐 / Use situation-led entries such as “energy,” “light,” and “treat myself,” with no more than three recommendations | 少思考、更快选到合适饮品 / Less thinking, faster choice | 降低决策流失 / Reduce decision abandonment |
| 下单 / Order | 一屏完成规格、加料、支付；始终展示预计出杯时间 / Complete size, add-ons, and payment on one screen; always show estimated ready time | 速度和确定性 / Speed and certainty | 提高完成率 / Improve checkout completion |
| 等待 / Wait | 公仔显示制作进度，提供静音模式和跳过按钮 / Character shows progress; mute and skip controls are available | 等待可预期、不尴尬 / Predictable, comfortable wait | 降低取消与投诉 / Reduce cancellations and complaints |
| 取杯与复购 / Collect and return | 杯身/屏幕提供下次快捷入口或非强制积分；可领取当日短互动内容 / Cup/screen offers optional quick return or loyalty; users may unlock a short daily interaction | 获得持续价值与小惊喜 / Continued value and a small delight | 建立复购 / Build repeat purchase |

### 3.2 关键交互准则 / Key interaction principles

- **3 秒可理解、30 秒可完成 / Understandable in 3 seconds, completable in 30:** 首屏仅显示主推饮品、价格、开始按钮；复杂定制放到后续步骤。 / The first screen shows only featured drinks, price, and start; advanced customization comes later.
- **公仔服务于交易，不阻碍交易 / The character serves the transaction, never blocks it:** 所有动画可跳过，支付和取杯优先级最高。 / All animation is skippable; payment and collection take priority.
- **眼神跟随是“环境响应”，不是身份识别 / Gaze following is environmental response, not identification:** 只判断画面中是否有人及大致位置，不推断姓名、年龄、性别、情绪或身份。 / Detect only presence and rough position, never infer name, age, gender, emotion, or identity.
- **默认克制 / Restrained by default:** 无人时低亮、低音；靠近后才开始互动；夜间降低动画和声音强度。 / Use low brightness and sound when idle; engage only on approach; reduce intensity at night.
- **可访问性 / Accessibility:** 提供文字、图标、音量/静音、足够大字号、高对比度，以及不依赖人脸检测的完整购买路径。 / Provide text, icons, volume/mute, large type, high contrast, and a complete purchase path independent of face detection.

---

## 4. 目标人群 / Target audiences

| 人群 / Audience | 场景与即时需求 / Context and immediate need | 有效触点 / Effective trigger |
| --- | --- | --- |
| 通勤者 / Commuters | 赶时间、需要提神 / In a hurry, need energy | “30 秒下单，预计 X 分钟出杯” / “Order in 30 seconds; ready in X minutes” |
| 园区与办公室人群 / Campus and office workers | 午后疲劳、短暂休息 / Afternoon slump, short break | 按状态推荐与快捷复购 / State-based recommendation and quick reorder |
| 学生与年轻消费者 / Students and young consumers | 想要新鲜感、社交分享 / Seek novelty and shareable moments | 每日公仔内容、轻互动与限定杯套 / Daily character content, light interactions, limited sleeves |
| 商场休闲客 / Mall leisure visitors | 逛街中需要休息或犒赏 / Need a break or treat while shopping | 低糖/风味推荐与视觉吸引 / Low-sugar/flavor recommendations and visual appeal |
| 首次接触者 / First-time visitors | 不确定品质、流程和价格 / Unsure about quality, process, and price | 清晰菜单、制作时间、原料与售后说明 / Clear menu, ready time, ingredients, and support |

---

## 5. 确立需求 / Establishing the need

需求不是“用户需要一个会看人的屏幕”，而是以下四类可验证需求：  
The need is not “people need a screen that looks at them.” It is four testable needs:

1. **即时补能 / Immediate energy:** 用户希望在有限时间内买到稳定、清晰、快速的咖啡。 / Users want reliable, clear, fast coffee within limited time.
2. **低成本选择 / Low-effort choice:** 用户需要从复杂菜单中快速得到适合当下的建议。 / Users need a suitable suggestion from a complex menu quickly.
3. **微型情绪回报 / Micro emotional reward:** 用户愿意为一段被回应、被陪伴、稍有趣味的体验停留。 / Users are willing to pause for an acknowledged, companionable, lightly fun experience.
4. **安全可控 / Safety and control:** 用户需要明确知道摄像头做什么、不做什么，并能在不被拍摄或互动的情况下完成购买。 / Users need clarity on what the camera does and does not do, and must be able to buy without being filmed or engaged.

**验证方法 / Validation method**

| 假设 / Hypothesis | 最小验证 / Minimum validation | 成功信号 / Success signal |
| --- | --- | --- |
| AI 公仔能提升驻足 / The character increases stopping | A/B 测试：静态屏 vs. 公仔待机屏 / A/B test: static vs. character idle screen | 驻足率提升，且未增加负面反馈 / Higher stop rate without more negative feedback |
| 情境推荐能提升下单 / Situation-led recommendations improve ordering | A/B 测试：完整菜单优先 vs. 三个情境入口 / A/B test: full menu first vs. three contexts | 启动下单率与支付完成率提升 / Higher order starts and payment completion |
| 隐私透明能减少顾虑 / Privacy transparency reduces concern | 测试显著隐私提示与关闭互动入口 / Test prominent notice and disable-interaction option | 拒绝互动率下降、信任评分上升 / Lower interaction refusal, higher trust score |

---

## 6. 让目标人群感受到需求的重要性 / Make the need feel important

以场景语言，而非技术语言沟通。不要说“AI 人脸检测”；要说“靠近即唤醒，不存储你的脸”。  
Communicate in scenario language, not technology language. Do not say “AI face detection”; say “Wakes when you approach; your face is not stored.”

**可用屏幕文案 / Sample on-screen copy**

- “赶时间？30 秒选好，制作进度随时可见。” / “In a hurry? Choose in 30 seconds and see progress at any time.”
- “不知道喝什么？告诉我你现在想要：提神、轻一点，还是奖励自己。” / “Not sure? Choose what you need now: energy, something lighter, or a treat.”
- “我会在你靠近时醒来；不识别你、不保存人脸。也可关闭互动。” / “I wake when you approach; I do not identify you or save your face. You can turn interaction off.”
- “今天的 30 秒休息，从一杯刚好适合你的咖啡开始。” / “Start today’s 30-second break with a coffee that fits you.”

重要性来自真实后果：少花时间犹豫、避免买错、在忙碌中获得片刻恢复，并且始终拥有隐私和互动的控制权。  
The importance comes from concrete outcomes: less time spent deciding, fewer wrong choices, a moment of recovery during a busy day, and continued control over privacy and interaction.

---

## 7. 与现状对比（创新点） / Comparison with the status quo (innovation)

| 维度 / Dimension | 普通自动咖啡机 / Standard coffee vending machine | 本方案 / Proposed solution | 创新价值 / Innovation value |
| --- | --- | --- | --- |
| 吸引方式 / Attraction | 海报、价格、静态菜单 / Poster, pricing, static menu | 大屏 + 情境化 AI 公仔 / Large screen + contextual AI character | 从被动陈列变成主动但克制的欢迎 / From passive display to active, restrained welcome |
| 菜单决策 / Menu decision | 用户自行浏览 / User browses alone | 按即时状态给出少量建议 / Few recommendations by immediate state | 降低选择负担 / Lower cognitive load |
| 等待体验 / Waiting | 只显示倒计时或无反馈 / Timer only or no feedback | 角色化制作进度与可跳过互动 / Character-led progress and skippable interaction | 让等待变得可预期、有温度 / More predictable, warmer wait |
| 复购机制 / Repeat purchase | 优惠券或会员码 / Coupons or membership code | 便利复购 + 非强制的内容连续性 / Convenient reordering + optional content continuity | 兼顾实用与情感记忆 / Practical utility plus emotional recall |
| 视觉追踪 / Visual tracking | 通常没有 / Usually absent | 本地、短暂、非身份化的位置响应 / Local, transient, non-identifying position response | 形成“被看见”而非“被监控”的体验，前提是透明与可关闭 / Feeling seen, not surveilled—only with transparency and opt-out |

---

## 8. 顾客除了咖啡还能获得什么？ / What does the customer get besides coffee?

企业的收益是多卖出咖啡、提高客单与复购；顾客必须获得可感知、可选择且不以隐私交换为代价的额外价值。  
The business gains coffee sales, basket size, and repeat purchases. Customers must gain extra value that is tangible, optional, and never purchased with their privacy.

| 顾客额外获得 / Additional customer gain | 如何实现 / How it is delivered | 不应越界 / Boundary not to cross |
| --- | --- | --- |
| **节省时间 / Time saved** | 情境推荐、快捷复购、透明出杯时间 / Context recommendations, quick reorder, clear ready time | 不以强制注册换取速度 / Do not require registration for speed |
| **减少选择焦虑 / Less decision anxiety** | 小范围、可解释的推荐 / Small, explainable recommendation set | 不假装“读懂情绪”或操纵选择 / Do not pretend to read emotions or manipulate choices |
| **被轻度回应的愉悦感 / A light sense of being acknowledged** | 公仔目光、问候、完成反馈 / Character gaze, greeting, completion feedback | 不持续盯视、不制造压力 / No persistent staring or pressure |
| **片刻恢复与仪式感 / A restorative moment and ritual** | 30 秒微互动、制作过程可视化 / 30-second micro-interaction, visible preparation | 不用噪音、弹窗或游戏拖延取杯 / Do not delay collection with noise, pop-ups, or games |
| **对产品的掌控感 / Product control** | 清晰原料、规格、甜度/奶类选择与预计时间 / Clear ingredients, size, sweetness/milk options, expected timing | 不隐藏附加费用或默认加购 / No hidden fees or default add-ons |
| **信任与隐私控制 / Trust and privacy control** | 现场简明告知、互动关闭键、无摄像头购买路径 / Plain notice, interaction-off control, camera-free purchase path | 不存储人脸、不做身份/敏感属性推断 / No face storage or identity/sensitive-attribute inference |
| **可持续的轻连接 / Optional ongoing connection** | 自愿积分、口味偏好、每日角色内容 / Opt-in loyalty, taste preferences, daily character content | 不将互动绑定为购买或营销骚扰 / Do not tie interaction to purchase or intrusive marketing |

**顾客价值承诺 / Customer value promise**  
“你付费购买的是一杯咖啡；额外得到的是更快的决定、一次短暂的恢复，以及对体验和隐私始终可控的选择权。”  
“You pay for a coffee; you additionally receive a faster decision, a brief restorative moment, and continued control over your experience and privacy.”

---

## 9. Problem Statement Sheet / 问题陈述单

> **Given that / 鉴于此，**
>
> 在高节奏、高流量的街边消费场景中，普通自动咖啡机容易被忽略；潜在顾客既想快速获得适合自己的咖啡，也担心复杂选择、等待不确定和被摄像头监控。  
> In fast-paced, high-footfall street settings, standard coffee vending machines are easily overlooked. Potential customers want coffee that fits their moment quickly, while worrying about complex choices, uncertain waiting, and camera surveillance.
>
> **How might we help / 我们如何能帮忙**
>
> **busy passers-by, commuters, students, and office workers / 忙碌路人、通勤者、学生与办公人群**
>
> **quickly notice, choose, purchase, and enjoy a coffee—and feel lightly welcomed rather than pressured or watched / 快速发现、选择、购买并享用咖啡，同时感到被轻松欢迎而非被催促或监视，**
>
> **so they can / 所以他们可以**
>
> 在短暂空档中完成一次可靠、低负担且符合当下状态的补能选择。  
> make a reliable, low-effort energy choice that suits their present moment during a brief break.
>
> **To overcome / 克服**
>
> 菜单决策压力、机器缺乏吸引力、等待不透明，以及对 AI 视觉互动的隐私与控制权顾虑。  
> menu decision friction, low machine appeal, opaque waiting, and concerns over privacy and control in AI visual interaction.

---

## 10. 可行性评估与实施边界 / Feasibility assessment and implementation boundaries

### 10.1 可行性结论 / Feasibility conclusion

**建议以“可控互动 + 快速交易”的 MVP 启动，项目可行；不建议一开始做身份识别、情绪识别或个性化人脸档案。**  
**The project is feasible if launched as an MVP focused on controlled interaction and fast transactions. Do not begin with identity recognition, emotion recognition, or face-profile personalization.**

### 10.2 MVP 范围 / MVP scope

| 必须具备 / Must have | 暂缓 / Defer |
| --- | --- |
| 大屏、清晰菜单、支付、制作与取杯流程 / Large screen, clear menu, payment, preparation, collection | 人脸身份识别 / Facial identity recognition |
| 基于本地人体/头部位置的短暂公仔朝向 / Short-lived character orientation based on local person/head position | 年龄、性别、情绪、种族等属性推断 / Inferences of age, gender, emotion, ethnicity, etc. |
| 一键跳过/静音/关闭互动 / One-tap skip, mute, interaction off | 基于影像的广告再营销 / Image-based ad retargeting |
| 明确隐私提示与无互动购买路径 / Clear privacy notice and non-interaction buying path | 采集人脸原始图像或可识别模板 / Collecting face images or identifiable templates |
| 三类情境推荐与基础运营数据 / Three scenario recommendations and basic operations data | 复杂开放式长对话 / Complex open-ended long conversations |

### 10.3 技术与运营要求 / Technical and operational requirements

- **视觉处理 / Vision processing：** 摄像头数据应在设备本地实时处理；只输出短暂的相对位置/朝向控制信号。默认不上传、不保存原始视频或人脸特征。 / Process camera data locally in real time; output only transient relative-position/orientation signals. By default, do not upload or retain video or facial features.
- **隐私界面 / Privacy UX：** 在摄像头附近和首次互动屏清楚说明用途、数据处理方式、关闭方法与联系渠道。 / Clearly state purpose, processing, opt-out method, and contact channel near the camera and on the first interaction screen.
- **失效保护 / Fail-safe：** 摄像头、AI 或网络故障时，售卖、支付、退款和取杯必须仍可运作。 / Sales, payment, refunds, and collection must keep working if camera, AI, or network fails.
- **内容运营 / Content operations：** 公仔话术应短、友善、无诱导压力；按早高峰、午后、夜间配置不同强度。 / Character scripts should be brief, friendly, and non-pressuring; tune intensity for morning rush, afternoon, and night.
- **食品与设备 / Food and equipment：** 建立温度、清洗、原料临期、缺货、支付失败、卡杯与退款的日常检查清单。 / Establish daily checklists for temperature, cleaning, near-expiry ingredients, stockouts, payment failure, cup jams, and refunds.

### 10.4 合规与伦理底线 / Compliance and ethical baseline

在上线前，应由当地隐私/数据保护与食品经营专业人士确认适用要求；不同部署地的规则可能不同。以下为不可妥协的产品底线：  
Before launch, have applicable requirements confirmed by local privacy/data-protection and food-operation professionals; rules vary by location. The following are non-negotiable product baselines:

1. 目的限定、数据最小化、默认本地处理。 / Purpose limitation, data minimization, local processing by default.
2. 醒目告知，且不互动、不看镜头也能购买。 / Prominent notice; customers can buy without interacting or looking at the camera.
3. 不使用视觉数据判断或影响价格、资格、服务优先级。 / Do not use vision data to determine or influence pricing, eligibility, or service priority.
4. 不面向儿童设计诱导性互动；部署在儿童高频区域时采用更保守的互动策略。 / Do not design manipulative interactions for children; use a more conservative strategy in child-heavy areas.
5. 建立删除、故障、投诉与人工客服/退款通道。 / Establish deletion, failure, complaint, and human-support/refund routes.

---

## 11. 分阶段实施与指标 / Phased rollout and metrics

| 阶段 / Phase | 目标 / Goal | 交付 / Deliverables | 关键指标 / Key metrics |
| --- | --- | --- | --- |
| 0：调研（2–3 周） / Research (2–3 weeks) | 验证场景和隐私接受度 / Validate context and privacy acceptance | 访谈、点位观察、菜单测试、隐私文案测试 / Interviews, site observation, menu and notice tests | 停留意愿、理解率、隐私顾虑 / Willingness to stop, comprehension, privacy concern |
| 1：MVP（4–6 周） / MVP (4–6 weeks) | 验证互动是否带来购买 / Test whether interaction drives purchase | 单点原型：大屏、三种推荐、可关闭本地位置响应 / Single-site prototype: screen, three recommendations, opt-out local positioning | 驻足率、开始下单率、支付完成率、平均下单时长 / Stop rate, order-start rate, payment completion, order time |
| 2：试点（4–8 周） / Pilot (4–8 weeks) | 验证经济模型与运维 / Validate unit economics and operations | 3–5 个不同场景点位 / 3–5 sites in varied contexts | 单机日杯量、毛利、故障率、退款率、复购率、投诉率 / Daily cups, gross margin, failure, refund, repeat, complaint rates |
| 3：扩展 / Scale | 形成可复制点位模型 / Create repeatable site model | 内容排期、远程运维、供应链与加盟/合作手册 / Content calendar, remote ops, supply chain, partner playbook | 单点回本周期、留存、NPS/满意度、合规事件为零 / Payback period, retention, NPS/satisfaction, zero compliance incidents |

**建议决策门槛 / Suggested decision gates**  
仅当试点同时满足“转化或复购有显著改善”“顾客对隐私说明的理解和接受良好”“运营故障与退款可控”时，才扩大部署。若互动提高驻足却降低信任，应先调整或关闭视觉互动，而不是放大投放。  
Scale only when the pilot shows meaningful conversion or repeat improvement, good comprehension and acceptance of privacy notices, and controllable failures/refunds. If interaction raises dwell but lowers trust, revise or switch off visual interaction before scaling.

---

## 12. 结论 / Conclusion

本方案的真正创新，不是“机器会盯着人”，而是将**高效购咖、低成本选择、轻度情感陪伴和可控隐私**组合成一次可信赖的街边服务体验。企业用它提高购买转化；顾客则得到时间、确定性、片刻恢复与选择权。只有当后者被真实兑现，前者的盈利才具有长期可持续性。  
The true innovation is not “a machine that watches people.” It combines **efficient coffee purchase, low-effort choice, light emotional companionship, and controllable privacy** into a trusted street-side service. The business gains conversion; customers gain time, certainty, a brief recovery, and choice. Profitability is sustainable only when those customer benefits are genuinely delivered.
