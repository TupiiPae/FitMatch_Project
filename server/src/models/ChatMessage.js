import mongoose from "mongoose";
const { Schema } = mongoose;

const SeenSchema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true},
  seenAt:{type:Date,default:Date.now}
},{_id:false});

const AttachmentSchema=new Schema({
  type:{type:String,enum:["image","file"],default:"image"},
  url:{type:String,required:true},
  name:{type:String,default:""},
  size:{type:Number,default:0},
},{_id:false});

const ReactionSchema=new Schema({
  emoji:{type:String,enum:["like","heart","laugh","sad","angry","wow"],required:true},
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true},
  reactedAt:{type:Date,default:Date.now}
},{_id:false});

const ReplySnapshotSchema=new Schema({
  _id:{type:Schema.Types.ObjectId,default:null},
  senderId:{type:Schema.Types.ObjectId,ref:"User",default:null},
  content:{type:String,default:""},
  attachment:{type:Schema.Types.Mixed,default:null}, 
  createdAt:{type:Date,default:null},
  deletedAt:{type:Date,default:null}, 
},{_id:false});

const ChatMessageSchema=new Schema({
  conversationId:{type:Schema.Types.ObjectId,required:true,index:true},
  senderId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  content:{type:String,default:""},
  attachments:{type:[AttachmentSchema],default:[]},
  replyTo:{type:Schema.Types.ObjectId,ref:"ChatMessage",default:null,index:true},
  reply:{type:ReplySnapshotSchema,default:null},
  reactions:{type:[ReactionSchema],default:[]},
  clientMsgId:{type:String,default:"",index:true},
  seenBy:{type:[SeenSchema],default:[]},
  editedAt:{type:Date,default:null},
  deletedAt:{type:Date,default:null},
  hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
},{timestamps:true});

ChatMessageSchema.index({conversationId:1,createdAt:-1});

ChatMessageSchema.index(
  { conversationId:1, senderId:1, clientMsgId:1 },
  { unique:true, partialFilterExpression:{ clientMsgId:{ $type:"string", $ne:"" } } }
);

ChatMessageSchema.pre("validate",function(next){
  if(Array.isArray(this.attachments)){
    this.attachments=this.attachments.filter(a=>a && String(a.url||"").trim());
  }
  next();
});

export default mongoose.model("ChatMessage",ChatMessageSchema);
