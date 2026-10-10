export const ERROR_CODES = Object.freeze({
  UNKNOWN_SYMBOL: "CML-E101",
  MISSING_PARAMETER: "CML-E102",
  INVALID_VALUE: "CML-E103",
  LIFT_ORDER: "CML-E104",
  REACTION_INCOMPLETE: "CML-E105",
  VOICE_WORD_LIMIT: "CML-E106",
  SILENCE_TOO_SHORT: "CML-E107",
  CHARACTER_LOCK_MISSING: "CML-E108",
  WORLD_LOCK_MISSING: "CML-E109",
  SYNTAX: "CML-E110",
  DUPLICATE_ID: "CML-E111",
  REFERENCE: "CML-E112",
  SCOPE: "CML-E113",
  UNKNOWN_PARAMETER: "CML-E114",
  DUPLICATE_PARAMETER: "CML-E115",
  RESOURCE_LIMIT: "CML-E116",
  VALIDATION_FAILED: "CML-E201",
  IO: "CML-E301",
  CLI_USAGE: "CML-E302",
  UNSUPPORTED_VERSION: "CML-E303",
  PROJECT_CONFIG: "CML-E304",
  INCLUDE_CYCLE: "CML-E305",
  PROJECT_REFERENCE: "CML-E306",
  INTERNAL: "CML-E500"
});

const DEFAULT_SEVERITY = "error";

export class CMLError extends Error {
  constructor(code, message, options = null) {
    const normalized = normalizeOptions(options);
    super(message, normalized.cause ? { cause: normalized.cause } : undefined);

    this.name = "CMLError";
    this.code = code;
    this.severity = normalized.severity ?? DEFAULT_SEVERITY;
    this.location = normalizeLocation(normalized.location);
    this.source = normalizeSource(normalized.source);
    this.suggestion = normalized.suggestion ?? null;
    this.details = normalized.details ?? null;
  }

  withSource(source) {
    if (this.source) {
      return this;
    }

    this.source = normalizeSource(source);
    return this;
  }

  toJSON() {
    return compactObject({
      name: this.name,
      code: this.code,
      severity: this.severity,
      message: this.message,
      location: this.location,
      source: this.source,
      suggestion: this.suggestion,
      details: this.details
    });
  }
}

export function normalizeError(error, defaults = {}) {
  if (error instanceof CMLError) {
    if (!error.source && defaults.source) {
      error.withSource(defaults.source);
    }
    return error;
  }

  return new CMLError(
    defaults.code ?? ERROR_CODES.INTERNAL,
    error instanceof Error ? error.message : String(error),
    {
      source: defaults.source ?? null,
      location: defaults.location ?? null,
      suggestion: defaults.suggestion ?? null,
      details: defaults.details ?? null,
      cause: error instanceof Error ? error : null
    }
  );
}

export function formatDiagnostic(error, options = {}) {
  const normalized = normalizeError(error);
  const useColor = options.color === true;
  const code = useColor ? `\u001b[31m${normalized.code}\u001b[0m` : normalized.code;
  const sourceLabel = formatSourceLocation(normalized.source, normalized.location);
  const heading = `${code}: ${normalized.message}`;
  const lines = [sourceLabel ? `${sourceLabel} - ${heading}` : heading];

  if (normalized.suggestion) {
    lines.push(`Suggestion: ${normalized.suggestion}`);
  }

  return lines.join("\n");
}

export function errorEnvelope(error, context = {}) {
  const normalized = normalizeError(error);
  return {
    ok: false,
    error: normalized.toJSON(),
    context: compactObject(context)
  };
}

function normalizeOptions(options) {
  if (options === null || options === undefined) {
    return {};
  }

  // Backward compatibility: CMLError(code, message, { line, column }).
  if (isLocation(options)) {
    return { location: options };
  }

  if (typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("CMLError options must be an object or location.");
  }

  return options;
}

function normalizeLocation(location) {
  if (!location) {
    return null;
  }

  return compactObject({
    line: Number.isInteger(location.line) ? location.line : null,
    column: Number.isInteger(location.column) ? location.column : null,
    endLine: Number.isInteger(location.endLine) ? location.endLine : null,
    endColumn: Number.isInteger(location.endColumn) ? location.endColumn : null
  });
}

function normalizeSource(source) {
  if (!source) {
    return null;
  }

  if (typeof source === "string") {
    return { path: source };
  }

  if (typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError("CMLError source must be a string or object.");
  }

  return compactObject({
    path: source.path ?? null,
    displayName: source.displayName ?? null
  });
}

function isLocation(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.hasOwn(value, "line") || Object.hasOwn(value, "column")) &&
    !Object.hasOwn(value, "location")
  );
}

function formatSourceLocation(source, location) {
  const path = source?.path ?? source?.displayName ?? null;
  const line = location?.line ?? null;
  const column = location?.column ?? null;

  if (!path && line === null) {
    return "";
  }

  if (!path) {
    return column === null ? `line ${line}` : `line ${line}:${column}`;
  }

  if (line === null) {
    return path;
  }

  return column === null ? `${path}:${line}` : `${path}:${line}:${column}`;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined)
  );
}
