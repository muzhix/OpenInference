# 04 节点系统与图 Schema

范围:节点注册表、Kind 类型系统、连接规则、工作流图数据模型。证据:阶段二 R1(图数据)、R2(注册表全量)、R3/R4(spec 实例)。

## 1. 工作流图数据模型 [事实]

`workflow/get`、`workflow/spec`、`saveDraft`、`workflows/run`、`applyWorkflowOperations` 中流转的均为同一结构(字符串化的):

```json
{
  "specification": {
    "version": "1.0",
    "inputs":  [ {"type": "WorkflowImage", "name": "image"} ],
    "steps": [
      {
        "type": "roboflow_core/sam3@v3",        // block 类型:命名空间/名称@版本
        "name": "sam3",                          // 图内唯一名(selector 寻址键)
        "images": "$inputs.image",               // 参数绑定:selector 引用
        "model_id": "sam3/sam3_final",
        "class_names": ["person smoking", "cigarette", "smoke"]
      }
    ],
    "outputs": [ {"type": "JsonField", "name": "output_image", "selector": "$steps.label_visualization.image"} ],
    "metadata": {
      "ui": {
        "nodes":  { "$inputs": {"x":0,"y":56}, "$steps.sam3": {"x":0,"y":292} },
        "edges":  [ {"source":"$inputs","target":"$steps.sam3","inputProperty":"data","sourceSelector":"image"} ],
        "groups": []
      }
    }
  }
}
```

- **语义与 UI 分层**:selector DAG(steps 参数引用)是语义;`metadata.ui` 承载坐标/边属性/分组,可缺省(Agent 创建的图无 UI 数据,由 Auto layout 补齐)。
- 连线不是一等公民:`$inputs.x` / `$steps.<name>.<output>` 引用即边;`metadata.ui.edges` 是其 UI 投影(可带 inputProperty/sourceSelector)。
- selector 语法即本仓库 inference 引擎的 selector 体系 —— **云端 Builder 与开源执行引擎同构** [事实,交叉验证:类型名/selector/JsonField 完全一致]。
- 版本化类型名并存:旧 `InferenceImage` 与新 `WorkflowImage`(Agent patch 会做迁移:`replace /inputs/0/type`)。

## 2. 节点注册表(blocks/describe)[事实]

`POST https://serverless.roboflow.com/workflows/blocks/describe?api_key=hanbds-workspace-a6aei`(结果已保存，详见 `tmp/blocks_describe.json`):

```
blocks[263]               256× roboflow_core + 7× roboflow_enterprise
declared_kinds[45]        {name, description, docs, serialised_data_type, internal_data_type}
kinds_connections{30+}    按 kind 列出全部合法消费者
primitives_connections    原始类型的连接
universal_query_language_description   操作符清单(property_definition 用)
dynamic_block_definition_schema        动态 block 定义的 JSON Schema
```

每个 block 条目:

| 字段 | 含义 |
|---|---|
| `manifest_type_identifier` | `roboflow_core/sam3@v3`(+aliases) |
| `block_schema` | JSON Schema:属性名/类型/默认值/描述/示例(如 sam3 的 `images/model_id/class_names/confidence/…`) |
| `outputs_manifest` | 输出端口 → kind 列表(如 sam3.predictions → instance_segmentation_prediction) |
| `execution_engine_compatibility` | `>=1.3.0,<2.0.0` 等 |
| `restrictions` / 维度偏移 | 运行约束与数据维度信息 |

`kinds_connections[image]` 形如 `[{manifest_type_identifier, property_name, property_description, compatible_element, is_list_element, is_dict_element}]` —— **每种 kind 的全部合法输入端口清单 = 连接校验矩阵**。

`universal_query_language_description.operations_description[]`:操作符(`StringToLowerCase`…,含 input_kind/output_kind/compound)——property_definition 的 operations 就是这套 UQL。

## 3. 节点视觉结构 [事实]

节点卡片:`graphBlock`(彩色主题类,如 orange)+ `graphBlockIcon` + `graphBlockBody`(标题+实例名+配置摘要)+ `graphBlockTag`;选中态内嵌 `workflow-form-fields`(见 03)。Handle 四向(top/bottom/left/right)。

## 4. 节点行为规则 [事实]

- 添加(Blocks 面板点击):纯前端;自动绑定主输入、自动生成 `<step>_output`(JsonField,可带 `coordinates_system:"own"` 等参数)。
- 配置修改:内嵌表单改 selector/参数值。
- 删除:Backspace;悬空输出引用会阻塞保存(03 §6)。
- Agent 添加/修改:JSON Patch(见 10)。

## 5. 待验证

- `dynamic_block_definition_schema` 对应的"用户自定义 block"运行时(未实验)。
- `input_dimensionality_offsets`/`dimensionality_reference_property` 的前端用途(连线时维度提示?)。
- blocks 面板分类(UI 六类)与注册表字段的映射关系。

## 6. 独立实现建议

- **单一 spec 双层(语义 + metadata.ui)** 是本分析最重要的架构事实:编辑器、Agent、执行器、缩略图全部围绕它;独立实现应把"图 schema"设计为同样的一等核心,UI 状态可丢可重建。
- 注册表四件套(block JSON Schema / outputs kind / kind 连接矩阵 / 操作符清单)直接作为连线校验与表单生成的元数据源;45 种 Kind 的 serialised/internal 类型分离值得沿用。
- 类型寻址(`/steps/<name>/…`)比索引寻址稳定,patch 与 selector 共用 name 键。
