import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { getChatMessages } from "../../api/chat";
import { getSocket } from "../../lib/socket";
import { toast } from "react-toastify";

const safeArr=v=>Array.isArray(v)?v:[];
const uniq=(arr)=>{const m=new Map();for(const x of safeArr(arr)){const k=String(x?._id||x?.clientMsgId||"");if(k)m.set(k,x);}return Array.from(m.values()).sort((a,b)=>new Date(a?.createdAt||0)-new Date(b?.createdAt||0));};
const sameDay=(a,b)=>dayjs(a).isValid()&&dayjs(b).isValid()&&dayjs(a).format("YYYY-MM-DD")===dayjs(b).format("YYYY-MM-DD");

export default function ChatBox({ conversationId, meId, members=[], height=520, onOpenUser }){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [text,setText]=useState("");
  const listRef=useRef(null);
  const bottomRef=useRef(null);
  const socket=useMemo(()=>getSocket(),[]);
  const myId=String(meId||"");

  const memberMap=useMemo(()=>{
    const m=new Map();
    safeArr(members).forEach(x=>{const id=String(x?.id||x?._id||""); if(id) m.set(id,x);});
    return m;
  },[members]);

  const scrollBottom=(smooth=false)=>{requestAnimationFrame(()=>{bottomRef.current?.scrollIntoView({behavior:smooth?"smooth":"auto",block:"end"});});};

  const load=async()=>{ // load latest
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

  useEffect(()=>{load()},[conversationId]);

  useEffect(()=>{
    if(!conversationId) return;
    socket.emit("chat:join",{conversationId},(ack)=>{if(!ack?.ok) toast.error(ack?.message||"Không vào được phòng chat")});

    const onNew=(msg)=>{
      if(String(msg?.conversationId||"")!==String(conversationId)) return;
      setItems(prev=>uniq([...prev,msg]));
      scrollBottom(true);
    };

    socket.on("chat:new",onNew);
    return ()=>{socket.off("chat:new",onNew);socket.emit("chat:leave",{conversationId})};
  },[socket,conversationId]);

  const send=()=>{
    const content=String(text||"").trim();
    if(!content||!conversationId) return;

    const clientMsgId=`c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tmp={_id:`tmp_${clientMsgId}`,conversationId,senderId:myId,content,clientMsgId,createdAt:new Date().toISOString(),_tmp:true};

    setText("");
    setItems(prev=>uniq([...prev,tmp]));
    scrollBottom(true);

    socket.emit("chat:send",{conversationId,clientMsgId,content},(ack)=>{
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

  const rows=useMemo(()=>{
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

  return (
    <div className="cn-box" style={{padding:12,borderRadius:16,display:"flex",flexDirection:"column",height}}>
      <div style={{fontWeight:800,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>Trò chuyện</div>
        <button className="cn-btn" onClick={load} disabled={loading} style={{padding:"8px 10px",borderRadius:12}}>Làm mới</button>
      </div>

      <div ref={listRef} style={{flex:1,overflow:"auto",padding:10,borderRadius:14,background:"rgba(255,255,255,.06)"}}>
        {loading?<div style={{opacity:.7}}>Đang tải...</div>:null}

        {rows.map(r=>{
          if(r.t==="date") return <div key={r.k} style={{display:"flex",justifyContent:"center",margin:"10px 0"}}><span style={{fontSize:12,opacity:.75,padding:"4px 10px",borderRadius:999,border:"1px solid rgba(255,255,255,.12)"}}>{r.v}</span></div>;
          const m=r.m;
          const sid=String(m?.senderId?._id||m?.senderId||"");
          const mine=sid===myId;
          const sender=memberMap.get(sid)||null;
          const name=sender?.name||sender?.nickname||"";
          const ava=sender?.avatarUrl||sender?.imageUrl||"/images/avatar.png";
          const canOpen=!!onOpenUser && !!sid && !mine;

          return (
            <div key={r.k} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start",gap:8,margin:"6px 0",alignItems:"flex-end",opacity:m?._tmp?.7:1}}>
              {!mine && (
                <div onClick={()=>canOpen && onOpenUser(sender?.rawUser||sender)} style={{width:28,height:28,borderRadius:999,overflow:"hidden",border:"1px solid rgba(255,255,255,.12)",cursor:canOpen?"pointer":"default"}}>
                  <img src={ava} alt={name||"User"} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}}/>
                </div>
              )}
              <div style={{maxWidth:"78%"}}>
                {!mine && !!name && <div style={{fontSize:12,opacity:.75,margin:"0 0 2px 6px"}}>{name}</div>}
                <div style={{padding:"10px 12px",borderRadius:14,background:mine?"rgba(69,195,154,.22)":"rgba(255,255,255,.10)"}}>
                  <div style={{whiteSpace:"pre-wrap"}}>{m?.content}</div>
                  <div style={{opacity:.6,fontSize:11,marginTop:6,textAlign:mine?"right":"left"}}>{m?.createdAt?dayjs(m.createdAt).format("HH:mm"):""}</div>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && !items.length ? <div style={{opacity:.7}}>Chưa có tin nhắn nào.</div> : null}
        <div ref={bottomRef}/>
      </div>

      <div style={{display:"flex",gap:8,marginTop:10}}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}}
          placeholder="Nhập tin nhắn..." style={{flex:1,padding:"10px 12px",borderRadius:14,border:"1px solid rgba(255,255,255,.18)",background:"transparent",color:"inherit"}}/>
        <button className="cn-btn primary" onClick={send} style={{padding:"10px 14px",borderRadius:14}}>Gửi</button>
      </div>
    </div>
  );
}
