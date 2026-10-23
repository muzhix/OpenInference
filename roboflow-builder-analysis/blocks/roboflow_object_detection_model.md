# Object Detection Model(roboflow_core/roboflow_object_detection_model@v1-3)

官网观测:2026-10-22(CDP DOM 实测);本地实现:`WorkflowStepNode.tsx` + `ConfigForm.tsx` +
`SelectModelModal.tsx`。族内只展示最新版(当前 @v3)。

## 收开态差异

收起和展开共用头部:左侧 **4px 饱和紫 accent**(border-left,内容再空 16px)+ 紫底图标芯片(`far fa-chart-network`)。展开后边框变为分类色,表单、动作栏、右侧托盘出现;其余节点进入蒙版。

## 收起态

- 紫 accent(`#6D28D9`)+ 白卡;图标芯片为分类色约 22% 混白;
- 小字 "Object Detection Model"(`text-[11px] text-gray-500`)+ 实例名(`text-[15px] font-semibold`);
- 错误时右侧 pink-100 圆 + triangle-alert。不展示参数摘要。

## 展开态(单击节点体)

### 字段

主表单 = 必填 ∪ `always_visible` ∪ 已绑定 selector。可选字段即使改过值也留在左侧 Additional Properties。`relevant_for` 未命中的字段不出现。

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| Image*(images) | selector | 绑定后 chip(`inputs.image`);未绑定 "Select image" | "The image to infer on." |
| Model*(model_id) | model | Select a Model;空且必填时红框 + "Required input is missing" | "Roboflow model identifier." |
| Confidence Mode | enum,`always_visible` | 下拉显示 values_metadata,默认 "Best (Recommended)" | 即使值等于 default 也留在主表单 |
| Custom Confidence | number,`relevant_for: confidence_mode=custom` | 仅 Custom 时出现在主表单 | |
| Class Filter、Iou Threshold、Max Detections 等 | 各类 | 左侧 Additional Properties 面板 | 未改值时 number 的 default 是灰色 placeholder(不占输入值),聚焦后可直接输入,右侧上下箭头从该默认值加减;列表 placeholder 为 `a, b, c` |

- 底部 "Show Additional Properties";打开后按钮变为 Hide,面板在节点左侧,不把字段塞进卡片;
- 页脚 "Powered by Inference"(`ui_manifest.inference`);
- 右侧 "3 Outputs":inference_id / predictions / model_id,芯片用模型分类色。

### 动作栏(上方白药丸)

info(title=描述)| docs(链到 inference.roboflow.com/workflows/blocks/object-detection-model)|
JSON(内联步骤 JSON)| Test(打开 Run 面板)| Rename(实例名行内改)| Add note |
Disable(title "Disable this block (it will be skipped at run time)")| Delete(pink)。

### 侧托盘(右侧)

- "N Inputs · Drag to block fields to connect":$inputs 组 + 各 step 组的可拖 chips;
- "3 Outputs":inference_id / predictions / model_id(紫 tint chips,kind 图标)。

## Select a Model 弹窗

- **`createPortal(document.body)` + 根 z-[2000]**(必须:否则被选中节点的 stacking context 罩住,
  动作栏/托盘会压在弹窗上 —— 2026-10-22 实测中招);
- 遮罩 bg-black/25;面板 max-w-5xl h-[calc(100vh-2rem)] rounded-lg shadow-xl;
- 头部:lucide share-2 + "Select a Model"(text-lg font-semibold)+ 关闭 ×(hover 红);
- 左栏(w-72):搜索框("Search by name or model id")+ Source 标签与 chips(My Models /
  **Pre-Trained** 选中紫 / Starred,**纵向 flex-wrap 堆叠**,横排会溢出裁切)+
  Sort By chip(Recommended ▾);
- 右栏:模型行(40px tint 图标 + 名称 + 类型图标 + "•" + 描述;data-model-id)。

### 本地差异(重要)

官网右栏列出工作区/预训练模型(RF-DETR、People Detection 等)。**本地无模型目录 API**,
不虚构清单:搜索框输入 model id 后出现 "Use this model id" 行,选择后原样写入 model_id
(验证:输入 project/3 → chip 显示 project/3)。接入真实模型目录后替换数据源即可。

## 其它本地差异

- 官网动作栏含 Compose(Agent 编排)与源码链接(fully_qualified_block_class_name 推导),
  本地未实现;Test 官网语义为运行验证,本地映射为打开 Run 面板。
- 字段类型小图标官网来自 kind 系统,本地为启发式(image→lucide image、model_id→lucide share-2、video→lucide video)。
- 悬空引用边红虚线为本地扩展反馈。
