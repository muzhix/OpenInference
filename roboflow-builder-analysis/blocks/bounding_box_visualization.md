# Bounding Box Visualization(roboflow_core/bounding_box_visualization@v1)

分类:Visualization(蓝 `#2563EB`,图标 `far fa-object-group`)。页脚 Powered by Supervision(`ui_manifest.supervision`)。

通用规则见 [README](./README.md)。本文件只记这个块和通用壳的差别。

## 主表单

| 字段 | 控件 |
|---|---|
| Input Image* | selector,文案 "The image to visualize on." |
| Predictions* | selector。来自模型步骤时 chip 用模型紫色,文案如 `model.predictions` |

## Additional Properties(左侧面板)

schema 可选字段留在 Additional Properties,改过的值也不提升到主表单。

| 字段 | 控件 | 未改时的展示 |
|---|---|---|
| Copy Image | 紫色开关 | 默认开(true) |
| Color Palette | enum 下拉 | DEFAULT |
| Palette Size | number | 10 |
| Custom Colors | 逗号列表 | placeholder `#FF0000, #00FF00, #0000FF` |
| Color Axis | enum | CLASS |
| Thickness | number | 2 |
| Roundness | number | 0 |

`ui_manifest.warnings` 声明 `copy_image === false` 会改写输入图。开关关掉时主表单目前不另画警告条。

## 侧托盘

Outputs 只有 `image`,芯片用可视化蓝色。
