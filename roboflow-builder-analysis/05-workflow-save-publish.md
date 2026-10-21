# 05 工作流保存与发布

范围:草稿产生/更新、Save/Publish/Use 生命周期。证据:阶段二 R2(实验 A 全程)、R4(Agent 保存)。

## 1. 草稿状态的产生 [事实]

任何图结构/配置修改(节点增删、参数、绑定、位置拖动)在前端内存中进行(0 请求),产生"可保存"脏状态:

- Save 按钮 `aria-disabled`:"true"(不可保存:无修改或校验不过)↔ null(有可保存修改)。
- 悬空 selector(如删除节点后 Outputs 仍引用)→ 校验不过 → 禁用保存。

## 2. Save:saveDraft 契约 [事实]

`POST /query/workflow/saveDraft`,body `{"workflowId": "…", "config": "<specification JSON 字符串(含 metadata.ui)>"}`。

响应:

```json
{
  "workflow": { …元数据(config 为保存前快照语义)… },
  "version": {
    "id": "1792590119470",                     // 毫秒时间戳
    "name": "Draft saved on Oct 21, 2026",     // 自动命名
    "createdAt": "…",
    "config": "<本次保存的 spec>"
  }
}
```

- **每次保存 = 创建一个具名草稿版本**(版本历史;画布右上"历史图标"疑为其入口 [待验证])。
- 保存后前端自动重拉 `workflow/spec?preferDraft=true` 与 `workflow/listDeployments`。
- 画布数据源 = `spec?preferDraft=true`(最新草稿版本);`workflow/get.config` 与 `lastVersionConfig` 是元数据层快照(保存后短暂滞后;对从未发布的工作流 `lastVersionConfig` 跟随最新版本;**[待验证]** 已发布工作流上的确切差异)。
- Agent 的 `applyWorkflowOperations` 在服务端完成"应用+保存"(`draftSaved:true`),与手动 Save 等价入账。

## 3. Publish / Use(实测,2026-10-21 补充实验)

在 Custom Workflow(1 节点已保存草稿)上实测发布:

**发布入口与语义** [事实]:
- 顶栏 `Publish`(aria:"Publish workflow")——点击后**无确认弹窗,直接发布**。
- 聊天区另有 "Action needed" 发布卡片(aria:"Action needed: show workflow publish actions"),含两个按钮:**`Publish as a Copy`** 与 **`Publish`(aria:"Make these changes live in the original workflow.")**——"副本发布"与"原地生效"二元语义在 UI 明示;草稿与已发布版本存在差异时出现该卡片。
- 状态横幅三态:"Draft saved — not published yet"(从未发布)→ "Draft saved / **Saved changes are not live yet**"(有未发布变更)→ "**Published**"。

**发布链路** [事实]:

```
点击 Publish(顶栏)
→ GET /query/workflow/deployments?workspaceId=&workflowUrl=   (发布前查部署)
→ POST /query/workflow/save  {workspaceId, workflow:{id, config:<完整 spec 含 metadata.ui>}}
→ 自动重拉 listDeployments + workflow/spec + workflow/get
```

- 发布端点为 **`workflow/save`**(与草稿端点 `saveDraft` 不同,请求体外层结构也不同:`{workspaceId, workflow:{id, config}}` vs `{workflowId, config}`);响应体未捕获 [待验证]。
- **发布效果**:`workflow/get` 中 `config == lastVersionConfig`(草稿固化为已发布版本);Publish 按钮转为禁用(无待发布变更);**Use 按钮解禁**。

**Use 入口** [事实]:发布后 `Use` 解禁,aria 变为 "Get the endpoint URL, API key, and code to call your live workflow.";点击打开 **Use Workflow 弹窗**:Tab = Cloud API / Cloud Streaming / Coding Agent / Code Snippets / Self-Hosted API / Batch Processing,LIVE 徽章;Cloud API 页展示 Workflow ID(slug)、Endpoint URL(serverless 域)与 API key,附调用代码。

**实验现场**:Custom Workflow 保留为已发布状态(含 1 个 property_definition 节点)——测试工作流,发布内容无害;后续编辑会产生新的未发布草稿。

## 4. 恢复与一致性 [事实]

- reload → `spec?preferDraft=true` 加载最新草稿(含 metadata.ui 坐标)→ 画布按 spec+坐标重建;未保存的修改丢失(删除实验证实)。
- 会话/Agent 修改 → 前端重拉 spec → 画布更新(实验 F:12s 内生效)。

## 5. 已知异常 [待验证]

删除悬空输出绑定后,Save 解禁但点击未触发 saveDraft(DOM click 与原生点击均无请求,命中元素正确)——存在未知前置条件或状态机分支;复现步骤见 evidence/phase2-round2-observations.md §3。

## 6. 独立实现建议

- 保存模型:**每次显式保存生成不可变版本**(id+自动命名+config 全量),当前态 = 最新草稿版本;天然支持历史回溯与"Agent 改了什么"的版本间 diff。
- 可保存性(而非"是否有修改")作为 Save 按钮语义,校验失败给即时原因。
- 语义校验(selector 可解析、无悬空输出、kind 兼容)在保存前运行;kind 矩阵来自注册表。
- 发布与草稿分离:发布为独立端点(直接生效、无确认弹窗),状态横幅三态驱动(未发布/有未发布变更/已发布);"副本发布 vs 原地生效"二元选择保留给聊天/Agent 场景;发布解锁 Use(端点/密钥/代码面板)。
