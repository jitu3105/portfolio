import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ParticleLoader } from "./components/particle-loader";
import { ParticlePortrait } from "./components/particle-portrait";
import {
  DEFAULT_PORTFOLIO_CONTENT,
  loadPortfolioContent,
  type PortfolioContent,
} from "./lib/portfolio-content";
import type { ParticleHandoffTarget } from "./lib/particle-system";

const LazyAdminApp = lazy(() =>
  import("./admin/admin-app").then((module) => ({ default: module.AdminApp })),
);

function PortfolioApp() {
  const loopRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<PortfolioContent | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [portfolioActive, setPortfolioActive] = useState(false);
  const [particleTarget, setParticleTarget] = useState<ParticleHandoffTarget[]>([]);
  const handleCanvasReady = useCallback((target: ParticleHandoffTarget[]) => {
    setParticleTarget(target);
    setCanvasReady(true);
  }, []);
  const handleHandoffStart = useCallback(() => setPortfolioActive(true), []);
  const activeContent = content ?? DEFAULT_PORTFOLIO_CONTENT;
  const sectionCount = Math.max(1, activeContent.sections.length);

  useEffect(() => {
    let active = true;
    void loadPortfolioContent()
      .then((nextContent) => {
        if (active) setContent(nextContent);
      })
      .catch(() => {
        if (active) setContent(structuredClone(DEFAULT_PORTFOLIO_CONTENT));
      })
      .finally(() => {
        if (active) setDataReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const container = loopRef.current;
    if (!container) return;
    const blocks = Array.from(container.querySelectorAll<HTMLElement>(".scroll-loop-block"));
    if (blocks.length < 3) return;
    let suppress = false;
    let magnetActive = false;
    let gestureActive = false;
    let animating = false;
    let settling = false;
    let gestureDirection = 0;
    let gestureTarget = 0;
    let gestureStartedAt = 0;
    let accumulatedDelta = 0;
    let lastWheelAt = 0;
    let animationFrame = 0;
    let releaseTimer = 0;
    let quietTimer = 0;
    let proximityTimer = 0;
    let knownBlockHeight = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const easeOutQuint = (value: number) => 1 - Math.pow(1 - value, 5);
    const smootherstep = (value: number) =>
      value * value * value * (value * (value * 6 - 15) + 10);

    const normalizedBlockHeight = () => blocks[1].offsetHeight;

    const normalizeIntoMiddle = () => {
      const blockHeight = normalizedBlockHeight();
      if (blockHeight <= 0) return;
      let top = window.scrollY;
      while (top < blockHeight) top += blockHeight;
      while (top >= blockHeight * 2) top -= blockHeight;
      if (Math.abs(top - window.scrollY) < 0.5) return;
      suppress = true;
      window.scrollTo({ top, behavior: "auto" });
      window.requestAnimationFrame(() => { suppress = false; });
    };

    const unlockWhenWheelIsQuiet = () => {
      window.clearTimeout(quietTimer);
      const quietFor = performance.now() - lastWheelAt;
      if (quietFor < 170) {
        quietTimer = window.setTimeout(unlockWhenWheelIsQuiet, 170 - quietFor);
        return;
      }
      settling = false;
      magnetActive = false;
      gestureDirection = 0;
      accumulatedDelta = 0;
      normalizeIntoMiddle();
    };

    const completeGesture = () => {
      gestureActive = false;
      animating = false;
      settling = true;
      normalizeIntoMiddle();
      unlockWhenWheelIsQuiet();
    };

    const animateToGestureTarget = (fast: boolean) => {
      window.clearTimeout(releaseTimer);
      if (animating || !gestureActive) return;
      animating = true;
      const startTop = window.scrollY;
      const distance = gestureTarget - startTop;
      if (Math.abs(distance) < 0.75) {
        window.scrollTo({ top: gestureTarget, behavior: "auto" });
        completeGesture();
        return;
      }
      const startedAt = performance.now();
      const distanceRatio = Math.min(
        1,
        Math.abs(distance) / Math.max(window.innerHeight, 1),
      );
      const duration = reduceMotion
        ? 90
        : fast
          ? 1250 + distanceRatio * 260
          : 300 + distanceRatio * 220;

      const step = (time: number) => {
        const progress = Math.min(1, (time - startedAt) / duration);
        const eased = fast ? smootherstep(progress) : easeOutQuint(progress);
        window.scrollTo({
          top: startTop + distance * eased,
          behavior: "auto",
        });
        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(step);
          return;
        }
        window.scrollTo({ top: gestureTarget, behavior: "auto" });
        animationFrame = 0;
        completeGesture();
      };

      animationFrame = window.requestAnimationFrame(step);
    };

    const syncToMiddle = () => {
      const blockHeight = normalizedBlockHeight();
      if (blockHeight <= 0) return;
      const localProgress = knownBlockHeight > 0
        ? (((window.scrollY % knownBlockHeight) + knownBlockHeight) % knownBlockHeight) /
          knownBlockHeight
        : 0;
      knownBlockHeight = blockHeight;
      suppress = true;
      window.scrollTo({
        top: blockHeight * (1 + localProgress),
        behavior: "auto",
      });
      window.requestAnimationFrame(() => { suppress = false; });
    };

    const snapToNearbyMarker = () => {
      if (!portfolioActive || magnetActive || gestureActive || animating || settling) return;
      const blockHeight = normalizedBlockHeight();
      const slideHeight = blockHeight / sectionCount;
      if (blockHeight <= 0 || slideHeight <= 0) return;

      const nearestTarget = Math.round(window.scrollY / slideHeight) * slideHeight;
      const distance = nearestTarget - window.scrollY;
      // A deliberately small capture radius preserves free movement through
      // the morph, but makes every numbered stop feel physically magnetic.
      if (Math.abs(distance) > slideHeight * 0.16) return;

      gestureActive = true;
      magnetActive = true;
      gestureDirection = Math.sign(distance) || 1;
      gestureStartedAt = performance.now();
      accumulatedDelta = 0;
      lastWheelAt = performance.now();
      gestureTarget = nearestTarget;
      animateToGestureTarget(false);
    };

    const handleScroll = () => {
      if (suppress || magnetActive) return;
      const blockHeight = normalizedBlockHeight();
      if (blockHeight <= 0) return;
      const top = window.scrollY;
      if (top < blockHeight) {
        suppress = true;
        window.scrollTo({ top: top + blockHeight, behavior: "auto" });
        window.requestAnimationFrame(() => { suppress = false; });
        return;
      } else if (top >= blockHeight * 2) {
        suppress = true;
        window.scrollTo({ top: top - blockHeight, behavior: "auto" });
        window.requestAnimationFrame(() => { suppress = false; });
        return;
      }

      window.clearTimeout(proximityTimer);
      proximityTimer = window.setTimeout(snapToNearbyMarker, 130);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      window.clearTimeout(proximityTimer);
      lastWheelAt = performance.now();
      if (!portfolioActive || animating || settling) return;

      const modeMultiplier = event.deltaMode === 1
        ? 18
        : event.deltaMode === 2
          ? window.innerHeight
          : 1;
      const delta = event.deltaY * modeMultiplier;
      const direction = Math.sign(delta);
      if (direction === 0) return;

      const blockHeight = normalizedBlockHeight();
      const slideHeight = blockHeight / sectionCount;
      if (slideHeight <= 0) return;

      if (!gestureActive) {
        gestureActive = true;
        magnetActive = true;
        gestureDirection = direction;
        gestureStartedAt = performance.now();
        accumulatedDelta = 0;
        const nearestSlide = Math.round(window.scrollY / slideHeight) * slideHeight;
        gestureTarget = nearestSlide + direction * slideHeight;
      }

      if (direction !== gestureDirection) return;
      accumulatedDelta += Math.abs(delta);
      const gestureAge = performance.now() - gestureStartedAt;
      const fast = Math.abs(delta) >= 68 ||
        (gestureAge < 150 && accumulatedDelta >= 150);

      if (fast) {
        animateToGestureTarget(true);
        return;
      }

      const remaining = Math.abs(gestureTarget - window.scrollY);
      const scrubDistance = Math.min(remaining, Math.max(1, Math.abs(delta) * 0.92));
      window.scrollTo({
        top: window.scrollY + gestureDirection * scrubDistance,
        behavior: "auto",
      });

      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => animateToGestureTarget(false), 105);
    };

    const handleSectionNavigation = (event: Event) => {
      if (!portfolioActive) return;
      const requestedIndex = Number(
        (event as CustomEvent<{ index?: number }>).detail?.index,
      );
      if (!Number.isFinite(requestedIndex)) return;

      const blockHeight = normalizedBlockHeight();
      const slideHeight = blockHeight / sectionCount;
      if (blockHeight <= 0 || slideHeight <= 0) return;

      const sectionIndex = Math.min(
        sectionCount - 1,
        Math.max(0, Math.round(requestedIndex)),
      );
      const localTarget = sectionIndex * slideHeight;
      const candidates = [0, 1, 2].map(
        (blockIndex) => localTarget + blockIndex * blockHeight,
      );
      const target = candidates.reduce((closest, candidate) =>
        Math.abs(candidate - window.scrollY) < Math.abs(closest - window.scrollY)
          ? candidate
          : closest
      );

      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(releaseTimer);
      window.clearTimeout(quietTimer);
      window.clearTimeout(proximityTimer);
      animationFrame = 0;
      animating = false;
      settling = false;
      gestureActive = true;
      magnetActive = true;
      gestureDirection = Math.sign(target - window.scrollY) || 1;
      gestureStartedAt = performance.now();
      accumulatedDelta = 0;
      lastWheelAt = performance.now();
      gestureTarget = target;
      animateToGestureTarget(true);
    };

    syncToMiddle();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", syncToMiddle);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("portfolio:navigate-section", handleSectionNavigation);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(releaseTimer);
      window.clearTimeout(quietTimer);
      window.clearTimeout(proximityTimer);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", syncToMiddle);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("portfolio:navigate-section", handleSectionNavigation);
    };
  }, [portfolioActive, sectionCount]);

  return (
    <main className="portfolio-shell">
      {content && (
        <div className="background-stage">
          <ParticlePortrait
            content={content}
            onReady={handleCanvasReady}
            active={portfolioActive}
          />
        </div>
      )}
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="grid-overlay" />
      <div ref={loopRef} className="loop-shell" aria-hidden="true">
        <section className="scroll-loop-block" />
        <section className="scroll-loop-block" />
        <section className="scroll-loop-block" />
      </div>
      <div className="sr-only">
        <h1>{activeContent.brandName} — {activeContent.role}</h1>
        {activeContent.sections.map((section) => (
          <section key={section.id}>
            <h2>{section.label}: {section.title}</h2>
            <p>{section.body}</p>
            {section.href && <a href={section.href}>{section.action || section.label}</a>}
          </section>
        ))}
      </div>
      <ParticleLoader
        ready={dataReady && canvasReady}
        target={particleTarget}
        onHandoffStart={handleHandoffStart}
      />
    </main>
  );
}

function App() {
  return window.location.pathname.startsWith("/admin") ? (
    <Suspense fallback={<main className="admin-loading"><p>Loading control room…</p></main>}>
      <LazyAdminApp />
    </Suspense>
  ) : <PortfolioApp />;
}

export default App;
