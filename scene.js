/* Static artwork stays in GPU textures; only wire vertices change each frame. */
import { cableNodes, stepCable, toScene, glowIntensity } from './motion.js';
import { CRTConsole } from './console.js';
import { GPURenderer, WireMesh } from './gpu.js';
import { introState, rebootState, growth, coilArrival } from './intro.js';
const W=2048,H=1162;
const PARALLAX_STRENGTH=.15;
const output=document.querySelector('#crt');
const terminal=document.createElement('canvas');terminal.width=W;terminal.height=H;
const tc=terminal.getContext('2d');
const blankBase=document.createElement('canvas');blankBase.width=W;blankBase.height=H;
const introBase=document.createElement('canvas');introBase.width=W;introBase.height=H;
const introQuietBase=document.createElement('canvas');introQuietBase.width=W;introQuietBase.height=H;
const patch=document.createElement('canvas');patch.width=1340;patch.height=104;
const pc=patch.getContext('2d');
const character=new Image();character.src=new URL('./assets/character.png',import.meta.url).href;
const characterCache=document.createElement('canvas');characterCache.width=960;characterCache.height=540;
const characterGlow=document.createElement('canvas');characterGlow.width=256;characterGlow.height=256;
const glowPhase=Math.random()*10000;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let motionReduced=reducedMotion.matches,elapsed=0,last=0,raf=0,ready=false,lost=false;
let sceneActive=true;
let entrance=0,asciiVisible=true;
let rebootElapsed=null;
let gpu,terminalTexture,characterTexture,glowTexture,lastHistoryKey='';
let pointer={x:0,y:0},drift={x:0,y:0};
const mouse={x:-1000,y:-1000,active:false};
let terminalDirty=true;
const consoleView=new CRTConsole(()=>{terminalDirty=true;scheduleRender();},()=>{rebootElapsed??=0;});
const profiling=new URLSearchParams(location.search).has('profile');
const frameSamples=[],inputSamples=[],intervalSamples=[];
let inputStarted=0;
if(profiling)consoleView.input.addEventListener('input',()=>{inputStarted=performance.now();},true);
function scheduleRender(){if(ready&&sceneActive&&!document.hidden&&!lost&&!raf)raf=requestAnimationFrame(frame);}
let seed=200608;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;}
const TAU=Math.PI*2;
const lerp=(a,b,t)=>a+(b-a)*t;
const wire=(points,color,width=1,movement=3,phase=random()*TAU)=>({points,nodes:cableNodes(points),color,width,movement,phase});
const rearMesh=new WireMesh(),frontMesh=new WireMesh();
const rearWires = [
  wire([[-60,322],[45,245],[98,128],[224,103],[300,64],[317,-65]],'#777d7c',2.4,3),
  wire([[-90,437],[54,333],[168,283],[305,262],[385,182],[537,100],[734,12],[840,-55]],'#8a8c87',2.7,4),
  wire([[1526,-90],[1669,26],[1784,124],[1873,248],[1940,384],[2100,447]],'#777b7c',2.8,3),
  wire([[1830,-100],[1903,36],[2015,78],[2119,229]],'#7f8583',2.1,2),
  wire([[-95,969],[67,989],[212,1045],[370,1137],[578,1184],[771,1217]],'#a4a29a',2.2,4),
  wire([[-46,1056],[63,1152],[120,1245]],'#888d89',2.6,3),
  wire([[1603,1242],[1710,1165],[1792,1190],[1882,1069],[1949,953],[2106,954]],'#929c99',2.8,4),
  wire([[1749,-49],[1812,54],[1811,144],[1878,222],[1901,313],[2077,358]],'#131515',3.4,5),
  wire([[102,-33],[73,94],[3,154],[-85,286]],'#101112',2.5,4),
  wire([[529,-39],[458,54],[388,74],[333,146],[223,183],[194,246],[116,287]],'#242625',2.1,4),
  wire([[1776,637],[1870,605],[1954,551],[2110,550]],'#363938',1.8,5),
  wire([[1276,1222],[1341,1119],[1464,1138],[1542,1069],[1669,1057],[1776,923],[1977,799],[2130,708]],'#181a19',2.3,5),
  wire([[-23,800],[125,863],[252,844],[358,772],[483,717]],'#1b1c1b',2.1,4),
  wire([[157,1240],[260,1118],[238,1012],[172,970],[82,862],[10,849]],'#171919',2.2,4),
  wire([[-15,270],[162,257],[358,230],[545,149],[686,93],[828,46]],'#242727',1.5,3),
  wire([[1217,30],[1344,62],[1447,123],[1538,160],[1734,319],[1885,373],[2072,417]],'#161918',2,4),
  wire([[1824,1230],[1790,1120],[1919,1038],[1980,927],[2083,882]],'#252827',2.1,4),
  wire([[-46,575],[87,581],[202,552],[297,530],[371,572]],'#1b1d1c',1.8,4),
];

const frontWires = [
  wire([[639,-60],[653,107],[682,236],[762,328],[859,411],[958,505],[1027,573]],'#747773',1.1,3),
  wire([[945,-70],[968,61],[961,152],[979,205],[958,249],[966,316],[1000,422],[1032,550]],'#a4a8a7',1.7,2.5),
  wire([[1192,-65],[1236,71],[1246,150],[1235,241],[1224,339],[1206,420],[1204,484],[1171,527],[1070,562]],'#a3a1a0',1.6,3),
  wire([[-61,197],[103,224],[271,298],[417,388],[549,409],[657,456],[740,413],[796,423],[873,460],[966,506]],'#727572',1.15,4),
  wire([[-86,729],[49,710],[142,614],[266,555],[360,529],[476,540],[603,561],[729,605],[897,661],[974,655]],'#9a777d',1.65,4),
  wire([[-35,552],[130,570],[291,539],[450,544],[617,579],[776,607],[945,602],[1034,580]],'#5f6261',1.05,4),
  wire([[1087,591],[1213,585],[1339,619],[1478,618],[1587,610],[1681,559],[1770,519],[1838,510],[1922,456],[2086,438]],'#9b9290',1.25,4),
  wire([[1095,625],[1192,609],[1313,648],[1441,700],[1565,750],[1694,750],[1791,752],[1883,687],[1977,628],[2118,607]],'#b4b3ac',1.9,3.5),
  wire([[1070,675],[1156,752],[1247,776],[1345,811],[1442,843],[1552,848],[1671,787],[1839,744],[1983,668],[2091,654]],'#292b29',1.6,5),
  wire([[1008,688],[964,760],[903,809],[843,860],[780,928],[668,979],[585,1012],[506,1082],[408,1111],[292,1169],[225,1231]],'#82414e',1.7,4),
  wire([[1044,703],[1006,786],[962,856],[954,945],[936,1033],[934,1111],[891,1211]],'#887c78',1.2,3),
  wire([[986,675],[908,709],[830,768],[735,791],[642,842],[516,870],[391,940],[225,970],[73,949],[-52,941]],'#292927',1.4,5),
  wire([[1038,702],[1111,764],[1163,853],[1190,965],[1256,1074],[1320,1214]],'#171919',1.8,4),
];


function makeCoil(a,b,phase){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
  const steps=Math.ceil(length/.85),nodes=[];
  for(let i=0;i<=steps;i++){
    const f=i/steps,wave=Math.sin(i*.68+phase)*9+Math.sin(i*1.36+phase)*3+Math.sin(i*2.51)*1.2;
    nodes.push({x:lerp(a[0],b[0],f)+nx*wave,y:lerp(a[1],b[1],f)+ny*wave,rx:0,ry:0,f});
  }
  return{nodes,nx,ny,phase};
}
const coils=[
  makeCoil([151,-30],[173,99],.8),makeCoil([108,207],[-30,425],1.3),
  makeCoil([1870,-32],[1842,101],.9),makeCoil([1936,208],[2096,441],1.5),
  makeCoil([-26,747],[103,965],.6),makeCoil([145,1234],[171,1080],2.1),
  makeCoil([1871,974],[2073,737],1.6),makeCoil([1856,1232],[1845,1081],2.4),
];
function addWire(mesh,w,t,progress=1,reverse=false){
  if(progress<=0)return;
  const end=w.nodes.length-1;
  for(let i=0;i<=end;i++){
    const p=w.nodes[i],f=i/end,a=w.movement*3.4*Math.sin(f*Math.PI);
    p.rx=p.x+p.dx+(Math.sin(t*1.12+w.phase-f*12)+Math.sin(t*2.1-w.phase+f*21)*.28)*a;
    p.ry=p.y+p.dy+(Math.cos(t*.94+w.phase-f*10)+Math.sin(t*1.7+w.phase+f*17)*.32)*a;
  }
  mesh.add(w.nodes,w.color,w.width,gpu.feather,progress,reverse);
}
function addCoil(mesh,c,t,arrival=1){
  if(arrival<=0)return;
  if(motionReduced&&c.rendered){mesh.add(c.nodes,'#a4a49c',1.9,gpu.feather);return;}
  for(const p of c.nodes){
    const wave=Math.sin(t*1.15+c.phase-p.f*7)*7*Math.sin(p.f*Math.PI);
    p.rx=p.x+c.nx*wave;p.ry=p.y+c.ny*wave;
    if(mouse.active&&!motionReduced){
      const dx=p.rx+drift.x*5-mouse.x,dy=p.ry+drift.y*3-mouse.y,d=Math.hypot(dx,dy);
      const force=Math.pow(Math.max(0,1-d/150),2)*18*Math.sin(p.f*Math.PI);
      p.rx+=dx/Math.max(1,d)*force;p.ry+=dy/Math.max(1,d)*force;
    }
  }
  const middle=c.nodes[Math.floor(c.nodes.length/2)],dx=middle.x-W/2,dy=middle.y-H/2,length=Math.hypot(dx,dy);
  const distance=(1-arrival)*460;
  mesh.add(c.nodes,'#a4a49c',1.9,gpu.feather,1,false,dx/length*distance,dy/length*distance);
  c.rendered=true;
}
function glowText(text,x,y,size,color='#e6e8e5',scale=1){
  tc.save();tc.translate(x,y);tc.scale(scale,1);tc.font=`${size}px Terminal`;tc.textBaseline='top';
  tc.fillStyle=color;tc.shadowColor=color;tc.shadowBlur=color==='#ec101c'?15:12;
  tc.fillText(text,0,0);tc.shadowBlur=3;tc.fillText(text,0,0);tc.restore();
}
function buildBases(){
  tc.clearRect(0,0,W,H);
  const shade=tc.createLinearGradient(326,142,1718,1033);
  shade.addColorStop(0,'#1a1a1a');shade.addColorStop(.5,'#191819');shade.addColorStop(1,'#141414');
  tc.fillStyle=shade;tc.fillRect(326,142,1392,891);
  tc.strokeStyle='#626360';tc.lineWidth=3;tc.shadowColor='#8a8b80';tc.shadowBlur=3;
  tc.strokeRect(328,144,1388,887);tc.shadowBlur=0;
  tc.strokeStyle='#353a39';tc.lineWidth=2;tc.strokeRect(332,148,1380,879);
  for(let i=0;i<95;i++){
    tc.fillStyle=`rgba(159,165,159,${random()*.12})`;
    tc.fillRect(random()*W,random()*H,random()*4+.4,random()*1.6+.4);
  }
  blankBase.getContext('2d').drawImage(terminal,0,0);
  // Preserve the supplied ASCII text, including its spacing.
  const asciiRows=[
    "  _                _ ",
    " | |__   ___ _   _| |",
    " | '_ \\ / _ \\ | | | |",
    " | | | |  __/ |_| |_|",
    " |_| |_|\\___|\\__, (_)",
    "             |___/   "
  ];
  const x=1072, red='#ec101c';
  glowText('uname:',x,215,56,red,.79);
  glowText('qnichi',1299,215,56,'#e4e5df',.79);
  glowText('Uptime:',x,291,56,red,.79);
  glowText('17y',1299,291,56,'#e4e5df',.79);
  glowText('C enjoyer',x,366,56,red,.79);
  glowText('CPU:',x,441,56,red,.79);
  glowText('soon',1218,441,56,'#e4e5df',.79);
  glowText('GPU:',x,517,56,red,.79);
  glowText('soon',1218,517,56,'#e4e5df',.79);

  introQuietBase.getContext('2d').drawImage(terminal,0,0);
  for(let i=0;i<asciiRows.length;i++) glowText(asciiRows[i],352,177+i*86,71,'#e5e8e5',.71);
  introBase.getContext('2d').drawImage(terminal,0,0);
}
function drawTerminal(){
  const key=`${consoleView.shell.started}/${consoleView.historyVersion}/${consoleView.scroll}/${asciiVisible}`;
  const full=key!==lastHistoryKey;
  if(full){
    tc.clearRect(0,0,W,H);tc.drawImage(consoleView.shell.started?blankBase:(asciiVisible?introBase:introQuietBase),0,0);
    if(consoleView.shell.started){
      tc.save();tc.beginPath();tc.rect(350,177,1338,710);tc.clip();consoleView.drawHistory(glowText);tc.restore();
    }
    lastHistoryKey=key;
  }
  tc.clearRect(342,895,1340,104);tc.drawImage(blankBase,342,895,1340,104,342,895,1340,104);
  consoleView.drawPrompt(tc,glowText);
  if(terminalTexture){
    if(full)gpu.update(terminalTexture,terminal);
    else{pc.clearRect(0,0,1340,104);pc.drawImage(terminal,342,895,1340,104,0,0,1340,104);gpu.update(terminalTexture,patch,342,895);}
  }
  terminalDirty=false;
}
function setupTextures(){
  terminalTexture=null;lastHistoryKey='';drawTerminal();
  terminalTexture=gpu.texture(terminal);characterTexture=gpu.texture(characterCache);glowTexture=gpu.texture(characterGlow);
}
function render(){
  if(lost||!gpu)return;
  const profileStart=profiling?performance.now():0;
  const boot=introState(entrance,motionReduced);
  const power=rebootElapsed===null?boot:rebootState(rebootElapsed,motionReduced);
  if(asciiVisible!==power.ascii){asciiVisible=power.ascii;terminalDirty=true;}
  if(terminalDirty&&!power.keepFrame)drawTerminal();
  rearMesh.reset();frontMesh.reset();
  const entryTime=motionReduced?4:entrance;
  rearWires.forEach((w,i)=>addWire(rearMesh,w,elapsed,growth(entryTime,i)));
  coils.forEach((c,i)=>addCoil(rearMesh,c,elapsed,coilArrival(entryTime,i)));
  frontWires.forEach((w,i)=>{
    const first=w.nodes[0],last=w.nodes.at(-1);
    const reverse=Math.hypot(last.x-1027,last.y-600)<Math.hypot(first.x-1027,first.y-600);
    addWire(frontMesh,w,elapsed,growth(entryTime,i,true),reverse);
  });
  gpu.begin();gpu.drawWires(rearMesh,drift.x*5,drift.y*3);
  gpu.drawLayer(terminalTexture,W/2+drift.x*12,H/2+drift.y*8,W*power.x,H*power.y,drift.x*.0025,power.opacity,false,power.flash);
  const characterX=W/2+(1027-W/2)*boot.x+drift.x*29;
  const characterY=H/2+(580-H/2+Math.sin(elapsed*.48)*1.7)*boot.y+drift.y*21;
  const characterAngle=Math.sin(elapsed*.28)*.0015+drift.x*.009;
  const light=glowIntensity(elapsed+glowPhase,motionReduced),activity=Math.max(0,Math.min(1,(light-.14)/.235));
  gpu.drawLayer(glowTexture,characterX,characterY,420*boot.x*(1+(activity-.45)*.055),480*boot.y*(1+(activity-.45)*.04),characterAngle,
    boot.opacity*light,true);
  gpu.drawEcho(characterTexture,characterX,characterY,1056*boot.x,594*boot.y,characterAngle,
    boot.opacity*(.44+activity*.33),motionReduced?0:elapsed+glowPhase,activity);
  gpu.drawWires(frontMesh,drift.x*27,drift.y*18);
  gpu.drawLayer(characterTexture,characterX,characterY,960*boot.x,540*boot.y,characterAngle,boot.opacity,true);
  gpu.finish(elapsed);
  output.dataset.entrance=entrance.toFixed(3);output.dataset.asciiVisible=String(asciiVisible);
  output.dataset.consolePower=power.phase||'on';output.dataset.rebootTime=rebootElapsed===null?'':rebootElapsed.toFixed(3);
  if(power.done)rebootElapsed=null;
  if(profiling){
    frameSamples.push(performance.now()-profileStart);
    const hadInput=!!inputStarted;
    if(hadInput){inputSamples.push(performance.now()-inputStarted);inputStarted=0;}
    if(frameSamples.length%60===0||hadInput){
      const stats=a=>({count:a.length,mean:+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(2),p95:+[...a].sort((a,b)=>a-b)[Math.floor(a.length*.95)].toFixed(2)});
      output.dataset.profile=JSON.stringify({render:stats(frameSamples.slice(-120)),input:inputSamples.length?stats(inputSamples):null,intervals:intervalSamples.length?stats(intervalSamples.slice(-120)):null});
    }
  }
}
function frame(now){
  raf=0;if(!sceneActive||document.hidden||lost)return;
  if(!motionReduced){
    if(profiling&&last)intervalSamples.push(now-last);
    const delta=last?Math.min((now-last)/1000,.05):0;last=now;elapsed+=delta;entrance=Math.min(4,entrance+delta);
    if(rebootElapsed!==null)rebootElapsed+=delta;
    const response=1-Math.exp(-delta*5);
    drift.x=lerp(drift.x,pointer.x*PARALLAX_STRENGTH,response);drift.y=lerp(drift.y,pointer.y*PARALLAX_STRENGTH,response);
    for(const w of rearWires)stepCable(w.nodes,delta,mouse,drift.x*5,drift.y*3);
    for(const w of frontWires)stepCable(w.nodes,delta,mouse,drift.x*27,drift.y*18);
  }
  render();if(!motionReduced)raf=requestAnimationFrame(frame);
}
function start(){last=0;scheduleRender();}
function consoleAt(x,y){
  const p=toScene(x,y,innerWidth,innerHeight);
  const dx=p.x-W/2-drift.x*12,dy=p.y-H/2-drift.y*8;
  const angle=-drift.x*.0025;
  const localX=dx*Math.cos(angle)-dy*Math.sin(angle)+W/2;
  const localY=dx*Math.sin(angle)+dy*Math.cos(angle)+H/2;
  return p.inside&&localX>=328&&localX<=1716&&localY>=144&&localY<=1031;
}
addEventListener('resize',()=>{if(gpu){gpu.resize();scheduleRender();}});
addEventListener('pointermove',e=>{
  if(!sceneActive)return;
  const position=toScene(e.clientX,e.clientY,innerWidth,innerHeight);
  Object.assign(mouse,position,{active:position.inside});
  pointer.x=Math.max(-1,Math.min(1,(position.x-W/2)/(W/2)));
  pointer.y=Math.max(-1,Math.min(1,(position.y-H/2)/(H/2)));
  output.classList.toggle('over-console',consoleAt(e.clientX,e.clientY));
});
document.documentElement.addEventListener('pointerleave',()=>{mouse.active=false;pointer.x=0;pointer.y=0;output.classList.remove('over-console');});
addEventListener('blur',()=>{mouse.active=false;pointer.x=0;pointer.y=0;});
output.addEventListener('pointerdown',e=>{
  if(consoleAt(e.clientX,e.clientY)){
    if(e.pointerType!=='touch')e.preventDefault();
    consoleView.focus();
  }else consoleView.input.blur();
});
output.addEventListener('wheel',e=>{
  if(sceneActive&&consoleView.focused&&consoleView.shell.started&&consoleAt(e.clientX,e.clientY)){
    const max=Math.max(0,consoleView.wrappedLines().length-14);
    if((e.deltaY<0&&consoleView.scroll<max)||(e.deltaY>0&&consoleView.scroll>0)){
      e.preventDefault();consoleView.scrollBy(e.deltaY>0?-3:3);
    }
  }
},{passive:false});
addEventListener('keydown',e=>{
  if(!sceneActive)return;
  if(e.target.closest('textarea,input,[contenteditable="true"]')||e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;
  if(e.key==='Enter'){e.preventDefault();consoleView.focus();return;}
  if(e.key.length===1){e.preventDefault();consoleView.insertText(e.key);}
});
addEventListener('siteflowstate',e=>{
  sceneActive=e.detail.id==='scene'&&!e.detail.transitioning;
  if(!sceneActive){entrance=4;consoleView.input.blur();mouse.active=false;cancelAnimationFrame(raf);raf=0;}
  else start();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else start();});
reducedMotion.addEventListener('change',e=>{
  motionReduced=e.matches;
  cancelAnimationFrame(raf);raf=0;start();
});

output.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;});
output.addEventListener('webglcontextrestored',()=>{
  try{gpu=new GPURenderer(output);lost=false;setupTextures();terminalDirty=true;start();}
  catch(error){console.error(error);document.querySelector('#error').hidden=false;}
});
try{
  await Promise.all([document.fonts.load('60px Terminal'),document.fonts.load('60px Terminal','Command'),character.decode()]);
  const cc=characterCache.getContext('2d');cc.filter='brightness(1.36) saturate(.80)';cc.drawImage(character,0,0,960,540);
  const gc=characterGlow.getContext('2d'),halo=gc.createRadialGradient(128,128,0,128,128,128);
  halo.addColorStop(0,'rgba(255,255,255,1)');halo.addColorStop(.25,'rgba(255,255,255,.90)');
  halo.addColorStop(.50,'rgba(255,255,255,.55)');halo.addColorStop(.75,'rgba(255,255,255,.18)');halo.addColorStop(1,'rgba(255,255,255,0)');
  gc.fillStyle=halo;gc.fillRect(0,0,256,256);
  buildBases();gpu=new GPURenderer(output);setupTextures();ready=true;scheduleRender();
  document.documentElement.dataset.ready='true';
}catch(error){console.error('Scene initialization failed:',error);document.querySelector('#error').hidden=false;}
