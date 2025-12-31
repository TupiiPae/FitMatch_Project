import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { listAiMessages, sendAiChat, uploadAiImage } from "../../api/ai";
import "./ChatBox.css"; // reuse style .fm-chat

const safeArr = (v) => (Array.isArray(v) ? v : []);
const sameDay = (a, b) =>
  dayjs(a).isValid() &&
  dayjs(b).isValid() &&
  dayjs(a).format("YYYY-MM-DD") === dayjs(b).format("YYYY-MM-DD");

const clip = (s, n = 90) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

const isImg = (a) => String(a?.type || "image") === "image" && !!a?.url;

export default function AiChatBox({ meId, height = 520, onPreview, emptyText }) {
  const myId = String(meId || "");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  // ===== File preview urls =====
  const fileUrlMapRef = useRef(new Map());
    // ===== stable ref for onPreview (tránh gọi setState của cha trong updater) =====
  const onPreviewRef = useRef(onPreview);
  useEffect(() => {
    onPreviewRef.current = onPreview;
  }, [onPreview]);

  const fileUrl = (f) => {
    const m = fileUrlMapRef.current;
    if (!m.has(f)) m.set(f, URL.createObjectURL(f));
    return m.get(f);
  };
  useEffect(() => {
    const m = fileUrlMapRef.current;
    const cur = new Set(files);
    for (const [k, u] of m.entries()) {
      if (!cur.has(k)) {
        try { URL.revokeObjectURL(u); } catch {}
        m.delete(k);
      }
    }
  }, [files]);
  useEffect(() => () => {
    const m = fileUrlMapRef.current;
    for (const u of m.values()) {
      try { URL.revokeObjectURL(u); } catch {}
    }
    m.clear();
  }, []);

  const scrollBottom = (smooth = false) => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      else el.scrollTop = el.scrollHeight;
    });
  };

  const updatePreviewFromItems = (arr) => {
    const last = arr?.length ? arr[arr.length - 1] : null;
    const lastText = last?.content
      ? clip(last.content, 60)
      : (safeArr(last?.attachments).length ? "📷 Hình ảnh" : "");
    const lastAt = last?.createdAt || null;

    onPreviewRef.current?.({ lastText: lastText || "Nhắn để bắt đầu…", lastAt });
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAiMessages({ limit: 80 });
      const arr = safeArr(data?.items)
        .filter(Boolean)
        .sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0));

      setItems(arr);
      updatePreviewFromItems(arr);
      scrollBottom(false);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Không tải được AI chat");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updatePreviewFromItems(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);


  const pickFiles = () => fileRef.current?.click?.();

  const pushFiles = (list) => {
    const ok = [];
    for (const f of list || []) {
      if (!String(f?.type || "").startsWith("image/")) {
        toast.info("AI chỉ hỗ trợ ảnh.");
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.info("Ảnh phải nhỏ hơn 5MB.");
        continue;
      }
      ok.push(f);
    }
    if (!ok.length) return;
    setFiles((prev) => [...prev, ...ok].slice(0, 6));
  };

  const onPickFile = (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;
    pushFiles(list);
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const timeline = useMemo(() => {
    const arr = safeArr(items);
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      const p = arr[i - 1];

      if (i === 0 && m?.createdAt) {
        out.push({ t: "date", k: `d0_${m.createdAt}`, v: dayjs(m.createdAt).format("DD/MM/YYYY") });
      } else if (m?.createdAt && p?.createdAt && !sameDay(m.createdAt, p.createdAt)) {
        out.push({ t: "date", k: `d_${m.createdAt}`, v: dayjs(m.createdAt).format("DD/MM/YYYY") });
      }

      out.push({ t: "msg", k: String(m?._id || i), m });
    }
    return out;
  }, [items]);

  const send = async () => {
    const content = String(text || "").trim();
    if (!content && !files.length) return;

    const tmpId = `tmp_ai_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tmpUser = {
      _id: tmpId,
      role: "user",
      userId: myId,
      content,
      attachments: [],
      createdAt: new Date().toISOString(),
      _tmp: true,
    };

    setSending(true);
    setText("");
    setItems((prev) => [...prev, tmpUser]);
    scrollBottom(true);

    let imageUrls = [];
    try {
      if (files.length) {
        setUploading(true);
        for (const f of files) {
          const up = await uploadAiImage(f);
          if (up?.url) imageUrls.push(up.url);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Upload ảnh thất bại");
      setItems((prev) => prev.filter((x) => String(x?._id || "") !== tmpId));
      setSending(false);
      setUploading(false);
      return;
    } finally {
      setUploading(false);
      setFiles([]);
    }

    // gắn attachments vào tmp (để UI thấy ảnh ngay)
    if (imageUrls.length) {
      setItems((prev) =>
        prev.map((x) =>
          String(x?._id || "") === tmpId
            ? {
                ...x,
                attachments: imageUrls.map((u) => ({ type: "image", url: u })),
              }
            : x
        )
      );
    }

    try {
      const res = await sendAiChat({
        text: content,
        imageUrls,
        // intent: "meal_scan" | "menu_recommend" | "plan_recommend" (mình sẽ hoàn thiện ở server)
      });

      const userServer = res?.userMessage || res?.data?.userMessage || null;
      const assistant =
        res?.assistantMessage ||
        res?.message ||
        res?.data?.assistantMessage ||
        res?.data?.message ||
        null;

      const assistantItems = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.messages)
        ? res.messages
        : assistant
        ? [assistant]
        : [];

    setItems((prev) => {
      const filtered = prev.filter((x) => String(x?._id || "") !== tmpId);
      const mergedUser = userServer
        ? userServer
        : {
            ...tmpUser,
            _tmp: false,
            attachments: imageUrls.map((u) => ({ type: "image", url: u })),
          };

      const next = [
        ...filtered,
        mergedUser,
        ...assistantItems.filter(Boolean),
      ].sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0));

      return next;
    });

      scrollBottom(true);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Không thể gửi đến AI");
      // giữ tmp để user không mất nội dung (tuỳ bạn), hoặc xoá tmp:
      // setItems((prev) => prev.filter((x) => String(x?._id || "") !== tmpId));
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus?.());
    }
  };

  return (
    <div className="fm-chat" style={{ height }}>
      <div ref={listRef} className="fm-chat-list">
        {loading ? <div className="fm-chat-loading">Đang tải…</div> : null}

        {!loading && !items.length ? (
          <div className="fm-chat-empty">{emptyText || "Bắt đầu hỏi FitMatch AI… (có thể gửi kèm ảnh món ăn)"}</div>
        ) : null}

        {timeline.map((row) => {
          if (row.t === "date") {
            return (
              <div key={row.k} className="fm-chat-date">
                <span>{row.v}</span>
              </div>
            );
          }

          const m = row.m;
          const mine = String(m?.role || "") === "user";
          const imgs = safeArr(m?.attachments).filter(isImg);
          const hasImgs = imgs.length > 0;
          const hasText = !!String(m?.content ?? m?.text ?? "").trim();
          const cols = Math.min(3, Math.max(1, imgs.length));

          return (
            <div key={row.k} className={"fm-chat-row" + (mine ? " is-mine" : "")}>
              {!mine ? (
                <div className="fm-chat-ava" title="FitMatch AI" style={{ cursor: "default" }}>
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(239,68,68,.18)",
                      color: "#fff",
                    }}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles" />
                  </div>
                </div>
              ) : null}

              <div className={"fm-chat-main" + (mine ? " is-mine" : "")}>
                <div className={"fm-chat-bubblewrap" + (mine ? " is-mine" : "")}>
                  {(hasText || !hasImgs) && (
                    <div className={"fm-chat-bubble" + (mine ? " is-mine" : "")}>
                      {hasText ? <div className="fm-chat-text">{m.content ?? m.text}</div> : null}
                      <div className={"fm-chat-time" + (mine ? " is-mine" : "")}>
                        {m?.createdAt ? dayjs(m.createdAt).format("HH:mm") : ""}
                      </div>
                    </div>
                  )}

                  {hasImgs && (
                    <div className={"fm-chat-bubble is-media" + (mine ? " is-mine" : "")}>
                      <div className={"fm-chat-atts cols-" + cols}>
                        {imgs.map((a, idx) => (
                          <div key={`${a.url || idx}`} className="fm-chat-img" title="Ảnh">
                            <img src={a.url} alt={a.name || "image"} />
                          </div>
                        ))}
                      </div>
                      <div className={"fm-chat-time" + (mine ? " is-mine" : "")}>
                        {m?.createdAt ? dayjs(m.createdAt).format("HH:mm") : ""}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div />
      </div>

      <div className="fm-chat-compose">
        <div className="fm-chat-inputrow">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickFile} />

          <button type="button" className="fm-chat-attach" onClick={pickFiles} title="Gửi hình ảnh cho AI">
            <i className="fa-regular fa-images" />
          </button>

          <div className="fm-chat-inputwrap">
            {!!files.length && (
              <div className="fm-chat-draftimgs">
                {files.map((f, idx) => (
                  <div key={idx} className="fm-chat-draftimg">
                    <img src={fileUrl(f)} alt={f.name} />
                    <button
                      type="button"
                      className="fm-chat-draftimg-x"
                      onClick={() => removeFile(idx)}
                      aria-label="Xóa ảnh"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="fm-chat-inputbox">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  const el = e.target;
                  el.style.height = "0px";
                  el.style.height = Math.min(el.scrollHeight, 140) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    send();
                  }
                }}
                placeholder={uploading ? "Đang tải ảnh…" : "Nhập câu hỏi cho AI…"}
                className="fm-chat-input fm-chat-textarea"
                disabled={uploading}
                rows={1}
              />
            </div>
          </div>

          <button
            type="button"
            className="fm-chat-send"
            onClick={send}
            disabled={sending || uploading}
            title="Gửi"
          >
            <i className="fa-regular fa-paper-plane" />
          </button>
        </div>

        <div className="fm-chat-note">
          Gợi ý: bạn có thể gửi ảnh món ăn để AI ước lượng calo/macros (sẽ hoàn thiện khi patch server).
        </div>
      </div>
    </div>
  );
}
