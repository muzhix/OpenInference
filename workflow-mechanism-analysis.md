# OpenInference Workflow 机制深度分析

> 分析日期:2026-10-21
> 范围:`workflows/roboflow_workflows/`(roboflow-workflows 包)及 inference 侧接线
> 主题:workflow 协议、block 清单、编排机制、数据传输与校验逻辑

## 一、总体架构

Workflow 子系统是一个**独立的 PyPI 包** `roboflow-workflows`(位于 `workflows/roboflow_workflows/`,与 inference 主包解耦——isolation probe 测试 `workflows/scripts/workflows_isolation_probe.py` 会验证它能在屏蔽所有 `inference.*` import 的环境下独立运行)。核心分层:

| 目录 | 职责 |
|---|---|
| `prototypes/block.py` | `WorkflowBlock` / `WorkflowBlockManifest` 基类协议 |
| `execution_engine/core.py` | 引擎门面。按 workflow JSON 的 `version` 字段分发到具体引擎(`REGISTERED_ENGINES` 版本注册表,当前仅 `EXECUTION_ENGINE_V1_VERSION`),`ExecutionEngine` 是包装 `ExecutionEngineV1` 的委托外壳 |
| `execution_engine/v1/` | 引擎本体:`compiler/`(编译期)+ `executor/`(运行期)+ `dynamic_blocks/`(动态块)+ `inner_workflow/`(嵌套 workflow 内联) |
| `core_steps/` + `enterprise_blocks/` | block 库(250 核心 + 13 企业版) |
| `execution_engine/introspection/` | block 发现、manifest 解析、连接推导(供前端编辑器) |
| `execution_engine/entities/` | 类型系统(types.py)、数据实体(base.py)、引擎接口(engine.py) |

**双数据表示模式**:每个 block 家族有 `vN.py` 与可选的 `vN_tensor.py` 孪生实现(同名类),由环境变量 `ENABLE_TENSOR_DATA_REPRESENTATION` 在 import 时二选一——tensor-native 实验通道(与 CI 同名开关一致)。

**inference 侧接线**:`inference/core/workflows/__init__.py` 等旧路径只是经 `inference/_workflows_compat.py` 重绑定到本包的 compat shim,无独立代码;`inference/core/env.py` 与 `inference_server/.../workflows/host.py` 只负责把 enterprise loader 以插件形式注入 `WORKFLOWS_PLUGINS` 环境变量。

## 二、Workflow 协议(JSON 定义)

顶层 schema 在 `execution_engine/v1/compiler/syntactic_parser.py::build_workflow_definition_entity` 中**动态构造**:用 pydantic `create_model` 把所有已加载 block 的 manifest 拼成 discriminated union:

```python
WorkflowSpecificationV1 = {
    version: str,                          # 引擎版本,决定用哪个引擎实现
    inputs:  List[InputType],              # WorkflowImage | WorkflowVideoMetadata | WorkflowParameter
    steps:   List[Union[所有 BlockManifest, discriminator="type"]],
    outputs: List[JsonField],              # {type:"JsonField", name, selector, coordinates_system}
    dynamic_blocks_definitions: (可选)      # 运行期自定义 Python block
}
```

- `InputType` 三种输入声明见 `execution_engine/entities/base.py`:`WorkflowImage` / `WorkflowVideoMetadata` / `WorkflowParameter`,各带 `is_batch_oriented()` 与 `dimensionality`。
- `JsonField`(`entities/base.py:56`):输出仅声明 `name + selector`,可选 `coordinates_system`(子图坐标还原)。

### Selector 引用语法(协议核心)

定义在 `execution_engine/entities/types.py`,均为带正则约束的 `Annotated[str]`:

| 语法 | 含义 | batch 语义 |
|---|---|---|
| `$inputs.image` | 引用 workflow 输入(图像/参数统一此前缀,**无 `$parameters`**) | 图像是 batch、参数是 scalar |
| `$steps.foo.predictions` | 引用 step `foo` 的 `predictions` 输出属性 | 指向 batch |
| `$steps.foo` | 两段式,**控制流引用**(仅 SwitchCase/ContinueIf 类声明) | — |
| `$steps.foo.*` | 通配选取全部输出 | — |

selector 字段的类型约束靠工厂函数 `StepOutputSelector(kind)`、`WorkflowImageSelector`、`WorkflowParameterSelector(kind)` 在 manifest 字段注解上携带 `Kind` 列表与 `json_schema_extra` 元数据(`REFERENCE_KEY`、`SELECTED_ELEMENT_KEY`、`SELECTOR_POINTS_TO_BATCH_KEY`),编译器据此知道"这个字段可填引用、接受什么类型"。

每个 step 的 manifest 是 Pydantic 模型:`type: Literal["roboflow_core/xxx@v1", ...]`(首个为主标识,其余为历史别名),`json_schema_extra` 携带 UI 元数据(name/version/short_description/long_description/license/block_type/docs)。

## 三、支持的 Blocks(250 核心 + 13 企业版)

### 注册机制

- **集中式 loader**:`core_steps/loader.py` 硬编码类列表;`enterprise_blocks/loader.py` 13 个(声明 `BLOCKS_SOURCE = "workflows_core"` 复用核心初始化参数)。
- **插件机制**:`WORKFLOWS_PLUGINS` 环境变量(逗号分隔模块名),插件模块须暴露 `load_blocks() -> List[Type[WorkflowBlock]]`;`execution_engine/introspection/blocks_loader.py` 统一发现并生成 `BlockSpecification`。
- loader 同时导出 `REGISTERED_INITIALIZERS`(api_key、cache、step_execution_mode 等)与 `KINDS_SERIALIZERS/DESERIALIZERS`;`WORKFLOW_DISABLED_BLOCK_TYPES/PATTERNS` 可禁用特定块。
- 无模块级 `block = XxxBlock()` 实例模式;block 通过中间基类继承(如 `VisualizationBlock` → `ColorableVisualizationBlock`、`TrackerBlockBase`、`OpenRouterWorkflowBlockBase`)。

### core_steps 分组(loader 注册口径)

| 分类 | 数量 | 代表 block(scheme 前缀 `roboflow_core/`) |
|---|---|---|
| models | 105(+1) | 见下节明细 |
| visualizations | 30 | BoundingBox、Label/rich Label、Mask、Heatmap、Halo、Trace、AnomalyHeatmap(新) |
| transformations | 26 | DetectionsFilter、DynamicCrop、ImageSlicer(小目标切片)、ByteTracker v1-3(旧位置)、PerspectiveCorrection、GeoTagDetection |
| classical_cv | 24 | SIFT、模板匹配、运动检测、形态学、相机对焦、主色、尺寸测量 |
| sinks | 16 | Webhook、S3、Email、Slack、Twilio 短信、Dataset 上传、VisionEvents、ONVIF PTZ |
| analytics | 11 | LineCounter v1-2、TimeInZone v1-3、Velocity、PathDeviation(Fréchet) |
| formatters | 11 | Expression、StringTemplate、VLMAsDetector/Classifier v1-2、JSONParser、CurrentTime |
| fusion | 10 | DetectionsConsensus(多模型共识)、ImageStack、FrameDelay、DetectionsStitch、DimensionCollapse |
| trackers | 4 | ByteTrack、SORT、BoTSORT、OCSORT(新位置) |
| flow_control | 5 | SwitchCase、ContinueIf、RateLimiter、DeltaFilter、InnerWorkflow |
| cache | 2 | CacheGet、CacheSet |
| sampling | 2 | IdentifyChanges、IdentifyOutliers(embedding 历史比对) |
| integrations | 2 | RoboflowVisualSearch、VisualSearchClassifier |
| math | 1 | CosineSimilarity |
| secrets_providers | 1 | EnvironmentSecretsStore |

### 模型类明细(105+1)

- **Roboflow 自有(21)**:ObjectDetection / Classification / MultiLabelClassification / InstanceSegmentation / SemanticSegmentation / KeypointDetection 各 v1-3(或 v1-4),加 AnomalyDetection、Embedding、ActionRecognition(视频)。
- **第三方/基础模型(82+1)**:
  - SAM 全家桶:SegmentAnything2、SAM2-Video、SAM3 v1-3、SAM3-Interactive(点/框提示)、SAM3-Video、SAM3-3D-Objects(受 `SAM3_3D_OBJECTS_ENABLED` 门控)、Cosmos3Edge;
  - VLM/LLM 通道:OpenAI v1-7、AnthropicClaude v1-5、GoogleGemini v1-6、Gemma v1-4、Qwen 系(QwenVlm v1-4、Qwen25VL、Qwen3VL、Qwen35VL v1-2)、ZaiVlm、MetaVlm v1-3、LMM(通用 VLM)、LlamaVision、Moondream2、SmolVLM2、CogVLM、MistralVlm、SpaceXAI v1-3、Kimi/OpenRouter 通道(OpenRouterBlock v1-3 等,基类 `OpenRouterWorkflowBlockBase`)、OpenAICompatible;
  - OCR:OCRModel、EasyOCR、PPOCR、GoogleVisionOCR、GLMOCR;
  - 其它:CLIP、ClipComparison v1-2、PerceptionEncoder、DepthEstimation、Gaze、Florence2 v1-2、YoloWorld(开放词汇)、StabilityAI 生成/修补/外扩;
  - third_party:BarcodeDetector、QRCodeDetector。

### 企业版(13,均在 sinks/)

工业协议与数据出口:ModbusTCP、PLC(Ethernet/IP)、PLCReader/PLCWriter、OPC UA Writer、MQTT Reader/Writer v1-2、Kafka Consumer/Producer、MicrosoftSQLServerSink、PostgreSQLSink、EventWriterSink。由 server 在 `LOAD_ENTERPRISE_BLOCKS=true` 时经 `WORKFLOWS_PLUGINS` 插件机制加载。

### 关于控制流的说明

不存在名为 `IfElse`/`ForEach`/`BinaryOperator` 的 block——`BinaryOperator` 只是 `core_steps/common/operators.py` 的枚举与查询语言算子。分支选择由 SwitchCase + 控制流机制承担;"逐元素循环"由 batch 执行模型天然实现(见第四节);算术逻辑用 Expression block 的查询语言完成。

## 四、Blocks 编排机制

### 编译期(`v1/compiler/`)

调用链:`compile_workflow`(compiler/core.py)→ `parse_workflow_definition`(syntactic_parser.py)→ `validate_workflow_specification`(validator.py)→ `prepare_execution_graph`(graph_constructor.py)→ `initialise_steps`(steps_initialiser.py)。

1. **预处理**:inner workflow 引用解析并内联(`inner_workflow/reference_resolution.py` / `inline.py`);根与嵌套定义中的 dynamic blocks 收集提升到根(`dynamic_blocks_collection.py`)。
2. **语法层**(`syntactic_parser.py`):动态 union 模型 `model_validate` 整个 JSON,pydantic 报错转 `WorkflowSyntaxError`(带逐 block/property 的 `WorkflowBlockError` 定位);结果按可用块集合缓存(`WORKFLOW_DEFINITION_ENTITIES_CACHE`)。
3. **规范层**(`validator.py`):inputs/steps/outputs 名称唯一(`DuplicatedNameError`)。
4. **图构建**(`graph_constructor.py::construct_graph`):**无显式 `next` 连线——连接完全从 selector 隐式推导**。`introspection/selectors_parser.py::get_step_selectors` 从 manifest 实际值提取 `ParsedSelector`(能深入 list 元素/dict 值),`get_step_selector_from_its_output` 定位上游节点建边,同一对 step 的多条 selector 合并到一条边;`$outputs.*` 连到输出节点。**DAG 强制**(`nx.is_directed_acyclic_graph` 检查,有环抛 `ExecutionGraphStructureError`)。
5. **数据流标注**(`denote_data_flow_in_workflow`):按拓扑序(`graph_traversal.py`)为每个 step 生成 `StaticStepInputDefinition`/`DynamicStepInputDefinition`(或复合 `ListOfStepInputDefinitions`/`DictOfStepInputDefinitions`,定义在 compiler/entities.py),推导维度与 lineage(见第五节)。
6. **step 初始化**(`steps_initialiser.py`):调用 block 的 `init(...)`(模型下载、连接建立等),受 `dependencies_pre_init` 控制。
7. **编译缓存**(`cache.py::BasicWorkflowsCache`):key = 规范化 workflow JSON + 引擎版本;含 dynamic blocks / 未解析引用(resolver 依赖)的定义绕过缓存。`compile_workflow_structure()` 提供仅供 introspection 的结构化编译(不初始化、不 eval 代码)。

### 运行期(`v1/executor/`)

- **分层并行**:`flow_coordinator.py::establish_execution_order` 把图压缩为 step-only 流图后按最大距离分层,每层一个并行 wave;层内 `run_steps_in_parallel`(utils.py,`wrap_with_context_snapshot` 复制 contextvars,`max_concurrent_steps` 线程池)。单步异常包装为 `StepExecutionError` + `BlockTraceback`(`safe_execute_step`)。
- **step 执行形态**:
  - SIMD(batch 型):`run_simd_step_in_batch_mode`(整批 `Batch` 一次传给 `step.run(**parameters)`)或 `run_simd_step_in_non_batch_mode`(`iterate_over_simd_step_input` 逐元素);
  - 非 SIMD:`run_non_simd_step`(纯 scalar 参数)。
  这实现了"数据级并行"而无需 ForEach block。
- **控制流**:唯一分支语义。SwitchCase 声明 `StepSelector` 类型字段建立编译期控制流边(`establish_control_flow_edge`),运行期 `FlowControl` 实体(v1/entities.py,context 指向被选 step)驱动 `BranchingManager` 生成分支 mask(batch 型为 index 集合,scalar 型为 bool);ContinueIf 对 batch 内元素裁剪分支。控制流 lineage 必须是数据输入 lineage 的前缀(编译期校验)。
- **流式/视频**:`run(..., defer_stream_pipeline_flush=True)` 推迟 flush;有状态 block 可实现 `flush_stream_pipeline_outputs()` 返回延迟结果 `[(indices, outputs)]`,flush 后仅执行下游(`_downstream_step_selectors`);引擎层入口 `ExecutionEngineV1.flush_stream_pipeline`。
- **嵌套**:`InnerWorkflowBlock` 运行参数映射自父 workflow 的子 workflow——编译期内联展开,非运行期递归解释。
- **异步输出**:block 可返回 `concurrent.futures.Future`,executor 递归解析(含 Batch 内部,utils.py::resolve_futures)。

## 五、数据传输与校验逻辑

### 三层编译期校验

1. **语法层**:pydantic discriminated union 校验(未知 type、字段类型错、缺必填)。
2. **未知引用**:边端点不存在 → `InvalidReferenceTargetError`(定位到引用 block/property);引用的输出属性不存在 → `ExecutionGraphStructureError`;workflow output 引用不存在属性 → `InvalidReferenceTargetError`。
3. **类型(kind)匹配**(`compiler/reference_type_checker.py::validate_reference_kinds`):manifest 字段声明的期望 kind 并集 ∩ 上游 `get_actual_outputs()` 的实际 kind,交集为空且双方无 `*` 通配 → `ReferenceTypeError`。类型系统是 **40 余个具名 `Kind`**(entities/types.py:image、object_detection_prediction、timestamp、secret、wildcard `*` 等)的**集合语义**,不是结构化类型系统。

### Batch 维度对齐(lineage 机制)

每个 batch 输入节点获得 `data_lineage = ["<workflow_input>", uuid, ...]`(长度 = dimensionality;常量在 execution_engine/constants.py)。lineage 是维度身份:**同前缀 = 同维度可对齐**。编译期规则(`graph_constructor.py::denote_data_flow_for_step`):

- 同一 step 各输入若 lineage 同长则必须完全一致;允许相差一层,但**长者必须以短者为前缀**(如视频帧 × 每帧多图嵌套);
- 同一复合属性(list/dict)内禁止多条 lineage(`get_lineage_from_compound_input`);
- manifest 可声明 `input_dimensionality_offsets`(输入维度差 ≤1)与 `dimensionality_reference_property` 支持维度升降;输出 offset 限 {-1, 0, +1};
- 声明 batch 但实喂 scalar 的参数走 **auto-batch casting**(ABC,`AutoBatchCastingConfig`,`find_longest_lineage_support` 取最长 lineage 作支撑广播);
- step 执行维度 = min(非零输入维度),reducer 再减 1;受控制流门控而无 batch 输入时 = 控制流分支维度。

运行期由 `DynamicBatchesManager`(executor/execution_data_manager/dynamic_batches_manager.py)维护 `lineage_id → List[DynamicBatchIndex]`;不同维度输入的融合在 `step_input_assembler.py::get_masks_intersection_for_dimensions` 用**分支 mask 按维取交集 + 跨层前缀链过滤**实现;根索引由 runtime 参数长度生成(`assembly_root_batch_indices`),step 产出新维度时 `register_element_indices_for_lineage` 注册(`flatten_nested_output` 展平 +1 维输出)。

### 运行期数据总线(`execution_data_manager/`)

`ExecutionDataManager`(manager.py)聚合三组件:

- **ExecutionCache**(execution_cache.py):per-step 的 `dict[属性][DynamicBatchIndex] → value` 缓存(`BatchStepCache`/`NonBatchStepCache`);注册输出时校验键集合与 manifest 声明一致,不符抛 `InvalidBlockBehaviourError`(防止 block 行为偏离声明)。
- **DynamicBatchesManager**:见上,lineage 索引登记。
- **BranchingManager**(branching_manager.py):条件分支 mask 管理。

**输入装配**(step_input_assembler.py::construct_simd_step_input → prepare_parameters → get_non_compound_parameter_value):

- `$inputs.*` 从 runtime_parameters 取(多维输入展平),`$steps.x.y` 从 ExecutionCache 取;
- compound(list/dict)输入各元素索引必须一致(`ensure_compound_input_indices_match`);
- 被分支裁剪的空元素剔除(`get_empty_batch_elements_indices`,受 `accepts_empty_values` 门控);
- 维度高于执行维度的输入降维包装为嵌套 `Batch`(`reduce_batch_dimensionality`);scalar 广播成 batch(`apply_auto_batch_casting`)。

**图像统一表示**:`WorkflowImageData`(entities/base.py)惰性多表示容器(reference/base64/numpy HWC BGR/tensor CHW RGB,按需转换缓存);原地修改必须显式 `declare_numpy_image_mutated()`/`declare_tensor_image_mutated()` 声明;`to_inference_format()` 负责对外表示。

**序列化/反序列化边界**:

- 入口(`runtime_input_assembler.py::assemble_runtime_parameters`):按 kind 调注册的 deserializer(`KINDS_DESERIALIZERS`,注册于 core_steps/loader.py),如 image kind → `WorkflowImageData`;强制所有 batch 输入长度一致或为 1(`determine_input_batch_size`);
- 运行时二次校验:`runtime_input_validator.py::validate_runtime_input` 对带 `InputSubstitution` 的模型类参数复验;
- 出口(`output_constructor.py::construct_workflow_output`):按 kind 逐个尝试 serializer(`KINDS_SERIALIZERS`)重建嵌套输出数组(`create_array`/`place_data_in_array` 按 DynamicBatchIndex);区分输入派生 lineage 与 step 生成 lineage;`coordinates_system=PARENT` 时 `convert_sv_detections_coordinates` 子图坐标还原(如切片检测映射回原图)。

### Dynamic Blocks(运行期自定义块)

`v1/dynamic_blocks/`。workflow JSON 携带 `dynamic_blocks_definitions = {manifest 描述 + Python 代码}`,**编译期**动态生成新 step 类型:

- 定义模式(dynamic_blocks/entities.py):`ManifestDescription` 声明 `block_type`、inputs(`DynamicInputDefinition`:selector_types/selector_data_kind/value_types/dimensionality_offset)、outputs(kind 列表)、output_dimensionality_offset、batch 语义、`tensor_compatibility`、`ui_manifest`;`PythonCode` 携带 run/init 函数代码与 imports。
- 编译(block_assembler.py::compile_dynamic_blocks → create_dynamic_block_specification):pydantic `create_model` 动态生成 manifest 类(打 `__workflow_dynamic_manifest__` 标记,绕过 manifest LRU 缓存)+ `type()` 动态生成 `WorkflowBlock` 子类(block_scaffolding.assembly_custom_python_block)。
- 代码执行:本地模式 `create_dynamic_module` 用白名单 imports(sv/np/cv2/shapely/`Batch`/`WorkflowImageData`/`BlockResult` 等)`exec`;Modal 模式编译期 `validate_code_in_modal` + 运行期 `ModalExecutor.execute_remote`(按 workspace 缓存)。开关:`ensure_dynamic_blocks_allowed`(`ALLOW_CUSTOM_PYTHON_EXECUTION_IN_WORKFLOWS` 或 `WORKFLOWS_CUSTOM_PYTHON_EXECUTION_MODE=modal`)。
- `representation_boundary.py`:legacy 块在 tensor 服务下的输入/输出边界转换。

### 面向前端编辑器的内省

- `introspection/blocks_loader.py::describe_available_blocks(dynamic_blocks)`:每 block 的 `block_schema`(manifest 的 `model_json_schema()`,selector 字段的 json_schema_extra 让编辑器知道哪些字段可填引用及接受的 kind)、`outputs_manifest`、manifest type identifiers、dimensionality、restrictions、`execution_engine_compatibility`;按插件环境缓存。
- `introspection/schema_parser.py`:把 pydantic manifest 的 JSON schema **反向解析**为编译器元数据(`BlockManifestMetadata`:primitive types + selector 声明),经 manifest_cache LRU 缓存(动态 manifest 绕过)。
- `introspection/connections_discovery.py::discover_blocks_connections`:基于 kind 兼容性推导 block 间可连接关系,供编辑器连线提示。
- `v1/compiler/syntactic_parser.py::get_workflow_schema()`:整个 workflow 定义的 JSON schema。
- `introspection/workload.py::describe_workflow_workload`:编译期的 workload 事实描述(图连通性、维度、模型清单),与流式执行无关。

## 六、关键调用链速查

```
编译:  compile_workflow (v1/compiler/core.py)
      → parse_workflow_definition (syntactic_parser.py)      # 语法层
      → validate_workflow_specification (validator.py)        # 规范层
      → prepare_execution_graph (graph_constructor.py)        # 图构建 + DAG 检查 + 数据流标注
      → initialise_steps (steps_initialiser.py)

执行:  ExecutionEngineV1.run (v1/core.py)
      → assemble_runtime_parameters (executor/runtime_input_assembler.py)  # 入口反序列化
      → run_workflow (executor/core.py)                                    # wave 循环
      → ParallelStepExecutionCoordinator (flow_coordinator.py)
      → ExecutionDataManager.get_simd_step_input / iterate_over_simd_step_input
                                                                          # 输入装配
      → step.run()                                                          # block 执行
      → register_simd_step_output (manager.py → ExecutionCache + DynamicBatchesManager)
      → construct_workflow_output (output_constructor.py)                   # 出口序列化
```

## 七、一句话总结

这是一套 **selector 驱动的声明式 DAG 数据流引擎**:JSON 协议用 `$inputs/$steps` 引用取代显式连线,类型安全靠 40 余个具名 Kind 的集合求交,batch 并行靠 lineage 维度代数(区别于普通 DAG 框架的核心),编排靠拓扑分层并行 wave + SwitchCase 控制流,数据传输全程 Pydantic 三层校验 + 运行期按 kind 的序列化/反序列化边界。前端编辑器所需的全部元数据(block schema、连接可能性、文档)都从同一份 Pydantic manifest 内省生成,保证"协议即类型系统即文档"的一致性。
