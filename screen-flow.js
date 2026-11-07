import {ElevatorModel,scrollLayout,scrollState} from './elevator/model.js';
import {ElevatorRenderer} from './elevator/renderer.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');

export class ScreenFlow{
  constructor(){
    this.screens=[...document.querySelectorAll('[data-site-screen]')];
    this.track=document.querySelector('#screen-scroll-track');
    this.overlay=document.querySelector('#elevator-overlay');
    this.canvas=document.querySelector('#elevator-stage');
    this.layout=scrollLayout(this.screens.length,innerWidth,innerHeight);
    this.track.style.height=`${this.layout.height}px`;
    this.raf=0;this.last=0;this.segment=-1;this.wasTransitioning=false;this.stateKey='';
    addEventListener('scroll',()=>this.schedule(),{passive:true});
    addEventListener('resize',()=>this.resize());
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;this.last=0;}else this.schedule();});
    document.addEventListener('click',e=>{
      const link=e.target.closest('[data-screen-target]');
      if(!link)return;const index=this.screens.findIndex(s=>s.id===link.dataset.screenTarget);
      if(index>=0){e.preventDefault();this.goTo(index);}
    });
    reduced.addEventListener('change',()=>this.schedule());
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;cancelAnimationFrame(this.raf);this.raf=0;});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.renderer=new ElevatorRenderer(this.canvas,this.renderer.data,this.renderer.images);this.lost=false;this.schedule();});
    this.resizeCanvas();this.schedule();this.load();
  }
  async load(){
    try{
      this.renderer=await ElevatorRenderer.load(this.canvas);this.model=new ElevatorModel(this.renderer.data);
      document.documentElement.dataset.elevatorReady='true';
      const checkpoint=new URLSearchParams(location.search).get('elevator-frame');
      if(checkpoint!==null){
        this.referenceMode=true;const frame=clamp(Number(checkpoint)||0,0,420);
        this.model.atFrame(frame);this.screens.forEach(s=>{s.hidden=true;s.inert=true;});
        dispatchEvent(new CustomEvent('siteflowstate',{detail:{id:'elevator',transitioning:true}}));
        this.track.style.height='100svh';this.overlay.classList.add('is-active','is-opaque');
        this.renderer.render(this.model.snapshot(frame/60),frame/60,{reference:true});
        const gl=this.renderer.gl,pixels=new Uint8Array(960*540*4),red=new Map();
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.renderer.final.fbo);gl.readPixels(0,0,960,540,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        for(let i=0;i<pixels.length;i+=4)if(pixels[i])red.set(pixels[i],(red.get(pixels[i])||0)+1);
        this.canvas.dataset.redStats=JSON.stringify({max:Math.max(...red.keys()),common:[...red].sort((a,b)=>b[1]-a[1]).slice(0,8)});
        this.canvas.dataset.referenceFrame=String(frame);return;
      }
      this.schedule();
    }catch(error){console.error('Elevator initialization failed:',error);this.failed=true;this.overlay.hidden=true;this.schedule();}
  }
  schedule(){if(!this.raf&&!document.hidden&&!this.lost&&!this.referenceMode)this.raf=requestAnimationFrame(now=>this.frame(now));}
  resizeCanvas(){
    const scale=Math.min(innerWidth/960,innerHeight/540);
    this.canvas.style.width=`${960*scale}px`;this.canvas.style.height=`${540*scale}px`;
  }
  resize(){
    const old=this.layout,state=scrollState(scrollY,this.screens.length,old);
    this.layout=scrollLayout(this.screens.length,innerWidth,innerHeight);
    this.track.style.height=`${this.layout.height}px`;this.resizeCanvas();
    const offset=state.transitioning?state.phase/9*this.layout.travel:0;
    if(!this.referenceMode)window.scrollTo(0,state.segment*this.layout.span+offset);
    this.schedule();
  }
  goTo(index){window.scrollTo({top:clamp(index,0,this.screens.length-1)*this.layout.span,behavior:reduced.matches?'auto':'smooth'});}
  applyState(state){
    const id=this.screens[state.screen].id,key=`${id}/${state.transitioning}`;
    if(key===this.stateKey)return;this.stateKey=key;
    this.screens.forEach((screen,index)=>{screen.hidden=index!==state.screen;screen.inert=index!==state.screen||state.transitioning;});
    this.overlay.classList.toggle('is-active',state.transitioning);
    this.overlay.setAttribute('aria-hidden',String(!state.transitioning));
    document.body.dataset.activeScreen=id;document.body.dataset.transitioning=String(state.transitioning);
    dispatchEvent(new CustomEvent('siteflowstate',{detail:{id,transitioning:state.transitioning}}));
  }
  frame(now){
    this.raf=0;if(this.referenceMode||document.hidden||this.lost)return;
    const state=scrollState(scrollY,this.screens.length,this.layout);
    if(this.failed)state.transitioning=false;
    this.applyState(state);
    const hint=document.querySelector('.scroll-hint');
    if(hint)hint.style.opacity=String(clamp(1-scrollY/80,0,1)*.55);
    if(!state.transitioning||!this.renderer){this.last=0;this.wasTransitioning=false;return;}
    if(this.segment!==state.segment||!this.wasTransitioning){this.model.reset();this.renderer.frozen=false;this.last=now;}
    const delta=this.last?Math.min((now-this.last)/1000,.1):0;this.last=now;
    this.segment=state.segment;this.wasTransitioning=true;
    if(!reduced.matches&&state.phase<7)this.model.advance(delta);
    const snapshot=this.model.snapshot(Math.min(7,state.phase));
    this.overlay.classList.toggle('is-opaque',state.phase>=.35&&state.phase<7);
    this.renderer.render(snapshot,state.phase);
    this.canvas.dataset.phase=state.phase.toFixed(4);
    this.canvas.dataset.beamTravel=JSON.stringify(snapshot.beams.map(b=>+b.at(Math.min(7,state.phase)).toFixed(3)));
    if(!reduced.matches&&state.phase<7)this.schedule();
  }
}

const flow=new ScreenFlow();
// Future screens use the same data-site-screen contract and this single renderer.
window.siteScreens={goTo:index=>flow.goTo(index)};
