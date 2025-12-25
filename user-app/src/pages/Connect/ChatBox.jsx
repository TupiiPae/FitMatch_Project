import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getChatMessages, uploadChatImage } from "../../api/chat";
import { getSocket } from "../../lib/socket";
import "./ChatBox.css";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

const safeArr=v=>Array.isArray(v)?v:[];
const uniq=(arr)=>{const m=new Map();for(const x of safeArr(arr)){const k=String(x?._id||x?.clientMsgId||"");if(k)m.set(k,x);}return Array.from(m.values()).sort((a,b)=>new Date(a?.createdAt||0)-new Date(b?.createdAt||0));};
const sameDay=(a,b)=>dayjs(a).isValid()&&dayjs(b).isValid()&&dayjs(a).format("YYYY-MM-DD")===dayjs(b).format("YYYY-MM-DD");
const clip=(s,n=90)=>{const t=String(s||"").replace(/\s+/g," ").trim();return t.length>n?t.slice(0,n-1)+"…":t;};

const EMOJIS=[{k:"like",c:"👍",t:"Thích"},{k:"heart",c:"❤️",t:"Tim"},{k:"laugh",c:"😂",t:"Cười"},{k:"wow",c:"😮",t:"Bất ngờ"},{k:"sad",c:"😢",t:"Buồn"},{k:"angry",c:"😡",t:"Phẫn nộ"}];
const emojiChar=(key)=>EMOJIS.find(x=>x.k===key)?.c||"";
const isImg=(a)=>String(a?.type||"image")==="image" && !!a?.url;

const uidOf=(u)=>String(u?._id||u||"");
const emojiKeyFromChar=(ch)=>{
  const s=String(ch||"").trim();
  if(!s) return null;
  const map={"👍":"like","❤️":"heart","❤":"heart","😂":"laugh","😆":"laugh","😮":"wow","😲":"wow","🤯":"wow","😢":"sad","😭":"sad","😡":"angry","😠":"angry"};
  if(map[s]) return map[s];
  const found=EMOJIS.find(e=>e.c===s);
  return found?.k||null;
};

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

  const [sendMark,setSendMark]=useState(null);
  const sendMarkRef=useRef(null);

  const [dragOverMid,setDragOverMid]=useState(null);

  const [imgView,setImgView]=useState(null);
  const closeImg=()=>setImgView(null);

  const listRef=useRef(null);
  const inputRef=useRef(null);
  const fileRef=useRef(null);

  const socket=useMemo(()=>getSocket(),[]);
  const myId=String(meId||"");

  useEffect(()=>{sendMarkRef.current=sendMark},[sendMark]);
  useEffect(()=>{setSendMark(null)},[conversationId]);

  useEffect(()=>{
    if(!imgView) return;
    const onKey=(e)=>{ if(e.key==="Escape") closeImg(); };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[imgView]);

  const fileUrlMapRef=useRef(new Map());
  const fileUrl=(f)=>{const m=fileUrlMapRef.current; if(!m.has(f)) m.set(f,URL.createObjectURL(f)); return m.get(f);};
  useEffect(()=>{
    const m=fileUrlMapRef.current;
    const cur=new Set(files);
    for(const [k,u] of m.entries()){ if(!cur.has(k)){ try{URL.revokeObjectURL(u)}catch{} m.delete(k);} }
  },[files]);
  useEffect(()=>()=>{const m=fileUrlMapRef.current; for(const u of m.values()) try{URL.revokeObjectURL(u)}catch{} m.clear();},[]);

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

  const reactPopRef=useRef(null);
  const [reactShift,setReactShift]=useState(0);

  const [reactModal,setReactModal]=useState(null); // {mid,filter:"all"|emojiKey}
  const closeReactModal=()=>setReactModal(null);

  useEffect(()=>{ if(!reactModal) return; const onKey=e=>{ if(e.key==="Escape") closeReactModal(); }; window.addEventListener("keydown",onKey); return ()=>window.removeEventListener("keydown",onKey); },[reactModal]);

  const reactModalMsg=useMemo(()=>{
    const mid=String(reactModal?.mid||"");
    if(!mid) return null;
    return msgMap.get(mid)||safeArr(items).find(x=>String(x?._id||"")===mid)||null;
  },[reactModal,msgMap,items]);

  const reactModalSummary=useMemo(()=>reactModalMsg?summarizeReacts(reactModalMsg):{top:[],myEmoji:"",total:0},[reactModalMsg]);

  const reactModalRows=useMemo(()=>{
    const m=reactModalMsg; if(!m) return [];
    return safeArr(m?.reactions).map(r=>({emoji:String(r?.emoji||""),userId:uidOf(r?.userId),at:r?.reactedAt?new Date(r.reactedAt).getTime():0}))
      .filter(x=>x.emoji&&x.userId).sort((a,b)=>b.at-a.at);
  },[reactModalMsg]);

  const reactFilter=String(reactModal?.filter||"all");
  const reactModalRowsFiltered=useMemo(()=>reactFilter==="all"?reactModalRows:reactModalRows.filter(r=>r.emoji===reactFilter),[reactModalRows,reactFilter]);

  useEffect(()=>{
    if(!reactFor){ setReactShift(0); return; }
    const calc=()=>{
      const pop=reactPopRef.current, list=listRef.current;
      if(!pop||!list) return;
      const pr=pop.getBoundingClientRect();
      const lr=list.getBoundingClientRect();
      const pad=10;
      let dx=0;
      if(pr.left<lr.left+pad) dx=(lr.left+pad)-pr.left;
      if(pr.right>lr.right-pad) dx=(lr.right-pad)-pr.right;
      setReactShift(dx);
    };
    const tick=()=>requestAnimationFrame(()=>requestAnimationFrame(calc));
    tick();
    window.addEventListener("resize",tick);
    const list=listRef.current;
    list?.addEventListener("scroll",tick,{passive:true});
    return ()=>{
      window.removeEventListener("resize",tick);
      list?.removeEventListener("scroll",tick);
    };
  },[reactFor]);

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
    socket.on("chat:revoke_update",onDeleted);
    socket.on("chat:reaction_update",onReact);
    socket.on("chat:react_update",onReact);

    return ()=>{
      socket.off("chat:new",onNew);
      socket.off("chat:deleted",onDeleted);
      socket.off("chat:revoke_update",onDeleted);
      socket.off("chat:reaction_update",onReact);
      socket.off("chat:react_update",onReact);
      socket.emit("chat:leave",{conversationId});
    };
  },[socket,conversationId,myId]);

  useEffect(()=>{
    const onDoc=(e)=>{
      const t=e.target;
      if(!t) return;
      if(!t.closest?.(".fm-chat-input-emoji") && !t.closest?.(".fm-chat-emoji-pop")) setPickerOpen(false);
      if(!t.closest?.(".fm-chat-reactpop") && !t.closest?.(".fm-chat-act-emoji")) setReactFor(null);
    };
    document.addEventListener("mousedown",onDoc);
    return ()=>document.removeEventListener("mousedown",onDoc);
  },[]);

  useEffect(()=>{
    const open=!!reactModal || !!imgView;
    if(!open) return;
    const b=document.body;
    const prevOverflow=b.style.overflow;
    const prevPad=b.style.paddingRight;
    return ()=>{ b.style.overflow=prevOverflow; b.style.paddingRight=prevPad; };
  },[reactModal]);


  const startReply=(m)=>{
    if(!m || m.deletedAt) return;
    setReplyTo(m);
    requestAnimationFrame(()=>inputRef.current?.focus?.());
  };
  const clearReply=()=>setReplyTo(null);

  const pickFiles=()=>fileRef.current?.click?.();

  const pushFiles=(list)=>{
    const ok=[];
    for(const f of (list||[])){
      if(!String(f?.type||"").startsWith("image/")){ toast.info("Chỉ hỗ trợ ảnh."); continue; }
      if(f.size>5*1024*1024){ toast.info("Ảnh phải nhỏ hơn 5MB."); continue; }
      ok.push(f);
    }
    if(!ok.length) return;
    setFiles(prev=>[...prev,...ok].slice(0,6));
  };

  const onPickFile=(e)=>{
    const list=Array.from(e.target.files||[]);
    e.target.value="";
    if(!list.length) return;
    pushFiles(list);
  };

  const dataUrlToFile=(dataUrl,filename="pasted.png")=>{
    try{
      const m=String(dataUrl||"").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if(!m) return null;
      const mime=m[1], b64=m[2];
      const bin=atob(b64);
      const len=bin.length;
      const u8=new Uint8Array(len);
      for(let i=0;i<len;i++) u8[i]=bin.charCodeAt(i);
      return new File([u8],filename,{type:mime});
    }catch{ return null; }
  };

  const pickDataImgFromHtml=(html="")=>{
    const s=String(html||"");
    const m=s.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i);
    return m?.[1]||"";
  };

  const removeFile=(idx)=>setFiles(prev=>prev.filter((_,i)=>i!==idx));

  function summarizeReacts(m){
    const list=safeArr(m?.reactions);
    const byEmoji=new Map();
    let myKey="";
    for(const r of list){
      const k=String(r?.emoji||"");
      const uid=uidOf(r?.userId);
      if(!k||!uid) continue;
      byEmoji.set(k,(byEmoji.get(k)||0)+1);
      if(uid===myId) myKey=k;
    }
    const top=[...byEmoji.entries()].map(([emoji,count])=>({emoji,count})).sort((a,b)=>b.count-a.count);
    const total=list.length;
    return { top, myEmoji: myKey, total };
  }

  const applyLocalReaction=(messageId,emojiKey)=>{
    setItems(prev=>uniq(prev.map(m=>{
      if(String(m?._id||"")!==String(messageId)) return m;
      const list=safeArr(m?.reactions);
      const cur=list.find(r=>uidOf(r?.userId)===myId)||null;
      const kept=list.filter(r=>uidOf(r?.userId)!==myId);
      if(cur?.emoji===emojiKey) return {...m,reactions:kept};
      return {...m,reactions:[...kept,{emoji:emojiKey,userId:myId,reactedAt:new Date().toISOString()}]};
    })));
  };

  const sendReaction=(messageId,emojiKey)=>{
    if(!conversationId || !messageId || !emojiKey) return;
    socket.emit("chat:react",{conversationId,messageId,emoji:emojiKey},(ack)=>{
      if(!ack?.ok){ toast.error(ack?.message||"Không thể thả cảm xúc"); load(); return; }
      const serverMsg=ack?.message || ack?.data?.message || null;
      if(serverMsg?._id) setItems(prev=>uniq(prev.map(m=>String(m?._id||"")===String(serverMsg._id)?serverMsg:m)));
    });
  };

  const retract=(m)=>{
    const id=String(m?._id||"");
    const sid=String(m?.senderId?._id||m?.senderId||"");
    const mine=sid===myId;
    if(!id || !mine || m?.deletedAt) return;
    setItems(prev=>uniq(prev.map(x=>String(x?._id||"")===id?{...x,deletedAt:new Date().toISOString(),content:"",attachments:[]}:x)));
    socket.emit("chat:revoke",{conversationId,messageId:id},(ack)=>{ if(!ack?.ok) toast.error(ack?.message||"Thu hồi thất bại"); });
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

  const onInputDrop=(e)=>{
    try{
      const dt=e.dataTransfer;
      const key=dt?.getData?.("application/x-emoji-key")||"";
      const ch=dt?.getData?.("text/plain")||"";
      const maybeKey=key || emojiKeyFromChar(ch);
      const hasFiles=dt?.files && dt.files.length>0;
      if(maybeKey){ e.preventDefault(); e.stopPropagation(); insertEmojiToInput(emojiChar(maybeKey)||ch); return; }
      if(hasFiles){ e.preventDefault(); e.stopPropagation(); pushFiles([...dt.files]); }
    }catch{}
  };

  const onInputPaste=(e)=>{
  try{
    if(uploading) return;
    const dt=e.clipboardData;
    if(!dt) return;

    const items=Array.from(dt.items||[]);
    const imgFiles=[];

    for(const it of items){
      if(it?.kind==="file" && String(it.type||"").startsWith("image/")){
        const f=it.getAsFile?.();
        if(f) imgFiles.push(f);
      }
    }

    // Case 1: clipboard có file ảnh (screenshot, copy từ app)
    if(imgFiles.length){
      pushFiles(imgFiles);
      const hasText=!!String(dt.getData?.("text/plain")||"").trim();
      // nếu chỉ dán ảnh (không có text) thì chặn paste text rỗng/linh tinh
      if(!hasText){ e.preventDefault(); e.stopPropagation(); }
      return;
    }

    // Case 2: clipboard chỉ có HTML chứa <img src="data:image/...">
    const html=dt.getData?.("text/html")||"";
    const dataImg=pickDataImgFromHtml(html);
      if(dataImg){
        const f=dataUrlToFile(dataImg,`pasted_${Date.now()}.png`);
        if(f){
          pushFiles([f]);
          const hasText=!!String(dt.getData?.("text/plain")||"").trim();
          if(!hasText){ e.preventDefault(); e.stopPropagation(); }
        }
      }
    }catch{}
  };

  const onMsgDrop=(mid)=>(e)=>{
    try{
      const dt=e.dataTransfer;
      const key=dt?.getData?.("application/x-emoji-key")||"";
      const ch=dt?.getData?.("text/plain")||"";
      const emojiKey=key || emojiKeyFromChar(ch);
      if(!emojiKey) return;
      e.preventDefault(); e.stopPropagation();
      setDragOverMid(null);
      applyLocalReaction(String(mid),emojiKey);
      sendReaction(String(mid),emojiKey);
    }catch{ setDragOverMid(null); }
  };
  const onMsgDragOver=(mid)=>(e)=>{
    const dt=e.dataTransfer;
    const key=dt?.getData?.("application/x-emoji-key")||"";
    const ch=dt?.getData?.("text/plain")||"";
    const emojiKey=key || emojiKeyFromChar(ch);
    if(!emojiKey) return;
    e.preventDefault();
    setDragOverMid(String(mid));
  };
  const onMsgDragLeave=(mid)=>(_e)=>{ if(String(dragOverMid||"")===String(mid)) setDragOverMid(null); };

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

  const toggleReactFor=(id)=>setReactFor(cur=>String(cur||"")===String(id||"")?null:String(id||""));

  return (
    <div className="fm-chat" style={{height}}>
      {imgView?.url && (
        <div className="fm-chat-imgview" onMouseDown={(e)=>{ if(e.target===e.currentTarget) closeImg(); }}>
          <button type="button" className="fm-chat-imgview-x" onClick={closeImg} aria-label="Đóng"><i className="fa-solid fa-xmark" /></button>
          <div className="fm-chat-imgview-box">
            <img src={imgView.url} alt={imgView.name||"image"} />
            {!!imgView.name && <div className="fm-chat-imgview-cap">{imgView.name}</div>}
          </div>
        </div>
      )}

      {!!reactModalMsg && (
        <div className="fm-chat-reactmodal" onMouseDown={(e)=>{ if(e.target===e.currentTarget) closeReactModal(); }}>
          <div className="fm-chat-reactmodal-box" onMouseDown={(e)=>e.stopPropagation()}>
            <div className="fm-chat-reactmodal-hd">
              <div className="fm-chat-reactmodal-title">Cảm xúc về tin nhắn</div>
              <button type="button" className="fm-chat-reactmodal-x" onClick={closeReactModal} aria-label="Đóng"><i className="fa-solid fa-xmark" /></button>
            </div>

            <div className="fm-chat-reactmodal-filters">
              <button type="button" className={"fm-chat-rf"+(reactFilter==="all"?" is-on":"")} onClick={()=>setReactModal(s=>s?{...s,filter:"all"}:s)}>
                Tất cả {reactModalSummary.total>0?<span className="ct">{reactModalSummary.total}</span>:null}
              </button>

              {safeArr(reactModalSummary.top).map(x=>(
                <button key={x.emoji} type="button" className={"fm-chat-rf"+(reactFilter===x.emoji?" is-on":"")} onClick={()=>setReactModal(s=>s?{...s,filter:x.emoji}:s)}>
                  <span className="em">{emojiChar(x.emoji)}</span><span className="ct">{x.count}</span>
                </button>
              ))}
            </div>

            <div className="fm-chat-reactmodal-body">
              {!reactModalRowsFiltered.length ? <div className="fm-chat-reactmodal-empty">Chưa có cảm xúc.</div> : null}

              {reactModalRowsFiltered.map((r,idx)=>{
                const u=memberMap.get(String(r.userId))||null;
                const isMe=String(r.userId)===String(myId);
                const name=(u?.name||u?.nickname||"Người dùng")+(isMe?" (Bạn)":"");
                const ava=u?.avatarUrl||u?.imageUrl||"/images/avatar.png";
                const canOpen=!!onOpenUser && !isMe;

                return (
                  <button key={idx} type="button" className={"fm-chat-reactrow"+(canOpen?" is-click":"")} onClick={()=>canOpen && onOpenUser(u?.rawUser||u||{_id:r.userId})}>
                    <div className="fm-chat-reactrow-left">
                      <img className="fm-chat-reactrow-ava" src={ava} alt={name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}}/>
                      <div className="fm-chat-reactrow-name">{name}</div>
                    </div>
                    <div className="fm-chat-reactrow-em">{emojiChar(r.emoji)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div ref={listRef} className="fm-chat-list">
        {loading ? <div className="fm-chat-loading">Đang tải…</div> : null}

        {timeline.map(row=>{
          if(row.t==="date") return <div key={row.k} className="fm-chat-date"><span>{row.v}</span></div>;

          const m=row.m;
          const rid=String(m?._id||"");
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

          const {top:reactTop,myEmoji,total}=summarizeReacts(m);
          const badgeEmojis=reactTop.map(x=>x.emoji).filter(Boolean); 
          const badgeCount=total||0;
          const hasReactBadge=!isDeleted && badgeCount>0 && badgeEmojis.length;

          const showSendMark=mine && row.end && !!sendMark?.state && String(sendMark?.msgId||"")===rid && !isDeleted;
          const dragOn=String(dragOverMid||"")===rid;
          const reactOpen=String(reactFor||"")===rid;

          const reactPopup = reactOpen && !isDeleted ? (
            <div ref={reactPopRef} className="fm-chat-reactpop is-acts" style={{"--shift":`${reactShift}px`,transform:`translateX(calc(-50% + ${reactShift}px))`,zIndex:2000}}>
              {EMOJIS.map(e=>{
                const active=myEmoji===e.k;
                return (
                  <button key={e.k} type="button" className={"fm-chat-reactbtn"+(active?" is-active":"")} title={active?`${e.t} (đang chọn)` : e.t} onClick={()=>{ applyLocalReaction(rid,e.k); sendReaction(rid,e.k); setReactFor(null); }}>
                    {e.c}
                  </button>
                );
              })}
            </div>
          ) : null;

          const imgs=safeArr(m?.attachments).filter(isImg);
          const hasImgs=imgs.length>0;
          const hasText=!!String(m?.content||"").trim();
          const showTextBlock=!!replyId || hasText;
          const cols=Math.min(3,Math.max(1,imgs.length));
          const timeNode=row.end?<div className={"fm-chat-time"+(mine?" is-mine":"")}>{m?.createdAt?dayjs(m.createdAt).format("HH:mm"):""}</div>:null;

          const reactBadgeNode=hasReactBadge ? (
            <button type="button" className="fm-chat-reactbadge" onClick={()=>setReactModal({mid:rid,filter:"all"})} title="Xem cảm xúc">
              <span className="ems">{badgeEmojis.map(k=>(<span key={k} className="em">{emojiChar(k)}</span>))}</span>
              {badgeCount>1 ? <span className="ct">{badgeCount}</span> : null}
            </button>
          ) : null;

          const canDrop=!isDeleted && !isTmp;
          const bindDrop=canDrop ? {onDragOver:onMsgDragOver(rid),onDrop:onMsgDrop(rid),onDragLeave:onMsgDragLeave(rid)} : {};

          return (
            <div key={row.k} className={"fm-chat-row"+(mine?" is-mine":"")+(isTmp?" is-tmp":"")+(row.start?" is-start":"")+(row.end?" is-end":"")+(showSendMark?" has-sendmark":"")+(hasReactBadge?" has-reactbadge":"")}>
              {!mine && (row.start ? (
                <button type="button" className="fm-chat-ava" onClick={()=>canOpen && onOpenUser(sender?.rawUser||sender)} title={name||"User"}>
                  <img src={ava} alt={name||"User"} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}}/>
                </button>
              ) : <div className="fm-chat-ava-spacer" />)}

              <div className={"fm-chat-main"+(mine?" is-mine":"")}>
                {!isDeleted && mine && (
                  <div className={"fm-chat-sideacts is-left"+(reactOpen?" is-open":"")} style={reactOpen?{zIndex:1200}:undefined}>
                    <button type="button" className="fm-chat-act" onClick={()=>startReply(m)} title="Trả lời"><i className="fa-solid fa-reply" /></button>
                    <button type="button" className="fm-chat-act is-danger" onClick={()=>retract(m)} title="Thu hồi"><i className="fa-regular fa-trash-can" /></button>
                    <div className="fm-chat-reactwrap">
                      <button type="button" className={"fm-chat-act fm-chat-act-emoji"+(reactOpen?" is-on":"")} onClick={()=>toggleReactFor(rid)} title="Thả emoji">
                        <i className="fa-regular fa-face-smile" />
                      </button>
                      {reactPopup}
                    </div>
                  </div>
                )}

                <div className={"fm-chat-bubblewrap"+(mine?" is-mine":"")}>
                  {isDeleted ? (
                    <div className={"fm-chat-bubble is-deleted"+(mine?" is-mine":"")+(row.start?" is-start":"")+(row.end?" is-end":"")}>
                      {!mine && row.start && !!name && <div className="fm-chat-inname">{name}</div>}
                      <div className="fm-chat-deleted"><i className="fa-solid fa-ban" /> Tin nhắn đã thu hồi</div>
                      {timeNode}
                    </div>
                  ) : (
                    <>
                      {showTextBlock && (
                        <div className={"fm-chat-bubble"+(mine?" is-mine":"")+(row.start?" is-start":"")+(row.end && !hasImgs ? " is-end":"")+(dragOn?" is-dragover":"")} {...bindDrop}>
                          {!mine && row.start && !!name && <div className="fm-chat-inname">{name}</div>}

                          {!!replyId && (
                            <div className="fm-chat-replyline">
                              <div className="fm-chat-replybar" />
                              <div className="fm-chat-replymeta">
                                <div className="fm-chat-replyname">{replyName||"Tin nhắn"}</div>
                                <div className="fm-chat-replytext">{replyMsg?replyText:"(Không thể tải tin nhắn gốc)"}</div>
                              </div>
                            </div>
                          )}

                          {hasText ? <div className="fm-chat-text">{m.content}</div> : null}
                          {!hasImgs ? timeNode : null}
                          {!hasImgs ? reactBadgeNode : null}
                        </div>
                      )}

                      {hasImgs && (
                        <div
                          className={"fm-chat-bubble is-media"+(mine?" is-mine":"")+((!showTextBlock && row.start)?" is-start":"")+(row.end?" is-end":"")+(dragOn?" is-dragover":"")}
                          {...bindDrop}
                        >
                          {/* Nếu chỉ có ảnh (không có bubble text) thì vẫn show name */}
                          {!mine && !showTextBlock && row.start && !!name && <div className="fm-chat-inname">{name}</div>}

                          <div className={"fm-chat-atts cols-"+cols}>
                            {imgs.map((a,idx)=>(
                              <button key={`${a.url||idx}`} type="button" className="fm-chat-img" onClick={()=>setImgView({url:a.url,name:a.name||"Ảnh"})} title="Xem ảnh">
                                <img src={a.url} alt={a.name||"image"} />
                              </button>
                            ))}
                          </div>

                          {timeNode}
                          {reactBadgeNode}
                        </div>
                      )}
                    </>
                  )}

                  {showSendMark && (
                    <div className={"fm-chat-sendmark-float"+(mine?" is-mine":"")}>
                      {sendMark.state==="sending"
                        ? (<><i className="fa-solid fa-circle-notch fa-spin" /> Đang gửi</>)
                        : (<><i className="fa-solid fa-check" /> Đã gửi</>)
                      }
                    </div>
                  )}
                </div>

                {!isDeleted && !mine && (
                  <div className={"fm-chat-sideacts is-right"+(reactOpen?" is-open":"")} style={reactOpen?{zIndex:1200}:undefined}>
                    <button type="button" className="fm-chat-act" onClick={()=>startReply(m)} title="Trả lời"><i className="fa-solid fa-reply" /></button>
                    <div className="fm-chat-reactwrap">
                      <button type="button" className={"fm-chat-act fm-chat-act-emoji"+(reactOpen?" is-on":"")} onClick={()=>toggleReactFor(rid)} title="Thả emoji">
                        <i className="fa-regular fa-face-smile" />
                      </button>
                      {reactPopup}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && !items.length ? <div className="fm-chat-empty">Chưa có tin nhắn nào.</div> : null}
        <div />
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

        <div className="fm-chat-inputrow">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickFile} />
          <button type="button" className="fm-chat-attach" onClick={pickFiles} title="Chọn hình ảnh"><i className="fa-regular fa-images"></i></button>

          <div className="fm-chat-inputwrap">
            {!!files.length && (
              <div className="fm-chat-draftimgs">
                {files.map((f,idx)=>(
                  <div key={idx} className="fm-chat-draftimg">
                    <img src={fileUrl(f)} alt={f.name} />
                    <button type="button" className="fm-chat-draftimg-x" onClick={()=>removeFile(idx)} aria-label="Xóa ảnh"><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="fm-chat-inputbox">
              <textarea
                ref={inputRef}
                value={text}
                onChange={e=>{setText(e.target.value); const el=e.target; el.style.height="0px"; el.style.height=Math.min(el.scrollHeight,140)+"px";}}
                onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); e.stopPropagation(); send(); } }}
                onDrop={onInputDrop}
                onPaste={onInputPaste}
                onDragOver={(e)=>{ const dt=e.dataTransfer; const has=(dt?.getData?.("application/x-emoji-key")||emojiKeyFromChar(dt?.getData?.("text/plain")||"")||""); if(has|| (dt?.files&&dt.files.length)) e.preventDefault(); }}
                placeholder={uploading?"Đang tải ảnh…":"Nhập tin nhắn…"}
                className="fm-chat-input fm-chat-textarea"
                disabled={uploading}
                rows={1}
              />

              <button
                type="button"
                className={"fm-chat-input-emoji in-input"+(pickerOpen?" is-on":"")}
                onMouseDown={(e)=>{e.preventDefault();e.stopPropagation();setPickerOpen(v=>!v);}}
                onClick={(e)=>e.preventDefault()}
                title="Emoji (chèn vào nội dung)"
                disabled={uploading}
              >
                <i className="fa-regular fa-face-smile" />
              </button>

              {pickerOpen && (
                <div className="fm-chat-emoji-pop is-input" onMouseDown={(e)=>e.stopPropagation()}>
                  <Picker data={data} locale="vi" theme="dark" previewPosition="none" navPosition="bottom" onEmojiSelect={(emoji)=>{ insertEmojiToInput(emoji?.native || "") }} />
                </div>
              )}
            </div>
          </div>

          <button type="button" className="fm-chat-send" onClick={send} disabled={sending||uploading} title="Gửi"><i className="fa-regular fa-paper-plane" /></button>
        </div>
      </div>
    </div>
  );
}
