/** Lobbix SafeGuard 2.0.0. JWT required; privileged keys remain on this server. */
import { withSupabase } from "npm:@supabase/server@1.9.2";
import { moderate, VERSION } from "./moderation.js";
const cors={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
 "Cache-Control":"no-store"
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function answer(data:Record<string,unknown>,status=200){return Response.json({version:VERSION,...data},{status,headers:cors});}
const protectedHandler=withSupabase({auth:"user"},async(request,ctx)=>{
 if(request.method!=="POST")return answer({ok:false,message:"Méthode non autorisée"},405);
 const actor=ctx.userClaims?.id;
 if(!actor||!uuid.test(actor))return answer({ok:false,message:"Connexion requise"},401);
 const admin=ctx.supabaseAdmin;
 if(!admin)return answer({ok:false,message:"Configuration serveur manquante"},503);
 let body:Record<string,unknown>;
 try{
  if(Number(request.headers.get("content-length")||0)>16000)throw Error();
  const raw=await request.text();if(raw.length>16000)throw Error();body=JSON.parse(raw);
  if(!body||typeof body!=="object"||Array.isArray(body))throw Error();
 }catch{return answer({ok:false,message:"Données invalides ou trop volumineuses"},400);}
 const action=String(body.action);
 if(!["nickname","lobby","message","poll","wheel"].includes(action))return answer({ok:false,message:"Action inconnue"},400);
 async function blocked(verdict:{reason:string,code:string}){
  const {data,error}=await admin.rpc("lobbix_sg_reject",{p_actor:actor});
  if(error)return answer({ok:false,message:"SafeGuard indisponible"},503);
  const muted=data&&new Date(String(data)).getTime()>Date.now();
  return answer({ok:false,verdict:"blocked",code:verdict.code,reason:verdict.reason,message:verdict.reason,...(muted?{muted_until:data}:{})},muted?429:422);
 }
 async function inspect(value:string,kind="message"){
  const decision=moderate(value,kind);
  if(decision.verdict==="blocked")return await blocked(decision);
  if(decision.verdict==="warning"){
   if(kind==="message"&&body.confirm_warning===true)return null;
   return answer({ok:false,...decision},kind==="message"?200:422);
  }
  return null;
 }
 if(action==="nickname"){
  if(typeof body.nickname!=="string"||!/^\w{3,24}$/.test(body.nickname.trim()))return answer({ok:false,message:"Pseudo : 3 à 24 caractères, lettres, chiffres ou tiret bas"},422);
  const text=body.nickname.trim(),rejected=await inspect(text,"nickname");if(rejected)return rejected;
  const {error}=await admin.rpc("lobbix_sg_set_nickname",{p_actor:actor,p_nickname:text});
  return error?answer({ok:false,message:error.message},422):answer({ok:true,verdict:"allowed"});
 }
 if(action==="message"){
  if(typeof body.text!=="string"||typeof body.lobby_id!=="string"||!uuid.test(body.lobby_id))return answer({ok:false,message:"Message ou lobby invalide"},400);
  const text=body.text.trim();if(!text||[...text].length>2000)return answer({ok:false,message:"Message limité à 2 000 caractères"},422);
  const rejected=await inspect(text);if(rejected)return rejected;
  const {data,error}=body.api_version===1
   ?await admin.rpc("lobbix_v1_publish",{p_actor:actor,p_lobby:body.lobby_id,p_kind:"message",p_data:{text}})
   :await admin.rpc("lobbix_sg_commit_message",{p_actor:actor,p_lobby:body.lobby_id,p_body:text});
  return error?answer({ok:false,message:error.message},422):answer(typeof data==="object"&&data?data:{ok:true,verdict:"allowed",message_id:data});
 }
 if(action==="lobby"){
  const name=typeof body.name==="string"?body.name.trim():"",description=typeof body.description==="string"?body.description.trim():"";
  const hours=body.hours??null,minutes=body.empty_minutes,isPublic=body.is_public!==false;
  if(!name||[...name].length>60||[...description].length>150||
   (hours!==null&&(!Number.isInteger(hours)||Number(hours)<1||Number(hours)>24))||!Number.isInteger(minutes)||Number(minutes)<1||Number(minutes)>30)
   return answer({ok:false,message:"Nom, description ou durée du lobby invalide"},422);
  if(name.toLocaleLowerCase("fr")==="random")return answer({ok:false,message:"Le nom Random est réservé"},422);
  if(!isPublic&&(typeof body.password!=="string"||body.password.length<8||body.password.length>128))return answer({ok:false,message:"Mot de passe privé : 8 à 128 caractères"},422);
  for(const [text,kind]of [[name,"name"],[description,"description"]]){const rejected=await inspect(text,kind);if(rejected)return rejected;}
  const {data,error}=await admin.rpc("lobbix_v1_publish",{p_actor:actor,p_lobby:null,p_kind:"lobby",p_data:{name,description,hours,empty_minutes:minutes,is_public:isPublic,...(!isPublic?{password:body.password}:{})}});
  return error?answer({ok:false,message:error.message},422):answer(data);
 }
 if(typeof body.lobby_id!=="string"||!uuid.test(body.lobby_id))return answer({ok:false,message:"Lobby invalide"},400);
 const entries=action==="poll"?body.options:body.items;
 const max=action==="poll"?8:30;
 if(!Array.isArray(entries)||entries.length<2||entries.length>max||entries.some(item=>typeof item!=="string"||!item.trim()||[...item].length>80))
  return answer({ok:false,message:`Choisis entre 2 et ${max} propositions, de 80 caractères maximum`},422);
 const items=entries.map(item=>String(item).trim());
 if(new Set(items.map(x=>x.toLocaleLowerCase("fr"))).size!==items.length)return answer({ok:false,message:"Les propositions doivent être différentes"},422);
 const question=action==="poll"&&typeof body.question==="string"?body.question.trim():"";
 if(action==="poll"&&(!question||[...question].length>120))return answer({ok:false,message:"Question : 1 à 120 caractères"},422);
 for(const text of [question,...items]){const rejected=await inspect(text,"description");if(rejected)return rejected;}
 const {data,error}=await admin.rpc("lobbix_v1_publish",{p_actor:actor,p_lobby:body.lobby_id,p_kind:action,p_data:action==="poll"?{question,options:items}:{items}});
 return error?answer({ok:false,message:error.message},422):answer(data);
});
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 try{
  const response=await protectedHandler(request),headers=new Headers(response.headers);
  for(const [key,value]of Object.entries(cors))headers.set(key,value);
  return new Response(response.body,{status:response.status,headers});
 }catch(error){console.error("SafeGuard execution error",error instanceof Error?error.name:"Unknown error");return answer({ok:false,message:"SafeGuard momentanément indisponible"},503);}
});
