import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getChatMessages, uploadChatImage } from "../../api/chat";
import { getSocket } from "../../lib/socket";
import "./ChatBox.css";

const safeArr=v=>Array.isArray(v)?v:[];
const uniq=(arr)=>{const m=new Map();for(const x of safeArr(arr)){const k=String(x?._id||x?.clientMsgId||"");if(k)m.set(k,x);}return Array.from(m.values()).sort((a,b)=>new Date(a?.createdAt||0)-new Date(b?.createdAt||0));};
const sameDay=(a,b)=>dayjs(a).isValid()&&dayjs(b).isValid()&&dayjs(a).format("YYYY-MM-DD")===dayjs(b).format("YYYY-MM-DD");
const clip=(s,n=80)=>{const t=String(s||"").replace(/\s+/g," ").trim();return t.length>n?t.slice(0,n-1)+"…":t;};

const EMOJIS=[{k:"like",c:"👍",t:"Thích"},{k:"heart",c:"❤️",t:"Tim"},{k:"laugh",c:"😂",t:"Cười"},{k:"sad",c:"😢",t:"Buồn"},{k:"angry",c:"😡",t:"Phẫn nộ"}];
const emojiChar=(key)=>EMOJIS.find(x=>x.k===key)?.c||"";
const isImg=(a)=>String(a?.type||"image")==="image" && !!a?.url;

export default function ChatBox({ conversationId, meId, members=[], height=520, onOpenUser }){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);

  const [text,setText]=useState("");
  const [sending,setSending]=useState(false);

  const [replyTo,setReplyTo]=useState(null); // message object
  const [pickerOpen,setPickerOpen]=useState(false); // emoji for input
  const [reactFor,setReactFor]=useState(null); // messageId (open reaction bar)
  const [files,setFiles]=useState([]); // File[]
  const [uploading,setUploading]=useState(false);

  const listRef=useRef(null);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  const fileRef=useRef(null);

  const socket=useMemo(()=>getSocket(),[]);
  const myId=String(meId||"");

  const memberMap=useMemo(()=>{
    const m=new Map();
    safeArr(members).forEach(x=>{const id=String(x?.id||x?._id||""); if(id) m.set(id,x);});
    return m;
  },[members]);

  const msgMap=useMemo(()=>{
    const m=new Map();
    safeArr(items).forEach(x=>{const id=String(x?._id||""); if(id && !String(id).startsWith("tmp_")) m.set(id,x);});
    return m;
  },[items]);

  const scrollBottom=(smooth=false)=>requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:smooth?"smooth":"auto",block:"end"}));

  const load=async()=>{
    if(!conversationId) return;
    setLoading(true);
    try{
      const data=await getChatMessages(conversationId,{limit:80});
      setItems(uniq(data?.items||[]));
      scrollBottom(false);
    }catch(e){
      toast.error(e?.response?.data?.message||"Không tải được tin nhắn");
      setItems([]);
    }finally{setLoading(false)}
  };

  useEffect(()=>{ load(); },[conversationId]);

  // Socket join + realtime
  useEffect(()=>{
    if(!conversationId) return;

    socket.emit("chat:join",{conversationId},(ack)=>{ if(!ack?.ok) toast.error(ack?.message||"Không vào được phòng chat"); });

    const onNew=(msg)=>{
      if(String(msg?.conversationId||"")!==String(conversationId)) return;
      setItems(prev=>uniq([...prev,msg]));
      scrollBottom(true);
    };

    const onDeleted=({conversationId:cid,messageId,deletedAt,by}={})=>{
      if(String(cid)!==String(conversationId) || !messageId) return;
      setItems(prev=>uniq(prev.map(m=>String(m?._id||"")===String(messageId)?{...m,deletedAt:deletedAt||new Date().toISOString(),content:"",attachments:[]}:m)));
    };

    const onReact=({conversationId:cid,message}={})=>{
      if(String(cid)!==String(conversationId) || !message?._id) return;
      setItems(prev=>uniq(prev.map(m=>String(m?._id||"")===String(message._id)?message:m)));
    };

    socket.on("chat:new",onNew);
    socket.on("chat:deleted",onDeleted);
    socket.on("chat:reaction_update",onReact);

    return ()=>{
      socket.off("chat:new",onNew);
      socket.off("chat:deleted",onDeleted);
      socket.off("chat:reaction_update",onReact);
      socket.emit("chat:leave",{conversationId});
    };
  },[socket,conversationId]);

  // Close small popups when click outside
  useEffect(()=>{
    const onDoc=(e)=>{
      const t=e.target;
      if(!t) return;
      if(!t.closest?.(".fm-chat-input-emoji") && !t.closest?.(".fm-chat-emoji-pop")) setPickerOpen(false);
      if(!t.closest?.(".fm-chat-reactpop") && !t.closest?.(".fm-chat-bubble-actions")) setReactFor(null);
    };
    document.addEventListener("mousedown",onDoc);
    return ()=>document.removeEventListener("mousedown",onDoc);
  },[]);

  const startReply=(m)=>{
    if(!m || m.deletedAt) return;
    setReplyTo(m);
    requestAnimationFrame(()=>{ inputRef.current?.focus?.(); });
  };
  const clearReply=()=>setReplyTo(null);

  const pickFiles=()=>{
    fileRef.current?.click?.();
  };

  const onPickFile=(e)=>{
    const list=[...safeArr(e.target.files)];
    e.target.value="";
    if(!list.length) return;

    const ok=[];
    for(const f of list){
      if(!String(f.type||"").startsWith("image/")){ toast.info("Chỉ hỗ trợ ảnh."); continue; }
      if(f.size>5*1024*1024){ toast.info("Ảnh phải nhỏ hơn 5MB."); continue; }
      ok.push(f);
    }
    if(!ok.length) return;
    setFiles(prev=>[...prev,...ok].slice(0,6)); // giới hạn nhẹ để UI đỡ nặng
  };

  const removeFile=(idx)=>setFiles(prev=>prev.filter((_,i)=>i!==idx));

  const buildRows=useMemo(()=>{
    const out=[];
    const arr=safeArr(items);
    for(let i=0;i<arr.length;i++){
      const m=arr[i], p=arr[i-1];
      if(i===0 && m?.createdAt) out.push({t:"date",k:`d0_${m.createdAt}`,v:dayjs(m.createdAt).format("DD/MM/YYYY")});
      else if(m?.createdAt && p?.createdAt && !sameDay(m.createdAt,p.createdAt)) out.push({t:"date",k:`d_${m.createdAt}`,v:dayjs(m.createdAt).format("DD/MM/YYYY")});
      out.push({t:"msg",k:String(m?._id||m?.clientMsgId||i),m});
    }
    return out;
  },[items]);

  const summarizeReacts=(m)=>{
    const list=safeArr(m?.reactions);
    const byEmoji=new Map();
    for(const r of list){
      const k=String(r?.emoji||"");
      if(!k) continue;
      if(!byEmoji.has(k)) byEmoji.set(k,{emoji:k,count:0,me:false});
      const it=byEmoji.get(k);
      it.count++;
      if(String(r?.userId||"")===myId) it.me=true;
    }
    return Array.from(byEmoji.values()).sort((a,b)=>b.count-a.count);
  };

  const sendReaction=(messageId,emojiKey)=>{
    if(!conversationId || !messageId || !emojiKey) return;
    socket.emit("chat:react",{conversationId,messageId,emoji:emojiKey},(ack)=>{
      if(!ack?.ok) toast.error(ack?.message||"Không thể thả cảm xúc");
      else if(ack?.message) setItems(prev=>uniq(prev.map(m=>String(m?._id||"")===String(ack.message._id)?ack.message:m)));
    });
  };

  const retract=(m)=>{
    const id=String(m?._id||"");
    const mine=String(m?.senderId?._id||m?.senderId||"")===myId;
    if(!id || !mine || m?.deletedAt) return;
    // optimistic
    setItems(prev=>uniq(prev.map(x=>String(x?._id||"")===id?{...x,deletedAt:new Date().toISOString(),content:"",attachments:[]}:x)));
    socket.emit("chat:delete",{conversationId,messageId:id},(ack)=>{
      if(!ack?.ok) toast.error(ack?.message||"Thu hồi thất bại");
    });
  };

  const send=async()=>{
    if(!conversationId) return;
    const content=String(text||"").trim();
    if(!content && !files.length) return;

    const clientMsgId=`c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tmp={_id:`tmp_${clientMsgId}`,conversationId,senderId:myId,content,attachments:[],clientMsgId,replyTo:replyTo?._id||null,createdAt:new Date().toISOString(),_tmp:true};

    setSending(true);
    setText("");
    setPickerOpen(false);

    // optimistic
    setItems(prev=>uniq([...prev,tmp]));
    scrollBottom(true);

    let attachments=[];
    try{
      if(files.length){
        setUploading(true);
        for(const f of files){
          const up=await uploadChatImage(conversationId,f); // {url,name,size,type:"image"}
          if(up?.url) attachments.push({type:"image",url:up.url,name:up.name||f.name,size:up.size||f.size});
        }
      }
    }catch(e){
      toast.error(e?.response?.data?.message||"Upload ảnh thất bại");
      // rollback tmp
      setItems(prev=>prev.filter(x=>String(x?._id||"")!==String(tmp._id||"")));
      setSending(false);
      setUploading(false);
      return;
    }finally{
      setUploading(false);
      setFiles([]);
    }

    socket.emit("chat:send",{conversationId,clientMsgId,content,attachments,replyTo:replyTo?._id||null},(ack)=>{
      setSending(false);
      setReplyTo(null);
      if(!ack?.ok){ toast.error(ack?.message||"Gửi thất bại"); return; }
      const serverMsg=ack?.message;
      if(serverMsg){
        setItems(prev=>{
          const filtered=prev.filter(x=>String(x?._id||"")!==String(tmp._id||""));
          return uniq([...filtered,serverMsg]);
        });
        scrollBottom(true);
      }
    });
  };

  const insertEmojiToInput=(char)=>{
    if(!char) return;
    const el=inputRef.current;
    if(!el) { setText(t=>t+char); return; }
    const start=el.selectionStart ?? text.length;
    const end=el.selectionEnd ?? text.length;
    const next=text.slice(0,start)+char+text.slice(end);
    setText(next);
    requestAnimationFrame(()=>{ el.focus(); const pos=start+char.length; el.setSelectionRange?.(pos,pos); });
  };

  return (
    <div className="fm-chat" style={{height}}>
      {/* header */}
      <div className="fm-chat-head">
        <div className="fm-chat-title">
          <i className="fa-regular fa-comments" /> Trò chuyện
          {uploading ? <span className="fm-chat-sub">Đang tải ảnh…</span> : sending ? <span className="fm-chat-sub">Đang gửi…</span> : null}
        </div>
        <div className="fm-chat-head-actions">
          <button className="fm-chat-btn" onClick={load} disabled={loading}><i className={"fa-solid fa-rotate"+(loading?" fa-spin":"")} /> Làm mới</button>
        </div>
      </div>

      {/* list */}
      <div ref={listRef} className="fm-chat-list">
        {loading ? <div className="fm-chat-loading">Đang tải…</div> : null}

        {buildRows.map(r=>{
          if(r.t==="date") return (
            <div key={r.k} className="fm-chat-date">
              <span>{r.v}</span>
            </div>
          );

          const m=r.m;
          const sid=String(m?.senderId?._id||m?.senderId||"");
          const mine=sid===myId;

          const sender=memberMap.get(sid)||null;
          const name=sender?.name||sender?.nickname||"";
          const ava=sender?.avatarUrl||sender?.imageUrl||"/images/avatar.png";
          const canOpen=!!onOpenUser && !!sid && !mine;

          const isTmp=!!m?._tmp;
          const isDeleted=!!m?.deletedAt;

          const replyId=String(m?.replyTo||"");
          const replyMsg=replyId?msgMap.get(replyId)||null:null;
          const replySenderId=replyMsg?String(replyMsg?.senderId?._id||replyMsg?.senderId||""):"";
          const replySender=replySenderId?memberMap.get(replySenderId)||null:null;
          const replyName=replySender?.name||replySender?.nickname||"";
          const replyText=replyMsg?.deletedAt?"Tin nhắn đã thu hồi":clip(replyMsg?.content||"",90);

          const reacts=summarizeReacts(m);

          return (
            <div key={r.k} className={"fm-chat-row"+(mine?" is-mine":"")+(isTmp?" is-tmp":"")}>
              {!mine && (
                <button className="fm-chat-ava" onClick={()=>canOpen && onOpenUser(sender?.rawUser||sender)} type="button" title={name||"User"}>
                  <img src={ava} alt={name||"User"} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}}/>
                </button>
              )}

              <div className="fm-chat-col">
                {!mine && !!name && <div className="fm-chat-name">{name}</div>}

                <div className="fm-chat-bubblewrap">
                  <div className={"fm-chat-bubble"+(mine?" is-mine":"")+(isDeleted?" is-deleted":"")}>
                    {/* reply preview inside bubble */}
                    {!!replyId && (
                      <div className="fm-chat-replyline">
                        <div className="fm-chat-replybar" />
                        <div className="fm-chat-replymeta">
                          <div className="fm-chat-replyname">{replyName||"Tin nhắn"}</div>
                          <div className="fm-chat-replytext">{replyMsg?replyText:"(Không thể tải tin nhắn gốc)"}</div>
                        </div>
                      </div>
                    )}

                    {/* content */}
                    {isDeleted ? (
                      <div className="fm-chat-deleted"><i className="fa-solid fa-ban" /> Tin nhắn đã thu hồi</div>
                    ) : (
                      <>
                        {!!m?.content && <div className="fm-chat-text">{m.content}</div>}
                        {!!safeArr(m?.attachments).length && (
                          <div className="fm-chat-atts">
                            {safeArr(m.attachments).filter(isImg).map((a,idx)=>(
                              <a key={`${a.url||idx}`} className="fm-chat-img" href={a.url} target="_blank" rel="noreferrer">
                                <img src={a.url} alt={a.name||"image"} />
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    <div className="fm-chat-time">{m?.createdAt?dayjs(m.createdAt).format("HH:mm"):""}</div>

                    {/* actions on hover */}
                    {!isDeleted && (
                      <div className="fm-chat-bubble-actions">
                        <button type="button" className="fm-chat-act" onClick={()=>{ setReactFor(String(m?._id||"")); }} title="Thả cảm xúc"><i className="fa-regular fa-face-smile" /></button>
                        <button type="button" className="fm-chat-act" onClick={()=>startReply(m)} title="Trả lời"><i className="fa-solid fa-reply" /></button>
                        {mine && <button type="button" className="fm-chat-act is-danger" onClick={()=>retract(m)} title="Thu hồi"><i className="fa-regular fa-trash-can" /></button>}
                      </div>
                    )}
                  </div>

                  {/* reaction pop */}
                  {reactFor===String(m?._id||"") && !isDeleted && (
                    <div className="fm-chat-reactpop">
                      {EMOJIS.map(e=>(
                        <button key={e.k} type="button" className="fm-chat-reactbtn" title={e.t} onClick={()=>{ sendReaction(String(m._id),e.k); setReactFor(null); }}>
                          {e.c}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* reaction summary */}
                  {!!reacts.length && !isDeleted && (
                    <div className="fm-chat-reactbar">
                      {reacts.slice(0,5).map(x=>(
                        <span key={x.emoji} className={"fm-chat-reactpill"+(x.me?" is-me":"")}>
                          <span className="em">{emojiChar(x.emoji)}</span>
                          <span className="ct">{x.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && !items.length ? <div className="fm-chat-empty">Chưa có tin nhắn nào.</div> : null}
        <div ref={bottomRef}/>
      </div>

      {/* composer */}
      <div className="fm-chat-compose">
        {!!replyTo && (
          <div className="fm-chat-replybox">
            <div className="fm-chat-replybox-left">
              <div className="fm-chat-replybox-title"><i className="fa-solid fa-reply" /> Đang trả lời</div>
              <div className="fm-chat-replybox-text">{clip(replyTo?.content||"",120)}</div>
            </div>
            <button type="button" className="fm-chat-replybox-close" onClick={clearReply} aria-label="Hủy trả lời"><i className="fa-solid fa-xmark" /></button>
          </div>
        )}

        {!!files.length && (
          <div className="fm-chat-previews">
            {files.map((f,idx)=>(
              <div key={idx} className="fm-chat-prev">
                <img src={URL.createObjectURL(f)} alt={f.name} />
                <button type="button" className="fm-chat-prev-x" onClick={()=>removeFile(idx)} aria-label="Xóa ảnh"><i className="fa-solid fa-xmark" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="fm-chat-inputrow">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickFile} />

          <button type="button" className="fm-chat-attach" onClick={pickFiles} title="Gửi ảnh (<5MB)">
            <i className="fa-regular fa-image" />
          </button>

          <button type="button" className={"fm-chat-input-emoji"+(pickerOpen?" is-on":"")} onClick={()=>setPickerOpen(v=>!v)} title="Chèn emoji">
            <i className="fa-regular fa-face-smile" />
          </button>

          <div className="fm-chat-inputwrap">
            <input
              ref={inputRef}
              value={text}
              onChange={e=>setText(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Nhập tin nhắn…"
              className="fm-chat-input"
            />
            {pickerOpen && (
              <div className="fm-chat-emoji-pop">
                {EMOJIS.map(e=>(
                  <button key={e.k} type="button" className="fm-chat-emoji-btn" title={e.t} onClick={()=>insertEmojiToInput(e.c)}>
                    {e.c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="fm-chat-send" onClick={send} disabled={sending||uploading}>
            <i className="fa-regular fa-paper-plane" /> Gửi
          </button>
        </div>

        <div className="fm-chat-note">Ảnh tối đa 5MB. Reactions: 👍 ❤️ 😂 😢 😡</div>
      </div>
    </div>
  );
}
