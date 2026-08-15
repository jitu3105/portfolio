import { useEffect, useRef, useState } from "react";
import {
  getParticleCanvasDpr,
  getLoaderParticleBudget,
  getParticlePointerDistortion,
  getParticlePixelSize,
  type ParticleHandoffTarget,
} from "../lib/particle-system";

type LoaderParticle = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  arcX: number;
  arcY: number;
  speed: number;
  warm: boolean;
  handoffDelay: number;
  distortionX: number;
  distortionY: number;
  exitX?: number;
  exitY?: number;
};

type ParticleLoaderProps = {
  ready: boolean;
  target: ParticleHandoffTarget[];
  onHandoffStart?: () => void;
};

const MINIMUM_LOADING_TIME = 3000;
const HANDOFF_DURATION = 1800;
const PORTFOLIO_REVEAL_PROGRESS = 0.46;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function smootherstep(value: number) {
  const amount = clamp(value, 0, 1);
  return amount * amount * amount *
    (amount * (amount * 6 - 15) + 10);
}

export function ParticleLoader({
  ready,
  target,
  onHandoffStart,
}: ParticleLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const readyRef = useRef(ready);
  const targetRef = useRef(target);
  const onHandoffStartRef = useRef(onHandoffStart);
  const portfolioActivatedRef = useRef(false);
  const handoffSignalledRef = useRef(false);
  const pointerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    present: false,
    touch: false,
  });
  const exitStartedRef = useRef<number | null>(null);
  const mountedAtRef = useRef(performance.now());
  const [visible, setVisible] = useState(true);
  const [handoffFading, setHandoffFading] = useState(false);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    onHandoffStartRef.current = onHandoffStart;
  }, [onHandoffStart]);

  useEffect(() => {
    readyRef.current = ready;
    if (!ready) return;
    const elapsed = performance.now() - mountedAtRef.current;
    const delay = Math.max(0, MINIMUM_LOADING_TIME - elapsed);
    const timer = window.setTimeout(() => {
      exitStartedRef.current = performance.now();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!context) return;
    let frame = 0;
    let handoffTimer = 0;
    let fontBuildHandle = 0;
    let resizeTimer = 0;
    let disposed = false;
    let particles: LoaderParticle[] = [];

    const build = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = getParticleCanvasDpr(width, 1.5);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const word = "LOADING";
      const desiredFontSize = Math.max(48, Math.min(width * 0.13, 180));
      const outerPadding = Math.max(18, Math.min(width * 0.055, 72));
      const sampleWidth = Math.max(
        1,
        Math.floor(Math.min(width - outerPadding * 2, 1180)),
      );
      const innerPadding = getParticlePixelSize(width) * 3 + 8;
      const measuringContext = document.createElement("canvas").getContext("2d");
      if (!measuringContext) return;
      measuringContext.font = `800 ${desiredFontSize}px "Syne", sans-serif`;
      const measuredWidth = measuringContext.measureText(word).width;
      const availableTextWidth = Math.max(1, sampleWidth - innerPadding * 2);
      const fontSize = desiredFontSize * Math.min(1, availableTextWidth / measuredWidth);

      const sample = document.createElement("canvas");
      const sampleHeight = Math.ceil(fontSize * 1.55 + innerPadding * 2);
      sample.width = sampleWidth;
      sample.height = sampleHeight;
      const sampleContext = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return;
      sampleContext.font = `800 ${fontSize}px "Syne", sans-serif`;
      sampleContext.textAlign = "center";
      sampleContext.textBaseline = "middle";
      sampleContext.fillStyle = "#fff";
      sampleContext.fillText(word, sampleWidth / 2, sampleHeight / 2);
      const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
      const step = width < 760 ? 3 : 4;
      const targets: Array<{ x: number; y: number }> = [];
      const offsetX = (width - sampleWidth) / 2;
      const offsetY = (height - sampleHeight) / 2;

      for (let y = 0; y < sampleHeight; y += step) {
        for (let x = 0; x < sampleWidth; x += step) {
          if (pixels[(y * sampleWidth + x) * 4 + 3] > 100) {
            targets.push({ x: x + offsetX, y: y + offsetY });
          }
        }
      }

      const count = getLoaderParticleBudget(width);
      const stride = Math.max(1, targets.length / count);
      particles = Array.from({ length: count }, (_, index) => {
        const targetIndex = Math.min(
          targets.length - 1,
          Math.floor((index * stride) % Math.max(targets.length, 1)),
        );
        const textTarget = targets[targetIndex] ?? { x: width / 2, y: height / 2 };
        const duplicateLayer = Math.floor(index / Math.max(targets.length, 1));
        const layerOffset = duplicateLayer ? ((duplicateLayer % 3) - 1) * 0.8 : 0;
        const angle = (index * 2.39996) % (Math.PI * 2);
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          tx: textTarget.x + layerOffset,
          ty: textTarget.y - layerOffset,
          arcX: Math.cos(angle),
          arcY: Math.sin(angle),
          speed: 0.7 + (index % 17) / 20,
          warm: index % 23 === 0,
          handoffDelay: (((index * 47) % 97) / 97) * 0.065,
          distortionX: 0,
          distortionY: 0,
        };
      });
    };

    const render = (time: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const exitStarted = exitStartedRef.current;
      const exitProgress = exitStarted === null
        ? 0
        : clamp((time - exitStarted) / HANDOFF_DURATION, 0, 1);
      const easedExit = smootherstep(exitProgress);
      const targetPoints = targetRef.current;
      const pixelSize = getParticlePixelSize(width);
      const pointer = pointerRef.current;

      // Let the loader perform the visually expensive first half alone. The
      // destination canvas wakes only once these pixels already resemble the
      // first portrait, cutting the period where both systems render together.
      if (
        exitProgress >= PORTFOLIO_REVEAL_PROGRESS &&
        !portfolioActivatedRef.current
      ) {
        portfolioActivatedRef.current = true;
        onHandoffStartRef.current?.();
      }

      context.clearRect(0, 0, width, height);
      if (statusRef.current) {
        statusRef.current.style.opacity = `${1 - easedExit}`;
        statusRef.current.style.transform =
          `translate(-50%, ${easedExit * 12}px)`;
      }

      // Fine color/alpha buckets retain the portrait palette while avoiding a
      // separate draw call for every handoff particle.
      const colorLevels = 5;
      const alphaLevels = 4;
      const pathsPerAlpha = colorLevels ** 3;
      const colorPaths: Array<Path2D | undefined> = new Array(
        pathsPerAlpha * alphaLevels,
      );
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const destination = targetPoints.length
          ? targetPoints[Math.min(
            targetPoints.length - 1,
            Math.floor((index / particles.length) * targetPoints.length),
          )]
          : undefined;
        let renderedSize = pixelSize;
        let renderedR = particle.warm ? 251 : 103;
        let renderedG = particle.warm ? 146 : 232;
        let renderedB = particle.warm ? 60 : 249;
        let renderedAlpha = particle.warm ? 0.9 : 0.78;

        if (exitProgress > 0 && destination) {
          particle.exitX ??= particle.x;
          particle.exitY ??= particle.y;
          const localExit = clamp(
            (exitProgress - particle.handoffDelay) /
              (1 - particle.handoffDelay),
            0,
            1,
          );
          const particleEase = smootherstep(localExit);
          const arc = Math.sin(localExit * Math.PI) *
            (14 + particle.speed * 18);
          particle.x = lerp(particle.exitX, destination.x, particleEase) +
            particle.arcX * arc;
          particle.y = lerp(particle.exitY, destination.y, particleEase) +
            particle.arcY * arc;
          renderedR = lerp(renderedR, destination.r, particleEase);
          renderedG = lerp(renderedG, destination.g, particleEase);
          renderedB = lerp(renderedB, destination.b, particleEase);
          renderedAlpha = lerp(renderedAlpha, destination.alpha, particleEase);
          renderedSize = lerp(pixelSize, destination.size, particleEase);

          if (pointer.present) {
            const distortion = getParticlePointerDistortion(
              particle.x,
              particle.y,
              time,
              width,
              pointer,
            );
            particle.distortionX = lerp(particle.distortionX, distortion.x, 0.19);
            particle.distortionY = lerp(particle.distortionY, distortion.y, 0.19);
          } else {
            particle.distortionX = lerp(particle.distortionX, 0, 0.19);
            particle.distortionY = lerp(particle.distortionY, 0, 0.19);
          }
          particle.x += particle.distortionX;
          particle.y += particle.distortionY;
        } else {
          const idleWave =
            Math.sin(time * 0.002 + particle.tx * 0.018 + index * 0.01) * 2.4;
          let textX = particle.tx + idleWave;
          let textY =
            particle.ty + Math.sin(time * 0.0016 + particle.ty * 0.012) * 2;

          if (pointer.present) {
            const distortion = getParticlePointerDistortion(
              particle.x,
              particle.y,
              time,
              width,
              pointer,
            );
            textX += distortion.x;
            textY += distortion.y;
          }

          particle.x += (textX - particle.x) * (readyRef.current ? 0.14 : 0.095);
          particle.y += (textY - particle.y) * (readyRef.current ? 0.14 : 0.095);
        }

        if (renderedAlpha <= 0.015) continue;
        const channelStep = 255 / (colorLevels - 1);
        const redLevel = clamp(Math.round(renderedR / channelStep), 0, colorLevels - 1);
        const greenLevel = clamp(Math.round(renderedG / channelStep), 0, colorLevels - 1);
        const blueLevel = clamp(Math.round(renderedB / channelStep), 0, colorLevels - 1);
        const alphaLevel = clamp(
          Math.round(renderedAlpha * (alphaLevels - 1)),
          0,
          alphaLevels - 1,
        );
        const colorIndex =
          alphaLevel * pathsPerAlpha +
          redLevel * colorLevels * colorLevels +
          greenLevel * colorLevels +
          blueLevel;
        const path = colorPaths[colorIndex] ??= new Path2D();
        path.rect(
          particle.x - renderedSize / 2,
          particle.y - renderedSize / 2,
          renderedSize,
          renderedSize,
        );
      }

      context.save();
      const handoffLayerAlpha = 1 - smootherstep(
        clamp((exitProgress - 0.34) / 0.66, 0, 1),
      ) * 0.94;
      colorPaths.forEach((path, colorIndex) => {
        if (!path) return;
        const alphaLevel = Math.floor(colorIndex / pathsPerAlpha);
        const paletteIndex = colorIndex % pathsPerAlpha;
        const redLevel = Math.floor(paletteIndex / (colorLevels * colorLevels));
        const greenLevel = Math.floor((paletteIndex % (colorLevels * colorLevels)) / colorLevels);
        const blueLevel = paletteIndex % colorLevels;
        const channelStep = 255 / (colorLevels - 1);
        context.globalAlpha = (alphaLevel / (alphaLevels - 1)) * handoffLayerAlpha;
        context.fillStyle = `rgb(${Math.round(redLevel * channelStep)},${Math.round(greenLevel * channelStep)},${Math.round(blueLevel * channelStep)})`;
        context.fill(path);
      });
      context.restore();

      if (pointer.present && exitProgress < 1) {
        context.save();
        context.strokeStyle = "rgba(103,232,249,.32)";
        context.lineWidth = 1;
        context.beginPath();
        context.arc(
          pointer.x,
          pointer.y,
          18 + Math.sin(time * 0.005) * 2,
          0,
          Math.PI * 2,
        );
        context.stroke();
        context.fillStyle = "rgba(251,146,60,.78)";
        context.fillRect(pointer.x - 1.5, pointer.y - 1.5, 3, 3);
        context.restore();
      }

      pointer.vx *= 0.88;
      pointer.vy *= 0.88;

      if (exitProgress >= 1) {
        if (!handoffSignalledRef.current) {
          handoffSignalledRef.current = true;
          setHandoffFading(true);
          handoffTimer = window.setTimeout(() => setVisible(false), 680);
        }
        return;
      }
      frame = window.requestAnimationFrame(render);
    };

    build();
    void document.fonts?.ready.then(() => {
      if (disposed || exitStartedRef.current !== null) return;
      const schedule = window.requestIdleCallback ?? ((callback: IdleRequestCallback) =>
        window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 12 }), 1));
      fontBuildHandle = schedule(() => {
        if (!disposed && exitStartedRef.current === null) build();
      }, { timeout: 500 }) as number;
    });
    frame = window.requestAnimationFrame(render);
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (exitStartedRef.current === null) build();
      }, 140);
    };
    window.addEventListener("resize", handleResize);
    const handlePointerMove = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      const vx = pointer.present ? event.clientX - pointer.x : 0;
      const vy = pointer.present ? event.clientY - pointer.y : 0;
      pointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        vx: lerp(pointer.vx, vx, 0.38),
        vy: lerp(pointer.vy, vy, 0.38),
        present: true,
        touch: event.pointerType === "touch",
      };
    };
    const handlePointerLeave = () => {
      pointerRef.current.present = false;
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handlePointerLeave);
    return () => {
      disposed = true;
      window.clearTimeout(handoffTimer);
      window.clearTimeout(resizeTimer);
      if (fontBuildHandle) {
        if (window.cancelIdleCallback) window.cancelIdleCallback(fontBuildHandle);
        else window.clearTimeout(fontBuildHandle);
      }
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", handlePointerLeave);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      className={`particle-loader${handoffFading ? " is-handing-off" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading portfolio content"
    >
      <canvas ref={canvasRef} />
      <p ref={statusRef}>Synchronizing content and particle geometry</p>
    </div>
  );
}
