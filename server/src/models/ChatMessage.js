import mongoose from "mongoose";
const { Schema } = mongoose;

const SeenSchema=new Schema({userId:{type:Schema.Types.ObjectId,ref:"User",required:true},seenAt:{type:Date,default:Date.now}},{_id:false});
const AttachmentSchema=new Schema({type:{type:String,enum:["image","file"],default:"image"},url:String,name:String,size:Number},{_id:false});
const ReactionSchema=new Schema({emoji:{type:String,enum:["like","heart","laugh","sad","angry"],required:true},userId:{type:Schema.Types.ObjectId,ref:"User",required:true},reactedAt:{type:Date,default:Date.now}},{_id:false});

const ChatMessageSchema=new Schema({
  conversationId:{type:Schema.Types.ObjectId,required:true,index:true},
  senderId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  content:{type:String,default:""},
  attachments:{type:[AttachmentSchema],default:[]},
  replyTo:{type:Schema.Types.ObjectId,ref:"ChatMessage",default:null,index:true},
  reactions:{type:[ReactionSchema],default:[]},

  clientMsgId:{type:String,default:""},
  seenBy:{type:[SeenSchema],default:[]},
  editedAt:{type:Date,default:null},
  deletedAt:{type:Date,default:null},
},{timestamps:true});

ChatMessageSchema.index({conversationId:1,createdAt:-1});
export default mongoose.model("ChatMessage",ChatMessageSchema);
