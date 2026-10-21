# 10 独立实现设计

基于实测契约(00-09)的独立产品设计建议。不预设与 Roboflow 相同的技术栈;每条设计给出对应的事实依据。

## 1. 核心架构:spec 为中心

```
                    ┌────────────── workflow specification JSON ──────────────┐
                    │  version / inputs / steps / outputs / metadata.ui       │
                    └───────▲──────────────▲──────────────▲───────────────────┘
                            │              │              │
                     画布编辑器         执行引擎         AI Agent
                   (双向 adapter)   (selector 求值)   (读→patch→应用)
                            │              │              │
                     只读视图复用      结果路由        会话记录(全程可审计)
                   (缩略图/JSON面板)  (图像/标量/结构化) (UIMessage parts)
```

- 单一 spec 承载语义 + UI(坐标/边/分组),UI 可丢可重建(Agent 建图即无 UI 数据,自动布局补齐)[依据:04]。
- selector 引用即边;`metadata.ui.edges` 仅作 UI 投影(可带 inputProperty/sourceSelector)[依据:04]。
- 类型寻址(`/steps/<name>/…`)贯穿 selector 与 patch [依据:04/R4]。

## 2. 台账与资源模型

- 列表/详情/图数据三层 API(列表不含 config)[依据:08]。
- 资源标识:id + slug 双轨(URL 用 slug);`createdByAI/editedByAI` 溯源标记进列表模型 [依据:01]。
- 台账卡片内嵌只读画布缩略图(与编辑器同渲染引擎)+ 异步加载态 [依据:01]。

## 3. 画布编辑器

- React Flow/xyflow + 三类节点(输入/步骤/输出)+ 双击内嵌 schema 驱动表单(280px 卡片)[依据:03]。
- 连接三件套:selector 拖拽托盘、添加时自动绑定主输入、自动生成输出 [依据:03]。
- 校验前置到"可保存性"(悬空引用即禁用 Save 并给原因)[依据:03/05]。
- 工具栏:undo/redo、auto layout、zoom、lock、fit、minimap(默认关)[依据:02]。

## 4. 保存/发布生命周期

- 每次显式保存 = 不可变具名版本(id+自动名+全量 config);当前态 = 最新草稿 [依据:05]。
- 发布为独立动作,区分"发布为副本"与"在原件生效";未发布禁用 Use 类出口并给原因 [依据:05]。
- 版本链天然支撑"Agent 改了什么"的 diff 展示与回滚 [依据:05/R4]。

## 5. 执行与结果

- 测试执行 = 当前编辑态 spec + base64 内联输入,单次同步调用;输出按 spec 输出名对齐 [依据:06]。
- 结果三类视图:图像(叠加检测)、标量、结构化(predictions,sv.Detections 风格含 rle_mask/detection_id);节点级缩略图复用结果 [依据:06]。
- Run 面板双态(输入/结果)+ Rerun + Edit input [依据:06]。

## 6. AI Agent 协作(核心原则,逐条对应 rea_workflow.md §10.7)

1. **读取**:Agent 工具 `getWorkflowSpec` 获取当前图 [实测]。
2. **结构化变更**:`applyWorkflowOperations` 提交 RFC 6902 JSON Patch(数组索引与按名寻址并存),附人读 `description` [实测]。
3. **验证与应用**:服务端应用 patch、语义校验(kind 矩阵/selector 可解析)、原子保存草稿(`draftSaved`) [实测]。
4. **同步画布**:应用后前端重拉 spec 重建画布(秒级) [实测]。
5. **用户可理解**:patch 的 description + 会话中的工具调用全记录(输入/输出/时机)构成解释链 [实测]。
6. **持久化**:与手动 Save 同一版本链 [实测]。
7. **可撤销**:版本链 diff/回滚;patch 可反演 [设计推论]。
8. 澄清机制:`askUserQuestion`(结构化选项+集成上下文),前端以 `[workflow-agent-question]` 消息回传 [实测]。
9. 资源发现:`getBlockDocs`(schema 文档)+ `listWorkspaceModels`;新建走 `buildWorkflow` 全量 [实测]。

Agent 消息通道:SSE 流式,UIMessage parts 标准(text/reasoning/tool-call);工具在服务端执行,前端不解析工具逻辑 [实测]。

## 7. 前端技术选型建议

React + TypeScript;xyflow;Tailwind;Vercel AI SDK(或等价 UIMessage 协议);JSON Schema 表单生成;SSE 网关。状态管理以"spec 单一数据源 + 派生 memo"为轴,无需重量级全局 store [依据:07]。

## 8. 后端接口最小集

```
workflows: list / get(slug|id) / spec(preferDraft) / saveDraft / publish(待定语义) / token
blocks: describe(注册表:JSON Schema + outputs kind + kinds 连接矩阵 + 操作符)
runs:   run(spec + inputs,同步)
chat:   conversations CRUD + SSE 消息通道 + 工具执行(服务端)
```

## 9. 与 Roboflow 行为的刻意差异(建议)

- 删除键同时支持 Backspace/Delete;保存失败/校验失败给显式错误(规避实测异常二)。
- spec 内嵌 UI 元数据改为可选旁挂(避免语义与视图耦合过深,两者同体虽是 Roboflow 现状,但独立实现可评估分离收益)。
- Agent patch 前给出预览 diff 确认(可选档位;Roboflow 的 Builder Assist Auto 档位语义待验证)。

## 10. 明确不做

不复刻 Intercom/Stripe/统计等第三方;不做 Firestore 级实时层(单用户场景不需要);不绑定 OpenInference 现有仓库结构(其 workflows 引擎可直接作为执行端,因 spec 同构)。
