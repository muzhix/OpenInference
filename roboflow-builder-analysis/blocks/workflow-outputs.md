# Outputs 节点($outputs)

官网观测:2026-10-22(CDP DOM 实测);本地实现:`WorkflowOutputNode.tsx`。

## 卡片结构

- 容器:`workflow-output-node group relative w-[280px] rounded-lg border-2 border-gray-200 bg-white shadow-sm hover:shadow-md`(注意 border-2)。
- 头部同 Inputs 模式:图标 `far fa-arrow-down-from-line`,副标题 "Results your workflow returns"。
- 每个输出一行:
  - label(text-xs font-medium text-gray-700)+ hover 编辑/删除小按钮;
  - 值 = selector chip,**按来源节点分类 tint 着色**(如 model 的输出紫 tint +
    `far fa-object-intersect` + `model.predictions`,去掉 $ 前缀显示),
    外层 `drop-zone-base rounded-lg border-2 border-dashed`(拖放目标,激活时紫色);
  - 悬空 selector = 红 chip + 红 label(本地扩展,官网靠 Save 禁用表达)。
- 空态:border-2 虚线框 "No Connected Blocks / Connect workflow blocks to this output block
  to define what your workflow returns."。
- "Add Output" 按钮:`h-[38px] w-full rounded-lg border border-gray-300 text-sm` + `far fa-plus`。
- 顶部 1 个 20px target 手柄。
- 选中时右侧显示 "N Inputs · Drag to block fields to connect" 托盘:按生产节点分组
  (每组 = 节点图标 + 实例名 + 可拖输出 chips,step 组按分类 tint 着色)。

## 操作逻辑

- 绑定来源:① 从托盘/Inputs 侧拖 chip 到行 drop-zone;② 手动输入 selector;
  ③ 画布连线(onConnect 追加输出行)。
- 拖到 `$outputs` 的连线语义 = 追加 JsonField 行(引用即边)。
- 删除行 / 清除绑定(×)即时反映为边消失。

## 本地差异(已知)

- 官网输出 chip 图标按输出 kind 区分(fa-id-badge/fa-object-intersect/fa-chart-network);
  本地统一 `fa-object-intersect`(kind→图标映射未做)。
- 输出名重命名本地已实现(官网同);行内 hover 按钮官网在 data-drag-hide 容器内,行为一致。
- 节点图标 `far fa-arrow-down-from-line` 免费版缺失,本地以 `arrow-down-long` 替代;未绑定行的控件同样是 "Select source" 按钮开来源弹层(与字段一致)。
