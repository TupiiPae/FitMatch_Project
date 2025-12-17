// server/src/controllers/match.controller.js
import MatchRoom from "../models/MatchRoom.js";
import MatchRequest from "../models/MatchRequest.js";
import { User } from "../models/User.js";
import { responseOk } from "../utils/response.js";
import { uploadImageWithResize } from "../utils/cloudinary.js";

// ===== Helpers =====
async function findActiveRoomOfUser(userId){
  return MatchRoom.findOne({ "members.user": userId, status: { $in: ["active","full"] } });
}

const GOAL_LABELS = { giam_can:"Giảm cân", duy_tri:"Duy trì", tang_can:"Tăng cân", giam_mo:"Giảm mỡ", tang_co:"Tăng cơ" };
const INTENSITY_LABELS = { level_1:"Không tập luyện, ít vận động", level_2:"Vận động nhẹ nhàng", level_3:"Chăm chỉ tập luyện", level_4:"Rất năng động" };
const FREQ_LABELS = { "1-2":"1-2 buổi/tuần", "2-3":"2-3 buổi/tuần", "3-5":"3-5 buổi/tuần", "5+":"Trên 5 buổi/tuần" };

function goalLabelFromKey(key){ if(!key) return null; return GOAL_LABELS[key] || null; }
function intensityLabelFromKey(key){ if(!key) return null; return INTENSITY_LABELS[key] || null; }

function calcAge(dobValue){
  if(!dobValue) return null;
  const d=new Date(dobValue); if(Number.isNaN(d.getTime())) return null;
  const now=new Date(); let age=now.getFullYear()-d.getFullYear();
  const m=now.getMonth()-d.getMonth(); if(m<0||(m===0&&now.getDate()<d.getDate())) age--;
  return age;
}

function getUserIdFromReq(req){ return req.userId || req.user?._id || null; }

function hasAddress(profile){
  const addr=profile?.address; if(!addr) return false;
  const { city, district, ward, country } = addr;
  return !!(city||district||ward||country);
}

function buildLocationLabel(profile, storedLabel){
  if(storedLabel) return storedLabel;
  const addr=profile?.address; if(!addr) return "";
  const { district, city, country } = addr;
  if(district&&city) return `${district}, ${city}`;
  if(city&&country) return `${city}, ${country}`;
  return district||city||country||"";
}

// full label theo yêu cầu: quốc gia - thành phố - quận - phường
function buildFullLocationLabel(profile){
  const a=profile?.address||{};
  return [a.country, a.city, a.district, a.ward].filter(Boolean).join(" - ");
}

function buildAreaInfo(meProfile, otherProfile){
  if(!meProfile||!otherProfile) return { areaKey:null, areaLabel:"" };
  const a=meProfile.address||{}, b=otherProfile.address||{};
  const norm=(v)=>(v||"").toString().trim().toLowerCase();
  const cityA=norm(a.city), cityB=norm(b.city);
  const districtA=norm(a.district), districtB=norm(b.district);
  const wardA=norm(a.ward), wardB=norm(b.ward);
  if(!cityA||!cityB) return { areaKey:null, areaLabel:"" };
  if(cityA===cityB){
    if(districtA&&districtB&&districtA===districtB){
      if(wardA&&wardB&&wardA===wardB) return { areaKey:"same_ward", areaLabel:"Rất gần bạn" };
      return { areaKey:"same_district", areaLabel:"Trong quận của bạn" };
    }
    return { areaKey:"same_city", areaLabel:"Cùng thành phố" };
  }
  return { areaKey:"other", areaLabel:"Ngoài khu vực" };
}

function buildNearbyUserCard(user, meProfile){
  const profile=user.profile||{};
  const nickname=profile.nickname||user.username||"Người dùng FitMatch";
  const age=profile.dob?calcAge(profile.dob):null;
  const gender=profile.sex||null;

  const goalKey=user.connectGoalKey||profile.goal||null;
  const goalLabel=user.connectGoalLabel||goalLabelFromKey(goalKey)||null;

  const trainingTypes=Array.isArray(user.connectTrainingTypes)?user.connectTrainingTypes:[];
  const frequency=user.connectTrainingFrequencyLabel||"";

  const intensityKey=profile.trainingIntensity||null;
  const intensityLabel=intensityLabelFromKey(intensityKey)||null;

  const locationLabel=buildLocationLabel(profile, user.connectLocationLabel);
  const bio=user.connectBio||"";
  const imageUrl=profile.avatarUrl||null;

  const { areaKey, areaLabel } = buildAreaInfo(meProfile, profile);

  return { id:user._id, isGroup:false, nickname, age, gender, goal:goalLabel, goalKey, trainingTypes, frequency, intensityKey, intensityLabel, locationLabel, bio, imageUrl, areaKey, areaLabel };
}

function buildNearbyGroupCard(room){
  const membersCount=room.members?.length||0;
  const goalLabel=room.goalLabel || goalLabelFromKey(room.goalKey) || room.goalKey || null;
  return {
    id: room._id,
    nickname: room.name || "Nhóm tập luyện",
    isGroup: true,
    membersCount,
    gender: room.gender || "all",
    ageRange: room.ageRange || "all",
    trainingFrequency: room.trainingFrequency || null,
    frequency: room.trainingFrequency ? (FREQ_LABELS[room.trainingFrequency]||room.trainingFrequency) : (room.scheduleText||""),
    joinPolicy: room.joinPolicy || "request",
    goal: goalLabel,
    goalKey: room.goalKey || null,
    trainingTypes: room.trainingTypes || [],
    locationLabel: room.locationLabel || "",
    bio: room.description || "",
    imageUrl: room.coverImageUrl || null,
    areaKey: null,
    areaLabel: "",
  };
}

async function isOwnerOfRoom(userId, roomId){
  const r = await MatchRoom.findOne({ _id: roomId, "members.user": userId, "members.role": "owner", status: { $in: ["active","full"] } }).select("_id").lean();
  return !!r;
}

function parseIntSafe(v){ const n=Number(v); return Number.isFinite(n)?n:null; }

// ===== API =====

// GET /api/match/status
export async function getMatchStatus(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });

    const [me, room] = await Promise.all([
      User.findById(userId).select("connectDiscoverable hasAddressForConnect profile").lean(),
      findActiveRoomOfUser(userId),
    ]);
    if(!me) return res.status(404).json({ success:false, message:"Không tìm thấy người dùng" });

    const hasAddr = me.hasAddressForConnect || hasAddress(me.profile||{});

    // pending duo incoming (toUser)
    const incomingDuo = await MatchRequest.countDocuments({ toUser:userId, status:"pending", type:"duo" });

    // pending group incoming (toRoom) chỉ tính nếu user là owner của room đó
    const ownerRooms = await MatchRoom.find({ type:"group", status:{ $in:["active","full"] }, "members.user": userId, "members.role":"owner" }).select("_id").lean();
    const ownerRoomIds = ownerRooms.map(x=>x._id);
    const incomingGroup = ownerRoomIds.length ? await MatchRequest.countDocuments({ type:"group", status:"pending", toRoom:{ $in: ownerRoomIds } }) : 0;

    // outgoing pending (fromUser) (duo + group)
    const outgoing = await MatchRequest.countDocuments({ fromUser:userId, status:"pending" });

    return responseOk(res, {
      discoverable: !!me.connectDiscoverable,
      hasAddressForConnect: !!hasAddr,
      activeRoomId: room ? room._id : null,
      activeRoomType: room ? room.type : null,
      pendingRequestsCount: (incomingDuo + incomingGroup + outgoing),
    });
  }catch(err){ next(err); }
}

// PATCH /api/match/discoverable
export async function updateDiscoverable(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });

    const { discoverable } = req.body || {};
    const user = await User.findById(userId).select("connectDiscoverable hasAddressForConnect profile");
    if(!user) return res.status(404).json({ success:false, message:"Không tìm thấy người dùng" });

    const hasAddr = user.hasAddressForConnect || hasAddress(user.profile||{});
    if(discoverable && !hasAddr){
      return res.status(400).json({ ok:false, error:"need_address", message:"Bạn cần cập nhật địa chỉ trong hồ sơ trước khi bật cho phép tìm kiếm." });
    }

    user.connectDiscoverable = !!discoverable;
    if(!user.hasAddressForConnect && hasAddr) user.hasAddressForConnect = true;
    await user.save();

    return responseOk(res, { discoverable: user.connectDiscoverable });
  }catch(err){ next(err); }
}

// GET /api/match/nearby?mode=one_to_one|group
export async function listNearby(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });

    const { mode="one_to_one" } = req.query || {};
    const me = await User.findById(userId).lean();
    if(!me) return res.status(404).json({ success:false, message:"Không tìm thấy người dùng" });

    let users=[], groups=[];
    if(mode==="one_to_one"){
      users = await User.find({ _id:{ $ne:userId }, role:"user", connectDiscoverable:true }).limit(100).lean();
    }else if(mode==="group"){
      groups = await MatchRoom.find({
        type:"group",
        status:{ $in:["active"] },
        $expr:{ $lt:[{ $size:"$members" }, "$maxMembers"] },
      }).limit(50).lean();
    }

    const userCards = mode==="one_to_one" ? users.map(u=>buildNearbyUserCard(u, me.profile)) : [];
    const groupCards = mode==="group" ? groups.map(buildNearbyGroupCard) : [];

    let selfCard=null;
    if(me.connectDiscoverable){
      selfCard=buildNearbyUserCard(me, me.profile);
      selfCard.areaKey="home"; selfCard.areaLabel="Nhà";
    }

    return responseOk(res, { self:selfCard, items: mode==="one_to_one" ? userCards : groupCards });
  }catch(err){ next(err); }
}

/* ================== TEAM: CREATE GROUP (Cloudinary) ================== */
// POST /api/match/groups (multipart/form-data)
export async function createGroupRoom(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });

    const activeRoom = await findActiveRoomOfUser(userId);
    if(activeRoom){
      return res.status(409).json({ ok:false, error:"user_already_in_room", message:"Bạn đã tham gia một phòng kết nối khác, hãy rời phòng trước khi tạo nhóm mới." });
    }

    const file=req.file;
    if(!file) return res.status(400).json({ ok:false, error:"missing_cover", message:"Vui lòng chọn ảnh nhóm (tối đa 5MB)." });

    const body=req.body||{};
    const name=(body.name||"").toString();
    const description=(body.description||"").toString();

    const ageRange=(body.ageRange||"").toString();
    const gender=(body.gender||"").toString();
    const trainingFrequency=(body.trainingFrequency||"").toString();
    const joinPolicy=((body.joinPolicy||"request").toString()||"request");
    const maxMembers=parseIntSafe(body.maxMembers);

    if(!name || name.length>50) return res.status(400).json({ ok:false, error:"invalid_name", message:"Tên nhóm là bắt buộc và tối đa 50 ký tự." });
    if(!description || description.length>300) return res.status(400).json({ ok:false, error:"invalid_description", message:"Mô tả nhóm là bắt buộc và tối đa 300 ký tự." });

    if(!["all","18-21","22-27","28-35","36-45","45+"].includes(ageRange)) return res.status(400).json({ ok:false, error:"invalid_ageRange", message:"Độ tuổi không hợp lệ." });
    if(!["all","male","female"].includes(gender)) return res.status(400).json({ ok:false, error:"invalid_gender", message:"Giới tính không hợp lệ." });
    if(!["1-2","2-3","3-5","5+"].includes(trainingFrequency)) return res.status(400).json({ ok:false, error:"invalid_trainingFrequency", message:"Mức độ tập luyện không hợp lệ." });
    if(!["request","open"].includes(joinPolicy)) return res.status(400).json({ ok:false, error:"invalid_joinPolicy", message:"Kiểu gia nhập không hợp lệ." });
    if(![2,3,4,5].includes(maxMembers)) return res.status(400).json({ ok:false, error:"invalid_maxMembers", message:"Số thành viên tối đa không hợp lệ (2-5)." });

    const me = await User.findById(userId).select("profile connectGoalKey connectGoalLabel username email").lean();
    if(!me) return res.status(404).json({ ok:false, error:"user_not_found", message:"Không tìm thấy người dùng." });

    const locationLabel = buildFullLocationLabel(me.profile||{});
    if(!locationLabel){
      return res.status(400).json({ ok:false, error:"need_address", message:"Bạn cần cập nhật địa chỉ trong Thông tin tài khoản trước khi tạo nhóm." });
    }

    const goalKey = me.connectGoalKey || me.profile?.goal || null;
    const goalLabel = me.connectGoalLabel || goalLabelFromKey(goalKey) || "";

    const coverImageUrl = await uploadImageWithResize(
      file.buffer,
      "asset/folder/connect-teams",
      { width: 1200, height: 1200, fit: "cover" },
      { quality: 85 }
    );

    const room = await MatchRoom.create({
      type:"group",
      name,
      description,
      coverImageUrl,
      ageRange,
      gender,
      trainingFrequency,
      joinPolicy,
      maxMembers,
      locationLabel,
      goalKey,
      goalLabel,
      createdBy:userId,
      members:[{ user:userId, role:"owner" }],
      status: maxMembers<=1 ? "full" : "active",
    });

    return responseOk(res, { roomId: room._id, roomType: room.type });
  }catch(err){ next(err); }
}

// POST /api/match/requests (gửi lời mời / join group)
export async function createMatchRequest(req, res, next){
  try{
    const fromUserId=getUserIdFromReq(req);
    if(!fromUserId) return res.status(401).json({ success:false, message:"Unauthorized" });

    const { type, targetUserId, targetRoomId, message } = req.body || {};
    if(!["duo","group"].includes(type)) return res.status(400).json({ ok:false, error:"invalid_type" });

    // Check đang ở room khác?
    const activeRoom = await findActiveRoomOfUser(fromUserId);
    if(activeRoom){
      return res.status(409).json({ ok:false, error:"user_already_in_room", message:"Bạn đã tham gia một phòng kết nối khác, hãy rời phòng trước khi gửi lời mời mới." });
    }

    const fromUser = await User.findById(fromUserId).lean();
    if(!fromUser) return res.status(404).json({ ok:false, error:"from_user_not_found" });

    const fromNickname = fromUser.profile?.nickname || fromUser.username || "";
    const fromGoalKey = fromUser.connectGoalKey || fromUser.profile?.goal || null;
    const fromGoalLabel = fromUser.connectGoalLabel || goalLabelFromKey(fromGoalKey) || "";

    // ===== DUO =====
    if(type==="duo"){
      if(!targetUserId) return res.status(400).json({ ok:false, error:"missing_target_user" });
      if(String(targetUserId)===String(fromUserId)) return res.status(400).json({ ok:false, error:"cannot_invite_self" });

      const targetUser = await User.findById(targetUserId).lean();
      if(!targetUser) return res.status(404).json({ ok:false, error:"user_not_found" });
      if(!targetUser.connectDiscoverable) return res.status(400).json({ ok:false, error:"target_not_discoverable", message:"Người dùng hiện không cho phép tìm kiếm." });

      // tránh spam trùng request
      const existed = await MatchRequest.findOne({ type:"duo", fromUser:fromUserId, toUser:targetUserId, status:"pending" }).lean();
      if(existed) return responseOk(res, { request: existed, duplicated: true });

      const doc = await MatchRequest.create({
        type:"duo",
        fromUser:fromUserId,
        toUser:targetUserId,
        message: message || "",
        meta:{ fromNickname, fromGoalKey, fromGoalLabel },
      });

      return responseOk(res, { request: doc });
    }

    // ===== GROUP =====
    if(!targetRoomId) return res.status(400).json({ ok:false, error:"missing_target_room" });

    const room = await MatchRoom.findById(targetRoomId);
    if(!room || room.type!=="group") return res.status(404).json({ ok:false, error:"room_not_found" });

    const currentCount = room.members?.length || 0;
    if(currentCount >= (room.maxMembers || 5)) return res.status(409).json({ ok:false, error:"group_full", message:"Nhóm đã đủ người." });

    // nếu room open -> join thẳng, không tạo request
    if((room.joinPolicy||"request")==="open"){
      const isMember = (room.members||[]).some(m=>String(m.user)===String(fromUserId));
      if(!isMember) room.members.push({ user: fromUserId, role:"member" });

      if(room.members.length >= (room.maxMembers||5)){
        room.status="full"; room.closedAt=new Date();
      }else{ room.status="active"; room.closedAt=null; }

      await room.save();
      return responseOk(res, { roomId: room._id, roomType: room.type, joined: true, joinPolicy: "open" });
    }

    // joinPolicy request -> tạo MatchRequest
    const existed = await MatchRequest.findOne({ type:"group", fromUser:fromUserId, toRoom:room._id, status:"pending" }).lean();
    if(existed) return responseOk(res, { request: existed, duplicated: true });

    const doc = await MatchRequest.create({
      type:"group",
      fromUser:fromUserId,
      toRoom:room._id,
      message: message || "",
      meta:{ fromNickname, fromGoalKey, fromGoalLabel },
    });

    return responseOk(res, { request: doc });
  }catch(err){ next(err); }
}

// GET /api/match/requests
export async function listMyRequests(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });

    // incoming duo: toUser = me
    const incomingDuoPromise = MatchRequest.find({ toUser:userId, status:"pending", type:"duo" })
      .populate({ path:"fromUser", select:"username profile.nickname profile.avatarUrl connectGoalKey connectGoalLabel" })
      .lean();

    // incoming group: toRoom thuộc rooms mà me là owner
    const ownerRooms = await MatchRoom.find({ type:"group", status:{ $in:["active","full"] }, "members.user": userId, "members.role":"owner" }).select("_id").lean();
    const ownerRoomIds = ownerRooms.map(x=>x._id);

    const incomingGroupPromise = ownerRoomIds.length
      ? MatchRequest.find({ type:"group", status:"pending", toRoom:{ $in: ownerRoomIds } })
          .populate({ path:"fromUser", select:"username profile.nickname profile.avatarUrl connectGoalKey connectGoalLabel" })
          .populate({ path:"toRoom", select:"name coverImageUrl type members maxMembers status locationLabel joinPolicy" })
          .lean()
      : Promise.resolve([]);

    // outgoing: fromUser = me
    const outgoingPromise = MatchRequest.find({ fromUser:userId, status:"pending" })
      .populate({ path:"toUser", select:"username profile.nickname profile.avatarUrl connectGoalKey connectGoalLabel" })
      .populate({ path:"toRoom", select:"name coverImageUrl type members maxMembers status locationLabel joinPolicy" })
      .lean();

    const [incoming, incomingGroups, outgoing] = await Promise.all([incomingDuoPromise, incomingGroupPromise, outgoingPromise]);

    return responseOk(res, { incoming, incomingGroups, outgoing });
  }catch(err){ next(err); }
}

// PATCH /api/match/requests/:id/accept
export async function acceptRequest(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id).populate("fromUser").populate("toUser").populate("toRoom").exec();
    if(!reqDoc || reqDoc.status!=="pending") return res.status(404).json({ ok:false, error:"request_not_found" });

    if(reqDoc.type==="duo"){
      if(String(reqDoc.toUser._id)!==String(userId)) return res.status(403).json({ ok:false, error:"not_allowed" });
    }else if(reqDoc.type==="group"){
      // chỉ owner của phòng mới accept
      const roomId = reqDoc.toRoom?._id || reqDoc.toRoom;
      if(!roomId) return res.status(404).json({ ok:false, error:"room_not_found" });
      const okOwner = await isOwnerOfRoom(userId, roomId);
      if(!okOwner) return res.status(403).json({ ok:false, error:"not_allowed", message:"Chỉ quản lý nhóm mới có thể duyệt yêu cầu." });
    }

    // Check fromUser đã ở room khác chưa
    const roomOfFrom = await findActiveRoomOfUser(reqDoc.fromUser._id);
    if(roomOfFrom){
      reqDoc.status="rejected"; reqDoc.resolvedAt=new Date(); await reqDoc.save();
      return res.status(409).json({ ok:false, error:"user_already_in_room", message:"Người gửi đã tham gia kết nối khác. Lời mời hết hiệu lực." });
    }

    let room;

    if(reqDoc.type==="duo"){
      // Check toUser đã ở room khác chưa
      const roomOfTo = await findActiveRoomOfUser(reqDoc.toUser._id);
      if(roomOfTo){
        reqDoc.status="rejected"; reqDoc.resolvedAt=new Date(); await reqDoc.save();
        return res.status(409).json({ ok:false, error:"user_already_in_room", message:"Một trong hai người đã tham gia kết nối. Lời mời hết hiệu lực." });
      }

      room = await MatchRoom.create({
        type:"duo",
        createdBy:reqDoc.fromUser._id,
        members:[ { user:reqDoc.fromUser._id, role:"owner" }, { user:reqDoc.toUser._id, role:"member" } ],
        maxMembers:2,
      });
    }else{
      room = await MatchRoom.findById(reqDoc.toRoom._id);
      if(!room || room.type!=="group") return res.status(404).json({ ok:false, error:"room_not_found" });

      const currentCount = room.members?.length || 0;
      if(currentCount >= (room.maxMembers || 5)){
        reqDoc.status="rejected"; reqDoc.resolvedAt=new Date(); await reqDoc.save();
        return res.status(409).json({ ok:false, error:"group_full", message:"Nhóm đã đủ người." });
      }

      const existedMember = (room.members||[]).some(m=>String(m.user)===String(reqDoc.fromUser._id));
      if(!existedMember) room.members.push({ user:reqDoc.fromUser._id, role:"member" });

      if(room.members.length >= room.maxMembers){ room.status="full"; room.closedAt=new Date(); }
      else { room.status="active"; room.closedAt=null; }

      await room.save();
    }

    reqDoc.status="accepted"; reqDoc.resolvedAt=new Date(); await reqDoc.save();
    return responseOk(res, { roomId: room._id, roomType: room.type });
  }catch(err){ next(err); }
}

// PATCH /api/match/requests/:id/reject
export async function rejectRequest(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id);
    if(!reqDoc || reqDoc.status!=="pending") return res.status(404).json({ ok:false, error:"request_not_found" });

    if(reqDoc.type==="duo"){
      if(String(reqDoc.toUser)!==String(userId)) return res.status(403).json({ ok:false, error:"not_allowed" });
    }else if(reqDoc.type==="group"){
      const okOwner = await isOwnerOfRoom(userId, reqDoc.toRoom);
      if(!okOwner) return res.status(403).json({ ok:false, error:"not_allowed", message:"Chỉ quản lý nhóm mới có thể từ chối yêu cầu." });
    }

    reqDoc.status="rejected"; reqDoc.resolvedAt=new Date(); await reqDoc.save();
    return responseOk(res, { requestId:reqDoc._id, status:reqDoc.status });
  }catch(err){ next(err); }
}

// PATCH /api/match/requests/:id/cancel
export async function cancelRequest(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id);
    if(!reqDoc || reqDoc.status!=="pending") return res.status(404).json({ ok:false, error:"request_not_found" });
    if(String(reqDoc.fromUser)!==String(userId)) return res.status(403).json({ ok:false, error:"not_allowed" });

    reqDoc.status="cancelled"; reqDoc.resolvedAt=new Date(); await reqDoc.save();
    return responseOk(res, { requestId:reqDoc._id, status:reqDoc.status });
  }catch(err){ next(err); }
}

/* ========= ROOM DETAIL & LEAVE ========= */

// GET /api/match/rooms/:id
export async function getRoomDetail(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });
    const { id } = req.params;

    const room = await MatchRoom.findById(id)
      .populate({ path:"members.user", select:"username email profile.nickname profile.avatarUrl profile.sex profile.dob connectGoalKey connectGoalLabel profile.goal profile.trainingIntensity" })
      .lean();

    if(!room) return res.status(404).json({ success:false, message:"Không tìm thấy phòng kết nối" });

    const isMember = (room.members||[]).some(m=>{
      const u=m.user||{}; const uid=u._id||u.id||u;
      return String(uid)===String(userId);
    });
    if(!isMember) return res.status(403).json({ success:false, message:"Bạn không thuộc phòng kết nối này." });

    return responseOk(res, room);
  }catch(err){ next(err); }
}

// POST /api/match/rooms/:id/leave
export async function leaveMatchRoom(req, res, next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });
    const { id } = req.params;

    const room = await MatchRoom.findById(id);
    if(!room) return res.status(404).json({ success:false, message:"Không tìm thấy phòng kết nối" });

    const idx = room.members.findIndex(m=>String(m.user)===String(userId));
    if(idx===-1) return res.status(403).json({ success:false, message:"Bạn không thuộc phòng kết nối này." });

    const leavingWasOwner = room.members[idx]?.role === "owner";
    room.members.splice(idx,1);

    // nếu group mà owner rời -> chuyển quyền
    if(room.type==="group" && leavingWasOwner && room.members.length>0){
      room.members[0].role="owner";
      room.createdBy = room.members[0].user;
    }

    if(room.members.length===0){
      room.status="closed"; room.closedAt=new Date();
    }else{
      if(room.members.length >= room.maxMembers){ room.status="full"; room.closedAt=new Date(); }
      else { room.status="active"; room.closedAt=null; }
    }

    await room.save();

    return responseOk(res, { roomId: room._id, status: room.status, remainingMembers: room.members.length });
  }catch(err){ next(err); }
}

// GET /api/match/rooms/:id/requests
export async function listRoomRequests(req,res,next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });

    const { id: roomId } = req.params;
    const room = await MatchRoom.findById(roomId).select("_id type").lean();
    if(!room || room.type!=="group") return res.status(404).json({ success:false, message:"Không tìm thấy nhóm" });

    const okOwner = await isOwnerOfRoom(userId, roomId);
    if(!okOwner) return res.status(403).json({ success:false, message:"Chỉ chủ phòng mới xem được danh sách yêu cầu." });

    const qStatus = (req.query?.status||"").toString().trim().toLowerCase();
    const allowed = ["pending","accepted","rejected","cancelled"];
    let statuses = [];
    if(!qStatus || qStatus==="all") statuses = ["pending","accepted","rejected"];
    else statuses = qStatus.split(",").map(s=>s.trim()).filter(s=>allowed.includes(s));

    const filter = { type:"group", toRoom: roomId };
    if(statuses.length) filter.status = { $in: statuses };

    const docs = await MatchRequest.find(filter)
      .populate({ path:"fromUser", select:"username email profile.nickname profile.avatarUrl profile.sex profile.dob profile.trainingIntensity profile.address connectGoalKey connectGoalLabel connectBio connectLocationLabel" })
      .sort({ createdAt: -1 })
      .lean();

    const items = docs.map(d=>({
      _id:d._id,status:d.status,message:d.message||"",createdAt:d.createdAt,resolvedAt:d.resolvedAt||null,
      meta:d.meta||null,
      fromUser:d.fromUser||null,
    }));

    // nếu gọi ?status=pending thì trả list items luôn
    if(qStatus && qStatus!=="all"){
      return responseOk(res, { items });
    }

    const pending = items.filter(x=>x.status==="pending");
    const accepted = items.filter(x=>x.status==="accepted");
    const rejected = items.filter(x=>x.status==="rejected");

    return responseOk(res, {
      pending,
      accepted,
      rejected,
      counts: { pending: pending.length, accepted: accepted.length, rejected: rejected.length },
    });
  }catch(err){ next(err); }
}

// PATCH /api/match/rooms/:id  (owner edit group)
export async function updateGroupRoom(req,res,next){
  try{
    const userId=getUserIdFromReq(req);
    if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });

    const { id: roomId } = req.params;
    const room = await MatchRoom.findById(roomId);
    if(!room) return res.status(404).json({ success:false, message:"Không tìm thấy phòng" });
    if(room.type!=="group") return res.status(400).json({ success:false, message:"Chỉ nhóm mới chỉnh sửa được" });

    const okOwner = await isOwnerOfRoom(userId, roomId);
    if(!okOwner) return res.status(403).json({ success:false, message:"Chỉ chủ phòng mới có thể chỉnh sửa nhóm." });

    const body=req.body||{};
    const patch={};

    const name = body.name!=null ? String(body.name).trim() : null;
    const description = body.description!=null ? String(body.description).trim() : null;
    const coverImageUrlBody = body.coverImageUrl!=null ? String(body.coverImageUrl).trim() : null;

    const ageRange = body.ageRange!=null ? String(body.ageRange).trim() : null;
    const gender = body.gender!=null ? String(body.gender).trim() : null;
    const trainingFrequency = body.trainingFrequency!=null ? String(body.trainingFrequency).trim() : null;
    const joinPolicy = body.joinPolicy!=null ? String(body.joinPolicy).trim() : null;

    const maxMembersRaw = body.maxMembers!=null ? body.maxMembers : null;
    const maxMembers = maxMembersRaw!=null ? parseIntSafe(maxMembersRaw) : null;

    const locationLabel = body.locationLabel!=null ? String(body.locationLabel).trim() : null;

    if(name!==null){
      if(!name || name.length>50) return res.status(400).json({ success:false, message:"Tên nhóm tối đa 50 ký tự." });
      patch.name=name;
    }
    if(description!==null){
      if(!description || description.length>300) return res.status(400).json({ success:false, message:"Mô tả tối đa 300 ký tự." });
      patch.description=description;
    }

    // upload file nếu có
    if(req.file){
      const url = await uploadImageWithResize(
        req.file.buffer,
        "asset/folder/connect-teams",
        { width: 1200, height: 1200, fit: "cover" },
        { quality: 85 }
      );
      patch.coverImageUrl = url;
    }else if(coverImageUrlBody!==null){
      if(!coverImageUrlBody) return res.status(400).json({ success:false, message:"Ảnh nhóm không được để trống." });
      patch.coverImageUrl = coverImageUrlBody;
    }

    if(ageRange!==null){
      if(!["all","18-21","22-27","28-35","36-45","45+"].includes(ageRange)) return res.status(400).json({ success:false, message:"Độ tuổi không hợp lệ." });
      patch.ageRange=ageRange;
    }
    if(gender!==null){
      if(!["all","male","female"].includes(gender)) return res.status(400).json({ success:false, message:"Giới tính không hợp lệ." });
      patch.gender=gender;
    }
    if(trainingFrequency!==null){
      if(!["1-2","2-3","3-5","5+"].includes(trainingFrequency)) return res.status(400).json({ success:false, message:"Mức độ tập luyện không hợp lệ." });
      patch.trainingFrequency=trainingFrequency;
    }
    if(joinPolicy!==null){
      if(!["request","open"].includes(joinPolicy)) return res.status(400).json({ success:false, message:"JoinPolicy không hợp lệ." });
      patch.joinPolicy=joinPolicy;
    }
    if(maxMembers!==null){
      if(![2,3,4,5].includes(maxMembers)) return res.status(400).json({ success:false, message:"Số thành viên tối đa không hợp lệ (2-5)." });
      patch.maxMembers=maxMembers;
    }
    if(locationLabel!==null){
      patch.locationLabel=locationLabel;
    }

    Object.assign(room, patch);

    // sync status theo maxMembers
    if(patch.maxMembers!=null){
      const cnt = room.members?.length || 0;
      if(cnt >= room.maxMembers){ room.status="full"; room.closedAt = room.closedAt || new Date(); }
      else { room.status="active"; room.closedAt=null; }
    }

    await room.save();

    const populated = await MatchRoom.findById(roomId)
      .populate({ path:"members.user", select:"username email profile.nickname profile.avatarUrl profile.sex profile.dob connectGoalKey connectGoalLabel profile.goal profile.trainingIntensity" })
      .lean();

    return responseOk(res, populated);
  }catch(err){ next(err); }
}
