import ChatMessage from "../models/ChatMessage.js";
import MatchRoom from "../models/MatchRoom.js";
import { responseOk } from "../utils/response.js";

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

    const q={conversationId:id,deletedAt:null};
    if(before) q.createdAt={$lt:before};

    const msgs=await ChatMessage.find(q).sort({createdAt:-1}).limit(limit).lean();
    return responseOk(res,{items:msgs.reverse(),nextCursor:msgs.length?msgs[0].createdAt:null});
  }catch(e){next(e)}
}
