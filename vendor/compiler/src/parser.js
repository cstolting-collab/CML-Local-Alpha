import { tokenize, parseSourceParams } from "./tokenizer.js";
import { resolveSymbol, SYMBOLS, CML_VERSION } from "./language.js";
import { CMLError, ERROR_CODES } from "./errors.js";
import { resolveResourceLimits } from "./resource-policy.js";

export function parse(source, options = {}) {
  return parseDocument(source, options, false);
}

/** Internal parser path for include-only project source files. */
export function parseProjectSource(source, options = {}) {
  return parseDocument(source, options, true);
}

function parseDocument(source, options, allowEmptyDocument) {
  const sourceText = String(source);
  const limits = resolveResourceLimits(
    options.limits ?? options.resourceLimits ?? {}
  );
  const parserOptions = { ...options, limits };
  const tokens = tokenize(sourceText, parserOptions);

  if (tokens.length === 0 && !allowEmptyDocument) {
    throw new CMLError(
      ERROR_CODES.SYNTAX,
      "CML document requires at least one CONTINUITY block.",
      { line: 1, column: 1 }
    );
  }

  const ast = {
    kind: "Program",
    cmlVersion: CML_VERSION,
    body: [],
    sourceLength: sourceText.length
  };
  let current = null;

  for (const token of tokens) {
    if (token.type === "RBRACE") {
      if (!current) {
        throw new CMLError(
          ERROR_CODES.SYNTAX,
          "Unexpected closing brace.",
          token
        );
      }

      ast.body.push(current);
      current = null;
      continue;
    }

    if (token.type === "HEADER") {
      if (current) {
        throw new CMLError(
          ERROR_CODES.SYNTAX,
          "Nested continuity blocks are not allowed.",
          token
        );
      }

      const header = parseHeader(token);
      const symbol = resolveSymbol(header.symbolText);
      if (!symbol) {
        throw new CMLError(
          ERROR_CODES.UNKNOWN_SYMBOL,
          `Unknown symbol '${header.symbolText}'.`,
          token
        );
      }
      if (!SYMBOLS[symbol].opensBlock) {
        throw new CMLError(
          ERROR_CODES.SYNTAX,
          "Top level must be CONTINUITY.",
          token
        );
      }

      current = {
        kind: "ContinuityBlock",
        id: header.id,
        symbol,
        keyword: SYMBOLS[symbol].keyword,
        params: parseSourceParams(header.parameterText, token.line, parserOptions),
        body: [],
        location: { line: token.line, column: token.column }
      };
      continue;
    }

    if (!current) {
      throw new CMLError(
        ERROR_CODES.SYNTAX,
        "Instruction outside continuity block.",
        token
      );
    }

    const match = token.value.match(/^(\S+)(?:[ \t]+([\s\S]*))?$/u);
    if (!match) {
      throw new CMLError(
        ERROR_CODES.SYNTAX,
        "Invalid instruction syntax or unsupported whitespace.",
        token
      );
    }

    const symbol = resolveSymbol(match[1]);
    if (!symbol) {
      throw new CMLError(
        ERROR_CODES.UNKNOWN_SYMBOL,
        `Unknown symbol '${match[1]}'.`,
        token
      );
    }

    const definition = SYMBOLS[symbol];
    if (definition.opensBlock) {
      throw new CMLError(
        ERROR_CODES.SYNTAX,
        "Nested CONTINUITY is not allowed.",
        token
      );
    }

    current.body.push({
      kind: "Instruction",
      symbol,
      keyword: definition.keyword,
      type: definition.type,
      family: definition.family,
      params: parseSourceParams(match[2] ?? "", token.line, parserOptions),
      location: { line: token.line, column: token.column }
    });
  }

  if (current) {
    throw new CMLError(
      ERROR_CODES.SYNTAX,
      `Block '${current.id}' is missing '}'.`,
      current.location
    );
  }

  return ast;
}

function parseHeader(token) {
  const withoutBrace = token.value.slice(0, -1);

  if (!/[ \t]$/u.test(withoutBrace)) {
    throw new CMLError(
      ERROR_CODES.SYNTAX,
      "CONTINUITY block header requires whitespace before '{'.",
      token
    );
  }

  const headerText = withoutBrace.replace(/[ \t]+$/u, "");
  const match = headerText.match(
    /^(\S+)[ \t]+([A-Za-z_][A-Za-z0-9_-]*)(?:[ \t]+([\s\S]*))?$/u
  );

  if (!match) {
    throw new CMLError(
      ERROR_CODES.SYNTAX,
      "Invalid continuity block header or unsupported whitespace.",
      token
    );
  }

  return {
    symbolText: match[1],
    id: match[2],
    parameterText: match[3] ?? ""
  };
}
