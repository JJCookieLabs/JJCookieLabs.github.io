const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
async function edgeFixture(server){
 const sourcePath=path.resolve(__dirname,'../server/index.ts');
 let source=fs.readFileSync(sourcePath,'utf8');
 source=source.replace(/^import \{ withSupabase \}[^\n]+\n/m,'');
 source=source.replace('"./moderation.js"',JSON.stringify(pathToFileURL(path.resolve(__dirname,'../server/moderation.js')).href));
 source=source.replace('const cors={','export function createHandler(withSupabase:any){\nconst cors={');
 source=source.replace('Deno.serve(async request=>{','return async (request:Request)=>{').replace(/\}\);\s*$/,'};\n}');
 const folder=path.resolve(__dirname,'artifacts');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'package.json'),'{"type":"module"}');
 const target=path.join(folder,'edge-fixture.ts');fs.writeFileSync(target,source);
 const {createHandler}=await import(pathToFileURL(target).href);
 return createHandler((options,handler)=>async request=>handler(request,{userClaims:{id:request.headers.get('x-fixture-user')},supabaseAdmin:{
  async rpc(name,payload){
   try{
    if(name==='lobbix_v1_publish')return {data:await server.publish(payload.p_actor,payload.p_lobby,payload.p_kind,payload.p_data),error:null};
    if(name==='lobbix_sg_reject')return {data:null,error:null};
    throw Error('Unexpected privileged test RPC: '+name);
   }catch(error){return {data:null,error:{message:error.message,code:error.code}};}
  }
 }}));
}
module.exports={edgeFixture};
