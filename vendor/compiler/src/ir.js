import { assertProgramAst } from "./ast-contract.js";
import { CML_VERSION, EXECUTION_ORDER } from "./language.js";

const unwrap = value =>
  value &&
  typeof value === "object" &&
  Object.hasOwn(value, "value")
    ? value.value
    : value;

const plain = object =>
  Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, unwrap(value)])
  );

function normalize(node, index) {
  const params = plain(node.params);
  const base = {
    id: `${node.type}_${String(index + 1).padStart(3, "0")}`,
    type: node.type,
    symbol: node.symbol,
    keyword: node.keyword,
    source: {
      ...(node.source ?? {}),
      ...(node.location ?? {})
    }
  };

  switch (node.type) {
    case "lock":
      return { ...base, target: params.target, mode: params.mode ?? "strict" };
    case "flow":
      return { ...base, target: params.target, mode: params.mode };
    case "voice":
      return {
        ...base,
        text: params.text ?? null,
        max_words: params.words,
        speed: params.speed ?? 1
      };
    case "count":
      return { ...base, value: params.value, unit: params.unit ?? "events" };
    case "pause":
      return { ...base, duration_ms: params.duration };
    case "silence":
      return {
        ...base,
        duration_ms: params.duration,
        true_zero_amplitude: params.zero ?? true
      };
    case "reaction":
      return {
        ...base,
        reaction_type: params.type,
        trigger: params.trigger ?? null,
        delay_ms: params.delay ?? null,
        settle_ms: params.settle ?? null,
        hold: params.hold ?? false
      };
    case "transition":
      return { ...base, to: params.to, mode: params.mode ?? "bridge" };
    case "memory":
      return {
        ...base,
        key: params.key,
        carry: params.carry ?? true,
        scope: params.scope ?? "scene"
      };
    case "loudness_lift":
      return { ...base, target_lufs: params.target, after: params.after };
    case "continuity_break":
      return { ...base, reason: params.reason };
    default:
      return { ...base, ...params };
  }
}

/**
 * Build IR from a public AST after enforcing the complete AST trust boundary.
 */
export function buildIR(ast, options = {}) {
  const authenticatedAst = assertProgramAst(ast, options);
  return buildIRFromValidatedAst(authenticatedAst);
}

/**
 * Internal fast path used only after parser output has passed validation.
 */
export function buildIRFromValidatedAst(ast) {
  return {
    format: "CML-IR",
    version: "1.0.0",
    source_cml_version: CML_VERSION,
    execution_order: [...EXECUTION_ORDER],
    projects: [
      {
        id: "project_001",
        scenes: ast.body.map(block => ({
          id: block.id,
          type: "continuity_scene",
          parameters: plain(block.params),
          entities: { characters: ["character"], worlds: ["world"] },
          instructions: block.body.map(normalize)
        }))
      }
    ]
  };
}
