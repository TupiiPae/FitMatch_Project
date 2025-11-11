// admin-app/src/components/Editor/RichTextEditorTiptap.jsx
import React, { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Indent from "./extensions/Indent"; // ⬅️ chỉnh path nếu cần
import { TextSelection } from "prosemirror-state"; // <-- THÊM IMPORT
import "./RichTextEditorTiptap.css";

/**
 * Props:
 *  - valueHtml: string (HTML hiện tại)
 *  - onChangeHtml: (html: string) => void
 *  - label?: string
 *  - placeholder?: string
 *  - minHeight?: number
 *  - readOnly?: boolean
 */
export default function RichTextEditorTiptap({
  valueHtml = "",
  onChangeHtml,
  label,
  placeholder = "Nhập nội dung...",
  minHeight = 220,
  readOnly = false,
}) {
  // Giữ ổn định danh sách extensions
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Tắt bản mặc định để dùng extensions import riêng
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
      // Indent khối (paragraph/heading/blockquote)
      Indent.configure({
        types: ["paragraph", "heading", "blockquote"],
        min: 0,
        max: 8,
      }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    editable: !readOnly,
    extensions,
    content: valueHtml || "",
    autofocus: false,
    onUpdate: ({ editor }) => {
      const html = (editor.getHTML() || "").trim();
      onChangeHtml?.(html);
    },

    // ──────────────────────────────────────────────────────────────
    // Tab / Shift+Tab: thụt lề / giảm lề cho danh sách
    //   • Khi cursor trong listItem → tự động chọn từ item hiện tại
    //     đến cuối list cha và thực hiện sinkListItem / liftListItem
    //   • Ngoài list → dùng indent/outdent khối
    // ──────────────────────────────────────────────────────────────
    editorProps: {
      handleKeyDown(view, event) {
        if (event.key === "Tab" && editor) {
          const { state } = editor;
          const { selection, tr } = state;
          const { $from } = selection;

          // ── 1. Không phải listItem → dùng indent/outdent khối ──
          if ($from.parent.type.name !== "listItem") {
            event.preventDefault();
            if (event.shiftKey) {
              editor.chain().focus().outdent().run();
            } else {
              editor.chain().focus().indent().run();
            }
            return true;
          }

          event.preventDefault();

          // ── 2. Tìm parent list (bulletList / orderedList) ──
          const parentList = $from.node($from.depth - 1);
          if (!parentList || !["bulletList", "orderedList"].includes(parentList.type.name)) {
            return true;
          }

          // Vị trí bắt đầu/kết thúc của list cha
          const listStart = $from.start($from.depth - 1);
          const listEnd = $from.end($from.depth - 1);

          // Vị trí của listItem hiện tại
          const currentItemStart = $from.before($from.depth);

          // Mở rộng selection: từ item hiện tại → cuối list
          const from = currentItemStart;
          const to = listEnd;

          // Tạo selection mới & dispatch
          const newSelection = TextSelection.create(state.doc, from, to);
          const newTr = tr.setSelection(newSelection);
          editor.view.dispatch(newTr);

          // Thực hiện sink / lift
          if (event.shiftKey) {
            if (editor.can().liftListItem("listItem")) {
              editor.chain().focus().liftListItem("listItem").run();
            }
          } else {
            if (editor.can().sinkListItem("listItem")) {
              editor.chain().focus().sinkListItem("listItem").run();
            }
          }

          return true;
        }
        return false;
      },
    },
  });

  // Đồng bộ khi valueHtml thay đổi từ ngoài
  useEffect(() => {
    if (!editor) return;
    const current = (editor.getHTML() || "").trim();
    const incoming = String(valueHtml || "").trim();
    if (current !== incoming) {
      editor.commands.setContent(incoming || "", false);
    }
  }, [valueHtml, editor]);

  // Toolbar actions
  const insertLink = () => {
    if (!editor) return;
    const url = window.prompt("Nhập URL:");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const clearLink = () => editor?.chain().focus().unsetLink().run();

  // ──────────────────────────────────────────────────────────────
  // Helper cho nút toolbar: tăng/giảm lề
  //   • Ưu tiên list → sink/lift
  //   • Fallback sang indent/outdent khối
  //   • Tự động mở rộng selection giống như Tab
  // ──────────────────────────────────────────────────────────────
  const handleIncreaseIndent = () => {
    if (!editor) return;
    const { state } = editor;
    const { selection, tr } = state;
    const { $from } = selection;

    if ($from.parent.type.name === "listItem") {
      const parentList = $from.node($from.depth - 1);
      if (["bulletList", "orderedList"].includes(parentList.type.name)) {
        const listStart = $from.start($from.depth - 1);
        const listEnd = $from.end($from.depth - 1);
        const currentItemStart = $from.before($from.depth);

        const from = currentItemStart;
        const to = listEnd;

        const newSelection = TextSelection.create(state.doc, from, to);
        editor.view.dispatch(tr.setSelection(newSelection));
      }
    }

    if (editor.can().sinkListItem("listItem")) {
      editor.chain().focus().sinkListItem("listItem").run();
    } else {
      editor.chain().focus().indent().run();
    }
  };

  const handleDecreaseIndent = () => {
    if (!editor) return;
    const { state } = editor;
    const { selection, tr } = state;
    const { $from } = selection;

    if ($from.parent.type.name === "listItem") {
      const parentList = $from.node($from.depth - 1);
      if (["bulletList", "orderedList"].includes(parentList.type.name)) {
        const listStart = $from.start($from.depth - 1);
        const listEnd = $from.end($from.depth - 1);
        const currentItemStart = $from.before($from.depth);

        const from = currentItemStart;
        const to = listEnd;

        const newSelection = TextSelection.create(state.doc, from, to);
        editor.view.dispatch(tr.setSelection(newSelection));
      }
    }

    if (editor.can().liftListItem("listItem")) {
      editor.chain().focus().liftListItem("listItem").run();
    } else {
      editor.chain().focus().outdent().run();
    }
  };

  return (
    <div className={`tt-wrap ${readOnly ? "tt-readonly" : ""}`}>
      {label ? <div className="tt-label">{label}</div> : null}
      {!readOnly && editor && (
        <div className="tt-toolbar">
          <button
            type="button"
            className={editor.isActive("bold") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Đậm"
          >
            <i className="fa-solid fa-bold" />
          </button>
          <button
            type="button"
            className={editor.isActive("italic") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Nghiêng"
          >
            <i className="fa-solid fa-italic" />
          </button>
          <button
            type="button"
            className={editor.isActive("underline") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Gạch chân"
          >
            <i className="fa-solid fa-underline" />
          </button>
          <span className="tt-div" />
          <button
            type="button"
            className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="H2"
          >
            H2
          </button>
          <button
            type="button"
            className={editor.isActive("heading", { level: 3 }) ? "active" : ""}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="H3"
          >
            H3
          </button>
          <span className="tt-div" />
          <button
            type="button"
            className={editor.isActive("bulletList") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Danh sách chấm"
          >
            <i className="fa-solid fa-list-ul" />
          </button>
          <button
            type="button"
            className={editor.isActive("orderedList") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Danh sách số"
          >
            <i className="fa-solid fa-list-ol" />
          </button>
          <button
            type="button"
            className={editor.isActive("blockquote") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Trích dẫn"
          >
            <i className="fa-solid fa-quote-left" />
          </button>

          {/* Nút thụt lề / giảm lề */}
          <button type="button" onClick={handleDecreaseIndent} title="Giảm lề">
            <i className="fa-solid fa-outdent" />
          </button>
          <button type="button" onClick={handleIncreaseIndent} title="Tăng lề">
            <i className="fa-solid fa-indent" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={editor.isActive({ textAlign: "left" }) ? "active" : ""}
            title="Căn trái"
          >
            <i className="fa-solid fa-align-left" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={editor.isActive({ textAlign: "center" }) ? "active" : ""}
            title="Căn giữa"
          >
            <i className="fa-solid fa-align-center" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={editor.isActive({ textAlign: "right" }) ? "active" : ""}
            title="Căn phải"
          >
            <i className="fa-solid fa-align-right" />
          </button>
          <span className="tt-div" />
          <button type="button" onClick={insertLink} title="Chèn link">
            <i className="fa-solid fa-link" />
          </button>
          <button type="button" onClick={clearLink} title="Bỏ link">
            <i className="fa-solid fa-link-slash" />
          </button>
          <span className="tt-flex" />
          <button type="button" onClick={() => editor.commands.undo()} title="Hoàn tác">
            <i className="fa-solid fa-rotate-left" />
          </button>
          <button type="button" onClick={() => editor.commands.redo()} title="Làm lại">
            <i className="fa-solid fa-rotate-right" />
          </button>
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().clearNodes().unsetAllMarks().run();
            }}
            title="Xoá toàn bộ định dạng"
          >
            <i className="fa-regular fa-square" />
          </button>
        </div>
      )}
      <div className="tt-editor" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}