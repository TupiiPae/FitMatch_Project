import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { getChatMessages } from "../../api/chat";
import { getSocket } from "../../lib/socket";
import { toast } from "react-toastify";

export default function ChatBox({ conversationId, meId, height=520 }){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [text,setText]=useState("");
  const listRef=useRef(null);
  const socket=useMemo(()=>getSocket(),[]);

  const scrollBottom=()=>{requestAnimationFrame(()=>{const el=listRef.current;if(el) el.scrollTop=el.scrollHeight})};

  const load=async()=>{
    if(!conversationId) return;
    setLoading(true);
    try{
      const data=await getChatMessages(conversationId,{limit:80});
      setItems(data?.items||[]);
      scrollBottom();
    }catch(e){
      toast.error(e?.response?.data?.message||"Không tải được tin nhắn");
      setItems([]);
    }finally{setLoading(false)}
  };

  useEffect(()=>{load()},[conversationId]);

  useEffect(()=>{
    if(!conversationId) return;
    socket.emit("chat:join",{conversationId},(ack)=>{if(!ack?.ok) toast.error(ack?.message||"Không vào được phòng chat")});
    const onNew=(msg)=>{if(String(msg.conversationId)!==String(conversationId))return;setItems(p=>[...p,msg]);scrollBottom()};
    socket.on("chat:new",onNew);
    return ()=>{socket.off("chat:new",onNew);socket.emit("chat:leave",{conversationId})};
  },[socket,conversationId]);

  const send=()=>{
    const content=text.trim();
    if(!content||!conversationId) return;
    const clientMsgId=`c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setText("");
    socket.emit("chat:send",{conversationId,clientMsgId,content},(ack)=>{if(!ack?.ok) toast.error(ack?.message||"Gửi thất bại")});
  };

  return (
    <div className="cn-box" style={{padding:12,borderRadius:16,display:"flex",flexDirection:"column",height}}>
      <div style={{fontWeight:800,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>Trò chuyện</div>
        <button className="cn-btn" onClick={load} disabled={loading} style={{padding:"8px 10px",borderRadius:12}}>Làm mới</button>
      </div>

      <div ref={listRef} style={{flex:1,overflow:"auto",padding:10,borderRadius:14,background:"rgba(255,255,255,.06)"}}>
        {loading?<div style={{opacity:.7}}>Đang tải...</div>:null}
        {items.map(m=>{
          const mine=String(m.senderId)===String(meId);
          return (
            <div key={m._id} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start",margin:"6px 0"}}>
              <div style={{maxWidth:"78%",padding:"10px 12px",borderRadius:14,background:mine?"rgba(69,195,154,.22)":"rgba(255,255,255,.10)"}}>
                <div style={{whiteSpace:"pre-wrap"}}>{m.content}</div>
                <div style={{opacity:.6,fontSize:11,marginTop:6,textAlign:mine?"right":"left"}}>{m.createdAt?dayjs(m.createdAt).format("HH:mm"):""}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",gap:8,marginTop:10}}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}}
          placeholder="Nhập tin nhắn..." style={{flex:1,padding:"10px 12px",borderRadius:14,border:"1px solid rgba(255,255,255,.18)",background:"transparent",color:"inherit"}}/>
        <button className="cn-btn primary" onClick={send} style={{padding:"10px 14px",borderRadius:14}}>Gửi</button>
      </div>
    </div>
  );
}
