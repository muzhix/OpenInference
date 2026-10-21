# 11 验收测试清单

从实测行为规格导出的独立实现验收项。每项标注来源事实(引用文档)。运行环境约定:测试工作流 = 空白草稿副本;不执行发布。

## A. 台账

- A1 列表加载显示卡片:名称、缩略图(异步,先 Loading 态)、状态徽章 [01]。
- A2 卡片点击 → 路由 `?workflowUrl=<slug>` 进入编辑器;tab 标题 = 工作流名 [01]。
- A3 列表 API 不含图数据;`createdByAI/editedByAI` 正确显示 [01]。
- A4 搜索/视图切换/New Folder/排序 UI 存在(行为规格自定,Roboflow 细节未验证,标注)。

## B. 编辑器布局与画布

- B1 打开工作流:spec(preferDraft)驱动画布重建,含坐标(metadata.ui);无 UI 数据时自动布局 [03/04/05]。
- B2 单击选中(无网络请求);双击展开内嵌表单(字段=block schema:标签/描述/值) [03]。
- B3 拖动节点:坐标更新并随下次保存持久化;pan/zoom 不产生脏状态 [03]。
- B4 Backspace/Delete 删除选中节点(两者都支持,宽于实测) [03]。
- B5 添加节点(节点库点击):自动绑定主输入 + 自动生成 `<step>_output`;无网络请求 [03]。
- B6 selector 托盘:列出可用输出徽章,可拖至字段完成绑定 [03]。
- B7 工具栏齐全:undo/redo/auto layout/zoom/lock/fit/minap [02]。

## C. 保存与版本

- C1 修改后 Save 解禁;保存 = 全量 spec(含 metadata.ui)POST;响应创建具名版本 [05]。
- C2 无修改或悬空引用时 Save 禁用(可保存性语义)并给出原因 [03/05]。
- C3 reload 恢复最新草稿(位置/配置完整);未保存修改丢失 [05]。
- C4 版本历史可列出与查看(设计项,Roboflow 入口未验证)。

## D. Run 执行

- D1 Run 面板双态:输入(File/Webcam/Stream + Asset Library/Image URL + Sinks + Run Settings)与结果(输出图 + JSON + Rerun/Edit input) [06]。
- D2 上传后 Run 按钮解禁;执行 = spec + base64 输入单次同步调用 [06]。
- D3 输出键名与 spec outputs 对齐;图像/标量/predictions(sv.Detections 结构)正确渲染;节点级缩略图显示 [06]。
- D4 Rerun 原参数重发;Edit input 回输入态 [06]。
- D5 执行前重拉最新 spec(所见即所跑) [06]。

## E. Agent 协作

- E1 首条消息创建会话并关联工作流;URL 获得会话标识 [R4]。
- E2 消息走流式通道(SSE);会话全程留存 UIMessage parts(text/reasoning/tool) [R4]。
- E3 修改类请求走 `getWorkflowSpec → getBlockDocs → applyWorkflowOperations(JSON Patch + description)`;服务端校验+保存草稿;画布秒级刷新 [R4]。
- E4 patch 支持数组索引与按名寻址(`/steps/<name>/<prop>`);非法 patch 被拒且会话可见错误 [R4,错误路径为设计项]。
- E5 askUserQuestion 呈现结构化选项并回传选择;Agent 据此继续 [R4]。
- E6 新建(空白)走 buildWorkflow 全量 spec [R1]。
- E7 Agent 修改产生版本;与手动保存同一版本链;diff 可解释(description + parts) [05/R4]。

## F. 非功能

- F1 全部交互面带 aria-label 与禁用原因 [02]。
- F2 API 凭据与登录态分离(执行/注册表用独立 key) [08]。
- F3 自动化可测性:节点拖动、文件上传、键盘操作可用标准输入事件驱动(DOM 合成事件对拖动无效需真实 pointer 流) [03,经验]。

## 已知待验证项(不阻塞验收,列为 open)

见 [evidence/unresolved-questions.md](evidence/unresolved-questions.md):Publish 链路、workflows.run 工具、异常二、输入面板其余路径等。
