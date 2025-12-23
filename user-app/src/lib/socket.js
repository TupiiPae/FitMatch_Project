import { io } from "socket.io-client";

const raw=import.meta.env.VITE_API_URL||"http://localhost:5000";
const trimmed=raw.replace(/\/+$/,"");
const ORIGIN=trimmed.endsWith("/api")?trimmed.slice(0,-4):trimmed;

let socket=null;
let lastToken="";

export function getSocket(token){
  const t=token||localStorage.getItem("token")||"";
  if(socket && t===lastToken) return socket;
  if(socket){try{socket.disconnect()}catch{} socket=null}
  lastToken=t;
  socket=io(ORIGIN,{transports:["websocket","polling"],auth:{token:t},autoConnect:true,reconnection:true,reconnectionAttempts:Infinity});
  return socket;
}
