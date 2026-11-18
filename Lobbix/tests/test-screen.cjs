const assert=require('node:assert/strict');
const wrtc=require('@roamhq/wrtc');
const {LobbixScreenShare}=require('../static/screen-share.js');
let passed=0;
const check=(value,label)=>{assert(value,label);passed++;};
async function until(predicate,label){for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timeout: '+label);}
async function main(){
 let now=Date.now(),frames=0,ended=0,errors=[],sink;const trace=[];
 const share={id:'00000000-0000-4000-8000-000000000090',owner_id:'owner',owner_client:'owner-tab',deadline:new Date(now+600000).toISOString()};
 let owner,viewer;
 const route=(from,to)=>async data=>{trace.push({from:from.user,type:data.signal.type,media:data.signal.sdp?.match(/^m=\w+/gm)});queueMicrotask(()=>to().handle({session_id:data.session_id,sender_id:from.user,sender_client:from.client,signal:data.signal}).catch(error=>errors.push(error.message)));};
 const common={Peer:wrtc.RTCPeerConnection,Stream:wrtc.MediaStream,rtcConfig:{iceServers:[]},now:()=>now,onError:error=>errors.push(error.message)};
 owner=new LobbixScreenShare({...common,identity:()=>({user:'owner',client:'owner-tab'}),send:route({user:'owner',client:'owner-tab'},()=>viewer),onStopped:()=>ended++});
 viewer=new LobbixScreenShare({...common,identity:()=>({user:'viewer',client:'viewer-tab'}),send:route({user:'viewer',client:'viewer-tab'},()=>owner),onStream:stream=>{
  if(stream){sink=new wrtc.nonstandard.RTCVideoSink(stream.getVideoTracks()[0]);sink.onframe=()=>frames++;}
 }});
 const source=new wrtc.nonstandard.RTCVideoSource(),track=source.createTrack(),stream=new wrtc.MediaStream([track]);
 owner.publish(stream,share);await viewer.watch(share);
 const feed=setInterval(()=>source.onFrame({width:160,height:90,data:new Uint8ClampedArray(160*90*1.5).fill(128)}),60);
 try{
  await until(()=>Boolean(viewer.remoteStream),'remote media track negotiated');
  check(Boolean(viewer.remoteStream),'Remote video stream missing');
  check(viewer.remoteStream.getVideoTracks().length===1,'No video track was negotiated');
  check(owner.peers.size===1&&viewer.peers.size===1,'Peer counts incorrect');
  const count=owner.peers.size;
  await owner.handle({session_id:'old-session',sender_id:'stranger',sender_client:'fake',signal:{type:'request'}});
  check(owner.peers.size===count,'Old share signal was accepted');
  now=Date.parse(share.deadline)-1;owner.checkTimeout();check(owner.localStream!==null,'Share stopped before ten-minute deadline');
  now++;owner.checkTimeout();check(owner.localStream===null&&track.readyState==='ended','Share did not stop at ten minutes');
  check(ended===1,'Server stop callback missing');owner.checkTimeout();check(ended===1,'Stop notified repeatedly');
  viewer.stop(false);check(viewer.peers.size===0,'Viewer peer was not released');
  check(errors.length===0,'WebRTC errors: '+errors.join('; '));
 }finally{
  clearInterval(feed);sink?.stop();owner.stop(false);viewer.stop(false);
 }
 console.log(JSON.stringify({screen_checks:passed,negotiated_with:'native WebRTC',public_network_used:false,media_transport:'not verified: runtime blocks network interface enumeration'}));
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
