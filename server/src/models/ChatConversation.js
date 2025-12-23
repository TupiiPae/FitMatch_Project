import mongoose from "mongoose";
const { Schema } = mongoose;

const ChatConversationSchema=new Schema({
  _id:{type:Schema.Types.ObjectId,required:true}, // dùng luôn MatchRoomId cho duo/team
  type:{type:String,enum:["duo","group","dm"],required:true},
  members:{type:[Schema.Types.ObjectId],ref:"User",default:[],index:true},

  lastMessage:{type:Schema.Types.Mixed,default:null}, // {text,senderId,createdAt}
  lastMessageAt:{type:Date,default:null,index:true},

  // chuẩn bị cho DM/unread sau này
  unreadBy:{type:Map,of:Number,default:{}}, // key=userId -> count
},{timestamps:true});

ChatConversationSchema.index({ members:1, lastMessageAt:-1 });
export default mongoose.model("ChatConversation",ChatConversationSchema);
