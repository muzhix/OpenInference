# Block 节点通用规则(官网观测提炼,2026-10-22)

本目录存放逐 block 的展示/操作逻辑说明。本文件提炼所有 block 共用的样式与规则,
供后续批量调整其他 block 时复用。观测来源:app.roboflow.com builder(CDP 实测 DOM)。

## 1. 画布与边

- 边默认 **1px 灰 `#B1B1B7` + 闭合箭头**(marker arrowclosed,`#6B7280`,14×14);
  与选中节点相邻的边高亮为 **紫色 `#7C3AED` 2px**。悬空引用边(我们的扩展)红虚线。
- 节点手柄为 **20px 白圆 + 1px gray-400 边框**:消费方顶部 1 个 target,生产方底部 1 个 source。
- **UI 图标 = Lucide 细线图标库**(shadcn/ui 所用图标集,`lucide-react`,禁止自绘 svg):
  `hollowIcons.tsx` 的 `UiIcon` 是 **name → lucide 组件的映射表**(字符串名 API,调用点不引组件),
  `strokeWidth={1.75}`、`width/height: 1em`(尺寸继续用 `text-*` 类控制)。
  - **lucide-react 1.x 只认规范名**:旧别名(HelpCircle/Edit/Sitemap/Cubes/AlertTriangle)已删;
    用 CircleHelp/Pencil/Trash2/TriangleAlert/StickyNote/LockOpen;`Sitemap`→`Network`、`Cubes`→`Boxes`;
    品牌图标(Github 等)已删 → GitHub 标用 `fa-brands fa-github`。
  - **官网图标语义实测**(2026-10 参考图核对):Inputs 头 = `arrow-down-to-line`(下箭头入托盘),
    **Outputs 头 = `arrow-up-from-line`(上箭头出托盘,勿用下箭头)**;动作栏 JSON = `braces`;
    模型弹窗/Model 字段的"网络" = `share-2`(中心点辐射连线,非方框层级图);错误徽章 = `triangle-alert`。
  - **registry block 图标(250 块的 ui_manifest)仍用 FA solid**(无法逐个对应)。
  - 图标替代:FA7 免费版缺失 `arrow-down-to-line/from-line` → `down-long`/`arrow-down-long`;
    `faClasses()` 会忽略混入的 Tailwind 工具类(取最后一个 fa-* token)。
- **节点内弹窗必须 `createPortal(document.body)`**:选中节点被 react-flow 提到 zIndex≈1000 的
  stacking context,弹窗若原地渲染,其 z-index 只在该 context 内生效 —— 节点动作栏/托盘会压在
  弹窗上(Select a Model 曾中招)。Portal + 根 `z-[2000]` 即可全遮。
- 节点卡片宽 280px;react-flow 布局 TB。

## 2. 卡片结构(step 节点)

收起和展开共用同一套头部。分类色来自 `CLOUD_SECTIONS`(与 Workflow Blocks 面板一致)。

```
stepNodeWrapper (relative flex w-[280px] overflow-visible)
├─ 动作栏(展开时,-top-12 居中悬浮白药丸,见 §4)
├─ 侧托盘(展开时,右侧 translate-x-full,见 §5)
├─ Additional Properties 面板(展开且按钮打开时,左侧独立白卡,见 §3)
├─ 左侧 accent:4px border-left(分类色,收起、展开相同;不要用覆盖内边距的色条)
└─ graphBlock 白卡(rounded-lg border bg-white py-3 pl-4 pr-3 shadow-sm)
   内容距色条 16px。上/右/下内边距 12px。选中或展开时其余三边为分类色 2px。
   ├─ 头部
   │   · 40px 圆角图标芯片(分类色 22% 混白底 + 分类色字形,ui_manifest.icon)
   │   · 小字 block 显示名(text-[11px] text-gray-500)
   │   · 实例名(text-[15px] font-semibold text-gray-900)
   │   · 右侧:校验错误(pink-100 圆 + triangle-alert,title=错误文案)
   ├─ 表单(仅展开,见 §3)
   └─ 页脚(仅当 ui_manifest 标了 inference / supervision)
```

- 选中或展开时上/右/下边框 = 分类色 2px;未选中 = 1px `#E5E7EB`。左侧 accent 始终 4px 分类色。禁用 = 整卡 opacity 0.5。悬空引用 = 红边框。
- 收起态不展示参数摘要,只保留头部(有运行缩略图时附在头部下方)。
- 展开时机:单击节点体打开,再单击收起;按住拖动不改变打开状态。

## 2.1 两种展开形态

| 形态 | 判定 | 代表 |
|---|---|---|
| 属性面板 | schema 里有可选字段 | Object Detection Model、Bounding Box Visualization、Label Visualization |
| 配置弹窗 | 字段名 `operations`(数组) | Detections Filter 的 Operations → Configure |

属性面板是默认。`operations` 不进 JSON 文本框,改为灰底行 + Configure;同块的 `operations_parameters` 不单独露出,由弹窗写入。弹窗目前覆盖 Class & Confidence(Include / 置信度比较)。Exclude 会记住选择,但查询语言没有 not-in,语句仍是 `in (Sequence)`。

## 3. 表单字段行(通用)

主表单只放 primary 字段。底部按钮 **Show Additional Properties**(面板在左侧,未打开时 chevron-left)。打开后按钮改为 Hide,图标改为 chevron-right,节点左侧出现独立白卡(宽 300px,标题 + 关闭 ×,内部滚动),optional 字段画在这张卡里,不塞进节点。

```
[data-field-name=<property>]
├─ 标签行:label(text-xs font-medium text-gray-600)+ 必填 * (text-pink-700)
│   + 类型图标与 "?" 同为 Lucide `text-xs text-gray-400`(禁止自绘 svg,禁止混用字号)
│   + 描述与校验提示共用 `FIELD_HINT`(`text-[11px] leading-relaxed`,问号 title 同文案)。
│     禁止单独改其中一条的字号。说明 gray-500 line-clamp-1;错误(Required input is missing) pink-700。
└─ 控件(与 Inputs / Outputs 同一套,见 `FIELD_CONTROL` / `FIELD_MENU`):
    高 32px(`h-8`)、圆角 8px、边框 gray-300、text-xs、focus 边框 purple-500。
    · 值以 $ 开头 = 来源色 chip(去掉 $steps./把 $inputs. 显示成 inputs.,× 清除)
    · 未绑定的纯 selector = 居中「+ Select Image / Select Video / Select Source」。
      下拉分组名与来源 chip 同为 `text-xs font-medium`。组名左侧是该 step 的图标(同字号):inputs 用 arrow-down-to-line,其它 step 用块图标。
    · 整宽动作按钮共用 `FIELD_ACTION`(`nodes/shared.tsx`),禁止单独改其中一个:
      Select Image、Add Input、Add Output、Show Additional Properties。
      `h-8 min-h-8`、`text-xs font-medium text-gray-700`、`rounded-lg border-gray-300 bg-white`、
      内容 `justify-center gap-1.5`、hover `border-gray-400` + `bg-gray-50`。加号同为 `text-xs`。
      必填且未绑定时,按钮下的 "Required input is missing" 用 `FIELD_HINT`,不要另起字号。
    · model_id = Select a Model(空且必填:border-pink-500 + 铅笔 + "Required input is missing")
    · enum = 展示 values_metadata.name(如 Best (Recommended)),右侧 × 与 chevron
    · boolean = 紫色开关(未写值时按 schema default 显示)
    · number = 输入框(未写值时 default 作灰色 placeholder,不写入步骤;右侧上下箭头从该默认值加减)
    · string[] = 逗号输入,placeholder 取 examples 里的第一个数组
```

默认可见 = 必填 ∪ `always_visible` ∪ `relevant_for` 命中且 `required` ∪ 已绑定 `$` selector。可选字段改成字面量后仍留在 Additional Properties,不提升到节点。`relevant_for` 未命中的字段两边都不出现(例如 confidence_mode 不是 custom 时不显示 custom_confidence)。

页脚:`ui_manifest.supervision` → Powered by Supervision;`ui_manifest.inference` → Powered by Inference。都链到对应 GitHub,带 `fa-github`。两个标记都没有则不画页脚。

侧托盘里,上游 step 的 chip 和本节点 Outputs chip 用分类色 14% 混白,不再用统一灰底。`$inputs` 的 chip 保持灰。

## 4. 动作栏(展开节点上方)

白药丸 `rounded-lg border shadow-lg px-2 py-1`,按钮 h-6 text-xs:
`info | docs 链接 | JSON | Test | Rename | Add note | Disable | Delete(pink)`。
官网另有 Compose(Agent)与源码链接,本地未实现(见各 block 文档的差异节)。

## 5. 侧托盘(选中节点右侧)

- 上卡:"N Inputs · Drag to block fields to connect"——按生产节点分组($inputs 在前,
  每组 = 节点图标 + 实例名 + 输出 chips;step 组的 chip 用其分类 tint 着色;chip 可拖拽)。
- 下卡:"M Outputs"——本节点 outputs_manifest 的输出 chips(不可拖)。头部右上角问号。
  chip 用**本节点分类色 14% 混白、无边框、rounded-md**、类型图标 + 名字。
  $inputs 节点的输出 chip 仍是浅灰。面板阴影 shadow-sm。
- $outputs 节点只显示上卡;**$inputs 节点只显示下卡**(其输出 = 输入本身;官网实测 Inputs
  打开态右侧只有 "1 Output" 摘要面板,无生产者面板,垂直居中)。

## 6. Inputs / Outputs 专属

- 两者:rounded-lg 白卡 + 头部(40px bg-gray-100 图标块:fa-arrow-down-to-line / fa-arrow-down-from-line
  + 标题 + 一句话副标题 + "?")+ 底部整宽 Add Input(h-32)/ Add Output(h-38)按钮(fa-plus)。
- 输入 chip:gray-50 边框 chip + 类型图标(fa-image/fa-video/fa-database)+ 名字 + hover 编辑/删除。
- 输出行:label + hover 编辑/删除;值 chip 按来源节点分类 tint 着色,外层虚线 drop-zone;
  空态 = border-2 虚线 "No Connected Blocks" 提示。Outputs 卡边框 border-2。

## 7. 交互与状态规则

- **打开/收起 = 单击 toggle**(官网语义):单击节点体打开,再单击节点体收起;
  **按住左键拖动 = 移动节点**(不改变打开状态)。实现要点:
  - 打开态是独立的 `expandedNodeId`(toggle 依据),react-flow 的 selection 只是视觉
    (react-flow 在 mousedown 就发 selection,toggle 若读 selection 会被"误判二次点击"抵消);
  - 拖动产生的 click 要吞掉(react-flow 的 onNodeDrag 一旦有真实位移就置抑制标记);
  - 双击的第二击 320ms 内忽略;节点内控件(button/input/a 等 closest 命中)点击不触发 toggle;
  - 面板加块后不自动选中节点(官网行为:面板关闭,画布保持可交互)。
- **打开蒙版(官网实测)**:任一节点打开时,其余节点 opacity 0.4 且不可点击
  (蒙版挂在"打开态"上;react-flow 节点有内联 pointer-events:all,需 !important 覆盖);
  点击空白画布/Esc 关闭后恢复。
- 删除节点:Backspace/Delete;悬空引用阻塞保存(Save aria-disabled)。
- 拖动节点仅更新坐标;不影响 auto-arrange。
- 一切编辑产生脏状态 → saveDraft;Run 直接提交当前 spec。

## 8. 本地实现索引

- 组件:`workflow_studio/src/components/canvas/nodes/`(WorkflowStepNode / stepChrome /
  WorkflowInputNode / WorkflowOutputNode / NodeChrome / shared)、`ConfigForm.tsx`、
  `formFields.ts`、`fieldModel.ts`、`SelectModelModal.tsx`、`DetectionsFilterModal.tsx`。
- 数据:`adapter/specToGraph.ts`(节点数据/边样式)、`adapter/category.ts`(分类色/tint)、
  `adapter/faIcon.ts`(FA 图标归一化)、`adapter/mutations.ts`(输入/输出增删改)。
- 拖放:`WF_SELECTOR_DRAG_TYPE`(ConfigForm 导出)贯穿托盘 chip → 字段/输出 drop-zone。
