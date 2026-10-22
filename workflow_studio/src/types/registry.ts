/**
 * Registry types mirroring GET /api/wf/registry (equivalent of the cloud
 * blocks/describe response; see 04-node-system-and-graph-schema.md §2).
 */

export interface JsonSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  examples?: unknown[];
  items?: {
    type?: string | string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * JSON Schema of a block manifest. Besides standard JSON Schema keys, pydantic
 * flattens manifest metadata into the schema: `name` (human display name),
 * `short_description`, `block_type`, and `ui_manifest` ({section, icon,
 * blockPriority}).
 */
export interface BlockJsonSchema {
  title?: string;
  description?: string;
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  name?: string;
  short_description?: string;
  long_description?: string;
  block_type?: string;
  ui_manifest?: {
    section?: string;
    icon?: string;
    blockPriority?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OutputKindRef {
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface OutputManifestEntry {
  name: string;
  kind: OutputKindRef[];
}

export interface BlockDescriptor {
  manifest_type_identifier: string;
  block_schema: BlockJsonSchema;
  outputs_manifest: OutputManifestEntry[];
  execution_engine_compatibility?: unknown;
  restrictions?: unknown;
  [key: string]: unknown;
}

/** One legal consumer port for a kind: the connection validation matrix row. */
export interface KindConnection {
  manifest_type_identifier: string;
  property_name: string;
  compatible_element?: string;
  is_list_element?: boolean;
  is_dict_element?: boolean;
  property_description?: string;
  [key: string]: unknown;
}

export interface KindDefinition {
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface BlockRegistry {
  blocks: BlockDescriptor[];
  declared_kinds: KindDefinition[];
  kinds_connections: Record<string, KindConnection[]>;
  primitives_connections?: unknown;
  universal_query_language_description?: unknown;
  dynamic_block_definition_schema?: unknown;
}
