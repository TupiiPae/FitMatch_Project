import mongoose from "mongoose";

const SeenSchema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},seenAt:{type:Date,default:Date.now}},{_id:false});
const AttachmentSchema=new mongoose.Schema({type:{type:String,enum:["image","file"],default:"image"},url:String,name:String,size:Number},{_id:false});

const ChatMessageSchema=new mongoose.Schema({
  conversationId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true}, // v1: conversationId = MatchRoom._id (Duo/Team)
  senderId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  content:{type:String,default:""},
  attachments:{type:[AttachmentSchema],default:[]},
  clientMsgId:{type:String,default:""},
  seenBy:{type:[SeenSchema],default:[]},
  editedAt:{type:Date,default:null},
  deletedAt:{type:Date,default:null},
},{timestamps:true});

ChatMessageSchema.index({conversationId:1,createdAt:-1});
export default mongoose.model("ChatMessage",ChatMessageSchema);
