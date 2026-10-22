# Workflow Studio

Roboflow Workflows 风格的可视化工作流 IDE(第一版:M0-M5)。前端 SPA(本目录)+ inference server 内 `/api/wf/*` 路由组(`inference_server/inference_server/workflow_studio/`)+ SQLite 版本链。

完整背景与实测契约见 `../roboflow-builder-analysis/`(尤其 04 图 schema、05 保存/发布、06 Run、08 API 总表、11 验收清单、13 UI tokens)。本文件是实现期间的速查契约。

## 命令

技术栈仅两种语言:前端/测试为 JS/TS,后端为 Python(标准库 sqlite3)。无 Make 目标,统一用 pnpm 与 uv 直跑:

```bash
# 前端(在 workflow_studio/ 目录,或加 --dir workflow_studio)
pnpm dev        # Vite dev server :5173(基础路径 /studio/,代理 /api 与 /workflows 到 :9001)
pnpm build      # 产出 dist/(由 inference server 托管在 /studio,SPA 回退已配)
pnpm test       # vitest 单测
pnpm typecheck  # tsc --noEmit
pnpm e2e        # playwright(用系统 Chrome:channel "chrome")

# 后端(inference_server/ 目录;环境见下方"后端环境")
uv run --no-sync uvicorn inference_server.app:app --host 127.0.0.1 --port 9001   # 供前端 dev 代理或托管 /studio
.venv/bin/pytest tests/unit_tests/workflow_studio                                  # 后端单测
```

E2E(`pnpm e2e`)是全自动无依赖的:playwright `webServer` 先 `pnpm build`,再在 `:9112` 起一个 server(`uv run --no-sync`,**绝不 `uv sync`**)同时服务 `/api/wf/*` 与 `/studio` SPA,数据库用每轮唯一的 `/tmp/wf-e2e-$RANDOM.db`,`reuseExistingServer: false`。浏览器加 `--no-proxy-server`、config 里给 `NO_PROXY` 追加 localhost(本机代理会劫持 127.0.0.1 的 readiness 探针)。规格在 `e2e/*.spec.ts`,数据由测试自身经 API 播种(`e2e/helpers.ts`);`WORKFLOW_STUDIO_E2E_BASE` 可指向已运行的服务(如 dev server)。

访问:开发态 `http://localhost:5173/studio/workflows`;由 server 托管时 `http://<host>:9001/studio/workflows`。开发时先起后端再起前端。

**后端环境**:`inference_server/.venv` 已就绪(构建方式 `uv venv` + `uv pip install -e ../workflows` + `uv pip install -e ".[test]"`)。该目录**不能** `uv sync`(全 extras 锁不可解),运行一律 `uv run --no-sync` 或 `.venv/bin/…`。

## 核心 spec 数据模型(04 号文档,唯一 source of truth)

```ts
type WorkflowSpecification = {
  version: "1.0";
  inputs: { type: string; name: string }[];            // type: WorkflowImage | WorkflowVideo | WorkflowData(...)
  steps: Record<string, StepSpec> | StepSpec[];         // 引擎 JSON 是数组;云端也是数组。name 唯一。
  outputs: { type: "JsonField"; name: string; selector: string }[];
  metadata?: {
    ui?: {
      nodes: Record<string, { x: number; y: number }>;  // 键 "$inputs" | "$steps.<name>"
      edges: { source: string; target: string; inputProperty?: string; sourceSelector?: string }[];
      groups: unknown[];
    };
  };
};
type StepSpec = { type: string /* "roboflow_core/...@v1" */ } & Record<string, unknown>; // 其余键=参数(含 selector 字符串)
```

- selector 语法:`$inputs.<name>` / `$steps.<name>.<output>`(可带 `[i]`、UQL 操作如 `$steps.a.predictions[:1]`);**引用即边**。
- 步骤语义键 = `type` 与 `name`;其余属性全是参数。`workflowInput` 对应 inputs,`workflowOutput` 对应 outputs。
- 语义与 UI 分层:metadata.ui 可整体缺省 → auto-layout(dagre,LR)。
- 旧输入类型名 `InferenceImage` 与 `WorkflowImage` 兼容。
- 执行请求剥离 `metadata`(云端实测如此,本地引擎同样处理)。

## API 契约(/api/wf,全部照 08 号;后端已实现)

**config 形态约定**:所有端点的 `config` 均为 specification **内层对象**(`{version,inputs,steps,outputs,metadata?}`);后端对入参中的 `{specification:{...}}` 包装会自动解包,但响应始终返回内层对象。

| 端点 | 请求 | 响应 |
|---|---|---|
| `GET /api/wf/list` | — | `{workflows:[{id,url,name,owner,createdByAI,editedByAI,createTime,updateTime,hasUnpublishedChanges,published}]}`(无 config;不含已 trash) |
| `GET /api/wf/get?url=\|id=` | — | `{workflow:{id,url,name,config,lastVersionConfig,createTime,updateTime,createdByAI,editedByAI,owner,published}}`(config=最新草稿版本) |
| `GET /api/wf/spec?url=&preferDraft=true` | — | `{workflowSpec:{workflowId,workflowUrl,workspaceId:"local",versionId,config}}`(config 为 JSON **对象**,非字符串) |
| `POST /api/wf/saveDraft` | `{workflowId,config}`(config 为 spec **对象**或字符串均可) | `{workflow:{...元数据},version:{id,name:"Draft saved on Oct 21, 2026",createdAt,config}}`;校验失败 422 `{errors:[{code,path,message}]}` |
| `POST /api/wf/save` | 万能写:创建 `{name,url,template?,config?}`(无 id);复制 `{template:"duplicate",sourceId}`;重命名 `{id,name?,url?}`;发布 `{id,publish:true}` | `{workflow:{...完整元数据}}` |
| `POST /api/wf/delete` | `{workflowIds:[...]}` | `{deleted:[ids]}`(软删,Trash) |
| `GET /api/wf/configs?ids=1,2` | — | `{configs:{id:config}}` |
| `GET /api/wf/versions?url=\|id=` | — | `{workflowId,workflowUrl,versions:[{id,name,createdAt,published,isLatest}]}`(新→旧;C4 版本历史) |
| `GET /api/wf/versions/{versionId}` | — | `{id,name,createdAt,config}`(config 为 JSON 对象) |
| `GET /api/wf/registry` | — | blocks/describe 等价物:`{blocks,declared_kinds,kinds_connections,primitives_connections,universal_query_language_description,dynamic_block_definition_schema}` |
| `GET /api/wf/validate` | `?url=` + `?spec=`(可选覆盖) | `{errors:[{code,path,message}]}`(悬空引用=error;kind 不匹配=warning) |
| `POST /api/wf/run` | `{specification,inputs:{image:{type:"base64"\|"url",value,validUrl?}}}` | `{outputs:[{<输出名>:...}],profiler_trace:[]}` |

- 版本 id = 毫秒时间戳字符串;`spec?preferDraft=true` = 最新版本(草稿即版本链头)。
- 发布语义:`save {id,publish:true}` 将 `last_version_id` 指到最新版本;`published` = last_version_id 非空;`hasUnpublishedChanges` = 最新版本 ≠ 已发布版本。
- 删除契约:前端必须键入 workflow slug 才允许发送 delete(11/01 号实测语义)。

## 关键交互语义(03/05/06 号)

- Save 按钮 aria-disabled = "可保存性":无修改或校验错误(悬空引用)时禁用并给出原因。
- 保存后自动重拉 `spec?preferDraft=true`;reload 恢复最新草稿。
- 双击节点 → 内嵌配置表单(schema 驱动:string/number/enum/selector 四类控件);单击仅选中。
- **Add Block(两级弹窗,照官网)**:入口 = 画布左上角黑色圆形 "+"(40×40,`rounded-full bg-gray-900 shadow-xl ring-1 ring-black/10`,aria "Add block");点击打开**固定不可拖动**的左侧面板(`absolute left-4 top-16 bottom-4 w-96 rounded-xl border shadow-lg`,锚定画布边缘)。一级 = 分类列表(行 = 分类色图标块 + 分类名 + 官网一句话描述 + 右侧 chevron;12 个分类按官网顺序);二级 = 该分类 blocks(`‹ <分类名>` 返回条 + 行 = 块图标 + 名称 + short_description + 分类色 tag);底部 "View All Blocks" → 全量扁平清单(`‹ Back` 返回,无 tag);搜索框任意视图下全局过滤(扁平结果)。图标 = 注册表 `ui_manifest.icon` 的 FontAwesome 类,经 `adapter/faIcon.ts` 归一化(免费无 regular/light 细线风格,统一走 free solid;brands 保留;40 个 Pro-only 字形名替换为就近免费字形,替代表已对 FA v7 CSS 逐一验证),底色为分类色 50 级浅色 tint + 同色图标(官网同款:紫 #6D28D9 → #F5F3FF)。分类标签/描述/图标/tint 来自 2026-10-21 官网实测(`src/registry/cloudSections.ts`)。**版本展示规则(官网实测)**:每个 block 族(identifier 去 @vN)只显示**最新版本**,且最新版已弃用(`block_schema.deprecated`)的族整族隐藏(如 byte_tracker 全弃用→隐藏,由 trackers_bytetrack 替代;anthropic_claude@v4 弃用但 @v5 在→显示)——本地 250 blocks 按此规则收敛为 172 项,恰等于官网可见清单 ∩ 本地注册表。分类视图行右侧的 tag 为灰色胶囊(官网同款样式,但官网显示的是 Popular 热门标记;我们无热门数据,以分类名替代)。添加节点后:自动绑定主输入 + 自动生成 `<step>_output`(JsonField),按面板锚点级联偏移落位,面板关闭。
- 删除:Backspace 与 Delete 都支持(宽于实测);焦点在输入框时不触发。
- 键盘:Cmd/Ctrl+Z 撤销、Cmd/Ctrl+Shift+Z 或 Cmd/Ctrl+Y 重做(同输入框守卫 + preventDefault);Esc 逐级收起(节点库 → 展开表单 → 选中)。
- **画布底部工具栏(照官网 2026-10-22 实测)**:圆角 xl 白底药丸(`rounded-xl border-gray-200 shadow-sm px-2 py-1.5 gap-0.5`),按钮 `h-7 w-7 rounded-md` + FA 图标(fa-undo/fa-redo/fa-sitemap/fa-minus/fa-plus/fa-lock-open|fa-lock/fa-expand/fa-map),顺序 Undo·Redo | Auto layout(主+chevron-up 选项)| Zoom out·Zoom in | Lock | Fit view·Show minimap;悬停显示**深色药丸 tooltip**(bg-gray-900 白字 11px,悬浮于按钮上方);选项弹层含 "Arrange now" 与 **"Arrange automatically" 开关**(默认开,文案 "Re-arranges when blocks are added. Dragging a block pauses it.")——开关开启时加块自动重排,且重排折进加块的同一次 undo 步;拖动/便签不触发重排。官网当前工具栏无 trash/全屏/帮助按钮,故未实现。
- 悬空即时反馈:校验错误按 path 映射到节点(`steps.<name>.*` → 步骤卡、`outputs.*` → 输出卡,`adapter.validation.nodeKeyForValidationPath`),节点卡右上红点带 title=错误信息;悬空边红色虚线。
- Run:执行前重拉 spec(所见即所跑);Image URL 模式前端 HEAD 预检后发 `{type:"url",value,validUrl:true}`。
- 结果渲染三处:面板输出区(图像叠加检测框/标量/predictions 表)+ 画布节点缩略图 + Rerun/Edit input。

### 发布与 Use(v1 简化:发布 + 代码片段,无部署;05 号)

- 顶栏 `Publish`(`POST /api/wf/save {id,publish:true}`,无确认弹窗)把最新版本设为 live;三态横幅:从未发布琥珀 "Draft saved — not published yet" → 有未发布变更琥珀 "Saved changes are not live yet" → 干净已发布绿 "✓ Published"。
- Publish 可点条件:`!published || hasUnpublishedChanges || dirty`(干净已发布时禁用,"Nothing to publish")。
- `Use` 仅在 `published && !hasUnpublishedChanges` 时解禁;打开 **Use Workflow 弹窗**(`components/editor/UseWorkflowModal.tsx`,w-[560px],LIVE 绿徽章,Code Snippets 激活页 + Cloud API/Self-Hosted API 占位):Workflow ID(slug)、Endpoint URL(`http://<当前host>/api/wf/run`),打开时经 `spec?preferDraft=true` 拉取规范并内联进 curl 与 Python(requests)片段(`inputs.image` 用 `<BASE64_IMAGE>` 占位),每个片段带 Copy(navigator.clipboard + 降级)与 "Copied!" 反馈;Esc/遮罩/X 关闭。
- **版本历史(C4)**:顶栏时钟按钮(aria "Version history")→ w-[360px] 面板列出 `GET /api/wf/versions`(`Draft saved on …` + 相对时间 + Latest 紫/ Published 绿徽章);点行 `GET /api/wf/versions/{id}` 展示只读 pretty JSON(max-h-80),Restore 按钮禁用并注明 "Restoring versions is not available in v1";仅一个版本时给出提示。

## UI tokens(13 号文档,Tailwind 主题已落在 src/styles.css)

- 主色 `--color-primary: #6D28D9`(violet-700);浅紫 #EDE9FE;Inter 字体。
- 节点卡片:白底 280px 宽、边框 #E5E7EB、**左侧 accent 竖条**(模型紫/可视化蓝 #2563EB/属性橙 #EA580C/输入输出灰)、阴影 `0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)`、标题 14px/#1F2937、实例名 12px/#6B7280。
- 按钮:sm(28px 高、12px 字、8px 圆角)与 md(40px 高);primary 实心紫、secondary 白底灰边、ghost 透明。
- 台账卡片 304×217、圆角 6px、边框 #D1D5DB、缩略图区占上 2/3(#F9FAFB 底,异步 Loading 态)。
- Draft 横幅琥珀 #FBBF24;Published 徽章绿;成功 #16A34A、危险 #DC2626。
- 画布底 #F9FAFB + 20px 点阵(类 `workflow-studio-canvas` 已带)。
- 全部交互面带 aria-label 与禁用原因(F1)。

## 目录约定与所有权

```
src/
  api/          # /api/wf 客户端 + 类型
  adapter/      # spec ↔ graph(唯一权威转换层)
  state/        # zustand stores(editorStore/registryStore)
  components/ui/     # Button/Badge/Modal 等基础件
  components/canvas/ # 节点卡片/表单/节点库/selector 托盘/工具栏
  components/editor/ # Use Workflow 弹窗与版本历史面板
  components/ledger/ # 台账卡片与缩略图
  components/run/    # Run 面板
  pages/        # LedgerPage / EditorPage
e2e/            # playwright(规格 + helpers + fixtures;数据经 API 自行播种)
```

规则:adapter 与 api 层放纯函数并配 vitest;组件消费 store,不直接 fetch;Tailwind utility 优先,必要时内联像素值对齐 13 号规格。

## 已知留白(有意不做)

- 官网在热门块上显示灰色 "Popular" tag(云端热门数据本地没有;我们的分类视图 tag 借用同款灰色样式显示分类名);All/Custom 筛选 pill 不复刻(本地无 custom blocks);官网一级列表中的 "Industrial Integration"(cloud-only 企业块)与 "Custom" 分类不显示(交集之外);官方细线(regular/light)图标风格在 FA 免费版中不存在,统一为 solid 字重。
- FontAwesome Pro 专属字形(fal/fak)以免费 solid 版或 cube 替代;极个别 Pro-only 图标名(如 fa-distribute-spacing-horizontal)若免费版缺失则渲染为空白色块。
- 版本 Restore 禁用(v1 范围);execution_engine_compatibility 提示未呈现;CI 未接入。
