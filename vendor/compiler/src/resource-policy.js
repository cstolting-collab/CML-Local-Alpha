import { Buffer } from "node:buffer";
import { CMLError, ERROR_CODES } from "./errors.js";

const RESOLVED_LIMITS = new WeakSet();

export const HARD_RESOURCE_LIMITS = Object.freeze({
  maxSourceChars: 32 * 1024 * 1024,
  maxSourceBytes: 64 * 1024 * 1024,
  maxConfigBytes: 4 * 1024 * 1024,
  maxLineChars: 1024 * 1024,
  maxTokens: 1_000_000,
  maxParameterChars: 256 * 1024,
  maxValueDepth: 512,
  maxValueEntries: 4_000_000,
  maxStringChars: 4 * 1024 * 1024,
  maxTotalStringChars: 64 * 1024 * 1024,
  maxGraphNodes: 250_000,
  maxGraphEdges: 1_000_000,
  maxProjectFiles: 50_000,
  maxIncludeDepth: 256
});

export const DEFAULT_RESOURCE_LIMITS = Object.freeze({
  maxSourceChars: 8 * 1024 * 1024,
  maxSourceBytes: 16 * 1024 * 1024,
  maxConfigBytes: 1024 * 1024,
  maxLineChars: 256 * 1024,
  maxTokens: 250_000,
  maxParameterChars: 64 * 1024,
  maxValueDepth: 128,
  maxValueEntries: 1_000_000,
  maxStringChars: 1024 * 1024,
  maxTotalStringChars: 16 * 1024 * 1024,
  maxGraphNodes: 100_000,
  maxGraphEdges: 500_000,
  maxProjectFiles: 10_000,
  maxIncludeDepth: 128
});

export function resolveResourceLimits(overrides = {}) {
  if (
    overrides === null ||
    typeof overrides !== "object" ||
    Array.isArray(overrides)
  ) {
    throw new TypeError(
      "CML resource limits must be an object."
    );
  }

  if (RESOLVED_LIMITS.has(overrides)) {
    return overrides;
  }

  for (const name of Object.keys(overrides)) {
    if (!Object.hasOwn(DEFAULT_RESOURCE_LIMITS, name)) {
      throw new TypeError(
        `Unknown CML resource limit '${name}'.`
      );
    }
  }

  const limits = {
    ...DEFAULT_RESOURCE_LIMITS,
    ...overrides
  };

  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value < 1) {
      throw new TypeError(
        `CML resource limit '${name}' must be a positive integer.`
      );
    }

    const hardMaximum = HARD_RESOURCE_LIMITS[name];

    if (hardMaximum !== undefined && value > hardMaximum) {
      throw new RangeError(
        `CML resource limit '${name}' cannot exceed hard maximum ${hardMaximum}.`
      );
    }
  }

  const resolved = Object.freeze(limits);
  RESOLVED_LIMITS.add(resolved);
  return resolved;
}

export function assertSourceWithinLimits(
  source,
  overrides = {}
) {
  const limits = resolveResourceLimits(overrides);
  const text = String(source);

  if (text.length > limits.maxSourceChars) {
    resourceLimit(
      `CML source exceeds maxSourceChars (${limits.maxSourceChars}).`,
      {
        limit: "maxSourceChars",
        maximum: limits.maxSourceChars,
        actual: text.length
      }
    );
  }

  const sourceBytes = Buffer.byteLength(text, "utf8");
  if (sourceBytes > limits.maxSourceBytes) {
    resourceLimit(
      `CML source exceeds maxSourceBytes (${limits.maxSourceBytes}).`,
      {
        limit: "maxSourceBytes",
        maximum: limits.maxSourceBytes,
        actual: sourceBytes
      }
    );
  }

  let line = 1;
  let lineLength = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const code = text.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);

      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CMLError(
          ERROR_CODES.SYNTAX,
          "CML source contains an unpaired UTF-16 high surrogate.",
          { location: { line, column: lineLength + 1 } }
        );
      }

      lineLength += 2;
      index += 1;
      assertLineLength(line, lineLength, limits);
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      throw new CMLError(
        ERROR_CODES.SYNTAX,
        "CML source contains an unpaired UTF-16 low surrogate.",
        { location: { line, column: lineLength + 1 } }
      );
    }

    if (character === "\r") {
      line += 1;
      lineLength = 0;

      if (text[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    if (character === "\n") {
      line += 1;
      lineLength = 0;
      continue;
    }

    lineLength += 1;
    assertLineLength(line, lineLength, limits);
  }

  return { text, limits };
}

function assertLineLength(line, lineLength, limits) {
  if (lineLength > limits.maxLineChars) {
    resourceLimit(
      `CML line ${line} exceeds maxLineChars (${limits.maxLineChars}).`,
      {
        limit: "maxLineChars",
        maximum: limits.maxLineChars,
        line
      },
      { line, column: limits.maxLineChars + 1 }
    );
  }
}

export function assertParameterTextWithinLimits(
  text,
  line,
  overrides = {}
) {
  const limits = resolveResourceLimits(overrides);

  if (text.length > limits.maxLineChars) {
    resourceLimit(
      `CML parameter text exceeds maxLineChars (${limits.maxLineChars}).`,
      {
        limit: "maxLineChars",
        maximum: limits.maxLineChars,
        actual: text.length
      },
      { line, column: 1 }
    );
  }

  return limits;
}

export function assertParameterValueWithinLimits(
  value,
  line,
  overrides = {}
) {
  const limits = resolveResourceLimits(overrides);

  if (
    typeof value === "string" &&
    value.length > limits.maxParameterChars
  ) {
    resourceLimit(
      `CML parameter value exceeds maxParameterChars (${limits.maxParameterChars}).`,
      {
        limit: "maxParameterChars",
        maximum: limits.maxParameterChars,
        actual: value.length
      },
      { line, column: 1 }
    );
  }
}

export function assertValueWithinLimits(
  value,
  label,
  overrides = {}
) {
  const limits = resolveResourceLimits(overrides);
  const seen = new WeakSet();
  const pending = [{ value, depth: 0 }];
  let entries = 0;
  let totalStringChars = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    const currentValue = current.value;

    if (typeof currentValue === "string") {
      totalStringChars += currentValue.length;

      if (currentValue.length > limits.maxStringChars) {
        resourceLimit(
          `${label} contains a string exceeding maxStringChars (${limits.maxStringChars}).`,
          {
            limit: "maxStringChars",
            maximum: limits.maxStringChars,
            actual: currentValue.length
          }
        );
      }

      if (totalStringChars > limits.maxTotalStringChars) {
        resourceLimit(
          `${label} exceeds maxTotalStringChars (${limits.maxTotalStringChars}).`,
          {
            limit: "maxTotalStringChars",
            maximum: limits.maxTotalStringChars,
            actual: totalStringChars
          }
        );
      }

      continue;
    }

    if (
      currentValue === null ||
      currentValue === undefined ||
      typeof currentValue === "number" ||
      typeof currentValue === "boolean"
    ) {
      continue;
    }

    if (
      typeof currentValue === "function" ||
      typeof currentValue === "symbol" ||
      typeof currentValue === "bigint"
    ) {
      resourceLimit(
        `${label} contains an unsupported value type '${typeof currentValue}'.`,
        { limit: "supportedValueTypes" }
      );
    }

    if (typeof currentValue !== "object") {
      continue;
    }

    if (seen.has(currentValue)) {
      resourceLimit(
        `${label} contains shared or cyclic object references.`,
        { limit: "acyclicValueGraph" }
      );
    }

    seen.add(currentValue);

    if (current.depth > limits.maxValueDepth) {
      resourceLimit(
        `${label} exceeds maxValueDepth (${limits.maxValueDepth}).`,
        {
          limit: "maxValueDepth",
          maximum: limits.maxValueDepth,
          actual: current.depth
        }
      );
    }

    let prototype;
    let ownKeys;

    try {
      prototype = Object.getPrototypeOf(currentValue);
      ownKeys = Reflect.ownKeys(currentValue);
    } catch (error) {
      resourceLimit(
        `${label} contains an object that cannot be inspected safely.`,
        {
          limit: "inspectableValueGraph",
          systemMessage: error instanceof Error ? error.message : String(error)
        }
      );
    }

    const isArray = Array.isArray(currentValue);

    if (isArray) {
      if (currentValue.length > limits.maxValueEntries) {
        resourceLimit(
          `${label} array exceeds maxValueEntries (${limits.maxValueEntries}).`,
          {
            limit: "maxValueEntries",
            maximum: limits.maxValueEntries,
            actual: currentValue.length
          }
        );
      }

      entries += currentValue.length;
    } else if (
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      resourceLimit(
        `${label} contains a non-plain object.`,
        { limit: "plainObjectsOnly" }
      );
    }

    for (let index = ownKeys.length - 1; index >= 0; index -= 1) {
      const key = ownKeys[index];

      if (typeof key === "symbol") {
        resourceLimit(
          `${label} contains a symbol-keyed property.`,
          { limit: "stringPropertyKeysOnly" }
        );
      }

      if (isArray && key === "length") {
        continue;
      }

      if (isArray && !isCanonicalArrayIndex(key, currentValue.length)) {
        resourceLimit(
          `${label} array contains a non-index property '${key}'.`,
          { limit: "arrayIndexPropertiesOnly" }
        );
      }

      let descriptor;

      try {
        descriptor = Object.getOwnPropertyDescriptor(currentValue, key);
      } catch (error) {
        resourceLimit(
          `${label} contains a property that cannot be inspected safely.`,
          {
            limit: "inspectableValueGraph",
            property: key,
            systemMessage: error instanceof Error ? error.message : String(error)
          }
        );
      }

      if (!descriptor || descriptor.get || descriptor.set) {
        resourceLimit(
          `${label} contains an accessor property '${key}'.`,
          { limit: "dataPropertiesOnly", property: key }
        );
      }

      if (!descriptor.enumerable) {
        resourceLimit(
          `${label} contains a non-enumerable property '${key}'.`,
          { limit: "enumerablePropertiesOnly", property: key }
        );
      }

      pending.push({
        value: descriptor.value,
        depth: current.depth + 1
      });
    }

    if (!isArray) {
      entries += ownKeys.length;
    }

    if (entries > limits.maxValueEntries) {
      resourceLimit(
        `${label} exceeds maxValueEntries (${limits.maxValueEntries}).`,
        {
          limit: "maxValueEntries",
          maximum: limits.maxValueEntries,
          actual: entries
        }
      );
    }
  }

  return true;
}


/**
 * Create a data-only snapshot while enforcing the same value-graph limits.
 *
 * This is used at public trust boundaries where subsequent direct property
 * reads from a stateful Proxy would otherwise create a time-of-check/time-of-use
 * gap. The snapshot is built only from inspected own data descriptors; getters
 * are never invoked.
 */
export function snapshotValueWithinLimits(
  value,
  label,
  overrides = {}
) {
  const limits = resolveResourceLimits(overrides);
  const seen = new WeakSet();
  const root = { value: undefined };
  const pending = [{
    value,
    depth: 0,
    parent: root,
    key: "value"
  }];
  let entries = 0;
  let totalStringChars = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    const currentValue = current.value;

    if (typeof currentValue === "string") {
      totalStringChars += currentValue.length;

      if (currentValue.length > limits.maxStringChars) {
        resourceLimit(
          `${label} contains a string exceeding maxStringChars (${limits.maxStringChars}).`,
          {
            limit: "maxStringChars",
            maximum: limits.maxStringChars,
            actual: currentValue.length
          }
        );
      }

      if (totalStringChars > limits.maxTotalStringChars) {
        resourceLimit(
          `${label} exceeds maxTotalStringChars (${limits.maxTotalStringChars}).`,
          {
            limit: "maxTotalStringChars",
            maximum: limits.maxTotalStringChars,
            actual: totalStringChars
          }
        );
      }

      defineSnapshotValue(current.parent, current.key, currentValue);
      continue;
    }

    if (
      currentValue === null ||
      currentValue === undefined ||
      typeof currentValue === "number" ||
      typeof currentValue === "boolean"
    ) {
      defineSnapshotValue(current.parent, current.key, currentValue);
      continue;
    }

    if (
      typeof currentValue === "function" ||
      typeof currentValue === "symbol" ||
      typeof currentValue === "bigint"
    ) {
      resourceLimit(
        `${label} contains an unsupported value type '${typeof currentValue}'.`,
        { limit: "supportedValueTypes" }
      );
    }

    if (typeof currentValue !== "object") {
      defineSnapshotValue(current.parent, current.key, currentValue);
      continue;
    }

    if (seen.has(currentValue)) {
      resourceLimit(
        `${label} contains shared or cyclic object references.`,
        { limit: "acyclicValueGraph" }
      );
    }
    seen.add(currentValue);

    if (current.depth > limits.maxValueDepth) {
      resourceLimit(
        `${label} exceeds maxValueDepth (${limits.maxValueDepth}).`,
        {
          limit: "maxValueDepth",
          maximum: limits.maxValueDepth,
          actual: current.depth
        }
      );
    }

    let prototype;
    let ownKeys;
    let isArray;

    try {
      prototype = Object.getPrototypeOf(currentValue);
      ownKeys = Reflect.ownKeys(currentValue);
      isArray = Array.isArray(currentValue);
    } catch (error) {
      resourceLimit(
        `${label} contains an object that cannot be inspected safely.`,
        {
          limit: "inspectableValueGraph",
          systemMessage: error instanceof Error ? error.message : String(error)
        }
      );
    }

    if (
      !isArray &&
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      resourceLimit(
        `${label} contains a non-plain object.`,
        { limit: "plainObjectsOnly" }
      );
    }

    let arrayLength = null;
    if (isArray) {
      const lengthDescriptor = safeOwnDescriptor(
        currentValue,
        "length",
        label
      );

      if (
        !lengthDescriptor ||
        lengthDescriptor.get ||
        lengthDescriptor.set ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0
      ) {
        resourceLimit(
          `${label} array has an invalid length descriptor.`,
          { limit: "validArrayLength" }
        );
      }

      arrayLength = lengthDescriptor.value;
      if (arrayLength > limits.maxValueEntries) {
        resourceLimit(
          `${label} array exceeds maxValueEntries (${limits.maxValueEntries}).`,
          {
            limit: "maxValueEntries",
            maximum: limits.maxValueEntries,
            actual: arrayLength
          }
        );
      }
      entries += arrayLength;
    } else {
      entries += ownKeys.length;
    }

    if (entries > limits.maxValueEntries) {
      resourceLimit(
        `${label} exceeds maxValueEntries (${limits.maxValueEntries}).`,
        {
          limit: "maxValueEntries",
          maximum: limits.maxValueEntries,
          actual: entries
        }
      );
    }

    const snapshot = isArray
      ? new Array(arrayLength)
      : Object.create(prototype === null ? null : Object.prototype);
    defineSnapshotValue(current.parent, current.key, snapshot);

    for (let index = ownKeys.length - 1; index >= 0; index -= 1) {
      const key = ownKeys[index];

      if (typeof key === "symbol") {
        resourceLimit(
          `${label} contains a symbol-keyed property.`,
          { limit: "stringPropertyKeysOnly" }
        );
      }

      if (isArray && key === "length") {
        continue;
      }

      if (isArray && !isCanonicalArrayIndex(key, arrayLength)) {
        resourceLimit(
          `${label} array contains a non-index property '${key}'.`,
          { limit: "arrayIndexPropertiesOnly" }
        );
      }

      const descriptor = safeOwnDescriptor(currentValue, key, label);

      if (!descriptor || descriptor.get || descriptor.set) {
        resourceLimit(
          `${label} contains an accessor property '${key}'.`,
          { limit: "dataPropertiesOnly", property: key }
        );
      }

      if (!descriptor.enumerable) {
        resourceLimit(
          `${label} contains a non-enumerable property '${key}'.`,
          { limit: "enumerablePropertiesOnly", property: key }
        );
      }

      pending.push({
        value: descriptor.value,
        depth: current.depth + 1,
        parent: snapshot,
        key
      });
    }
  }

  return root.value;
}

function safeOwnDescriptor(value, key, label) {
  try {
    return Object.getOwnPropertyDescriptor(value, key);
  } catch (error) {
    resourceLimit(
      `${label} contains a property that cannot be inspected safely.`,
      {
        limit: "inspectableValueGraph",
        property: String(key),
        systemMessage: error instanceof Error ? error.message : String(error)
      }
    );
  }
}

function defineSnapshotValue(parent, key, value) {
  Object.defineProperty(parent, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true
  });
}

function isCanonicalArrayIndex(key, length) {
  if (!/^(?:0|[1-9]\d*)$/u.test(key)) {
    return false;
  }

  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

function resourceLimit(message, details = {}, location = null) {
  throw new CMLError(
    ERROR_CODES.RESOURCE_LIMIT,
    message,
    {
      location,
      details,
      suggestion:
        "Reduce input size or complexity, or use an explicitly configured trusted resource policy."
    }
  );
}
