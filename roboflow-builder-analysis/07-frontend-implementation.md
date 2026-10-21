# 07 前端实现

范围:目标功能直接涉及的前端技术栈与实现机制(不做全站分析)。证据:阶段一(脚本/DOM)、各轮网络与 DOM 探查。

## 1. 技术栈指纹 [事实]

| 层 | 实现 | 证据 |
|---|---|---|
| 框架 | React SPA(SSR 外壳 + `#rf-portal-root`/`#content` 双挂载) | DOM 结构、data-react |
| 样式 | Tailwind(自定义色板 `purboflow-*`、容器查询 `@container/canvas-bottom`) | 类名 |
| 画布 | React Flow / xyflow(自定义节点 3 类、panel、minimap) | `react-flow__*` 全套类名 |
| UI 组件 | Headless UI(`data-headlessui-state`)、自研 `btn2` 体系、Font Awesome 图标 | 属性/类名 |
| 聊天/AI | Vercel AI SDK v5 UIMessage(parts: text/step-start/reasoning/tool-*),OpenAI Responses(reasoningEncryptedContent) | 会话 JSON |
| 实时 | Firestore(`roboflow-platform` 项目)Listen/Write channel | 网络流 |
| 流式 | SSE:`repo.roboflow.com/query/solutions/chat`(`text/event-stream`) | 响应 mime |
| 多选 | Selecto(`selecto-selection`) | 类名 |
| 富文本输入 | contenteditable div(placeholder "Chat message") | DOM |
| 构建产物 | webpack 分包 113+ chunk 于 `cdnassets.roboflow.com/_app/*.js`(主包 `roboflow.*.js`) | 脚本清单 |
| 第三方 | Intercom/Stripe/PostHog/GA/Facebook/Calendly 等(与目标功能无关,排除) | 脚本清单 |

## 2. 渲染与状态管理 [事实/推断]

- **双向图状态**:spec(语义)+ metadata.ui(视图)↔ react-flow 实例(nodes/edges/viewport);[推断] 两者在前端由 adapter 双向同步(spec 为 source of truth)。
- 同一 spec 多视图渲染:交互画布(可拖拽)、聊天缩略图、台账卡片缩略图——复用同一节点组件体系(`graphBlock*`)。
- 表单由 block JSON Schema 驱动生成(字段标签/描述/类型/默认值来自注册表)。
- 节点选中/面板开合均为前端状态(0 请求);脏状态以"可保存性"表达(aria-disabled)。
- Agent 修改落地:服务端 applyWorkflowOperations → 前端重拉 spec(轮询/刷新触发)→ 画布重建。
- [推断] 撤销/重做为前端栈(react-flow + 自定义历史),与版本历史(服务端)独立。

## 3. 网络层形态 [事实]

- 读 API:`app.roboflow.com/query/*`(REST,Firebase 风格时间戳);执行/注册表:`serverless.roboflow.com`;Agent 消息:`repo.roboflow.com`(SSE)。
- 认证:登录 cookie(session)+ 独立 workspace api-key(`POST /query/workspace/api-key` 下发,用于 serverless 域)。
- 乐观并发:mutation 带 `clientId/revision/mutationId`(dismissed-artifacts 实测)。
- 后台轮询:`video-sources`、`solutions/conversations` 等周期性 GET。

## 4. 限制

- JS 为压缩分包,未做源码级还原(记忆:源码级分析曾用于本地仿制;本轮以运行时契约为准)。
- React 状态容器(Redux/Zustand 等)未识别;组件级实现不可见。

## 5. 独立实现建议

- 优先复用成熟库:xyflow(画布)、Vercel AI SDK(Agent 消息)、JSON Schema 表单生成;自研重点放在 spec↔graph adapter 与校验层。
- spec 单一数据源 + 派生视图(缩略图/JSON 面板/Agent 上下文)能显著降低一致性成本(实测云端即此架构)。
- 同步执行 + SSE 消息 + REST 元数据的组合足以支撑全部功能,不需要 Firestore 级实时层(其用途疑为跨标签页/协作同步,待验证)。
