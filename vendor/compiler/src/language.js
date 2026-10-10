export const CML_VERSION = "1.0.0";

export const SYMBOLS = freezeDefinitions({
  "◎C": {
    keyword: "CONTINUITY",
    type: "continuity",
    family: "master",
    opensBlock: true
  },
  "□L": { keyword: "LOCK", type: "lock", family: "structure" },
  "~F": { keyword: "FLOW", type: "flow", family: "motion" },
  "|C": { keyword: "COUNT", type: "count", family: "timing" },
  "|P": { keyword: "PAUSE", type: "pause", family: "timing" },
  "·S": { keyword: "SILENCE", type: "silence", family: "audio" },
  "→T": {
    keyword: "TRANSITION",
    type: "transition",
    family: "transition"
  },
  "⌒R": { keyword: "REACTION", type: "reaction", family: "reaction" },
  "↑L": {
    keyword: "LIFT",
    type: "loudness_lift",
    family: "audio"
  },
  "♪V": { keyword: "VOICE", type: "voice", family: "audio" },
  "◐M": { keyword: "MEMORY", type: "memory", family: "memory" },
  "×C": {
    keyword: "BREAK",
    type: "continuity_break",
    family: "disruption"
  }
});

export const ALIASES = Object.freeze(
  Object.fromEntries(
    Object.entries(SYMBOLS).map(([glyph, definition]) => [
      definition.keyword,
      glyph
    ])
  )
);

export const EXECUTION_ORDER = Object.freeze([
  "lock",
  "flow",
  "voice",
  "count",
  "pause",
  "silence",
  "reaction",
  "transition",
  "loudness_lift",
  "validate"
]);

export function resolveSymbol(value) {
  const key = String(value);

  if (Object.hasOwn(SYMBOLS, key)) {
    return key;
  }

  const alias = key.toUpperCase();
  return Object.hasOwn(ALIASES, alias) ? ALIASES[alias] : null;
}

function freezeDefinitions(definitions) {
  for (const definition of Object.values(definitions)) {
    Object.freeze(definition);
  }
  return Object.freeze(definitions);
}
