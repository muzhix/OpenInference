# Object Detection Model(roboflow_core/roboflow_object_detection_model@v1-3)

官网观测:2026-10-22(CDP DOM 实测);本地实现:`WorkflowStepNode.tsx` + `ConfigForm.tsx` +
`SelectModelModal.tsx`。族内只展示最新版(当前 @v3)。

## 收开态差异

- 收起:左侧 **6px 饱和紫 accent**;头部内联 tint 图标芯片。
- 展开(选中):左侧为**宽浅紫色块(violet-50,w≈48px)+ 白底图标芯片**,卡片内容右移;
  其余节点进入**蒙版态**(opacity 0.4 且不可点击,点击空白解除)。

## 收起态

- 左侧紫 accent(#6D28D9)+ 白卡;头部 = 紫 tint 图标块(`far fa-chart-network`)+
  小字 "Object Detection Model"(text-[11px] capitalize text-gray-500)+ 粗体实例名;
- 错误时右侧 pink-100 圆 + lucide triangle-alert(title=错误文本)。

## 展开态(单击选中或双击)

### 字段(默认可见 = 必填 ∪ 值≠默认 ∪ 已设 selector)

| 字段 | 类型 | 控件 | 说明 |
|---|---|---|---|
| Image*(images) | selector(image kind) | **绑定后 = chip**(gray-50,fa-image,hover × 清除);**未绑定 = "Select image" 按钮开来源选择弹层**(分组:$inputs 在前、各 step 输出按分类 tint,点选绑定);亦可从侧托盘拖 chip 到字段 | "The image to infer on." |
| Model*(model_id) | model | **按钮 → Select a Model 弹窗**;空+必填 = border-pink-500 + 铅笔 pink + "Required input is missing" | "Roboflow model identifier." |
| Confidence Mode(confidence_mode) | enum | 下拉 "Best (Recommended)"(chevron) | "How confidence thresholds are determined." |
| Confidence 等 | number | 32px 输入框 | 收在 Show Additional Properties 后 |

- 底部 bordered "Show Additional Properties"(fa-chevron-left);
- 页脚 "Powered by Inference" + GitHub 图标(链到 roboflow/inference)。

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
