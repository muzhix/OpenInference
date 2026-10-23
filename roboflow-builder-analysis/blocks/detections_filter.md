# Detections Filter(roboflow_core/detections_filter@v1)

分类:Logic and Branching(琥珀 `#F59E0B`,图标 `far fa-filter`)。没有 Powered by 页脚(ui_manifest 未标 inference / supervision)。

这是第二种展开形态:没有 Additional Properties,复杂字段走弹窗。见 [README §2.1](./README.md)。

## 主表单

| 字段 | 控件 |
|---|---|
| Predictions* | selector chip |
| Operations* | 灰底行:右侧描边 Configure,下方斜体 "Not configured" 或规则摘要 |

`operations_parameters` 不单独画。Configure 弹窗(Class & Confidence)把类列表和阈值写进 `operations` 的 StaticOperand。

弹窗:Filter By = Class & Confidence;Object Class 的 Include / Exclude + 逗号类名;Confidence 比较符(默认 ≥ 0.5)。两条都勾选时语句用 `and`。

Exclude 会记在操作上的 `ui_class_mode`(引擎忽略未知键),类条件本身仍是 `in (Sequence)`。查询语言没有 not-in,排除语义还不会在运行时生效。
