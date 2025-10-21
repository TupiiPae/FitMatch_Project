// server/src/controllers/match.controller.js
import { User } from "../models/User.js";

export const findNearbyUsers = async (req,res)=>{
  const lng=Number(req.query.lng), lat=Number(req.query.lat);
  const radiusKm=Number(req.query.radiusKm||10), limit=Number(req.query.limit||50);
  if(!Number.isFinite(lng)||!Number.isFinite(lat)) return res.status(400).json({message:"Thiếu tọa độ lng/lat"});
  const pipeline=[
    {$geoNear:{ near:{type:"Point",coordinates:[lng,lat]}, distanceField:"dist", spherical:true, maxDistance: radiusKm*1000, key:"profile.location" }},
    {$project:{ password:0 }},
    {$limit: limit }
  ];
  const docs = await User.aggregate(pipeline);
  res.json({ results: docs });
};
