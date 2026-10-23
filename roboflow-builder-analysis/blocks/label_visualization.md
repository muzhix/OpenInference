# Label Visualization(roboflow_core/label_visualization@v2)

分类:Visualization(蓝 `#2563EB`,图标 `far fa-tag`)。页脚 Powered by Supervision。族内展示最新版,当前 @v2(比 @v1 多 Size mode)。

通用规则见 [README](./README.md)。

## 主表单

必填在前,然后按 schema 顺序排 `always_visible`。

| 字段 | 原因 | 控件 |
|---|---|---|
| Input Image* | 必填 selector | 来源 chip / Select image |
| Predictions* | 必填 selector | 来源色 chip |
| Text | `always_visible`,默认 Class | enum,选项即字面量(Class、Confidence、…) |
| Size mode | `always_visible`,title "Size mode",默认 Manual | enum:Manual / Automatic |

## Additional Properties

与 Bounding Box Visualization 共用 Colorable 字段(Copy Image、Color Palette、Palette Size、Custom Colors、Color Axis),再加上:

| 字段 | 默认 |
|---|---|
| Text Position | TOP_LEFT |
| Text Color | WHITE(文本框,不是 enum) |
| Scale | 1 |
| Text Thickness | 1 |
| Text Padding | 10 |
| Border Radius | 0 |

Size mode 为 Automatic 时 Scale 的含义变成相对 1080p 基线的倍率,控件仍是同一个 number 字段。
