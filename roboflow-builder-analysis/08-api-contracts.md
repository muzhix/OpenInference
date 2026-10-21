# 08 API 契约总表

全部端点均为运行时直接观测(2026-10-21,workspace `F1RYoIocgEcRp444lpElGuuQSIC2`)。凭据已脱敏;`app.roboflow.com/query/*` 需登录 cookie,`serverless.roboflow.com` 需 workspace api-key。

## 1. 工作流元数据与图数据

| 端点 | 方法 | 触发 | 请求 | 响应 |
|---|---|---|---|---|
| `/query/workflow/list?workspaceId=` | GET | 台账加载/刷新 | — | `{workflows:[{owner, createdByAI, editedByAI, createTime, updateTime, name, url, id}]}` |
| `/query/workflow/get?workflowUrl=<slug>` 或 `?workflowId=` | GET | 按 slug/id 解析 | — | `{workflow:{id,url,name,config,str,lastVersionConfig,createTime,updateTime,createdByAI,editedByAI,owner}}` |
| `/query/workflow/spec?workflowId=&preferDraft=true` | GET | 画布加载/保存后/执行前/Agent 修改后 | — | `{workflowSpec:{workflowId, workflowUrl, workspaceId, versionId(null=草稿), config:str}}` |
| `/query/workflow/saveDraft` | POST | Save 点击 / Agent applyWorkflowOperations(服务端) | `{workflowId, config:str}` | `{workflow:{…}, version:{id(ms 时间戳), name:"Draft saved on …", createdAt, config:str}}` |
| `/query/workflow/save` | POST | 顶栏 Publish(发布);台账 Create/Duplicate/Rename(2026-10-21 补测) | 创建:`{workspaceId, workflow:{name,url,template:"custom",folderId,config,examples,source}}`(无 id);复制:`template:"duplicate"`;重命名:`{id,name,url,…}` | 发布:config==lastVersionConfig、Use 解禁 [05];创建返回新 workflowId |
| `/query/workflow/delete` | POST | Move to Trash(需在弹窗键入 slug 确认) | form:`workspaceId=…&workflowIds[]=<id>`(批量) | 移入 Trash(30 天后永久删);后置重拉 list/folders |
| `/query/workflow/configs?workflowIds=` | GET | 台账批量取配置 | — | 配置集合 |
| `/query/workflow/deployments?workspaceId=&workflowUrl=` | GET | Publish 前 / Use | — | 部署列表(两参数必填) |
| `/query/workflow/token?workflowId=&workspaceId=` | GET | 编辑器加载 | — | `{token}`(用途待验证) |
| `/query/workflowFolders/listById?workspaceId=` | GET | 台账加载 | — | 文件夹列表 |
| `/query/workflow/listDeployments?workflowId=` | GET | 加载/保存后 | — | 部署列表 |
| `/query/workflow/preview-examples/list?workflowId=` | GET | 编辑器加载 | — | 预览示例列表 |

## 2. 执行(serverless.roboflow.com)

| 端点 | 方法 | 请求 | 响应 |
|---|---|---|---|
| `/workflows/run` | POST | `{api_key, specification:{…}, inputs:{image:{mediaType,videoType,type:"base64",value}}}` | 同步 `{outputs:[{<输出名>:…}], profiler_trace:[]}`(详见 [06](06-run-panel-and-execution.md)) |
| `/workflows/blocks/describe?api_key=` | POST(空 body) | — | 节点注册表(详见 [04](04-node-system-and-graph-schema.md)) |

## 3. Agent 会话

| 端点 | 方法 | 触发 | 请求 | 响应 |
|---|---|---|---|---|
| `/query/solutions/conversations`(app.roboflow.com) | POST | 首条消息前建会话 | `{workspaceId, initialAssets:[{kind:"workflow", id}], dismissedArtifactIds:[], idempotencyKey}` | 会话对象 |
| `repo.roboflow.com/query/solutions/chat` | POST(**SSE**) | 发消息 | `{message:{parts:[…], id, role:"user", metadata:{source}}}` | event-stream(assistant parts 流) |
| `/query/solutions/conversations/<idem_…>` | GET | 拉会话全文 | — | `{conversation:{id, name, workflowIds, messages:[UIMessage]}}`(短 ID 404) |
| `/query/solutions/conversations/by-workflow/<workflowId>?workspaceId=` | GET | 打开编辑器(新工作流) | — | 按工作流查会话 |
| `/query/solutions/conversations?workspaceId=` | GET | 会话列表轮询 | — | 列表 |
| `serverless.roboflow.com/workflows/definition/schema?api_key=` | GET | 打开编辑器 | — | workflow 定义的 JSON Schema(动态定义) |
| `/query/solutions/conversations/<id>/dismissed-artifacts` | PUT | UI 消横幅 | `{dismissedArtifactIds, mutation:{clientId, revision, mutationId}}` | — |
| `/query/models?workspaceId=&status=finished&group=false&includeClasses=true` | GET | 模型选择(前端与 Agent) | — | 模型清单 |
| `/query/workspace/api-key`(app.roboflow.com) | POST | 编辑器加载 | `{workspaceId}` | workspace api-key(serverless 用) |

## 4. Agent 工具(服务端执行,经 SSE 通道;输入输出全程存于会话 parts)

| 工具 | 输入 | 输出要点 |
|---|---|---|
| `askUserQuestion` | `{question, selectionMode, options:[{id,label,description}], allowOther, integrationContext, annotationReviewId, relatedRunToolCallId}` | 前端以 `[workflow-agent-question]` 消息回传选择 |
| `listWorkspaceModels` | `{}` | 按任务类型分组的模型清单 |
| `getBlockDocs` | `{blockTypes:[…]}` | `<block-docs>` Markdown(属性/类型/默认值/示例) |
| `getWorkflowSpec` | `{workflowId}` | 当前 spec |
| `applyWorkflowOperations` | `{workflowId, operations:[RFC6902 patch], description}` | `{status, workflow:<应用后 spec>, draftSaved:true, _instruction}` |
| `buildWorkflow` | `{workflowName, spec}`(全量,新建用) | `{workflow(规范化 spec), workflowName/Url/Path/Id, _instruction}` |
| `workflows.run` | (_instruction 提及,未实测) | — |

## 5. 其他实测相关端点

`POST /session`(会话心跳,JWT)、`POST /query/event`(埋点)、`/query/workspace/hasUsedTrial`、`/query/loadMyWorkspaces`、`/query/listWorkspaceProjects`、`/query/getProjectGroups`、`/query/video-sources`、Firestore Listen/Write channel(实时层)。

## 6. 错误形态

- 未知会话:`{"error":"Conversation not found"}`(短 ID)。
- 其余错误路径未系统观测(见 unresolved)。
