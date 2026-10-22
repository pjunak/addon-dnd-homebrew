// The JSON Schema keywords the Engine's grants vocabulary uses (type,
// properties, required, additionalProperties, items, oneOf, const, $ref),
// checked the way the host's validator does. The editor renders forms from
// the same nodes, so a new grant in the vocabulary needs no editor change.
import { grantsSchema } from "./grants-schema.js";

export interface SchemaNode {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, SchemaNode>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | SchemaNode;
  readonly items?: SchemaNode;
  readonly oneOf?: readonly SchemaNode[];
  readonly const?: unknown;
  readonly $ref?: string;
  readonly $defs?: Readonly<Record<string, SchemaNode>>;
  readonly title?: string;
  readonly $comment?: string;
}

/** A failing location ("features[1].grants.resources[0]") and an English template. */
export interface SchemaProblem {
  readonly text: string;
  readonly params: Readonly<Record<string, string>>;
}

const grantsRef = "#/$defs/grants";

/** The node a reference names, in contracts/engine-grants.schema.json's form. */
export function resolveRef(ref: string): SchemaNode {
  if (ref === grantsRef) return grantsSchema;
  const name = ref.startsWith(`${grantsRef}/$defs/`) ? ref.slice(grantsRef.length + 7) : "";
  const node = grantsSchema.$defs?.[name];
  if (!node) throw new Error(`Unknown schema reference ${ref}`);
  return node;
}
/** Follows references until a node with content. */
export function deref(node: SchemaNode): SchemaNode {
  let current = node;
  for (let depth = 0; current.$ref !== undefined; depth++) {
    if (depth > 20) throw new Error("Schema references loop");
    current = resolveRef(current.$ref);
  }
  return current;
}
/** The definition name behind a reference, used to look up labels. */
export function refName(node: SchemaNode): string | undefined {
  return node.$ref?.split("/").at(-1);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function typesOf(node: SchemaNode): readonly string[] {
  return node.type === undefined ? [] : typeof node.type === "string" ? [node.type] : node.type;
}
function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return isObject(value);
    default:
      return false;
  }
}
const typeMessages: Readonly<Record<string, string>> = {
  string: "{path} must be text.",
  integer: "{path} must be a whole number.",
  number: "{path} must be a number.",
  boolean: "{path} must be on or off.",
  array: "{path} must be a list.",
  object: "{path} must be a group of fields.",
};
function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
const at = (path: string, key: string | number): string =>
  typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key;

/** The first place `value` breaks `node`, or undefined when it is valid. */
export function schemaProblem(
  node: SchemaNode,
  value: unknown,
  path: string,
): SchemaProblem | undefined {
  const schema = deref(node);
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((branch) => !schemaProblem(branch, value, path)).length;
    if (matches !== 1)
      return { text: "{path} matches none of its allowed forms.", params: { path } };
  }
  if (schema.const !== undefined && !same(schema.const, value))
    return {
      text: "{path} must be {value}.",
      params: { path, value: JSON.stringify(schema.const) },
    };
  const types = typesOf(schema);
  if (types.length > 0 && !types.some((type) => matchesType(type, value)))
    return { text: typeMessages[types[0]!] ?? "{path} has the wrong type.", params: { path } };
  if (isObject(value) && (types.includes("object") || schema.properties)) {
    for (const field of schema.required ?? [])
      if (!(field in value)) return { text: "{path} needs {field}.", params: { path, field } };
    for (const [key, entry] of Object.entries(value)) {
      const property = schema.properties?.[key];
      if (property) {
        const failure = schemaProblem(property, entry, at(path, key));
        if (failure) return failure;
      } else if (schema.additionalProperties === false)
        return { text: "{path} does not take {field}.", params: { path, field: key } };
      else if (isObject(schema.additionalProperties)) {
        const failure = schemaProblem(schema.additionalProperties, entry, at(path, key));
        if (failure) return failure;
      }
    }
  }
  if (Array.isArray(value) && schema.items)
    for (const [index, entry] of value.entries()) {
      const failure = schemaProblem(schema.items, entry, at(path, index));
      if (failure) return failure;
    }
  return undefined;
}

/** A starting value for a new entry: required fields filled, optional ones left out. */
export function emptyValue(node: SchemaNode): unknown {
  const schema = deref(node);
  if (schema.const !== undefined) return schema.const;
  if (schema.oneOf?.[0]) return emptyValue(schema.oneOf[0]);
  switch (typesOf(schema)[0] ?? "string") {
    case "object":
      return Object.fromEntries(
        (schema.required ?? []).map((field) => [
          field,
          schema.properties?.[field] ? emptyValue(schema.properties[field]) : "",
        ]),
      );
    case "array":
      return [];
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return "";
  }
}
