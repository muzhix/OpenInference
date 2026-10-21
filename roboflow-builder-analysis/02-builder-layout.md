# 02 Builder 布局

范围:Builder 自身内容区域(工作流专属顶栏、画布、工具栏、面板),不含全局导航。证据:阶段一(双窗口截图+DOM)、阶段二各轮。

## 1. 路由形态与承载 [事实]

- Builder 承载于 `/<ws>/solutions/chat` 路由(Agent-first 混合界面):
  - `?workflowUrl=<slug>`(无 chatId):直接编辑;聊天区为新会话输入态。
  - `/solutions/chat/<chatId>?workflowUrl=<slug>`:恢复某个 Agent 会话 + 对应工作流。
- tab 标题 = 工作流名。容器类 `workflow-builder-v2`(与本地排查定位的云端组件 `WorkflowBuilderV2Page.tsx` 互证)。
- **无 builder iframe**(frame 树仅 Intercom about:blank + Stripe 1px);React SPA 主文档内渲染。

## 2. 区域划分 [事实]

聊天展开态(新建/会话页,左→右):

```
全局导航(159px,排除)│ 聊天面板(~440px) │ 画布区(其余)
                                              ├─ 画布顶部工具行(左上+右上)
                                              ├─ react-flow 画布
                                              ├─ 底部画布工具栏(悬浮)
                                              └─ Workflow Blocks 浮层(可开合)
Run 面板展开时:画布右侧让出 ~639px 给结果/输入面板
```

画布收起聊天后画布占满(阶段一 People Smoking Detection 窗口即该态)。

## 3. 顶栏与工具行 [事实]

- 顶栏(聊天页形态):tab 条(返回、logo、工作流名 pill(×)、+新 tab、Close asset、New chat、Feedback、More)→ 状态横幅 **"Draft saved — not published yet"**(琥珀)→ 右侧按钮组:
  - `</> Use`(aria:"Publish your workflow before you can access it"——未发布时的禁用原因)
  - `Save`(aria:"Save workflow draft";aria-disabled 表达可保存性)
  - `Publish`(紫色,aria:"Publish workflow")
- 画布左上工具条:`Configure workflow`、`Show JSON panel`、`Benchmark workflow`、`Run from Anywhere`、`Share workflow`;其前有 `Cloud API ✓` 环境指示 pill。
- 画布右上:**`Run`**(▶,打开 Run 面板)、**`Builder Assist: Auto`**(下拉——构建辅助自动化档位,具体档位值待验证)。

## 4. 画布底部工具栏(react-flow__panel)[事实]

`Undo`、`Redo`、`Auto layout`(+ `Auto layout options`)、`Zoom out`、`Zoom in`、`Lock interactions`、`Fit view`、`Show minimap`(小地图默认关闭)、垃圾桶、全屏、帮助(视觉;类名清单为事实)。

## 5. Workflow Blocks 面板 [事实]

- 浮层(非停靠侧栏):搜索框(placeholder `Search workflow blocks`)+ 筛选 pill `All` / `Custom` + 分类列表 + 底部链接 `View All Blocks`。
- 结构:`blockSection > blockSectionHeader`(颜色主题类如 yellow,cursor-pointer,点击展开)→ `blockListItem group cursor-move <color>`(block 卡片)。
- 实测分类:Model、Visualization、Logic and Branching、Data Storage、Notification、Video(截断,以注册表为准)。
- 交互:点击 blockListItem → 画布添加节点(纯前端);搜索过滤生效(输入 "property" → 仅 Property Definition + "Popular" 标签)。

## 6. Run 面板与聊天面板

Run 面板输入态/结果态的完整结构见 [06-run-panel-and-execution.md](06-run-panel-and-execution.md);聊天面板(contenteditable 输入、Attach、Agent、Send message、会话消息流)见 [09](09-state-model-and-event-flows.md) 与 [阶段二 R4](evidence/phase2-round4-observations.md)。

## 7. 面板开合与画布尺寸 [事实]

- Run 面板展开:画布宽度收缩(实测画布右边界左移 ~639px);面板关闭恢复。
- 聊天折叠按钮 `Collapse chat` / `Open chat`;节点选中/双击时节点卡片自身展开(不产生独立侧栏)。
- Workflow Blocks 面板开合不影响画布布局(浮层覆盖)。

## 8. 已知限制与待验证

- Configure workflow / Show JSON panel / Benchmark / Run from Anywhere / Share 五个左上工具的行为未观测。
- `Builder Assist: Auto` 的档位与语义(疑与 Agent 自动应用修改相关)。
- 视觉子代理对工具栏位置的两次分析不一致(顶部 vs 右下)——DOM 坐标支持顶部(阶段二 R2 按钮表:y≈54-114)。

## 9. 独立实现建议

- 三区布局(聊天 / 画布 / 结果面板)以画布为中心,右面板双态(输入/结果)复用同一容器,以宽度动画切换。
- 工具栏分四组:生命周期(Save/Publish/Use)、执行(Run/Auto)、画布(undo/zoom/layout/lock/minimap)、分享配置;全部带 aria-label 与禁用原因(可作为可访问性规格)。
- 节点库为浮层 + 搜索 + 分类 + 彩色主题(与注册表 category 映射)。
