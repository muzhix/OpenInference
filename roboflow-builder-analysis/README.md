# Roboflow Workflows Builder 前端分析

对 Roboflow Workflows(台账 / Builder 画布 / Run 测试 / AI Agent 协作)的运行时分析,目标是为独立开发可视化 AI 工作流 IDE 提供技术依据。分析依据 `rea_workflow.md` 执行,以已登录浏览器的实际运行状态为准(REA + CDP 直连),不以截图推断实现。

## 文档导航

| 文档 | 内容 |
|---|---|
| [00-scope-and-method.md](00-scope-and-method.md) | 范围、排除项、观测方法、证据分级 |
| [01-workflows-registry.md](01-workflows-registry.md) | Workflows 台账:结构、卡片、搜索、跳转 |
| [02-builder-layout.md](02-builder-layout.md) | Builder 布局:路由形态、工具栏、面板 |
| [03-canvas-interaction-model.md](03-canvas-interaction-model.md) | 画布交互:选择、拖动、删除、内嵌配置 |
| [04-node-system-and-graph-schema.md](04-node-system-and-graph-schema.md) | 节点系统:注册表、Kind 类型、连接规则、图 schema |
| [05-workflow-save-publish.md](05-workflow-save-publish.md) | 保存/发布:saveDraft、metadata.ui、版本化 |
| [06-run-panel-and-execution.md](06-run-panel-and-execution.md) | Run 测试:面板状态机、执行 API、结果结构 |
| [07-frontend-implementation.md](07-frontend-implementation.md) | 前端实现:技术栈、渲染、状态管理 |
| [08-api-contracts.md](08-api-contracts.md) | API 契约总表(全部实测端点) |
| [09-state-model-and-event-flows.md](09-state-model-and-event-flows.md) | 状态模型分层与关键事件流 |
| [10-independent-implementation-design.md](10-independent-implementation-design.md) | 独立实现设计(含 Agent 协作原则) |
| [11-acceptance-tests.md](11-acceptance-tests.md) | 验收测试清单(从行为规格导出) |
| [12-implementation-plan.md](12-implementation-plan.md) | 开工计划:目标/选型/架构/里程碑/风险 |
| [13-ui-style-spec.md](13-ui-style-spec.md) | UI 风格规范:实测 design tokens(色板/字体/组件) |

原始观测记录(按时间序,含证据文件路径)见 [evidence/](evidence/):
[阶段一](evidence/phase1-observations.md) ·
[二轮一](evidence/phase2-round1-observations.md) ·
[二轮二](evidence/phase2-round2-observations.md) ·
[二轮三](evidence/phase2-round3-observations.md) ·
[二轮四](evidence/phase2-round4-observations.md),以及汇总
[交互](evidence/interaction-observations.md) ·
[网络](evidence/network-observations.md) ·
[图 schema](evidence/graph-schema-observations.md) ·
[未决问题](evidence/unresolved-questions.md)。

## 一句话结论

Roboflow 云端 Builder 是 **workflow specification JSON 的可视化编辑器**:图语义(inputs/steps/outputs + selector DAG)与画布状态(metadata.ui 坐标/边/分组)同体存储;保存即版本化草稿(`saveDraft`);执行是把当前 spec 与 base64 输入直接 POST 给同步 run API;AI Agent 通过 `getWorkflowSpec → getBlockDocs → applyWorkflowOperations(JSON Patch)` 读写同一 spec。该 spec 与开源 inference 引擎(roboflow-workflows)完全同构。

## 关键事实速查

- 画布:React Flow/xyflow,自定义节点 `workflowInput/workflowStep/workflowOutput`,容器 `workflow-builder-v2`。
- 图数据:`{"specification":{version, inputs, steps, outputs, metadata:{ui:{nodes, edges, groups}}}}`。
- 保存:`POST /query/workflow/saveDraft {workflowId, config}` → 创建具名草稿版本。
- 执行:`POST https://serverless.roboflow.com/workflows/run {api_key, specification, inputs:{image:{type:"base64",value}}}` → 同步返回 `{outputs:[…], profiler_trace}`。
- Agent:消息走 `repo.roboflow.com/query/solutions/chat` SSE;工具 `askUserQuestion / listWorkspaceModels / getBlockDocs / getWorkflowSpec / applyWorkflowOperations / buildWorkflow / workflows.run`。
- 节点注册表:`POST serverless.roboflow.com/workflows/blocks/describe`(263 blocks、45 Kind、连接矩阵)。

凭据已脱敏;所有端点均需登录态(workspace api-key 与登录 cookie 分离,前者由 `/query/workspace/api-key` 下发)。
