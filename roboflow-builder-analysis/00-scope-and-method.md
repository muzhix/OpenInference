# 00 范围与方法

## 1. 分析目标

目标产品:Roboflow Workflows(app.roboflow.com,工作区 `hanbds-workspace-a6aei`)。只研究四项功能的内容区域:

1. Workflows 台账(`/<ws>/workflows`)。
2. Workflow Builder 画布编辑器(承载于 `/<ws>/solutions/chat` 路由)。
3. Workflow Run 测试面板与执行链路。
4. AI Agent 对话面板及其对图结构的修改。

**排除**(与 rea_workflow.md §2.2 一致):全局左侧导航栏、工作空间切换、账户设置、其他业务模块(Deployments/Vision Events/Universe 等)的独立分析;被排除模块与目标功能的必要接口关系除外。

## 2. 观测方法与通道

分析对象为**已登录 Chrome 的实时运行状态**。观测通道:

| 通道 | 说明 | 已验证能力 |
|---|---|---|
| CDP 调试实例 | `127.0.0.1:9222`(Chrome 156) | target 发现、frame 树、脚本清单 |
| REA `inspect_web_page` | 默认 origin 策略 `app.roboflow.com` | 主文档 DOM、页面截图;跨域脚本/资源被过滤(155/168 条,系 CDN 分包,非 iframe) |
| node 直连 CDP | `Runtime.evaluate`(只读探查)、`Input.dispatchMouseEvent/KeyEvent`(原生交互)、`DOM.setFileInputFiles`(上传)、`Target.createTarget/closeTarget`(临时标签) | DOM 探查、拖动、文件上传、页面导航实验 |
| node 网络采集 | Network 域事件 + `Network.getResponseBody` | 请求/响应体(含 243KB 执行结果、12.7MB 注册表) |
| 页面内同源 fetch | `fetch(url, {credentials:'include'})` 经 CDP 执行 | 重放只读 API(会话全文、spec) |
| 窗口截图 | `screencapture -l<CGWindowID>` | 视觉佐证(文本转写不可靠,以 DOM 为准) |
| 视觉子代理 | general-purpose agent + 图像分析 | 布局/颜色/徽章结构(逐字文本有幻觉,一律以 DOM 文本为准) |

已知限制:第二个 Chrome 窗口(无调试端口)仅视觉可及;REA evidence bundle 不持久化,证据已转存至仓库 tmp/(凭据脱敏);后台标签渲染被节流(卡片缩略图 >11s,需 activateTarget + 轮询)。

## 3. 证据分级

- **[事实]**:DOM/CDP/网络直接观测(带证据文件引用)。
- **[推断]**:有证据支持的合理推断(标注依据)。
- **[待验证]**:未确认假设(open question,汇总见 evidence/unresolved-questions.md)。

## 4. 会话与环境事实

- 工作区 ID:`F1RYoIocgEcRp444lpElGuuQSIC2`(URL slug `hanbds-workspace-a6aei`)。
- 主实验工作流:People Smoking Detection(`workflowId=u6OhK3efSGLKzzgGd1Xg`,slug `people-smoking-detection-1785156747779`,由 Agent 创建,`createdByAI:true`);测试工作流:Custom Workflow(`IlwjRY9ESqNlyMW7zw9u`,空白草稿,所有修改类实验在其上执行并已恢复)。
- 时间:2026-10-21(UTC+8)。浏览器 Chrome 156,macOS。

## 5. 时间线

| 轮次 | 主题 | 关键产出 |
|---|---|---|
| 阶段一 | 可观测范围确认 | react-flow 确认、无 builder iframe、双套节点渲染、交互面清单 |
| 阶段二 R1 | 加载期 API | 图数据=workflows specification;API 契约;Agent 工具链(旧会话) |
| 阶段二 R2 | 保存机制 | saveDraft、metadata.ui、版本化、悬空校验、注册表全量 |
| 阶段二 R3 | Run 执行 | base64 内联、同步 run API、响应结构、结果渲染 |
| 阶段二 R4 | Agent 增量修改 | JSON Patch(applyWorkflowOperations)、SSE 通道、会话存储 |
| 阶段四 | 文档整理 | 本目录 00-11 号文档 |
