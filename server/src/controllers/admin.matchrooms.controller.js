// server/src/controllers/admin.matchrooms.controller.js
import mongoose from "mongoose";
import MatchRoom from "../models/MatchRoom.js";
import MatchRequest from "../models/MatchRequest.js";
import ConnectReport from "../models/ConnectReport.js";
import { User } from "../models/User.js";
import { responseOk } from "../utils/response.js";

const escRx=(s="")=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const parseIntSafe=(v)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const isObjectIdLike=(s="")=>/^[0-9a-fA-F]{24}$/.test(String(s||"").trim());

function calcRoomStatus(room){
  const cnt=(room.members||[]).length||0;
  if(cnt===0) return { status:"closed", closedAt: room.closedAt||new Date() };
  if(cnt>=(room.maxMembers||5)) return { status:"full", closedAt: room.closedAt||new Date() };
  return { status:"active", closedAt:null };
}

// GET /api/admin/match-rooms?type=duo|group&q=&status=&hasPendingReports=&limit=&skip=
export async function listMatchRoomsAdmin(req,res,next){
  try{
    const type=String(req.query?.type||"").trim(); // duo | group
    const qRaw=String(req.query?.q||"").trim();
    const status=String(req.query?.status||"").trim(); // active|full|closed|running
    const hasPendingReports=String(req.query?.hasPendingReports||"").trim().toLowerCase();
    const hasPending = ["1","true","yes","on"].includes(hasPendingReports);

    const limit=Math.min(100,Math.max(1,parseIntSafe(req.query?.limit)||20));
    const skip=Math.max(0,parseIntSafe(req.query?.skip)||0);

    const filter={};
    if(["duo","group"].includes(type)) filter.type=type;

    if(status){
      if(status==="running") filter.status={ $in:["active","full"] };
      else if(["active","full","closed"].includes(status)) filter.status=status;
    }

    // ===== Search =====
    let userIds=[];
    if(qRaw){
      if(isObjectIdLike(qRaw)) filter._id=qRaw;
      else{
        const rx=new RegExp(escRx(qRaw),"i");
        const us=await User.find({ $or:[{ username:rx },{ email:rx },{ "profile.nickname":rx }] })
          .select("_id").limit(200).lean();
        userIds=(us||[]).map(x=>x._id);

        filter.$or=[
          { locationLabel:rx },
          { goalLabel:rx },
          { goalKey:rx },
          { name:rx },
          { description:rx },
        ];
        if(userIds.length) filter.$or.push({ "members.user":{ $in:userIds } });
      }
    }

    // ===== pending reports filter (duo => theo member user; group => theo targetRoom) =====
    if(hasPending){
      if(type==="group"){
        const ids=await ConnectReport.distinct("targetRoom",{ targetType:"group", status:"pending" });
        filter._id = filter._id ? filter._id : { $in: ids };
      }else if(type==="duo"){
        const ids=await ConnectReport.distinct("targetUser",{ targetType:"user", status:"pending" });
        filter["members.user"]={ $in: ids };
      }
    }

    const [total,rooms]=await Promise.all([
      MatchRoom.countDocuments(filter),
      MatchRoom.find(filter)
        .sort({ updatedAt:-1 })
        .skip(skip)
        .limit(limit)
        .populate({ path:"createdBy", select:"username email profile.nickname profile.avatarUrl" })
        .populate({ path:"members.user", select:"username email profile.nickname profile.avatarUrl" })
        .lean(),
    ]);

    const roomIds=rooms.map(r=>r._id);
    const uniqUserIds=Array.from(new Set(
      rooms.flatMap(r=>(r.members||[]).map(m=>String(m.user?._id||m.user))).filter(Boolean)
    )).filter(isObjectIdLike).map(x=>new mongoose.Types.ObjectId(x));

    // ===== reports counts =====
    const groupReportAgg=roomIds.length?await ConnectReport.aggregate([
      { $match:{ targetType:"group", targetRoom:{ $in: roomIds } } },
      { $group:{ _id:"$targetRoom", total:{ $sum:1 }, pending:{ $sum:{ $cond:[{ $eq:["$status","pending"] },1,0] } } } },
    ]):[];
    const groupReportMap=new Map(groupReportAgg.map(x=>[String(x._id),{ total:x.total||0, pending:x.pending||0 }]));

    const userReportAgg=uniqUserIds.length?await ConnectReport.aggregate([
      { $match:{ targetType:"user", targetUser:{ $in: uniqUserIds } } },
      { $group:{ _id:"$targetUser", total:{ $sum:1 }, pending:{ $sum:{ $cond:[{ $eq:["$status","pending"] },1,0] } } } },
    ]):[];
    const userReportMap=new Map(userReportAgg.map(x=>[String(x._id),{ total:x.total||0, pending:x.pending||0 }]));

    // ===== pending join requests (group only) =====
    const reqAgg=roomIds.length?await MatchRequest.aggregate([
      { $match:{ type:"group", status:"pending", toRoom:{ $in: roomIds } } },
      { $group:{ _id:"$toRoom", pending:{ $sum:1 } } },
    ]):[];
    const reqMap=new Map(reqAgg.map(x=>[String(x._id),Number(x.pending||0)]));

    const items=(rooms||[]).map(r=>{
      const members=(r.members||[]).map(m=>{
        const u=m.user||{};
        return {
          id:String(u._id||u.id||u||""),
          role:m.role||"member",
          joinedAt:m.joinedAt||null,
          username:u.username||"",
          email:u.email||"",
          nickname:u?.profile?.nickname||"",
          avatarUrl:u?.profile?.avatarUrl||null,
        };
      });

      const key=String(r._id);

      let reportsTotal=0,reportsPending=0;
      if(r.type==="group"){
        const v=groupReportMap.get(key)||{ total:0,pending:0 };
        reportsTotal=v.total; reportsPending=v.pending;
      }else{
        for(const m of members){
          const v=userReportMap.get(String(m.id))||{ total:0,pending:0 };
          reportsTotal+=v.total; reportsPending+=v.pending;
        }
      }

      return {
        _id:key,
        type:r.type,
        status:r.status,
        maxMembers:r.maxMembers,
        membersCount:members.length,
        createdAt:r.createdAt,
        updatedAt:r.updatedAt,
        closedAt:r.closedAt||null,

        // image for group list
        coverImageUrl:r.coverImageUrl||null,

        // group fields
        name:r.name||"",
        locationLabel:r.locationLabel||"",
        goalLabel:r.goalLabel||"",
        joinPolicy:r.joinPolicy||"",
        ageRange:r.ageRange||"",
        gender:r.gender||"",
        trainingFrequency:r.trainingFrequency||"",

        // computed
        pendingJoinRequests:r.type==="group" ? (reqMap.get(key)||0) : 0,
        reportsPending,
        reportsTotal,

        createdBy:r.createdBy?{
          id:String(r.createdBy._id||""),
          username:r.createdBy.username||"",
          email:r.createdBy.email||"",
          nickname:r.createdBy?.profile?.nickname||"",
          avatarUrl:r.createdBy?.profile?.avatarUrl||null,
        }:null,

        members,
      };
    });

    return responseOk(res,{ items,total,limit,skip });
  }catch(err){ next(err); }
}

// GET /api/admin/match-rooms/:id
export async function getMatchRoomAdmin(req,res,next){
  try{
    const { id }=req.params;
    if(!id||!isObjectIdLike(id)) return res.status(400).json({ message:"RoomId không hợp lệ" });

    const room=await MatchRoom.findById(id)
      .populate({ path:"createdBy", select:"username email profile.nickname profile.avatarUrl" })
      .populate({ path:"members.user", select:"username email profile.nickname profile.avatarUrl profile.sex profile.dob" })
      .lean();
    if(!room) return res.status(404).json({ message:"Không tìm thấy phòng" });

    const members=(room.members||[]).map(m=>{
      const u=m.user||{};
      return {
        id:String(u._id||u.id||u||""),
        role:m.role||"member",
        joinedAt:m.joinedAt||null,
        username:u.username||"",
        email:u.email||"",
        nickname:u?.profile?.nickname||"",
        avatarUrl:u?.profile?.avatarUrl||null,
        sex:u?.profile?.sex||null,
        dob:u?.profile?.dob||null,
      };
    });

    let reportsTotal=0,reportsPending=0;
    if(room.type==="group"){
      const agg=await ConnectReport.aggregate([
        { $match:{ targetType:"group", targetRoom:new mongoose.Types.ObjectId(id) } },
        { $group:{ _id:"$targetRoom", total:{ $sum:1 }, pending:{ $sum:{ $cond:[{ $eq:["$status","pending"] },1,0] } } } },
      ]);
      const v=agg?.[0]||{ total:0,pending:0 };
      reportsTotal=v.total||0; reportsPending=v.pending||0;
    }else{
      const memberIds=members.map(x=>x.id).filter(isObjectIdLike).map(x=>new mongoose.Types.ObjectId(x));
      const agg=memberIds.length?await ConnectReport.aggregate([
        { $match:{ targetType:"user", targetUser:{ $in: memberIds } } },
        { $group:{ _id:"$targetUser", total:{ $sum:1 }, pending:{ $sum:{ $cond:[{ $eq:["$status","pending"] },1,0] } } } },
      ]):[];
      const map=new Map(agg.map(x=>[String(x._id),{ total:x.total||0,pending:x.pending||0 }]));
      for(const m of members){
        const v=map.get(String(m.id))||{ total:0,pending:0 };
        reportsTotal+=v.total; reportsPending+=v.pending;
      }
    }

    const pendingJoinRequests=room.type==="group"
      ? await MatchRequest.countDocuments({ type:"group", status:"pending", toRoom:id })
      : 0;

    return responseOk(res,{
      ...room,
      _id:String(room._id),
      members,
      reportsTotal,
      reportsPending,
      pendingJoinRequests,
    });
  }catch(err){ next(err); }
}

// POST /api/admin/match-rooms/:id/close  body:{ reason? }
export async function closeMatchRoomAdmin(req,res,next){
  try{
    const { id }=req.params;
    const reason=String(req.body?.reason||"").trim();
    const adminId=req.adminId||null;

    const room=await MatchRoom.findById(id);
    if(!room) return res.status(404).json({ message:"Không tìm thấy phòng" });

    room.status="closed";
    room.closedAt=room.closedAt||new Date();
    room.adminClosedReason=reason;
    room.adminClosedBy=adminId||room.adminClosedBy||null;

    await room.save();
    return responseOk(res,{ success:true });
  }catch(err){ next(err); }
}

// DELETE /api/admin/match-rooms/:id
export async function deleteMatchRoomAdmin(req,res,next){
  try{
    const { id }=req.params;
    if(!id||!isObjectIdLike(id)) return res.status(400).json({ message:"RoomId không hợp lệ" });

    const room=await MatchRoom.findById(id).select("_id type").lean();
    if(!room) return res.status(404).json({ message:"Không tìm thấy phòng" });

    await MatchRoom.deleteOne({ _id:id });

    // chỉ dọn dữ liệu liên quan theo "group" (request + report theo room)
    if(room.type==="group"){
      await Promise.all([
        MatchRequest.deleteMany({ type:"group", toRoom:id }),
        ConnectReport.deleteMany({ targetType:"group", targetRoom:id }),
      ]);
    }

    return responseOk(res,{ success:true, deletedId:String(id) });
  }catch(err){ next(err); }
}

// DELETE /api/admin/match-rooms   body:{ ids:[] }
export async function deleteManyMatchRoomsAdmin(req,res,next){
  try{
    const ids=Array.isArray(req.body?.ids)?req.body.ids.map(x=>String(x||"").trim()).filter(isObjectIdLike):[];
    if(!ids.length) return res.status(400).json({ message:"Thiếu danh sách ids hợp lệ" });

    // lấy type để chỉ cleanup cho group
    const rooms=await MatchRoom.find({ _id:{ $in: ids } }).select("_id type").lean();
    const groupIds=(rooms||[]).filter(r=>r.type==="group").map(r=>String(r._id));

    await MatchRoom.deleteMany({ _id:{ $in: ids } });

    if(groupIds.length){
      await Promise.all([
        MatchRequest.deleteMany({ type:"group", toRoom:{ $in: groupIds } }),
        ConnectReport.deleteMany({ targetType:"group", targetRoom:{ $in: groupIds } }),
      ]);
    }

    return responseOk(res,{ success:true, deletedCount: ids.length, ids });
  }catch(err){ next(err); }
}

// POST /api/admin/match-rooms/:id/kick  body:{ userId, reason? }
export async function kickMemberAdmin(req,res,next){
  try{
    const { id }=req.params;
    const userId=String(req.body?.userId||"").trim();
    const reason=String(req.body?.reason||"").trim();
    if(!isObjectIdLike(userId)) return res.status(400).json({ message:"userId không hợp lệ" });

    const room=await MatchRoom.findById(id);
    if(!room) return res.status(404).json({ message:"Không tìm thấy phòng" });

    const members=room.members||[];
    const idx=members.findIndex(m=>String(m.user)===String(userId));
    if(idx===-1) return res.status(404).json({ message:"Người dùng không thuộc phòng" });

    const isOwner=members[idx]?.role==="owner";
    if(room.type==="group"&&isOwner) return res.status(400).json({ message:"Không thể kick chủ phòng. Hãy chuyển chủ phòng trước." });

    members.splice(idx,1);
    room.members=members;

    const st=calcRoomStatus(room);
    room.status=st.status;
    room.closedAt=st.closedAt;

    if(reason){
      room.adminClosedReason=room.adminClosedReason ? (room.adminClosedReason+` | kick:${reason}`) : `kick:${reason}`;
    }

    await room.save();
    return responseOk(res,{ success:true });
  }catch(err){ next(err); }
}

// POST /api/admin/match-rooms/:id/transfer-owner  body:{ newOwnerId }
export async function transferOwnerAdmin(req,res,next){
  try{
    const { id }=req.params;
    const newOwnerId=String(req.body?.newOwnerId||"").trim();
    if(!isObjectIdLike(newOwnerId)) return res.status(400).json({ message:"newOwnerId không hợp lệ" });

    const room=await MatchRoom.findById(id);
    if(!room) return res.status(404).json({ message:"Không tìm thấy phòng" });
    if(room.type!=="group") return res.status(400).json({ message:"Chỉ Team (group) mới chuyển chủ phòng" });

    const members=room.members||[];
    const has=members.some(m=>String(m.user)===String(newOwnerId));
    if(!has) return res.status(400).json({ message:"Người được chọn không thuộc nhóm" });

    for(const m of members){
      if(m.role==="owner") m.role="member";
      if(String(m.user)===String(newOwnerId)) m.role="owner";
    }
    room.createdBy=newOwnerId;

    await room.save();
    return responseOk(res,{ success:true });
  }catch(err){ next(err); }
}
