import { CMLError, ERROR_CODES } from "./errors.js";
import {
  assertParameterTextWithinLimits,
  assertParameterValueWithinLimits,
  assertSourceWithinLimits
} from "./resource-policy.js";

export function tokenize(source, options = {}) {
  const { text: sourceText, limits } = assertSourceWithinLimits(
    source,
    options.limits ?? options.resourceLimits ?? {}
  );
  const tokenSourceText = sourceText.startsWith("\uFEFF")
    ? sourceText.slice(1)
    : sourceText;
  const tokens = [];
  const lines = tokenSourceText.split(/\r\n?|\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const uncommented = stripLineComment(raw);
    const text = trimHorizontalWhitespace(uncommented);

    if (!text) {
      continue;
    }

    if (tokens.length >= limits.maxTokens) {
      throw new CMLError(
        ERROR_CODES.RESOURCE_LIMIT,
        `CML source exceeds maxTokens (${limits.maxTokens}).`,
        {
          location: { line: index + 1, column: 1 },
          details: {
            limit: "maxTokens",
            maximum: limits.maxTokens
          }
        }
      );
    }

    tokens.push({
      type:
        text === "}"
          ? "RBRACE"
          : text.endsWith("{")
            ? "HEADER"
            : "INSTRUCTION",
      value: text,
      line: index + 1,
      column: 1
    });
  }

  return tokens;
}

export function parseParams(text, line, options = {}) {
  return parseParameterText(text, line, options, false);
}

/** Internal fast path for parameter text already authenticated as source. */
export function parseSourceParams(text, line, options = {}) {
  return parseParameterText(text, line, options, true);
}

function parseParameterText(text, line, options, trustedSourceText) {
  const input = String(text);

  if (!trustedSourceText) {
    assertUnicodeScalarText(input, line);

    const lineBreak = input.search(/[\r\n]/u);
    if (lineBreak !== -1) {
      syntax(
        "CML parameter text must remain on one physical line.",
        line,
        lineBreak + 1
      );
    }
  }

  const limits = assertParameterTextWithinLimits(
    input,
    line,
    options.limits ?? options.resourceLimits ?? {}
  );
  const params = Object.create(null);
  let index = 0;

  while (index < input.length) {
    index = skipHorizontalWhitespace(input, index);
    if (index >= input.length) {
      break;
    }

    const parameterColumn = index + 1;
    const keyStart = index;

    if (!isIdentifierStart(input[index])) {
      syntax(
        `Invalid parameter key near '${input.slice(index)}'.`,
        line,
        parameterColumn
      );
    }

    index += 1;
    while (index < input.length && isIdentifierPart(input[index])) {
      index += 1;
    }

    const key = input.slice(keyStart, index);
    if (input[index] !== "=") {
      syntax(`Parameter '${key}' requires '='.`, line, index + 1);
    }
    index += 1;

    if (index >= input.length) {
      syntax(`Parameter '${key}' requires a value.`, line, index + 1);
    }

    let raw;
    let quoted = false;

    if (input[index] === '"' || input[index] === "'") {
      quoted = true;
      const quote = input[index];
      const valueColumn = index + 1;
      index += 1;
      let decoded = "";
      let closed = false;

      while (index < input.length) {
        const character = input[index];

        if (character === quote) {
          index += 1;
          closed = true;
          break;
        }

        if (character === "\\") {
          if (index + 1 >= input.length) {
            syntax(
              `Quoted value for '${key}' ends with an incomplete escape.`,
              line,
              index + 1
            );
          }

          decoded += decodeEscape(input[index + 1]);
          index += 2;
          continue;
        }

        decoded += character;
        index += 1;
      }

      if (!closed) {
        syntax(
          `Quoted value for '${key}' is missing its closing ${quote}.`,
          line,
          valueColumn
        );
      }

      raw = decoded;
    } else {
      const valueStart = index;

      while (
        index < input.length &&
        !isHorizontalWhitespace(input[index])
      ) {
        const character = input[index];

        if (character === "{" || character === "}") {
          syntax(
            `Unquoted value for '${key}' cannot contain '${character}'.`,
            line,
            index + 1
          );
        }

        if (character === "=" || character === '"' || character === "'") {
          syntax(
            `Parameter '${key}' must be separated from the next parameter by whitespace.`,
            line,
            index + 1
          );
        }

        index += 1;
      }

      if (index === valueStart) {
        syntax(`Parameter '${key}' requires a value.`, line, index + 1);
      }

      raw = input.slice(valueStart, index);
    }

    assertParameterValueWithinLimits(raw, line, limits);

    if (Object.hasOwn(params, key)) {
      throw new CMLError(
        ERROR_CODES.DUPLICATE_PARAMETER,
        `Duplicate parameter '${key}'.`,
        { line, column: parameterColumn }
      );
    }

    params[key] = quoted ? raw : coerce(raw, line, parameterColumn);

    if (index < input.length && !isHorizontalWhitespace(input[index])) {
      syntax(
        `Parameter '${key}' must be followed by whitespace.`,
        line,
        index + 1
      );
    }
  }

  return params;
}

function trimHorizontalWhitespace(text) {
  let start = 0;
  let end = text.length;

  while (start < end && isHorizontalWhitespace(text[start])) {
    start += 1;
  }

  while (end > start && isHorizontalWhitespace(text[end - 1])) {
    end -= 1;
  }

  return text.slice(start, end);
}

function assertUnicodeScalarText(text, lineOffset) {
  let line = lineOffset;
  let column = 1;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);

      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        syntax(
          "CML source contains an unpaired UTF-16 high surrogate.",
          line,
          column
        );
      }

      index += 1;
      column += 2;
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      syntax(
        "CML source contains an unpaired UTF-16 low surrogate.",
        line,
        column
      );
    }

    if (text[index] === "\r") {
      if (text[index + 1] === "\n") {
        index += 1;
      }
      line += 1;
      column = 1;
      continue;
    }

    if (text[index] === "\n") {
      line += 1;
      column = 1;
      continue;
    }

    column += 1;
  }
}

function stripLineComment(line) {
  let quote = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (quote !== null) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

function skipHorizontalWhitespace(text, index) {
  while (index < text.length && isHorizontalWhitespace(text[index])) {
    index += 1;
  }
  return index;
}

function isHorizontalWhitespace(character) {
  return character === " " || character === "\t";
}

function isIdentifierStart(character) {
  if (character === undefined) {
    return false;
  }

  const code = character.charCodeAt(0);
  return (
    code === 95 ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isIdentifierPart(character) {
  if (character === undefined) {
    return false;
  }

  const code = character.charCodeAt(0);
  return (
    isIdentifierStart(character) ||
    code === 45 ||
    (code >= 48 && code <= 57)
  );
}

function decodeEscape(character) {
  switch (character) {
    case "n":
      return "\n";
    case "t":
      return "\t";
    case "r":
      return "\r";
    case "\\":
      return "\\";
    case '"':
      return '"';
    case "'":
      return "'";
    default:
      return `\\${character}`;
  }
}

function coerce(raw, line, column) {
  if (/^-?\d+(?:\.\d+)?ms$/iu.test(raw)) {
    return finiteQuantity(raw, Number.parseFloat(raw), "ms", line, column);
  }
  if (/^-?\d+(?:\.\d+)?s$/iu.test(raw)) {
    return finiteQuantity(
      raw,
      Number.parseFloat(raw) * 1000,
      "ms",
      line,
      column
    );
  }
  if (/^-?\d+(?:\.\d+)?LUFS$/iu.test(raw)) {
    return finiteQuantity(
      raw,
      Number.parseFloat(raw),
      "LUFS",
      line,
      column
    );
  }
  if (/^-?\d+$/u.test(raw)) {
    const value = Number(raw);
    assertFiniteScalar(raw, value, line, column);
    assertSafeInteger(raw, value, line, column);
    return normalizeNumericZero(value);
  }
  if (/^-?\d+\.\d+$/u.test(raw)) {
    const value = Number(raw);
    assertFiniteScalar(raw, value, line, column);
    return normalizeNumericZero(value);
  }
  if (/^(true|false)$/iu.test(raw)) {
    return raw.toLowerCase() === "true";
  }
  return raw;
}

function finiteQuantity(raw, value, unit, line, column) {
  assertFiniteScalar(raw, value, line, column);

  if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new CMLError(
      ERROR_CODES.INVALID_VALUE,
      `Numeric quantity '${raw.slice(0, 64)}${raw.length > 64 ? "…" : ""}' exceeds the exact CML integer range.`,
      { line, column }
    );
  }

  return { value: normalizeNumericZero(value), unit, raw };
}

function normalizeNumericZero(value) {
  return value === 0 ? 0 : value;
}

function assertSafeInteger(raw, value, line, column) {
  if (!Number.isSafeInteger(value)) {
    throw new CMLError(
      ERROR_CODES.INVALID_VALUE,
      `Integer value '${raw.slice(0, 64)}${raw.length > 64 ? "…" : ""}' exceeds the exact CML integer range.`,
      { line, column }
    );
  }
}

function assertFiniteScalar(raw, value, line, column) {
  if (!Number.isFinite(value)) {
    throw new CMLError(
      ERROR_CODES.INVALID_VALUE,
      `Numeric value '${raw.slice(0, 64)}${raw.length > 64 ? "…" : ""}' is outside the finite CML range.`,
      { line, column }
    );
  }
}

function syntax(message, line, column) {
  throw new CMLError(ERROR_CODES.SYNTAX, message, { line, column });
}
