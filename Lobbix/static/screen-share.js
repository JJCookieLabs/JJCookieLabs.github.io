/* Media stays between peers. This module never records a screen or stores a video. */
(function(root){
 'use strict';
 class LobbixScreenShare {
  constructor(options){
   this.options=options;this.Peer=options.Peer||root.RTCPeerConnection;this.Stream=options.Stream||root.MediaStream;
   this.peers=new Map();this.share=null;this.localStream=null;this.remoteStream=null;this.publishing=false;
  }
  key(user,client){return user+':'+client;}
  async signal(user,client,signal){
   if(!this.share)return;
   await this.options.send({session_id:this.share.id,recipient_id:user,recipient_client:client,signal});
  }
  setShare(share){
   if(this.share&&this.share.id!==share?.id)this.stop(false);
   this.share=share;
   if(!share)this.stop(false);
  }
  publish(stream,share){
   this.stop(false);this.share=share;this.localStream=stream;this.publishing=true;
   for(const track of stream.getTracks())track.onended=()=>this.stop(true);
   this.options.onStream?.(stream,true);
  }
  async watch(share){
   this.stop(false);this.share=share;this.publishing=false;
   await this.signal(share.owner_id,share.owner_client,{type:'request'});
  }
  peer(user,client){
   const key=this.key(user,client);
   let entry=this.peers.get(key);if(entry)return entry;
   const pc=new this.Peer(this.options.rtcConfig||{iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]});
   entry={pc,candidates:[],user,client};this.peers.set(key,entry);
   pc.onicecandidate=event=>{
    if(event.candidate)this.signal(user,client,{type:'ice',candidate:event.candidate.toJSON?event.candidate.toJSON():{candidate:event.candidate.candidate,sdpMid:event.candidate.sdpMid,sdpMLineIndex:event.candidate.sdpMLineIndex}}).catch(error=>this.options.onError?.(error));
   };
   pc.ontrack=event=>{
    const stream=event.streams?.[0]||new this.Stream([event.track]);this.remoteStream=stream;this.options.onStream?.(stream,false);
   };
   pc.onconnectionstatechange=()=>{
    if(pc.connectionState==='failed')this.options.onError?.(new Error('La connexion au partage est bloquée par ce réseau. Essaie un autre réseau ou réessaie.'));
   };
   return entry;
  }
  async handle(message){
   if(!this.share||message.session_id!==this.share.id)return;
   const signal=message.signal||{},user=message.sender_id,client=message.sender_client;
   const me=this.options.identity();
   const owner=me.user===this.share.owner_id&&me.client===this.share.owner_client;
   if(!owner&&(user!==this.share.owner_id||client!==this.share.owner_client))return;
   if(signal.type==='request'){
    if(!owner||!this.localStream)return;
    const key=this.key(user,client),old=this.peers.get(key);if(old){old.pc.close();this.peers.delete(key);}
    const {pc}=this.peer(user,client);
    for(const track of this.localStream.getTracks())pc.addTrack(track,this.localStream);
    await pc.setLocalDescription(await pc.createOffer());
    await this.signal(user,client,{type:'offer',sdp:pc.localDescription.sdp});
    return;
   }
   if(!['offer','answer','ice','bye'].includes(signal.type))return;
   if(signal.type==='bye'){
    const key=this.key(user,client),entry=this.peers.get(key);entry?.pc.close();this.peers.delete(key);return;
   }
   const entry=this.peer(user,client),pc=entry.pc;
   if(signal.type==='ice'){
    if(!signal.candidate||typeof signal.candidate.candidate!=='string')return;
    if(pc.remoteDescription)await pc.addIceCandidate(signal.candidate);else entry.candidates.push(signal.candidate);
    return;
   }
   if(typeof signal.sdp!=='string'||signal.sdp.length>65000)return;
   if(signal.type==='offer'&&owner)return;
   if(signal.type==='answer'&&!owner)return;
   await pc.setRemoteDescription({type:signal.type,sdp:signal.sdp});
   for(const candidate of entry.candidates.splice(0))await pc.addIceCandidate(candidate);
   if(signal.type==='offer'){
    await pc.setLocalDescription(await pc.createAnswer());
    await this.signal(user,client,{type:'answer',sdp:pc.localDescription.sdp});
   }
  }
  checkTimeout(){
   if(!this.share)return;
   const now=this.options.now?.()??Date.now();
   if(now>=Date.parse(this.share.deadline)||this.share.valid_until&&now>=Date.parse(this.share.valid_until)){
    this.options.onExpired?.();this.stop(true);
   }
  }
  stop(notify=true){
   const previous=this.share,owned=this.publishing;
   if(notify&&!owned&&previous)this.options.send({session_id:previous.id,recipient_id:previous.owner_id,recipient_client:previous.owner_client,signal:{type:'bye'}}).catch(()=>{});
   this.share=null;this.publishing=false;
   for(const entry of this.peers.values()){entry.pc.onconnectionstatechange=null;entry.pc.close();}
   this.peers.clear();
   for(const stream of [this.localStream,this.remoteStream])for(const track of stream?.getTracks()||[]){track.onended=null;track.stop();}
   this.localStream=null;this.remoteStream=null;this.options.onStream?.(null,false);
   if(notify&&owned&&previous)this.options.onStopped?.(previous);
  }
 }
 root.LobbixScreenShare=LobbixScreenShare;
 if(typeof module!=='undefined'&&module.exports)module.exports={LobbixScreenShare};
})(typeof window!=='undefined'?window:globalThis);
