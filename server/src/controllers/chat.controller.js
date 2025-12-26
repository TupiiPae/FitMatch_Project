import ChatMessage from "../models/ChatMessage.js";
import MatchRoom from "../models/MatchRoom.js";
import { responseOk } from "../utils/response.js";
import { uploadImageWithResize } from "../utils/cloudinary.js";
import ChatConversation from "../models/ChatConversation.js";

const uidFromReq=(req)=>String(req?.userId||req?.user?._id||"");

async function ensureMember(conversationId,uid){
  const room=await MatchRoom.findById(conversationId).lean();
  if(!room) throw Object.assign(new Error("Room not found"),{status:404});
  const members=(room.members||[]).map(m=>String(m?.user||""));
  if(!members.includes(String(uid))) throw Object.assign(new Error("Forbidden"),{status:403});
  return room;
}

// GET /api/chat/conversations/:id/messages?limit=50&before=ISO
export async function getMessages(req,res,next){
  try{
    const uid=uidFromReq(req);
    const { id }=req.params;
    const limit=Math.min(parseInt(req.query.limit||"50",10),100);
    const before=req.query.before?new Date(req.query.before):null;

    await ensureMember(id,uid);

    const q={conversationId:id};
    if(before) q.createdAt={$lt:before};

    const msgs=await ChatMessage.find(q).sort({createdAt:-1}).limit(limit).lean();
    return responseOk(res,{items:msgs.reverse(),nextCursor:msgs.length?msgs[0].createdAt:null});
  }catch(e){next(e)}
}

export async function uploadChatImage(req,res,next){
  try{
    const uid=uidFromReq(req);
    const { id }=req.params;
    await ensureMember(id,uid);

    const file=req.file;
    if(!file) return res.status(400).json({ message:"Không có ảnh" });

    // Upload lên Cloudinary folder chat_images
    const url = await uploadImageWithResize(
      file.buffer,
      "asset/folder/chat_images",
      { width: 2048, height: 2048, fit: "inside" }, // không crop, chỉ giới hạn kích thước
      { quality: 85 }
    );

    return responseOk(res,{
      type:"image",
      url,
      name:file.originalname||"",
      size:file.size||0,
    });
  }catch(e){next(e)}
}

export async function getConversationSummary(req,res,next){
  try{
    const uid=uidFromReq(req);
    const { id }=req.params;
    await ensureMember(id,uid);

    let conv=await ChatConversation.findById(id).select("type lastMessage lastMessageAt unreadBy").lean();
    if(!conv){
      const room=await MatchRoom.findById(id).lean();
      if(room){
        try{
          await ChatConversation.create({
            _id:id,
            type: room.type==="group" ? "group" : "duo",
            members:(room.members||[]).map(m=>m.user).filter(Boolean),
            lastMessage:null,
            lastMessageAt:null,
            unreadBy:{},
          });
        }catch{}
      }
      conv=await ChatConversation.findById(id).select("type lastMessage lastMessageAt unreadBy").lean();
    }

    const m=conv?.unreadBy;
    const unread=typeof m?.get==="function" ? Number(m.get(String(uid))||0) : Number(m?.[String(uid)]||0);

    return responseOk(res,{conversationId:id,unread,type:conv?.type||null,lastMessage:conv?.lastMessage||null,lastMessageAt:conv?.lastMessageAt||null});
  }catch(e){next(e)}
}
