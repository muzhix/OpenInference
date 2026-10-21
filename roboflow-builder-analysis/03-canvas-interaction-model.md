# 03 画布交互模型

范围:节点选择/拖动/删除、连线、内嵌配置、视图操作、脏状态。证据:阶段一(DOM 探查)、阶段二 R2(交互实验)、R3(selector 托盘)。

## 1. 渲染机制 [事实]

- 画布 = **React Flow / xyflow**(类名 `react-flow__pane/viewport/edges/nodes/handle/panel/edgelabel-renderer/viewport-portal`;handle 四向)。
- 自定义节点类型(react-flow node type):
  - 交互层:`workflowInput` / `workflowStep` / `workflowOutput`(类 `nopan selectable draggable`)
  - 只读层:`InputNode` / `StepNode` / `OutputNode`(`pointer-events-none`,聊天面板缩略图用)
- **同一图渲染两份**(交互画布 + 缩略图);节点卡片 `stepNodeWrapper w-[280px]` + `stepNodeAccent`(彩色主题)+ `graphBlock*` 内容结构。
- 无 `<canvas>`;连线为 SVG(react-flow edges)。

## 2. 节点交互 [事实]

| 操作 | 行为 | 网络归因 |
|---|---|---|
| 单击 | 节点 `.selected`;显示浮动菜单(Create Group / Clone / Delete / N blocks selected) | 0 请求 |
| 双击 | **节点卡片内嵌展开配置表单**(详见 §3) | 0 请求 |
| 拖动 | 位置更新(metadata.ui 坐标,浮点,含 viewport 缩放换算) | 保存时随 saveDraft 提交 |
| Backspace | 删除选中节点(**Delete 键无效**;react-flow a11y 提示写 delete,实测 Backspace) | 0 请求 |
| Esc | 取消选中 | 0 请求 |
| 方向键 | 移动节点(a11y 提示) | — |

- 拖动模拟要点(自动化):DOM `dispatchEvent` 无效,需 CDP `Input.dispatchMouseEvent`(mousePressed → mouseMoved×N → mouseReleased)。

## 3. 内嵌配置表单 [事实]

选中/双击后节点卡片展开:

```
.react-flow__node-workflowStep.selected
└─ .graphBlock.selected
   └─ .relative z-10
      └─ .workflow-form-fields flex flex-col gap-2.5
         ├─ 字段行:标签(如 "Image*")+ 描述(如 "The image to infer on.")+ 值(如 inputs.image)
         ├─ "Show Additional Properties"(折叠高级参数)
         └─ 操作行:JSON / Test / Compose / Rename / Add note / Disable / Delete
```

- 字段与 block_schema 一一对应(值即 selector 字符串,如 `$inputs.image`)。
- 底部出现**引用该节点输出的其他节点徽章**(sam3、label_visualization…)。
- Outputs 节点卡内联输出映射行(名称 → selector)+ `Add Output`;Inputs 卡含输入芯片 + `Add Input`;输出行 hover 出现编辑/删除小按钮。

## 4. 连接与绑定 [事实]

- 语义连线由 selector 引用隐式构成(引用即边);UI 层显式存 `metadata.ui.edges`(含 `inputProperty`/`sourceSelector`)。
- **输入绑定的交互 = selector 拖拽托盘**:Run 后/选中态出现 "N Inputs · Drag to block fields to connect",列出各节点输出徽章(如 `sam3 → predictions`、`label_visualization → image`,含 `all_properties`)——把输出徽章拖到目标字段完成绑定。
- 添加节点时自动绑定(新 step 的主输入指向 `$inputs.image`)并自动生成输出(`<name>_output`)。

## 5. 视图与工具 [事实]

Auto layout(一键布局,Agent 创建的无坐标图靠它)、Zoom ±、Fit view、Lock interactions、Show minimap(默认关)、Undo/Redo(react-flow 快照;与保存版本独立的本地撤销栈,**[推断]**)。

## 6. 脏状态与校验 [事实]

- Save 按钮 `aria-disabled="true"` 的语义 = **不可保存**:未修改时(无可保存内容)或校验不过时均为 true;可保存修改存在时为 null。
- **悬空引用阻塞保存**:删除节点而 Outputs 仍引用 `$steps.<name>…` 时,Save 禁用、点击不发请求;删除悬空输出绑定后解禁。
- 已知异常(待验证):删除悬空输出后 Save 解禁但点击未触发 saveDraft(命中元素正确、无遮挡)——见 unresolved-questions。

## 7. 状态层次区分(呼应 09)

- 只改画布视图:pan/zoom/fit/minimap(不产生脏状态)。
- 改图结构/配置:节点增删、参数、绑定(产生脏状态 → saveDraft)。
- 触发持久化:Save;触发执行:Run Workflow(独立于保存,直接提交当前 spec)。

## 8. 独立实现建议

- 双击展开的内嵌表单优于独立侧栏:上下文不丢失、宽度可控(280px 卡片);字段由 block schema 驱动生成(标签/描述/类型/默认值)。
- selector 拖拽托盘 + 自动绑定/自动输出是降低连接成本的三件套,建议全盘采纳。
- 校验前置到保存按钮语义(可保存性),悬空引用即时反馈。
- 删除键位同时支持 Backspace/Delete;拖动用 pointer 事件标准实现(可测试性优先)。
