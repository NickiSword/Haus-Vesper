(function(){
'use strict';
const isApp=/Electron/.test(navigator.userAgent);
const BUILD='6 (01.11.2026)';
const CS=3, WH=3.2, GW=21, GH=17, FUSES=4;
const $=id=>document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a), ri=n=>Math.floor(Math.random()*n), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const coarse=matchMedia('(pointer:coarse)').matches;
const D4=[[1,0],[-1,0],[0,1],[0,-1]];

/* ---------- Overlay ---------- */
const ov={root:$('overlay'),main:$('viewMain'),settings:$('viewSettings'),title:$('ovTitle'),lead:$('ovLead'),keys:$('ovKeys'),btn:$('ovBtn'),setBtn:$('setBtn'),menuBtn:$('menuBtn'),quitBtn:$('quitBtn'),back:$('backBtn'),fine:$('ovFine')};
function showOverlay(kind,extra){
  ov.root.hidden=false;ov.main.hidden=false;ov.settings.hidden=true;ov.menuBtn.hidden=(kind==='menu');ov.quitBtn.hidden=!(isApp&&kind==='menu');
  if(kind==='menu'){ov.title.textContent='Haus Vesper';ov.lead.textContent='Der Strom ist ausgefallen. Vier Sicherungen halten die Tür am anderen Ende des Hauses verschlossen. Etwas geht hier schon länger um.';ov.btn.textContent='Spielen';ov.fine.textContent='Kopfhörer empfohlen. Licht lockt es an. Stille auch. · Version '+BUILD}
  if(kind==='pause'){ov.title.textContent='Pause';ov.lead.textContent='Das Haus wartet.';ov.btn.textContent='Weiter';ov.fine.textContent=''}
  if(kind==='dead'){ov.title.textContent='Es hat dich.';ov.lead.textContent=extra;ov.btn.textContent='Noch einmal';ov.fine.textContent='Jedes Haus ist anders aufgebaut.'}
  if(kind==='won'){ov.title.textContent='Raus.';ov.lead.textContent=extra;ov.btn.textContent='Nochmal spielen';ov.fine.textContent='Das nächste Haus ist ein anderes.'}
  ov.btn.focus({preventScroll:true});
}
if(coarse){
  ov.keys.innerHTML='<dt>Links</dt><dd>Stick zum Gehen</dd><dt>Rechts</dt><dd>Wischen zum Umschauen</dd><dt>Knöpfe</dt><dd>Rennen und Taschenlampe</dd>';
}

/* ---------- Renderer ---------- */
let renderer;
try{
  renderer=new THREE.WebGLRenderer({canvas:$('gl'),antialias:!coarse});
}catch(e){
  ov.title.textContent='Kein WebGL';ov.lead.textContent='Dieser Browser kann die 3D-Grafik nicht darstellen. Bitte einen aktuellen Browser mit WebGL verwenden.';ov.btn.style.display='none';return;
}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarse?1.25:1.6));
renderer.outputEncoding=THREE.sRGBEncoding;
const canvas=renderer.domElement;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x040302);
scene.fog=new THREE.FogExp2(0x040302,0.085);
const camera=new THREE.PerspectiveCamera(72,1,0.05,60);
camera.rotation.order='YXZ';
scene.add(camera);

const spot=new THREE.SpotLight(0xffe6bd,2.4,26,0.52,0.55,1.4);
spot.position.set(0.12,-0.08,0.05);camera.add(spot);
spot.target.position.set(0,0,-6);camera.add(spot.target);
const glow=new THREE.PointLight(0xffd7a0,0.4,6.5,2);camera.add(glow);
const ambient=new THREE.AmbientLight(0x1a1a28,0.4);scene.add(ambient);
const lamps=[];
for(let i=0;i<4;i++){const l=new THREE.PointLight(0xff9a4a,0.9,7,2);scene.add(l);lamps.push({l,base:.9,off:0,bulb:null})}
const exitLight=new THREE.PointLight(0xa02020,0.8,10,2);scene.add(exitLight);

function resize(){const w=$('stage').clientWidth,h=$('stage').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

/* ---------- Texturen ---------- */
const MAXANI=Math.min(8,renderer.capabilities.getMaxAnisotropy());
function mkTex(s,draw,rx,ry){
  const c=document.createElement('canvas'),b=document.createElement('canvas');
  c.width=c.height=b.width=b.height=s;
  const x=c.getContext('2d'),h=b.getContext('2d');
  draw(x,h,s);
  const mk=(cv,srgb)=>{const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx||1,ry||1);t.anisotropy=MAXANI;if(srgb)t.encoding=THREE.sRGBEncoding;return t};
  return {map:mk(c,true),bump:mk(b,false)};
}
const gray=v=>'rgb('+v+','+v+','+v+')';
function speck(x,s,n,a,light,mw){
  for(let i=0;i<n;i++){
    x.fillStyle=light?'rgba(255,240,215,'+rnd(0,a)+')':'rgba(0,0,0,'+rnd(0,a)+')';
    x.fillRect(rnd(0,s),rnd(0,s),rnd(1,mw||3),rnd(1,mw||3));
  }
}
function blot(x,s,px,py,r,stops){
  for(const dx of [-s,0,s])for(const dy of [-s,0,s]){
    const gx=px+dx,gy=py+dy;
    if(gx+r<0||gx-r>s||gy+r<0||gy-r>s)continue;
    const g=x.createRadialGradient(gx,gy,0,gx,gy,r);
    stops.forEach(st=>g.addColorStop(st[0],st[1]));
    x.fillStyle=g;x.fillRect(gx-r,gy-r,r*2,r*2);
  }
}
function crack(x,h,sx,sy,len,dirY){
  let px=sx,py=sy;const pts=[[px,py]];
  for(let i=0;i<len;i++){px+=rnd(-6,6);py+=dirY*rnd(3,9)+rnd(-2,2);pts.push([px,py])}
  [[x,'rgba(8,5,3,.75)',1.3],[h,'rgba(0,0,0,.9)',2.4]].forEach(a=>{
    a[0].strokeStyle=a[1];a[0].lineWidth=a[2];a[0].beginPath();a[0].moveTo(pts[0][0],pts[0][1]);
    pts.forEach(p=>a[0].lineTo(p[0],p[1]));a[0].stroke();
  });
}
function lozenge(c,cx,cy,col){
  c.fillStyle=col;c.beginPath();c.moveTo(cx,cy-20);
  c.quadraticCurveTo(cx+15,cy-6,cx+15,cy);c.quadraticCurveTo(cx+15,cy+6,cx,cy+20);
  c.quadraticCurveTo(cx-15,cy+6,cx-15,cy);c.quadraticCurveTo(cx-15,cy-6,cx,cy-20);c.fill();
  c.beginPath();c.arc(cx,cy,4,0,7);c.fill();
}
function drawBlood(x,h,s,rail){
  const kind=ri(3);
  x.save();x.shadowColor='rgba(60,0,0,.8)';x.shadowBlur=6;
  if(kind===0){
    const ox=rnd(150,s-150),oy=rnd(110,rail-170);
    x.fillStyle='rgba(112,12,10,.88)';
    x.beginPath();x.ellipse(ox,oy,26,32,rnd(-.2,.2),0,7);x.fill();
    for(let f=0;f<4;f++){const a=-1.15+f*.38;x.beginPath();x.ellipse(ox+Math.sin(a)*38,oy-Math.cos(a)*46,7,22,a,0,7);x.fill()}
    x.beginPath();x.ellipse(ox-36,oy+6,7,19,-1.1,0,7);x.fill();
    for(let k=0;k<4;k++){
      const dx=ox+rnd(-24,24),dl=rnd(40,140),g=x.createLinearGradient(0,oy,0,oy+dl);
      g.addColorStop(0,'rgba(112,12,10,.85)');g.addColorStop(1,'rgba(112,12,10,0)');
      x.fillStyle=g;x.fillRect(dx,oy+20,rnd(3,6),dl);
    }
  }else if(kind===1){
    x.strokeStyle='rgba(100,10,8,.78)';x.lineWidth=15;x.lineCap='round';
    const sx=rnd(80,s-200),sy=rnd(50,rail-300);
    x.beginPath();x.moveTo(sx,sy);x.bezierCurveTo(sx+30,sy+80,sx-40,sy+150,sx+rnd(-30,60),sy+rnd(200,270));x.stroke();
  }else{
    const sx=rnd(120,s-200),sy=rnd(40,rail-230);
    for(let k=0;k<4;k++){
      [[x,'rgba(14,8,5,.9)'],[h,'rgba(0,0,0,.95)']].forEach(a=>{
        a[0].strokeStyle=a[1];a[0].lineWidth=3;a[0].beginPath();
        a[0].moveTo(sx+k*16,sy);a[0].quadraticCurveTo(sx+k*16+8,sy+90,sx+k*16+(k*3-4),sy+190);a[0].stroke();
      });
    }
  }
  x.restore();
}
function drawWall(x,h,s,blood){
  const rail=Math.floor(s*.62),sw=s/8,pw=s/4;
  x.fillStyle='#4d4135';x.fillRect(0,0,s,s);
  h.fillStyle=gray(128);h.fillRect(0,0,s,s);
  /* Tapete: Streifen und Rautenmuster */
  for(let i=0;i<8;i++){
    x.fillStyle=i%2?'rgba(0,0,0,.11)':'rgba(255,225,170,.06)';x.fillRect(i*sw,0,sw,rail);
    x.fillStyle='rgba(0,0,0,.2)';x.fillRect(i*sw,0,2,rail);
  }
  for(let col=0;col<8;col+=2)for(let row=0;row<8;row++){
    const cx=col*sw+sw/2,cy=row*sw+sw/2+((col/2)%2?sw/2:0);
    if(cy<26||cy>rail-26)continue;
    lozenge(x,cx,cy,'rgba(214,180,120,.14)');lozenge(h,cx,cy,gray(152));
  }
  /* Holzverkleidung */
  x.fillStyle='#2c2018';x.fillRect(0,rail,s,s-rail);
  h.fillStyle=gray(150);h.fillRect(0,rail,s,s-rail);
  for(let i=0;i<4;i++){
    const px=i*pw+14,py=rail+24,w=pw-28,hh=s-rail-24-34;
    x.fillStyle='#35271c';x.fillRect(px,py,w,hh);
    h.fillStyle=gray(98);h.fillRect(px,py,w,hh);
    x.fillStyle='rgba(255,220,170,.10)';x.fillRect(px,py,w,2);x.fillRect(px,py,2,hh);
    x.fillStyle='rgba(0,0,0,.5)';x.fillRect(px,py+hh-2,w,2);x.fillRect(px+w-2,py,2,hh);
    for(let k=0;k<28;k++){x.fillStyle='rgba(0,0,0,'+rnd(.04,.17)+')';x.fillRect(px+rnd(2,w-4),py+rnd(0,hh),1,rnd(10,70))}
  }
  x.fillStyle='#5b4430';x.fillRect(0,rail-8,s,16);
  x.fillStyle='rgba(255,230,190,.28)';x.fillRect(0,rail-8,s,2);
  x.fillStyle='rgba(0,0,0,.55)';x.fillRect(0,rail+8,s,3);
  h.fillStyle=gray(196);h.fillRect(0,rail-8,s,16);
  x.fillStyle='#21170f';x.fillRect(0,s-30,s,30);
  x.fillStyle='rgba(255,230,190,.12)';x.fillRect(0,s-30,s,2);
  h.fillStyle=gray(178);h.fillRect(0,s-30,s,30);
  x.fillStyle='rgba(0,0,0,.4)';x.fillRect(0,0,s,10);
  /* Verfall */
  for(let i=0;i<4;i++)blot(x,s,rnd(0,s),rnd(0,rail),rnd(60,150),[[0,'rgba(62,40,14,.40)'],[.6,'rgba(62,40,14,.16)'],[1,'rgba(62,40,14,0)']]);
  for(let i=0;i<3;i++)blot(x,s,rnd(0,s),rnd(rail*.5,s),rnd(40,90),[[0,'rgba(8,18,8,.42)'],[1,'rgba(8,18,8,0)']]);
  for(let i=0;i<7;i++){
    const gx=rnd(0,s),y0=rnd(0,rail*.5),len=rnd(80,260),g=x.createLinearGradient(0,y0,0,y0+len);
    g.addColorStop(0,'rgba(18,10,5,.55)');g.addColorStop(1,'rgba(18,10,5,0)');
    x.fillStyle=g;x.fillRect(gx,y0,rnd(2,7),len);
  }
  for(let i=0;i<3;i++){
    const cx=rnd(50,s-90),cy=rnd(40,rail-100),pts=[];
    for(let k=0;k<7;k++){const a=k/7*Math.PI*2;pts.push([cx+Math.cos(a)*rnd(16,40),cy+Math.sin(a)*rnd(24,58)])}
    const path=(c,dx,dy)=>{c.beginPath();pts.forEach((p,k)=>k?c.lineTo(p[0]+dx,p[1]+dy):c.moveTo(p[0]+dx,p[1]+dy));c.closePath()};
    x.fillStyle='rgba(26,20,14,.7)';path(x,4,6);x.fill();
    h.fillStyle=gray(70);path(h,4,6);h.fill();
    x.fillStyle='rgba(178,154,112,.24)';path(x,0,0);x.fill();x.strokeStyle='rgba(0,0,0,.55)';x.lineWidth=1.4;x.stroke();
    h.fillStyle=gray(176);path(h,0,0);h.fill();
  }
  crack(x,h,rnd(80,s-80),rnd(20,120),rnd(20,30),1);
  if(Math.random()<.6)crack(x,h,rnd(80,s-80),rnd(60,200),rnd(14,24),1);
  speck(x,s,2600,.28,false);speck(x,s,700,.12,true);
  speck(h,s,1500,.5,true,2);
  if(blood)drawBlood(x,h,s,rail);
}
function drawFloor(x,h,s){
  const n=12,ph=s/n;
  h.fillStyle=gray(128);h.fillRect(0,0,s,s);
  for(let i=0;i<n;i++){
    const y=i*ph,hue=rnd(18,30),sat=rnd(22,38),lig=rnd(10,17),cut=rnd(90,s-90);
    [[0,cut],[cut,s]].forEach(seg=>{
      const a=seg[0],b=seg[1];
      x.fillStyle='hsl('+hue+','+sat+'%,'+(lig+rnd(-2.5,2.5))+'%)';x.fillRect(a,y,b-a,ph);
      for(let k=0;k<26;k++){
        const gy=y+rnd(2,ph-2);
        x.strokeStyle=Math.random()<.55?'rgba(0,0,0,'+rnd(.05,.2)+')':'rgba(255,220,170,'+rnd(.02,.07)+')';
        x.lineWidth=rnd(.6,1.6);x.beginPath();x.moveTo(a,gy);
        x.bezierCurveTo(a+(b-a)*.3,gy+rnd(-2.5,2.5),a+(b-a)*.6,gy+rnd(-2.5,2.5),b,gy+rnd(-1.5,1.5));x.stroke();
      }
    });
    x.fillStyle='rgba(0,0,0,.78)';x.fillRect(0,y,s,2);x.fillRect(cut-1,y,2,ph);
    h.fillStyle=gray(38);h.fillRect(0,y,s,2);h.fillRect(cut-1,y,2,ph);
    x.fillStyle='rgba(255,220,170,.07)';x.fillRect(0,y+2,s,1);
    if(Math.random()<.25){
      const kx=rnd(40,s-40),ky=y+ph/2;
      for(let r=9;r>0;r-=2){x.strokeStyle='rgba(10,5,2,'+(.16+(9-r)*.05)+')';x.lineWidth=1.5;x.beginPath();x.ellipse(kx,ky,r*1.8,r*.8,0,0,7);x.stroke()}
      x.fillStyle='rgba(8,4,2,.55)';x.beginPath();x.ellipse(kx,ky,3,2,0,0,7);x.fill();
      h.fillStyle=gray(92);h.beginPath();h.ellipse(kx,ky,9,5,0,0,7);h.fill();
    }
  }
  for(let i=0;i<5;i++)blot(x,s,rnd(0,s),rnd(0,s),rnd(40,110),[[0,'rgba(0,0,0,.38)'],[1,'rgba(0,0,0,0)']]);
  for(let i=0;i<2;i++)blot(x,s,rnd(0,s),rnd(0,s),rnd(30,60),[[0,'rgba(60,10,6,.28)'],[1,'rgba(60,10,6,0)']]);
  for(let i=0;i<18;i++){
    const sx=rnd(0,s),sy=rnd(0,s),a=rnd(-.5,.5),l=rnd(20,70);
    x.strokeStyle='rgba(255,230,190,'+rnd(.05,.16)+')';x.lineWidth=1;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.cos(a)*l,sy+Math.sin(a)*l);x.stroke();
    h.strokeStyle='rgba(0,0,0,.5)';h.lineWidth=1.4;h.beginPath();h.moveTo(sx,sy);h.lineTo(sx+Math.cos(a)*l,sy+Math.sin(a)*l);h.stroke();
  }
  speck(x,s,2200,.3,false);speck(x,s,500,.08,true);speck(h,s,1200,.4,true,2);
}
function drawCeil(x,h,s){
  x.fillStyle='#241e19';x.fillRect(0,0,s,s);
  h.fillStyle=gray(128);h.fillRect(0,0,s,s);
  for(let i=0;i<5;i++)blot(x,s,rnd(0,s),rnd(0,s),rnd(40,100),[[0,'rgba(70,48,20,.45)'],[1,'rgba(70,48,20,0)']]);
  for(let i=0;i<3;i++)blot(x,s,rnd(0,s),rnd(0,s),rnd(30,70),[[0,'rgba(0,0,0,.5)'],[1,'rgba(0,0,0,0)']]);
  x.fillStyle='rgba(0,0,0,.4)';x.fillRect(0,0,s,5);h.fillStyle=gray(180);h.fillRect(0,0,s,5);
  crack(x,h,rnd(40,s-40),rnd(20,80),rnd(14,22),1);
  speck(x,s,1400,.3,false);speck(x,s,260,.08,true);speck(h,s,900,.5,true,2);
}
const WT=mkTex(512,(x,h,s)=>drawWall(x,h,s,false));
const WTB=mkTex(512,(x,h,s)=>drawWall(x,h,s,true));
const FT=mkTex(512,drawFloor,GW,GH);
const CT=mkTex(256,drawCeil,GW*1.5,GH*1.5);
const wallMat=new THREE.MeshPhongMaterial({map:WT.map,bumpMap:WT.bump,bumpScale:3,color:0xc4bcae,specular:0x1a1612,shininess:8});
const wallMatB=new THREE.MeshPhongMaterial({map:WTB.map,bumpMap:WTB.bump,bumpScale:3,color:0xc4bcae,specular:0x1a1612,shininess:8});
const floorMat=new THREE.MeshPhongMaterial({map:FT.map,bumpMap:FT.bump,bumpScale:2.5,color:0xb8b0a0,specular:0x2a2018,shininess:22});
const ceilMat=new THREE.MeshPhongMaterial({map:CT.map,bumpMap:CT.bump,bumpScale:1.5,color:0xa09890,shininess:2});
/* ---------- Einstellungen ---------- */
const DEF={quality:coarse?'low':'high',fov:72,bright:1,grain:true,sens:1};
const S=Object.assign({},DEF);
try{Object.assign(S,JSON.parse(localStorage.getItem('vesperSet')||'{}'))}catch(e){}
function saveS(){try{localStorage.setItem('vesperSet',JSON.stringify(S))}catch(e){}}
function applyQuality(){
  const dpr=devicePixelRatio||1;
  const pr={low:.7,mid:Math.min(dpr,1),high:Math.min(dpr,coarse?1.25:1.6)}[S.quality]||1;
  renderer.setPixelRatio(pr);resize();
  const an={low:1,mid:4,high:MAXANI}[S.quality]||4;
  [WT,WTB,FT,CT].forEach(T=>[T.map,T.bump].forEach(t=>{if(t.anisotropy!==an){t.anisotropy=an;t.needsUpdate=true}}));
  const bump=S.quality!=='low';
  [[wallMat,WT],[wallMatB,WTB],[floorMat,FT],[ceilMat,CT]].forEach(p=>{const b=bump?p[1].bump:null;if(p[0].bumpMap!==b){p[0].bumpMap=b;p[0].needsUpdate=true}});
}
function applyView(){
  camera.fov=S.fov;camera.updateProjectionMatrix();
  ambient.intensity=.4*S.bright;
  $('grain').style.display=S.grain?'':'none';
}
const qBtns=[...document.querySelectorAll('#qSeg button')];
function syncUI(){
  qBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.q===S.quality)));
  $('fov').value=S.fov;$('fovOut').textContent=S.fov+'°';
  $('bri').value=Math.round(S.bright*100);$('briOut').textContent=Math.round(S.bright*100)+' %';
  $('sens').value=Math.round(S.sens*100);$('sensOut').textContent=Math.round(S.sens*100)+' %';
  $('grainChk').checked=S.grain;
}
qBtns.forEach(b=>b.addEventListener('click',()=>{S.quality=b.dataset.q;applyQuality();syncUI();saveS()}));
$('fov').addEventListener('input',e=>{S.fov=+e.target.value;applyView();syncUI();saveS()});
$('bri').addEventListener('input',e=>{S.bright=e.target.value/100;applyView();syncUI();saveS()});
$('sens').addEventListener('input',e=>{S.sens=e.target.value/100;syncUI();saveS()});
$('grainChk').addEventListener('change',e=>{S.grain=e.target.checked;applyView();saveS()});
ov.setBtn.addEventListener('click',()=>{ov.main.hidden=true;ov.settings.hidden=false;ov.back.focus({preventScroll:true})});
ov.back.addEventListener('click',()=>{ov.settings.hidden=true;ov.main.hidden=false;ov.btn.focus({preventScroll:true})});
applyQuality();applyView();syncUI();

const wallGeo=new THREE.BoxGeometry(CS,WH,CS);
const floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(GW*CS,GH*CS),floorMat);
floorMesh.rotation.x=-Math.PI/2;floorMesh.position.set(GW*CS/2,0,GH*CS/2);scene.add(floorMesh);
const ceilMesh=new THREE.Mesh(new THREE.PlaneGeometry(GW*CS,GH*CS),ceilMat);
ceilMesh.rotation.x=Math.PI/2;ceilMesh.position.set(GW*CS/2,WH,GH*CS/2);scene.add(ceilMesh);

function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}
const glowMap=glowTex();
function glowSprite(color,scale,opacity,fog){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,fog:fog!==false}));
  s.scale.set(scale,scale,1);return s;
}

/* ---------- Labyrinth ---------- */
let grid=null;
const isWall=(x,z)=>x<0||z<0||x>=GW||z>=GH||grid[z][x]===1;
function genMaze(){
  const g=Array.from({length:GH},()=>Array(GW).fill(1));
  const st=[[1,1]];g[1][1]=0;
  while(st.length){
    const [x,y]=st[st.length-1];
    const nb=D4.map(([dx,dy])=>[x+dx*2,y+dy*2,dx,dy]).filter(([nx,ny])=>nx>0&&ny>0&&nx<GW-1&&ny<GH-1&&g[ny][nx]===1);
    if(!nb.length){st.pop();continue}
    const [nx,ny,hx,hy]=nb[ri(nb.length)];
    g[y+hy][x+hx]=0;g[ny][nx]=0;st.push([nx,ny]);
  }
  for(let r=0;r<3;r++){const rx=1+2*ri(9),ry=1+2*ri(7);for(let j=ry;j<=ry+2;j++)for(let i=rx;i<=rx+2;i++)g[j][i]=0}
  for(let k=0;k<30;k++){
    const x=1+ri(GW-2),y=1+ri(GH-2);
    if((x+y)%2!==1||g[y][x]!==1)continue;
    if(x%2===0){if(g[y][x-1]===0&&g[y][x+1]===0)g[y][x]=0}
    else if(g[y-1][x]===0&&g[y+1][x]===0)g[y][x]=0;
  }
  return g;
}
function bfs(si,sj){
  const dist=new Int16Array(GW*GH).fill(-1),par=new Int16Array(GW*GH).fill(-1);
  const q=[sj*GW+si];dist[q[0]]=0;
  for(let h=0;h<q.length;h++){
    const c=q[h],x=c%GW,z=(c/GW)|0;
    for(const [dx,dz] of D4){const nx=x+dx,nz=z+dz;if(isWall(nx,nz))continue;const n=nz*GW+nx;if(dist[n]>=0)continue;dist[n]=dist[c]+1;par[n]=c;q.push(n)}
  }
  return {dist,par};
}
const cellOf=(x,z)=>[Math.floor(x/CS),Math.floor(z/CS)];
const center=(i,j)=>[(i+.5)*CS,(j+.5)*CS];
function hit(x,z,r){
  const x0=Math.floor((x-r)/CS),x1=Math.floor((x+r)/CS),z0=Math.floor((z-r)/CS),z1=Math.floor((z+r)/CS);
  for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){
    if(!isWall(i,j))continue;
    const cx=clamp(x,i*CS,(i+1)*CS),cz=clamp(z,j*CS,(j+1)*CS);
    if((x-cx)*(x-cx)+(z-cz)*(z-cz)<r*r)return true;
  }
  return false;
}
function clearLine(x0,z0,x1,z1){
  const d=Math.hypot(x1-x0,z1-z0),n=Math.ceil(d/.5);
  for(let k=1;k<n;k++){const t=k/n;const [i,j]=cellOf(x0+(x1-x0)*t,z0+(z1-z0)*t);if(isWall(i,j))return false}
  return true;
}

/* ---------- Monster ---------- */
function makeMonster(){
  const g=new THREE.Group();
  const skin=new THREE.MeshPhongMaterial({color:0x161312,shininess:3,emissive:0x060303});
  const pale=new THREE.MeshPhongMaterial({color:0x8d877b,shininess:6});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.17,.3,1.5,8),skin);body.position.y=1.4;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,14,10),pale);head.scale.set(.85,1.3,.9);head.position.y=2.35;g.add(head);
  const eyeMat=new THREE.MeshBasicMaterial({color:0xff2a1a,fog:false});
  [-.07,.07].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.028,8,6),eyeMat);e.position.set(x,2.4,.16);g.add(e)});
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(.1,.2,.02),new THREE.MeshBasicMaterial({color:0x000000}));mouth.position.set(0,2.2,.17);g.add(mouth);
  const arms=[];
  [-1,1].forEach(s=>{
    const a=new THREE.Group();a.position.set(s*.3,2.0,0);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(.035,.03,1.6,6),skin);m.position.y=-.8;a.add(m);
    a.rotation.z=s*.08;g.add(a);arms.push(a);
  });
  const legs=[];
  [-1,1].forEach(s=>{const l=new THREE.Group();l.position.set(s*.12,.7,0);const m=new THREE.Mesh(new THREE.CylinderGeometry(.05,.04,.75,6),skin);m.position.y=-.35;l.add(m);g.add(l);legs.push(l)});
  g.userData={head,arms,legs,body};
  return g;
}

/* ---------- Level ---------- */
const worldGroup=new THREE.Group();scene.add(worldGroup);
let G=null;
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function spread(floors,n,filter,avoid){
  for(let md=6;md>=1;md--){
    const out=[];
    for(const c of shuffle(floors.filter(filter))){
      if([...out,...avoid].every(a=>Math.hypot(a[0]-c[0],a[1]-c[1])>=md)){out.push(c);if(out.length===n)break}
    }
    if(out.length===n)return out;
  }
  return [];
}
function buildLevel(){
  while(worldGroup.children.length){const c=worldGroup.children.pop();if(c.isInstancedMesh)c.dispose()}
  grid=genMaze();
  const floors=[],walls=[];
  for(let z=0;z<GH;z++)for(let x=0;x<GW;x++)(grid[z][x]===0?floors:walls).push([x,z]);
  const wA=[],wB=[];walls.forEach(w=>(Math.random()<.2?wB:wA).push(w));
  [[wA,wallMat],[wB,wallMatB]].forEach(pair=>{
    const arr=pair[0];if(!arr.length)return;
    const wm=new THREE.InstancedMesh(wallGeo,pair[1],arr.length);wm.frustumCulled=false;
    const m4=new THREE.Matrix4(),col=new THREE.Color();
    arr.forEach(([x,z],k)=>{
      m4.makeRotationY(ri(4)*Math.PI/2);m4.setPosition((x+.5)*CS,WH/2,(z+.5)*CS);wm.setMatrixAt(k,m4);
      const v=rnd(.74,1);col.setRGB(v*rnd(.94,1.06),v,v*rnd(.88,1));wm.setColorAt(k,col);
    });
    wm.instanceMatrix.needsUpdate=true;wm.instanceColor.needsUpdate=true;worldGroup.add(wm);
  });

  const sd=bfs(1,1).dist;
  const dOf=c=>sd[c[1]*GW+c[0]];
  const maxd=Math.max(...floors.map(dOf));
  const exitCell=floors.slice().sort((a,b)=>dOf(b)-dOf(a))[0];
  const start=[1,1];

  /* Ausgang */
  let face=[1,0];for(const d of D4){if(!isWall(exitCell[0]+d[0],exitCell[1]+d[1])){face=d;break}}
  const [ex,ez]=center(exitCell[0],exitCell[1]);
  const doorMat=new THREE.MeshBasicMaterial({color:0x5a1210});
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.5,.14),doorMat);
  door.position.set(ex,1.25,ez);door.rotation.y=Math.atan2(face[0],face[1]);worldGroup.add(door);
  const beacon=glowSprite(0x38ff7a,4,0,false);beacon.position.set(ex,1.4,ez);worldGroup.add(beacon);
  exitLight.position.set(ex,1.6,ez);exitLight.color.set(0xa02020);exitLight.intensity=.8;

  /* Lampen */
  const lampCells=[start,...spread(floors,3,()=>true,[start,exitCell])];
  lamps.forEach((L,i)=>{
    const c=lampCells[i]||start;const [lx,lz]=center(c[0],c[1]);
    L.l.position.set(lx,WH-.45,lz);L.off=0;
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xffc27a}));
    bulb.position.set(lx,WH-.35,lz);worldGroup.add(bulb);L.bulb=bulb;
  });

  /* Gegenstände */
  const fuseCells=spread(floors,FUSES,c=>dOf(c)>=9,[start,exitCell]);
  const batCells=spread(floors,4,c=>dOf(c)>=4,[start,exitCell,...fuseCells]);
  const items=[];
  function addItem(kind,c){
    const [x,z]=center(c[0],c[1]);const grp=new THREE.Group();
    const col=kind==='fuse'?0xe9c46f:0x7ee08a;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,kind==='fuse'?.36:.26,10),new THREE.MeshBasicMaterial({color:col}));
    const capMat=new THREE.MeshBasicMaterial({color:0x2a2420});
    const c1=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.05,10),capMat);c1.position.y=kind==='fuse'?.2:.15;
    const c2=c1.clone();c2.position.y=-c1.position.y;
    grp.add(body,c1,c2);
    const gl=glowSprite(col,kind==='fuse'?1.8:1.3,.55);grp.add(gl);
    if(kind==='fuse')grp.rotation.z=Math.PI/2*.0;
    grp.position.set(x,1,z);worldGroup.add(grp);
    items.push({kind,x,z,grp,taken:false,ph:rnd(0,6)});
  }
  fuseCells.forEach(c=>addItem('fuse',c));
  batCells.forEach(c=>addItem('bat',c));

  /* Monster */
  const mc=shuffle(floors.filter(c=>dOf(c)>=maxd*.55&&Math.hypot(c[0]-exitCell[0],c[1]-exitCell[1])>=4))[0]||exitCell;
  const [mx,mz]=center(mc[0],mc[1]);
  const mg=makeMonster();mg.position.set(mx,0,mz);worldGroup.add(mg);

  const [sx,sz]=center(start[0],start[1]);
  G={floors,items,exit:{x:ex,z:ez,door,doorMat,beacon,open:false},
     monster:{g:mg,x:mx,z:mz,state:'patrol',target:null,wander:0,searchT:0,lose:0,lastSeen:null,pathT:0,next:null,stepAcc:0,pressure:rnd(40,55),grace:12,yaw:0,speed:0},
     P:{x:sx,z:sz,yaw:Math.atan2(-face[0]*0,0)+(isWall(2,1)?Math.PI/2*0:-Math.PI/2),pitch:0},
     fuses:0,t:0,battery:100,stamina:100,exhausted:false,lightOn:true,flickerT:0,fear:0,
     startFace:null};
  /* Startblick entlang des freien Gangs */
  G.P.yaw=!isWall(2,1)?-Math.PI/2:(!isWall(1,2)?0:Math.PI);
}

/* ---------- Audio ---------- */
let AC=null,master,droneGain,rumbleGain,noiseBuf;
let vol=1,preMute=1;
try{const s=localStorage.getItem('vesperVol');if(s!==null)vol=clamp(parseFloat(s),0,1)||0}catch(e){}
const volEl=$('vol'),volOut=$('volOut');
function showVol(){volEl.value=Math.round(vol*100);volOut.textContent=Math.round(vol*100)+' %'}
function setVol(v,announce){
  vol=clamp(Math.round(v*20)/20,0,1);
  if(master)master.gain.value=.9*vol;
  showVol();
  try{localStorage.setItem('vesperVol',String(vol))}catch(e){}
  if(announce)hint(vol===0?'Ton aus':'Lautstärke '+Math.round(vol*100)+' %',1400);
}
function toggleMute(){if(vol>0){preMute=vol;setVol(0,true)}else setVol(preMute||1,true)}
volEl.addEventListener('input',()=>{setVol(volEl.value/100,false);if(vol>0)preMute=vol});
showVol();
function initAudio(){
  if(AC){if(AC.state==='suspended')AC.resume();return}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  AC=new C();master=AC.createGain();master.gain.value=.9*vol;master.connect(AC.destination);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);
  const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=150;
  droneGain=AC.createGain();droneGain.gain.value=.16;
  [47,47.8,71].forEach(f=>{const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(lp);o.start()});
  lp.connect(droneGain);droneGain.connect(master);
  const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=.09;lg.gain.value=55;lfo.connect(lg);lg.connect(lp.frequency);lfo.start();
  const rs=AC.createBufferSource();rs.buffer=noiseBuf;rs.loop=true;
  const rl=AC.createBiquadFilter();rl.type='lowpass';rl.frequency.value=180;
  rumbleGain=AC.createGain();rumbleGain.gain.value=0;
  rs.connect(rl);rl.connect(rumbleGain);rumbleGain.connect(master);rs.start();
}
function env(g,t,a,peak,rel){peak=Math.max(peak,.0002);g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+rel)}
function thump(vol){
  if(!AC)return;const t=AC.currentTime;
  [0,.2].forEach((off,k)=>{
    const o=AC.createOscillator(),g=AC.createGain();o.type='sine';
    o.frequency.setValueAtTime(k?48:62,t+off);o.frequency.exponentialRampToValueAtTime(28,t+off+.18);
    env(g,t+off,.012,vol*(k?.7:1),.2);o.connect(g);g.connect(master);o.start(t+off);o.stop(t+off+.35);
  });
}
function noiseHit(o){
  if(!AC)return;
  const vol=o.vol==null?.3:o.vol,freq=o.freq||400,dur=o.dur||.14,t=AC.currentTime+(o.when||0);
  const s=AC.createBufferSource();s.buffer=noiseBuf;
  const f=AC.createBiquadFilter();f.type=o.type||'lowpass';f.frequency.value=freq;f.Q.value=o.q||.7;
  const g=AC.createGain();env(g,t,o.attack||.008,vol,dur);
  s.connect(f);f.connect(g);let out=g;
  if(AC.createStereoPanner){const p=AC.createStereoPanner();p.pan.value=clamp(o.pan||0,-1,1);g.connect(p);out=p}
  out.connect(master);s.start(t,Math.random()*1.5,dur+(o.attack||.008)+.1);
}
function tone(freq,vol,dur,when,type){
  if(!AC)return;const t=AC.currentTime+(when||0),o=AC.createOscillator(),g=AC.createGain();
  o.type=type||'sine';o.frequency.value=freq;env(g,t,.01,vol,dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.1);
}
function chime(){tone(660,.16,.5);tone(990,.12,.7,.09)}
function click(){noiseHit({vol:.25,freq:2500,type:'highpass',dur:.03})}
function screech(){
  if(!AC)return;const t=AC.currentTime;
  [0,1].forEach(k=>{const o=AC.createOscillator(),g=AC.createGain();o.type='sawtooth';o.frequency.setValueAtTime(900+k*140,t);o.frequency.exponentialRampToValueAtTime(260,t+1.3);env(g,t,.02,.3,1.3);o.connect(g);g.connect(master);o.start(t);o.stop(t+1.5)});
  noiseHit({vol:.9,freq:1800,type:'bandpass',dur:1.2,attack:.01});
  thump(.9);
}
function creak(){
  if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();
  o.type='sawtooth';o.frequency.setValueAtTime(rnd(60,90),t);o.frequency.linearRampToValueAtTime(rnd(90,160),t+1.4);
  f.type='bandpass';f.frequency.value=rnd(300,600);f.Q.value=6;env(g,t,.4,.07,1.2);
  o.connect(f);f.connect(g);g.connect(master);o.start(t);o.stop(t+1.8);
}
function far(){noiseHit({vol:.5,freq:130,dur:.5,pan:rnd(-1,1)});noiseHit({vol:.3,freq:90,dur:.7,pan:rnd(-1,1),when:.3})}

/* ---------- Eingabe ---------- */
const keys={};
let locked=false,dragMode=coarse,dragging=false;
const touch={mx:0,mz:0,sprint:false};
addEventListener('keydown',e=>{
  if(e.code==='Escape'&&!ov.settings.hidden){ov.back.click();return}
  if(e.target&&e.target.tagName==='INPUT'&&String(e.code).indexOf('Arrow')===0)return;
  if(e.key==='+'||e.code==='NumpadAdd'||e.code==='BracketRight'){setVol(vol+.1,true);if(vol>0)preMute=vol;return}
  if(e.key==='-'||e.code==='NumpadSubtract'||e.code==='Slash'){setVol(vol-.1,true);if(vol>0)preMute=vol;return}
  if(e.repeat)return;keys[e.code]=true;
  if(e.code==='KeyM'){toggleMute();return}
  if(state.mode==='play'&&e.code==='KeyF')toggleLight();
  if(state.mode==='play'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
});
addEventListener('keyup',e=>{keys[e.code]=false});
function look(dx,dy){if(state.mode!=='play'&&state.mode!=='menu')return;P().yaw-=dx*S.sens;P().pitch=clamp(P().pitch-dy*S.sens,-1.2,1.2)}
document.addEventListener('mousemove',e=>{if(state.mode==='play'&&(locked||(dragMode&&dragging)))look(e.movementX*.0022,e.movementY*.0022)});
canvas.addEventListener('pointerdown',()=>{dragging=true});
addEventListener('pointerup',()=>{dragging=false});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(!locked&&state.mode==='play'&&!dragMode)pause()});
document.addEventListener('pointerlockerror',()=>{dragMode=true});
addEventListener('blur',()=>{if(state.mode==='play')pause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='play')pause()});

/* Touch */
(function(){
  const stick=$('stick'),knob=$('knob'),lz=$('lookzone');let sid=null,lid=null,lx=0,ly=0;
  stick.addEventListener('pointerdown',e=>{sid=e.pointerId;stick.setPointerCapture(sid);moveStick(e)});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===sid)moveStick(e)});
  const endStick=e=>{if(e.pointerId!==sid)return;sid=null;touch.mx=touch.mz=0;knob.style.transform=''};
  stick.addEventListener('pointerup',endStick);stick.addEventListener('pointercancel',endStick);
  function moveStick(e){
    const r=stick.getBoundingClientRect(),R=r.width/2;
    let dx=e.clientX-(r.left+R),dy=e.clientY-(r.top+R);const d=Math.hypot(dx,dy);
    if(d>R){dx*=R/d;dy*=R/d}
    knob.style.transform='translate('+dx+'px,'+dy+'px)';touch.mx=dx/R;touch.mz=dy/R;
  }
  lz.addEventListener('pointerdown',e=>{lid=e.pointerId;lz.setPointerCapture(lid);lx=e.clientX;ly=e.clientY});
  lz.addEventListener('pointermove',e=>{if(e.pointerId!==lid)return;look((e.clientX-lx)*.005,(e.clientY-ly)*.005);lx=e.clientX;ly=e.clientY});
  const endLook=e=>{if(e.pointerId===lid)lid=null};
  lz.addEventListener('pointerup',endLook);lz.addEventListener('pointercancel',endLook);
  const sp=$('tSprint');
  sp.addEventListener('pointerdown',()=>{touch.sprint=true});
  ['pointerup','pointercancel','pointerleave'].forEach(n=>sp.addEventListener(n,()=>{touch.sprint=false}));
  $('tLight').addEventListener('pointerdown',()=>{if(state.mode==='play')toggleLight()});
})();

/* ---------- Spielzustand ---------- */
const state={mode:'menu'};
const P=()=>G.P;
const hud={root:$('hud'),slots:[...document.querySelectorAll('.slot')],bat:$('batFill'),batBar:$('batBar'),stam:$('stamFill'),stamBar:$('stamBar'),clock:$('clock'),hint:$('hint'),fear:$('fear'),touch:$('touch')};
let hintTimer=0,hintCool=0;
function hint(text,ms){hud.hint.textContent=text;hud.hint.classList.add('show');clearTimeout(hintTimer);hintTimer=setTimeout(()=>hud.hint.classList.remove('show'),ms||3200)}
function toggleLight(){if(G.battery<=0){hint('Der Akku ist leer.',1800);return}G.lightOn=!G.lightOn;click()}
const fmt=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');

let fresh=true;
function begin(){
  initAudio();
  if(state.mode==='pause'){state.mode='play';if(AC)AC.resume()}
  else{buildLevel();state.mode='play';fresh=false;hud.slots.forEach(s=>s.classList.remove('on'));hint('Finde vier Sicherungen.',4200)}
  ov.root.hidden=true;hud.root.hidden=false;hud.touch.hidden=!coarse;
  if(!coarse){
    try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{dragMode=true})}catch(e){dragMode=true}
    setTimeout(()=>{if(state.mode==='play'&&!locked)dragMode=true},500);
  }
}
function pause(){
  if(state.mode!=='play')return;
  state.mode='pause';if(AC)AC.suspend();
  if(document.pointerLockElement)document.exitPointerLock();
  hud.touch.hidden=true;showOverlay('pause');
}
ov.btn.addEventListener('click',begin);
function toMenu(){
  if(document.pointerLockElement)document.exitPointerLock();
  buildLevel();
  state.mode='menu';
  hud.root.hidden=true;hud.touch.hidden=true;hud.hint.classList.remove('show');
  hud.fear.style.opacity=0;spot.intensity=2.4;glow.intensity=.4*S.bright;
  hud.slots.forEach(x=>x.classList.remove('on'));
  showOverlay('menu');
}
ov.menuBtn.addEventListener('click',toMenu);
ov.quitBtn.addEventListener('click',()=>window.close());

function die(){
  if(state.mode!=='play')return;
  state.mode='dead';G.deadT=0;
  hud.touch.hidden=true;
  if(document.pointerLockElement)document.exitPointerLock();
  screech();
}
function win(){
  state.mode='won';hud.touch.hidden=true;
  if(document.pointerLockElement)document.exitPointerLock();
  chime();tone(1320,.14,1.2,.2);
  setTimeout(()=>{showOverlay('won','Du bist nach '+fmt(G.t)+' durch die Tür entkommen.')},1200);
}

/* ---------- Monster-KI ---------- */
function monsterUpdate(dt,los,dist,moving){
  const M=G.monster,pl=G.P,f=G.fuses;
  if(M.grace>0)M.grace-=dt;
  const sight=G.lightOn?20:9,noise=G.sprinting?13:(moving?5:0);
  if(M.grace<=0){
    if(los&&dist<sight){M.state='chase';M.lastSeen=cellOf(pl.x,pl.z);M.lose=0}
    else if(M.state==='chase'){M.lose+=dt;if(M.lose>1.3){M.state='search';M.searchT=7;M.target=M.lastSeen}}
    if(M.state!=='chase'&&dist<noise){M.state='search';M.searchT=7;M.target=cellOf(pl.x,pl.z)}
    M.pressure-=dt;
    if(M.pressure<=0){M.pressure=rnd(35,55);if(M.state==='patrol'){M.state='search';M.searchT=10;M.target=cellOf(pl.x,pl.z)}}
  }
  const [mi,mj]=cellOf(M.x,M.z);
  M.pathT-=dt;
  let res=null;
  if(M.pathT<=0){M.pathT=.15;res=bfs(mi,mj);M.res=res}
  res=M.res||bfs(mi,mj);
  const atTarget=M.target&&M.target[0]===mi&&M.target[1]===mj;
  if(M.state==='search'){
    M.searchT-=dt;
    if(atTarget&&res){const near=G.floors.filter(c=>{const d=res.dist[c[1]*GW+c[0]];return d>=2&&d<=5});if(near.length)M.target=near[ri(near.length)]}
    if(M.searchT<=0){M.state='patrol';M.target=null}
  }
  if(M.state==='patrol'){
    M.wander-=dt;
    if(!M.target||atTarget||M.wander<=0){const far=G.floors.filter(c=>{const d=res.dist[c[1]*GW+c[0]];return d>=6&&d<=26});M.target=(far.length?far:G.floors)[ri(far.length||G.floors.length)];M.wander=14}
  }
  const speed=M.state==='chase'?2.9+.35*f:(M.state==='search'?2.2+.2*f:1.5);
  let tx,tz;
  if(M.state==='chase'&&los&&dist<7){tx=pl.x;tz=pl.z}
  else{
    let tgt=M.state==='chase'?cellOf(pl.x,pl.z):M.target;
    if(!tgt){tgt=[mi,mj]}
    if(tgt[0]===mi&&tgt[1]===mj){const c=center(mi,mj);tx=M.state==='chase'?pl.x:c[0];tz=M.state==='chase'?pl.z:c[1]}
    else{
      let c=tgt[1]*GW+tgt[0];
      if(res.dist[c]<0){tx=M.x;tz=M.z}
      else{
        while(res.par[c]>=0&&res.par[res.par[c]]>=0)c=res.par[c];
        const [cx,cz]=center(c%GW,(c/GW)|0);tx=cx;tz=cz;
      }
    }
  }
  const dx=tx-M.x,dz=tz-M.z,d=Math.hypot(dx,dz);
  M.speed=0;
  if(d>.05){
    const step=Math.min(speed*dt,d);M.x+=dx/d*step;M.z+=dz/d*step;M.speed=speed;
    let ty=Math.atan2(dx,dz),cur=M.yaw,diff=Math.atan2(Math.sin(ty-cur),Math.cos(ty-cur));
    M.yaw=cur+diff*Math.min(1,dt*7);
  }
  M.g.position.set(M.x,0,M.z);M.g.rotation.y=M.yaw;
  /* Animation */
  const u=M.g.userData,t=G.t*(M.state==='chase'?9:4);
  u.head.rotation.z=Math.sin(G.t*1.7)*.18;u.head.rotation.x=M.state==='chase'?.25:0;
  u.arms.forEach((a,k)=>{a.rotation.x=Math.sin(t+k*Math.PI)*.35+(M.state==='chase'?-.7:0)});
  u.legs.forEach((l,k)=>{l.rotation.x=Math.sin(t+k*Math.PI)*.5});
  u.body.rotation.x=M.state==='chase'?.2:0;
  /* Schritte */
  if(M.speed>0){
    M.stepAcc+=M.speed*dt;
    if(M.stepAcc>1.3){
      M.stepAcc=0;
      const rx=Math.cos(pl.yaw),rz=-Math.sin(pl.yaw),dd=Math.max(dist,.1);
      const pan=((M.x-pl.x)*rx+(M.z-pl.z)*rz)/dd;
      const v=clamp(1-dist/24,0,1);
      if(v>0.02)noiseHit({vol:v*(los?1.1:.55),freq:los?420:200,dur:.16,pan,q:1});
    }
  }
}

/* ---------- Update ---------- */
let time=0,ambT=9,hbT=0,flick=0;
const clockEl=hud.clock;
function update(dt){
  time+=dt;
  const L=G&&G.P;
  /* Lampen flackern immer */
  if(G){lamps.forEach((l,i)=>{
    l.off-=dt;if(l.off<=0&&Math.random()<dt*.35)l.off=rnd(.08,.5);
    const k=l.off>0?.04:(.82+Math.sin(time*11+i*3)*.1);l.l.intensity=l.base*k;
    if(l.bulb)l.bulb.material.color.setRGB(k,k*.72,k*.4);
  })}
  if(state.mode==='menu'||!G){
    camera.position.set(4.5+Math.sin(time*.2)*.1,1.65+Math.sin(time*.9)*.02,4.5);
    camera.rotation.set(0,(G?G.P.yaw:0)+Math.sin(time*.15)*.12,0);
    return;
  }
  if(state.mode==='pause')return;

  const M=G.monster,pl=G.P;
  const mdx=M.x-pl.x,mdz=M.z-pl.z,dist=Math.hypot(mdx,mdz);

  if(state.mode==='dead'){
    G.deadT+=dt;
    const k=Math.min(1,G.deadT*2.2);
    const tx=pl.x+mdx*(1-k)+(-mdx/dist)*0,tz=pl.z+mdz*(1-k);
    M.g.position.set(pl.x+mdx/dist*(1.1-.55*k),0,pl.z+mdz/dist*(1.1-.55*k));
    M.g.rotation.y=Math.atan2(-mdx,-mdz);
    M.g.userData.head.rotation.x=.4;
    const want=Math.atan2(-mdx,-mdz)+Math.PI;
    const diff=Math.atan2(Math.sin(want-pl.yaw),Math.cos(want-pl.yaw));pl.yaw+=diff*Math.min(1,dt*10);
    pl.pitch+=(-.15-pl.pitch)*Math.min(1,dt*8);
    camera.position.set(pl.x+rnd(-.04,.04),1.55+rnd(-.04,.04),pl.z+rnd(-.04,.04));
    camera.rotation.set(pl.pitch,pl.yaw,rnd(-.05,.05));
    hud.fear.style.opacity=1;
    spot.intensity=Math.random()<.5?3:.2;
    if(G.deadT>1.6&&ov.root.hidden){hud.root.hidden=true;showOverlay('dead','Überlebt: '+fmt(G.t)+' · Sicherungen '+G.fuses+'/'+FUSES+'.')}
    return;
  }
  if(state.mode==='won'){return}

  G.t+=dt;

  /* Bewegung */
  let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+touch.mx;
  let mz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+touch.mz;
  const len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len}
  const moving=len>.08;
  const want=(keys.ShiftLeft||keys.ShiftRight||touch.sprint)&&moving;
  if(G.exhausted&&G.stamina>30)G.exhausted=false;
  G.sprinting=want&&G.stamina>0&&!G.exhausted;
  if(G.sprinting){G.stamina-=26*dt;if(G.stamina<=0){G.stamina=0;G.exhausted=true}}
  else G.stamina=Math.min(100,G.stamina+(moving?10:18)*dt);
  const speed=G.sprinting?5.1:3.1;
  const fx=-Math.sin(pl.yaw),fz=-Math.cos(pl.yaw),rx=Math.cos(pl.yaw),rz=-Math.sin(pl.yaw);
  const wx=(rx*mx+fx*-mz)*speed*dt,wz=(rz*mx+fz*-mz)*speed*dt;
  const R=.38;
  if(!hit(pl.x+wx,pl.z,R))pl.x+=wx;
  if(!hit(pl.x,pl.z+wz,R))pl.z+=wz;
  G.stepAcc=(G.stepAcc||0)+(moving?speed*dt:0);
  const stride=G.sprinting?2.2:1.7;
  if(G.stepAcc>stride){G.stepAcc=0;noiseHit({vol:G.sprinting?.2:.09,freq:G.sprinting?520:320,dur:.1,pan:(Math.random()-.5)*.3})}
  const bob=moving?Math.sin(G.t*(G.sprinting?13:8.5))*(G.sprinting?.07:.04):0;

  /* Taschenlampe */
  if(G.lightOn){G.battery-=1.1*dt;if(G.battery<=0){G.battery=0;G.lightOn=false;hint('Die Taschenlampe ist ausgegangen.',2600);click()}}

  /* Gegenstände */
  G.items.forEach(it=>{
    if(it.taken)return;
    it.grp.position.y=1+Math.sin(G.t*2+it.ph)*.08;it.grp.rotation.y+=dt*1.2;
    if(Math.hypot(it.x-pl.x,it.z-pl.z)<1){
      it.taken=true;it.grp.visible=false;chime();
      if(it.kind==='fuse'){
        G.fuses++;hud.slots.forEach((s,i)=>s.classList.toggle('on',i<G.fuses));
        if(G.fuses>=FUSES){
          G.exit.open=true;G.exit.doorMat.color.set(0x38ff7a);exitLight.color.set(0x38ff7a);exitLight.intensity=1.6;G.exit.beacon.material.opacity=.8;
          hint('Der Strom ist zurück. Irgendwo leuchtet die Tür.',5200);
        }else hint('Sicherung '+G.fuses+'/'+FUSES+'. Das Geräusch hat etwas gehört.',4200);
        if(M.state!=='chase'){M.state='search';M.searchT=10;M.target=cellOf(pl.x,pl.z);M.grace=0}
      }else{G.battery=Math.min(100,G.battery+50);hint('Neue Batterie.',2200)}
    }
  });

  /* Ausgang */
  const ed=Math.hypot(G.exit.x-pl.x,G.exit.z-pl.z);
  hintCool-=dt;
  if(ed<1.4){
    if(G.exit.open)win();
    else if(hintCool<=0){hint('Die Tür ist tot. Sicherungen '+G.fuses+'/'+FUSES+'.',2600);hintCool=3.5}
  }

  /* Monster */
  const los=dist<24&&clearLine(M.x,M.z,pl.x,pl.z);
  monsterUpdate(dt,los,dist,moving);
  if(dist<1&&state.mode==='play')die();

  /* Angst */
  const tgt=M.state==='chase'?clamp(1-(dist-1.5)/14,.15,1):clamp(1-dist/16,0,.5)*(los?1:.45);
  G.fear+=(tgt-G.fear)*Math.min(1,dt*3);
  const f=G.fear;
  hud.fear.style.opacity=(f*f*.95).toFixed(3);
  hbT-=dt;
  if(hbT<=0){hbT=60/(52+f*105);thump(.13+f*.55)}
  if(rumbleGain)rumbleGain.gain.setTargetAtTime(clamp(1-dist/18,0,1)*.5*(M.state==='chase'?1:.5),AC.currentTime,.2);
  if(droneGain)droneGain.gain.setTargetAtTime(.16+f*.1,AC.currentTime,.3);
  ambT-=dt;
  if(ambT<=0){ambT=rnd(9,22);Math.random()<.5?creak():far()}

  /* Licht */
  G.flickerT-=dt;
  if(f>.45&&G.flickerT<=-.15&&Math.random()<f*.08)G.flickerT=rnd(.08,.3);
  const low=G.battery<22&&G.battery>0&&Math.random()<.05;
  if(low)G.flickerT=Math.max(G.flickerT,.06);
  spot.intensity=G.lightOn?(G.flickerT>0?.15:2.4):0;
  glow.intensity=(G.lightOn?.4:.16)*(G.flickerT>0?.4:1)*S.bright;

  /* Kamera */
  const sh=f*f*.02;
  camera.position.set(pl.x+rnd(-sh,sh),1.65+bob+rnd(-sh,sh),pl.z+rnd(-sh,sh));
  camera.rotation.set(pl.pitch,pl.yaw,Math.sin(G.t*1.3)*.004);

  /* HUD */
  hud.bat.style.transform='scaleX('+(G.battery/100).toFixed(3)+')';
  hud.batBar.classList.toggle('low',G.battery<22);
  hud.stam.style.transform='scaleX('+(G.stamina/100).toFixed(3)+')';
  hud.stamBar.classList.toggle('low',G.exhausted);
  clockEl.textContent=fmt(G.t);
}

/* ---------- Filmkorn ---------- */
const gc=$('grain'),gx=gc.getContext('2d'),gimg=gx.createImageData(128,72);let gf=0;
function grain(){
  if(!S.grain||++gf%2)return;
  const d=gimg.data;
  for(let i=0;i<d.length;i+=4){const v=Math.random()*255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}
  gx.putImageData(gimg,0,0);
}

/* ---------- Loop ---------- */
let last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  update(dt);grain();
  renderer.render(scene,camera);
}
buildLevel();
state.mode='menu';
showOverlay('menu');
/* Menükamera: Blick entlang des Startgangs */
camera.position.set(4.5,1.65,4.5);
requestAnimationFrame(loop);
})();
