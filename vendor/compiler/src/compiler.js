import { parse } from "./parser.js";
import { validateParsedAst } from "./validator.js";
import { buildIRFromValidatedAst } from "./ir.js";
import { CMLError, ERROR_CODES, normalizeError } from "./errors.js";
import { COMPILER_VERSION } from "./version.js";

export function compileSource(source, options = {}) {
  const sourceInfo = options.sourcePath
    ? { path: options.sourcePath }
    : options.source ?? null;

  let ast;

  try {
    ast = parse(source, {
      limits:
        options.limits ??
        options.resourceLimits ??
        options.resource_limits ??
        {}
    });
  } catch (error) {
    throw normalizeError(error, {
      code: ERROR_CODES.SYNTAX,
      source: sourceInfo
    });
  }

  const validation = validateParsedAst(ast);
  const ir = validation.valid ? buildIRFromValidatedAst(ast) : null;
  const report = {
    compiler: "CML Reference Compiler",
    version: COMPILER_VERSION,
    valid: validation.valid,
    summary: validation.valid ? "Compilation successful" : "Compilation failed",
    validation
  };

  if (options.throwOnInvalid && !validation.valid) {
    throw new CMLError(
      ERROR_CODES.VALIDATION_FAILED,
      "CML validation failed.",
      {
        source: sourceInfo,
        details: {
          issueCount: validation.issueCount,
          issues: validation.issues
        },
        suggestion: "Run validation and correct the reported CML issues."
      }
    );
  }

  return { ast, validation, ir, json: ir, report };
}
