import { CMLError, ERROR_CODES } from "./errors.js";
import { CML_VERSION, SYMBOLS } from "./language.js";
import { snapshotValueWithinLimits } from "./resource-policy.js";

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/u;

/**
 * Assert the complete public CML AST boundary without invoking user-defined
 * getters or accepting hidden symbol/accessor state.
 */
export function assertProgramAst(ast, options = {}) {
  const authenticatedAst = snapshotValueWithinLimits(
    ast,
    "CML AST",
    options.limits ?? options.resourceLimits ?? {}
  );

  if (
    !authenticatedAst ||
    typeof authenticatedAst !== "object" ||
    Array.isArray(authenticatedAst)
  ) {
    syntax("CML AST must be a plain Program object.");
  }

  ast = authenticatedAst;
  requireOwnFields(ast, ["kind", "cmlVersion", "body", "sourceLength"], "CML AST");

  if (ast.kind !== "Program") {
    syntax("CML AST kind must be 'Program'.", ast);
  }

  if (ast.cmlVersion !== CML_VERSION) {
    throw new CMLError(
      ERROR_CODES.UNSUPPORTED_VERSION,
      `Unsupported CML AST version '${String(ast.cmlVersion)}'.`,
      {
        location: optionalOwn(ast, "location"),
        suggestion: `Use CML AST version '${CML_VERSION}'.`
      }
    );
  }

  if (!Array.isArray(ast.body) || ast.body.length === 0) {
    syntax("CML AST requires at least one CONTINUITY block.", ast);
  }

  if (!Number.isSafeInteger(ast.sourceLength) || ast.sourceLength < 0) {
    invalid("CML AST sourceLength must be a non-negative safe integer.", ast);
  }

  for (const block of ast.body) {
    assertBlock(block);
  }

  return ast;
}

function assertBlock(block) {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    syntax("CML AST contains an invalid continuity block.", block);
  }

  requireOwnFields(
    block,
    ["kind", "id", "symbol", "keyword", "params", "body", "location"],
    "CML continuity block"
  );

  if (block.kind !== "ContinuityBlock") {
    syntax("CML block kind must be 'ContinuityBlock'.", block);
  }

  if (typeof block.id !== "string" || !IDENTIFIER_PATTERN.test(block.id)) {
    syntax("CML block id does not satisfy the published identifier grammar.", block);
  }

  const definition = Object.hasOwn(SYMBOLS, block.symbol)
    ? SYMBOLS[block.symbol]
    : null;
  if (
    !definition ||
    !definition.opensBlock ||
    block.keyword !== definition.keyword
  ) {
    unknown("CML block symbol/keyword does not identify CONTINUITY.", block);
  }

  if (!block.params || typeof block.params !== "object" || Array.isArray(block.params)) {
    syntax("CONTINUITY block parameters must be a plain object.", block);
  }

  assertLocation(block.location, "CONTINUITY block");

  if (!Array.isArray(block.body)) {
    syntax("CONTINUITY block body must be an instruction array.", block);
  }

  for (const instruction of block.body) {
    assertInstruction(instruction);
  }
}

function assertInstruction(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    syntax("CML AST contains an invalid instruction.", node);
  }

  requireOwnFields(
    node,
    ["kind", "symbol", "keyword", "type", "family", "params", "location"],
    "CML instruction"
  );

  if (node.kind !== "Instruction") {
    syntax("CML instruction kind must be 'Instruction'.", node);
  }

  const definition = Object.hasOwn(SYMBOLS, node.symbol)
    ? SYMBOLS[node.symbol]
    : null;
  if (!definition || definition.opensBlock) {
    unknown(`Unknown CML instruction symbol '${String(node.symbol)}'.`, node);
  }

  if (
    node.keyword !== definition.keyword ||
    node.type !== definition.type ||
    node.family !== definition.family
  ) {
    unknown(
      `CML instruction metadata does not match symbol '${node.symbol}'.`,
      node
    );
  }

  if (!node.params || typeof node.params !== "object" || Array.isArray(node.params)) {
    syntax(`${definition.keyword} parameters must be a plain object.`, node);
  }

  assertLocation(node.location, `${definition.keyword} instruction`);
}

function assertLocation(location, label) {
  if (location && typeof location === "object" && !Array.isArray(location)) {
    requireOwnFields(location, ["line", "column"], `${label} location`);
  }

  if (
    !location ||
    typeof location !== "object" ||
    Array.isArray(location) ||
    !Number.isSafeInteger(location.line) ||
    location.line < 1 ||
    !Number.isSafeInteger(location.column) ||
    location.column < 1
  ) {
    syntax(`${label} requires a valid line and column location.`, location);
  }
}

function requireOwnFields(object, fields, label) {
  for (const field of fields) {
    if (!Object.hasOwn(object, field)) {
      syntax(`${label} requires an own '${field}' field.`, object);
    }
  }
}

function optionalOwn(object, key) {
  return object && Object.hasOwn(object, key) ? object[key] : null;
}

function syntax(message, node = null) {
  throw new CMLError(ERROR_CODES.SYNTAX, message, {
    location: optionalOwn(node, "location"),
    source: optionalOwn(node, "source")
  });
}

function unknown(message, node = null) {
  throw new CMLError(ERROR_CODES.UNKNOWN_SYMBOL, message, {
    location: optionalOwn(node, "location"),
    source: optionalOwn(node, "source")
  });
}

function invalid(message, node = null) {
  throw new CMLError(ERROR_CODES.INVALID_VALUE, message, {
    location: optionalOwn(node, "location"),
    source: optionalOwn(node, "source")
  });
}
