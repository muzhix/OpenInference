# 09 状态模型与事件流

范围:页面/画布/图数据/持久化/会话/运行六层状态的区分,及关键操作的事件流。证据:各轮实验;本文是 03/05/06/阶段二R4 的状态学重组。

## 1. 状态分层

| 层 | 内容 | 存储 | 失效 |
|---|---|---|---|
| L1 页面路由态 | URL(chatId?/workflowUrl)、tab 标题、面板开合(聊天/Run/Blocks) | URL + 前端 | reload 后 Run/Blocks 复位 |
| L2 画布视图态 | viewport(pan/zoom)、选中、hover | 前端(react-flow) | 不产生脏状态 |
| L3 图数据态(内存) | spec(语义)+ metadata.ui(坐标/边/分组)的编辑中副本 | 前端 | 未保存修改在 reload 丢失 |
| L4 持久化态 | 草稿版本链(每次 saveDraft 一个 version)+ get 的 config/lastVersionConfig | 服务端 | 永久 |
| L5 会话态 | Agent 消息流(UIMessage parts,含工具输入输出) | 服务端(会话存储) | 永久 |
| L6 运行态 | 本次执行的 inputs/outputs/profiler | 前端(结果面板)+ 无服务端任务(同步) | reload 丢失 |

关键关系:L3 是 L4 的编辑副本;执行(Run)读取 L3(重拉 preferDraft 后)而非等待 L4;Agent 通过服务端直接写 L4 再触发前端刷新 L3。

## 2. 脏状态与"可保存性"

- 修改 L3 → Save `aria-disabled` 解禁;悬空引用 → 校验不过 → 禁用。
- Save → L3 全量(含 metadata.ui)提交 → 生成 L4 版本 → 前端重拉(spec/listDeployments)。
- [推断] 撤销/重做只作用于 L3(react-flow 历史),与 L4 版本链独立。

## 3. 事件流(实测时序)

### 3.1 打开编辑器(reload)

```
GET workflow/get?workflowUrl=<slug>        → id 解析
GET solutions/conversations/<chatId>?      → 会话恢复(如有)
GET workflow/spec?workflowId&preferDraft   → 图数据(画布重建)
GET workflow/token / listDeployments / preview-examples / models
POST workspace/api-key → serverless blocks/describe(注册表)
Firestore Listen 建立实时通道
```

### 3.2 编辑 → 保存

```
[前端] 添加节点/改参数/拖坐标(0 请求) → Save 解禁
[点击 Save] POST saveDraft {config(含 metadata.ui)} → version 创建
[自动] GET spec?preferDraft + listDeployments → L3 对齐
```

### 3.3 Run 执行

```
[上传] file input → blob 预览(0 请求)
[点击 Run Workflow]
  GET spec?preferDraft(取最新)
  POST serverless/workflows/run {api_key, specification, inputs(base64)} → 同步响应
[渲染] Run 面板结果态 + 画布节点缩略图 + selector 托盘
[Rerun] 原参数重发(同 POST)
```

### 3.4 Agent 修改(增量)

```
[用户] contenteditable 输入 → Send
  POST solutions/conversations(首条,建会话+关联 workflowIds)→ URL 重写短 ID
  PUT dismissed-artifacts(并发控制字段)
  POST repo.roboflow.com/solutions/chat(SSE)→ assistant parts 流
[Agent] getWorkflowSpec → getBlockDocs →(必要时 askUserQuestion ⇄ 前端回传)
        → applyWorkflowOperations(JSON Patch,含 description)
[服务端] 应用+校验+存草稿(draftSaved:true)
[前端] 重拉 spec → 画布更新(实测 ~12s 内)
```

### 3.5 台账 → 编辑器

```
[卡片点击] SPA 路由 → /solutions/chat?workflowUrl=<slug> → 3.1 流程(无会话恢复)
```

## 4. 并发与一致性

- mutation 乐观并发(clientId/revision/mutationId)实测于会话操作;[待验证] saveDraft 是否带并发控制。
- 多标签/协作同步疑走 Firestore Listen;[待验证] 具体订阅文档集。

## 5. 独立实现建议

以本六层模型为状态设计蓝本:L3/L4 分离(编辑副本 vs 版本链)、Run 读 L3(所见即所跑)、Agent 写 L4 后广播刷新;每层明确失效语义(未保存丢失/永久/页面级)。
