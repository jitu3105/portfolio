import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) => attributes.fontSize
            ? { style: `font-size: ${attributes.fontSize}` }
            : {},
        },
      },
    }];
  },
});

const extensions = [
  StarterKit.configure({ link: false, underline: false }),
  Underline,
  Link.configure({ openOnClick: false, autolink: true }),
  Image.configure({ allowBase64: true, inline: false }),
  TextStyle,
  FontSize,
  Color,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  encodeImage: (file: File) => Promise<string>;
};

function ToolButton({
  editor,
  active = false,
  title,
  onPress,
  children,
}: {
  editor: Editor;
  active?: boolean;
  title: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      title={title}
      onMouseDown={(event) => {
        event.preventDefault();
        onPress();
      }}
      disabled={!editor.isEditable}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, encodeImage }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);
  const editor = useEditor({
    extensions,
    content: value,
    onUpdate: ({ editor: nextEditor }) => onChange(nextEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <div className="admin-rich-loading">Preparing rich-text canvas…</div>;

  const editLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", current ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  const insertImage = async (file: File) => {
    setUploading(true);
    try {
      const src = await encodeImage(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-rich-editor">
      <div className="admin-rich-toolbar" aria-label="Rich text formatting">
        <select
          aria-label="Text style"
          value={
            editor.isActive("heading", { level: 1 }) ? "h1" :
              editor.isActive("heading", { level: 2 }) ? "h2" :
              editor.isActive("heading", { level: 3 }) ? "h3" : "p"
          }
          onChange={(event) => {
            const value = event.target.value;
            if (value === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
            else if (value === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (value === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
            else editor.chain().focus().setParagraph().run();
          }}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Display title</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <select
          aria-label="Font size"
          value={editor.getAttributes("textStyle").fontSize ?? ""}
          onChange={(event) => {
            const fontSize = event.target.value;
            editor.chain().focus().setMark("textStyle", { fontSize: fontSize || null }).run();
          }}
        >
          <option value="">Auto size</option>
          {[10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 80, 96].map((size) => (
            <option key={size} value={`${size}px`}>{size}px</option>
          ))}
        </select>
        <ToolButton editor={editor} title="Bold" active={editor.isActive("bold")} onPress={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolButton>
        <ToolButton editor={editor} title="Italic" active={editor.isActive("italic")} onPress={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolButton>
        <ToolButton editor={editor} title="Underline" active={editor.isActive("underline")} onPress={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></ToolButton>
        <ToolButton editor={editor} title="Strike" active={editor.isActive("strike")} onPress={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolButton>
        <ToolButton editor={editor} title="Bulleted list" active={editor.isActive("bulletList")} onPress={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolButton>
        <ToolButton editor={editor} title="Numbered list" active={editor.isActive("orderedList")} onPress={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolButton>
        <ToolButton editor={editor} title="Quote" active={editor.isActive("blockquote")} onPress={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolButton>
        <ToolButton editor={editor} title="Align left" active={editor.isActive({ textAlign: "left" })} onPress={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={15} /></ToolButton>
        <ToolButton editor={editor} title="Align center" active={editor.isActive({ textAlign: "center" })} onPress={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={15} /></ToolButton>
        <ToolButton editor={editor} title="Align right" active={editor.isActive({ textAlign: "right" })} onPress={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={15} /></ToolButton>
        <ToolButton editor={editor} title="Link" active={editor.isActive("link")} onPress={editLink}><Link2 size={15} /></ToolButton>
        <label className="admin-rich-image" title="Insert Base64 image">
          {uploading ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void insertImage(file);
              event.target.value = "";
            }}
          />
        </label>
        <label className="admin-rich-color" title="Text color">
          <input
            type="color"
            value={editor.getAttributes("textStyle").color ?? "#aeb9ca"}
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
        </label>
        <ToolButton editor={editor} title="Undo" onPress={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></ToolButton>
        <ToolButton editor={editor} title="Redo" onPress={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
