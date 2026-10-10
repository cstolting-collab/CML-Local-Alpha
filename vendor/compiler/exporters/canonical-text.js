function readScenes(ir) {
  if (Array.isArray(ir?.scenes)) {
    return ir.scenes;
  }

  if (Array.isArray(ir?.projects)) {
    return ir.projects.flatMap(project => project.scenes ?? []);
  }

  return [];
}

function executionRank(ir, type) {
  const order = Array.isArray(ir?.execution_order) ? ir.execution_order : [];
  const index = order.indexOf(type);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function orderedInstructions(ir, instructions = []) {
  return instructions
    .map((instruction, index) => ({ instruction, index }))
    .sort((left, right) => {
      const rankDifference =
        executionRank(ir, left.instruction.type) -
        executionRank(ir, right.instruction.type);

      return rankDifference !== 0 ? rankDifference : left.index - right.index;
    })
    .map(entry => entry.instruction);
}

function semanticEntries(instruction) {
  const ignored = new Set(["type", "source", "symbol", "keyword"]);

  return Object.entries(instruction)
    .filter(([key, value]) => !ignored.has(key) && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
}

export function exportCanonicalText(ir) {
  const lines = [];
  lines.push("CML CANONICAL CONTINUITY PLAN");
  lines.push(
    `Version: ${ir?.source_cml_version ?? ir?.cml_version ?? ir?.version ?? "unknown"}`
  );
  lines.push("");

  for (const scene of readScenes(ir)) {
    lines.push(`SCENE ${scene.id}`);

    for (const instruction of orderedInstructions(ir, scene.instructions ?? [])) {
      const details = semanticEntries(instruction)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ");

      lines.push(
        `${String(instruction.type ?? "unknown").toUpperCase()}${details ? ` ${details}` : ""}`
      );
    }

    lines.push("");
  }

  lines.push("CONTINUITY FIRST. TRANSFORMATION AFTER VALIDATION.");
  return lines.join("\n");
}

export { readScenes, orderedInstructions };
