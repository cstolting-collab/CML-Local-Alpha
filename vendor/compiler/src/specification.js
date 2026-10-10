import { CML_VERSION, EXECUTION_ORDER, SYMBOLS } from "./language.js";

export const CML_SPECIFICATION_VERSION = "1.0.0";
export const CML_IR_VERSION = "1.0.0";
export const SUPPORTED_CML_VERSIONS = Object.freeze([CML_VERSION]);

const PARAMETER_CONTRACTS = Object.freeze({
  continuity: Object.freeze({ required: [], optional: [] }),
  lock: Object.freeze({ required: ["target"], optional: ["mode"] }),
  flow: Object.freeze({ required: ["target", "mode"], optional: [] }),
  count: Object.freeze({ required: ["value"], optional: ["unit"] }),
  pause: Object.freeze({ required: ["duration"], optional: [] }),
  silence: Object.freeze({ required: ["duration"], optional: ["zero"] }),
  transition: Object.freeze({ required: ["to"], optional: ["mode"] }),
  reaction: Object.freeze({ required: ["type"], optional: ["trigger", "delay", "settle", "hold"] }),
  loudness_lift: Object.freeze({ required: ["target", "after"], optional: [] }),
  voice: Object.freeze({ required: ["words"], optional: ["text", "speed"] }),
  memory: Object.freeze({ required: ["key"], optional: ["carry", "scope"] }),
  continuity_break: Object.freeze({ required: ["reason"], optional: [] })
});

export const CML_LANGUAGE_MANIFEST = deepFreeze({
  format: "CML-Language-Manifest",
  specificationVersion: CML_SPECIFICATION_VERSION,
  cmlVersion: CML_VERSION,
  irVersion: CML_IR_VERSION,
  sourceEncoding: "UTF-8",
  lineEndings: "LF",
  comments: "#",
  blockModel: "one-or-more continuity blocks",
  executionOrder: [...EXECUTION_ORDER],
  symbols: Object.entries(SYMBOLS).map(([glyph, definition]) => ({
    glyph,
    keyword: definition.keyword,
    type: definition.type,
    family: definition.family,
    opensBlock: definition.opensBlock === true,
    parameters: PARAMETER_CONTRACTS[definition.type] ?? { required: [], optional: [] }
  }))
});

export const CML_COMPATIBILITY_POLICY = deepFreeze({
  format: "CML-Compatibility-Policy",
  version: "1.0.0",
  supportedSourceVersions: [...SUPPORTED_CML_VERSIONS],
  currentSourceVersion: CML_VERSION,
  currentIrVersion: CML_IR_VERSION,
  guarantees: {
    major: "May remove or redefine public language and API contracts.",
    minor: "May add backward-compatible syntax, semantics, exports, and diagnostics.",
    patch: "May fix implementation defects without changing documented contracts."
  },
  deprecation: {
    minimumMinorReleases: 1,
    requiredNotice: true,
    removalRequiresMajorVersion: true
  }
});

export function getLanguageManifest() {
  return structuredClone(CML_LANGUAGE_MANIFEST);
}

export function getCompatibilityPolicy() {
  return structuredClone(CML_COMPATIBILITY_POLICY);
}

export function supportsCMLVersion(version) {
  return SUPPORTED_CML_VERSIONS.includes(String(version));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}
