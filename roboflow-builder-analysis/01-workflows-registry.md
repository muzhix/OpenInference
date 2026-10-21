# 01 Workflows 台账

范围:`/<ws>/workflows` 主体内容区域(不含全局导航)。证据:阶段一 + 阶段二 R1/R2。

## 1. 页面结构 [事实]

```
body
└─ #SSRGlobalNavbar(159px,排除项)
└─ #content > .pageContainer
   └─ #workspaceContainer > .workspaceWrapper > .bottomWrapper
      └─ #workspace-tab-workflows
         ├─ header(sticky,135px)
         │   ├─ 标题 "Workflows" + 副标题 "Build, manage, and run workflows in your workspace."
         │   ├─ Tab:Workflows / Evals
         │   ├─ 搜索框(placeholder "Search by name, contents, or URL")
         │   └─ 按钮:Explore Templates、Create Workflow、Add a Model
         │       视图切换(网格/列表,f a-list-ul 图标)、New Folder、Sort by: Last edited(视觉,字段级待验证)
         └─ #page-header-tabpanel-workflows(滚动区)
            └─ #workflowsContainer:grid grid-cols-1 md:2 lg:3 xl:4 gap-6
```

## 2. 工作流卡片 [事实]

`.WorkflowListItem`(实测 304×217):

```
.contents.hasContextMenu(右键菜单支持;Selecto 库多选)
└─ .WorkflowListItem(group relative h-[217px] cursor-pointer …)
   ├─ 左上角:group-hover 复选框(批量操作)
   ├─ 右上角:a 链接(Open menu / ⋯)
   ├─ 缩略图区 !pointer-events-none(react-flow 只读实例,h-40)
   └─ 底部信息区:名称(text-sm font-medium line-clamp-2)+ 状态徽章/时间(视觉见 Draft 灰 / Published 绿 [待验证:字段来源])
```

- 缩略图 = **卡片内嵌 react-flow 画布缩略图**(DOM 含 react-flow a11y 提示与 `graphBlockBodyText` 节点标签);异步渲染,先显示 `Loading workflow preview`。
- 空白工作流缩略图显示空态引导("To Get Started / Add a Model")。

## 3. 数据与 API [事实]

- 列表:`GET /query/workflow/list?workspaceId=` → `{workflows:[{owner, createdByAI, editedByAI, createTime, updateTime, name, url, id}]}`(无 config)。实测 3 个工作流(Custom Workflow / Cigarette Detection Image Check / People Smoking Detection)。
- `createdByAI` / `editedByAI` 布尔标记(Agent 创建/修改溯源)。
- 时间为 Firestore 时间戳 `{_seconds, _nanoseconds}`。
- 文件夹:`GET /query/workflowFolders/listById?workspaceId=`(空)。

## 4. 关键交互 [事实]

**卡片点击 → SPA 路由跳转 `/solutions/chat?workflowUrl=<slug>`(无 chatId),tab 标题变 "Agent"**。语义:从台账进入 = 直接编辑该工作流(聊天区为新会话输入态);chatId 形态 URL(`/solutions/chat/<id>?workflowUrl=…`)来自已有 Agent 会话(聊天列表 "Open <name>" 入口或会话恢复)。首条消息发送后 URL 重写为会话短 ID(见 06/09)。

## 4b. CRUD 契约(2026-10-21 补测)[事实]

卡片右上 `Open menu`(或右键卡片)七项:**Favorite Workflow / Pin For All / Move Workflow / Configure Workflow / Benchmark Workflow / Duplicate Workflow / Move to Trash**。

| 操作 | UI 路径 | API |
|---|---|---|
| 创建 | "Create Workflow" 按钮 → **无弹窗直接**跳转 `?workflowUrl=<新slug>`(slug 由客户端按现有去重生成,如 `custom-workflow-3`) | `POST workflow/save`(workflow 对象**无 id**;`{name, url, template:"custom", folderId:null, config:<空白 spec>, examples:[], source:"Create Workflow Modal"}`) |
| 复制 | 菜单 Duplicate | `POST workflow/save`(`template:"duplicate"`, `source:"Duplicate Workflow"`,name/slug 自动加 " 2"/"-2" 后缀,config 为被复制 spec) |
| 重命名 | 菜单 Configure(设置弹窗,含 name 字段;UI 实测未走通,API 已验证) | `POST workflow/save`(`{id, name:<新>, url, config, folderId}`) |
| 删除 | 菜单 Move to Trash → **确认弹窗要求键入 workflow slug** 才能点 Delete("moved to Trash and permanently deleted after 30 days") | `POST workflow/delete`(form 编码 `workspaceId=…&workflowIds[]=<id>`,**支持批量**;未输 slug 时前端拒绝发送) |

- **`workflow/save` 是万能写端点**(创建/复制/重命名/发布共用;区分在有无 id 与 template/source 标记)。
- 伴随端点:`GET workflow/configs?workflowIds=`(批量取配置)、`GET solutions/conversations/by-workflow/<id>`、`GET serverless…/workflows/definition/schema`。
- 创建后自动跳编辑器;删除后自动重拉 `workflow/list` + `workflowFolders/listById`。

## 5. 已知限制与待确认

- 搜索请求触发方式(防抖/回车/服务端过滤)未观测——列表页加载只见 `workflow/list` 全量,**[推断]** 过滤在前端或按需请求。
- 卡片 ⋯ 菜单、复制/重命名/删除操作、Evals Tab、模板(Explore Templates)流程未观测(列为待验证,见 unresolved)。
- Draft/Published 徽章字段来源(视觉确认存在;`workflow/get` 有 `config` vs `lastVersionConfig` 可表征,未直接对上)。

## 6. 独立实现建议

- 列表页元数据与图数据分离(list 不含 config);缩略图用只读画布实例渲染 spec(与编辑器同引擎,天然一致)。
- `createdByAI/editedByAI` 类溯源标记直接进列表模型,支撑"AI 修改过什么"的可视化。
- 路由设计沿用 `?workflowUrl=` 单参进入编辑器(资源 slug 寻址),会话 ID 只在存在聊天时叠加。
