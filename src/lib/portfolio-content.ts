export type SectionTypography = {
  titleFontSize: number;
  titleColor: string;
  bodyFontSize: number;
  bodyColor: string;
  accentColor: string;
};

export type PortfolioSection = {
  id: string;
  isSample?: boolean;
  index: string;
  label: string;
  title: string;
  body: string;
  bodyHtml: string;
  contentHtml: string;
  facts: string[];
  image: string;
  imageSide: "left" | "right";
  imageType: "portrait" | "landscape";
  imageWidth: number;
  imageFocusY: number;
  panelWidth: number;
  panelOpacity: number;
  action?: string;
  href?: string;
  typography: SectionTypography;
};

export type PortfolioContent = {
  brandName: string;
  role: string;
  sections: PortfolioSection[];
  updatedAt?: string;
};

export const DATABASE_URL =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  "https://portfolio-7ae21-default-rtdb.asia-southeast1.firebasedatabase.app";

export const DEFAULT_TYPOGRAPHY: SectionTypography = {
  titleFontSize: 56,
  titleColor: "#f8fafc",
  bodyFontSize: 16,
  bodyColor: "#aeb9ca",
  accentColor: "#fb923c",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const RICH_TEXT_TAGS = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CODE", "EM", "H1", "H2", "H3", "H4",
  "HR", "I", "IMG", "LI", "OL", "P", "PRE", "S", "SPAN", "STRONG",
  "U", "UL",
]);

export function sanitizeRichText(value: string) {
  if (!value) return "";
  if (typeof document === "undefined") {
    return value.replace(/<script[\s\S]*?<\/script>/giu, "");
  }

  const template = document.createElement("template");
  template.innerHTML = value;
  const clean = (element: Element) => {
    Array.from(element.children).forEach(clean);
    if (!RICH_TEXT_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    const color = element instanceof HTMLElement ? element.style.color : "";
    const textAlign = element instanceof HTMLElement ? element.style.textAlign : "";
    const fontSize = element instanceof HTMLElement ? element.style.fontSize : "";
    const href = element.tagName === "A" ? element.getAttribute("href") ?? "" : "";
    const src = element.tagName === "IMG" ? element.getAttribute("src") ?? "" : "";
    const alt = element.tagName === "IMG" ? element.getAttribute("alt") ?? "" : "";
    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));

    if (color && /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/iu.test(color)) {
      (element as HTMLElement).style.color = color;
    }
    if (["left", "center", "right", "justify"].includes(textAlign)) {
      (element as HTMLElement).style.textAlign = textAlign;
    }
    if (/^(?:[8-9]|[1-9]\d|1[0-5]\d|160)px$/u.test(fontSize)) {
      (element as HTMLElement).style.fontSize = fontSize;
    }
    if (element.tagName === "A" && /^(?:https?:|mailto:)/iu.test(href)) {
      element.setAttribute("href", href);
    }
    if (
      element.tagName === "IMG" &&
      /^data:image\/(?:png|jpe?g|webp|gif);base64,/iu.test(src)
    ) {
      element.setAttribute("src", src);
      element.setAttribute("alt", alt.slice(0, 180));
    } else if (element.tagName === "IMG") {
      element.remove();
    }
  };
  Array.from(template.content.children).forEach(clean);
  return template.innerHTML;
}

export function richTextToPlainText(value: string) {
  const safe = sanitizeRichText(value);
  if (typeof document === "undefined") {
    return safe.replace(/<br\s*\/?>/giu, "\n").replace(/<[^>]+>/gu, " ").trim();
  }
  const container = document.createElement("div");
  container.innerHTML = safe;
  container.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  container.querySelectorAll("p,h1,h2,h3,h4,li,blockquote").forEach((node) => node.append("\n"));
  return (container.textContent ?? "").replace(/\n{3,}/gu, "\n\n").trim();
}

function composeSectionContentHtml(section: {
  index: string;
  label: string;
  title: string;
  bodyHtml: string;
  facts: string[];
  action?: string;
  href?: string;
}) {
  const facts = section.facts.filter(Boolean);
  const factsHtml = facts.length
    ? `<ul>${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>`
    : "";
  const actionHtml = section.action
    ? `<p><a href="${escapeHtml(section.href || "https://")}">${escapeHtml(section.action)}</a></p>`
    : "";
  return sanitizeRichText(
    `<p>${escapeHtml(section.index)} / ${escapeHtml(section.label)}</p>` +
    `<h1>${escapeHtml(section.title)}</h1>` +
    section.bodyHtml +
    factsHtml +
    actionHtml,
  );
}

export function createPortfolioSection(position: number): PortfolioSection {
  const body = "Describe the work, decisions, and outcome behind this section.";
  const index = String(position + 1).padStart(2, "0");
  const label = "NEW SECTION";
  const title = "Give this section a clear, memorable idea.";
  const bodyHtml = `<p>${escapeHtml(body)}</p>`;
  const facts = ["Add a useful detail", "Add a measurable outcome"];
  return {
    id: `section-${position + 1}`,
    isSample: false,
    index,
    label,
    title,
    body,
    bodyHtml,
    contentHtml: composeSectionContentHtml({ index, label, title, bodyHtml, facts }),
    facts,
    image: "/face-1.jpg",
    imageSide: position % 2 === 0 ? "left" : "right",
    imageType: "portrait",
    imageWidth: 43,
    imageFocusY: 42,
    panelWidth: 39,
    panelOpacity: 72,
    action: "",
    href: "",
    typography: { ...DEFAULT_TYPOGRAPHY },
  };
}

export const DEFAULT_PORTFOLIO_CONTENT: PortfolioContent = {
  brandName: "JALAJ GHUGE",
  role: "PRODUCT ENGINEER / INDIA",
  sections: [
    {
      id: "info",
      isSample: true,
      index: "01",
      label: "INFO",
      title: "I turn complicated systems into calm, responsive products.",
      body: "I work across interface architecture, realtime infrastructure, and product engineering—where every interaction has to remain clear under pressure.",
      bodyHtml: "<p>I work across interface architecture, <strong>realtime infrastructure</strong>, and product engineering—where every interaction has to remain clear under pressure.</p>",
      contentHtml: '<p>01 / INFO</p><h1>I turn complicated systems into calm, responsive products.</h1><p>I work across interface architecture, <strong>realtime infrastructure</strong>, and product engineering—where every interaction has to remain clear under pressure.</p><ul><li>Systems thinking</li><li>Frontend · Backend · Realtime</li><li>Built from India</li></ul>',
      facts: ["Systems thinking", "Frontend · Backend · Realtime", "Built from India"],
      image: "/ai-info-observatory.webp",
      imageSide: "left",
      imageType: "landscape",
      imageWidth: 44,
      imageFocusY: 50,
      panelWidth: 39,
      panelOpacity: 72,
      typography: { ...DEFAULT_TYPOGRAPHY },
    },
    {
      id: "signal-garden",
      isSample: true,
      index: "02",
      label: "SIGNAL GARDEN",
      title: "A machine waits for weather that will never arrive.",
      body: "John placed a black box between twelve marble towers and called it a protocol. Nothing happened twice in exactly the same way.",
      bodyHtml: "<p>John placed a black box between twelve marble towers and called it a <strong>protocol</strong>. Nothing happened twice in exactly the same way.</p>",
      contentHtml: '<p>02 / SIGNAL GARDEN</p><h1>A machine waits for weather that will never arrive.</h1><p>John placed a black box between twelve marble towers and called it a <strong>protocol</strong>. Nothing happened twice in exactly the same way.</p><h3>Unverified observations</h3><ul><li>The quiet nodes move first</li><li>Orange means almost ready</li><li>The garden remembers no one</li></ul>',
      facts: ["The quiet nodes move first", "Orange means almost ready", "No fixed outcome"],
      image: "/ai-system-garden.webp",
      imageSide: "right",
      imageType: "landscape",
      imageWidth: 44,
      imageFocusY: 50,
      panelWidth: 40,
      panelOpacity: 72,
      typography: { ...DEFAULT_TYPOGRAPHY },
    },
    {
      id: "monolith-study",
      isSample: true,
      index: "03",
      label: "MONOLITH STUDY",
      title: "John counted 1,024 layers and trusted none of them.",
      body: "Lorem ipsum folded into a metallic archive. Every fragment knew its position; the complete object still refused to explain itself.",
      bodyHtml: "<p>Lorem ipsum folded into a metallic archive. Every fragment knew its position; the complete object still refused to <em>explain itself</em>.</p>",
      contentHtml: '<p>03 / MONOLITH STUDY</p><h1>John counted 1,024 layers and trusted none of them.</h1><p>Lorem ipsum folded into a metallic archive. Every fragment knew its position; the complete object still refused to <em>explain itself</em>.</p><blockquote>Order is only chaos with excellent documentation.</blockquote><ol><li>Split the signal</li><li>Observe the orbit</li><li>Forget the result</li></ol>',
      facts: ["1,024 imagined layers", "Controlled orbit", "Zero conclusions"],
      image: "/ai-data-monolith.webp",
      imageSide: "left",
      imageType: "landscape",
      imageWidth: 44,
      imageFocusY: 50,
      panelWidth: 40,
      panelOpacity: 72,
      typography: { ...DEFAULT_TYPOGRAPHY },
    },
    {
      id: "contact",
      isSample: true,
      index: "04",
      label: "CONTACT",
      title: "Let’s connect the difficult parts and make them feel inevitable.",
      body: "Available for ambitious product work across frontend architecture, realtime systems, creative technology, and full-stack engineering.",
      bodyHtml: "<p>Available for ambitious product work across frontend architecture, realtime systems, creative technology, and full-stack engineering.</p>",
      contentHtml: '<p>04 / CONTACT</p><h1>Let’s connect the difficult parts and make them feel inevitable.</h1><p>Available for ambitious product work across frontend architecture, realtime systems, creative technology, and full-stack engineering.</p><ul><li>Product engineering</li><li>Realtime + interactive systems</li><li>Thoughtful collaborations</li></ul><p><a href="https://www.linkedin.com/in/jalaj-ghuge-b5bb65129/">START A CONVERSATION ↗</a></p>',
      facts: ["Product engineering", "Realtime + interactive systems", "Thoughtful collaborations"],
      image: "/ai-contact-bridge.webp",
      imageSide: "right",
      imageType: "landscape",
      imageWidth: 44,
      imageFocusY: 50,
      panelWidth: 40,
      panelOpacity: 72,
      action: "START A CONVERSATION  ↗",
      href: "https://www.linkedin.com/in/jalaj-ghuge-b5bb65129/",
      typography: { ...DEFAULT_TYPOGRAPHY },
    },
  ],
};

const LEGACY_SAMPLE_SECTION_IDS = new Set(
  [
    ...DEFAULT_PORTFOLIO_CONTENT.sections.map((section) => section.id),
    "selected-project",
    "john-brutalist-test",
    "john-orb-test",
  ],
);

/**
 * Older database records predate the explicit marker, so their known seed IDs
 * remain samples unless an editor has deliberately promoted one.
 */
export function isSamplePortfolioSection(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const section = value as Partial<PortfolioSection>;
  if (section.isSample === false) return false;
  if (section.isSample === true) return true;
  return typeof section.id === "string" && LEGACY_SAMPLE_SECTION_IDS.has(section.id);
}

export function normalizePortfolioContent(value: unknown): PortfolioContent {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_PORTFOLIO_CONTENT);
  const source = value as Partial<PortfolioContent>;
  const suppliedSections = Array.isArray(source.sections) ? source.sections : [];
  const customSections = suppliedSections.filter(
    (section) => !isSamplePortfolioSection(section),
  );
  const usingSampleSections = customSections.length === 0;
  const sectionSources = !usingSampleSections
    ? customSections
    : DEFAULT_PORTFOLIO_CONTENT.sections;
  const sections = sectionSources.map((sectionValue, index) => {
    const fallback = DEFAULT_PORTFOLIO_CONTENT.sections[index] ?? createPortfolioSection(index);
    const supplied = sectionValue as Partial<PortfolioSection> | undefined;
    const suppliedBody = typeof supplied?.body === "string" ? supplied.body : fallback.body;
    const bodyHtml = sanitizeRichText(
      typeof supplied?.bodyHtml === "string"
        ? supplied.bodyHtml
        : `<p>${escapeHtml(suppliedBody)}</p>`,
    );
    const contentHtml = sanitizeRichText(
      typeof supplied?.contentHtml === "string" && supplied.contentHtml
        ? supplied.contentHtml
        : composeSectionContentHtml({
          index: typeof supplied?.index === "string"
            ? supplied.index
            : String(index + 1).padStart(2, "0"),
          label: typeof supplied?.label === "string" ? supplied.label : fallback.label,
          title: typeof supplied?.title === "string" ? supplied.title : fallback.title,
          bodyHtml,
          facts: Array.isArray(supplied?.facts) ? supplied.facts.map(String) : fallback.facts,
          action: supplied?.action ?? fallback.action,
          href: supplied?.href ?? fallback.href,
        }),
    );
    const numeric = (candidate: unknown, fallbackValue: number, min: number, max: number) =>
      typeof candidate === "number" && Number.isFinite(candidate)
        ? Math.min(max, Math.max(min, candidate))
        : fallbackValue;
    return {
      ...fallback,
      ...supplied,
      isSample: usingSampleSections,
      id: typeof supplied?.id === "string" && supplied.id
        ? supplied.id
        : `${fallback.id}-${index}`,
      index: typeof supplied?.index === "string"
        ? supplied.index
        : String(index + 1).padStart(2, "0"),
      body: suppliedBody || richTextToPlainText(bodyHtml),
      bodyHtml,
      contentHtml,
      facts: Array.isArray(supplied?.facts) ? supplied.facts.map(String) : fallback.facts,
      imageWidth: numeric(supplied?.imageWidth, fallback.imageWidth, 30, 52),
      imageFocusY: numeric(supplied?.imageFocusY, fallback.imageFocusY, 0, 100),
      panelWidth: numeric(supplied?.panelWidth, fallback.panelWidth, 30, 48),
      panelOpacity: numeric(supplied?.panelOpacity, fallback.panelOpacity, 35, 92),
      typography: {
        ...fallback.typography,
        ...(supplied?.typography ?? {}),
      },
    };
  });

  return {
    brandName: typeof source.brandName === "string" ? source.brandName : DEFAULT_PORTFOLIO_CONTENT.brandName,
    role: typeof source.role === "string" ? source.role : DEFAULT_PORTFOLIO_CONTENT.role,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined,
    sections,
  };
}

export async function loadPortfolioContent() {
  const response = await fetch(`${DATABASE_URL}/portfolio/content.json`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Portfolio content request failed (${response.status})`);
  return normalizePortfolioContent(await response.json());
}
