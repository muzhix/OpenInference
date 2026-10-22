# Inputs 节点($inputs)

官网观测:2026-10-22(CDP DOM 实测);本地实现:`WorkflowInputNode.tsx`。

## 卡片结构

- 容器:`workflow-input-node group relative min-w-[280px] rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md`。
- 头部(`border-b border-gray-100 p-3`):40px `rounded-md bg-gray-100` 图标块 +
  `far fa-arrow-down-to-line`(text-lg text-gray-600);标题 "Inputs"(text-sm font-medium);
  副标题 "Data your workflow needs to run"(text-[10px] text-gray-600);右侧 "?" 帮助。
- 主体(`p-3`):每个声明输入一个 chip:
  `inline-flex cursor-grab gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium`
  + 类型图标(WorkflowImage→`far fa-image`,Video→`fa-video`,Data→`fa-database`)+ 名字 +
  hover 出现编辑(铅笔)/删除(×)小按钮(h-4 w-4)。
- "Add Input" 按钮(官网实测):**h-11(≈44px) 整宽居中**,`flex items-center justify-center gap-2`、
  lucide plus 在左 + "Add Input"(text-sm medium)、border-gray-200 实线白底、hover 浅灰底。
- 底部 1 个 20px source 手柄。
- 打开时右侧**只有一个** "N Outputs" 托盘摘要卡(官网实测:Inputs 无生产者面板):
  头部标题(单数 "1 Output")+ 右上角空心 "?";chip = 浅灰 gray-100 填充、**无边框**、
  rounded-md、输入类型图标 + 名字,无铅笔/×/拖拽;面板垂直居中、shadow-sm。

## 操作逻辑

- chip 拖拽:官网 chip 可拖到字段完成绑定(`draggable`,`$inputs.image`)。
- 编辑 = 重命名(本地实现重写全部 `$inputs.<old>` 引用);删除 = 移除声明,
  引用悬空由校验器标红(与官网悬空阻塞保存的语义一致)。
- Add Input:官网打开类型菜单;本地实现 Image/Video/Data 三选一,名字按 `image_2` 递增。

## 本地差异(已知)

- 官网 chip 可拖拽到字段;本地托盘 chip 承担拖拽源(节点内 chip 主要是展示+编辑)。
- 输入类型全集官网更多(如 api_key 等);本地菜单只列三种基础类型。
- 节点图标 `far fa-arrow-down-to-line` 在 FA7 免费版缺失,本地以 `down-long` 替代;"?" 为空心自绘 SVG。
- 任一节点选中时,本节点同样进入蒙版态(opacity 0.4 不可点击)。
