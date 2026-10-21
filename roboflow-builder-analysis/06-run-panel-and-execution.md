# 06 Run 面板与工作流执行

范围:Run 按钮打开的测试面板、输入、执行链路、结果展示。证据:阶段二 R3(实验 D,两次执行)、R1(加载期 API)。

## 1. 面板状态机 [事实]

```
输入态                          结果态
┌────────────────────┐         ┌────────────────────┐
│ Test Your Workflow │         │ Run Workflow  [Uses Credits]│
│ Uses Credits       │         │ ←Edit input  ↻Rerun  ⛶ ✕ │
│ Source: File|Webcam|Streamβ │ │ 输出图(检测框标注)      │
│ 拖放区(PNG·JPG·WEBP·MP4·MOV)│ │ (JSON Output 区,视觉初判)│
│ Asset Library · Image URL   │ │ 画布节点内嵌结果缩略图    │
│ Sinks on           │         └────────────────────┘
│ Run Settings(齿轮) │
│ 工作流结构概览(节点列表)│
│ [Run Workflow](615px 主按钮)│
└────────────────────┘
```

- 展开:画布右上 `Run` 按钮(aria-label=Run);面板宽 ~639px,画布左移。
- 拖放区背后是隐藏 `input[type=file]`(accept=`image/*,.heic,.heif,video/mp4,video/quicktime,.json,.txt,…`,单文件);页面上共 3 个 file input(聊天 Attach×2 + Run×1)。
- 上传后:blob 预览 + Run Workflow 解禁(disabled=false / aria=null)。
- 结果态头部:`Expand Run Panel`、`Edit input`(回输入态)、**`Rerun`**(原参数重发)、`Fullscreen`、`Close run panel`。

## 2. 执行链路 [事实]

点击 Run Workflow:

1. `GET /query/workflow/spec?workflowId=&preferDraft=true` —— 执行前重拉最新画布。
2. CORS 预检(OPTIONS)。
3. **`POST https://serverless.roboflow.com/workflows/run`**(同步,单请求;无任务 ID、无轮询、无 WebSocket):

```json
{
  "api_key": "<workspace api-key>",
  "specification": { …当前画布完整 spec(无 metadata.ui)… },
  "inputs": {
    "image": {"mediaType": "image", "videoType": "file", "type": "base64", "value": "<图片 base64>"}
  }
}
```

**图片 base64 内联,无预上传**。响应(实测 243KB):```json
{
  "outputs": [                                  // 数组:批维度
    {
      "output_image": {"type": "base64", "value": "<JPEG base64>"},
      "smoking_detection_count": 1,
      "predictions": {                           // supervision sv.Detections 序列化
        "image": {"width": 800, "height": 1088},
        "predictions": [{
          "width":88.0,"height":58.0,"x":387.0,"y":548.0,
          "confidence":0.89453125,"class_id":1,"class":"cigarette",
          "detection_id":"<uuid>","parent_id":"image",
          "rle_mask":{"size":[1088,800],"counts":"<RLE>"}
        }]
      }
    }
  ],
  "profiler_trace": []
}
```

- 输出键名与 spec `outputs[].name` 一一对应 [事实]。
- `workflow/token`(加载期获取)用途未在执行链路出现——**[待验证]**(疑与托管部署/分享相关)。
- `Run Settings`、`Sinks on`、Webcam/Stream/Asset Library 路径未展开观测。

## 2b. Image URL 输入路径(2026-10-21 补测)[事实]

点击面板内 "Image URL" 来源 pill → 拖放区替换为 **URL 输入框(placeholder `https://example.com/image.jpg`)** → 输入 URL 回车 → URL 成为已提交输入项(显示预览与尺寸)→ Run Workflow 解禁。执行链:

```
GET workflow/spec?preferDraft(常规重拉)
HEAD <image-url> ×2                        ← 前端可达性预检
POST serverless/workflows/run(同端点)
```

`inputs.image` 的 URL 形态(与 base64 相对):

```json
{"mediaType":"image","type":"url","value":"https://…","videoType":"file","validUrl":true}
```

**[推断]** `validUrl` 为 HEAD 预检结果随请求提交(服务端可免二次校验或复核)。URL 项旁出现 "Save Current Input"(保存常用输入)。

## 3. 结果渲染 [事实]

- Run 面板:输出图(带检测框/标签的渲染结果)+ 疑似 JSON Output 区(视觉初判,字段明细待验证)。
- **画布节点卡片内嵌结果缩略图**(可视化类节点直接显示渲染输出)。
- 无错误横幅/spinner;credits 仅 "Uses Credits" 标签(扣费数值/余额变化未观测)。

## 4. 与本地引擎的同构 [事实]

run API 的请求(specification + inputs)与响应(outputs 按 JsonField 名对齐、sv.Detections、base64 图)与 OpenInference 本地 `/workflows/run` 接口形态一致——云端测试执行与本地执行引擎共用 spec 契约。

## 5. 独立实现建议

- 测试执行走"当前编辑态 spec 直发"而非"已保存版本"(所见即所跑);正式运行再绑定版本。
- 输入面板三输入源(File/Webcam/Stream)+ 两取数源(资产库/URL)的矩阵;文件内联 base64 简单可靠,大文件可换分片上传(云端亦可能有上限,未测)。
- 结果对象按输出名路由到三类视图:图像(叠加检测结果)、标量(计数)、结构化(predictions 表);节点级缩略图复用同一结果缓存。
- 同步执行 + 明确错误结构最易实现与测试;长任务再引入任务 ID/轮询(云端 SAM3 实测秒级返回)。
