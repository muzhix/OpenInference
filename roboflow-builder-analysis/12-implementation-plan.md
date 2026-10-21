# 12 开工计划(Implementation Plan)

基于 00-11 号实测文档的完整开工计划。每项设计均标注契约依据(引用文档号);无依据处明确标记为**决策项**并给出推荐默认。

## 1. 目标与范围

**目标**:构建一个可视化 AI 工作流 IDE,包含 Roboflow Workflows 的三大功能,并与本仓库 inference 引擎组成完整闭环:

1. **Workflows 台账**:列表/卡片(缩略图)/创建/复制/重命名/删除/搜索。
2. **画布编辑器**:spec 驱动的节点图编辑(增删改/拖动/连线绑定/内嵌配置表单/保存/发布)。
3. **Run 测试**:输入面板(File/Image URL)、执行、结果渲染(图/标量/predictions)。
4. **后续阶段(不在第一版)**:AI Agent 对话式建图/改图(JSON Patch 增量修改)。

**非目标(第一版,决策已确认 2026-10-21)**:AI Agent 对话改图(移至后续阶段 M6)、多用户协作、Firestore 级实时同步、Webcam/Stream 输入、完整部署/托管面板(Publish 仅做"发布+代码片段"简化版)、credits 计费、模板市场(Explore Templates)、iframe 壳模式(本地编辑云端工作流)。

**成功标准**:[11-acceptance-tests.md](11-acceptance-tests.md) 的 A/B/C/D 四组全部通过(A1-A3、B1-B7、C1-C4、D1-D5;E 组随 M6)。

## 2. 总体架构与现有仓库的关系

```
┌─────────────────────────── workflow_studio/(新,前端 SPA)───────────────────────────┐
│  台账页 /workflows          画布编辑器 /build?workflowUrl=<slug>        (后续)Chat   │
│  React+TS+Vite · @xyflow/react · Tailwind · JSON-Schema 表单 · (后续)AI SDK v5      │
└──────────────┬───────────────────────────────────────────────────────────────────┘
               │ REST(spec/CRUD/save/publish) + 执行调用(同进程 HTTP)
┌──────────────▼──────────────── inference server(现有,扩展)───────────────────────┐
│  /api/wf/* (新): list/get/spec/saveDraft/save/delete/configs   ← 照 08 契约设计     │
│  /api/wf/registry (新): blocks/describe 等价物                  ← manifest 自产     │
│  /workflows/run (现有引擎入口,补齐 run 面板所需响应形态)                              │
│  roboflow_workflows 引擎(现有):spec 解析/selector 求值/block 执行                    │
│  SQLite(新):workflow 元数据 + 版本链 + 草稿                                           │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**关系决策(依据 04/06:云端 spec 与本仓库引擎同构,四处交叉验证)**:
- **执行端零改造复用**:编辑器保存的 config 直接交引擎执行;run 响应按 06 契约对齐(outputs 数组按 JsonField 名、base64 图、sv.Detections 风格 predictions)。
- **注册表自产**:`workflows` 包的 block manifest(250+ blocks,见 workflow-mechanism-analysis.md)生成 `blocks/describe` 等价注册表(block_schema/outputs kind/kinds_connections/操作符),前端节点库、表单、连接校验全部消费它——不依赖逆向抓取的 12.7MB。
- **现有 `/build` iframe 壳(editor.html+BUILDER_ORIGIN+CSRF)**:第一版**替换**为自研编辑器直出(同源托管于 inference server),保留壳作为后续"本地编辑远端工作流"的扩展路径。
- **包位置**:顶层新目录 `workflow_studio/`(与 `stream_vision/`、`workflows/` 同级,遵循仓库惯例,独立 pyproject/package.json 与隔离测试)。

## 3. 技术选型

| 层 | 选型 | 依据/理由 |
|---|---|---|
| 前端框架 | React 18+ + TypeScript + Vite | 07:云端同栈;生态最配 xyflow |
| 画布 | @xyflow/react(React Flow v12) | 03:实测云端即此;自定义节点/handle/panel/minimap 全覆盖 |
| 样式 | Tailwind CSS | 07 |
| 表单 | 自研轻量 JSON-Schema 渲染(输入/数字/枚举/selector 四类控件起步) | 03/04:字段结构=block_schema;控件集小,自研比 RJSF 轻 |
| 状态管理 | spec 单一数据源 + zustand(编辑副本/派生 memo) | 09 六层状态模型;无需 redux |
| 后端 | FastAPI 路由加入 inference server | 与引擎同进程,零部署成本 |
| 存储 | SQLite(SQLAlchemy)默认 `MODEL_CACHE_DIR/workflow_studio.db` | 版本链查询需求(05);单文件可迁移 Postgres |
| 执行 | 现有 roboflow_workflows 引擎 | 06 同构验证 |
| AI 消息(M6) | Vercel AI SDK v5(UIMessage parts)+ SSE | R4 实测同构协议 |
| 测试 | 前端 vitest+playwright;后端 pytest(沿用仓库栈) | F3 可测性要求 |

## 4. 数据模型(服务端)

```sql
workflows(id TEXT PK, name, url UNIQUE, owner, created_at, updated_at,
          created_by_ai BOOL DEFAULT 0, edited_by_ai BOOL DEFAULT 0,
          last_version_id TEXT NULL)          -- 当前已发布版本
versions(id TEXT PK,            -- <毫秒时间戳>(05 实测格式)
         workflow_id FK, name, -- "Draft saved on <date>" 自动命名
         config TEXT,          -- specification JSON 字符串(含 metadata.ui)
         created_at)
-- "当前草稿" = 该 workflow 最新 version;spec?preferDraft 语义(05)
```

- spec JSON 结构、metadata.ui(nodes/edges/groups)、双输入类型名(WorkflowImage/InferenceImage 兼容)照 04/evidence 实例集。
- `workflow/save` 万能写端点语义(创建无 id/复制 template:duplicate/重命名/发布)照 01 §4b。

## 5. API 设计(直接采用 08 契约,前缀 /api/wf)

| 端点 | 对应实测 | 说明 |
|---|---|---|
| GET /api/wf/list | workflow/list | 元数据数组(无 config) |
| GET /api/wf/get?url=|id= | workflow/get | 含 config/lastVersionConfig |
| GET /api/wf/spec?id=&preferDraft= | workflow/spec | 画布数据源 |
| POST /api/wf/saveDraft | saveDraft | {id, config} → 创建 version |
| POST /api/wf/save | save | 万能写(创建/复制/重命名/发布,按对象形态) |
| POST /api/wf/delete | delete | 批量 ids;Trash 语义可简化为软删 |
| GET /api/wf/configs?ids= | configs | 批量 |
| GET /api/wf/registry | blocks/describe | **manifest 自产**;附 definition/schema |
| POST /api/wf/run | serverless workflows/run | {specification, inputs:{image:{type:base64|url,value}}} → {outputs:[…]}(对接现有引擎执行入口,补齐响应形态) |

鉴权第一版本地免鉴权(localhost);上云时加 workspace key 模式(08 §3 分离验证)。

## 6. 里程碑与工作分解

### M0 骨架(0.5 周)
- `workflow_studio/` 前端骨架(Vite+TS+Tailwind+路由 /workflows、/build);inference server 挂 `/api/wf` 路由组与 SQLite 初始化;CI(vitest/pytest 接入仓库 workflow)。
- **验收**:两页面空壳可跑;`make` 目标 `studio_dev`。

### M1 数据层与注册表(1 周)——后端
- spec Pydantic 模型(specification/inputs/steps/outputs/metadata.ui;双类型名兼容)+ 校验器(selector 可解析、悬空输出、kind 矩阵)。
- SQLite 版本链 + 上表全部端点 + 万能 save 语义 + 删除确认契约(前端键入 slug)。
- **注册表生成器**:`workflows` manifest → block_schema/outputs kind/kinds_connections/操作符(对齐 04 §2 结构);`GET /api/wf/registry`。
- **验收**:pytest 覆盖 CRUD/版本链/校验器/注册表生成(≥250 blocks 产出);11-C1/C2/C3 数据侧。

### M2 画布编辑器 MVP(2.5 周)——最大单体
- **spec↔graph adapter**(核心):spec→nodes/edges(引用即边+metadata.ui 投影)、反向同步(坐标/参数/增删→spec dirty)、无 metadata.ui 时 auto-layout(dagre/elk)。
- 节点卡片三类型(workflowInput/Step/Output):标题/实例名/摘要/四向 handle/选中态(03)。
- 内嵌配置表单:双击展开、schema 驱动四类控件、Show Additional Properties、节点操作组(JSON/Test 后移/Compose 后移/Rename/Add note/Disable/Delete)。
- 添加节点流:节点库浮层(搜索/分类/彩色主题)+ 自动绑定主输入 + 自动生成输出。
- selector 托盘(拖输出徽章到字段);Save 按钮"可保存性"语义 + saveDraft 调用 + reload 恢复。
- **验收**:11-B1/B2/B3/B5/B6/C1/C3。

### M3 台账(1 周)
- 列表页:网格卡片(只读 react-flow 缩略图 + Loading 态)、Create(无弹窗直跳)/Duplicate/Rename/Trash(键入 slug 确认)、Draft/Published 徽章、搜索(前端过滤起步)。
- **验收**:11-A1/A2/A3 + CRUD 全链路。

### M4 Run 测试(1 周)
- 输入面板双态:File(拖放/base64)/Image URL(HEAD 预检+type:url+validUrl)、Sinks/Settings 占位、结构概览。
- 执行:重拉 spec → /api/wf/run(对接引擎)→ 结果渲染三处(面板输出图叠加检测框、节点缩略图、predictions 表/标量计数);Rerun/Edit input。
- **验收**:11-D1-D5(用 People Smoking Detection 等价 spec + 测试图)。

### M5 打磨与发布语义(1 周)
- 悬空引用即时反馈、undo/redo(前端栈)、minimap/lock/fit/zoom、三态横幅、Publish 简化版(决策已确认):`workflow/save` 固化 config==lastVersionConfig + 三态横幅 + Use 解禁为"代码片段面板"(展示调用本机 run 端点的 curl/Python 片段,不做部署对接)。
- **验收**:11-B4/B7/C2/C4 + F1/F3;整体 E2E(playwright)。

### M6(后续阶段,第一版不含;决策已确认)
- Chat 侧栏(contenteditable/SSE)、会话存储(UIMessage parts)、工具集 getWorkflowSpec/getBlockDocs/applyWorkflowOperations(JSON Patch+description,按名寻址)/buildWorkflow/askUserQuestion;服务端 patch 应用+校验+存草稿;画布刷新。
- **验收**:11-E1-E7。

**总计(第一版范围):M0-M5 约 7 周(单人全职)。M6(Agent)为后续独立阶段,追加约 1.5 周,验收即 11-E 组。**

## 7. 关键技术方案要点

1. **adapter 双向同步**(M2 核心):spec 为唯一 source of truth;nodes/edges/viewport 全部派生;编辑操作产出的不是图操作而是 spec 变更(便于 undo 以 spec 快照实现,且与 Agent patch 同构)。
2. **表单生成**:控件四类(string/number/enum/selector);selector 控件 = 托盘拖放目标 + 文本输入(校验 selector 语法)。
3. **连接校验**:kinds_connections 矩阵(M1 产出)在拖放与保存两处生效;悬空输出阻塞保存(03/05 实测语义)。
4. **执行对接**:本地引擎按 spec 运行;包装为 06 响应形态(outputs 按名对齐;图像类输出 base64;predictions 序列化为 sv.Detections JSON)。spec 里 metadata.ui 执行时剥离(实测 run 请求即无 metadata)。
5. **注册表版本兼容**:manifest 的版本约束映射 execution_engine_compatibility 字段;UI 呈现不兼容提示。

## 8. 风险与预案

| 风险 | 等级 | 预案 |
|---|---|---|
| adapter 复杂度(位置/边/组与语义双向) | 高 | 先语义后 UI(位置仅持久化不做校验);metadata.ui 通过接口隔离,评估后续分离(10 §9) |
| 引擎响应形态差异(本地 outputs 结构) | 中 | M4 首任务做形态适配层+契约测试;以 06 实测响应为黄金样本 |
| manifest → 注册表字段不全(kinds_connections 需从代码推导) | 中 | 利用 workflow-mechanism-analysis.md 的 Kind 分析;不足处先降级为宽松校验 |
| base64 大图请求体过大 | 低 | 上限+分片/URL 模式优先;云端同限制未测(记录) |
| 删除确认/发布等不可逆操作误触发 | 低 | 照实测交互(键入 slug);本地数据可备份 |

## 9. 决策记录

已定(实测依据):spec 同构复用引擎;API 照 08;React+xyflow+Tailwind;包位置 `workflow_studio/`。

**用户已确认(2026-10-21)**:
1. 存储:**SQLite** 版本链;
2. M6 Agent:**不入第一版**(M0-M5 交付三大功能);
3. Publish:第一版做**"发布+代码片段"简化版**(不做部署对接);
4. **暂不做 iframe 壳模式**。

**UI 风格要求(用户确认)**:前端界面与 Roboflow 视觉一致,以 [13-ui-style-spec.md](13-ui-style-spec.md) 的实测 design tokens 为准(色板/字体/组件规格);实现中如遇细节缺失,按 00 §2 观测通道对 app.roboflow.com 在线补测。

**当前状态:计划冻结,暂不开始实现**(用户指示,2026-10-21)。
