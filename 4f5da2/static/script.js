(()=>{
document.getElementById("brandLogo").src=document.getElementById("appIcon").href;

const He={aim:"aime",ado:"adore",det:"d\xE9teste",pre:"pr\xE9f\xE8re",prl:"parle \xE0",dsc:"discute avec",dir:"dit",dmd:"demande",rep:"r\xE9pond \xE0",rct:"raconte",avo:"avoue",ann:"annonce",acc:"accepte",ref:"refuse",rgd:"regarde",voi:"voit",eco:"\xE9coute",ent:"entend",don:"donne",rcv:"re\xE7oit",env:"envoie",ecr:"\xE9crit",apl:"appelle",ctc:"contacte",rnc:"rencontre",rtv:"retrouve",ven:"vient",par:"part",all:"va",rst:"reste",srt:"sort",rnt:"rentre",srr:"sourit \xE0",rir:"rit",plr:"pleure",rgg:"rougit",pns:"pense \xE0",cro:"croit",sav:"sait",cmp:"comprend",vou:"veut",pou:"peut",ess:"essaie",att:"attend",com:"commence",cnt:"continue",arr:"arr\xEAte",fin:"finit",qui:"quitte",sep:"se s\xE9pare de",ign:"ignore",evt:"\xE9vite",aid:"aide",rmc:"remercie",exc:"s\u2019excuse",pdn:"pardonne",prm:"promet",oub:"oublie",jou:"joue",tra:"travaille",trv:"trouve",etr:"est",avr:"a",fai:"fait",dev:"devient"};

function Ve(t){
const o=new Map,u=[],e=[],x=new Map,d=new Map,v=new Map,M=new Set;
let A="",S="?",k="\u2014",P=0,U=0,C=!1,X=!1;
const B="[A-Z\xC0-\xD6\xD8-\xDE]{3}\\.[A-Z\xC0-\xD6\xD8-\xDE?]",
$=n=>{
const a=X||n.notes.includes("Incertain ou blague"),c=C,h=[...new Set([n.notes,...a?["Incertain ou blague"]:[],...c?["Barr\xE9"]:[]].filter(Boolean))].join(" \xB7 ");
u.push({...n,notes:h,uncertain:a,struck:c,context:{person:A,cls:S,ecl:k,section:P}})
},
p=n=>(n&&!o.has(n)&&o.set(n,{id:n,SX:"?",ecl:[],cls:[],info:[]}),o.get(n)),
l=(n,a)=>e.push("Ligne "+n+" : "+a);

function m(n,a,c,h="="){
const g=p(n);
if(a==="SX")g.SX=c||"?";
else{
const y=c.trim().replace(/^\[|\]$/g,"").split(",").map(b=>b.trim()).filter(Boolean).map(b=>h==="!="?"\u2260 "+b:b);
g[a]=[...new Set([...g[a],...y])]
}
M.add(n+":"+a)
}
const f=n=>[...n.matchAll(/\{([^}]*)\}/g)].map(a=>a[1]).concat(n.includes("~~~")?["Incertain ou blague"]:[]),
r=n=>n.replace(/\{[^}]*\}/g,"").replace(/~~~/g,"").trim();

function w(n,a,c,h){
const g=String(a||"?").split("/");
for(const b of g)b!=="?"&&(!/^\d{1,2}$/.test(b)||+b<1||+b>12)&&l(h,"mois invalide.");
c&&(+c<1||+c>31)&&l(h,"jour invalide.");
const y=String(n).split("/");
return y.length===2&&y[1].length<4&&(y[1]=y[0].slice(0,4-y[1].length)+y[1]),
(n?y.join("/")+"_"+g.map(b=>b==="?"?"?":b.padStart(2,"0")).join("/"):"?")+(c?" / J"+c:"")
}

t.replace(/^\uFEFF/,"").split(/\r?\n/).forEach((n,a)=>{
const c=a+1;
let h=n.trim();
if(!h||h.startsWith("#")||(C=U>0,X=!1,h=h.replace(/<\/?x>/g,R=>(R==="<x>"?(U++,C=!0):U>0?U--:l(c,"balise </x> sans ouverture."),"")).trim(),h.startsWith("~~~")&&(X=!0,h=h.replace(/^(?:~~~\s*)+/,"").trim()),!h))return;

if(new RegExp("^"+B+"$").test(h)){A=h,S="?",k="\u2014",P++,p(h);return}
let g=h.match(/^(SX|cls|ecl)\s*(!?=)\s*(.*)$/);
if(g){
if(A){
if(g[1]==="SX"&&g[2]==="!="){l(c,"SX!= non pris en charge.");return}
m(A,g[1],g[3],g[2]);
const R=(g[2]==="!="?"\u2260 ":"")+(g[3]||"?");
g[1]==="cls"&&(S=R,P++),g[1]==="ecl"&&(k=R,P++)
}else l(c,"information sans fiche de personne.");
return
}
if(/^\{[^}]*\}$/.test(h)&&A){p(A).info.push(h.slice(1,-1));return}

let y=h.match(/^(\d{4}(?:\/\d{1,4})?)[_.](\?|\d{1,2}(?:\/\d{1,2})?)\s*:\s*/),b=y?.[1]||"",T=y?.[2]||"";
y?h=h.slice(y[0].length):l(c,"date manquante : AAAA_MM, AAAA_?, AAAA/BBBB_MM ou AAAA_MM/NN attendu.");
const D=h.replace(/\[[^\]]*\]/g,"").trim(),J=f(D);
let Z=r(D).match(new RegExp("^("+B+")\\s*(<=>|=>|<=|<!>)\\s*("+B+")$")),q="",V="";

if(Z){
q=Z[1],V=Z[3],p(q),p(V);
if(!["?","\u2014",""].includes(k)&&!k.startsWith("\u2260 "))
for(const R of new Set([q,V]))R!==A&&(v.has(R)||v.set(R,new Set),v.get(R).add(k));
if(S!=="?"&&!S.startsWith("\u2260 "))
for(const R of new Set([q,V]))R!==A&&(d.has(R)||d.set(R,new Set),d.get(R).add(S));
V!==(A||q)&&!x.has(V)&&x.set(V,A||q);

for(const R of D.matchAll(/\{([^}]*)\}/g))
for(const K of R[1].split(";")){
const G=K.trim().match(/^(SX|cls|ecl)\s*(!?=)\s*(.*)$/);
G&&(G[1]==="SX"&&G[2]==="!="?l(c,"SX!= non pris en charge."):m(V,G[1],G[3],G[2]))
}
$({date:w(b,T,"",c),from:q,to:V,desc:{"=>":"a un crush sur","<=":"est aim\xE9(e) par","<=>":"sentiments r\xE9ciproques","<!>":"se sont s\xE9par\xE9s"}[Z[2]],notes:J.join(" \xB7 "),raw:(y?y[0]:"")+D})
}else D&&($({date:w(b,T,"",c),from:A||"?",to:"",desc:"Relation non interpr\xE9t\xE9e",notes:J.join(" \xB7 "),raw:D}),l(c,"relation attendue : NOM.N<signe>XXX.X. Les actions vont dans les crochets."));

for(const R of h.matchAll(/\[([^\]]*)\]/g)){
const K=[];
let G=0,xe=0;
for(let Q=0;Q<R[1].length;Q++){
let _=R[1][Q];
_==="{"&&xe++,_==="}"&&(xe=Math.max(0,xe-1)),_===";"&&xe===0&&(K.push(R[1].slice(G,Q)),G=Q+1)
}
K.push(R[1].slice(G));
for(const Q of K){
if(!Q.trim())continue;
let _=Q.trim(),ge=_.match(/^M(\?|\d{1,2})(?:\s*:\s*|\s+(?=J\d))/),De=ge?ge[1]:T;
ge&&(_=_.slice(ge[0].length));
let me=_.match(/^J(\d{1,2})\s*:\s*/);
me&&(_=_.slice(me[0].length));
let Me=f(_),te=r(_),Se=te.indexOf("|");
Se>=0&&(Me.push("Pendant : "+te.slice(Se+1).trim()),te=te.slice(0,Se).trim());
let le=te.match(new RegExp("^("+B+")\\s*([a-z]{3,})(.*)$")),Ee="",re="",ue="";

if(le?(Ee=le[1],re=le[2],ue=le[3].trim(),p(Ee)):/^wht[XV]?$/.test(te)&&q&&(Ee=q,re="wht",ue=te.slice(3)),le||re){
let he="",ne=ue,ke=ue.match(new RegExp("("+B+")$"));
ke&&(he=ke[1],ne=ue.slice(0,-ke[0].length).trim(),p(he));
let de=He[re]||"Verbe : "+re;
re==="wht"&&(de="d\xE9clare ses sentiments",ne==="X"?(de+=" \u2014 refus\xE9",ne=""):ne==="V"&&(de+=" \u2014 accept\xE9",ne=""),he||(he=V)),ne&&(de+=" \u2014 "+ne),
$({date:w(b,De,me?.[1]||"",c),from:Ee,desc:de,to:he||"\u2014",notes:Me.join(" \xB7 "),raw:"["+Q.trim()+"]"})
}else $({date:w(b,De,me?.[1]||"",c),from:"?",desc:"\xC9v\xE9nement non interpr\xE9t\xE9",to:"",notes:Me.join(" \xB7 "),raw:"["+Q.trim()+"]"}),l(c,"\xE9v\xE9nement attendu : [Mx: NOM.Nverbe\u2026].")
}
}
for(const[R,K]of[["[","]"],["{","}"]])
h.split(R).length!==h.split(K).length&&l(c,"d\xE9limiteurs "+R+K+" non \xE9quilibr\xE9s.")
});

U>0&&e.push("Balise <x> non ferm\xE9e : ajoute </x>.");
const i=new Set;
function s(n,a=new Set){
if(i.has(n)||a.has(n))return;
a.add(n);
const c=x.get(n);
if(c){
s(c,a);
const h=p(n),g=p(c);
M.has(n+":SX")||(h.SX=g.SX==="M"?"F":g.SX==="F"?"M":"?")
}
i.add(n)
}
for(const n of x.keys())s(n);
for(const[n,a]of d)M.has(n+":cls")||(p(n).cls=[...a]);
for(const[n,a]of v)M.has(n+":ecl")||(p(n).ecl=[...a]);
return{people:[...o.values()],events:u,warnings:e}
}

const we=10*1024*1024;

const ee=(()=>{
function t(){throw Error("Donn\xE9es compress\xE9es invalides ou tronqu\xE9es.")}

class o{
constructor(){this.data=[],this.acc=0,this.n=0}
bit(l){this.acc=this.acc*2+l,++this.n===8&&(this.data.push(this.acc),this.acc=this.n=0)}
finish(){return this.n&&this.data.push(this.acc*2**(8-this.n)),Uint8Array.from(this.data)}
}

class u{
constructor(l){this.data=l,this.pos=0}
bit(){
const l=this.pos++;
return l>=this.data.length*8+32&&t(),l<this.data.length*8?this.data[l>>>3]>>>7-(l&7)&1:0
}
}

class e{
constructor(){this.low=0,this.high=4294967295,this.pending=0,this.out=new o,this.decoding=!1}
emit(l){for(this.out.bit(l);this.pending;)this.out.bit(1-l),this.pending--}
code(l,m,f){
0<=l&&l<m&&m<=f&&f<=32768||t();
const r=this.high-this.low+1;
for(this.high=this.low+Math.floor(r*m/f)-1,this.low+=Math.floor(r*l/f);;){
if(this.high<2147483648)this.emit(0);
else if(this.low>=2147483648)this.emit(1),this.low-=2147483648,this.high-=2147483648;
else if(this.low>=1073741824&&this.high<3*1073741824)this.pending++,this.low-=1073741824,this.high-=1073741824;
else break;
this.low*=2,this.high=this.high*2+1
}
}
finish(){return this.pending++,this.emit(this.low<1073741824?0:1),this.out.finish()}
}

class x{
constructor(l){
this.low=0,this.high=4294967295,this.src=new u(l),this.value=0,this.decoding=!0;
for(let m=0;m<32;m++)this.value=this.value*2+this.src.bit()
}
target(l){
return(l<1||l>32768||this.value<this.low||this.value>this.high)&&t(),
Math.floor(((this.value-this.low+1)*l-1)/(this.high-this.low+1))
}
consume(l,m,f){
const r=this.high-this.low+1;
for(this.high=this.low+Math.floor(r*m/f)-1,this.low+=Math.floor(r*l/f);;){
if(!(this.high<2147483648))
if(this.low>=2147483648)this.low-=2147483648,this.high-=2147483648,this.value-=2147483648;
else if(this.low>=1073741824&&this.high<3*1073741824)this.low-=1073741824,this.high-=1073741824,this.value-=1073741824;
else break;
this.low*=2,this.high=this.high*2+1,this.value=this.value*2+this.src.bit()
}
}
}

class d{
constructor(l){this.order=l,this.contexts=new Map,this.history=""}
*distributions(){
const l=new Set;
for(let f=Math.min(this.history.length,this.order);f>=0;f--){
const r=this.contexts.get(f?this.history.slice(-f):"");
if(!r)continue;
const w=[...r.counts].filter(([i])=>!l.has(i)).sort((i,s)=>i[0]-s[0]);
if(w.length){
w.push([256,w.length]),yield w;
for(const i of r.counts.keys())l.add(i)
}
}
const m=[];
for(let f=0;f<256;f++)l.has(f)||m.push([f,1]);
yield m
}
update(l){
for(let m=Math.min(this.history.length,this.order);m>=0;m--){
const f=m?this.history.slice(-m):"";
let r=this.contexts.get(f);
if(r||(r={counts:new Map,total:0},this.contexts.set(f,r)),r.counts.set(l,(r.counts.get(l)||0)+1),r.total++,r.total>=8192){
r.total=0;
for(const[w,i]of r.counts){
const s=Math.ceil(i/2);
r.counts.set(w,s),r.total+=s
}
}
}
this.history=this.order?(this.history+String.fromCharCode(l)).slice(-this.order):""
}
}

function v(p,l,m){
for(const f of p.distributions()){
let r=0;
for(const[,i]of f)r+=i;
let w=0;
if(l.decoding){
const i=l.target(r);
let s=-1;
for(const[n,a]of f){
if(i<w+a){l.consume(w,w+a,r),s=n;break}
w+=a
}
if(s<0&&t(),s!==256)return s
}else{
const i=f.some(([n])=>n===m)?m:256;
let s=!1;
for(const[n,a]of f){
if(n===i){l.code(w,w+a,r),s=!0;break}
w+=a
}
if(s||t(),i!==256)return m
}
}
t()
}

function M(p,l){
const m=new d(l),f=new e;
for(const r of p)v(m,f,r),m.update(r);
return f.finish()
}

function A(p,l,m){
const f=new d(m),r=new x(p),w=new Uint8Array(l);
for(let i=0;i<l;i++){
const s=v(f,r);
w[i]=s,f.update(s)
}
return w
}

class S{
constructor(l){this.coder=l,this.counts=new Map}
bit(l,m=0){
let f=this.counts.get(l);
f||(f=[1,1],this.counts.set(l,f));
const r=f[0]+f[1];
return this.coder.decoding?(m=this.coder.target(r)>=f[0]?1:0,this.coder.consume(m?f[0]:0,m?r:f[0],r)):this.coder.code(m?f[0]:0,m?r:f[0],r),
f[m]++,f[0]+f[1]>=1024&&(f[0]=Math.ceil(f[0]/2),f[1]=Math.ceil(f[1]/2)),m
}
integer(l,m){
if(this.coder.decoding){
let r=0;
for(;this.bit(l+"e"+r);)++r>26&&t();
let w=1;
for(let i=r-1;i>=0;i--)w=w*2+this.bit(l+"m"+r+":"+i);
return w
}
const f=Math.floor(Math.log2(m));
for(let r=0;r<f;r++)this.bit(l+"e"+r,1);
this.bit(l+"e"+f,0);
for(let r=f-1;r>=0;r--)this.bit(l+"m"+f+":"+r,m>>>r&1)
}
}

function k(p){
const l=new Map,m=new Array(p.length);
function f(r){return p[r]*65536+p[r+1]*256+p[r+2]}
for(let r=0;r+2<p.length;r++){
const w=f(r);
let i=l.get(w);
i||(i=[],l.set(w,i)),i.push(r)
}
return r=>{
if(m[r])return m[r];
const w=[];
if(m[r]=w,r+2>=p.length)return w;
const i=l.get(f(r));
let s=0,n=i.length;
for(;s<n;){
const h=s+n>>>1;
i[h]<r?s=h+1:n=h
}
let a=2;
const c=Math.min(4096,p.length-r);
for(let h=s-1;h>=Math.max(0,s-256);h--){
const g=i[h];
let y=3;
for(;y<c&&p[g+y]===p[r+y];)y++;
if(y>a&&(w.push([y,r-g]),a=y),a===c)break
}
return w
}
}

function P(p,l){
const m=k(p),f=[];
if(!l){
for(let s=0;s<p.length;){
const n=m(s),a=s+1<p.length?m(s+1):[];
if(n.length&&!(a.length&&a[a.length-1][0]>n[n.length-1][0]+1)){
const c=n[n.length-1];
f.push(c),s+=c[0]
}else f.push(p[s]),s++
}
return f
}
const r=new Float64Array(p.length+1),w=new Array(p.length),i=new Uint32Array(256);
for(const s of p)i[s]++;
for(let s=p.length-1;s>=0;s--){
let n=r[s+1]+1+Math.log2(p.length/i[p[s]]),a=p[s];
for(const[c,h]of m(s))
for(let g=3;g<=c;g++){
const y=r[s+g]+2+Math.log2(g-2)*1.1+Math.log2(h)*.9;
y<n&&(n=y,a=[g,h])
}
r[s]=n,w[s]=a
}
for(let s=0;s<p.length;){
const n=w[s];
f.push(n),s+=Array.isArray(n)?n[0]:1
}
return f
}

function U(p,l,m){
const f=new e,r=new S(f),w=new d(l);
let i=0,s=0,n=[];
for(const a of P(p,m)){
const c=Array.isArray(a)?1:0;
if(r.bit("match"+i,c),!c)v(w,f,a),w.update(a),s++;
else{
const[h,g]=a;
r.integer("len",h-2);
const y=n.indexOf(g);
if(r.bit("rep",y<0?0:1),y>=0){
for(let b=0;b<n.length-1&&(r.bit("ri"+b,b===y?1:0),b!==y);b++);
n.splice(y,1)
}else r.integer("dist",g);
n.unshift(g),n=n.slice(0,4);
for(let b=0;b<h;b++)w.update(p[s++])
}
i=c
}
return f.finish()
}

function C(p,l,m){
const f=new x(p),r=new S(f),w=new d(m),i=new Uint8Array(l);
let s=0,n=0,a=[];
for(;n<l;){
const c=r.bit("match"+s);
if(c){
const h=r.integer("len")+2,g=r.bit("rep");
let y;
if(g){
a.length||t();
let b=a.length-1;
for(let T=0;T<a.length-1;T++)
if(r.bit("ri"+T)){b=T;break}
y=a[b],a.splice(b,1)
}else y=r.integer("dist");
(y<1||y>n||h>l-n)&&t(),a.unshift(y),a=a.slice(0,4);
for(let b=0;b<h;b++){
const T=i[n-y];
i[n++]=T,w.update(T)
}
}else{
const h=v(w,f);
i[n++]=h,w.update(h)
}
s=c
}
return i
}

const X=()=>new Promise(p=>setTimeout(p,0));

async function B(p){
let l={mode:0,data:p};
const m=(r,w)=>{w.length<l.data.length&&(l={mode:r,data:w})};
for(const r of[2,3,4])m(r,M(p,r)),await X();
const f=p.length<=4096?[0,1]:[0];
for(const r of[0,1])
for(const w of f)m(16+r,U(p,r,w)),await X();
return l
}

function $(p,l,m){
if((l<0||l>16384)&&t(),m===0)return p.length!==l&&t(),p;
if([2,3,4].includes(m))return A(p,l,m);
if(m===16||m===17)return C(p,l,m-16);
t()
}

return{best:B,unpack:$,CHUNK:16384,ppmEncode:M,ppmDecode:A,lzEncode:U,lzDecode:C}
})();

const Le=(()=>{
const t=["?","SX=","cls","ecl","=>","<=","<=>","<!>","<x>","</x>","~~~","{","}","[","]",";"],
o=/SX=|cls!?=|ecl!?=|<=>|<!>|=>|<=|<\/x>|<x>|~~~|[?{}\[\];]/g,
u=new TextEncoder;

function e(i="Fichier CRSH endommag\xE9."){throw Error(i)}

function x(...i){
let s=i.reduce((c,h)=>c+h.length,0),n=new Uint8Array(s),a=0;
for(const c of i)n.set(c,a),a+=c.length;
return n
}

function d(i){
const s=[];
for(;i>=128;)s.push(i&127|128),i=Math.floor(i/128);
return s.push(i),Uint8Array.from(s)
}

class v{
constructor(s){this.bytes=s,this.i=0}
take(s){
(s<0||this.i+s>this.bytes.length)&&e();
const n=this.bytes.subarray(this.i,this.i+s);
return this.i+=s,n
}
byte(){return this.take(1)[0]}
integer(){
let s=0;
for(let n=0;n<5;n++){
let a=this.byte();
if(s+=(a&127)*2**(7*n),a<128)return s
}
e()
}
}

const M=Uint32Array.from({length:256},(i,s)=>{
for(let n=0;n<8;n++)s=s>>>1^(s&1?3988292384:0);
return s>>>0
});

function A(i){
let s=4294967295;
for(const n of i)s=s>>>8^M[(s^n)&255];
return(s^4294967295)>>>0
}

function S(i){
let s=new Uint8Array(4);
return new DataView(s.buffer).setUint32(0,i,!0),s
}

function k(i){
let s=[];
for(let n=0;n<i.length;n+=8192)s.push(String.fromCharCode(...i.subarray(n,n+8192)));
return s.join("")
}

class C{
constructor(){this.bits=[]}
put(s,n){this.bits.push(s.toString(2).padStart(n,"0"))}
integer(s){for(const n of d(s))this.put(n,8)}
finish(){
let s=this.bits.join(""),n=new Uint8Array(Math.ceil(s.length/8));
for(let a=0;a<s.length;a++)s[a]==="1"&&(n[a>>3]|=1<<7-(a&7));
return x(d(s.length),n)
}
}

class X{
constructor(s){
const n=new v(s);
this.length=n.integer(),this.length>10485760*24&&e(),this.data=n.take(Math.ceil(this.length/8)),this.i=0,
n.i!==s.length&&e(),this.length%8&&this.data.at(-1)&(1<<8-this.length%8)-1&&e()
}
get(s){
this.i+s>this.length&&e();
let n=0;
for(let a=0;a<s;a++,this.i++)n=n*2+(this.data[this.i>>3]>>7-(this.i&7)&1);
return n
}
integer(){
let s=0;
for(let n=0;n<5;n++){
let a=this.get(8);
if(s+=(a&127)*2**(7*n),a<128)return s
}
e()
}
}

function B(i,s){
s.put(0,2),s.integer(i.length);
let n=!0;
for(let a=0;a<i.length;a++){
let c=i[a];
if(c>=65&&c<=90||c>=97&&c<=122){
const h=c<=90;
if(h!==n){
if(n&&!h&&(a+1===i.length||i[a+1]<97||i[a+1]>122)){s.put(27,5),s.put(c-97,5);continue}
s.put(h?29:28,5),n=h
}
s.put(c-(n?65:97),5)
}else c===32?s.put(26,5):c===10?s.put(30,5):(s.put(31,5),s.put(c,8))
}
s.put(0,2)
}

function $(i){
let s=new C,n=[...k(i).matchAll(o)],a=0,c=0;
for(;a<n.length;){
let h=n[a];
h.index>c&&B(i.subarray(c,h.index),s);
let g=[h];
for(a++;a<n.length&&n[a].index===g.at(-1).index+g.at(-1)[0].length;)g.push(n[a++]);
s.put(3,2),s.integer(g.length);
for(const y of g){
let b=y[0];
b.startsWith("cls")||b.startsWith("ecl")?(s.put(b.startsWith("cls")?2:3,4),s.put(b.includes("!")?0:1,1)):s.put(t.indexOf(b),4)
}
s.put(3,2),c=g.at(-1).index+g.at(-1)[0].length
}
return c<i.length&&B(i.subarray(c),s),s.finish()
}

function p(i,s){
let n=new X(i),a=new Uint8Array(s),c=0;
function h(g){c>=s&&e(),a[c++]=g}
for(;n.i<n.length;){
let g=n.get(2);
if(g===0){
let y=n.integer(),b=!0;
y>s-c&&e();
let T=c+y;
for(;c<T;){
let D=n.get(5);
if(D<26)h(D+(b?65:97));
else if(D===26)h(32);
else if(D===27){
let J=n.get(5);
J>25&&e(),h(J+97)
}else D===28?b=!1:D===29?b=!0:h(D===30?10:n.get(8))
}
n.get(2)!==0&&e()
}else if(g===3){
let y=n.integer();
y>s-c&&e();
for(let b=0;b<y;b++){
let T=n.get(4),D=t[T];
(T===2||T===3)&&(D+=n.get(1)?"=":"!=");
for(const J of u.encode(D))h(J)
}
n.get(2)!==3&&e()
}else e()
}
return c!==s&&e(),a
}

function l(i,s,n){
return x(Uint8Array.of(74,74,67,49,n),d(i.length),S(A(i)),d(s.length),s)
}

async function m(i){
if(i.length<=ee.CHUNK){
const c=await ee.best(i);
return l(i,c.data,c.mode)
}
const s=[];
for(let c=0;c<i.length;c+=ee.CHUNK){
const h=i.subarray(c,c+ee.CHUNK),g=await ee.best(h);
s.push(d(h.length),Uint8Array.of(g.mode),d(g.data.length),g.data)
}
const n=l(i,x(...s),32),a=l(i,i,0);
return n.length<a.length?n:a
}

async function f(i,s=!1){
return i.length>10485760&&e("Maximum 10 Mo de texte."),
s?(i.length>262144&&e("Les blocs personnalis\xE9s sont limit\xE9s \xE0 256 Kio."),l(i,await m($(i)),64)):m(i)
}

function r(i,s,n=0){
const a=new v(i);
k(a.take(4))!=="JJC1"&&e("Ancien format ou format inconnu : seul le nouveau format JJC1 est accept\xE9.");
const c=a.byte(),h=a.integer();
h>s&&e("Taille d\xE9compress\xE9e excessive.");
const g=a.take(4),y=new DataView(g.buffer,g.byteOffset,4).getUint32(0,!0),b=a.integer(),T=a.take(b);
a.i!==i.length&&e("Fichier tronqu\xE9 ou donn\xE9es suppl\xE9mentaires.");
let D;
if(c===0)T.length!==h&&e(),D=T;
else if(c===32){
D=new Uint8Array(h);
const J=new v(T);
let Z=0;
for(;Z<h;){
const q=J.integer(),V=J.byte(),R=J.integer();
(q<1||q>ee.CHUNK||q>h-Z)&&e();
const K=ee.unpack(J.take(R),q,V);
D.set(K,Z),Z+=q
}
J.i!==T.length&&e()
}else c===64?((n||h>262144)&&e(),D=p(r(T,h*4+1024,n+1),h)):D=ee.unpack(T,h,c);
return(D.length!==h||A(D)!==y)&&e("Contr\xF4le d\u2019int\xE9grit\xE9 incorrect : fichier endommag\xE9."),D
}

function w(i){return r(i,10485760)}
return{compress:f,decompress:w,blocksEncode:$,blocksDecode:p,crc:A,LIMIT:10485760}
})();

async function qe(t){
const o=new TextEncoder().encode(t),u=await Le.compress(o,E("compressionMode")?.value==="blocks"),e=Le.decompress(u);
if(e.length!==o.length||e.some((x,d)=>x!==o[d]))throw Error("V\xE9rification de compression \xE9chou\xE9e.");
return u
}

async function _e(t,o=!1){
const u=new Uint8Array(t);
if(u.length>we*4+65536)throw Error("Fichier trop volumineux.");
const e=String.fromCharCode(...u.subarray(0,4));
if(e==="JJC1")return{text:new TextDecoder("utf-8",{fatal:!0,ignoreBOM:!0}).decode(Le.decompress(u)),binary:!0};
if(o||e==="CRSH"||/^CRP[0-9]$/.test(e)||/^JJC[0-9]$/.test(e))throw Error("Ancien format ou format inconnu : seul le nouveau format JJC1 est accept\xE9.");
if(u.length>we)throw Error("Maximum 10 Mo de texte.");
const x=new TextDecoder("utf-8",{fatal:!0,ignoreBOM:!0}).decode(u);
if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(x))throw Error("Ce fichier ne contient pas de texte UTF-8.");
return{text:x,binary:!1}
}

function se(t,o=E("source").value){
let u=o.replace(/^\uFEFF/,"").split(/\r?\n/)[0].trim().replace(/\.(crsh|txt|pdf)$/i,"");
return u=u.replace(/[<>:"/\\|?*\x00-\x1f]/g,"_").replace(/[. ]+$/,"").slice(0,120),
u||(u="mon_fichier"),
/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(u)&&(u="_"+u),
u+"."+t
}

function Ne(t){
const o=new TextEncoder,u=[];
let e=0;
const x=[0],d=2+t.length*3,
v=S=>{
const k=typeof S=="string"?o.encode(S):S;
u.push(k),e+=k.length
},
M=(S,k)=>{
x[S]=e;
v(S+` 0 obj
`+k+`
endobj
`)
};

v(`%PDF-1.4
`);
M(1,"<< /Type /Catalog /Pages 2 0 R >>");
M(2,"<< /Type /Pages /Count "+t.length+" /Kids ["+t.map((S,k)=>3+k*3+" 0 R").join(" ")+"] >>");

t.forEach((S,k)=>{
const P=3+k*3,U=P+1,C=P+2;
M(P,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 "+U+" 0 R >> >> /Contents "+C+" 0 R >>");
x[U]=e;
v(U+` 0 obj
<< /Type /XObject /Subtype /Image /Width 1684 /Height 1190 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length `+S.length+` >>
stream
`);
v(S);
v(`
endstream
endobj
`);
const X="q 842 0 0 595 0 0 cm /Im0 Do Q";
M(C,"<< /Length "+o.encode(X).length+` >>
stream
`+X+`
endstream`)
});

const A=e;
v(`xref
0 `+(d+1)+`
0000000000 65535 f 
`);
for(let S=1;S<=d;S++)v(String(x[S]).padStart(10,"0")+` 00000 n 
`);
return v(`trailer
<< /Size `+(d+1)+` /Root 1 0 R >>
startxref
`+A+`
%%EOF`),
new Blob(u,{type:"application/pdf"})
}

function We(){
const{people:t,events:o}=Ge(),u=document.createElement("canvas");
u.width=1684,u.height=1190;
const e=u.getContext("2d");
if(!e)throw Error("Dessin du PDF indisponible.");
const x=[];
let d=0,v=0;

function M(){
const C=atob(u.toDataURL("image/jpeg",.94).split(",")[1]);
x.push(Uint8Array.from(C,X=>X.charCodeAt(0)))
}

function A(){
v&&M(),v++,e.fillStyle="#fff",e.fillRect(0,0,1684,1190),
e.fillStyle="#49286c",e.font="bold 32px sans-serif",e.fillText(se("pdf").slice(0,-4),45,48),
e.font="20px sans-serif",e.fillText("CRSH Studio \xB7 "+v,1400,48),d=85
}

function S(C,X){
const B=[];
for(const $ of String(C||"\u2014").split(`
`)){
let p="";
for(const l of $)p&&e.measureText(p+l).width>X&&(B.push(p),p=""),p+=l;
B.push(p||"")
}
return B
}

function k(C,X,B={}){
e.font=(B.header?"bold ":"")+"20px sans-serif";
const $=C.map((m,f)=>S(Array.isArray(m)?m.map(r=>"\u2022 "+r).join(`
`):m,X[f]-18));
let p=0,l=Math.max(...$.map(m=>m.length));
for(;p<l;){
d+42>1145&&A();
const m=Math.max(1,Math.floor((1145-d-16)/26)),f=Math.min(l-p,m),r=f*26+16;
e.fillStyle=B.header?"#eee7f7":B.uncertain?"#fff8e5":"#fff",
e.fillRect(45,d,1594,r);
let w=45;
e.font=(B.header?"bold ":"")+"20px sans-serif",e.fillStyle=B.struck?"#776b80":"#292239";
$.forEach((i,s)=>{
i.slice(p,p+f).forEach((n,a)=>{
const c=d+26+a*26;
e.fillText(n,w+8,c);
B.struck&&(e.beginPath(),e.moveTo(w+8,c-7),e.lineTo(w+8+e.measureText(n).width,c-7),e.strokeStyle="#776b80",e.stroke())
});
w+=X[s]
});
e.strokeStyle="#ded6e6",e.beginPath(),e.moveTo(45,d+r),e.lineTo(1639,d+r),e.stroke(),d+=r,p+=f
}
}

A();
k(["Personnes"],[1594],{header:!0});
k(["Identifiant","Sexe","\xC9coles","Classes","Informations"],[190,100,380,300,624],{header:!0});
for(const C of t)k([C.id,C.SX,C.ecl,C.cls,C.info],[190,100,380,300,624]);
d+=24;
k(["Relations et \xE9v\xE9nements"],[1594],{header:!0});
let P=null;
const U=[175,145,330,145,280,519];
for(const C of o){
P!==C.context.section&&(k([C.context.person+" \xB7 Classe : "+C.context.cls+" \xB7 \xC9cole : "+C.context.ecl],[1594],{header:!0}),k(["Date","De","Description","Vers","Pr\xE9cisions","Notation"],U,{header:!0}),P=C.context.section);
k([C.date,C.from,C.desc,C.to,C.notes,C.raw],U,C)
}
return M(),Ne(x)
}

const E=t=>document.getElementById(t),Ie="http://www.w3.org/2000/svg";
let fe="",ae="",H={people:[],events:[],warnings:[]},j={people:[],events:[]},pe=!1,I=new Map,L={x:0,y:0,w:1100,h:650},Y="",Ke="overview",W=null;
const Te=["a un crush sur","est aim\xE9(e) par","sentiments r\xE9ciproques","se sont s\xE9par\xE9s"],be=t=>Te.includes(t.desc);

function F(t,o,u){
const e=document.createElement(t);
return o!==void 0&&(e.textContent=o),u&&(e.className=u),e
}

function N(t,o={},u){
const e=document.createElementNS(Ie,t);
for(const[x,d]of Object.entries(o))e.setAttribute(x,String(d));
return u!==void 0&&(e.textContent=u),e
}

function z(t){E("status").textContent=t}
function Ge(){return j}

function Re(t){
return t.flat().join(" ").toLocaleLowerCase().includes(E("filter").value.toLocaleLowerCase())
}

function Xe(t,o,u){
const e=E(t),x=e.value;
e.replaceChildren(new Option(u,""));
for(const d of new Set(o))e.add(new Option(d,d));
e.value=[...e.options].some(d=>d.value===x)?x:""
}

function Fe(){
pe=E("source").value!==fe;
E("documentStatus").replaceChildren(F("span",ae||"Sans titre"),F("br"),F("span",pe?"Modifications non enregistr\xE9es":"100 % local \xB7 hors ligne"));
E("byteCount").textContent=new TextEncoder().encode(E("source").value).length.toLocaleString("fr-FR")+" octets";
document.title=(pe?"\u2022 ":"")+"CRSH Studio"
}

function Qe(){
const t=H.events.filter(e=>Re([e.date,e.from,e.desc,e.to,e.notes,e.raw,e.context.person,e.context.cls,e.context.ecl])&&(!E("classFilter").value||e.context.cls===E("classFilter").value)&&(!E("schoolFilter").value||e.context.ecl===E("schoolFilter").value)&&(E("uncertain").checked||!e.uncertain)&&(E("struck").checked||!e.struck)),
o=new Set(t.flatMap(e=>[e.from,e.to])),
u=E("classFilter").value||E("schoolFilter").value;
return{people:H.people.filter(e=>(Re([e.id,e.SX,e.cls,e.ecl,e.info])||o.has(e.id))&&(!u||o.has(e.id))),events:t}
}

function ce(t=!0){
t&&(H=Ve(E("source").value),Xe("classFilter",H.events.map(e=>e.context.cls),"Toutes les classes"),Xe("schoolFilter",H.events.map(e=>e.context.ecl),"Toutes les \xE9coles"));
j=Qe(),Fe();
const o=j.events.filter(be);
E("personCount").textContent=j.people.length,
E("relationCount").textContent=o.length,
E("eventCount").textContent=j.events.length-o.length,
E("welcome").hidden=H.people.length>0||H.events.length>0,
E("bars").replaceChildren();
const u=Math.max(1,...Te.map(e=>o.filter(x=>x.desc===e).length));

for(const[e,x]of Te.entries()){
const d=o.filter(S=>S.desc===x).length,v=F("div",void 0,"barrow"),M=F("div",void 0,"track"),A=F("div",void 0,"fill");
A.style.width=100*d/u+"%",
A.style.background=["var(--accent)","var(--accent)","var(--green)","var(--pink)"][e];
M.append(A),v.append(F("span",x),M,F("b",String(d))),E("bars").append(v)
}

E("quality").textContent=j.events.filter(e=>e.uncertain).length+" lignes incertaines / blagues \xB7 "+j.events.filter(e=>e.struck).length+" lignes barr\xE9es";
E("warnings").textContent=H.warnings.join(`
`);
E("parseStatus").textContent=H.warnings.length?H.warnings.length+" avertissement(s)":E("source").value?"\u2713 Notation reconnue":"\xC9diteur vide";
Ye(),Ze(),nt(),oe(),Y&&Ce(Y)
}

function Ue(t,o){
const u=F("td");
if(Array.isArray(o))
if(o.length){
const e=F("ul");
for(const x of o)e.append(F("li",x));
u.append(e)
}else u.textContent="\u2014";
else u.textContent=o||"\u2014";
t.append(u)
}

function Ye(){
const t=E("people");
t.replaceChildren();
for(const e of j.people){
const x=F("tr");
x.dataset.person=e.id;
for(const d of[e.id,e.SX,e.ecl,e.cls,e.info.join(" \xB7 ")])Ue(x,d);
x.onclick=()=>Ce(e.id),t.append(x)
}
if(!j.people.length){
const e=F("tr"),x=F("td","Aucune personne \xE0 afficher");
x.colSpan=5,e.append(x),t.append(e)
}

const o=E("events");
o.replaceChildren();
let u=null;
for(const[e,x]of j.events.entries()){
if(u!==x.context.section){
const v=F("tr",void 0,"context"),M=F("th",x.context.person+" \xB7 Classe : "+x.context.cls+" \xB7 \xC9cole : "+x.context.ecl);
M.colSpan=6,v.append(M),o.append(v),u=x.context.section
}
const d=F("tr",void 0,[x.struck?"struck":"",x.uncertain?"uncertain":""].join(" "));
d.dataset.event=e;
for(const v of[x.date,x.from,x.desc,x.to,x.notes,x.raw])Ue(d,v);
d.onclick=()=>ye(x),o.append(d)
}
if(!j.events.length){
const e=F("tr"),x=F("td","Aucune relation ou \xE9v\xE9nement \xE0 afficher");
x.colSpan=6,e.append(x),o.append(e)
}
E("peopleTitle").textContent="Personnes \xB7 "+j.people.length;
E("eventsTitle").textContent="Relations et \xE9v\xE9nements \xB7 "+j.events.length
}

function Ze(){
E("timelineCards").replaceChildren();
for(const t of j.events.slice(0,500)){
const o=F("article",void 0,"timelinecard"+(t.struck?" struck":"")+(t.uncertain?" uncertain":""));
o.append(F("small",t.date+" \xB7 "+t.context.cls+" \xB7 "+t.context.ecl),F("h3",t.from+" "+t.desc+" "+(t.to==="\u2014"?"":t.to)),F("p",t.notes||t.raw));
o.onclick=()=>ye(t),E("timelineCards").append(o)
}
j.events.length||E("timelineCards").append(F("div","Aucun \xE9v\xE9nement pour ces filtres.","empty"));
j.events.length>500&&E("timelineCards").append(F("p","500 premi\xE8res lignes affich\xE9es ici. Pr\xE9cise les filtres pour en voir d\u2019autres.","muted"))
}

function Ce(t){
const o=H.people.find(e=>e.id===t);
if(!o)return;
Y=t;
const u=H.events.filter(e=>be(e)&&(e.from===t||e.to===t));
E("details").textContent=o.id+" \xB7 Sexe : "+o.SX+`
Classes : `+(o.cls.join(", ")||"?")+" \xB7 \xC9coles : "+(o.ecl.join(", ")||"?")+`
`+u.length+" relations dans le fichier"+(o.info.length?`
`+o.info.join(" \xB7 "):"");
oe()
}

function ye(t){
E("details").textContent=t.date+" \xB7 "+t.from+" "+t.desc+" "+t.to+`
Classe : `+t.context.cls+" \xB7 \xC9cole : "+t.context.ecl+(t.notes?`
`+t.notes:"")+`
`+t.raw
}

let $e="side";
const je=document.querySelector(".editor"),et=document.querySelector(".workspace");

function tt(t){
t!==$e&&(t==="page"?(E("editHost").append(je),document.body.classList.add("editor-page")):(et.prepend(je),document.body.classList.remove("editor-page")),$e=t)
}

function ve(t){
t!=="editpage"&&document.fullscreenElement&&document.exitFullscreen&&document.exitFullscreen().catch(()=>{});
tt(t==="editpage"?"page":"side"),Ke=t;
for(const o of document.querySelectorAll("[data-tab]")){
const u=o.dataset.tab===t;
o.classList.toggle("active",u),o.setAttribute("aria-selected",String(u))
}
for(const o of document.querySelectorAll(".pane"))o.hidden=o.id!==t
}

function nt(){
const t=j.people.map(u=>u.id),o=I;
I=new Map;
for(const[u,e]of t.entries()){
const x=u*2*Math.PI/Math.max(1,t.length)-Math.PI/2,d=t.length>1?Math.max(140,t.length*22):0;
I.set(e,o.get(e)||{x:550+Math.cos(x)*d,y:310+Math.sin(x)*d})
}
for(const u of j.events.filter(be))
for(const e of[u.from,u.to])I.has(e)||I.set(e,{x:250+I.size*70,y:300})
}

function oe(){
const t=E("network");
t.replaceChildren(),t.setAttribute("viewBox",`${L.x} ${L.y} ${L.w} ${L.h}`);
const o=N("defs");
for(const[e,x]of Object.entries({crush:"#b29aff",mutual:"#65dcbc",split:"#f092b8",struck:"#9aa7c1"})){
const d=N("marker",{id:"arrow-"+e,viewBox:"0 0 10 10",refX:8,refY:5,markerWidth:7,markerHeight:7,orient:"auto-start-reverse"});
d.append(N("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:x})),o.append(d)
}

t.append(o,N("rect",{x:L.x,y:L.y,width:L.w,height:L.h,fill:"#101625"}));
t.append(N("text",{x:L.x+L.w*.02,y:L.y+L.h*.045,fill:"#9aa7c1","font-size":L.w*.013,"font-family":"sans-serif"},"CRSH STUDIO \xB7 Historique des relations"));
if(!I.size){
t.append(N("text",{x:550,y:300,fill:"#9aa7c1","font-size":20,"text-anchor":"middle","font-family":"sans-serif"},"Ouvre un fichier pour afficher le graphe."));
return
}

const u=new Map;
for(const e of j.events.filter(be)){
const x=[e.from,e.to].sort().join("|");
u.has(x)||u.set(x,[]),u.get(x).push(e)
}

for(const e of u.values())
for(const[x,d]of e.entries()){
let v=I.get(d.from),M=I.get(d.to);
if(!v||!M)continue;
d.desc==="est aim\xE9(e) par"&&([v,M]=[M,v]);
const A=d.struck?"struck":d.desc==="sentiments r\xE9ciproques"?"mutual":d.desc==="se sont s\xE9par\xE9s"?"split":"crush",
S={crush:"#b29aff",mutual:"#65dcbc",split:"#f092b8",struck:"#9aa7c1"}[A],
k=M.x-v.x,P=M.y-v.y,U=Math.hypot(k,P);
let C,X,B,$,p;

if(U<1){
C=`M ${v.x-30} ${v.y-30} C ${v.x-130} ${v.y-160},${v.x+130} ${v.y-160},${v.x+30} ${v.y-30}`,
X=v.x,B=v.y-120,
$={x:v.x+30,y:v.y-30,dx:-100,dy:130},
p={x:v.x-30,y:v.y-30,dx:100,dy:130}
}else{
const r=k/U,w=P/U,i=(x-(e.length-1)/2)*55,
s=v.x+r*55,n=v.y+w*55,a=M.x-r*55,c=M.y-w*55,
h=(s+a)/2-w*i,g=(n+c)/2+r*i;
C=`M ${s} ${n} Q ${h} ${g} ${a} ${c}`,
X=(s+2*h+a)/4,B=(n+2*g+c)/4,
$={x:a,y:c,dx:a-h,dy:c-g},
p={x:s,y:n,dx:s-h,dy:n-g}
}

const l=N("path",{d:C,fill:"none",stroke:S,"stroke-width":Y&&(d.from===Y||d.to===Y)?4:2,"stroke-dasharray":d.uncertain||d.struck?"7 6":"none"});
l.style.cursor="pointer";
l.append(N("title",{},d.date+" : "+d.from+" "+d.desc+" "+d.to));
l.onclick=()=>ye(d),t.append(l);

for(const r of d.desc==="sentiments r\xE9ciproques"?[$,p]:[$]){
const w=Math.hypot(r.dx,r.dy)||1,i=r.dx/w,s=r.dy/w;
t.append(N("polygon",{points:`${r.x},${r.y} ${r.x-i*12-s*5},${r.y-s*12+i*5} ${r.x-i*12+s*5},${r.y-s*12-i*5}`,fill:S}))
}

const m=d.date+(d.uncertain?" ?":"")+(d.struck?" [barr\xE9]":"");
t.append(N("rect",{x:X-m.length*3.8-5,y:B-20,width:m.length*7.6+10,height:20,rx:5,fill:"#101625"}));
const f=N("text",{x:X,y:B-6,fill:S,"font-size":12,"font-family":"sans-serif","text-anchor":"middle","text-decoration":d.struck?"line-through":"none"},m);
f.onclick=()=>ye(d),t.append(f)
}

for(const[e,x]of I){
const d=N("g",{class:"node",transform:`translate(${x.x},${x.y})`,tabindex:0,role:"button","aria-label":"Fiche de "+e,"data-id":e});
d.append(N("circle",{r:49,fill:"#171f33",stroke:e===Y?"#b29aff":"#35425f","stroke-width":e===Y?4:2}));
d.append(N("text",{y:-2,"text-anchor":"middle",fill:"#edf0f9","font-size":15,"font-weight":600,"font-family":"sans-serif"},e));
d.append(N("text",{y:22,"text-anchor":"middle",fill:"#9aa7c1","font-size":11,"font-family":"sans-serif"},H.people.find(v=>v.id===e)?.SX||"?"));
d.onkeydown=v=>{(v.key==="Enter"||v.key===" ")&&(v.preventDefault(),Ce(e))};
t.append(d)
}
}

function Je(){
if(!I.size){L={x:0,y:0,w:1100,h:650},oe();return}
const t=[...I.values()],
o=Math.min(...t.map(M=>M.x))-110,
u=Math.max(...t.map(M=>M.x))+110,
e=Math.min(...t.map(M=>M.y))-130,
x=Math.max(...t.map(M=>M.y))+110,
d=Math.max(u-o,(x-e)*1100/650),
v=d*650/1100;
L={x:(o+u-d)/2,y:(e+x-v)/2,w:d,h:v};
oe()
}

function Ae(t){
const o=E("network").createSVGPoint();
return o.x=t.clientX,o.y=t.clientY,o.matrixTransform(E("network").getScreenCTM().inverse())
}

function Be(t,o={x:L.x+L.w/2,y:L.y+L.h/2}){
const u=Math.max(150,Math.min(15e3,L.w*t)),e=u/L.w;
L={x:o.x-(o.x-L.x)*e,y:o.y-(o.y-L.y)*e,w:u,h:L.h*e};
oe()
}

E("network").addEventListener("pointerdown",t=>{
const o=t.target.closest("[data-id]")?.dataset.id,u=Ae(t);
W={id:o,start:u,camera:{...L},moved:!1};
E("network").setPointerCapture(t.pointerId);
o&&(Y=o,Ce(o))
});

E("network").addEventListener("pointermove",t=>{
if(!W)return;
const o=Ae(t);
Math.hypot(o.x-W.start.x,o.y-W.start.y)>2&&(W.moved=!0);
W.id?(I.set(W.id,{x:o.x,y:o.y}),oe()):(L.x+=W.start.x-o.x,L.y+=W.start.y-o.y,oe())
});

E("network").addEventListener("pointerup",()=>W=null);
E("network").addEventListener("pointercancel",()=>W=null);
E("network").addEventListener("wheel",t=>{
t.preventDefault(),Be(t.deltaY<0?.88:1.12,Ae(t))
},{passive:!1});

function ie(t,o){
const u=URL.createObjectURL(t),e=F("a");
e.href=u,e.download=o;
document.body.append(e),e.click(),e.remove();
setTimeout(()=>URL.revokeObjectURL(u),2e3)
}

async function Pe(){
const t=E("network").cloneNode(!0);
t.setAttribute("xmlns",Ie),t.setAttribute("width","1684"),t.setAttribute("height","1190");
const o=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(t)],{type:"image/svg+xml;charset=utf-8"}));
try{
const u=new Image;
await new Promise((d,v)=>{u.onload=d,u.onerror=()=>v(Error("Impossible de dessiner le graphe.")),u.src=o});
const e=F("canvas");
e.width=1684,e.height=1190;
const x=e.getContext("2d");
return x.fillStyle="#101625",x.fillRect(0,0,1684,1190),x.drawImage(u,0,0,1684,1190),e
}finally{URL.revokeObjectURL(o)}
}

async function st(t){
if(t.size>we)throw Error("Maximum 10 Mo.");
const o=new TextDecoder("utf-8",{fatal:!0,ignoreBOM:!0}).decode(await t.arrayBuffer());
if(o.includes("\0"))throw Error("Ce fichier ne semble pas \xEAtre du texte UTF-8.");
return{bytes:await qe(o),name:se("crsh",o)}
}

function ze(){
return!pe||confirm("Remplacer le texte actuel ? Enregistre tes modifications pour les conserver.")
}

async function Oe(t){
if(!ze())return;
if(t.size>we*4+65536)throw Error("Fichier trop volumineux.");
const o=await _e(await t.arrayBuffer(),/\.crsh$/i.test(t.name));
E("source").value=o.text,fe=o.text,ae=t.name,I.clear(),ce(),Je();
z("Ouvert : "+t.name+(o.binary?" \xB7 binaire d\xE9compress\xE9":" \xB7 texte UTF-8"))
}

function O(t,o){
E(t).onclick=async()=>{
try{await o()}
catch(u){z("Erreur : "+u.message)}
}
}

E("source").addEventListener("input",()=>{ce()});

for(const t of["filter","classFilter","schoolFilter","uncertain","struck"])
E(t).addEventListener(t==="filter"?"input":"change",()=>ce(!1));

for(const t of document.querySelectorAll("[data-tab]"))
t.onclick=()=>ve(t.dataset.tab);

O("new",()=>{
ze()&&(E("source").value="",fe="",ae="",I.clear(),Y="",E("details").textContent="Nouveau document.",ce(),z("Nouveau document vide."))
});

O("save",async()=>{
const t=E("source").value;
z("Compression maison en cours\u2026");
const o=await qe(t);
ae=se("crsh",t);
ie(new Blob([o],{type:"application/octet-stream"}),ae);
fe=t,Fe();
z("T\xE9l\xE9chargement : "+ae+" \xB7 "+o.length+" octets binaires pour "+new TextEncoder().encode(t).length+" octets de texte.")
});

O("textsave",()=>{
ie(new Blob([E("source").value],{type:"text/plain;charset=utf-8"}),se("txt"));
fe=E("source").value,Fe(),z("Texte brut t\xE9l\xE9charg\xE9.")
});

O("pdf",()=>{
ie(We(),se("pdf"));
z("PDF des tableaux t\xE9l\xE9charg\xE9. Les filtres actifs ont \xE9t\xE9 appliqu\xE9s.")
});

O("png",async()=>{
const t=await Pe(),o=await new Promise(u=>t.toBlob(u,"image/png"));
if(!o)throw Error("Image indisponible.");
ie(o,se("png")),z("Image PNG du graphe t\xE9l\xE9charg\xE9e.")
});

O("graphpdf",async()=>{
const t=await Pe(),o=atob(t.toDataURL("image/jpeg",.94).split(",")[1]);
ie(Ne([Uint8Array.from(o,u=>u.charCodeAt(0))]),se("pdf"));
z("PDF du graphe t\xE9l\xE9charg\xE9.")
});

O("fit",Je);
O("zoomIn",()=>Be(.8));
O("zoomOut",()=>Be(1.25));
O("theme",()=>E("source").ownerDocument.body.classList.toggle("light"));

O("resetFilters",()=>{
E("filter").value="",E("classFilter").value="",E("schoolFilter").value="",
E("uncertain").checked=!0,E("struck").checked=!0,ce(!1)
});

E("file").addEventListener("change",async t=>{
try{t.target.files[0]&&await Oe(t.target.files[0])}
catch(o){z("Ouverture impossible : "+o.message)}
finally{t.target.value=""}
});

E("txtconvert").addEventListener("change",async t=>{
try{
const o=t.target.files[0];
if(!o)return;
const u=await st(o);
ie(new Blob([u.bytes],{type:"application/octet-stream"}),u.name);
z("Conversion termin\xE9e : "+u.name)
}catch(o){z("Conversion impossible : "+o.message)}
finally{t.target.value=""}
});

window.addEventListener("beforeunload",t=>{
pe&&(t.preventDefault(),t.returnValue="")
});

window.addEventListener("keydown",t=>{
(t.ctrlKey||t.metaKey)&&(
t.key.toLowerCase()==="s"&&(t.preventDefault(),E("save").click()),
t.key.toLowerCase()==="o"&&(t.preventDefault(),E("file").click()),
t.key.toLowerCase()==="f"&&(t.preventDefault(),E("filter").focus())
)
});

document.body.addEventListener("dragover",t=>{
t.dataTransfer.types.includes("Files")&&(t.preventDefault(),document.body.classList.add("drop"))
});

document.body.addEventListener("dragleave",t=>{
t.relatedTarget||document.body.classList.remove("drop")
});

document.body.addEventListener("drop",async t=>{
t.preventDefault(),document.body.classList.remove("drop");
try{t.dataTransfer.files[0]&&await Oe(t.dataTransfer.files[0])}
catch(o){z(o.message)}
});

E("guideText").textContent=`Aucun exemple n’est chargé au démarrage. Tout est traité sur ton appareil, sans serveur et sans envoi de données.

NOTATION
NOM.N : trois premières lettres du prénom et initiale du nom. NOM.? : nom inconnu.
SX=M ou SX=F : sexe. cls=… : classe. ecl=… : école (facultative).
Chaque cls= et ecl= définit le contexte des lignes suivantes. cls!= et ecl!= indiquent une exclusion.
La personne visée reprend par défaut la classe et l’école du contexte de leur relation. Son sexe est l’inverse du personnage principal si connu. Les informations explicites dans sa fiche ou {SX=…; cls=…; ecl=…} sont prioritaires.

=> : aime ; <= : est aimé(e) par ; <=> : sentiments réciproques ; <!> : séparation.
~~~ avant la date : relation et événements incertains ou blague.
<x>…</x> : contenu barré mais visible, sur une ou plusieurs lignes.

DATES
2025_? ou 2025.? : mois inconnu.
2025/2026_05 ou 2025/6_05 : année incertaine.
2025_05/06 : mois incertain. Les deux incertitudes peuvent se combiner.

ÉVÉNEMENTS
[événement1; événement2] : plusieurs événements dans les mêmes crochets.
M2 J14: ou M2: J14: : 14 février. M?: : mois explicitement inconnu.
Le mois d’un événement remplace celui de la relation pour cet événement seulement.
NOM.NdonCarteXXX.? : NOM.N donne une carte à XXX.?.
tra : travailler ; trv : trouver. Les autres abréviations restent uniques.
Attention : les anciens fichiers qui utilisaient trv pour travailler doivent remplacer ce verbe par tra.
Le complément du verbe est facultatif : NOM.Nrir fonctionne aussi.
wht : déclare ses sentiments ; whtX : refusé ; whtV : accepté.
[M?: whtX] reprend le sujet et le destinataire de la relation.
|… : pendant. {…} : informations facultatives.

VUES ET EXPORTS
La page Éditer agrandit l’éditeur. Sur le côté le remet près des vues. Plein écran masque aussi les barres du navigateur ; Échap permet d’en sortir. Le même éditeur est déplacé, sans copie ni perte de texte.
Le graphe montre l’historique des relations filtrées, pas seulement les sentiments actuels. Déplace les personnes, zoome avec la molette et clique pour les fiches. Clique sur un lien pour ses détails.
La chronologie conserve l’ordre du fichier. Elle affiche les 500 premières lignes filtrées, sans limiter les tableaux ni les exports.
La recherche, les classes, les écoles et les cases Incertains/Barrés filtrent les vues et le PDF.
Le nom des téléchargements vient de la première ligne de l’éditeur.
Le nouveau .crsh JJC1 utilise notre compression maison : prédiction ou références aux répétitions, puis codage arithmétique. Aucun moteur GZIP, LZMA ou Huffman. Le mode automatique garde le plus petit résultat ; Mes blocs 00 / 11 ajoute tes lettres sur 5 bits et notations sur 4 bits (jusqu’à 256 Kio). Seuls JJC1 et les fichiers .txt UTF-8 sont acceptés. Les anciens .crsh sont refusés. Maximum : 10 Mo de texte. Fonctionne hors ligne, sans mot de passe.
Les PDF sont générés directement, sans impression. Leur texte est une image, donc non sélectionnable.
Pour utiliser l’application hors ligne, conserve index.html et le dossier static ensemble. Les modifications restent en mémoire jusqu’à leur enregistrement.`;

O("edit",()=>ve("editpage"));
O("expandEditor",()=>ve("editpage"));
O("editorSide",()=>ve("overview"));

O("editorFullscreen",async()=>{
if(document.fullscreenElement){
await document.exitFullscreen();
return
}
if(!E("editpage").requestFullscreen)throw Error("Le plein \xE9cran n\u2019est pas disponible ici. La page \xC9diter reste agrandie.");
await E("editpage").requestFullscreen()
});

document.addEventListener("fullscreenchange",()=>{
E("editorFullscreen").textContent=document.fullscreenElement?"Quitter le plein \xE9cran":"Plein \xE9cran"
});

O("help",()=>E("guide").showModal());
O("closeHelp",()=>E("guide").close());

ce();
})();
