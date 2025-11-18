// Indent.js – TipTap v2 custom extension for block indentation
import { Extension } from "@tiptap/core";

const Indent = Extension.create({
  name: "indent",

  addOptions() {
    return {
      types: ["paragraph", "heading", "blockquote"], // Không thêm listItem vì dùng sink/lift built-in cho lists
      min: 0,
      max: 8,
    };
  },

  addGlobalAttributes() {
    return this.options.types.map((type) => ({
      types: [type],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el) => {
            const v = el.getAttribute("data-indent");
            const n = Number(v);
            return Number.isFinite(n) ? Math.max(this.options.min, Math.min(this.options.max, n)) : 0;
          },
          renderHTML: (attrs) => {
            const level = attrs.indent || 0;
            if (!level) return {};
            return {
              "data-indent": String(level),
              style: `margin-left:${level * 10}px;`, // 24px mỗi cấp, inline để không cần CSS class
            };
          },
        },
      },
    }));
  },

  addCommands() {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    return {
      indent:
        () =>
        ({ state, dispatch, chain }) => {
          const { max } = this.options;
          const { tr, selection, doc } = state;
          const { from, to } = selection;

          doc.nodesBetween(from, to, (node, pos) => {
            if (!this.options.types.includes(node.type.name)) return;
            const current = node.attrs.indent || 0;
            const next = clamp(current + 1, 0, max);
            if (next !== current) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          });
          if (tr.docChanged && dispatch) dispatch(tr);
          return tr.docChanged || chain().focus().run();
        },

      outdent:
        () =>
        ({ state, dispatch, chain }) => {
          const { min } = this.options;
          const { tr, selection, doc } = state;
          const { from, to } = selection;

          doc.nodesBetween(from, to, (node, pos) => {
            if (!this.options.types.includes(node.type.name)) return;
            const current = node.attrs.indent || 0;
            const next = clamp(current - 1, min, Infinity);
            if (next !== current) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          });
          if (tr.docChanged && dispatch) dispatch(tr);
          return tr.docChanged || chain().focus().run();
        },
    };
  },
});

export default Indent;