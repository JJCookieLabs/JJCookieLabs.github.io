const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const {fixture}=require('./database-fixture.cjs');
const {edgeFixture}=require('./edge-fixture.cjs');
const {randomUUID}=require('node:crypto');
let passed=0,server;const clients=[];
function check(value,label){assert(value,label);passed++;}
async function until(fn,label){for(let i=0;i<100;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Timed out: '+label);}
async function main(){
 server=await fixture();const handler=await edgeFixture(server);const [a,b]=server.ids;
 let html=fs.readFileSync(__dirname+'/../index.html','utf8').replace(/<script src="https:\/\/cdn[^>]*><\/script>/g,'');
 for(const name of ['screen-share','v1'])html=html.replace(new RegExp('<script src="static/'+name+'\\.js[^>]*><\\/script>'),()=>'<script>'+fs.readFileSync(__dirname+'/../static/'+name+'.js','utf8')+'</script>');
 async function client(actor,options={}){
  let callback,sdkOptions;const calls=[],errors=[];const session={access_token:'local-test-only',user:{id:actor,email:'fixture@example.test'}};
  const auth={onAuthStateChange(fn){callback=fn;return{data:{subscription:{unsubscribe(){}}}};},async getSession(){return{data:{session:options.guest?null:session},error:null};},
   async signInWithPassword(){options.guest=false;callback('SIGNED_IN',session);return{data:{session,user:session.user},error:null};},
   async signUp(){calls.push('signup');return{data:{user:session.user,session:null},error:null};},async signOut(){options.guest=true;callback('SIGNED_OUT',null);return{error:null};},async resend(){return{error:null};},async resetPasswordForEmail(){return{error:null};}};
  async function rpc(name,p={}){
   calls.push(name);try{
    if(name==='lobbix_v1_action')return{data:await server.action(actor,p.p_lobby,p.p_action,p.p_data,p.p_client),error:null};
    if(name==='lobbix_v1_state')return{data:await server.state(actor,p.p_lobby,p.p_activity,p.p_version,p.p_after,p.p_signal_after,p.p_client),error:null};
    if(name==='lobbix_v1_list'||name==='lobbix_my_profile'||name==='lobbix_is_admin')return{data:(await server.as(actor,'select public.'+name+'() value'))[0].value,error:null};
    throw Error('Unexpected UI RPC: '+name);
   }catch(error){return{data:null,error:{message:error.message,code:error.code}};}
  }
  const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>errors.push(error.message));
  const dom=new JSDOM(html,{url:'https://local.test/Lobbix/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,beforeParse(w){
   w.Headers=Headers;w.Response=Response;w.Request=Request;w.fetch=async()=>{throw Error('No external requests in tests');};
   w.supabase={createClient(_url,_key,opts){sdkOptions=opts;return{auth,rpc,functions:{async invoke(_name,{body}){
    const response=await handler(new Request('https://fixture.test',{method:'POST',headers:{'content-type':'application/json','x-fixture-user':actor},body:JSON.stringify(body)}));
    const data=await response.json();return{data:response.ok?data:null,error:response.ok?null:{context:{json:async()=>data}}};
   }}};}};
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
   w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},drawImage(){}});
   w.HTMLMediaElement.prototype.play=async()=>{};w.alert=value=>calls.push(String(value));w.confirm=()=>true;w.prompt=()=> 'Signalement local isolé';
   Object.defineProperty(w.crypto,'randomUUID',{value:randomUUID});
   if(options.storage)for(const [key,value]of Object.entries(options.storage))w.localStorage.setItem(key,value);
  }});clients.push(dom);const w=dom.window;
  await until(()=>!w.document.getElementById(options.guest?'auth':'app').classList.contains('hidden'),'client startup');
  await until(()=>w.eval('db !== null'),'SDK ready');
  if(!options.guest)await until(()=>w.eval('profile !== null'),'profile');
  return{w,calls,errors,get sdkOptions(){return sdkOptions;},get:(id)=>w.document.getElementById(id),eval:code=>w.eval(code)};
 }
 const A=await client(a),B=await client(b);
 check(!A.get('app').classList.contains('hidden'),'Existing account loads');
 check(A.sdkOptions.auth.persistSession&&A.sdkOptions.auth.storageKey.includes('-tab-'),'Per-tab session retained');
 A.w.page('create');A.get('rName').value='Atelier partagé';A.get('rDesc').value='Deux clients isolés';
 A.get('rHours').value='1';A.get('rEmpty').value='2';
 await A.w.createRoom({preventDefault(){},currentTarget:A.get('createLobbyForm')});
 await until(()=>A.eval('lobby !== null'),'created room joined');const room=A.eval('lobby.id');
 check(A.get('room').dataset.view==='chat','Chat opens full size');
 await B.w.listRooms();await B.w.enterRoom(room,'Atelier partagé');await A.w.updateRoom();
 check(A.get('count').textContent==='2/25 membres','Presence synchronized between two clients');
 A.get('message').value='Bonjour les amis';await A.w.send();await B.w.updateRoom();
 check(B.get('messages').textContent.includes('Bonjour les amis'),'Message reaches second client');
 await server.db.query("update public.lobbix_sg_state set last_message_at=now()-interval '2 seconds'");
 A.get('message').value='test@example.com';await A.w.send();
 check(A.get('sgNotice').textContent.includes('🚫')&&A.get('message').value.includes('@'),'SafeGuard rejection keeps draft');
 check((await server.db.query('select count(*)::int n from public.lobbix_messages')).rows[0].n===1,'Blocked message not stored');
 await A.w.activity('catalog');check(A.get('room').dataset.view==='activity'&&A.get('room').dataset.chat==='open','Desktop activity uses sidebar');
 A.w.toggleConversation(false);check(A.get('room').dataset.chat==='closed','Sidebar closes');A.w.toggleConversation(true);check(A.get('chatPill').getAttribute('aria-expanded')==='true','Conversation pill reopens chat');
 await A.w.newActivity('poll');A.get('activityQuestion').value='Quel jour ?';A.get('activityOptions').value='Lundi\nMardi';
 await A.w.publishActivity({preventDefault(){},currentTarget:A.get('activityOptions').closest('form')},'poll');
 const poll=A.eval('V1.active');check(Boolean(poll)&&A.get('workspace').textContent.includes('Quel jour ?'),'Poll creation opens activity');
 await B.w.openActivity(poll);await B.w.performActivity('poll_vote',{option:1});await A.w.updateRoom();
 check(A.get('workspace').textContent.includes('1 vote(s)'),'Poll synchronized');
 await server.db.query("update public.lobbix_activities set created_at=now()-interval '4 seconds'");
 await A.w.activity('catalog');await A.w.newActivity('draw');const board=A.eval('V1.active');await B.w.openActivity(board);
 await A.w.v1Action('draw_stroke',{activity_id:board,stroke_id:randomUUID(),color:'#123456',width:3,points:[[0.1,0.2],[0.3,0.4]]});await B.w.updateRoom();
 check(B.eval('V1.drawStrokes.size')===1,'Drawing delta reaches second client');
 await A.w.performActivity('draw_clear_vote');await B.w.updateRoom();check(B.eval('V1.drawStrokes.size')===1,'One vote does not erase shared board');
 await B.w.performActivity('draw_clear_vote');await A.w.updateRoom();check(A.eval('V1.drawStrokes.size')===0,'Majority erases board on both clients');
 await A.w.activity('players');check(A.get('workspace').textContent.includes('Joueur1'),'Members page');
 await A.w.activity('scores');check(A.get('workspace').textContent.includes('Classement du lobby'),'Leaderboard page');
 await A.w.activity('screen');check(A.get('startShareButton').disabled&&A.get('screenStatus').textContent.includes('peut regarder'),'Unsupported capture is explained');
 const fakeTrack={stopped:false,stop(){this.stopped=true;},addEventListener(){},removeEventListener(){}};
 Object.defineProperty(A.w.navigator,'mediaDevices',{value:{getDisplayMedia:async()=>({getTracks:()=>[fakeTrack],getVideoTracks:()=>[fakeTrack]})},configurable:true});
 await A.w.startScreenShare();check(A.eval('Boolean(V1.rtc.localStream)'),'Capture starts after explicit request');
 check(A.get('screenClock').textContent.includes('10:'),'Ten-minute countdown shown');
 A.w.stopScreenShare();await until(()=>fakeTrack.stopped,'Capture stopped');await new Promise(resolve=>setTimeout(resolve,30));await A.w.updateRoom();
 check(A.get('startShareButton').disabled&&A.get('screenStatus').textContent.includes('nouveau'),'Cooldown shown after stop');
 A.w.openWallpaperSettings();check(A.get('wallpaperDialog').open,'Wallpaper available from top navbar');
 check(!A.get('wallpaperUrl').required&&A.get('wallpaperUrlButton').disabled,'Photo import does not require URL');
 A.w.setWall('waves');check(A.w.localStorage.getItem('lobbix-bg')==='waves','Wallpaper preference retained');A.get('wallpaperDialog').close();
 Object.defineProperty(A.w,'innerWidth',{value:400,configurable:true});await A.w.activity('catalog');check(A.get('room').dataset.chat==='closed','Mobile activity starts without obscuring overlay');
 A.w.toggleConversation(true);check(A.get('room').dataset.chat==='open','Mobile conversation opens');await A.w.activity('home');check(A.get('room').dataset.view==='chat','Discussion restores full-size chat');
 await A.w.leaveRoom();check(!A.get('app').classList.contains('hidden'),'Leave returns home');
 const R=await client(a,{guest:true});R.w.renderAuth('signup');R.get('email').value='fixture@example.test';R.get('password').value='fixture-password';R.get('accept').checked=true;
 await R.w.authSubmit({preventDefault(){},currentTarget:R.get('email').closest('form')});check(R.calls.includes('signup'),'Signup still reaches Auth SDK');
 await server.db.query("update public.lobbix_lobbies set expires_at=now()-interval '1 second' where id=$1",[room]);await B.w.updateRoom();
 check(B.get('message').disabled&&B.get('roomNotice').textContent.includes('expiré'),'Open room closes at expiration');
 check(!B.get('rejoinRoomButton').classList.contains('hidden'),'Expired room offers return home');
 check(clients.every(c=>!c.window.document.querySelector('[src^="https://cdn"]')),'Tests avoid external SDK requests');
 for(const item of [A,B,R])check(item.errors.length===0,'Uncaught DOM error: '+item.errors.join('; '));
 console.log(JSON.stringify({ui_checks:passed,clients:clients.length,production_requests:0,backend:'actual V1 SQL and SafeGuard Edge handler'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const client of clients)client.window.close();if(server)await server.db.close();});
