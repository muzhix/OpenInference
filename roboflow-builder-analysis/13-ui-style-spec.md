# 13 UI 风格规范(Design Tokens)

来源:2026-10-21 CDP `getComputedStyle` 实测采样(Builder 页 + 台账页)+ 既有截图参照。目标:前端三界面与 Roboflow 视觉一致。原始采样 JSON:`tmp/rf_style_builder.json`、`tmp/rf_style_builder2.json`、`tmp/rf_style_registry.json`(随证据目录)。

## 1. 基础

| Token | 值 | 说明 |
|---|---|---|
| 字体 | `Inter, sans-serif` | 全站 body 实测 |
| 基准字号 | 16px(body)/ 14px(卡片正文、节点标题)/ 12px(按钮、辅助)/ 20px(页面标题,400) |
| 主色(purboflow) | **#6D28D9**(violet-700) | Publish/Create Workflow 实心按钮、模型节点 accent |
| 主题浅紫 | #EDE9FE(violet-100)/ 文字 #6D28D9(violet-700) | 类名 bg/text-purboflow-50~700 层级的近似映射 |
| 灰阶(Tailwind gray) | #F9FAFB(50 画布底)/ #E5E7EB(200 边框)/ #D1D5DB(300 表单边框)/ #9CA3AF(400)/ #6B7280(500)/ #374151(700 正文)/ #1F2937(800 节点标题)/ #111827(900 卡片名) |
| 功能色 | 蓝 #2563EB(blue-600,可视化类)、橙 #EA580C(orange-600,属性类)、琥珀 #FBBF24(amber-400,Draft 横幅底)、成功绿(截图参照,徽章,建议 #16A34A)、危险红(R3 截图检测框,建议 #DC2626) |

## 2. 组件规格

**按钮(两档)**:

| 档 | 实测 | 用于 |
|---|---|---|
| sm | 高 28px、圆角 8px、字号 12px/500、padding 0 10px | 顶栏 Save/Publish/Use |
| md | 高 40px、圆角 8px、字号 12px/500 | 台账 Create Workflow、搜索框同高 |
| primary | 背景 #6D28D9、白字、无边框 | Publish、Create Workflow |
| secondary/ghost | 白/透明底、字 #374151、边框 #E5E7EB(sm)/#D1D5DB(md)、圆角 6px(sm 工具按钮) | Save、Explore Templates、画布工具 |
| 次级文字 | #6B7280(gray-500) | 辅助说明 |

**节点卡片(画布)**:
- 白底;边框 1px #E5E7EB(上/右/下),**左侧彩色 accent 为 4px border-left**(不要盖住内边距)。内容距色条 16px(`pl-4`),上/右/下 padding 12px;宽度类 `w-[280px]`。阴影 `0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)`。
- 节点内单行控件与 Inputs / Outputs 相同:高 32px、圆角 8px、边框 #D1D5DB、字号 12px、focus 边框 #6D28D9(`FIELD_CONTROL`)。
- accent 分类色:模型=紫 #6D28D9、可视化=蓝 #2563EB、属性(Property/Expression)=橙 #EA580C、Inputs/Outputs=灰(无 accent,#E5E7EB)。
- 标题 14px/500/#1F2937;副文本(实例名)12px/#6B7280。
- 选中态:border/阴影强化(实测未捕获精确值,建议 #6D28D9 1.5px+同阴影)。

**端口(handle)**:圆点 20px、白底、1px 边框 #9CA3AF(gray-400)、圆形。

**画布**:容器底 #F9FAFB(gray-50)+ 点阵网格(截图:细点 gray-200 级,建议 `radial-gradient(#E5E7EB 1px, transparent 1px)` 20px 间距);react-flow light 主题。

**台账卡片**:304×217、圆角 6px、1px #D1D5DB、白底、阴影 `0 1px 2px rgba(0,0,0,.05)`;名称 14px/500/#111827;徽章:Draft 灰(截图)/Published 绿(截图);缩略图区占上部 ~2/3(#F9FAFB 底)。

**状态横幅(Draft)**:背景 #FBBF24(amber-400)、文字 #111827;含铅笔图标。三态文案见 05。

**Run 面板**:白底、左分隔线 #E5E7EB、宽 ~639px(桌面);头部按钮组 ghost。

**工具栏(画布底部悬浮)**:白胶囊、ghost 图标按钮 28px(`h-7 w-7` 类)、圆角 6px。

**Blocks 面板**:浮层白底;分类头带色主题(截图:Model 紫、Visualization 蓝、Logic 黄、Notification 琥珀、Data Storage 红粉);block 卡片 `blockListItem` 带 cursor-move + 同 accent 色。

## 3. 布局常量

- 全局导航 159px(排除范围,仅作画布左边界参考);聊天面板 ~440px;Run 面板 ~639px。
- 台账网格 `grid-cols-1/2/3/4 gap-6`;内部横向 padding 24-32px;顶栏 header 高 ~135px。
- 节点间距(自动布局产物)参考 spec 实例:y 间隔 ~236(467-56/292-56≈236/121 交替),不强求。

## 4. 复刻要点

1. Tailwind 配置直接落 tokens:colors.primary=#6D28D9、gray 用默认、accent 三色 + amber/green/red;fontFamily=Inter。
2. 按钮组件两档三态(primary/secondary/ghost × sm/md),radius 8/6。
3. 节点卡片 accent 竖条用 border-left 实现(同 Roboflow 结构,天然得到 0 6 6 0 圆角)。
4. 视觉验收:与 `tmp` 既有截图( rf_win_*、rf_after_run 等,若在)并排比对;或直接对 app.roboflow.com(同登录态)。
