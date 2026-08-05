#!/usr/bin/env node

import fs from "node:fs";

const [svgPath, batchIndexRaw = "0", batchSizeRaw = "8"] =
  process.argv.slice(2);

if (!svgPath) {
  throw new Error(
    "Usage: node generate-rive-shape-payload.mjs <svg> [batch-index] [batch-size]",
  );
}

const batchIndex = Number(batchIndexRaw);
const batchSize = Number(batchSizeRaw);
const svg = fs.readFileSync(svgPath, "utf8");

const COMMAND_ARITY = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Z: 0,
};

function parseAttributes(source) {
  return Object.fromEntries(
    [...source.matchAll(/([:\w-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}

function tokenizePath(d) {
  return (
    d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []
  );
}

function pathToRiveCommands(d) {
  const tokens = tokenizePath(d);
  const commands = [];
  let index = 0;
  let active = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let previousType = null;
  let previousControl2X = 0;
  let previousControl2Y = 0;

  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      active = tokens[index++];
    }
    if (!active) {
      throw new Error(`Path starts without a command: ${d}`);
    }

    const upper = active.toUpperCase();
    const relative = active !== upper;
    const arity = COMMAND_ARITY[upper];
    if (arity === undefined) {
      throw new Error(`Unsupported SVG path command ${active} in ${d}`);
    }

    if (upper === "Z") {
      commands.push({ commandType: "close" });
      x = startX;
      y = startY;
      previousType = "Z";
      active = null;
      continue;
    }

    if (index + arity > tokens.length) {
      throw new Error(`Incomplete SVG path command ${active} in ${d}`);
    }

    const values = tokens
      .slice(index, index + arity)
      .map((token) => Number(token));
    index += arity;

    if (upper === "M") {
      const nextX = relative ? x + values[0] : values[0];
      const nextY = relative ? y + values[1] : values[1];
      commands.push({ commandType: "moveTo", x: nextX, y: nextY });
      x = nextX;
      y = nextY;
      startX = x;
      startY = y;
      previousType = "M";
      active = relative ? "l" : "L";
      continue;
    }

    if (upper === "L") {
      x = relative ? x + values[0] : values[0];
      y = relative ? y + values[1] : values[1];
      commands.push({ commandType: "lineTo", x, y });
      previousType = "L";
      continue;
    }

    if (upper === "H") {
      x = relative ? x + values[0] : values[0];
      commands.push({ commandType: "lineTo", x, y });
      previousType = "L";
      continue;
    }

    if (upper === "V") {
      y = relative ? y + values[0] : values[0];
      commands.push({ commandType: "lineTo", x, y });
      previousType = "L";
      continue;
    }

    if (upper === "C") {
      const control1X = relative ? x + values[0] : values[0];
      const control1Y = relative ? y + values[1] : values[1];
      const control2X = relative ? x + values[2] : values[2];
      const control2Y = relative ? y + values[3] : values[3];
      const endX = relative ? x + values[4] : values[4];
      const endY = relative ? y + values[5] : values[5];
      commands.push({
        commandType: "cubicTo",
        control1X,
        control1Y,
        control2X,
        control2Y,
        endX,
        endY,
      });
      x = endX;
      y = endY;
      previousControl2X = control2X;
      previousControl2Y = control2Y;
      previousType = "C";
      continue;
    }

    if (upper === "S") {
      const control1X =
        previousType === "C" ? 2 * x - previousControl2X : x;
      const control1Y =
        previousType === "C" ? 2 * y - previousControl2Y : y;
      const control2X = relative ? x + values[0] : values[0];
      const control2Y = relative ? y + values[1] : values[1];
      const endX = relative ? x + values[2] : values[2];
      const endY = relative ? y + values[3] : values[3];
      commands.push({
        commandType: "cubicTo",
        control1X,
        control1Y,
        control2X,
        control2Y,
        endX,
        endY,
      });
      x = endX;
      y = endY;
      previousControl2X = control2X;
      previousControl2Y = control2Y;
      previousType = "C";
    }
  }

  return commands;
}

function polygonToRiveCommands(points) {
  const values = points
    .trim()
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  const commands = [];
  for (let index = 0; index < values.length; index += 2) {
    commands.push({
      commandType: index === 0 ? "moveTo" : "lineTo",
      x: values[index],
      y: values[index + 1],
    });
  }
  commands.push({ commandType: "close" });
  return commands;
}

function paintsFor(attributes) {
  const paints = [];
  if (attributes.fill && attributes.fill !== "none") {
    paints.push({ paintType: "fill", color: attributes.fill });
  }
  if (attributes.stroke && attributes.stroke !== "none") {
    paints.push({
      paintType: "stroke",
      color: attributes.stroke,
      width: Number(attributes["stroke-width"] ?? 1),
    });
  }
  return paints;
}

const shapes = [];
for (const match of svg.matchAll(/<(path|polygon)\b([^>]*)\/>/g)) {
  const [, tagName, rawAttributes] = match;
  const attributes = parseAttributes(rawAttributes);
  const commands =
    tagName === "path"
      ? pathToRiveCommands(attributes.d)
      : polygonToRiveCommands(attributes.points);
  shapes.push({
    name: attributes.id,
    parentId: "0-2",
    x: 0,
    y: 0,
    paths: [{ name: `${attributes.id}_path`, commands }],
    paints: paintsFor(attributes),
  });
}

const start = batchIndex * batchSize;
const batch = shapes.slice(start, start + batchSize);
process.stdout.write(
  JSON.stringify({
    command: "createShapes",
    data: { createShapes: { shapes: batch } },
    meta: {
      batchIndex,
      batchSize,
      totalShapes: shapes.length,
      batchShapeNames: batch.map((shape) => shape.name),
    },
  }),
);
