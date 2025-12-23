import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import ChatMessage from "../models/ChatMessage.js";
import MatchRoom from "../models/MatchRoom.js";
import ChatConversation from "../models/ChatConversation.js";

let io=null;

const normToken=(t)=>{if(!t)return"";return String(t).replace(/^Bearer\s+/i,"").trim()};
const uidFromDecoded=(d)=>String(d?.id||d?._id||d?.userId||d?.sub||"");
const asOid=(v)=>{try{return new mongoose.Types.ObjectId(String(v))}catch{return null}};

async function ensureMember(conversationId,uid){
  const room=await MatchRoom.findById(conversationId).lean();
  if(!room) throw Object.assign(new Error("Room not found"),{status:404});
  const members=(room.members||[]).map(m=>String(m?.user||""));
  if(!members.includes(String(uid))) throw Object.assign(new Error("Forbidden"),{status:403});
  return room;
}

async function upsertConversationFromRoom(room,{lastText,lastSenderId,lastAt,incUnreadFor=[]}={}){
  if(!room?._id) return;
  const convId=room._id;
  const type = room.type==="group" ? "group" : "duo";
  const members=(room.members||[]).map(m=>m.user).filter(Boolean);

  const $set={
    type,
    members,
    lastMessage:lastText!=null?{text:lastText,senderId:lastSenderId,createdAt:lastAt}:undefined,
    lastMessageAt:lastAt||undefined,
  };
  Object.keys($set).forEach(k=>($set[k]===undefined)&&delete $set[k]);

  // unreadBy: Map key=userId -> count
  const $inc={};
  for(const uid of incUnreadFor){
    if(!uid) continue;
    $inc[`unreadBy.${String(uid)}`]=1;
  }

  await ChatConversation.updateOne(
    { _id: convId },
    {
      $set,
      ...(Object.keys($inc).length?{$inc}:{}),
      $setOnInsert:{ createdAt:new Date() },
    },
    { upsert:true }
  );
}

async function resetUnread(conversationId,uid){
  await ChatConversation.updateOne(
    { _id: conversationId },
    { $set:{ [`unreadBy.${String(uid)}`]:0 } }
  );
}

export function initSocket(httpServer,{corsOrigin}={}){
  io=new Server(httpServer,{cors:{origin:corsOrigin||true,credentials:true}});

  io.use((socket,next)=>{
    try{
      const raw=socket.handshake.auth?.token||socket.handshake.headers?.authorization||socket.handshake.query?.token;
      const token=normToken(raw);
      if(!token) return next(new Error("NO_TOKEN"));
      const decoded=jwt.verify(token,process.env.JWT_SECRET);
      const uid=uidFromDecoded(decoded);
      if(!uid) return next(new Error("UNAUTHORIZED"));
      socket.user={_id:uid,role:decoded?.role,level:decoded?.level};
      next();
    }catch(e){next(new Error("UNAUTHORIZED"))}
  });

  io.on("connection",(socket)=>{
    const uid=String(socket.user?._id||"");
    if(uid) socket.join(`user:${uid}`);

    socket.on("chat:join",async({conversationId}={},ack)=>{
      try{
        if(!conversationId) throw new Error("Missing conversationId");
        const room=await ensureMember(conversationId,uid);
        socket.join(`conv:${conversationId}`);

        // đảm bảo có conversation doc (khi join room nhưng chưa ai nhắn)
        await upsertConversationFromRoom(room,{});
        await resetUnread(conversationId,uid);

        ack?.({ok:true});
      }catch(e){ack?.({ok:false,message:e?.message||"join failed"})}
    });

    socket.on("chat:leave",({conversationId}={},ack)=>{
      if(conversationId) socket.leave(`conv:${conversationId}`);
      ack?.({ok:true});
    });

    socket.on("chat:send",async({conversationId,clientMsgId,content,attachments=[]}={},ack)=>{
      try{
        if(!conversationId) throw new Error("Missing conversationId");
        const text=String(content||"").trim();
        if(!text && (!attachments||!attachments.length)) throw new Error("Empty message");

        const room=await ensureMember(conversationId,uid);

        // chống double nếu FE resend
        if(clientMsgId){
          const existed=await ChatMessage.findOne({conversationId,senderId:uid,clientMsgId}).lean();
          if(existed){ack?.({ok:true,message:existed,duplicated:true});return}
        }

        const msg=await ChatMessage.create({conversationId,senderId:uid,content:text,attachments,clientMsgId});
        const plain=msg.toObject();

        // update conversation + unread
        const otherIds=(room.members||[]).map(m=>String(m?.user||"")).filter(x=>x && x!==String(uid));
        await upsertConversationFromRoom(room,{lastText:text,lastSenderId:asOid(uid)||uid,lastAt:msg.createdAt,incUnreadFor:otherIds});

        // broadcast message
        io.to(`conv:${conversationId}`).emit("chat:new",plain);

        // (optional) bắn event cho badge/list chat sau này
        for(const other of otherIds){
          io.to(`user:${other}`).emit("chat:conversation_update",{conversationId,lastMessage:{text,senderId:uid,createdAt:msg.createdAt}});
        }

        ack?.({ok:true,message:plain});
      }catch(e){ack?.({ok:false,message:e?.message||"send failed"})}
    });

    socket.on("chat:seen",async({conversationId,messageId}={},ack)=>{
      try{
        if(!conversationId||!messageId) throw new Error("Missing");
        await ensureMember(conversationId,uid);

        const now=new Date();
        await ChatMessage.updateOne(
          { _id: messageId, conversationId },
          { $addToSet:{ seenBy:{userId:asOid(uid)||uid,seenAt:now} } }
        );

        await resetUnread(conversationId,uid);

        io.to(`conv:${conversationId}`).emit("chat:seen_update",{conversationId,messageId,userId:uid,seenAt:now});
        ack?.({ok:true});
      }catch(e){ack?.({ok:false,message:e?.message||"seen failed"})}
    });
  });

  return io;
}
