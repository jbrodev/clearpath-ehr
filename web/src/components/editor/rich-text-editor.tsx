"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  /** Compact toolbar (fewer buttons). */
  compact?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  className,
  editable = true,
  compact = false,
}: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-3 [&_p]:my-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold",
      },
    },
    immediatelyRender: false,
  });

  // Keep editor content in sync if value changes externally (e.g. after a load).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      {editable && <Toolbar editor={editor} compact={compact} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  compact,
}: {
  editor: Editor | null;
  compact: boolean;
}) {
  if (!editor) return null;

  const btn = (active: boolean) =>
    cn(
      "rounded px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors",
      active && "bg-accent text-accent-foreground",
    );

  return (
    <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
        title="Italic"
      >
        <i>I</i>
      </button>
      {!compact && (
        <>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={btn(editor.isActive("heading", { level: 2 }))}
            title="Heading"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={btn(editor.isActive("heading", { level: 3 }))}
            title="Subheading"
          >
            H3
          </button>
        </>
      )}
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        title="Bulleted list"
      >
        •
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        title="Numbered list"
      >
        1.
      </button>
      {!compact && (
        <>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={btn(editor.isActive("blockquote"))}
            title="Quote"
          >
            “”
          </button>
        </>
      )}
    </div>
  );
}
