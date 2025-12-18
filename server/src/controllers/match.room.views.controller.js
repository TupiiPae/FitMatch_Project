import { User } from "../models/User.js";
import { responseOk } from "../utils/response.js";

const asInt=(v)=>{const n=Math.floor(Number(v||0));return Number.isFinite(n)&&n>0?n:0;};
const getUserId=(req)=>String(req?.userId||req?.user?._id||req?.user?.id||"");

const readCount=(u,roomId)=>{
  if(!u) return 0;
  const tv=u?.connectMeta?.teamViews;
  if(!tv) return 0;
  if(typeof tv.get==="function") return Number(tv.get(String(roomId))||0)||0; // Map
  return Number(tv[String(roomId)]||0)||0; // plain object fallback
};

export async function getMyRoomView(req,res){
  const userId=getUserId(req), roomId=String(req.params.id||"");
  if(!userId) return res.status(401).json({message:"Thiếu userId từ token."});
  const path=`connectMeta.teamViews.${roomId}`;
  const u=await User.findById(userId).select(path);
  return responseOk(res,{count:readCount(u,roomId)});
}

export async function bumpMyRoomView(req,res){
  const userId=getUserId(req), roomId=String(req.params.id||"");
  if(!userId) return res.status(401).json({message:"Thiếu userId từ token."});
  const path=`connectMeta.teamViews.${roomId}`;
  const u=await User.findByIdAndUpdate(userId,{$inc:{[path]:1}},{new:true}).select(path);
  return responseOk(res,{count:readCount(u,roomId)});
}

export async function syncMyRoomView(req,res){
  const userId=getUserId(req), roomId=String(req.params.id||"");
  if(!userId) return res.status(401).json({message:"Thiếu userId từ token."});
  const incoming=asInt(req.body?.count);
  const path=`connectMeta.teamViews.${roomId}`;

  const u=await User.findById(userId).select(path);
  const cur=readCount(u,roomId);
  const next=Math.max(cur,incoming);

  if(next!==cur) await User.updateOne({_id:userId},{$set:{[path]:next}});
  return responseOk(res,{count:next});
}
