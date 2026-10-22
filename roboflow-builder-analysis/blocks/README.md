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

```
stepNodeWrapper (relative flex w-[280px] overflow-visible)
├─ 动作栏(选中/展开时,-top-12 居中悬浮白药丸,见 §4)
├─ 侧托盘(选中时,右侧 translate-x-full,见 §5)
├─ 左侧 accent:**收起 = 6px 分类色竖条;展开 = 宽浅色块(w-12 分类 tint,
│   圆角左)+ 白底图标芯片坐在其上**(卡片内容右移让位)
└─ graphBlock 卡片(白底 rounded-lg border border-l-0 p-3 shadow-sm hover:shadow-md)
   ├─ 头部:tint 图标块(40px 附近,分类 tint 底 + 分类色字形)
   │   · 小字 block 显示名(text-[11px] capitalize text-gray-500)
   │   · 粗体实例名(text-sm font-medium text-gray-800)
   │   · 右侧:校验错误按钮(pink-100 圆 + lucide triangle-alert pink-800,title=错误)
   ├─ 表单(选中/双击展开,见 §3)
   └─ 页脚:"Powered by [Inference](github) <github 图标>"(text-[10px] text-gray-500)
```

- 选中边框 = 分类色;禁用 = 整卡 opacity-0.5;悬空引用 = 红边框(我们的扩展)。
- 展开时机:**单击选中即展示表单**,双击等效;Esc 收起。

## 3. 表单字段行(通用)

```
[data-field-name=<property>]
├─ 标签行:label(text-xs font-medium text-gray-600)+ 必填 * (text-pink-800)
│   + 类型小图标(10px text-gray-400)+ "?"(title=描述)+ 描述(text-[11px] gray-500, line-clamp-1)
├─ 控件(高 32px,圆角 6-8px,text-xs):
│   · selector 值 = chip(border gray-200 bg-gray-50,显示去掉 $ 前缀,hover × 清除,拖放目标);
│     **未绑定时 = "Select image/Select source" 按钮开来源选择弹层**
│     (分组:$inputs 在前、各 step 输出按分类 tint 着色,点选即绑定)
│   · model_id = 按钮触发 Select a Model 弹窗(空+必填时 border-pink-500 + 铅笔 pink + "Required input is missing")
│   · enum = 下拉(chevron-down);number/text = 输入框
└─ 可选字段收在底部 bordered "Show Additional Properties" 按钮(fa-chevron-left)后
```

- 默认可见字段 = 必填 ∪ 值≠默认 ∪ 已设 selector。
- 字段值可用侧托盘 chip **拖放到 selector chip / 虚线 drop-zone** 完成绑定。

## 4. 动作栏(展开节点上方)

白药丸 `rounded-lg border shadow-lg px-2 py-1`,按钮 h-6 text-xs:
`info | docs 链接 | JSON | Test | Rename | Add note | Disable | Delete(pink)`。
官网另有 Compose(Agent)与源码链接,本地未实现(见各 block 文档的差异节)。

## 5. 侧托盘(选中节点右侧)

- 上卡:"N Inputs · Drag to block fields to connect"——按生产节点分组($inputs 在前,
  每组 = 节点图标 + 实例名 + 输出 chips;step 组的 chip 用其分类 tint 着色;chip 可拖拽)。
- 下卡:"M Outputs"——本节点 outputs_manifest 的输出 chips(不可拖)。**面板头部右上角空心问号**
  (与卡头的 "?" 同款);chip = **浅灰填充 gray-100、无边框、rounded-md**、类型图标 + 名字
  ($inputs 的 chip 用输入类型图标,step 的用 box);面板阴影 shadow-sm(轻)。
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

- 组件:`workflow_studio/src/components/canvas/nodes/`(WorkflowStepNode / WorkflowInputNode /
  WorkflowOutputNode / NodeChrome / shared)、`ConfigForm.tsx`、`SelectModelModal.tsx`。
- 数据:`adapter/specToGraph.ts`(节点数据/边样式)、`adapter/category.ts`(分类色/tint)、
  `adapter/faIcon.ts`(FA 图标归一化)、`adapter/mutations.ts`(输入/输出增删改)。
- 拖放:`WF_SELECTOR_DRAG_TYPE`(ConfigForm 导出)贯穿托盘 chip → 字段/输出 drop-zone。
