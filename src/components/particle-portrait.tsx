import { useEffect, useLayoutEffect, useRef } from "react";
import {
  DEFAULT_PORTFOLIO_CONTENT,
  sanitizeRichText,
  type PortfolioContent,
  type PortfolioSection,
} from "../lib/portfolio-content";
import {
  getParticleCanvasDpr,
  getParticlePointerDistortion,
  getParticlePixelSize,
  getPortraitParticleBudget,
  type ParticleHandoffTarget,
} from "../lib/particle-system";

type Point = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  color: string;
  size: number;
  driftX: number;
  driftY: number;
  edgeMotion: number;
  scatterAngle: number;
  scatterDistance: number;
  ribbonPhase: number;
  ribbonDelay: number;
};

type ImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  focusY?: number;
};

type ChromeNavRegion = {
  index: number;
  rect: ImageRect;
};

type AmbientNode = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  warm: boolean;
  tether: number;
};

type CloudPull = {
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  radius: number;
  strength: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function smootherstep(edge0: number, edge1: number, value: number) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
}

function getSnappedSceneProgress(progress: number, sceneCount: number) {
  const rawProgress = progress * sceneCount;
  const nearestScene = Math.round(rawProgress);
  // Browser scroll positions are device-pixel quantized while each magnetic
  // section can have a fractional CSS-pixel height. Treat the final few pixels
  // as the exact endpoint so settled-only layers can never be stranded.
  return Math.abs(rawProgress - nearestScene) <= 0.008
    ? nearestScene
    : rawProgress;
}

function hashNoise(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function colorWithAlpha(color: string, alpha: number) {
  const value = color.replace("#", "");
  if (/^[0-9a-f]{6}$/iu.test(value)) {
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function getImageRect(
  scene: PortfolioSection,
  width: number,
  height: number,
): ImageRect {
  const mobile = width < 760;

  if (mobile) {
    const imageWidth = width * 0.86;
    const imageHeight =
      scene.imageType === "landscape" ? height * 0.38 : height * 0.46;
    return {
      x: (width - imageWidth) / 2,
      y: height * 0.115,
      width: imageWidth,
      height: imageHeight,
      focusY: scene.imageFocusY / 100,
    };
  }

  const configuredImageWidth = width * clamp(scene.imageWidth / 100, 0.3, 0.52);
  const imageHeight =
    scene.imageType === "landscape" ? height * 0.58 : height * 0.76;
  return {
    x:
      scene.imageSide === "left"
        ? width * 0.055
        : width - width * 0.055 - configuredImageWidth,
    y: (height - imageHeight) / 2 + height * 0.015,
    width: configuredImageWidth,
    height: imageHeight,
    focusY: scene.imageFocusY / 100,
  };
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (!source.startsWith("data:")) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function getCoverCrop(image: HTMLImageElement, rect: ImageRect) {
  const targetAspect = rect.width / rect.height;
  const sourceAspect = image.naturalWidth / image.naturalHeight;
  let x = 0;
  let y = 0;
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (sourceAspect > targetAspect) {
    width = image.naturalHeight * targetAspect;
    x = (image.naturalWidth - width) / 2;
  } else {
    height = image.naturalWidth / targetAspect;
    y = (image.naturalHeight - height) * clamp(rect.focusY ?? 0.42, 0, 1);
  }

  return { x, y, width, height };
}

function getContainedImageRect(
  image: HTMLImageElement,
  slot: ImageRect,
): ImageRect {
  const sourceAspect = image.naturalWidth / image.naturalHeight;
  const slotAspect = slot.width / slot.height;
  if (sourceAspect > slotAspect) {
    const height = slot.width / sourceAspect;
    return {
      ...slot,
      y: slot.y + (slot.height - height) / 2,
      height,
    };
  }

  const width = slot.height * sourceAspect;
  return {
    ...slot,
    x: slot.x + (slot.width - width) / 2,
    width,
  };
}

function enhanceChannel(value: number) {
  return Math.round(clamp((value - 128) * 1.08 + 128, 0, 255));
}

/**
 * Crops every source to the exact visible frame before sampling it. The source
 * crop uses cover semantics, so particles represent a complete frame instead
 * of a tiny fitted image surrounded by unused canvas space.
 */
function buildPointsFromImage(
  image: HTMLImageElement,
  rect: ImageRect,
  count: number,
  seed: number,
  pixelSize: number,
) {
  const targetAspect = rect.width / rect.height;
  const crop = getCoverCrop(image, rect);

  const columns = Math.max(1, Math.ceil(Math.sqrt(count * targetAspect)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = columns;
  sampleCanvas.height = rows;
  const sampleContext = sampleCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!sampleContext) return [];

  sampleContext.imageSmoothingEnabled = true;
  sampleContext.imageSmoothingQuality = "high";
  sampleContext.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    columns,
    rows,
  );

  const pixels = sampleContext.getImageData(0, 0, columns, rows).data;
  const cellWidth = rect.width / columns;
  const cellHeight = rect.height / rows;
  const fittedPixelSize = Math.min(
    pixelSize,
    Math.min(cellWidth, cellHeight) * 0.975,
  );
  const points: Point[] = [];

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    if (row >= rows) break;

    const pixelIndex = (row * columns + column) * 4;
    const noiseX = hashNoise(column + seed * 31, row) - 0.5;
    const noiseY = hashNoise(row + seed * 47, column) - 0.5;
    const u = (column + 0.5) / columns;
    const v = (row + 0.5) / rows;
    const edgeDistance = Math.min(u, 1 - u, v, 1 - v) * 2;
    const edgeFade = smoothstep(0, 0.32, edgeDistance);
    const edgeScatter = (1 - edgeFade) * 20;
    const keepNoise = hashNoise(column + seed * 73, row + seed * 19);
    const keepParticle = keepNoise < lerp(0.1, 1, edgeFade);
    const x =
      rect.x +
      (column + 0.5 + noiseX * 0.18) * cellWidth +
      noiseX * edgeScatter;
    const y =
      rect.y + (row + 0.5 + noiseY * 0.18) * cellHeight + noiseY * edgeScatter;
    const r = enhanceChannel(pixels[pixelIndex]);
    const g = enhanceChannel(pixels[pixelIndex + 1]);
    const b = enhanceChannel(pixels[pixelIndex + 2]);
    const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

    const alpha =
      clamp(0.88 + Math.abs(luma - 0.5) * 0.3, 0.88, 1) *
      edgeFade *
      (keepParticle ? 1 : 0);
    const visualEdgeBand =
      1 - smoothstep(0.018, 0.305, Math.min(u, 1 - u, v, 1 - v));
    const fragmentNoise = ((index * 47) % 101) / 100;
    const edgeFragmentVisible =
      fragmentNoise < lerp(0.52, 0.985, visualEdgeBand);
    const edgeAlpha = edgeFragmentVisible
      ? Math.pow(visualEdgeBand, 0.72) * (0.52 + fragmentNoise * 0.46)
      : 0;
    const settledAlpha = Math.max(alpha, edgeAlpha);
    const ribbonPhase = x * 0.009 + y * 0.024;
    points.push({
      x,
      y,
      tx: x,
      ty: y,
      r,
      g,
      b,
      alpha,
      // The settled fast path must include the same edge envelope as the live
      // renderer; otherwise the perimeter disappears for a few frames before
      // the sharp-layer dissolve switches live alpha calculation back on.
      color: `rgba(${r},${g},${b},${settledAlpha})`,
      size: fittedPixelSize * lerp(0.42, 1, edgeFade),
      driftX: (hashNoise(index, seed * 5.3) - 0.5) * 2.2,
      driftY: (hashNoise(seed * 8.1, index) - 0.5) * 2.2,
      edgeMotion: 1 - edgeFade,
      scatterAngle: hashNoise(index * 0.41, seed * 7.7) * Math.PI * 2,
      scatterDistance: 24 + hashNoise(index * 0.17, 9.2) * 110,
      ribbonPhase,
      ribbonDelay: (0.5 + Math.sin(ribbonPhase) * 0.5) * 0.075,
    });
  }

  return points;
}

/**
 * Keeps the high-resolution source detail registered to the animated mesh.
 * This is deliberately built from the real points instead of generating a
 * second, denser grid whose particle size and gaps cannot match the cloud.
 */
function buildParticleDetailLayer(
  image: HTMLImageElement,
  rect: ImageRect,
  points: Point[],
  scale: number,
) {
  const crop = getCoverCrop(image, rect);
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, Math.floor(rect.width * scale));
  layer.height = Math.max(1, Math.floor(rect.height * scale));
  const layerContext = layer.getContext("2d");
  if (!layerContext) return layer;

  layerContext.setTransform(scale, 0, 0, scale, 0, 0);
  layerContext.imageSmoothingEnabled = true;
  layerContext.imageSmoothingQuality = "high";
  layerContext.filter = "contrast(1.08) saturate(.96) brightness(1.015)";
  layerContext.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    rect.width,
    rect.height,
  );
  layerContext.filter = "none";

  layerContext.globalCompositeOperation = "destination-in";
  const alphaLevels = 8;
  const maskPaths: Array<Path2D | undefined> = new Array(alphaLevels);
  for (const point of points) {
    if (point.alpha <= 0) continue;
    const alphaLevel = clamp(
      Math.ceil(point.alpha * (alphaLevels - 1)),
      1,
      alphaLevels - 1,
    );
    const path = (maskPaths[alphaLevel] ??= new Path2D());
    path.rect(
      point.tx - rect.x - point.size / 2,
      point.ty - rect.y - point.size / 2,
      point.size,
      point.size,
    );
  }
  maskPaths.forEach((path, alphaLevel) => {
    if (!path) return;
    layerContext.fillStyle = `rgba(255,255,255,${alphaLevel / (alphaLevels - 1)})`;
    layerContext.fill(path);
  });
  layerContext.globalCompositeOperation = "source-over";

  return layer;
}

/**
 * A high-resolution, softly feathered source layer for identity photography.
 * The live particle cloud is still drawn above it, but its dense centre yields
 * at settled endpoints so facial detail is never reconstructed from pixels.
 */
function buildEditorialImageLayer(
  image: HTMLImageElement,
  rect: ImageRect,
  scale: number,
) {
  const crop = getCoverCrop(image, rect);
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, Math.floor(rect.width * scale));
  layer.height = Math.max(1, Math.floor(rect.height * scale));
  const layerContext = layer.getContext("2d");
  if (!layerContext) return layer;

  const logicalWidth = layer.width / scale;
  const logicalHeight = layer.height / scale;
  layerContext.setTransform(scale, 0, 0, scale, 0, 0);
  layerContext.imageSmoothingEnabled = true;
  layerContext.imageSmoothingQuality = "high";
  layerContext.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    logicalWidth,
    logicalHeight,
  );

  // Two composited ramps produce a soft photographic edge without blurring
  // the face or paying for a per-pixel mask during animation.
  const featherX = clamp(logicalWidth * 0.205, 40, 126);
  const featherY = clamp(logicalHeight * 0.165, 38, 106);
  layerContext.globalCompositeOperation = "destination-in";
  const horizontalMask = layerContext.createLinearGradient(
    0,
    0,
    logicalWidth,
    0,
  );
  const horizontalFeather = featherX / logicalWidth;
  horizontalMask.addColorStop(0, "rgba(255,255,255,0)");
  horizontalMask.addColorStop(horizontalFeather * 0.44, "rgba(255,255,255,.3)");
  horizontalMask.addColorStop(horizontalFeather, "rgba(255,255,255,.84)");
  horizontalMask.addColorStop(horizontalFeather * 1.28, "rgba(255,255,255,1)");
  horizontalMask.addColorStop(
    1 - horizontalFeather * 1.28,
    "rgba(255,255,255,1)",
  );
  horizontalMask.addColorStop(1 - horizontalFeather, "rgba(255,255,255,.84)");
  horizontalMask.addColorStop(
    1 - horizontalFeather * 0.44,
    "rgba(255,255,255,.3)",
  );
  horizontalMask.addColorStop(1, "rgba(255,255,255,0)");
  layerContext.fillStyle = horizontalMask;
  layerContext.fillRect(0, 0, logicalWidth, logicalHeight);

  const verticalMask = layerContext.createLinearGradient(
    0,
    0,
    0,
    logicalHeight,
  );
  const verticalFeather = featherY / logicalHeight;
  verticalMask.addColorStop(0, "rgba(255,255,255,0)");
  verticalMask.addColorStop(verticalFeather * 0.44, "rgba(255,255,255,.3)");
  verticalMask.addColorStop(verticalFeather, "rgba(255,255,255,.84)");
  verticalMask.addColorStop(verticalFeather * 1.28, "rgba(255,255,255,1)");
  verticalMask.addColorStop(1 - verticalFeather * 1.28, "rgba(255,255,255,1)");
  verticalMask.addColorStop(1 - verticalFeather, "rgba(255,255,255,.84)");
  verticalMask.addColorStop(1 - verticalFeather * 0.44, "rgba(255,255,255,.3)");
  verticalMask.addColorStop(1, "rgba(255,255,255,0)");
  layerContext.fillStyle = verticalMask;
  layerContext.fillRect(0, 0, logicalWidth, logicalHeight);
  layerContext.globalCompositeOperation = "source-over";
  return layer;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function getWrappedLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);

  return lines;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 10,
) {
  const lines = getWrappedLines(context, text, maxWidth);

  lines.slice(0, maxLines).forEach((item, index) => {
    context.fillText(item, x, y + index * lineHeight);
  });

  return Math.min(lines.length, maxLines) * lineHeight;
}

function drawPill(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  accent = false,
  accentColor = "#fb923c",
) {
  context.font = '700 11px "Space Grotesk", sans-serif';
  const width = context.measureText(text).width + 24;
  roundedRect(context, x, y, width, 30, 999);
  context.fillStyle = accent
    ? colorWithAlpha(accentColor, 0.17)
    : "rgba(255,255,255,.055)";
  context.fill();
  context.strokeStyle = accent
    ? colorWithAlpha(accentColor, 0.42)
    : "rgba(255,255,255,.1)";
  context.stroke();
  context.fillStyle = accent ? accentColor : "#cbd5e1";
  context.textBaseline = "middle";
  context.fillText(text, x + 12, y + 15);
  context.textBaseline = "top";
  return width;
}

function drawImageFrame(
  context: CanvasRenderingContext2D,
  rect: ImageRect,
  alpha: number,
) {
  context.save();
  context.globalAlpha = alpha;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const radius = Math.max(rect.width, rect.height) * 0.68;
  const gradient = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    radius,
  );
  gradient.addColorStop(0, "rgba(8,47,73,.12)");
  gradient.addColorStop(0.58, "rgba(8,47,73,.045)");
  gradient.addColorStop(1, "rgba(3,7,18,0)");
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    rect.width * 0.62,
    rect.height * 0.62,
    0,
    0,
    Math.PI * 2,
  );
  context.fillStyle = gradient;
  context.fill();
  context.restore();
}

function buildAmbientNodes(width: number, height: number) {
  const spacing = width < 760 ? 86 : 96;
  const columns = Math.ceil(width / spacing);
  const rows = Math.ceil(height / spacing);
  const nodes: AmbientNode[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const presence = hashNoise(column * 3.7 + 4, row * 5.1 + 9);
      if (presence < 0.12) continue;
      const phase = hashNoise(column * 6.1, row * 9.7) * Math.PI * 2;
      const speed = 0.07 + hashNoise(column * 4.7, row * 7.9) * 0.11;
      const x =
        ((column + 0.2 + hashNoise(column + 2, row + 7) * 0.6) / columns) *
        width;
      const y =
        ((row + 0.2 + hashNoise(row + 11, column + 3) * 0.6) / rows) * height;
      nodes.push({
        x,
        y,
        homeX: x,
        homeY: y,
        vx: Math.cos(phase) * speed,
        vy: Math.sin(phase) * speed,
        size:
          getParticlePixelSize(width) *
          (0.82 + hashNoise(column * 8.3, row * 2.9) * 0.18),
        phase,
        warm: hashNoise(column * 11.3 + 2, row * 4.9 + 8) > 0.82,
        tether: 0,
      });
    }
  }

  return nodes;
}

function drawAmbientNetwork(
  context: CanvasRenderingContext2D,
  nodes: AmbientNode[],
  width: number,
  height: number,
  time: number,
  frameScale: number,
  pointer: { x: number; y: number; present: boolean },
  cloudPull: CloudPull | null,
) {
  const mouseRadius = width < 760 ? 130 : 185;
  const connectionRadius = width < 760 ? 150 : 188;
  const minimumSeparation = width < 760 ? 38 : 48;

  nodes.forEach((node) => {
    const wanderAngle =
      node.phase +
      Math.sin(time * 0.00017 + node.phase) * 1.7 +
      Math.cos(time * 0.00011 - node.phase) * 0.75;
    const wanderSpeed =
      0.08 + (Math.sin(time * 0.00023 + node.phase) + 1) * 0.055;
    node.vx +=
      (Math.cos(wanderAngle) * wanderSpeed - node.vx) * 0.009 * frameScale;
    node.vy +=
      (Math.sin(wanderAngle) * wanderSpeed - node.vy) * 0.009 * frameScale;

    let targetTether = 0;
    if (cloudPull && cloudPull.strength > 0.001) {
      const pullX = cloudPull.x - node.x;
      const pullY = cloudPull.y - node.y;
      const pullDistance = Math.sqrt(pullX * pullX + pullY * pullY) || 1;
      const proximity = smoothstep(
        cloudPull.radius,
        cloudPull.radius * 0.08,
        pullDistance,
      );
      targetTether = proximity * cloudPull.strength;
    }
    const tetherEase = targetTether > node.tether ? 0.24 : 0.035;
    node.tether = lerp(
      node.tether,
      targetTether,
      clamp(tetherEase * frameScale, 0, 1),
    );

    if (cloudPull && node.tether > 0.001) {
      const pullX = cloudPull.x - node.x;
      const pullY = cloudPull.y - node.y;
      const pullDistance = Math.sqrt(pullX * pullX + pullY * pullY) || 1;
      const inwardX = pullX / pullDistance;
      const inwardY = pullY / pullDistance;
      const pullForce = node.tether * frameScale;
      const lateralSpread = Math.sin(node.phase * 2.37) * 0.082;
      node.vx +=
        (cloudPull.directionX * 0.205 +
          inwardX * 0.026 -
          cloudPull.directionY * lateralSpread) *
        pullForce;
      node.vy +=
        (cloudPull.directionY * 0.205 +
          inwardY * 0.026 +
          cloudPull.directionX * lateralSpread) *
        pullForce;
    }

    let homeDx = node.homeX - node.x;
    let homeDy = node.homeY - node.y;
    if (Math.abs(homeDx) > width / 2) homeDx -= Math.sign(homeDx) * width;
    if (Math.abs(homeDy) > height / 2) homeDy -= Math.sign(homeDy) * height;
    const homeStrength = lerp(0.0024, 0.00032, node.tether) * frameScale;
    node.vx += homeDx * homeStrength;
    node.vy += homeDy * homeStrength;

    if (pointer.present) {
      const dx = node.x - pointer.x;
      const dy = node.y - pointer.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = smoothstep(mouseRadius, 0, distance);
      if (force > 0) {
        const normalX = dx / distance;
        const normalY = dy / distance;
        node.vx += (normalX * 0.075 - normalY * 0.026) * force * frameScale;
        node.vy += (normalY * 0.075 + normalX * 0.026) * force * frameScale;
      }
    }

    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    const maximumSpeed = (pointer.present ? 0.82 : 0.34) + node.tether * 1.62;
    if (speed > maximumSpeed) {
      node.vx = (node.vx / speed) * maximumSpeed;
      node.vy = (node.vy / speed) * maximumSpeed;
    }

    node.x += node.vx * frameScale;
    node.y += node.vy * frameScale;
    if (node.x < -12) node.x = width + 12;
    if (node.x > width + 12) node.x = -12;
    if (node.y < -12) node.y = height + 12;
    if (node.y > height + 12) node.y = -12;
  });

  // Resolve compression after the pull. This positional correction guarantees
  // that the wake can bend the field without collapsing every node into the
  // portrait center and emptying the rest of the viewport.
  for (let index = 0; index < nodes.length; index += 1) {
    const start = nodes[index];
    for (let nextIndex = index + 1; nextIndex < nodes.length; nextIndex += 1) {
      const end = nodes[nextIndex];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= minimumSeparation * minimumSeparation) continue;
      const fallbackAngle = start.phase - end.phase;
      const distance = Math.sqrt(distanceSquared) || 1;
      const normalX =
        distanceSquared > 0 ? dx / distance : Math.cos(fallbackAngle);
      const normalY =
        distanceSquared > 0 ? dy / distance : Math.sin(fallbackAngle);
      const overlap = minimumSeparation - (distanceSquared > 0 ? distance : 0);
      const correction = overlap * clamp(frameScale * 0.3, 0.18, 0.46);
      start.x -= normalX * correction;
      start.y -= normalY * correction;
      end.x += normalX * correction;
      end.y += normalY * correction;
      const repulsion = (overlap / minimumSeparation) * 0.12 * frameScale;
      start.vx -= normalX * repulsion;
      start.vy -= normalY * repulsion;
      end.vx += normalX * repulsion;
      end.vy += normalY * repulsion;
    }
  }

  const maximumHomeDisplacement = width < 760 ? 76 : 128;
  nodes.forEach((node) => {
    let displacementX = node.x - node.homeX;
    let displacementY = node.y - node.homeY;
    if (Math.abs(displacementX) > width / 2) {
      displacementX -= Math.sign(displacementX) * width;
    }
    if (Math.abs(displacementY) > height / 2) {
      displacementY -= Math.sign(displacementY) * height;
    }
    const displacement = Math.hypot(displacementX, displacementY);
    if (displacement <= maximumHomeDisplacement) return;
    const leash = maximumHomeDisplacement / displacement;
    node.x = node.homeX + displacementX * leash;
    node.y = node.homeY + displacementY * leash;
    node.vx *= 0.72;
    node.vy *= 0.72;
  });

  context.save();
  context.lineWidth = width < 760 ? 1 : 1.25;
  for (let index = 0; index < nodes.length; index += 1) {
    const start = nodes[index];
    for (let nextIndex = index + 1; nextIndex < nodes.length; nextIndex += 1) {
      const end = nodes[nextIndex];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > connectionRadius) continue;

      const midpointX = (start.x + end.x) / 2;
      const midpointY = (start.y + end.y) / 2;
      const pointerDistance = pointer.present
        ? Math.hypot(midpointX - pointer.x, midpointY - pointer.y)
        : 999;
      const pointerBoost = pointer.present
        ? smoothstep(300, 0, pointerDistance) * 0.09
        : 0;
      const tetherStrength = Math.max(start.tether, end.tether);
      const tetherGlow = tetherStrength * 0.115;
      const alpha =
        (1 - distance / connectionRadius) * 0.16 + pointerBoost + tetherGlow;

      const warmLine = start.warm || end.warm;
      context.lineWidth = (width < 760 ? 1 : 1.25) + tetherStrength * 0.72;
      context.strokeStyle = warmLine
        ? `rgba(205,163,132,${alpha * 0.72})`
        : `rgba(123,205,219,${alpha})`;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  }

  nodes.forEach((node, index) => {
    const pulse = 0.78 + Math.sin(time * 0.0012 + nodes[index].phase) * 0.18;
    context.fillStyle = node.warm
      ? `rgba(205,163,132,${0.34 * pulse})`
      : `rgba(148,210,224,${0.36 * pulse})`;
    context.fillRect(
      node.x - node.size / 2,
      node.y - node.size / 2,
      node.size,
      node.size,
    );
  });
  context.restore();
}

function drawPortraitConnections(
  context: CanvasRenderingContext2D,
  particles: Point[],
  ambientNodes: AmbientNode[],
  width: number,
  pointer: { x: number; y: number; active: boolean; present: boolean },
  editorialReveal = 0,
  density = 1,
) {
  const candidates: Point[] = [];
  const edgeCandidates: Point[] = [];
  const connectionRadius = width < 760 ? 126 : 166;
  const bridgeRadius = width < 760 ? 220 : 310;
  const candidateLimit = Math.round(48 + 112 * density);
  const edgeCandidateLimit = Math.round(20 + 52 * density);

  const sampleCount = Math.min(particles.length, 2400);
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const particle = particles[(sample * 421) % particles.length];
    const visibleAlpha = Math.max(
      particle.alpha,
      editorialReveal * particle.edgeMotion * 0.82,
    );
    if (visibleAlpha < 0.08) continue;
    if (candidates.length < candidateLimit) candidates.push(particle);
    if (
      particle.edgeMotion > 0.18 &&
      edgeCandidates.length < edgeCandidateLimit
    ) {
      edgeCandidates.push(particle);
    }
    if (
      candidates.length >= candidateLimit &&
      edgeCandidates.length >= edgeCandidateLimit
    )
      break;
  }

  context.save();
  context.lineWidth = width < 760 ? 1 : 1.25;
  for (let index = 0; index < candidates.length; index += 1) {
    const start = candidates[index];
    let connections = 0;
    for (
      let nextIndex = index + 1;
      nextIndex < candidates.length;
      nextIndex += 1
    ) {
      const end = candidates[nextIndex];
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      if (distance > connectionRadius) continue;
      const cursorDistance = Math.hypot(
        (start.x + end.x) / 2 - pointer.x,
        (start.y + end.y) / 2 - pointer.y,
      );
      const reveal = pointer.active ? smoothstep(240, 18, cursorDistance) : 0;
      const alpha =
        ((1 - distance / connectionRadius) * 0.17 + reveal * 0.19) *
        lerp(
          1,
          clamp(Math.max(start.edgeMotion, end.edgeMotion) * 2.1, 0, 1),
          editorialReveal,
        );
      if (alpha < 0.012) continue;

      context.strokeStyle = `rgba(123,205,219,${alpha})`;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      connections += 1;
      if (connections === 3) break;
    }
  }

  context.lineWidth = width < 760 ? 1.05 : 1.4;
  for (const node of ambientNodes) {
    const nearest: Array<{ particle: Point; distance: number }> = [];
    for (const particle of edgeCandidates) {
      const dx = particle.x - node.x;
      const dy = particle.y - node.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > bridgeRadius * bridgeRadius) continue;
      const distance = Math.sqrt(distanceSquared);
      if (nearest.length < 2) {
        nearest.push({ particle, distance });
        nearest.sort((a, b) => a.distance - b.distance);
      } else if (distance < nearest[1].distance) {
        nearest[1] = { particle, distance };
        nearest.sort((a, b) => a.distance - b.distance);
      }
    }

    for (const connection of nearest) {
      const particle = connection.particle;
      const midpointX = (node.x + particle.x) / 2;
      const midpointY = (node.y + particle.y) / 2;
      const cursorDistance = pointer.present
        ? Math.hypot(midpointX - pointer.x, midpointY - pointer.y)
        : 999;
      const mouseBoost = pointer.present
        ? smoothstep(300, 20, cursorDistance) * 0.13
        : 0;
      const alpha =
        (1 - connection.distance / bridgeRadius) * 0.2 +
        mouseBoost +
        node.tether * 0.12;
      if (alpha < 0.015) continue;

      context.strokeStyle = node.warm
        ? `rgba(205,163,132,${alpha * 0.78})`
        : `rgba(123,205,219,${alpha})`;
      context.beginPath();
      context.moveTo(node.x, node.y);
      context.lineTo(particle.x, particle.y);
      context.stroke();
    }
  }
  context.restore();
}

function getPanelMetrics(
  scene: PortfolioSection,
  width: number,
  height: number,
) {
  const mobile = width < 760;
  const panelWidth = mobile
    ? width * 0.9
    : width * clamp(scene.panelWidth / 100, 0.3, 0.48);
  const panelX = mobile
    ? width * 0.05
    : scene.imageSide === "left"
      ? width - width * 0.06 - panelWidth
      : width * 0.06;
  const panelY = mobile ? height * 0.61 : height * 0.18;
  const panelHeight = mobile ? height * 0.32 : height * 0.64;
  const padding = mobile ? 18 : 28;
  return {
    mobile,
    panelWidth,
    panelX,
    panelY,
    panelHeight,
    padding,
    contentX: panelX + padding,
    contentWidth: panelWidth - padding * 2,
  };
}

function drawSceneCopy(
  context: CanvasRenderingContext2D,
  scene: PortfolioSection,
  width: number,
  height: number,
  alpha: number,
  panelOnly = false,
) {
  if (alpha <= 0.01) return null;
  const {
    mobile,
    panelWidth,
    panelX,
    panelY,
    panelHeight,
    padding,
    contentX,
    contentWidth,
  } = getPanelMetrics(scene, width, height);

  context.save();
  context.globalAlpha = alpha;
  roundedRect(
    context,
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    mobile ? 22 : 30,
  );
  context.fillStyle = `rgba(6,10,23,${scene.panelOpacity / 100})`;
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.11)";
  context.stroke();

  context.fillStyle = "rgba(255,255,255,.04)";
  roundedRect(
    context,
    panelX + 7,
    panelY + 7,
    panelWidth - 14,
    panelHeight - 14,
    mobile ? 17 : 24,
  );
  context.strokeStyle = "rgba(255,255,255,.035)";
  context.stroke();

  if (panelOnly) {
    context.restore();
    return null;
  }

  drawPill(
    context,
    `${scene.index} / ${scene.label}`,
    contentX,
    panelY + padding,
    true,
    scene.typography.accentColor,
  );

  const configuredTitleSize = scene.typography.titleFontSize;
  let titleSize = mobile
    ? clamp(configuredTitleSize * 0.55, 20, 38)
    : clamp(configuredTitleSize * clamp(width / 1440, 0.78, 1.08), 28, 82);
  const maximumTitleLines = mobile ? 4 : 5;
  context.font = `800 ${titleSize}px "Syne", sans-serif`;
  while (
    titleSize > (mobile ? 19 : 34) &&
    getWrappedLines(context, scene.title, contentWidth).length >
      maximumTitleLines
  ) {
    titleSize -= 1;
    context.font = `800 ${titleSize}px "Syne", sans-serif`;
  }
  const titleLineHeight = titleSize * 0.91;
  context.fillStyle = scene.typography.titleColor;
  context.textBaseline = "top";
  const titleY = panelY + padding + 48;
  const titleHeight = drawWrappedText(
    context,
    scene.title,
    contentX,
    titleY,
    contentWidth,
    titleLineHeight,
    maximumTitleLines,
  );

  let bodyY = titleY + titleHeight + (mobile ? 8 : 20);
  const configuredBodySize = scene.typography.bodyFontSize;
  const bodySize = mobile
    ? clamp(configuredBodySize * 0.82, 11, 16)
    : clamp(configuredBodySize, 12, 24);
  context.font = `${bodySize}px "Space Grotesk", sans-serif`;
  context.fillStyle = scene.typography.bodyColor;
  const bodyHeight = drawWrappedText(
    context,
    scene.body,
    contentX,
    bodyY,
    contentWidth,
    mobile ? 18 : 24,
    mobile ? 2 : 4,
  );
  bodyY += bodyHeight + (mobile ? 10 : 22);

  if (!mobile) {
    scene.facts.forEach((fact, index) => {
      const factY = bodyY + index * 38;
      context.fillStyle =
        index === 0 ? scene.typography.accentColor : "#94a3b8";
      context.fillRect(contentX, factY + 7, 18, 1);
      context.font = '600 13px "Space Grotesk", sans-serif';
      context.fillStyle = "#dbe4ef";
      context.fillText(fact, contentX + 30, factY);
    });
  }

  let actionRegion: ImageRect | null = null;
  if (scene.action) {
    context.font = '700 12px "Space Grotesk", sans-serif';
    const actionWidth = context.measureText(scene.action).width + 28;
    const actionY = panelY + panelHeight - padding - 38;
    roundedRect(context, contentX, actionY, actionWidth, 38, 999);
    context.fillStyle = "rgba(34,211,238,.12)";
    context.fill();
    context.strokeStyle = "rgba(103,232,249,.3)";
    context.stroke();
    context.fillStyle = "#a5f3fc";
    context.textBaseline = "middle";
    context.fillText(scene.action, contentX + 14, actionY + 19);
    context.textBaseline = "top";
    actionRegion = { x: contentX, y: actionY, width: actionWidth, height: 38 };
  }

  context.restore();
  return actionRegion;
}

function drawChrome(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  activeScene: number,
  sceneProgress: number,
  time: number,
  timeSinceScroll: number,
  content: PortfolioContent,
) {
  const mobile = width < 760;
  const margin = mobile ? 18 : 34;
  context.save();
  context.textBaseline = "middle";
  context.font = '700 12px "Space Grotesk", sans-serif';
  context.fillStyle = "#f8fafc";
  context.fillText(content.brandName, margin, 29);
  context.font = '500 11px "Space Grotesk", sans-serif';
  context.fillStyle = "#64748b";
  context.fillText(content.role, margin + (mobile ? 106 : 126), 29);

  const railX = width - (mobile ? 10 : 16);
  const railY = mobile ? 88 : 102;
  const railHeight = height - railY - (mobile ? 30 : 42);
  const sectionCount = content.sections.length;
  const wrappedSceneProgress =
    sectionCount > 0
      ? ((sceneProgress % sectionCount) + sectionCount) % sectionCount
      : 0;
  // Use the same cyclic scale as the magnetic scroll. The remaining tail
  // after the last marker represents the last-to-first morph into a new loop.
  const railProgress =
    sectionCount <= 1 ? 0 : clamp(wrappedSceneProgress / sectionCount, 0, 1);
  const navRegions: ChromeNavRegion[] = [];
  const nearestScene = Math.round(sceneProgress);
  const nearestDistance = Math.abs(sceneProgress - nearestScene);
  const magneticPull = smoothstep(0.2, 0, nearestDistance);
  const activelyMoving = timeSinceScroll < 72;
  const arrivalLife = 1 - smoothstep(70, 760, timeSinceScroll);
  const magneticActivity = activelyMoving
    ? magneticPull
    : arrivalLife * magneticPull;
  const targetRailProgress =
    sectionCount <= 1 ? 0 : clamp(nearestScene / sectionCount, 0, 1);
  const targetY = railY + railHeight * targetRailProgress;
  const progressY = railY + railHeight * railProgress;

  context.font = `700 ${mobile ? 10 : 12}px "Space Grotesk", sans-serif`;
  context.fillStyle = "#cbd5e1";
  context.textAlign = "right";
  context.fillText("SCROLL TO DEFORM", railX - 8, railY - 24);

  context.fillStyle = "rgba(255,255,255,.1)";
  context.fillRect(railX, railY, 1, railHeight);
  context.fillStyle = "#22d3ee";
  context.fillRect(railX, railY, 1, railHeight * railProgress);

  if (magneticActivity > 0.01) {
    // A short luminous tether closes the final distance into the magnetic
    // stop. It becomes wider as the scroll point is captured.
    context.save();
    context.beginPath();
    context.moveTo(railX + 0.5, progressY);
    context.lineTo(railX + 0.5, targetY);
    context.strokeStyle = `rgba(103,232,249,${0.16 + magneticActivity * 0.5})`;
    context.lineWidth = 1 + magneticActivity * 2.2;
    context.stroke();

    const rotation = time * 0.004;
    const captureRadius = lerp(18, 9, magneticPull);
    context.lineWidth = 1.15;
    context.strokeStyle = `rgba(103,232,249,${0.18 + magneticActivity * 0.5})`;
    context.beginPath();
    context.arc(
      railX + 0.5,
      targetY,
      captureRadius,
      rotation,
      rotation + Math.PI * 0.72,
    );
    context.arc(
      railX + 0.5,
      targetY,
      captureRadius,
      rotation + Math.PI,
      rotation + Math.PI * 1.72,
    );
    context.stroke();

    if (!activelyMoving && arrivalLife > 0.01) {
      const rippleProgress = 1 - arrivalLife;
      context.beginPath();
      context.strokeStyle = `rgba(34,211,238,${arrivalLife * 0.34})`;
      context.lineWidth = 1;
      context.arc(
        railX + 0.5,
        targetY,
        9 + rippleProgress * 19,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    context.restore();
  }

  content.sections.forEach((scene, index) => {
    const stepProgress = sectionCount <= 1 ? 0 : index / sectionCount;
    const stepY = railY + railHeight * stepProgress;
    const active = index === activeScene;

    navRegions.push({
      index,
      rect: {
        x: railX - (mobile ? 54 : 62),
        y: stepY - 20,
        width: mobile ? 64 : 72,
        height: 40,
      },
    });

    if (active) {
      context.beginPath();
      context.fillStyle = "rgba(249,115,22,.15)";
      context.arc(railX + 0.5, stepY, 9, 0, Math.PI * 2);
      context.fill();
    }

    context.beginPath();
    context.fillStyle = "#07101f";
    context.strokeStyle = active ? "#fb923c" : "rgba(148,163,184,.55)";
    context.lineWidth = active ? 2 : 1;
    context.arc(railX + 0.5, stepY, active ? 5 : 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.font = `700 ${mobile ? 9 : 10}px "Space Grotesk", sans-serif`;
    context.fillStyle = active ? "#fdba74" : "#64748b";
    context.textAlign = "right";
    context.fillText(scene.index, railX - 12, stepY);
  });

  context.beginPath();
  context.fillStyle = "#22d3ee";
  context.arc(
    railX + 0.5,
    progressY,
    3 + magneticActivity * 1.5,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
  return navRegions;
}

type ParticlePortraitProps = {
  content?: PortfolioContent;
  onReady?: (target: ParticleHandoffTarget[]) => void;
  active?: boolean;
};

export function ParticlePortrait({
  content = DEFAULT_PORTFOLIO_CONTENT,
  onReady,
  active = true,
}: ParticlePortraitProps) {
  const scenes = content.sections;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const copyOverlayRefs = useRef<Array<HTMLDivElement | null>>([]);
  const copyScrollRefs = useRef<Array<HTMLDivElement | null>>([]);
  const interactiveCopySceneRef = useRef(-1);
  const pointsRef = useRef<Point[]>([]);
  const shapesRef = useRef<Point[][]>([]);
  const detailLayersRef = useRef<HTMLCanvasElement[]>([]);
  const editorialLayersRef = useRef<Array<HTMLCanvasElement | null>>([]);
  const editorialStrengthsRef = useRef<number[]>([]);
  const rectsRef = useRef<ImageRect[]>([]);
  const ambientNodesRef = useRef<AmbientNode[]>([]);
  const progressRef = useRef(0);
  const lastScrollAtRef = useRef(0);
  const pointerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    active: false,
    present: false,
    touch: false,
  });
  const burstRef = useRef({ x: 0, y: 0, startedAt: -10000 });
  const detailInteractionRef = useRef(1);
  const actionRef = useRef<{ rect: ImageRect; href: string } | null>(null);
  const navRegionsRef = useRef<ChromeNavRegion[]>([]);
  const statusRef = useRef<"loading" | "ready" | "missing">("loading");
  const activeRef = useRef(active);
  const activationStartedRef = useRef(active ? performance.now() : 0);

  useLayoutEffect(() => {
    if (active && !activeRef.current) {
      activationStartedRef.current = performance.now();
    }
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!context) return;

    let frameId = 0;
    let mounted = true;
    let buildVersion = 0;
    let previousFrameTime = performance.now();
    let lastRenderedAt = 0;
    let dormantPainted = false;

    const yieldToPaint = () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

    const resizeAndBuild = async () => {
      dormantPainted = false;
      const version = ++buildVersion;
      const bounds = host.getBoundingClientRect();
      const width = Math.max(320, Math.floor(bounds.width));
      const height = Math.max(320, Math.floor(bounds.height));
      const dpr = getParticleCanvasDpr(width, 1.75);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const results = await Promise.allSettled(
        scenes.map((scene) => loadImage(scene.image)),
      );
      if (!mounted || version !== buildVersion) return;
      const loaded = results.map((result) =>
        result.status === "fulfilled" ? result.value : null,
      );
      if (loaded.some((image) => image === null)) {
        statusRef.current = "missing";
        onReady?.([]);
        return;
      }

      const count = getPortraitParticleBudget(width);
      const pixelSize = getParticlePixelSize(width);
      const imageSlots = scenes.map((scene) =>
        getImageRect(scene, width, height),
      );
      const rects = loaded.map((image, index) =>
        getContainedImageRect(image!, imageSlots[index]),
      );
      let shapes: Point[][];
      let detailLayers: HTMLCanvasElement[];
      let editorialLayers: Array<HTMLCanvasElement | null>;
      try {
        shapes = [];
        detailLayers = [];
        editorialLayers = [];
        for (let index = 0; index < loaded.length; index += 1) {
          const image = loaded[index]!;
          const shape = buildPointsFromImage(
            image,
            rects[index],
            count,
            index + 1,
            pixelSize,
          );
          shapes.push(shape);
          detailLayers.push(
            buildParticleDetailLayer(image, rects[index], shape, dpr),
          );
          editorialLayers.push(
            buildEditorialImageLayer(image, rects[index], dpr),
          );
          if (index < loaded.length - 1) {
            await yieldToPaint();
            if (!mounted || version !== buildVersion) return;
          }
        }
      } catch {
        statusRef.current = "missing";
        onReady?.([]);
        return;
      }

      if (!mounted || version !== buildVersion) return;

      rectsRef.current = rects;
      ambientNodesRef.current = buildAmbientNodes(width, height);
      shapesRef.current = shapes;
      detailLayersRef.current = detailLayers;
      editorialLayersRef.current = editorialLayers;
      if (editorialStrengthsRef.current.length !== scenes.length) {
        editorialStrengthsRef.current = new Array(scenes.length).fill(0);
      }
      pointsRef.current = shapes[0].map((point) => ({ ...point }));
      statusRef.current = "ready";
      onReady?.(
        shapes[0].map(({ x, y, r, g, b, alpha, size }) => ({
          x,
          y,
          r,
          g,
          b,
          alpha,
          size,
        })),
      );
    };

    const updateScrollProgress = () => {
      lastScrollAtRef.current = performance.now();
      const block = document.querySelector<HTMLElement>(".scroll-loop-block");
      const blockHeight = block?.offsetHeight ?? 0;
      if (blockHeight <= 0) return;
      const local =
        ((window.scrollY % blockHeight) + blockHeight) % blockHeight;
      progressRef.current = local / blockHeight;
    };

    const hideCopyOverlays = () => {
      for (const element of copyOverlayRefs.current) {
        if (!element) continue;
        element.style.opacity = "0";
        element.style.pointerEvents = "none";
      }
    };

    const syncCopyOverlays = (
      width: number,
      height: number,
      currentIndex: number,
      nextIndex: number,
      currentAlpha: number,
      nextAlpha: number,
      translateY: number,
    ) => {
      const interactiveIndex =
        currentAlpha >= nextAlpha ? currentIndex : nextIndex;
      const interactiveAlpha = Math.max(currentAlpha, nextAlpha);

      if (
        interactiveAlpha > 0.72 &&
        interactiveIndex !== interactiveCopySceneRef.current
      ) {
        copyScrollRefs.current[interactiveIndex]?.scrollTo({ top: 0 });
        interactiveCopySceneRef.current = interactiveIndex;
      }

      scenes.forEach((scene, index) => {
        const element = copyOverlayRefs.current[index];
        if (!element) return;

        let alpha = 0;
        if (index === currentIndex) alpha = Math.max(alpha, currentAlpha);
        if (index === nextIndex) alpha = Math.max(alpha, nextAlpha);

        const metrics = getPanelMetrics(scene, width, height);
        const bodySize = metrics.mobile
          ? clamp(scene.typography.bodyFontSize * 0.82, 11, 16)
          : clamp(scene.typography.bodyFontSize, 12, 24);
        const titleSize = metrics.mobile
          ? clamp(scene.typography.titleFontSize * 0.55, 20, 38)
          : clamp(
              scene.typography.titleFontSize * clamp(width / 1440, 0.78, 1.08),
              28,
              82,
            );

        element.style.left = `${metrics.panelX}px`;
        element.style.top = `${metrics.panelY + translateY}px`;
        element.style.width = `${metrics.panelWidth}px`;
        element.style.height = `${metrics.panelHeight}px`;
        element.style.opacity = String(clamp(alpha, 0, 1));
        element.style.pointerEvents =
          activeRef.current &&
          index === interactiveIndex &&
          interactiveAlpha > 0.72
            ? "auto"
            : "none";
        element.style.borderRadius = metrics.mobile ? "22px" : "30px";
        element.style.setProperty("--copy-padding", `${metrics.padding}px`);
        element.style.setProperty("--copy-body-size", `${bodySize}px`);
        element.style.setProperty("--copy-title-size", `${titleSize}px`);
        element.style.setProperty(
          "--copy-body-color",
          scene.typography.bodyColor,
        );
        element.style.setProperty(
          "--copy-title-color",
          scene.typography.titleColor,
        );
        element.style.setProperty(
          "--copy-accent-color",
          scene.typography.accentColor,
        );
        element.style.setProperty(
          "--copy-pill-margin",
          metrics.mobile ? "10px" : "18px",
        );
        element.style.setProperty(
          "--copy-block-margin",
          metrics.mobile ? "6px" : "10px",
        );
        element.style.setProperty(
          "--copy-heading-margin",
          metrics.mobile ? "7px" : "12px",
        );
        element.style.setProperty(
          "--copy-list-item-margin",
          metrics.mobile ? "2px" : "5px",
        );
        element.style.setProperty(
          "--copy-pill-padding",
          metrics.mobile ? "4px 8px" : "5px 10px",
        );
        element.style.setProperty(
          "--copy-pill-size",
          metrics.mobile ? "9px" : "10px",
        );
        element.style.setProperty(
          "--copy-action-padding",
          metrics.mobile ? "8px 12px" : "10px 14px",
        );
        element.style.setProperty(
          "--copy-action-size",
          metrics.mobile ? "9px" : "12px",
        );
        element.style.setProperty(
          "--copy-image-height",
          metrics.mobile ? "72px" : "130px",
        );
      });
    };

    const render = (time = 0) => {
      const width = Math.max(320, Math.floor(host.clientWidth));
      const height = Math.max(320, Math.floor(host.clientHeight));
      if (!activeRef.current) {
        hideCopyOverlays();
        if (!dormantPainted) {
          const dormantBackground = context.createLinearGradient(
            0,
            0,
            width,
            height,
          );
          dormantBackground.addColorStop(0, "#03111c");
          dormantBackground.addColorStop(0.48, "#040817");
          dormantBackground.addColorStop(1, "#090611");
          context.fillStyle = dormantBackground;
          context.fillRect(0, 0, width, height);
          dormantPainted = true;
        }
        previousFrameTime = time;
        frameId = window.requestAnimationFrame(render);
        return;
      }
      dormantPainted = false;
      const pointerState = pointerRef.current;
      const burstAge = time - burstRef.current.startedAt;
      const recentInteraction =
        pointerState.active ||
        Math.abs(pointerState.vx) + Math.abs(pointerState.vy) > 0.35 ||
        time - lastScrollAtRef.current < 900 ||
        (burstAge >= 0 && burstAge < 900);
      const targetFrameInterval = recentInteraction ? 1000 / 60 : 1000 / 32;
      if (lastRenderedAt && time - lastRenderedAt < targetFrameInterval) {
        frameId = window.requestAnimationFrame(render);
        return;
      }
      const frameScale = clamp((time - previousFrameTime) / 16.67, 0.25, 2.5);
      previousFrameTime = time;
      lastRenderedAt = time;
      const progress = progressRef.current;
      const sceneProgress = getSnappedSceneProgress(progress, scenes.length);
      const currentIndex = Math.floor(sceneProgress) % scenes.length;
      const nextIndex = (currentIndex + 1) % scenes.length;
      const phase = sceneProgress - Math.floor(sceneProgress);
      const morphRaw = clamp((phase - 0.08) / 0.84, 0, 1);
      // Complete all geometry before the section boundary. The remaining
      // interval is an intentional full-particle hold, giving the animated
      // cloud time to converge to the exact sharp-image dimensions.
      const morphTravelRaw = clamp(morphRaw / 0.84, 0, 1);
      const morph = easeInOutCubic(morphTravelRaw);
      const destruction = Math.sin(morphTravelRaw * Math.PI);
      const timeSinceScroll = Math.max(0, time - lastScrollAtRef.current);
      const restingWaveAmount = smoothstep(180, 900, timeSinceScroll);
      const motionWaveAmount =
        lerp(0.48, 1, restingWaveAmount) * lerp(0.72, 1, 1 - destruction);
      const motionWaveOffset = Math.sin(time * 0.00054) * 0.7;
      const interfaceReveal = activeRef.current
        ? smoothstep(0, 1200, time - activationStartedRef.current)
        : 0;
      const connectionReveal = activeRef.current
        ? smoothstep(60, 760, time - activationStartedRef.current)
        : 0;

      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#03111c");
      background.addColorStop(0.48, "#040817");
      background.addColorStop(1, "#090611");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      const glowX = lerp(
        width * 0.18,
        width * 0.8,
        0.5 + Math.sin(time * 0.00014) * 0.5,
      );
      const glow = context.createRadialGradient(
        glowX,
        height * 0.3,
        0,
        glowX,
        height * 0.3,
        width * 0.42,
      );
      glow.addColorStop(0, "rgba(14,116,144,.10)");
      glow.addColorStop(1, "rgba(14,116,144,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const rects = rectsRef.current;
      let cloudPull: CloudPull | null = null;
      if (activeRef.current && rects.length === scenes.length) {
        const fromRect = rects[currentIndex];
        const toRect = rects[nextIndex];
        const fromX = fromRect.x + fromRect.width / 2;
        const fromY = fromRect.y + fromRect.height / 2;
        const toX = toRect.x + toRect.width / 2;
        const toY = toRect.y + toRect.height / 2;
        const travelX = toX - fromX;
        const travelY = toY - fromY;
        const travelDistance =
          Math.sqrt(travelX * travelX + travelY * travelY) || 1;
        cloudPull = {
          x: lerp(fromX, toX, morph),
          y: lerp(fromY, toY, morph),
          directionX: travelX / travelDistance,
          directionY: travelY / travelDistance,
          radius:
            width < 760
              ? Math.min(width * 0.92, 390)
              : Math.min(width * 0.46, 690),
          strength: Math.pow(destruction, 0.68),
        };
      }

      drawAmbientNetwork(
        context,
        ambientNodesRef.current,
        width,
        height,
        time,
        frameScale,
        pointerRef.current,
        cloudPull,
      );

      if (rects.length === scenes.length) {
        drawImageFrame(
          context,
          rects[currentIndex],
          (1 - morph) * interfaceReveal,
        );
        drawImageFrame(context, rects[nextIndex], morph * interfaceReveal);
      }

      // The sharp layer uses a long zero-velocity dissolve at both ends. The
      // completed particle portrait holds first, then detail arrives slowly
      // enough that there is no readable frame where the treatment switches.
      const settledSharpReveal = smootherstep(180, 1120, timeSinceScroll);
      const editorialStrengths = editorialStrengthsRef.current;
      const previousCurrentStrength = editorialStrengths[currentIndex] ?? 0;
      const currentEditorialTarget =
        phase <= 0.001
          ? settledSharpReveal * interfaceReveal
          : Math.min(
              previousCurrentStrength,
              (1 - smootherstep(0.008, 0.27, phase)) * interfaceReveal,
            );
      // Fallback for browsers that retain a larger fractional remainder even
      // after magnetic scrolling: morphRaw is already fully settled here, so
      // revealing the destination cannot expose an unfinished transition.
      const nextEditorialTarget =
        phase >= 0.98 ? settledSharpReveal * interfaceReveal : 0;
      for (let index = 0; index < editorialStrengths.length; index += 1) {
        let target = index === currentIndex ? currentEditorialTarget : 0;
        if (index === nextIndex) target = Math.max(target, nextEditorialTarget);
        const previous = editorialStrengths[index] ?? 0;
        const rate = target < previous ? 0.15 : 0.09;
        editorialStrengths[index] = lerp(
          previous,
          target,
          clamp(rate * frameScale, 0, 1),
        );
      }
      const currentEditorialReveal = editorialStrengths[currentIndex] ?? 0;
      const nextEditorialReveal = editorialStrengths[nextIndex] ?? 0;
      const editorialReveal = clamp(
        currentEditorialReveal + nextEditorialReveal,
        0,
        1,
      );
      const editorialLayers = editorialLayersRef.current;
      if (
        editorialLayers.length === scenes.length &&
        rects.length === scenes.length
      ) {
        context.save();
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        const currentLayer = editorialLayers[currentIndex];
        if (currentLayer && currentEditorialReveal > 0.025) {
          context.globalAlpha = currentEditorialReveal;
          const rect = rects[currentIndex];
          context.drawImage(
            currentLayer,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
          );
        }
        const nextLayer = editorialLayers[nextIndex];
        if (nextLayer && nextEditorialReveal > 0.025) {
          context.globalAlpha = nextEditorialReveal;
          const rect = rects[nextIndex];
          context.drawImage(nextLayer, rect.x, rect.y, rect.width, rect.height);
        }
        context.restore();
      }

      const shapes = shapesRef.current;
      const particles = pointsRef.current;
      if (
        activeRef.current &&
        statusRef.current === "ready" &&
        shapes.length === scenes.length &&
        particles.length
      ) {
        const from = shapes[currentIndex];
        const to = shapes[nextIndex];
        const pointer = pointerRef.current;
        const idleX = Math.sin(time * 0.00082);
        const idleY = Math.cos(time * 0.00067);
        const burst = burstRef.current;
        const burstProgress = (time - burst.startedAt) / 850;
        const burstActive = burstProgress >= 0 && burstProgress < 1;
        const burstRadius = burstProgress * 310;
        const particleMaterialization = smoothstep(
          0.015,
          0.92,
          interfaceReveal,
        );
        const routeStartRect = rects[currentIndex];
        const routeEndRect = rects[nextIndex];
        const edgeFrameX = lerp(routeStartRect.x, routeEndRect.x, morph);
        const edgeFrameY = lerp(routeStartRect.y, routeEndRect.y, morph);
        const edgeFrameWidth = lerp(
          routeStartRect.width,
          routeEndRect.width,
          morph,
        );
        const edgeFrameHeight = lerp(
          routeStartRect.height,
          routeEndRect.height,
          morph,
        );
        const routeDeltaX =
          routeEndRect.x +
          routeEndRect.width / 2 -
          (routeStartRect.x + routeStartRect.width / 2);
        const routeDeltaY =
          routeEndRect.y +
          routeEndRect.height / 2 -
          (routeStartRect.y + routeStartRect.height / 2);
        const routeDistance = Math.hypot(routeDeltaX, routeDeltaY);
        const routeDirectionX =
          routeDistance > 1 ? routeDeltaX / routeDistance : 1;
        const routeDirectionY =
          routeDistance > 1 ? routeDeltaY / routeDistance : 0;
        const routeNormalX = -routeDirectionY;
        const routeNormalY = routeDirectionX;
        const routeAmplitude = clamp(
          routeDistance * 0.18,
          width * 0.045,
          width * 0.115,
        );

        if (connectionReveal > 0.025) {
          context.save();
          context.globalAlpha = connectionReveal;
          drawPortraitConnections(
            context,
            particles,
            ambientNodesRef.current,
            width,
            pointer,
            editorialReveal,
            connectionReveal,
          );
          context.restore();
        }

        for (let index = 0; index < particles.length; index += 1) {
          const particle = particles[index];
          const start = from[index];
          const end = to[index];
          // Reveal a uniformly distributed subset while the destination
          // canvas wakes beneath the loader. This avoids one frame suddenly
          // inheriting the full portrait budget without producing a wipe.
          if (
            particleMaterialization < 0.999 &&
            ((index * 433) % particles.length) / particles.length >
              particleMaterialization
          )
            continue;
          const angle = start.scatterAngle;
          const distance = start.scatterDistance * destruction * 0.42;
          const wave =
            destruction > 0.001
              ? Math.sin(index * 0.031 + time * 0.0014) * destruction * 7
              : 0;
          const ambientDriftX = lerp(start.driftX, end.driftX, morph) * idleX;
          const ambientDriftY = lerp(start.driftY, end.driftY, morph) * idleY;
          const edgeMotion = lerp(start.edgeMotion, end.edgeMotion, morph);
          const edgeOrbitAngle = lerp(
            start.scatterAngle,
            end.scatterAngle,
            morph,
          );
          const edgeWaveStrength = lerp(0.18, 3.4, Math.pow(edgeMotion, 0.62));
          const edgeDriftStrength = lerp(
            1,
            lerp(0.4, 2.8, edgeMotion),
            motionWaveAmount,
          );
          // Stagger adjacent spatial bands, then send them through interlaced
          // curved lanes. Every lane resolves exactly onto the destination,
          // so the pattern never leaves residual offsets after the morph.
          const ribbonPhase = start.ribbonPhase;
          const ribbonDelay = start.ribbonDelay;
          const routeProgress = easeInOutCubic(
            clamp((morphTravelRaw - ribbonDelay) / (1 - ribbonDelay), 0, 1),
          );
          const routeEnvelope = Math.sin(routeProgress * Math.PI);
          const ribbonWave = Math.sin(
            ribbonPhase + routeProgress * Math.PI * 3.5,
          );
          const longitudinalWave = Math.cos(
            ribbonPhase * 0.62 - routeProgress * Math.PI * 2,
          );
          const baseX =
            lerp(start.tx, end.tx, routeProgress) +
            routeNormalX * ribbonWave * routeAmplitude * routeEnvelope +
            routeDirectionX *
              longitudinalWave *
              routeAmplitude *
              0.16 *
              routeEnvelope;
          const baseY =
            lerp(start.ty, end.ty, routeProgress) +
            routeNormalY * ribbonWave * routeAmplitude * routeEnvelope +
            routeDirectionY *
              longitudinalWave *
              routeAmplitude *
              0.16 *
              routeEnvelope;
          const editorialU = clamp((baseX - edgeFrameX) / edgeFrameWidth, 0, 1);
          const editorialV = clamp(
            (baseY - edgeFrameY) / edgeFrameHeight,
            0,
            1,
          );
          const editorialEdgeDistance = Math.min(
            editorialU,
            1 - editorialU,
            editorialV,
            1 - editorialV,
          );
          // Keep one geometric envelope in both full-particle and sharp modes;
          // otherwise restoring the boundary fragments makes the image appear
          // to change size during the photographic dissolve.
          const editorialEdgeBand =
            1 - smoothstep(0.018, 0.305, editorialEdgeDistance);
          const edgePresence = 1;
          const activeEdgeMotion = Math.max(
            edgeMotion,
            editorialEdgeBand * edgePresence,
          );
          const motionWave =
            motionWaveAmount > 0.001
              ? Math.sin(
                  baseX * 0.014 +
                    baseY * 0.009 -
                    time * 0.00225 +
                    motionWaveOffset,
                ) * motionWaveAmount
              : 0;
          let targetX =
            baseX +
            Math.cos(angle) * distance +
            wave +
            ambientDriftX * edgeDriftStrength +
            motionWave * 2.4 * edgeWaveStrength;
          let targetY =
            baseY +
            Math.sin(angle) * distance +
            ambientDriftY * edgeDriftStrength +
            motionWave * 6.2 * edgeWaveStrength;
          if (editorialEdgeBand > 0.001) {
            // This orbit belongs to the shared particle envelope—not to the
            // photographic layer. Interpolating its phase means the final
            // transition frame and first settled frame are geometrically
            // identical, even though the scene indices change there.
            const editorialOrbit =
              time * 0.00042 + edgeOrbitAngle + index * 0.0021;
            const editorialPulse =
              (3.2 + ((index * 29) % 17) * 0.28) * editorialEdgeBand;
            targetX += Math.cos(editorialOrbit) * editorialPulse;
            targetY += Math.sin(editorialOrbit * 1.13) * editorialPulse * 1.18;
          }
          let interaction = 0;

          if (pointer.active) {
            const distortion = getParticlePointerDistortion(
              particle.x,
              particle.y,
              time,
              width,
              pointer,
            );
            targetX += distortion.x;
            targetY += distortion.y;
            interaction = distortion.force;
          }

          if (burstActive) {
            const burstDx = particle.x - burst.x;
            const burstDy = particle.y - burst.y;
            const burstDistance =
              Math.sqrt(burstDx * burstDx + burstDy * burstDy) || 1;
            const ringDistance = Math.abs(burstDistance - burstRadius);
            const ringForce =
              smoothstep(34, 0, ringDistance) * (1 - burstProgress);
            targetX += (burstDx / burstDistance) * ringForce * 76;
            targetY += (burstDy / burstDistance) * ringForce * 76;
            interaction = Math.max(interaction, ringForce);
          }

          const settledAtStart = morphRaw <= 0.001;
          const settleCatchup = settledAtStart
            ? smoothstep(0, 260, timeSinceScroll)
            : 0;
          const destinationCatchup = smoothstep(0.74, 0.92, morphRaw);
          const positionEase = Math.max(
            lerp(0.19, 0.38, settleCatchup),
            lerp(0.19, 0.36, destinationCatchup),
          );
          particle.x += (targetX - particle.x) * positionEase;
          particle.y += (targetY - particle.y) * positionEase;
          const destinationLock = smootherstep(0.88, 0.985, morphRaw);
          if (destinationLock > 0) {
            particle.x = lerp(particle.x, targetX, destinationLock);
            particle.y = lerp(particle.y, targetY, destinationLock);
          }
          particle.r = settledAtStart
            ? start.r
            : Math.round(lerp(start.r, end.r, morph));
          particle.g = settledAtStart
            ? start.g
            : Math.round(lerp(start.g, end.g, morph));
          particle.b = settledAtStart
            ? start.b
            : Math.round(lerp(start.b, end.b, morph));
          particle.alpha = settledAtStart
            ? start.alpha
            : lerp(start.alpha, end.alpha, morph) * (1 - destruction * 0.12);
          particle.size = lerp(start.size, end.size, morph);
          particle.edgeMotion = activeEdgeMotion;
          const fragmentNoise = ((index * 47) % 101) / 100;
          const edgeFragmentVisible =
            fragmentNoise < lerp(0.52, 0.985, editorialEdgeBand);
          const renderedSize =
            particle.size *
            (1 + interaction * 0.35) *
            (1 +
              edgePresence * editorialEdgeBand * (0.24 + fragmentNoise * 0.44));
          // In editorial mode, preserve a living particle perimeter while the
          // clean source carries fine facial detail through the cloud centre.
          const editorialParticleMask = clamp(
            Math.max(edgeMotion, editorialEdgeBand) * 1.9 + 0.05,
            0,
            1,
          );
          const baseRenderedAlpha = clamp(
            particle.alpha *
              interfaceReveal *
              lerp(1, editorialParticleMask, editorialReveal),
            0,
            1,
          );
          const editorialEdgeAlpha = edgeFragmentVisible
            ? interfaceReveal *
              edgePresence *
              Math.pow(editorialEdgeBand, 0.72) *
              (0.52 + fragmentNoise * 0.46)
            : 0;
          const renderedAlpha = Math.max(baseRenderedAlpha, editorialEdgeAlpha);

          context.fillStyle =
            settledAtStart &&
            interfaceReveal >= 0.999 &&
            editorialReveal < 0.001
              ? start.color
              : `rgba(${particle.r},${particle.g},${particle.b},${renderedAlpha})`;
          context.fillRect(
            particle.x - renderedSize * 0.5,
            particle.y - renderedSize * 0.5,
            renderedSize,
            renderedSize,
          );
        }

        // Blend high-frequency source detail over the same particle mask. It
        // is visible at settled endpoints and yields during morphs or direct
        // manipulation, where a static texture would otherwise leave ghosts.
        const detailLayers = detailLayersRef.current;
        if (detailLayers.length === scenes.length) {
          const detailReveal = smoothstep(
            180,
            980,
            time - activationStartedRef.current,
          );
          const detailTarget = pointer.active ? 0.52 : burstActive ? 0.3 : 1;
          detailInteractionRef.current = lerp(
            detailInteractionRef.current,
            detailTarget,
            clamp(
              (detailTarget < detailInteractionRef.current ? 0.16 : 0.075) *
                frameScale,
              0,
              1,
            ),
          );
          const interactionAlpha = detailInteractionRef.current;
          const currentDetailAlpha =
            (1 - smoothstep(0, 0.3, morphRaw)) *
            0.76 *
            detailReveal *
            interactionAlpha *
            (1 - currentEditorialReveal);
          const nextDetailAlpha =
            smoothstep(0.7, 1, morphRaw) *
            0.76 *
            detailReveal *
            interactionAlpha *
            (1 - nextEditorialReveal);
          context.save();
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          if (currentDetailAlpha > 0.025) {
            context.globalAlpha = currentDetailAlpha;
            const currentRect = rects[currentIndex];
            context.drawImage(
              detailLayers[currentIndex],
              currentRect.x,
              currentRect.y,
              currentRect.width,
              currentRect.height,
            );
          }
          if (nextDetailAlpha > 0.025) {
            context.globalAlpha = nextDetailAlpha;
            const nextRect = rects[nextIndex];
            context.drawImage(
              detailLayers[nextIndex],
              nextRect.x,
              nextRect.y,
              nextRect.width,
              nextRect.height,
            );
          }
          context.restore();
        }

        pointer.vx *= 0.9;
        pointer.vy *= 0.9;

        if (pointer.active) {
          context.save();
          context.strokeStyle = "rgba(103,232,249,.32)";
          context.lineWidth = 1;
          context.beginPath();
          context.arc(
            pointer.x,
            pointer.y,
            (pointer.touch ? 23 : 17) + Math.sin(time * 0.004) * 2,
            0,
            Math.PI * 2,
          );
          context.stroke();
          context.fillStyle = "rgba(251,146,60,.75)";
          context.fillRect(pointer.x - 1, pointer.y - 1, 2, 2);
          context.restore();
        }
      }

      const currentCopyAlpha =
        (1 - clamp(morphRaw * 3.2, 0, 1)) * interfaceReveal;
      const nextCopyAlpha = smootherstep(0.8, 0.94, morphRaw) * interfaceReveal;
      const copyTranslateY = (1 - interfaceReveal) * 18;
      actionRef.current = null;
      context.save();
      context.translate(0, copyTranslateY);
      drawSceneCopy(
        context,
        scenes[currentIndex],
        width,
        height,
        currentCopyAlpha,
        true,
      );
      drawSceneCopy(
        context,
        scenes[nextIndex],
        width,
        height,
        nextCopyAlpha,
        true,
      );
      context.restore();
      syncCopyOverlays(
        width,
        height,
        currentIndex,
        nextIndex,
        currentCopyAlpha,
        nextCopyAlpha,
        copyTranslateY,
      );

      if (activeRef.current && statusRef.current === "loading") {
        context.font = '600 12px "Space Grotesk", sans-serif';
        context.fillStyle = "#94a3b8";
        context.fillText(
          "CROPPING SOURCE IMAGES / BUILDING PARTICLES…",
          34,
          height - 58,
        );
      } else if (activeRef.current && statusRef.current === "missing") {
        context.font = '600 14px "Space Grotesk", sans-serif';
        context.fillStyle = "#fda4af";
        context.fillText(
          "A canvas source image could not be loaded.",
          34,
          height - 58,
        );
      }

      navRegionsRef.current = [];
      if (interfaceReveal > 0) {
        context.save();
        context.globalAlpha = interfaceReveal;
        const displayIndex = morphRaw >= 0.82 ? nextIndex : currentIndex;
        navRegionsRef.current = drawChrome(
          context,
          width,
          height,
          displayIndex,
          sceneProgress,
          time,
          timeSinceScroll,
          content,
        );
        context.restore();
      }
      frameId = window.requestAnimationFrame(render);
    };

    let touchReleaseTimer = 0;

    const setPointerPosition = (
      clientX: number,
      clientY: number,
      touch: boolean,
    ) => {
      const rect = host.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const pointer = pointerRef.current;
      const vx = pointer.present ? lerp(pointer.vx, x - pointer.x, 0.42) : 0;
      const vy = pointer.present ? lerp(pointer.vy, y - pointer.y, 0.42) : 0;
      const sceneProgress = getSnappedSceneProgress(
        progressRef.current,
        scenes.length,
      );
      const currentIndex = Math.floor(sceneProgress) % scenes.length;
      const nextIndex = (currentIndex + 1) % scenes.length;
      const phase = sceneProgress - Math.floor(sceneProgress);
      const morphRaw = clamp((phase - 0.08) / 0.84, 0, 1);
      const morph = easeInOutCubic(clamp(morphRaw / 0.84, 0, 1));
      const currentRect = rectsRef.current[currentIndex];
      const nextRect = rectsRef.current[nextIndex];
      const particleRect =
        currentRect && nextRect
          ? {
              x: lerp(currentRect.x, nextRect.x, morph),
              y: lerp(currentRect.y, nextRect.y, morph),
              width: lerp(currentRect.width, nextRect.width, morph),
              height: lerp(currentRect.height, nextRect.height, morph),
            }
          : null;
      const interactionPadding = touch ? 64 : 34;
      const overParticles = Boolean(
        particleRect &&
        x >= particleRect.x - interactionPadding &&
        x <= particleRect.x + particleRect.width + interactionPadding &&
        y >= particleRect.y - interactionPadding &&
        y <= particleRect.y + particleRect.height + interactionPadding,
      );
      pointerRef.current = {
        x,
        y,
        vx,
        vy,
        active: overParticles,
        present: true,
        touch,
      };
      const action = actionRef.current;
      const overAction = Boolean(
        action &&
        x >= action.rect.x &&
        x <= action.rect.x + action.rect.width &&
        y >= action.rect.y &&
        y <= action.rect.y + action.rect.height,
      );
      const overNavigation = navRegionsRef.current.some(
        ({ rect: navRect }) =>
          x >= navRect.x &&
          x <= navRect.x + navRect.width &&
          y >= navRect.y &&
          y <= navRect.y + navRect.height,
      );
      document.body.style.cursor = touch
        ? "default"
        : overAction || overNavigation
          ? "pointer"
          : overParticles
            ? "crosshair"
            : "default";
    };

    const pointerPosition = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = event.target as Element | null;
      if (target?.closest(".particle-portrait-copy-overlay")) {
        pointerRef.current.active = false;
        pointerRef.current.present = false;
        document.body.style.cursor = "default";
        return;
      }
      setPointerPosition(event.clientX, event.clientY, false);
    };

    const touchPosition = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      window.clearTimeout(touchReleaseTimer);
      setPointerPosition(touch.clientX, touch.clientY, true);
    };

    const touchEnd = () => {
      window.clearTimeout(touchReleaseTimer);
      touchReleaseTimer = window.setTimeout(pointerLeave, 190);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".particle-portrait-copy-overlay")) return;

      const action = actionRef.current;
      const rect = host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (
        action &&
        x >= action.rect.x &&
        x <= action.rect.x + action.rect.width &&
        y >= action.rect.y &&
        y <= action.rect.y + action.rect.height
      ) {
        window.open(action.href, "_blank", "noopener,noreferrer");
        return;
      }

      const navigationTarget = navRegionsRef.current.find(
        ({ rect: navRect }) =>
          x >= navRect.x &&
          x <= navRect.x + navRect.width &&
          y >= navRect.y &&
          y <= navRect.y + navRect.height,
      );
      if (navigationTarget) {
        window.dispatchEvent(
          new CustomEvent("portfolio:navigate-section", {
            detail: { index: navigationTarget.index },
          }),
        );
        return;
      }

      if (pointerRef.current.active) {
        burstRef.current = { x, y, startedAt: performance.now() };
      }
    };

    const pointerLeave = () => {
      pointerRef.current.active = false;
      pointerRef.current.present = false;
      document.body.style.cursor = "default";
    };

    void resizeAndBuild();
    updateScrollProgress();
    frameId = window.requestAnimationFrame(render);
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", resizeAndBuild);
    window.addEventListener("pointermove", pointerPosition, { passive: true });
    window.addEventListener("touchstart", touchPosition, { passive: true });
    window.addEventListener("touchmove", touchPosition, { passive: true });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", touchEnd, { passive: true });
    window.addEventListener("blur", pointerLeave);
    window.addEventListener("click", handleClick);

    return () => {
      mounted = false;
      window.clearTimeout(touchReleaseTimer);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", resizeAndBuild);
      window.removeEventListener("pointermove", pointerPosition);
      window.removeEventListener("touchstart", touchPosition);
      window.removeEventListener("touchmove", touchPosition);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchEnd);
      window.removeEventListener("blur", pointerLeave);
      window.removeEventListener("click", handleClick);
      document.body.style.cursor = "default";
    };
  }, [content, onReady, scenes]);

  return (
    <div
      ref={hostRef}
      className="particle-portrait-shell"
      style={{ position: "relative" }}
    >
      <canvas ref={canvasRef} className="particle-portrait-canvas" />

      {scenes.map((scene, index) => (
        <div
          key={`${scene.index}-${index}`}
          ref={(element) => {
            copyOverlayRefs.current[index] = element;
          }}
          className="particle-portrait-copy-overlay"
          aria-hidden={!active}
        >
          <div
            ref={(element) => {
              copyScrollRefs.current[index] = element;
            }}
            className="particle-portrait-copy-scroll "
            tabIndex={active ? 0 : -1}
            onWheel={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            dangerouslySetInnerHTML={{
              __html: sanitizeRichText(scene.contentHtml),
            }}
          />
        </div>
      ))}

      <style>{`
        .particle-portrait-copy-overlay {
          position: absolute;
          z-index: 3;
          overflow: hidden;
          opacity: 0;
          will-change: left, top, width, height, opacity;
        }
        .particle-portrait-copy-scroll h2{
          position: sticky;
          top: 0;
          z-index: 10;
          background: #060a17;
          padding-bottom: 12px;
        }

        .particle-portrait-copy-scroll {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          touch-action: pan-y;
          scrollbar-gutter: stable;
          padding: var(--copy-padding, 28px);
          color: var(--copy-body-color, #cbd5e1);
          font: 500 var(--copy-body-size, 16px) / 1.45
            "Space Grotesk", Arial, sans-serif;
          -webkit-overflow-scrolling: touch;
        }

        .particle-portrait-copy-scroll:focus {
          outline: none;
        }

        .particle-portrait-copy-scroll * {
          box-sizing: border-box;
        }

        .particle-portrait-copy-scroll p {
          margin: 0 0 var(--copy-block-margin, 10px);
        }

        .particle-portrait-copy-scroll h1,
        .particle-portrait-copy-scroll h2,
        .particle-portrait-copy-scroll h3,
        .particle-portrait-copy-scroll h4 {
          margin: 0 0 var(--copy-heading-margin, 12px);
          color: var(--copy-title-color, #f8fafc);
          font-family: "Syne", Arial, sans-serif;
          line-height: 0.98;
        }

        .particle-portrait-copy-scroll h1 {
          font-size: var(--copy-title-size, 48px);
          font-weight: 800;
        }

        .particle-portrait-copy-scroll h2 {
          font-size: max(
            calc(var(--copy-body-size, 16px) * 1.8),
            calc(var(--copy-title-size, 48px) * 0.58)
          );
        }

        .particle-portrait-copy-scroll h3 {
          font-size: max(
            calc(var(--copy-body-size, 16px) * 1.35),
            calc(var(--copy-title-size, 48px) * 0.4)
          );
        }

        .particle-portrait-copy-scroll h4 {
          font-size: 1.12em;
        }

        .particle-portrait-copy-scroll > p:first-child {
          display: inline-block;
          margin-bottom: var(--copy-pill-margin, 18px);
          border: 1px solid rgba(251, 146, 60, 0.28);
          border-radius: 999px;
          padding: var(--copy-pill-padding, 5px 10px);
          color: var(--copy-accent-color, #fb923c);
          background: rgba(251, 146, 60, 0.09);
          font-size: var(--copy-pill-size, 10px);
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .particle-portrait-copy-scroll ul,
        .particle-portrait-copy-scroll ol {
          margin: 0 0 10px;
          padding-left: 20px;
        }

        .particle-portrait-copy-scroll li {
          margin: 0 0 var(--copy-list-item-margin, 5px);
        }

        .particle-portrait-copy-scroll blockquote {
          margin: 0 0 10px;
          padding-left: 12px;
          border-left: 2px solid var(--copy-accent-color, #fb923c);
        }

        .particle-portrait-copy-scroll a {
          color: var(--copy-accent-color, #fb923c);
          text-decoration: none;
          cursor: pointer;
        }

        .particle-portrait-copy-scroll > p:last-child > a:only-child {
          display: inline-block;
          margin-top: 8px;
          border: 1px solid rgba(103, 232, 249, 0.3);
          border-radius: 999px;
          padding: var(--copy-action-padding, 10px 14px);
          color: #a5f3fc;
          background: rgba(34, 211, 238, 0.12);
          font-size: var(--copy-action-size, 12px);
          font-weight: 800;
          line-height: 1;
        }

        .particle-portrait-copy-scroll img {
          display: block;
          max-width: 100%;
          max-height: var(--copy-image-height, 130px);
          margin: 9px 0;
          border-radius: 10px;
          object-fit: cover;
        }

        .particle-portrait-copy-scroll pre,
        .particle-portrait-copy-scroll code {
          font-family: monospace;
          color: #dbeafe;
        }

        .particle-portrait-copy-scroll pre {
          max-width: 100%;
          overflow-x: auto;
        }

        .particle-portrait-copy-scroll hr {
          border: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.14);
          margin: 10px 0;
        }

        .particle-portrait-copy-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .particle-portrait-copy-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .particle-portrait-copy-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(103, 232, 249, 0.3);
        }

        .particle-portrait-copy-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(103, 232, 249, 0.48);
        }

        .particle-portrait-copy-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(103, 232, 249, 0.3) transparent;
        }
      `}</style>
    </div>
  );
}
