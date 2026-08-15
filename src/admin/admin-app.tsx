import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Eye,
  ImageUp,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  createPortfolioSection,
  DATABASE_URL,
  DEFAULT_PORTFOLIO_CONTENT,
  isSamplePortfolioSection,
  loadPortfolioContent,
  normalizePortfolioContent,
  richTextToPlainText,
  sanitizeRichText,
  type PortfolioContent,
  type PortfolioSection,
} from "../lib/portfolio-content";
import { RichTextEditor } from "./rich-text-editor";

type Notice = { type: "success" | "error"; message: string } | null;

function getRichDocumentMetadata(contentHtml: string) {
  const container = document.createElement("div");
  container.innerHTML = sanitizeRichText(contentHtml);
  const heading = container.querySelector("h1,h2,h3")?.textContent?.trim();
  const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]"));
  const action = links.at(-1);
  return {
    title: heading || richTextToPlainText(contentHtml).split("\n")[0] || "Untitled section",
    body: richTextToPlainText(contentHtml),
    action: action?.textContent?.trim() || "",
    href: action?.getAttribute("href") || "",
  };
}

async function imageFileToBase64(
  file: File,
  maximumSide = 1600,
  quality = 0.86,
  maximumLength = 5_000_000,
) {
  if (!file.type.startsWith("image/")) throw new Error("Please select a valid image file.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The selected image could not be decoded."));
      element.src = objectUrl;
    });

    const encode = (maximumSide: number, quality: number) => {
      const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image conversion is unavailable in this browser.");
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL("image/webp", quality);
    };

    let dataUrl = encode(maximumSide, quality);
    if (dataUrl.length > maximumLength * 0.76) {
      dataUrl = encode(Math.max(640, maximumSide * 0.75), Math.max(0.68, quality - 0.12));
    }
    if (dataUrl.length > maximumLength) {
      throw new Error("The encoded image is still too large. Please choose a smaller source image.");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type SectionEditorProps = {
  section: PortfolioSection;
  sectionIndex: number;
  onChange: (section: PortfolioSection) => void;
  onUpload: (file: File) => Promise<void>;
  encodeInlineImage: (file: File) => Promise<string>;
  uploading: boolean;
};

function SectionEditor({
  section,
  sectionIndex,
  onChange,
  onUpload,
  encodeInlineImage,
  uploading,
}: SectionEditorProps) {
  const patch = (value: Partial<PortfolioSection>) => onChange({ ...section, ...value });
  const patchTypography = (value: Partial<PortfolioSection["typography"]>) =>
    patch({ typography: { ...section.typography, ...value } });

  return (
    <div className="admin-editor-grid">
      <section className="admin-panel admin-content-pad">
        <div className="admin-panel-heading">
          <div><span>SECTION {section.index}</span><h2>Content pad</h2></div>
          <span className="admin-state-dot">Live schema</span>
        </div>

        <div className="admin-field-row">
          <label>Navigation number<input value={section.index} onChange={(event) => patch({ index: event.target.value })} /></label>
          <label>Navigation label<input value={section.label} onChange={(event) => patch({ label: event.target.value })} /></label>
        </div>

        <div className="admin-type-toolbar">
          <label>Default display size
            <select value={section.typography.titleFontSize} onChange={(event) => patchTypography({ titleFontSize: Number(event.target.value) })}>
              {[40, 44, 48, 52, 56, 60, 64, 72, 80].map((size) => <option key={size} value={size}>{size}px</option>)}
            </select>
          </label>
          <label>Default heading color<input type="color" value={section.typography.titleColor} onChange={(event) => patchTypography({ titleColor: event.target.value })} /></label>
          <label>Default body size
            <select value={section.typography.bodyFontSize} onChange={(event) => patchTypography({ bodyFontSize: Number(event.target.value) })}>
              {[12, 14, 16, 18, 20, 22, 24].map((size) => <option key={size} value={size}>{size}px</option>)}
            </select>
          </label>
          <label>Default body color<input type="color" value={section.typography.bodyColor} onChange={(event) => patchTypography({ bodyColor: event.target.value })} /></label>
          <label>Accent<input type="color" value={section.typography.accentColor} onChange={(event) => patchTypography({ accentColor: event.target.value })} /></label>
        </div>
        <label>Complete section document <small>Everything visible inside the glass panel is edited here. Select any text to change its size, color, alignment, hierarchy, link, or formatting.</small></label>
        <RichTextEditor
          key={section.id}
          value={section.contentHtml}
          encodeImage={encodeInlineImage}
          onChange={(contentHtml) => patch({
            contentHtml,
            ...getRichDocumentMetadata(contentHtml),
          })}
        />
        <div className="admin-type-toolbar admin-layout-toolbar">
          <label>Panel width
            <input type="range" min="30" max="48" value={section.panelWidth} onChange={(event) => patch({ panelWidth: Number(event.target.value) })} />
            <small>{section.panelWidth}%</small>
          </label>
          <label>Panel opacity
            <input type="range" min="35" max="92" value={section.panelOpacity} onChange={(event) => patch({ panelOpacity: Number(event.target.value) })} />
            <small>{section.panelOpacity}%</small>
          </label>
        </div>
      </section>

      <aside className="admin-panel admin-media-panel">
        <div className="admin-panel-heading"><div><span>MEDIA</span><h2>Particle source</h2></div></div>
        <div className="admin-image-preview"><img src={section.image} alt={`Preview for section ${sectionIndex + 1}`} /></div>
        <label>Image URL or Base64 data<input value={section.image.startsWith("data:") ? "Base64 image stored in Realtime Database" : section.image} readOnly={section.image.startsWith("data:")} onChange={(event) => patch({ image: event.target.value })} /></label>
        {section.image.startsWith("data:") && (
          <button className="admin-inline-action" onClick={() => patch({ image: "" })}>Remove encoded image and use a URL</button>
        )}
        <label className={`admin-upload-button ${uploading ? "disabled" : ""}`}>
          {uploading ? <LoaderCircle className="spin" size={16} /> : <ImageUp size={16} />}
          {uploading ? "Encoding image…" : "Upload and encode image"}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
        </label>
        <p className="admin-muted">Uploads are resized to a maximum of 1600px, WebP-compressed, and stored as Base64 inside the Realtime Database content record.</p>
        <div className="admin-field-row">
          <label>Image side<select value={section.imageSide} onChange={(event) => patch({ imageSide: event.target.value as "left" | "right" })}><option value="left">Left</option><option value="right">Right</option></select></label>
          <label>Crop format<select value={section.imageType} onChange={(event) => patch({ imageType: event.target.value as "portrait" | "landscape" })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
        </div>
        <div className="admin-type-toolbar admin-layout-toolbar">
          <label>Image width
            <input type="range" min="30" max="52" value={section.imageWidth} onChange={(event) => patch({ imageWidth: Number(event.target.value) })} />
            <small>{section.imageWidth}%</small>
          </label>
          <label>Vertical crop focus
            <input type="range" min="0" max="100" value={section.imageFocusY} onChange={(event) => patch({ imageFocusY: Number(event.target.value) })} />
            <small>{section.imageFocusY}%</small>
          </label>
        </div>
        <div
          className="admin-preview-copy admin-rich-preview"
          style={{ color: section.typography.bodyColor }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.contentHtml) }}
        />
      </aside>
    </div>
  );
}

function Editor() {
  const [content, setContent] = useState<PortfolioContent>(() => structuredClone(DEFAULT_PORTFOLIO_CONTENT));
  const [activeSection, setActiveSection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    void loadPortfolioContent()
      .then((value) => setContent(normalizePortfolioContent(value)))
      .catch((reason: unknown) => setNotice({ type: "error", message: reason instanceof Error ? reason.message : "Unable to load content." }))
      .finally(() => setLoading(false));
  }, []);

  const updateSection = (section: PortfolioSection) => {
    setContent((current) => {
      const promoted = { ...section, isSample: false };
      if (current.sections.every(isSamplePortfolioSection)) {
        setActiveSection(0);
        return { ...current, sections: [{ ...promoted, index: "01" }] };
      }
      return {
        ...current,
        sections: current.sections.map((item, index) =>
          index === activeSection ? promoted : item
        ),
      };
    });
  };

  const sectionId = () =>
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `section-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const renumber = (sections: PortfolioSection[]) => sections.map((section, index) => ({
    ...section,
    index: String(index + 1).padStart(2, "0"),
  }));

  const addSection = () => {
    const onlySamples = content.sections.every(isSamplePortfolioSection);
    const position = onlySamples ? 0 : content.sections.length;
    const section = {
      ...createPortfolioSection(position),
      id: sectionId(),
      isSample: false,
    };
    setContent((current) => ({
      ...current,
      sections: onlySamples ? [section] : [...current.sections, section],
    }));
    setActiveSection(position);
  };

  const duplicateSection = () => {
    const source = content.sections[activeSection];
    const duplicate: PortfolioSection = {
      ...structuredClone(source),
      id: sectionId(),
      isSample: false,
      label: `${source.label} COPY`,
      imageSide: source.imageSide === "left" ? "right" : "left",
    };
    if (content.sections.every(isSamplePortfolioSection)) {
      setContent({ ...content, sections: [{ ...duplicate, index: "01" }] });
      setActiveSection(0);
      return;
    }
    const sections = [...content.sections];
    sections.splice(activeSection + 1, 0, duplicate);
    setContent({ ...content, sections: renumber(sections) });
    setActiveSection(activeSection + 1);
  };

  const removeSection = () => {
    if (content.sections.length <= 1) return;
    if (!window.confirm(`Remove “${content.sections[activeSection].label}” from this draft?`)) return;
    const sections = content.sections.filter((_, index) => index !== activeSection);
    setContent({ ...content, sections: renumber(sections) });
    setActiveSection(Math.max(0, activeSection - 1));
  };

  const moveSection = (direction: -1 | 1) => {
    const destination = activeSection + direction;
    if (destination < 0 || destination >= content.sections.length) return;
    const sections = [...content.sections];
    [sections[activeSection], sections[destination]] = [sections[destination], sections[activeSection]];
    setContent({ ...content, sections: renumber(sections) });
    setActiveSection(destination);
  };

  const saveContent = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const cleanContent = normalizePortfolioContent({
        ...content,
        sections: content.sections.map((section) => ({
          ...section,
          contentHtml: sanitizeRichText(section.contentHtml),
          bodyHtml: sanitizeRichText(section.bodyHtml),
        })),
      });
      const payload = { ...cleanContent, updatedAt: new Date().toISOString() };
      const response = await fetch(`${DATABASE_URL}/portfolio/content.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Realtime Database publish failed (${response.status}).`);
      }
      setContent(payload);
      setNotice({ type: "success", message: "Portfolio published successfully." });
    } catch (reason) {
      setNotice({ type: "error", message: reason instanceof Error ? reason.message : "Unable to publish." });
    } finally {
      setSaving(false);
    }
  };

  const deleteAllPortfolioData = async () => {
    const confirmation = window.prompt(
      "This permanently clears the entire Realtime Database. Type DELETE to continue.",
    );
    if (confirmation === null) return;
    if (confirmation !== "DELETE") {
      setNotice({ type: "error", message: "Deletion cancelled. Enter DELETE exactly to confirm." });
      return;
    }

    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`${DATABASE_URL}/.json`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Realtime Database deletion failed (${response.status}).`);
      }
      setContent(structuredClone(DEFAULT_PORTFOLIO_CONTENT));
      setActiveSection(0);
      setNotice({
        type: "success",
        message: "The Realtime Database was cleared. These four generated samples are local empty-state content and have not been republished.",
      });
    } catch (reason) {
      setNotice({
        type: "error",
        message: reason instanceof Error ? reason.message : "Unable to delete portfolio data.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setNotice(null);
    try {
      const image = await imageFileToBase64(file);
      updateSection({ ...content.sections[activeSection], image });
      setNotice({ type: "success", message: "Image encoded. Publish to save it in Realtime Database." });
    } catch (reason) {
      setNotice({ type: "error", message: reason instanceof Error ? reason.message : "Image upload failed." });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <main className="admin-loading"><LoaderCircle className="spin" /><p>Loading editor content…</p></main>;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="admin-kicker">JALAJ GHUGE / CMS</span><h1>Portfolio control room</h1></div>
        <div className="admin-header-actions">
          <span className="admin-user">Realtime Database / test mode</span>
          <a className="admin-icon-button" href="/" target="_blank" rel="noreferrer" title="Preview portfolio"><Eye size={17} /></a>
          <button className="admin-primary-button" onClick={() => void saveContent()} disabled={saving || deleting}>
            {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
            {saving ? "Publishing…" : "Publish changes"}
          </button>
        </div>
      </header>

      <section className="admin-global-bar">
        <label>Portfolio name<input value={content.brandName} onChange={(event) => setContent({ ...content, brandName: event.target.value })} /></label>
        <label>Role line<input value={content.role} onChange={(event) => setContent({ ...content, role: event.target.value })} /></label>
        <button className="admin-secondary-button" onClick={() => setContent(structuredClone(DEFAULT_PORTFOLIO_CONTENT))}><RotateCcw size={15} /> Reset draft</button>
        <button
          className="admin-secondary-button danger"
          onClick={() => void deleteAllPortfolioData()}
          disabled={saving || deleting}
          title="Permanently clear the entire Realtime Database"
        >
          {deleting ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
          {deleting ? "Deleting…" : "Delete all data"}
        </button>
      </section>

      <nav className="admin-section-tabs" aria-label="Portfolio sections">
        {content.sections.map((section, index) => (
          <button key={section.id} className={index === activeSection ? "active" : ""} onClick={() => setActiveSection(index)}>
            <span>{section.index}</span>{section.label}
          </button>
        ))}
        <button className="admin-add-section" onClick={addSection}><Plus size={15} /> New section</button>
      </nav>

      <section className="admin-section-actions" aria-label="Section controls">
        <button className="admin-secondary-button" onClick={() => moveSection(-1)} disabled={activeSection === 0}><ArrowLeft size={15} /> Move left</button>
        <button className="admin-secondary-button" onClick={() => moveSection(1)} disabled={activeSection === content.sections.length - 1}>Move right <ArrowRight size={15} /></button>
        <button className="admin-secondary-button" onClick={duplicateSection}><Copy size={15} /> Duplicate</button>
        <button className="admin-secondary-button danger" onClick={removeSection} disabled={content.sections.length <= 1}><Trash2 size={15} /> Remove</button>
        <span>{content.sections.length} customizable section{content.sections.length === 1 ? "" : "s"}</span>
      </section>

      {notice && <div className={`admin-notice ${notice.type}`}>{notice.message}</div>}
      <SectionEditor
        section={content.sections[activeSection]}
        sectionIndex={activeSection}
        onChange={updateSection}
        onUpload={uploadImage}
        encodeInlineImage={(file) => imageFileToBase64(file, 900, 0.82, 1_400_000)}
        uploading={uploading}
      />
    </main>
  );
}

export function AdminApp() {
  return <Editor />;
}
