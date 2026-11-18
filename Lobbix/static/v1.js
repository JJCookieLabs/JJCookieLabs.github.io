'use strict';
const V1={client:'',view:'home',active:null,activityRevision:0,snapshot:null,after:0,signalAfter:0,updating:false,clockOffset:0,joinTarget:null,inviteHandled:false,drawPending:[],drawCurrent:null,drawQueue:Promise.resolve(),rtc:null,mediaRoom:null,orphanShare:null,shareRequestedAt:0};
try{
 V1.client=sessionStorage.getItem('lobbix-auth-tab-id-v1')||crypto.randomUUID();
 sessionStorage.setItem('lobbix-auth-tab-id-v1',V1.client);
}catch{V1.client=crypto.randomUUID();}
const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const serverNow=()=>Date.now()+V1.clockOffset;
const memberName=id=>V1.snapshot?.members?.find(member=>member.user_id===id)?.nickname||'Joueur';
const timeLeft=value=>{
 const seconds=Math.max(0,Math.ceil((Date.parse(value)-serverNow())/1000));
 return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
};
async function v1Rpc(name,payload={}){
 if(!db||!user)throw Error('Connecte-toi à Lobbix.');
 const {data,error}=await db.rpc(name,payload);if(error)throw error;return data;
}
async function v1Action(action,data={},roomId=lobby?.id){
 if(!roomId)throw Error('Rejoins un lobby avant de continuer.');
 return v1Rpc('lobbix_v1_action',{p_lobby:roomId,p_client:V1.client,p_action:action,p_data:data});
}
function activityError(error){notice(error?.message||String(error),$('activityNotice')?'activityNotice':'roomNotice');}
function roomCard(room){
 return `<div class="card"><h3>${room.is_random?'🎲':room.is_public===false?'🔒':'🎮'} ${safe(room.name)}</h3><p class="muted">${safe(room.description||'')} · ${Number(room.current_players)||0}/25 membres</p><p class="muted">${room.expires_at?'Fin : '+safe(new Date(room.expires_at).toLocaleString('fr-FR')):'Sans limite de durée'}</p><button type="button" onclick="joinRoom('${safe(room.id)}')">Rejoindre</button></div>`;
}
async function listRooms(){
 const actor=user?.id,revision=authRevision;
 const data=await v1Rpc('lobbix_v1_list');if(user?.id===actor&&revision===authRevision)lobbies=data||[];
}
const pageBeforeV1=page;
page=function(name){
 pageBeforeV1(name);
 if(name==='create'){
  const form=$('createLobbyForm');if(!form)return;
  form.querySelectorAll('p.muted').forEach(element=>element.remove());
  form.querySelector('fieldset').insertAdjacentHTML('afterbegin',`<label for="rVisibility">Visibilité</label><select id="rVisibility" onchange="togglePrivatePassword()"><option value="public">Public : visible dans Explorer</option><option value="private">Privé : invitation et mot de passe</option></select><div id="rPasswordBox" class="hidden"><label for="rPassword">Mot de passe du lobby</label><input id="rPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" disabled><p class="muted">Partage le lien et le mot de passe séparément.</p></div>`);
  form.querySelector('label[for="rEmpty"]').textContent='Fermeture quand le lobby est vide : 1 à 30 minutes';
  form.insertAdjacentHTML('beforeend','<p class="muted">La fermeture bloque les entrées et les messages. Les données existantes sont conservées.</p>');
 }
 if(name==='home'&&!V1.inviteHandled){
  const invited=new URL(location.href).searchParams.get('lobby');V1.inviteHandled=true;
  if(validId(invited))setTimeout(()=>joinRoom(invited),0);
 }
};
function togglePrivatePassword(){
 const hidden=$('rVisibility').value!=='private';$('rPasswordBox').classList.toggle('hidden',hidden);$('rPassword').disabled=hidden;$('rPassword').required=!hidden;
}
async function createRoom(event){
 event.preventDefault();if(creatingRoom||joiningRoom)return;
 const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),actor=user?.id,revision=authRevision;
 if(!actor||!profile){notice('Connecte-toi et complète ton profil.','createNotice');return;}
 creatingRoom=true;button.disabled=true;button.textContent=pendingCreatedLobby?'Entrée dans le lobby…':'Création en cours…';
 notice('SafeGuard vérifie ton lobby…','createNotice');
 try{
  if(!pendingCreatedLobby){
   const name=$('rName').value.trim(),isPublic=$('rVisibility').value==='public',password=isPublic?'':$('rPassword').value;
   const result=await safeguard({api_version:1,action:'lobby',name,description:$('rDesc').value,hours:$('rHours').value?Number($('rHours').value):null,empty_minutes:Number($('rEmpty').value),is_public:isPublic,...(!isPublic?{password}:{})});
   if(user?.id!==actor||authRevision!==revision)return;
   if(!result.ok)throw Error(result.reason||result.message||'Lobby refusé.');
   if(!validId(result.lobby_id))throw Error('Le serveur n’a pas confirmé la création. Actualise la liste.');
   pendingCreatedLobby={id:result.lobby_id,name,password};form.querySelector('fieldset').disabled=true;
  }
  await enterRoom(pendingCreatedLobby.id,pendingCreatedLobby.name,pendingCreatedLobby.password);
  if(user?.id===actor&&authRevision===revision)pendingCreatedLobby=null;
 }catch(error){if(user?.id===actor&&authRevision===revision)notice((pendingCreatedLobby?'Lobby créé. Réessaie de le rejoindre : ':'')+(error.message||error),'createNotice');}
 finally{creatingRoom=false;if(button.isConnected){button.disabled=false;button.textContent=pendingCreatedLobby?'Rejoindre le lobby créé':'Créer et rejoindre';}}
}
async function joinRoom(id){
 if(!validId(id)||joiningRoom||creatingRoom)return;
 const known=lobbies.find(room=>room.id===id)||V1.snapshot?.room;
 if(!known||known.id!==id||known.is_public===false){
  V1.joinTarget={id,name:known?.id===id?known.name:''};$('joinLobbyPassword').value='';hideNotice('joinLobbyError');
  $('joinLobbyDescription').textContent=known?.id===id?'Rejoindre « '+known.name+' ». Le lien et le mot de passe sont deux informations distinctes.':'Renseigne le mot de passe de ce lobby s’il est privé.';
  if(!$('joinLobbyDialog').open)$('joinLobbyDialog').showModal();return;
 }
 joiningRoom=true;
 try{await enterRoom(id,known.name);}catch(error){fail(error,lobby?'roomNotice':'appError');}finally{joiningRoom=false;}
}
async function submitPrivateJoin(event){
 event.preventDefault();if(joiningRoom||!V1.joinTarget)return;
 const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;joiningRoom=true;
 try{
  await enterRoom(V1.joinTarget.id,V1.joinTarget.name,$('joinLobbyPassword').value);
  $('joinLobbyPassword').value='';$('joinLobbyDialog').close();V1.joinTarget=null;
 }catch(error){notice(error.message||error,'joinLobbyError');}finally{joiningRoom=false;button.disabled=false;}
}
async function enterRoom(id,name,password=''){
 const actor=user?.id,revision=authRevision;
 if(!actor)throw Error('Connecte-toi avant de rejoindre un lobby.');
 const joined=await v1Action('join',{password},id);
 if(user?.id!==actor||authRevision!==revision)throw Error('Le compte connecté a changé.');
 if(!joined.ok||!joined.joined_at)throw Error(joined.message||'L’entrée dans le lobby n’a pas été confirmée.');
 clearInterval(poller);cleanupRoomMedia();
 lobby={id,name:joined.name||name||'Lobby'};joinedAt=joined.joined_at;members=[];roomPresenceConfirmed=true;
 V1.active=null;V1.activityRevision=0;V1.after=0;V1.signalAfter=0;V1.snapshot=null;V1.view='home';V1.drawPending=[];V1.drawCurrent=null;
 $('roomName').textContent=lobby.name;$('messages').innerHTML='<p class="muted" id="emptyChat">Aucun message depuis ton entrée. Lance la conversation !</p>';
 $('sgNotice').textContent='';hideNotice('roomNotice');hideNotice('appError');$('rejoinRoomButton').classList.add('hidden');
 $('message').disabled=false;$('sendMessageButton').disabled=false;$('rejoinRoomButton').onclick=()=>joinRoom(id);
 screen('room');setWall(wallChoice,false);setRoomView('home');await updateRoom();
 if(user?.id===actor&&authRevision===revision&&lobby?.id===id)poller=setInterval(updateRoom,1500);
}
async function leaveRoom(){
 const room=lobby;clearInterval(poller);poller=null;cleanupRoomMedia();
 if(room&&db&&user){try{await v1Action('leave',{},room.id);}catch(error){console.warn('Départ du lobby indisponible',error?.message);}}
 lobby=null;members=[];roomPresenceConfirmed=false;V1.snapshot=null;V1.active=null;
 screen('app');try{await listRooms();}catch(error){fail(error,'appError');}page('home');
}
function resizeRoom(){const height=$('roomTop')?.getBoundingClientRect().height;if(height)$('room').style.setProperty('--room-top',height+'px');}
function setRoomView(view){
 V1.view=view;const main=view==='home';$('room').dataset.view=main?'chat':'activity';
 $('workspace').classList.toggle('hidden',main);
 if(!main)$('room').dataset.chat=window.innerWidth<=850?'closed':'open';
 else $('room').dataset.chat='open';
 document.querySelectorAll('.roomnav [data-view-name]').forEach(button=>button.classList.toggle('active',button.dataset.viewName===view||(view==='activity'&&button.dataset.viewName==='catalog')));
 $('chatPill').setAttribute('aria-expanded',String(main||$('room').dataset.chat==='open'));resizeRoom();
}
function toggleConversation(open){
 if(V1.view==='home'){setRoomView('home');$('message').focus();return;}
 const next=typeof open==='boolean'?open:$('room').dataset.chat!=='open';$('room').dataset.chat=next?'open':'closed';$('chatPill').setAttribute('aria-expanded',String(next));
}
async function stopCurrentActivity(){
 const previous=V1.active;V1.active=null;V1.activityRevision=0;V1.drawCurrent=null;V1.drawPending=[];
 if(previous&&lobby)await v1Action('activity_leave').catch(activityError);
}
async function activity(type){
 await stopCurrentActivity();
 if(type!=='screen'&&V1.rtc&&!V1.rtc.publishing)V1.rtc.stop(true);
 if(['draw','wheel','poll','games'].includes(type))type='catalog';
 setRoomView(type);
 if(type==='home')return;
 if(type==='catalog')renderCatalog();
 else if(type==='players')renderPlayers();
 else if(type==='scores')renderScores();
 else if(type==='screen')renderScreen();
}
async function updateRoom(){
 if(!lobby||!user||V1.updating)return;
 const room=lobby,actor=user.id,revision=authRevision;V1.updating=true;
 try{
  const state=await v1Rpc('lobbix_v1_state',{p_lobby:room.id,p_client:V1.client,p_activity:V1.active,p_version:V1.activityRevision,p_after:V1.after,p_signal_after:V1.signalAfter});
  if(lobby?.id!==room.id||user?.id!==actor||revision!==authRevision)return;
  if(state.server_now)V1.clockOffset=Date.parse(state.server_now)-Date.now();
  if(state.closed||state.unjoined){
   roomPresenceConfirmed=false;$('message').disabled=true;$('sendMessageButton').disabled=true;cleanupRoomMedia();
   notice(state.reason||'Ce lobby est fermé.','roomNotice');$('rejoinRoomButton').classList.remove('hidden');
   $('rejoinRoomButton').textContent=state.closed?'Revenir à l’accueil':'Rejoindre à nouveau ce lobby';$('rejoinRoomButton').onclick=state.closed?leaveRoom:()=>joinRoom(room.id);return;
  }
  V1.snapshot=state;roomPresenceConfirmed=true;hideNotice('roomNotice');$('rejoinRoomButton').classList.add('hidden');$('message').disabled=false;$('sendMessageButton').disabled=false;
  members=[...new Map((state.members||[]).map(member=>[member.user_id,member])).values()];$('count').textContent=members.length+'/25 membres';
  appendRoomMessages(state.messages||[],state.removed_messages||[]);
  if(state.activity&&state.activity.id===V1.active){V1.activityRevision=Number(state.activity.revision)||0;renderActivity(state.activity);}
  if(V1.view==='catalog')renderRunningActivities();else if(V1.view==='players')renderPlayers();else if(V1.view==='scores')renderScores();
  if(V1.rtc?.share&&V1.rtc.share.id===state.share?.id)V1.rtc.setShare(state.share);
  else if(V1.rtc?.share&&V1.rtc.share.id!==state.share?.id)V1.rtc.stop(false);
  if(state.share?.owner_id===user.id&&state.share.owner_client===V1.client&&!V1.rtc?.localStream&&V1.orphanShare!==state.share.id){
   V1.orphanShare=state.share.id;v1Action('screen_stop',{session_id:state.share.id}).catch(activityError);
  }
  for(const message of state.signals||[]){
   V1.signalAfter=Math.max(V1.signalAfter,Number(message.id));
   try{await V1.rtc?.handle(message);}catch(error){notice(error.message||'Connexion au partage impossible.','screenNotice');}
  }
  if(V1.view==='screen')refreshScreenControls();
  updateRoomClock();
 }catch(error){if(lobby?.id===room.id)notice('Actualisation impossible : '+(error.message||error),'roomNotice');}
 finally{V1.updating=false;}
}
function appendRoomMessages(messages,removed){
 const container=$('messages'),atEnd=container.scrollHeight-container.scrollTop-container.clientHeight<120;
 for(const message of messages){
  V1.after=Math.max(V1.after,Number(message.id));if($('message-'+message.id))continue;$('emptyChat')?.remove();
  const row=document.createElement('div');row.id='message-'+message.id;row.className='msg'+(message.sender_id===user.id?' me':'');
  row.innerHTML=`<small>${safe(message.nickname||memberName(message.sender_id))} · ${safe(new Date(message.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}))}</small><div class="message-body">${message.deleted_at?'Message supprimé':safe(message.body)}</div><button type="button" class="alt" onclick="report(${Number(message.id)})" style="padding:3px 6px;font-size:11px">⚑ Signaler</button>`;
  container.append(row);
 }
 for(const id of removed){const body=$('message-'+id)?.querySelector('.message-body');if(body)body.textContent='Message supprimé';}
 while(container.children.length>500)container.firstElementChild.remove();
 if(atEnd)container.scrollTop=container.scrollHeight;
}
async function send(){
 if(!lobby||sending||!roomPresenceConfirmed)return;
 const input=$('message'),text=input.value.trim();if(!text)return;
 if(text===ADMIN_COMMAND){input.value='';await openAdminLogin();return;}
 sending=true;$('sendMessageButton').disabled=true;$('sgNotice').textContent='🛡️ SafeGuard 2.0 vérifie ton message…';
 try{
  let result=await safeguard({api_version:1,action:'message',lobby_id:lobby.id,text});
  if(result.verdict==='warning'){
   if(!confirm('SafeGuard : '+result.reason+'\n\nEnvoyer quand même ?')){$('sgNotice').textContent='Message non envoyé.';return;}
   result=await safeguard({api_version:1,action:'message',lobby_id:lobby.id,text,confirm_warning:true});
  }
  if(!result.ok){$('sgNotice').textContent='🚫 '+(result.reason||result.message||'Message refusé.');return;}
  input.value='';$('sgNotice').textContent='✅ Message accepté';await updateRoom();
 }catch(error){$('sgNotice').textContent='Envoi impossible : '+(error.message||error);}
 finally{sending=false;$('sendMessageButton').disabled=!roomPresenceConfirmed;}
}
async function report(id){
 const reason=prompt('Motif du signalement : 10 à 250 caractères.');if(reason===null)return;
 try{await v1Action('report_message',{message_id:id,reason});alert('Signalement transmis.');}catch(error){alert(error.message||error);}
}
async function copyLobbyInvite(){
 if(!lobby)return;const url=new URL(location.pathname,location.origin);url.searchParams.set('lobby',lobby.id);
 try{await navigator.clipboard.writeText(url.href);notice(V1.snapshot?.room?.is_public===false?'Lien copié. Partage le mot de passe séparément.':'Lien d’invitation copié.','roomNotice');}catch{prompt('Copie le lien d’invitation :',url.href);}
}
function activityHeader(title,id){
 const record=V1.snapshot?.activities?.find(a=>a.id===id);
 const owned=record?.owner_id===user?.id||record&&!V1.snapshot.members.some(member=>member.user_id===record.owner_id||member.activity_id===id);
 return `<div class="activity-heading"><div><h2>${safe(title)}</h2><span class="badge">Activité partagée</span></div><div class="activity-actions"><button type="button" class="alt" onclick="activity('catalog')">← Activités</button>${owned?`<button type="button" class="alt" onclick="closeActivity('${safe(id)}')">Terminer</button>`:''}<button type="button" class="alt" onclick="reportActivity('activity','${safe(id)}')">⚑ Signaler</button></div></div><div id="activityNotice" class="notice hidden" role="status"></div>`;
}
function renderCatalog(){
 $('workspace').innerHTML=`<div class="activity-heading"><div><h2>🧩 Catalogue d’activités</h2><p class="muted">Chaque membre peut démarrer une activité. Plusieurs parties peuvent fonctionner en même temps.</p></div></div><div id="activityNotice" class="notice hidden" role="status"></div><div class="catalog">${[
  ['🎨','Tableau blanc','Dessine avec les membres du tableau. Effacement par vote.','draw'],['🎡','Roue de choix','Des propositions et un tirage identique pour tout le monde.','wheel'],['📊','Sondage','Une question, un vote par membre et des résultats partagés.','poll'],['⭕','Morpion','Deux joueurs, des tours vérifiés et des points pour le gagnant.','tictactoe'],['🧠','Défi calcul','Cinq questions en deux minutes. Jusqu’à dix points par défi.','quiz']
 ].map(([icon,title,description,kind])=>`<article class="catalog-card"><span class="app-icon">${icon}</span><h3>${title}</h3><p class="muted">${description}</p><button type="button" onclick="newActivity('${kind}')">Démarrer</button></article>`).join('')}</div><h3>Activités en cours</h3><div id="runningActivities" class="running-list"></div>`;
 renderRunningActivities();
}
function renderRunningActivities(){
 const element=$('runningActivities');if(!element)return;
 const html=(V1.snapshot?.activities||[]).map(a=>`<div class="running-card"><div><strong>${safe(a.title)}</strong><div class="muted">Démarré par ${safe(memberName(a.owner_id))}</div></div><button type="button" onclick="openActivity('${safe(a.id)}')">Rejoindre</button></div>`).join('')||'<p class="muted">Aucune activité en cours. Tu peux en démarrer une.</p>';
 if(element.innerHTML!==html)element.innerHTML=html;
}
async function newActivity(kind){
 if(!roomPresenceConfirmed){activityError(Error('Rejoins à nouveau le lobby.'));return;}
 if(['wheel','poll'].includes(kind)){
  setRoomView('builder');$('workspace').innerHTML=`<div class="activity-form"><h2>${kind==='poll'?'📊 Créer un sondage':'🎡 Créer une roue'}</h2><div id="activityNotice" class="notice hidden" role="status"></div><form onsubmit="publishActivity(event,'${kind}')">${kind==='poll'?'<label for="activityQuestion">Question</label><input id="activityQuestion" maxlength="120" required>':''}<label for="activityOptions">${kind==='poll'?'Réponses':'Propositions'} : une par ligne</label><textarea id="activityOptions" maxlength="2500" required placeholder="Première proposition&#10;Deuxième proposition"></textarea><p class="muted">SafeGuard vérifie ces textes avant publication.</p><button type="submit">Démarrer l’activité</button> <button type="button" class="alt" onclick="activity('catalog')">Annuler</button></form></div>`;return;
 }
 try{const result=await v1Action('game_create',{kind});await updateRoom();await openActivity(result.activity_id);}catch(error){activityError(error);}
}
async function publishActivity(event,kind){
 event.preventDefault();const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;
 try{
  const items=$('activityOptions').value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean);
  const result=await safeguard({api_version:1,action:kind,lobby_id:lobby.id,...(kind==='poll'?{question:$('activityQuestion').value,options:items}:{items})});
  if(!result.ok)throw Error(result.reason||result.message||'Activité refusée.');await updateRoom();await openActivity(result.activity_id);
 }catch(error){activityError(error);}finally{if(button.isConnected)button.disabled=false;}
}
async function openActivity(id){
 if(!validId(id))return;
 try{
  if(V1.active&&V1.active!==id)await v1Action('activity_leave');
  const result=await v1Action('activity_join',{activity_id:id});if(!result.ok)throw Error('Impossible de rejoindre cette activité.');
  V1.active=id;V1.activityRevision=0;V1.drawPending=[];V1.drawCurrent=null;setRoomView('activity');
  $('workspace').innerHTML='<p class="muted">Chargement de l’activité…</p>';await updateRoom();
 }catch(error){activityError(error);}
}
async function closeActivity(id){
 try{await v1Action('activity_close',{activity_id:id});activity('catalog');await updateRoom();}catch(error){activityError(error);}
}
async function performActivity(action,data={}){
 try{await v1Action(action,{activity_id:V1.active,...data});await updateRoom();}catch(error){activityError(error);}
}
function renderActivity(activity){
 const element=$('workspace'),s=activity.state||{};V1.lastActivity=activity;
 if(!activity.is_open){element.innerHTML='<h2>Cette activité est terminée</h2><p><button type="button" onclick="activity(\'catalog\')">Retour aux activités</button></p>';return;}
 const header=activityHeader(activity.title,activity.id);
 if(activity.kind==='draw'){
  if(!$('sharedCanvas')||$('sharedCanvas').dataset.activity!==activity.id){
   V1.drawStrokes=new Map();V1.drawCleared=0;
   element.innerHTML=header+`<div class="draw-tools"><label>Couleur <input id="drawColor" type="color" value="#6554d9"></label><label>Épaisseur <input id="drawWidth" type="range" min="1" max="20" value="4"></label><button type="button" class="alt" onclick="performActivity('draw_clear_vote')">Voter pour effacer</button><span id="drawVotes" class="muted"></span></div><canvas id="sharedCanvas" data-activity="${safe(activity.id)}" width="1000" height="600" aria-label="Tableau blanc partagé"></canvas><p class="muted">Le dessin disparaît lorsque le dernier participant quitte ce tableau. L’effacement manuel nécessite une majorité des participants.</p>`;
   setupSharedCanvas();
  }
  if(Number(s.cleared_revision||0)>V1.drawCleared){V1.drawStrokes.clear();V1.drawCleared=Number(s.cleared_revision);}
  for(const stroke of s.strokes||[])V1.drawStrokes.set(stroke.id,stroke);
  V1.drawPending=V1.drawPending.filter(stroke=>!V1.drawStrokes.has(stroke.id));
  const count=new Set((V1.snapshot?.members||[]).filter(member=>member.activity_id===activity.id).map(member=>member.user_id)).size;
  $('drawVotes').textContent=Object.keys(s.clear_votes||{}).length+' vote(s) · '+count+' participant(s)';repaintDrawing();
 }else if(activity.kind==='poll'){
  const votes=s.votes||{},total=Object.keys(votes).length;
  element.innerHTML=header+`<p class="muted">${total} vote(s) · Tu peux modifier ton choix.</p>`+(s.options||[]).map((option,index)=>{
   const n=Object.values(votes).filter(vote=>vote===index).length;
   return `<button type="button" class="poll-option ${votes[user.id]===index?'selected':''}" onclick="performActivity('poll_vote',{option:${index}})"><span>${safe(option)}</span><strong>${n} · ${total?Math.round(n*100/total):0} %</strong></button>`;
  }).join('');
 }else if(activity.kind==='wheel'){
  element.innerHTML=header+`<p class="muted">${(s.items||[]).map(safe).join(' · ')}</p><div class="wheel-result">${s.result?'🎉 '+safe(s.result):'🎡 À toi de lancer la roue'}</div><button type="button" onclick="performActivity('wheel_spin')">Lancer la roue</button>${s.spun_by?'<p class="muted">Dernier tirage par '+safe(memberName(s.spun_by))+'</p>':''}`;
 }else if(activity.kind==='tictactoe'){
  const players=s.players||[],myIndex=players.indexOf(user.id),activeIndex=s.turn==='X'?0:1;
  const status=s.winner==='draw'?'Égalité : un point pour chaque joueur.':s.winner?memberName(players[s.winner==='X'?0:1])+' gagne trois points !':players.length<2?'En attente d’un deuxième joueur.':(activeIndex===myIndex?'À toi de jouer':'Au tour de '+memberName(players[activeIndex]))+' · '+s.turn;
  element.innerHTML=header+`<p>${players.map((id,index)=>'<strong>'+safe(memberName(id))+'</strong> ('+(index===0?'X':'O')+')').join(' · ')}</p><p role="status">${safe(status)}</p><div class="ttt-board">${(s.board||[]).map((cell,index)=>`<button type="button" aria-label="Case ${index+1}${cell?' : '+safe(cell):''}" ${cell||s.winner||players.length<2||myIndex!==activeIndex?'disabled':''} onclick="performActivity('ttt_move',{cell:${index}})">${safe(cell)||'·'}</button>`).join('')}</div>${myIndex<0?'<p class="muted">Les places de cette partie sont occupées. Tu peux regarder ou démarrer une autre partie.</p>':''}`;
 }else if(activity.kind==='quiz'){
  const me=s.players?.[user.id],progress=Number(me?.progress||0),done=progress>=Number(s.total||5),expired=me&&serverNow()>Date.parse(me.started_at)+120000;
  const progressText=me?`<p>Progression : ${progress}/${Number(s.total)||5} · <strong>${Number(me.score)||0} points</strong> <span id="quizClock" class="badge"></span></p>`:'';
  const feedback=s.feedback===true?'<p>✅ Bonne réponse !</p>':s.feedback===false?'<p>La réponse précédente était incorrecte.</p>':'';
  let questionText='<p>Rejoins ce défi depuis le catalogue.</p>';
  if(done)questionText='<h3>Défi terminé ! Tes points ont été ajoutés au classement.</h3>';
  else if(expired)questionText='<h3>Le temps de ce défi est écoulé.</h3>';
  else if(s.question)questionText='<h3>'+safe(s.question.label)+'</h3>'+s.question.options.map((option,index)=>`<button type="button" class="poll-option" onclick="performActivity('quiz_answer',{question:${progress},option:${index}})">${safe(option)}</button>`).join('');
  const playersText=Object.entries(s.players||{}).map(([id,p])=>`<li>${safe(memberName(id))} : ${Number(p.score)||0} points · ${Number(p.progress)||0}/5</li>`).join('');
  element.innerHTML=header+'<p class="muted">Cinq questions · Deux minutes par participant · Deux points par bonne réponse.</p>'+progressText+feedback+questionText+'<h3>Participants</h3><ul>'+playersText+'</ul>';
 }
 updateRoomClock();
}
function paintStroke(context,stroke){
 const points=stroke.points||[];if(!points.length)return;
 context.lineWidth=Number(stroke.width)||4;context.strokeStyle=stroke.color;context.fillStyle=stroke.color;context.lineCap='round';context.lineJoin='round';context.beginPath();
 context.moveTo(points[0][0]*1000,points[0][1]*600);
 if(points.length===1){context.arc(points[0][0]*1000,points[0][1]*600,context.lineWidth/2,0,Math.PI*2);context.fill();return;}
 for(const point of points.slice(1))context.lineTo(point[0]*1000,point[1]*600);context.stroke();
}
function repaintDrawing(){
 const canvas=$('sharedCanvas');if(!canvas)return;const context=canvas.getContext('2d');if(!context)return;
 context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
 for(const stroke of V1.drawStrokes?.values()||[])paintStroke(context,stroke);
 for(const stroke of V1.drawPending)paintStroke(context,stroke);
 if(V1.drawCurrent)paintStroke(context,V1.drawCurrent);
}
function setupSharedCanvas(){
 const canvas=$('sharedCanvas');
 const point=event=>{const rect=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,Math.round((event.clientX-rect.left)/rect.width*1000)/1000)),Math.max(0,Math.min(1,Math.round((event.clientY-rect.top)/rect.height*1000)/1000))];};
 const submit=()=>{
  const stroke=V1.drawCurrent;if(!stroke)return;V1.drawCurrent=null;V1.drawPending.push(stroke);const roomId=lobby?.id,actor=user?.id,revision=authRevision;
  V1.drawQueue=V1.drawQueue.then(async()=>{
   if(user?.id!==actor||revision!==authRevision)return;
   try{await v1Action('draw_stroke',{activity_id:stroke.activity_id,stroke_id:stroke.id,color:stroke.color,width:stroke.width,points:stroke.points},roomId);await updateRoom();}
   catch(error){V1.drawPending=V1.drawPending.filter(item=>item.id!==stroke.id);if(V1.active===stroke.activity_id){activityError(error);repaintDrawing();}}
  });
 };
 canvas.onpointerdown=event=>{
  if(event.button!==0||!roomPresenceConfirmed)return;event.preventDefault();canvas.setPointerCapture?.(event.pointerId);
  V1.drawCurrent={id:crypto.randomUUID(),activity_id:V1.active,color:$('drawColor').value,width:Number($('drawWidth').value),points:[point(event)]};repaintDrawing();
 };
 canvas.onpointermove=event=>{
  if(!V1.drawCurrent)return;event.preventDefault();const p=point(event),previous=V1.drawCurrent.points.at(-1);
  if(previous[0]===p[0]&&previous[1]===p[1])return;
  V1.drawCurrent.points.push(p);paintStroke(canvas.getContext('2d'),{...V1.drawCurrent,points:[previous,p]});
  if(V1.drawCurrent.points.length>=280){const color=V1.drawCurrent.color,width=V1.drawCurrent.width;submit();V1.drawCurrent={id:crypto.randomUUID(),activity_id:V1.active,color,width,points:[p]};}
 };
 canvas.onpointerup=submit;canvas.onpointercancel=submit;canvas.onlostpointercapture=submit;
}
function renderPlayers(){
 $('workspace').innerHTML='<h2>👥 Membres du lobby</h2><p class="muted">'+members.length+'/25 membres</p><ul>'+members.map(member=>'<li>'+safe(member.nickname)+(member.user_id===user.id?' <span class="badge">toi</span>':'')+'</li>').join('')+'</ul>';
}
function renderScores(){
 const rows=V1.snapshot?.scores||[];
 $('workspace').innerHTML='<h2>🏆 Classement du lobby</h2><p class="muted">Morpion : trois points par victoire, un en cas d’égalité. Défi calcul : deux points par bonne réponse.</p><table class="score-table"><thead><tr><th>Place</th><th>Membre</th><th>Points</th><th>Victoires / défis parfaits</th></tr></thead><tbody>'+rows.map((row,index)=>`<tr><td>${index+1}</td><td>${safe(row.nickname)}</td><td>${Number(row.points)||0}</td><td>${Number(row.wins)||0}</td></tr>`).join('')+'</tbody></table>'+(!rows.length?'<p class="muted">Le classement commencera à la fin de la première partie.</p>':'');
}
function initializeScreenShare(){
 if(typeof LobbixScreenShare!=='function')return;
 V1.rtc=new LobbixScreenShare({identity:()=>({user:user?.id,client:V1.client}),now:serverNow,
  send:data=>v1Action('screen_signal',data,V1.mediaRoom||lobby?.id),
  onStream:(stream,local)=>{
   const video=$('screenVideo');if(video){video.srcObject=stream;video.muted=local;video.play?.().catch(()=>{});}
  },
  onError:error=>notice(error.message||'Connexion au partage impossible.','screenNotice'),
  onStopped:share=>{
   if(db&&user&&V1.mediaRoom)v1Action('screen_stop',{session_id:share.id},V1.mediaRoom).then(updateRoom).catch(()=>{});
  },
  onExpired:()=>notice('Le partage est terminé. Chaque présentation dure au maximum dix minutes.','screenNotice')
 });
}
function renderScreen(){
 $('workspace').innerHTML=`<div class="activity-heading"><div><h2>🖥️ Partage d’écran</h2><p class="muted">Dix minutes maximum par partage. Après l’arrêt, attends une minute avant d’en démarrer un autre. Tu peux recommencer autant de fois que tu veux.</p></div></div><div id="screenNotice" class="notice hidden" role="status"></div><div class="screen-controls"><button id="startShareButton" type="button" onclick="startScreenShare()">Partager mon écran</button><button id="watchShareButton" type="button" class="alt hidden" onclick="watchScreenShare()">Regarder le partage</button><button id="stopShareButton" type="button" class="alt hidden" onclick="stopScreenShare()">Arrêter</button><span id="screenClock" class="screen-clock"></span></div><p id="screenStatus" class="muted"></p><video id="screenVideo" class="screen-video" autoplay playsinline controls aria-label="Partage d’écran"></video><button id="reportShareButton" type="button" class="alt hidden" onclick="reportCurrentScreen()">⚑ Signaler ce partage</button>`;
 const stream=V1.rtc?.localStream||V1.rtc?.remoteStream;if(stream){$('screenVideo').srcObject=stream;$('screenVideo').muted=Boolean(V1.rtc.localStream);$('screenVideo').play?.().catch(()=>{});}
 refreshScreenControls();
}
function refreshScreenControls(){
 if(!$('startShareButton'))return;
 const share=V1.snapshot?.share,owned=share?.owner_id===user?.id&&share?.owner_client===V1.client;
 const cooling=Date.parse(V1.snapshot?.cooldown_until||'')>serverNow();
 $('startShareButton').disabled=Boolean(share)||cooling||!roomPresenceConfirmed||!navigator.mediaDevices?.getDisplayMedia||!V1.rtc;
 $('watchShareButton').classList.toggle('hidden',!share||owned||Boolean(V1.rtc?.remoteStream));
 $('stopShareButton').classList.toggle('hidden',!V1.rtc?.share);
 $('stopShareButton').textContent=V1.rtc?.publishing?'Arrêter mon partage':'Arrêter de regarder';
 $('reportShareButton').classList.toggle('hidden',!share||owned);
 $('screenStatus').textContent=share?'Présentation de '+memberName(share.owner_id)+(owned?' · Ton écran est partagé.':''):cooling?'Tu pourras partager à nouveau dans '+timeLeft(V1.snapshot.cooldown_until)+'.':!navigator.mediaDevices?.getDisplayMedia?'Ce navigateur peut regarder les partages, mais ne permet pas de partager son écran.':'Choisis la fenêtre ou l’onglet que tu veux présenter. Le partage commence après ton autorisation.';
 $('screenClock').textContent=share?'Temps restant : '+timeLeft(share.deadline):'';
}
async function startScreenShare(){
 if(!navigator.mediaDevices?.getDisplayMedia||!V1.rtc){notice('Le partage d’écran n’est pas disponible dans ce navigateur.','screenNotice');return;}
 let stream;const roomId=lobby?.id,actor=user?.id,revision=authRevision;
 try{
  stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:12,max:15},width:{ideal:1280},height:{ideal:720}},audio:false});
  if(lobby?.id!==roomId||user?.id!==actor||revision!==authRevision||!roomPresenceConfirmed)throw Error('Le lobby ou le compte connecté a changé. Relance le partage.');
  const result=await v1Action('screen_start',{},roomId);
  if(lobby?.id!==roomId||user?.id!==actor||revision!==authRevision){v1Action('screen_stop',{session_id:result.share.id},roomId).catch(()=>{});throw Error('Le compte connecté a changé.');}
  V1.mediaRoom=roomId;V1.orphanShare=null;V1.rtc.publish(stream,result.share);await updateRoom();refreshScreenControls();
 }catch(error){for(const track of stream?.getTracks()||[])track.stop();notice(error.name==='NotAllowedError'?'Le partage a été annulé.':error.message||'Impossible de démarrer le partage.','screenNotice');}
}
async function watchScreenShare(){
 const share=V1.snapshot?.share;if(!share||!V1.rtc)return;
 try{V1.mediaRoom=lobby.id;V1.shareRequestedAt=Date.now();await V1.rtc.watch(share);notice('Connexion au partage…','screenNotice');refreshScreenControls();}catch(error){notice(error.message||'Connexion impossible.','screenNotice');}
}
function stopScreenShare(){V1.rtc?.stop(true);refreshScreenControls();}
function cleanupRoomMedia(){
 V1.rtc?.stop(true);V1.drawCurrent=null;
}
function updateRoomClock(){
 const room=V1.snapshot?.room;
 if(room)$('roomDeadline').textContent=room.expires_at?'Fin dans '+timeLeft(room.expires_at):'Sans limite de durée';
 if(room?.expires_at&&Date.parse(room.expires_at)<=serverNow()&&roomPresenceConfirmed)updateRoom();
 V1.rtc?.checkTimeout();
 if(V1.view==='screen')refreshScreenControls();
 const me=V1.lastActivity?.kind==='quiz'?V1.lastActivity.state?.players?.[user?.id]:null;
 if($('quizClock')&&me){const end=new Date(Date.parse(me.started_at)+120000).toISOString();$('quizClock').textContent=timeLeft(end);if(Date.parse(end)<=serverNow())$('workspace').querySelectorAll('.poll-option').forEach(button=>button.disabled=true);}
}
async function reportActivity(kind,id){
 const reason=prompt('Motif du signalement : 10 à 250 caractères.');if(reason===null)return;
 try{await v1Action('report_activity',{kind,target_id:id,reason});alert('Signalement transmis à l’administration.');}catch(error){alert(error.message||error);}
}
function reportCurrentScreen(){if(V1.snapshot?.share)reportActivity('screen',V1.snapshot.share.id);}
const adminBeforeV1=showAdmin;
showAdmin=async function(){
 await adminBeforeV1();if(!admin||!adminPanelUnlocked||currentPage!=='admin')return;
 try{
  const reports=await v1Rpc('lobbix_v1_admin');
  const section=document.createElement('section');section.id='activityReports';section.className='card';
  section.innerHTML='<h2>Signalements d’activités et de partages</h2>'+(reports||[]).map(item=>`<article class="card"><h3>${item.kind==='screen'?'🖥️ Partage d’écran':'🧩 Activité'} · ${safe(item.lobby_name)}</h3><p>${safe(item.reason)}</p><p class="muted">Signalé par ${safe(item.nickname)}</p><button type="button" onclick="reviewActivity('${safe(item.id)}',true)">Fermer le contenu et traiter</button> <button type="button" class="alt" onclick="reviewActivity('${safe(item.id)}',false)">Classer sans fermer</button></article>`).join('');
  if(!reports?.length)section.insertAdjacentHTML('beforeend','<p class="muted">Aucun signalement en attente.</p>');
  $('activityReports')?.remove();$('content').append(section);
 }catch(error){fail(error,'appError');}
};
async function reviewActivity(id,close){
 try{await v1Rpc('lobbix_v1_admin',{p_review:id,p_close:close});await showAdmin();}catch(error){fail(error,'appError');}
}
window.addEventListener('resize',resizeRoom);
if(typeof ResizeObserver==='function')new ResizeObserver(resizeRoom).observe($('roomTop'));
initializeScreenShare();setInterval(updateRoomClock,1000);
startup();
