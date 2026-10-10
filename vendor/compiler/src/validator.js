import { assertProgramAst } from "./ast-contract.js";
import { ERROR_CODES } from "./errors.js";
import { EXECUTION_ORDER } from "./language.js";
import { CML_LANGUAGE_MANIFEST } from "./specification.js";

const unwrap = value =>
  value && typeof value === "object" && Object.hasOwn(value, "value")
    ? value.value
    : value;

const issue = (code, message, node, severity = "error") => ({
  code,
  severity,
  message,
  location: node?.location ?? null,
  source: node?.source ?? null
});

const ORDER_INDEX = new Map(
  EXECUTION_ORDER.map((type, index) => [type, index])
);

const PARAMETER_CONTRACTS = new Map(
  CML_LANGUAGE_MANIFEST.symbols.map(symbol => [
    symbol.type,
    {
      required: new Set(symbol.parameters?.required ?? []),
      optional: new Set(symbol.parameters?.optional ?? [])
    }
  ])
);

const EMPTY_PARAMS = Object.freeze(Object.create(null));

function paramsFor(node, issues, label) {
  if (node?.params === undefined || node?.params === null) {
    return EMPTY_PARAMS;
  }

  if (typeof node.params !== "object" || Array.isArray(node.params)) {
    issues.push(issue(
      ERROR_CODES.SYNTAX,
      `${label} parameters must be an object.`,
      node
    ));
    return EMPTY_PARAMS;
  }

  return node.params;
}

function validateKnownParameters(node, params, issues) {
  const contract = PARAMETER_CONTRACTS.get(node.type);
  if (!contract) {
    issues.push(issue(
      ERROR_CODES.UNKNOWN_SYMBOL,
      `Unknown instruction type '${String(node.type)}'.`,
      node
    ));
    return false;
  }

  for (const name of Object.keys(params)) {
    if (!contract.required.has(name) && !contract.optional.has(name)) {
      issues.push(issue(
        ERROR_CODES.UNKNOWN_PARAMETER,
        `${node.keyword ?? node.type} does not define parameter '${name}'.`,
        node
      ));
    }
  }

  return true;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isQuantity(value, unit) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.hasOwn(value, "value") &&
    Object.hasOwn(value, "unit") &&
    value.unit === unit &&
    Number.isFinite(value.value) &&
    Math.abs(value.value) <= Number.MAX_SAFE_INTEGER
  );
}

function validateString(node, params, name, issues, { allowEmpty = false } = {}) {
  if (!Object.hasOwn(params, name)) {
    return;
  }

  const value = params[name];
  const valid = allowEmpty ? typeof value === "string" : isNonEmptyString(value);

  if (!valid) {
    issues.push(issue(
      ERROR_CODES.INVALID_VALUE,
      `${node.keyword} '${name}' must be ${allowEmpty ? "a string" : "a non-empty string"}.`,
      node
    ));
  }
}

function validateBoolean(node, params, name, issues) {
  if (Object.hasOwn(params, name) && typeof params[name] !== "boolean") {
    issues.push(issue(
      ERROR_CODES.INVALID_VALUE,
      `${node.keyword} '${name}' must be true or false.`,
      node
    ));
  }
}

function validateDuration(
  node,
  params,
  name,
  issues,
  {
    minimum = 0,
    minimumCode = ERROR_CODES.INVALID_VALUE,
    minimumMessage = null
  } = {}
) {
  if (!Object.hasOwn(params, name)) {
    return null;
  }

  const value = params[name];

  if (!isQuantity(value, "ms")) {
    issues.push(issue(
      ERROR_CODES.INVALID_VALUE,
      `${node.keyword} '${name}' must be a duration using ms or s.`,
      node
    ));
    return null;
  }

  if (value.value < minimum) {
    issues.push(issue(
      minimumCode,
      minimumMessage ?? `${node.keyword} '${name}' must be at least ${minimum}ms.`,
      node
    ));
  }

  return value.value;
}

/** Validate an AST received through the public API. */
export function validate(ast) {
  return validateProgram(ast, false);
}

/** Internal fast path for ASTs produced by the reference parser/project loader. */
export function validateParsedAst(ast) {
  return validateProgram(ast, true);
}

function validateProgram(ast, trustedData) {
  const issues = [];

  if (!trustedData) {
    try {
      ast = assertProgramAst(ast);
    } catch (error) {
      issues.push({
        code: typeof error?.code === "string" ? error.code : ERROR_CODES.SYNTAX,
        severity: "error",
        message: error instanceof Error ? error.message : "CML AST validation failed.",
        location: error?.location ?? null,
        source: error?.source ?? null
      });

      return { valid: false, issueCount: issues.length, issues };
    }
  }

  const ids = new Set();

  if (!ast || typeof ast !== "object" || !Array.isArray(ast.body) || ast.body.length === 0) {
    issues.push(issue(
      ERROR_CODES.SYNTAX,
      "CML document requires at least one CONTINUITY block.",
      ast
    ));
    return { valid: false, issueCount: issues.length, issues };
  }

  for (const block of ast.body) {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      issues.push(issue(
        ERROR_CODES.SYNTAX,
        "CML program contains an invalid continuity block.",
        block
      ));
      continue;
    }

    if (typeof block.id !== "string" || block.id.length === 0) {
      issues.push(issue(
        ERROR_CODES.SYNTAX,
        "CONTINUITY block requires a non-empty id.",
        block
      ));
    } else if (ids.has(block.id)) {
      issues.push(issue(
        ERROR_CODES.DUPLICATE_ID,
        `Duplicate block id '${block.id}'.`,
        block
      ));
    }
    ids.add(block.id);

    const blockParams = paramsFor(block, issues, "CONTINUITY");
    for (const name of Object.keys(blockParams)) {
      issues.push(issue(
        ERROR_CODES.UNKNOWN_PARAMETER,
        `CONTINUITY does not define parameter '${name}'.`,
        block
      ));
    }

    if (!Array.isArray(block.body)) {
      issues.push(issue(
        ERROR_CODES.SYNTAX,
        `Block '${block.id ?? "unknown"}' requires an instruction array.`,
        block
      ));
      continue;
    }

    const locks = new Set(
      block.body
        .filter(node => node && typeof node === "object" && node.type === "lock")
        .map(node => paramsFor(node, issues, "LOCK"))
        .filter(params => Object.hasOwn(params, "target"))
        .map(params => unwrap(params.target))
    );

    if (!locks.has("character")) {
      issues.push(issue(
        ERROR_CODES.CHARACTER_LOCK_MISSING,
        `Block '${block.id}' requires LOCK target=character.`,
        block
      ));
    }
    if (!locks.has("world")) {
      issues.push(issue(
        ERROR_CODES.WORLD_LOCK_MISSING,
        `Block '${block.id}' requires LOCK target=world.`,
        block
      ));
    }

    let reactionSeen = false;
    let continuityReady = false;
    let highestOrder = -1;

    for (const node of block.body) {
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        issues.push(issue(
          ERROR_CODES.SYNTAX,
          "CONTINUITY block contains an invalid instruction.",
          node
        ));
        continue;
      }

      const params = paramsFor(node, issues, node.keyword ?? node.type ?? "Instruction");
      if (!validateKnownParameters(node, params, issues)) {
        continue;
      }

      const required = name => {
        if (!Object.hasOwn(params, name)) {
          issues.push(issue(
            ERROR_CODES.MISSING_PARAMETER,
            `${node.keyword} requires '${name}'.`,
            node
          ));
          return false;
        }
        return true;
      };

      const order = ORDER_INDEX.get(node.type) ?? -1;
      if (order >= 0 && order < highestOrder) {
        issues.push(issue(
          ERROR_CODES.LIFT_ORDER,
          `${node.keyword} violates the normative execution order.`,
          node
        ));
      }
      if (order >= 0) {
        highestOrder = Math.max(highestOrder, order);
      }

      switch (node.type) {
        case "lock":
          if (required("target")) validateString(node, params, "target", issues);
          validateString(node, params, "mode", issues);
          continuityReady = true;
          break;

        case "flow":
          if (required("target")) validateString(node, params, "target", issues);
          if (required("mode")) validateString(node, params, "mode", issues);
          continuityReady = true;
          break;

        case "count": {
          if (required("value")) {
            const value = params.value;
            if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
              issues.push(issue(
                ERROR_CODES.INVALID_VALUE,
                "COUNT value must be a non-negative safe integer.",
                node
              ));
            }
          }
          validateString(node, params, "unit", issues);
          continuityReady = true;
          break;
        }

        case "pause":
          if (required("duration")) {
            validateDuration(node, params, "duration", issues);
          }
          continuityReady = true;
          break;

        case "silence":
          if (required("duration")) {
            validateDuration(node, params, "duration", issues, {
              minimum: 500,
              minimumCode: ERROR_CODES.SILENCE_TOO_SHORT,
              minimumMessage: "SILENCE must be at least 500ms."
            });
          }
          validateBoolean(node, params, "zero", issues);
          continuityReady = true;
          break;

        case "voice": {
          if (required("words")) {
            const limit = params.words;
            if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > 8) {
              issues.push(issue(
                ERROR_CODES.VOICE_WORD_LIMIT,
                "VOICE words must be 1 through 8.",
                node
              ));
            }

            if (typeof params.text === "string") {
              const actual = params.text.trim().split(/\s+/u).filter(Boolean).length;
              if (actual > limit) {
                issues.push(issue(
                  ERROR_CODES.VOICE_WORD_LIMIT,
                  `VOICE has ${actual} words; limit is ${limit}.`,
                  node
                ));
              }
            }
          }

          validateString(node, params, "text", issues, { allowEmpty: true });

          if (Object.hasOwn(params, "speed")) {
            const speed = params.speed;
            if (typeof speed !== "number" || !Number.isFinite(speed) || speed <= 0) {
              issues.push(issue(
                ERROR_CODES.INVALID_VALUE,
                "VOICE speed must be a positive finite numeric multiplier.",
                node
              ));
            }
          }

          continuityReady = true;
          break;
        }

        case "reaction":
          if (required("type")) validateString(node, params, "type", issues);
          if (!Object.hasOwn(params, "delay") && !Object.hasOwn(params, "trigger")) {
            issues.push(issue(
              ERROR_CODES.REACTION_INCOMPLETE,
              "REACTION requires delay or trigger.",
              node
            ));
          }
          validateString(node, params, "trigger", issues);
          validateDuration(node, params, "delay", issues);
          validateDuration(node, params, "settle", issues);
          validateBoolean(node, params, "hold", issues);
          reactionSeen = true;
          break;

        case "transition":
          if (required("to")) validateString(node, params, "to", issues);
          validateString(node, params, "mode", issues);
          break;

        case "memory":
          if (required("key")) validateString(node, params, "key", issues);
          validateBoolean(node, params, "carry", issues);
          validateString(node, params, "scope", issues);
          break;

        case "continuity_break":
          if (required("reason")) validateString(node, params, "reason", issues);
          break;

        case "loudness_lift": {
          if (required("target") && !isQuantity(params.target, "LUFS")) {
            issues.push(issue(
              ERROR_CODES.INVALID_VALUE,
              "LIFT target must be a finite LUFS value.",
              node
            ));
          }

          const hasAfter = required("after");
          if (hasAfter) validateString(node, params, "after", issues);

          if (
            !hasAfter ||
            params.after !== "continuity" ||
            !continuityReady ||
            !reactionSeen
          ) {
            issues.push(issue(
              ERROR_CODES.LIFT_ORDER,
              "LIFT must occur after continuity structure and REACTION, with after=continuity.",
              node
            ));
          }
          break;
        }
      }
    }
  }

  return {
    valid: !issues.some(entry => entry.severity === "error"),
    issueCount: issues.length,
    issues
  };
}
