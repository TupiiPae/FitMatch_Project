// user-app/src/pages/Chat/AiChatBox.jsx
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { listAiMessages, sendAiChat, uploadAiImage } from "../../api/ai";
import { toggleSaveSuggestMenu } from "../../api/suggestMenus";

import "./AiChatBox.css"; 

import DetailModal from "../Nutrition/components/DetailModal/DetailModal";
import { getFood } from "../../api/foods";
import api from "../../lib/api";

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

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (Number.isFinite(n)) return String(n);
  return String(v);
};

const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== "");

export default function AiChatBox({ meId, height = 520, onPreview, emptyText }) {
  const nav = useNavigate();
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

  // ===== Image viewer (giống ChatBox) =====
  const [imgView, setImgView] = useState(null);
  const closeImg = () => setImgView(null);

  useEffect(() => {
    if (!imgView) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeImg();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imgView]);

  useEffect(() => {
    if (!imgView) return;
    const b = document.body;
    const prevOverflow = b.style.overflow;
    b.style.overflow = "hidden";
    return () => {
      b.style.overflow = prevOverflow;
    };
  }, [imgView]);

  const openImgView = (a) => {
    const url = toAbs(a?.url);
    if (!url) return;
    setImgView({ url, name: a?.name || "Ảnh" });
  };

  // ===== DetailModal state =====
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFood, setDetailFood] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ===== SuggestMenu saving state =====
  const [savingMenuMap, setSavingMenuMap] = useState({}); // { [menuId]: true/false }

  // ===== File preview urls =====
  const fileUrlMapRef = useRef(new Map());

  // ===== stable ref for onPreview =====
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
        try {
          URL.revokeObjectURL(u);
        } catch {}
        m.delete(k);
      }
    }
  }, [files]);

  useEffect(
    () => () => {
      const m = fileUrlMapRef.current;
      for (const u of m.values()) {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      }
      m.clear();
    },
    []
  );

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
      : safeArr(last?.attachments).length
      ? "📷 Hình ảnh"
      : "";
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

  const goCreateFood = (draft) => {
    if (!draft) return;
    try {
      sessionStorage.setItem("fm_ai_food_prefill", JSON.stringify(draft));
    } catch {}
    nav("/dinh-duong/ghi-lai/tao-mon", { state: { aiPrefill: draft } });
  };

  // auto navigate nếu BE trả action=create_food
  const lastAutoNavRef = useRef("");
  useEffect(() => {
    const last = [...safeArr(items)].reverse().find(
      (m) =>
        String(m?.role) === "assistant" &&
        m?.meta?.action === "create_food" &&
        m?.meta?.foodDraft
    );
    if (!last) return;
    if (lastAutoNavRef.current === String(last._id)) return;
    lastAutoNavRef.current = String(last._id);
    goCreateFood(last.meta.foodDraft);
  }, [items]);

  // ===== open DetailModal for a food =====
  const closeFoodDetail = () => {
    setDetailOpen(false);
    setDetailFood(null);
  };

  const openFoodDetail = async (foodLike) => {
    const id = String(pick(foodLike?.id, foodLike?._id) || "");
    if (!id) {
      setDetailFood(foodLike || null);
      setDetailOpen(true);
      return;
    }

    setDetailLoading(true);
    try {
      const r = await getFood(id);
      const data = r?.data?.data ?? r?.data ?? r;
      if (!data) throw new Error("Empty food");
      setDetailFood(data);
      setDetailOpen(true);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Không tải được chi tiết món ăn");
    } finally {
      setDetailLoading(false);
    }
  };

  // ===== SuggestMenu helpers (merge AiSuggestMenu vào đây) =====
  const getSuggestMenusFromMeta = (meta) => {
    if (!meta) return [];
    const a = pick(meta?.suggestMenus, meta?.suggestedMenus, meta?.menus, meta?.menuSuggestions);
    const b = meta?.suggestMenu ? [meta.suggestMenu] : [];
    const out = safeArr(a).length ? safeArr(a) : b;
    return out.filter(Boolean);
  };

  const menuIdOf = (menu) => String(pick(menu?._id, menu?.id, menu?.menuId) || "");
  const menuNameOf = (menu) => String(pick(menu?.name, menu?.title, menu?.menuName) || "Thực đơn");
  const menuImgOf = (menu) => toAbs(pick(menu?.imageUrl, menu?.thumbUrl, menu?.coverUrl, menu?.thumbnail) || "");
  const menuKcalOf = (menu) =>
    pick(
      menu?.kcalPerDay,
      menu?.kcalDay,
      menu?.dayKcal,
      menu?.targetKcal,
      menu?.totalKcal,
      menu?.totalCalories
    );
  const menuDaysOf = (menu) => pick(menu?.days, menu?.numDays, menu?.dayCount);

  const menuSavedOf = (menu) =>
    !!pick(menu?.isSaved, menu?.saved, menu?.savedByMe, menu?.isBookmarked);

  const patchSuggestMenusInMessage = (msg, menuId, patch) => {
    if (!msg?.meta) return msg;
    const meta = msg.meta;

    const keys = ["suggestMenus", "suggestedMenus", "menus", "menuSuggestions"];
    let changed = false;
    const nextMeta = { ...meta };

    for (const k of keys) {
      if (Array.isArray(meta?.[k])) {
        const nextArr = meta[k].map((mn) => {
          if (!mn) return mn;
          const id = menuIdOf(mn);
          if (id && id === menuId) {
            changed = true;
            return { ...mn, ...patch };
          }
          return mn;
        });
        nextMeta[k] = nextArr;
      }
    }

    if (meta?.suggestMenu && menuIdOf(meta.suggestMenu) === menuId) {
      changed = true;
      nextMeta.suggestMenu = { ...meta.suggestMenu, ...patch };
    }

    return changed ? { ...msg, meta: nextMeta } : msg;
  };

  const patchMenuSavedEverywhere = (menuId, saved) => {
    setItems((prev) =>
      prev.map((msg) =>
        String(msg?.role) === "assistant"
          ? patchSuggestMenusInMessage(msg, menuId, { isSaved: saved, saved })
          : msg
      )
    );
  };

  const goSuggestMenuDetail = (menu) => {
    const id = menuIdOf(menu);
    if (!id) return;
    // Nếu route của bạn khác, chỉ cần đổi path ở đây:
    nav(`/dinh-duong/thuc-don-goi-y/${id}`, { state: { fromAiChat: true } });
  };

  const toggleSaveMenu = async (menu) => {
    const id = menuIdOf(menu);
    if (!id) return;

    if (savingMenuMap[id]) return;

    const curSaved = menuSavedOf(menu);
    const optimistic = !curSaved;

    // optimistic update
    patchMenuSavedEverywhere(id, optimistic);
    setSavingMenuMap((p) => ({ ...p, [id]: true }));

    try {
      const r = await toggleSaveSuggestMenu(id);

      // cố gắng đọc trạng thái saved từ response
      const savedFromRes = pick(
        r?.data?.data?.saved,
        r?.data?.data?.isSaved,
        r?.data?.saved,
        r?.data?.isSaved,
        r?.saved,
        r?.isSaved
      );

      if (savedFromRes !== undefined) {
        patchMenuSavedEverywhere(id, !!savedFromRes);
      }
    } catch (e) {
      console.error(e);
      // revert
      patchMenuSavedEverywhere(id, curSaved);
      toast.error(e?.response?.data?.message || "Không thể lưu/bỏ lưu thực đơn");
    } finally {
      setSavingMenuMap((p) => ({ ...p, [id]: false }));
    }
  };

  // ===== timeline + dồn time (giống ChatBox) =====
  const timeline = useMemo(() => {
    const arr = safeArr(items);

    const idOf = (m, i) => String(m?._id || i || "");
    const roleOf = (m) => String(m?.role || "");
    const isImageOnlyMsg = (m) => {
      const imgs = safeArr(m?.attachments).filter(isImg);
      const hasImgs = imgs.length > 0;
      const hasText = !!String(m?.content ?? m?.text ?? "").trim();
      return hasImgs && !hasText;
    };

    const timeAtById = new Map();
    for (let i = 0; i < arr.length; ) {
      const base = arr[i];
      const r0 = roleOf(base);
      const baseAt = base?.createdAt;

      let j = i;
      while (j < arr.length) {
        const mj = arr[j];
        if (roleOf(mj) !== r0) break;

        if (baseAt && mj?.createdAt && !sameDay(mj.createdAt, baseAt)) break;
        if (baseAt && !mj?.createdAt) break;
        if (!baseAt && mj?.createdAt) break;

        j++;
      }

      const endMsg = arr[j - 1];
      const endAt = endMsg?.createdAt || null;

      if (endAt) {
        let ownerKey = "";
        for (let k = j - 1; k >= i; k--) {
          if (!isImageOnlyMsg(arr[k])) {
            ownerKey = idOf(arr[k], k);
            break;
          }
        }
        if (ownerKey) timeAtById.set(ownerKey, endAt);
      }

      i = j;
    }

    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      const p = arr[i - 1];

      if (i === 0 && m?.createdAt) {
        out.push({
          t: "date",
          k: `d0_${m.createdAt}`,
          v: dayjs(m.createdAt).format("DD/MM/YYYY"),
        });
      } else if (m?.createdAt && p?.createdAt && !sameDay(m.createdAt, p.createdAt)) {
        out.push({
          t: "date",
          k: `d_${m.createdAt}`,
          v: dayjs(m.createdAt).format("DD/MM/YYYY"),
        });
      }

      const key = idOf(m, i);
      out.push({ t: "msg", k: key, m, timeAt: timeAtById.get(key) || null });
    }

    return out;
  }, [items]);

  // ====== SEND ======
  const send = async (overrideText) => {
    const isOverride = overrideText !== undefined;
    const content = String(isOverride ? overrideText : text || "").trim();
    const sendFiles = isOverride ? [] : files;

    if (!content && !sendFiles.length) return;

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
      if (sendFiles.length) {
        setUploading(true);
        for (const f of sendFiles) {
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
      if (!isOverride) setFiles([]);
    }

    // gắn attachments vào tmp
    if (imageUrls.length) {
      setItems((prev) =>
        prev.map((x) =>
          String(x?._id || "") === tmpId
            ? { ...x, attachments: imageUrls.map((u) => ({ type: "image", url: u })) }
            : x
        )
      );
    }

    try {
      const res = await sendAiChat({ text: content, imageUrls });

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

        const next = [...filtered, mergedUser, ...assistantItems.filter(Boolean)].sort(
          (a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0)
        );

        return next;
      });

      scrollBottom(true);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Không thể gửi đến AI");
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus?.());
    }
  };

  return (
    <div className="fm-chat fm-ai-chat" style={{ height }}>
      {imgView?.url && (
        <div
          className="fm-chat-imgview"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeImg();
          }}
        >
          <button
            type="button"
            className="fm-chat-imgview-x"
            onClick={closeImg}
            aria-label="Đóng"
          >
            <i className="fa-solid fa-xmark" />
          </button>

          <div className="fm-chat-imgview-box">
            <img
              src={imgView.url}
              alt={imgView.name || "image"}
              onError={(e) => {
                e.currentTarget.alt = "Ảnh lỗi";
              }}
            />
          </div>
        </div>
      )}

      <div ref={listRef} className="fm-chat-list">
        {loading ? <div className="fm-chat-loading">Đang tải…</div> : null}

        {!loading && !items.length ? (
          <div className="fm-chat-empty">
            {emptyText || "Bắt đầu hỏi FitMatch AI… (có thể gửi kèm ảnh món ăn)"}
          </div>
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

          const timeAt = row.timeAt;
          const timeNode = timeAt ? (
            <div className={"fm-chat-time" + (mine ? " is-mine" : "")}>
              {dayjs(timeAt).isValid() ? dayjs(timeAt).format("HH:mm") : ""}
            </div>
          ) : null;

          // ===== AI: create food card =====
          const offerFood = !mine && m?.meta?.offerCreateFood && m?.meta?.foodDraft;
          const draft = offerFood ? m.meta.foodDraft : null;
          const similarFoods = offerFood ? safeArr(m?.meta?.similarFoods) : [];
          const hasSimilar = offerFood ? !!m?.meta?.hasSimilar : false;

          // ===== AI: suggest menu card (merge) =====
          const suggestMenus = !mine ? getSuggestMenusFromMeta(m?.meta) : [];
          const hasSuggestMenus = suggestMenus.length > 0;
          const targetKcalHint = pick(
            m?.meta?.targetKcal,
            m?.meta?.goalKcal,
            m?.meta?.userTargetKcal,
            m?.meta?.caloTarget
          );

          return (
            <div key={row.k} className={"fm-chat-row" + (mine ? " is-mine" : "")}>
              {!mine ? (
                <div className="fm-chat-ava" title="FitMatch AI" style={{ cursor: "default" }}>
                  <img
                    src="/images/ai-avatar.png"
                    alt="FitMatch AI"
                    onError={(e) => {
                      e.currentTarget.src = "/images/avatar.png";
                    }}
                  />
                </div>
              ) : null}

              <div className={"fm-chat-main" + (mine ? " is-mine" : "")}>
                <div className={"fm-chat-bubblewrap" + (mine ? " is-mine" : "")}>
                  {(hasText || !hasImgs) && (
                    <div className={"fm-chat-bubble" + (mine ? " is-mine" : "")}>
                      {hasText ? (
                        <div className="fm-chat-text" style={{ whiteSpace: "pre-wrap" }}>
                          {m.content ?? m.text}
                        </div>
                      ) : null}
                      {timeNode}
                    </div>
                  )}

                  {/* Image bubble (KHÔNG render time) */}
                  {hasImgs && (
                    <div className={"fm-chat-bubble is-media" + (mine ? " is-mine" : "")}>
                      <div className={"fm-chat-atts cols-" + cols}>
                        {imgs.map((a, idx) => {
                          const abs = toAbs(a.url);
                          return (
                            <button
                              key={`${a.url || idx}`}
                              type="button"
                              className="fm-chat-img"
                              title="Xem ảnh"
                              onClick={() => openImgView({ ...a, url: abs })}
                            >
                              <img
                                src={abs}
                                alt={a.name || "image"}
                                onError={(e) => {
                                  e.currentTarget.src = "/images/food-placeholder.png";
                                }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ===== AI FOOD CARD ===== */}
                  {offerFood && draft ? (
                    <div className="fm-ai-card">
                      <div className="fm-ai-title">Ước lượng từ ảnh</div>

                      <div className="fm-ai-macros">
                        <div>
                          <b>Kcal:</b> {fmt(draft.kcal)}
                        </div>
                        <div>
                          <b>P:</b> {fmt(draft.proteinG)}g
                        </div>
                        <div>
                          <b>C:</b> {fmt(draft.carbG)}g
                        </div>
                        <div>
                          <b>F:</b> {fmt(draft.fatG)}g
                        </div>
                        <div>
                          <b>Khẩu phần:</b> {draft.portionName || "1 phần"} • {fmt(draft.massG)}
                          {draft.unit || "g"}
                        </div>
                      </div>

                      <div className="fm-ai-similar">
                        {hasSimilar ? (
                          <>
                            Đã có món tương tự trong FitMatch:
                            <div className="fm-ai-simlist">
                              {similarFoods.slice(0, 5).map((f) => (
                                <div
                                  key={String(f?.id || f?._id || f?.name)}
                                  className="fm-ai-simitem"
                                  role="button"
                                  tabIndex={0}
                                  title="Xem chi tiết"
                                  onClick={() => openFoodDetail(f)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") openFoodDetail(f);
                                  }}
                                >
                                  <img
                                    src={toAbs(f.imageUrl) || "/images/food-placeholder.png"}
                                    alt=""
                                    onError={(e) => {
                                      e.currentTarget.src = "/images/food-placeholder.png";
                                    }}
                                  />
                                  <div>
                                    <div className="fm-ai-simname">{f.name}</div>
                                    <div className="fm-ai-simsub">
                                      {fmt(f.kcal)} kcal • {fmt(f.massG)}
                                      {f.unit || "g"}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>Chưa thấy món tương tự trong danh sách hiện tại.</>
                        )}
                      </div>

                      <div className="fm-ai-actions">
                        <button type="button" className="fm-ai-btn ghost" onClick={() => send("Không")}>
                          Không
                        </button>
                        <button type="button" className="fm-ai-btn" onClick={() => goCreateFood(draft)}>
                          Tạo món
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* ===== AI SUGGEST MENU CARD (MERGED) ===== */}
                  {hasSuggestMenus ? (
                    <div className="fm-ai-card fm-ai-card-menu">
                      <div className="fm-ai-title">Thực đơn gợi ý</div>

                      {targetKcalHint !== undefined && targetKcalHint !== null && targetKcalHint !== "" ? (
                        <div className="fm-ai-menuhint">
                          Phù hợp mục tiêu: <b>{fmt(targetKcalHint)}</b> kcal/ngày
                        </div>
                      ) : null}

                      <div className="fm-ai-menulist">
                        {suggestMenus.slice(0, 6).map((mn) => {
                          const id = menuIdOf(mn);
                          const name = menuNameOf(mn);
                          const img = menuImgOf(mn) || "/images/food-placeholder.png";
                          const kcal = menuKcalOf(mn);
                          const days = menuDaysOf(mn);
                          const saved = menuSavedOf(mn);
                          const saving = !!savingMenuMap[id];

                          return (
                            <div
                              key={id || name}
                              className="fm-ai-menuitem"
                              role="button"
                              tabIndex={0}
                              title="Xem chi tiết thực đơn"
                              onClick={() => goSuggestMenuDetail(mn)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") goSuggestMenuDetail(mn);
                              }}
                            >
                              <img
                                src={img}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.src = "/images/food-placeholder.png";
                                }}
                              />

                              <div className="fm-ai-menuinfo">
                                <div className="fm-ai-simname">{name}</div>
                                <div className="fm-ai-simsub">
                                  {kcal !== undefined && kcal !== null && kcal !== "" ? (
                                    <>
                                      {fmt(kcal)} kcal/ngày
                                      {days !== undefined && days !== null && days !== "" ? " • " : ""}
                                    </>
                                  ) : null}
                                  {days !== undefined && days !== null && days !== "" ? (
                                    <>{fmt(days)} ngày</>
                                  ) : null}
                                </div>
                              </div>

                              <button
                                type="button"
                                className={"fm-ai-savebtn" + (saved ? " is-saved" : "")}
                                disabled={!id || saving}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleSaveMenu(mn);
                                }}
                                title={saved ? "Bỏ lưu" : "Lưu thực đơn"}
                              >
                                {saving ? "…" : saved ? "Đã lưu" : "Lưu"}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="fm-ai-actions">
                        <button
                          type="button"
                          className="fm-ai-btn ghost"
                          onClick={() => nav("/dinh-duong/thuc-don-goi-y")}
                        >
                          Xem tất cả
                        </button>
                      </div>
                    </div>
                  ) : null}
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

          <button
            type="button"
            className="fm-chat-attach"
            onClick={pickFiles}
            title="Gửi hình ảnh cho AI"
            disabled={uploading || sending}
          >
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
            onClick={() => send()}
            disabled={sending || uploading}
            title="Gửi"
          >
            <i className="fa-regular fa-paper-plane" />
          </button>
        </div>
      </div>

      <DetailModal open={detailOpen} food={detailFood} onClose={closeFoodDetail} />

      {/* giữ lại loading để không bị eslint unused */}
      {detailLoading ? <div className="fm-ai-detailloading">Đang tải chi tiết…</div> : null}
    </div>
  );
}
