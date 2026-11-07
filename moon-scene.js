import {MoonRenderer} from './moon/renderer.js';
import {eyeRig,gazeTarget,followGaze,EyeBehavior} from './moon/eye.js';
import {HexSky} from './hex/sky.js';

const section=document.querySelector('#screen-02'),canvas=document.querySelector('#moon-stage');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const query=new URLSearchParams(location.search),checkpoint=query.get('moon-time');
const referenceTime=checkpoint===null?null:Math.max(0,Number(checkpoint)||0);
let renderer,active=!section.hidden,raf=0,last=0,time=0,lost=false;
let rig,gaze=[0,0],settling=false;
let hex,skyTime=0;
let hexPreviewed=false;
const pointer={x:0,y:0,active:false};
const behavior=new EyeBehavior();
let fit={scale:1,left:0,top:0};

function resize(){
  const scale=Math.min(innerWidth/960,innerHeight/540);
  canvas.style.width=`${960*scale}px`;canvas.style.height=`${540*scale}px`;
  fit={scale,left:(innerWidth-960*scale)/2,top:(innerHeight-540*scale)/2};
  hex?.resize(fit);
}
function schedule(){if(renderer&&active&&!document.hidden&&!lost&&!raf)raf=requestAnimationFrame(frame);}
function paint(){
  const at=referenceTime??(reduced.matches?0:time);
  if(hex&&active&&!section.inert&&!hexPreviewed&&query.has('hex-preview')){
    hexPreviewed=true;
    try{hex.preview(query.get('hex-preview'));}catch(error){console.warn('Invalid hex preview:',error.message);}
  }
  if(hex?.draw(skyTime,at,reduced.matches))renderer.updateStars(hex.canvas,hex.orbitChanged?hex.orbitCanvas:null);
  renderer.render(at,{layer:query.get('moon-layer')||'full',gaze});
  canvas.dataset.time=at.toFixed(3);
  canvas.dataset.gaze=JSON.stringify(gaze.map((v,i)=>+(v*renderer.data.sprite_settings.texture_size[i]).toFixed(3)));
  canvas.dataset.eyeMode=referenceTime===null?behavior.mode:'follow';
  if(referenceTime!==null&&(!canvas.dataset.snapshot||query.has('moon-capture')))canvas.dataset.snapshot=canvas.toDataURL('image/png');
}
function frame(now){
  raf=0;if(!renderer||!active||document.hidden||lost)return;
  const delta=last?Math.min((now-last)/1000,.1):1/60;
  skyTime+=delta;
  if(last&&!reduced.matches)time+=delta;last=now;
  const followTarget=gazeTarget(rig,referenceTime??(reduced.matches?0:time),pointer);
  const target=referenceTime===null?behavior.step(delta,followTarget,rig.texture,reduced.matches):followTarget;
  gaze=followGaze(gaze,target,delta,reduced.matches);
  settling=gaze.some((v,i)=>Math.abs(v-target[i])>.00001);paint();
  if((!reduced.matches&&referenceTime===null)||settling||hex?.needsAnimation(reduced.matches))schedule();
}
addEventListener('siteflowstate',event=>{
  // Paint behind the elevator's exit wipe as soon as this screen is revealed.
  active=event.detail.id===section.id;
  hex?.setEnabled(active&&!section.inert);
  if(!active){cancelAnimationFrame(raf);raf=0;last=0;pointer.active=false;gaze=[0,0];}else schedule();
});
addEventListener('pointermove',event=>{
  if(!active)return;
  pointer.x=(event.clientX-fit.left)/fit.scale;pointer.y=(event.clientY-fit.top)/fit.scale;
  if(referenceTime!==null)canvas.dataset.pointer=JSON.stringify({client:[event.clientX,event.clientY],logical:[pointer.x,pointer.y]});
  pointer.active=true;schedule();
},{passive:true});
function releaseGaze(){pointer.active=false;schedule();}
document.documentElement.addEventListener('pointerleave',releaseGaze);
addEventListener('blur',releaseGaze);
addEventListener('resize',()=>{resize();schedule();});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;last=0;if(!document.hidden)schedule();});
reduced.addEventListener('change',()=>{last=0;schedule();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;});
canvas.addEventListener('webglcontextrestored',()=>{
  try{renderer=new MoonRenderer(canvas,renderer.data,renderer.images);if(hex)hex.dirty=true;lost=false;last=0;paint();schedule();}
  catch(error){fail(error);}
});
function fail(error){console.error('Moon scene initialization failed:',error);document.querySelector('#moon-error').hidden=false;}
resize();
try{
  renderer=await MoonRenderer.load(canvas);rig=eyeRig(renderer.data);
  hex=new HexSky(document.querySelector('#hex-input'),document.querySelector('#hex-signature'),renderer.data,schedule);
  hex.resize(fit);hex.setEnabled(active&&!section.inert);
  paint();canvas.dataset.ready='true';schedule();
}catch(error){fail(error);}
