const assert=require('node:assert/strict');
const {fixture}=require('./database-fixture.cjs');
const {edgeFixture}=require('./edge-fixture.cjs');
let passed=0,server;
function check(value,label){assert(value,label);passed++;}
async function main(){
 server=await fixture();const handler=await edgeFixture(server);const [a,b,c]=server.ids;
 async function request(body,actor=a,method='POST'){
  const response=await handler(new Request('https://fixture.test',{method,headers:{'content-type':'application/json',...(actor?{'x-fixture-user':actor}:{})},...(method==='GET'||method==='OPTIONS'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}));
  return{status:response.status,headers:response.headers,data:response.status===204?null:await response.json()};
 }
 check((await request({},null,'OPTIONS')).status===204,'Preflight fails');
 check((await request({action:'lobby'},null)).status===401,'Unauthenticated request accepted');
 check((await request({},a,'GET')).status===405,'Method check');
 check((await request('{invalid')).status===400,'Invalid JSON accepted');
 check((await request('x'.repeat(16001))).status===400,'Oversized request accepted');
 check((await request({action:'other'})).status===400,'Unknown action accepted');
 check((await request({action:'lobby',name:'Salle',hours:1,empty_minutes:0})).status===422,'Invalid expiry accepted');
 check((await request({action:'lobby',name:'idiot',hours:1,empty_minutes:2})).status===422,'Offensive lobby name accepted');
 const create=await request({action:'lobby',name:'Salle privée',description:'Avec amis',hours:1,empty_minutes:2,is_public:false,password:'fixture-password',p_actor:b});
 check(create.data.ok&&create.data.version==='2.0.0','SafeGuard 2 creation failed');const room=create.data.lobby_id;
 check((await server.db.query('select created_by from public.lobbix_lobbies where id=$1',[room])).rows[0].created_by===a,'Client spoofed actor');
 await server.action(a,room,'join',{password:'fixture-password'});await server.action(b,room,'join',{password:'fixture-password'});
 const message=await request({api_version:1,action:'message',lobby_id:room,text:'Bonjour',p_actor:b});
 check(message.data.ok,'Valid message not published');check((await server.db.query('select sender_id from public.lobbix_messages where id=$1',[message.data.message_id])).rows[0].sender_id===a,'Message sender spoofed');
 check(!(await request({api_version:1,action:'message',lobby_id:room,text:'Sans être membre'},c)).data.ok,'Non-member published');
 await server.db.query("update public.lobbix_sg_state set last_message_at=now()-interval '2 seconds'");
 check((await request({api_version:1,action:'message',lobby_id:room,text:'tu est nul'})).data.verdict==='warning','Warning missing');
 check((await server.db.query('select count(*)::int n from public.lobbix_messages')).rows[0].n===1,'Warning published before confirmation');
 check((await request({api_version:1,action:'message',lobby_id:room,text:'tu est nul',confirm_warning:true})).data.ok,'Confirmed mild warning failed');
 check((await request({api_version:1,action:'message',lobby_id:room,text:'je vais te tuer',confirm_warning:true})).status===422,'Severe content bypassed with confirmation');
 check((await request({api_version:1,action:'message',lobby_id:room,text:'test@example.com'})).data.code==='PERSONAL_DATA','PII check');
 check((await request({action:'poll',lobby_id:room,question:'Choix',options:['A','a']})).status===422,'Duplicate options accepted');
 check((await request({action:'wheel',lobby_id:room,items:['A','je vais te tuer']})).status===422,'Activity text not moderated');
 const poll=await request({action:'poll',lobby_id:room,question:'Quelle couleur ?',options:['Bleu','Vert']});
 check(poll.data.ok&&Boolean(poll.data.activity_id),'Poll publish failed');
 check(poll.headers.get('cache-control')==='no-store'&&poll.headers.get('access-control-allow-origin')==='*','CORS/cache headers missing');
 check((await server.db.query('select count(*)::int n from public.lobbix_messages')).rows[0].n===2,'Blocked content persisted');
 console.log(JSON.stringify({edge_checks:passed,production_requests:0,handler:'actual SafeGuard 2 TypeScript; auth wrapper mocked'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server)await server.db.close();});
