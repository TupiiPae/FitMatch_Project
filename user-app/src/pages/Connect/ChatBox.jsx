import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getChatMessages, uploadChatImage } from "../../api/chat";
import { getSocket } from "../../lib/socket";
import "./ChatBox.css";

const safeArr=v=>Array.isArray(v)?v:[];
const uniq=(arr)=>{const m=new Map();for(const x of safeArr(arr)){const k=String(x?._id||x?.clientMsgId||"");if(k)m.set(k,x);}return Array.from(m.values()).sort((a,b)=>new Date(a?.createdAt||0)-new Date(b?.createdAt||0));};
const sameDay=(a,b)=>dayjs(a).isValid()&&dayjs(b).isValid()&&dayjs(a).format("YYYY-MM-DD")===dayjs(b).format("YYYY-MM-DD");
const clip=(s,n=90)=>{const t=String(s||"").replace(/\s+/g," ").trim();return t.length>n?t.slice(0,n-1)+"…":t;};

const EMOJIS=[{k:"like",c:"👍",t:"Thích"},{k:"heart",c:"❤️",t:"Tim"},{k:"laugh",c:"😂",t:"Cười"},{k:"sad",c:"😢",t:"Buồn"},{k:"angry",c:"😡",t:"Phẫn nộ"}];
const emojiChar=(key)=>EMOJIS.find(x=>x.k===key)?.c||"";
const isImg=(a)=>String(a?.type||"image")==="image" && !!a?.url;

export default function ChatBox({ conversationId, meId, members=[], height=520, onOpenUser }){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);

  const [text,setText]=useState("");
  const [sending,setSending]=useState(false);

  const [replyTo,setReplyTo]=useState(null);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [reactFor,setReactFor]=useState(null);
  const [files,setFiles]=useState([]);
  const [uploading,setUploading]=useState(false);

  // ✅ trạng thái "Đang gửi/Đã gửi" dưới bubble cuối cùng của tôi
  const [sendMark,setSendMark]=useState(null); // {state:"sending"|"sent", msgId, at}
  const sendMarkRef=useRef(null);

  const listRef=useRef(null);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  const fileRef=useRef(null);

  const socket=useMemo(()=>getSocket(),[]);
  const myId=String(meId||"");

  useEffect(()=>{sendMarkRef.current=sendMark},[sendMark]);
  useEffect(()=>{setSendMark(null)},[conversationId]);

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

  const scrollBottom=(smooth=false)=>{
    requestAnimationFrame(()=>{
      const el=listRef.current;
      if(!el) return;
      if(smooth) el.scrollTo({top:el.scrollHeight,behavior:"smooth"});
      else el.scrollTop=el.scrollHeight;
    });
  };

  // ✅ scrollbar: chỉ hiện khi scroll, 2s không scroll sẽ tự ẩn
  useEffect(()=>{
    const el=listRef.current;
    if(!el) return;
    let t=null;
    const onScroll=()=>{
      el.classList.add("is-scrolling");
      if(t) clearTimeout(t);
      t=setTimeout(()=>el.classList.remove("is-scrolling"),2000);
    };
    el.addEventListener("scroll",onScroll,{passive:true});
    return ()=>{el.removeEventListener("scroll",onScroll); if(t) clearTimeout(t);};
  },[]);

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

  useEffect(()=>{
    if(!conversationId) return;

    socket.emit("chat:join",{conversationId},(ack)=>{ if(!ack?.ok) toast.error(ack?.message||"Không vào được phòng chat"); });

    const onNew=(msg)=>{
      if(String(msg?.conversationId||"")!==String(conversationId)) return;
      setItems(prev=>uniq([...prev,msg]));
      scrollBottom(true);

      // ✅ nếu đang "Đã gửi" và đối phương nhắn lại -> ẩn "Đã gửi"
      try{
        const sid=String(msg?.senderId?._id||msg?.senderId||"");
        const mine=sid===myId;
        const cur=sendMarkRef.current;
        if(!mine && cur?.state==="sent"){
          const tNew=new Date(msg?.createdAt||0).getTime();
          const tSent=new Date(cur?.at||0).getTime();
          if(!Number.isNaN(tNew)&&!Number.isNaN(tSent)?tNew>=tSent:true) setSendMark(null);
        }
      }catch{}
    };

    const onDeleted=({conversationId:cid,messageId,deletedAt}={})=>{
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
  },[socket,conversationId,myId]);

  useEffect(()=>{
    const onDoc=(e)=>{
      const t=e.target;
      if(!t) return;
      if(!t.closest?.(".fm-chat-input-emoji") && !t.closest?.(".fm-chat-emoji-pop")) setPickerOpen(false);
      if(!t.closest?.(".fm-chat-reactpop") && !t.closest?.(".fm-chat-reactcorner")) setReactFor(null);
    };
    document.addEventListener("mousedown",onDoc);
    return ()=>document.removeEventListener("mousedown",onDoc);
  },[]);

  const startReply=(m)=>{
    if(!m || m.deletedAt) return;
    setReplyTo(m);
    requestAnimationFrame(()=>inputRef.current?.focus?.());
  };
  const clearReply=()=>setReplyTo(null);

  const pickFiles=()=>fileRef.current?.click?.();

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
    setFiles(prev=>[...prev,...ok].slice(0,6));
  };
  const removeFile=(idx)=>setFiles(prev=>prev.filter((_,i)=>i!==idx));

  const summarizeReacts=(m)=>{
    const list=safeArr(m?.reactions);
    const byEmoji=new Map();
    let my=null;
    for(const r of list){
      const k=String(r?.emoji||"");
      if(!k) continue;
      if(!byEmoji.has(k)) byEmoji.set(k,{emoji:k,count:0});
      byEmoji.get(k).count++;
      if(String(r?.userId||"")===myId) my=r;
    }
    const top=Array.from(byEmoji.values()).sort((a,b)=>b.count-a.count);
    return { top, myEmoji: my?.emoji||"" };
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
    const sid=String(m?.senderId?._id||m?.senderId||"");
    const mine=sid===myId;
    if(!id || !mine || m?.deletedAt) return;
    setItems(prev=>uniq(prev.map(x=>String(x?._id||"")===id?{...x,deletedAt:new Date().toISOString(),content:"",attachments:[]}:x)));
    socket.emit("chat:delete",{conversationId,messageId:id},(ack)=>{ if(!ack?.ok) toast.error(ack?.message||"Thu hồi thất bại"); });
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

    setItems(prev=>uniq([...prev,tmp]));
    setSendMark({state:"sending",msgId:tmp._id,at:tmp.createdAt});
    scrollBottom(true);

    let attachments=[];
    try{
      if(files.length){
        setUploading(true);
        for(const f of files){
          const up=await uploadChatImage(conversationId,f);
          if(up?.url) attachments.push({type:"image",url:up.url,name:up.name||f.name,size:up.size||f.size});
        }
      }
    }catch(e){
      toast.error(e?.response?.data?.message||"Upload ảnh thất bại");
      setItems(prev=>prev.filter(x=>String(x?._id||"")!==String(tmp._id||"")));
      setSending(false);
      setUploading(false);
      setSendMark(null);
      return;
    }finally{
      setUploading(false);
      setFiles([]);
    }

    socket.emit("chat:send",{conversationId,clientMsgId,content,attachments,replyTo:replyTo?._id||null},(ack)=>{
      setSending(false);
      setReplyTo(null);
      if(!ack?.ok){ toast.error(ack?.message||"Gửi thất bại"); setSendMark(null); return; }
      const serverMsg=ack?.message;
      if(serverMsg){
        setItems(prev=>{
          const filtered=prev.filter(x=>String(x?._id||"")!==String(tmp._id||""));
          return uniq([...filtered,serverMsg]);
        });
        setSendMark({state:"sent",msgId:serverMsg._id,at:serverMsg.createdAt});
        scrollBottom(true);
      }else setSendMark(null);
    });
  };

  const insertEmojiToInput=(char)=>{
    if(!char) return;
    const el=inputRef.current;
    if(!el){ setText(t=>t+char); return; }
    const start=el.selectionStart ?? text.length;
    const end=el.selectionEnd ?? text.length;
    const next=text.slice(0,start)+char+text.slice(end);
    setText(next);
    requestAnimationFrame(()=>{ el.focus(); const pos=start+char.length; el.setSelectionRange?.(pos,pos); });
  };

  const timeline=useMemo(()=>{
    const arr=safeArr(items);
    const out=[];
    for(let i=0;i<arr.length;i++){
      const m=arr[i];
      const p=arr[i-1];
      if(i===0 && m?.createdAt) out.push({t:"date",k:`d0_${m.createdAt}`,v:dayjs(m.createdAt).format("DD/MM/YYYY")});
      else if(m?.createdAt && p?.createdAt && !sameDay(m.createdAt,p.createdAt)) out.push({t:"date",k:`d_${m.createdAt}`,v:dayjs(m.createdAt).format("DD/MM/YYYY")});

      const sid=String(m?.senderId?._id||m?.senderId||"");
      const prev=arr[i-1], next=arr[i+1];
      const prevSid=String(prev?.senderId?._id||prev?.senderId||"");
      const nextSid=String(next?.senderId?._id||next?.senderId||"");
      const start=(i===0)||(!prev)||prevSid!==sid||(!sameDay(prev?.createdAt,m?.createdAt));
      const end=(!next)||nextSid!==sid||(!sameDay(next?.createdAt,m?.createdAt));

      out.push({t:"msg",k:String(m?._id||m?.clientMsgId||i),m,start,end});
    }
    return out;
  },[items]);

  return (
    <div className="fm-chat" style={{height}}>
      <div ref={listRef} className="fm-chat-list">
        {loading ? <div className="fm-chat-loading">Đang tải…</div> : null}

        {timeline.map(row=>{
          if(row.t==="date") return <div key={row.k} className="fm-chat-date"><span>{row.v}</span></div>;

          const m=row.m;
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

          const {top:reactTop,myEmoji}=summarizeReacts(m);
          const cornerEmoji=myEmoji || reactTop[0]?.emoji || "";

          // ✅ “Đang gửi/Đã gửi” chỉ nằm dưới bubble cuối của tôi và đúng messageId
          const showSendMark=mine && row.end && !!sendMark?.state && String(sendMark?.msgId||"")===String(m?._id||"") && !isDeleted;

          return (
            <div key={row.k} className={"fm-chat-row"+(mine?" is-mine":"")+(isTmp?" is-tmp":"")+(row.start?" is-start":"")+(row.end?" is-end":"")}>
              {!mine && (row.start ? (
                <button type="button" className="fm-chat-ava" onClick={()=>canOpen && onOpenUser(sender?.rawUser||sender)} title={name||"User"}>
                  <img src={ava} alt={name||"User"} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}}/>
                </button>
              ) : <div className="fm-chat-ava-spacer" />)}

              <div className={"fm-chat-main"+(mine?" is-mine":"")}>
                {/* MINE: reply + retract nằm BÊN TRÁI bubble */}
                {!isDeleted && mine && (
                  <div className="fm-chat-sideacts is-left">
                    <button type="button" className="fm-chat-act" onClick={()=>startReply(m)} title="Trả lời"><i className="fa-solid fa-reply" /></button>
                    <button type="button" className="fm-chat-act is-danger" onClick={()=>retract(m)} title="Thu hồi"><i className="fa-regular fa-trash-can" /></button>
                  </div>
                )}

                <div className={"fm-chat-bubblewrap"+(mine?" is-mine":"")}>
                  <div className={"fm-chat-bubble"+(mine?" is-mine":"")+(isDeleted?" is-deleted":"")+(row.start?" is-start":"")+(row.end?" is-end":"")}>
                    {!mine && row.start && !!name && !isDeleted && <div className="fm-chat-inname">{name}</div>}

                    {!!replyId && (
                      <div className="fm-chat-replyline">
                        <div className="fm-chat-replybar" />
                        <div className="fm-chat-replymeta">
                          <div className="fm-chat-replyname">{replyName||"Tin nhắn"}</div>
                          <div className="fm-chat-replytext">{replyMsg?replyText:"(Không thể tải tin nhắn gốc)"}</div>
                        </div>
                      </div>
                    )}

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

                    {row.end && <div className={"fm-chat-time"+(mine?" is-mine":"")}>{m?.createdAt?dayjs(m.createdAt).format("HH:mm"):""}</div>}

                    {!isDeleted && (
                      <button type="button" className={"fm-chat-reactcorner"+((reactTop.length||cornerEmoji)?" is-has":"")} onClick={()=>setReactFor(String(m?._id||""))} title="Thả cảm xúc">
                        {cornerEmoji ? <span className="em">{emojiChar(cornerEmoji)}</span> : <i className="fa-regular fa-face-smile" />}
                        {reactTop.length>0 ? <span className="ct">{safeArr(m?.reactions).length}</span> : null}
                      </button>
                    )}
                  </div>

                  {reactFor===String(m?._id||"") && !isDeleted && (
                    <div className={"fm-chat-reactpop"+(mine?" is-mine":"")}>
                      {EMOJIS.map(e=>(
                        <button key={e.k} type="button" className="fm-chat-reactbtn" title={e.t} onClick={()=>{ sendReaction(String(m._id),e.k); setReactFor(null); }}>
                          {e.c}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ✅ “Đang gửi/Đã gửi” dưới bubble cuối cùng của tôi */}
                  {showSendMark && (
                    <div className="fm-chat-sendmark">
                      {sendMark.state==="sending"
                        ? (<><i className="fa-solid fa-circle-notch fa-spin" /> Đang gửi</>)
                        : (<><i className="fa-solid fa-check" /> Đã gửi</>)
                      }
                    </div>
                  )}
                </div>

                {/* OTHER: reply nằm BÊN PHẢI bubble */}
                {!isDeleted && !mine && (
                  <div className="fm-chat-sideacts is-right">
                    <button type="button" className="fm-chat-act" onClick={()=>startReply(m)} title="Trả lời"><i className="fa-solid fa-reply" /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && !items.length ? <div className="fm-chat-empty">Chưa có tin nhắn nào.</div> : null}
        <div ref={bottomRef}/>
      </div>

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

          <button type="button" className="fm-chat-attach" onClick={pickFiles} title="Gửi hình ảnh"><i className="fa-regular fa-image" /></button>

          <div className="fm-chat-inputwrap">
            <input
              ref={inputRef}
              value={text}
              onChange={e=>setText(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); e.stopPropagation(); send(); } }}
              placeholder={uploading?"Đang tải ảnh…":"Nhập tin nhắn…"}
              className="fm-chat-input"
              disabled={uploading}
            />
            {pickerOpen && (
              <div className="fm-chat-emoji-pop">
                {EMOJIS.map(e=>(
                  <button key={e.k} type="button" className="fm-chat-emoji-btn" title={e.t} onClick={()=>insertEmojiToInput(e.c)}>{e.c}</button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="fm-chat-send" onClick={send} disabled={sending||uploading}><i className="fa-regular fa-paper-plane" /></button>
        </div>
      </div>
    </div>
  );
}
