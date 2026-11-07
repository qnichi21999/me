import {GRID,HexTrace,gridNodes,gridOpacity,nearestNode,toPixel,inSky,advancePointer,moonCovers,starPlane,projectWorld,miniPattern,traceSignature} from './model.js';
import {makeOrbit,orbitFrame,reflectOrbit} from './orbit.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const failureAlpha=age=>age<.6?(age%.24<.12?1:.025):clamp((1.05-age)/.45);

export class HexSky{
  constructor(input,output,data,invalidate){
    this.input=input;this.output=output;this.invalidate=invalidate;this.rig=starPlane(data);
    this.canvas=document.createElement('canvas');this.canvas.width=GRID.width;this.canvas.height=GRID.height;
    this.ctx=this.canvas.getContext('2d');this.nodes=gridNodes();
    // Two halves share one upload: distant orbits behind the moon, near ones
    // in front. Their original 3D reflections are included in the same layers.
    this.orbitCanvas=document.createElement('canvas');this.orbitCanvas.width=960;this.orbitCanvas.height=1080;
    this.orbitCtx=this.orbitCanvas.getContext('2d');
    this.enabled=false;this.hover=null;this.trace=null;this.failed=[];this.flying=[];
    this.time=0;this.moonTime=0;this.lastPaint=-Infinity;this.dirty=true;this.label=null;
    this.fit={scale:1,left:0,top:0};this.pointerId=null;
    input.addEventListener('pointerdown',event=>this.begin(event));
    input.addEventListener('pointermove',event=>this.move(event));
    input.addEventListener('pointerup',event=>this.end(event));
    input.addEventListener('pointercancel',()=>this.cancel());
    input.addEventListener('lostpointercapture',()=>{if(this.trace)this.cancel();});
    input.addEventListener('pointerleave',()=>{if(!this.trace){this.hover=null;this.changed();}});
    input.addEventListener('contextmenu',event=>event.preventDefault());
    input.addEventListener('blur',()=>{delete input.dataset.pointerFocus;});
    addEventListener('blur',()=>this.cancel());
    addEventListener('keydown',event=>{if(this.enabled&&this.trace&&event.key==='Escape'){event.preventDefault();this.cancel();}});
  }
  resize(fit){
    this.fit=fit;
    Object.assign(this.input.style,{left:`${fit.left}px`,top:`${fit.top}px`,width:`${GRID.width*fit.scale}px`,height:`${GRID.height*fit.scale}px`});
    if(this.trace)this.cancel();this.changed();
  }
  setEnabled(enabled){
    this.enabled=enabled;this.input.inert=!enabled;
    if(!enabled){this.cancel();this.hover=null;this.changed();}
  }
  changed(){this.dirty=true;this.invalidate();}
  point(event){return[(event.clientX-this.fit.left)/this.fit.scale,(event.clientY-this.fit.top)/this.fit.scale];}
  allowed=coord=>inSky(coord)&&!moonCovers(this.rig,toPixel(coord),this.moonTime);
  begin(event){
    if(!this.enabled||!event.isPrimary||![0,2].includes(event.button)||this.trace)return;
    const point=this.point(event),coord=nearestNode(point);
    if(!this.allowed(coord))return;
    event.preventDefault();this.input.dataset.pointerFocus='true';this.input.focus({preventScroll:true});this.input.setPointerCapture(event.pointerId);this.pointerId=event.pointerId;
    this.trace=new HexTrace(coord);this.hover=point;this.previous=point;this.label=null;
    this.output.dataset.state='drawing';this.updateOutput();this.changed();
  }
  move(event){
    if(!this.enabled)return;
    const samples=event.getCoalescedEvents?.()||[];
    for(const sample of samples.length?samples:[event]){
      const point=this.point(sample);this.hover=point;
      if(this.trace&&event.pointerId===this.pointerId){
        const from=this.previous||point,steps=Math.min(80,Math.max(1,Math.ceil(Math.hypot(point[0]-from[0],point[1]-from[1])/(GRID.step/5))));
        for(let i=1;i<=steps;i++)advancePointer(this.trace,[from[0]+(point[0]-from[0])*i/steps,from[1]+(point[1]-from[1])*i/steps],this.allowed);
        this.previous=point;this.updateOutput();
      }
    }
    this.changed();
  }
  end(event){
    if(!this.trace||event.pointerId!==this.pointerId)return;
    event.preventDefault();this.move(event);
    const trace=this.trace;
    this.trace=null;this.previous=null;this.pointerId=null;
    if(this.input.hasPointerCapture(event.pointerId))this.input.releasePointerCapture(event.pointerId);
    this.complete(trace);
  }
  complete(trace){
    const points=trace.points.map(toPixel),signature=trace.signature,valid=trace.valid;
    if(valid){
      this.flying.push({...makeOrbit(this.rig,miniPattern(trace),this.time,this.moonTime),signature});
      const live=this.flying.filter(f=>f.retire===undefined);if(live.length>24)live[0].retire=this.time;
    }else{this.failed.push({points,born:this.time});this.failed=this.failed.slice(-4);}
    this.label={signature,valid,born:this.time};this.updateOutput();this.changed();
  }
  preview(signature){this.complete(traceSignature(signature,0,[20,2]));}
  cancel(){
    const id=this.pointerId;this.trace=null;this.pointerId=null;this.previous=null;
    if(id!==null&&this.input.hasPointerCapture(id))this.input.releasePointerCapture(id);
    this.label=null;this.updateOutput();this.changed();
  }
  updateOutput(){
    const label=this.trace?{signature:this.trace.signature,valid:null}:this.label;
    const text=label?.signature||'';
    if(this.output.textContent!==text)this.output.textContent=text;
    this.output.dataset.state=this.trace?'drawing':label?(label.valid?'accepted':'failed'):'idle';
    this.input.dataset.signature=text;
    this.input.dataset.flying=String(this.flying.filter(f=>f.retire===undefined).length);
    this.input.dataset.drawing=String(!!this.trace);
  }
  needsAnimation(reduced){
    return this.dirty||!!this.trace||this.failed.length>0||!!this.label||this.flying.some(f=>!reduced||f.retire!==undefined);
  }
  star(point,alpha,size=1,color='#d7defb',ctx=this.ctx){
    if(alpha<=.002)return;
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=5;
    ctx.beginPath();ctx.arc(point[0],point[1],size,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    if(alpha>.5){ctx.globalAlpha=alpha*.35;ctx.fillRect(point[0]-2.3,point[1]-.35,4.6,.7);ctx.fillRect(point[0]-.35,point[1]-2.3,.7,4.6);}
    ctx.restore();
  }
  arc(points,alpha=1,color='#9a9dff',reduced=false,thin=false,ctx=this.ctx){
    if(points.length<2||alpha<.002)return;
    const tick=Math.floor((reduced?0:this.time)*18);
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(...points[0]);
    for(let edge=0;edge<points.length-1;edge++){
      const a=points[edge],b=points[edge+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,steps=Math.max(2,Math.ceil(length/7));
      for(let i=1;i<=steps;i++){
        const f=i/steps,seed=a[0]*.13+a[1]*.29+edge*3.7+i*12.4;
        const jitter=i===steps?0:Math.sin(seed+tick*2.1)*Math.sin(f*Math.PI)*(thin?.55:1.25);
        ctx.lineTo(a[0]+dx*f-dy/length*jitter,a[1]+dy*f+dx/length*jitter);
      }
    }
    ctx.strokeStyle=color;ctx.globalAlpha=alpha*.55;ctx.shadowColor=color;ctx.shadowBlur=6;ctx.lineWidth=thin?1.5:2.7;ctx.stroke();
    ctx.shadowBlur=0;ctx.globalAlpha=alpha;ctx.strokeStyle=color==='#ff314b'?color:'#e2e6ff';ctx.lineWidth=thin?.65:.9;ctx.stroke();ctx.restore();
  }
  draw(time,moonTime,reduced=false){
    this.time=time;this.moonTime=moonTime;
    this.failed=this.failed.filter(f=>time-f.born<1.05);
    this.flying=this.flying.filter(f=>f.retire===undefined||time-f.retire<1);
    if(this.label&&time-this.label.born>(this.label.valid?1.2:1.05)){this.label=null;this.updateOutput();this.dirty=true;}
    if(time-this.lastPaint<1/30&&!this.dirty)return false;
    if(!this.dirty&&!this.hover&&!this.trace&&!this.failed.length&&!this.flying.length&&!this.label)return false;
    this.lastPaint=time;this.dirty=false;
    const ctx=this.ctx;ctx.clearRect(0,0,GRID.width,GRID.height);
    this.orbitChanged=this.flying.length>0||!!this.hadOrbits;this.hadOrbits=this.flying.length>0;
    if(this.orbitChanged)this.orbitCtx.clearRect(0,0,960,1080);
    if(this.enabled&&this.hover){
      for(const node of this.nodes){
        const distance=Math.hypot(node.point[0]-this.hover[0],node.point[1]-this.hover[1]);
        if(distance<GRID.reveal&&this.allowed(node.coord))this.star(node.point,Math.pow(clamp(1-(distance-24)/(GRID.reveal-24)),2)*.8*gridOpacity(node.point[1]),.9);
      }
    }
    for(const f of this.failed){
      const alpha=reduced?clamp(1-(time-f.born)/1.05):failureAlpha(time-f.born);
      this.arc(f.points,alpha,'#ff314b',reduced);for(const p of f.points)this.star(p,alpha,1,'#ff314b');
    }
    const orbits=this.flying.map(f=>({f,pose:orbitFrame(this.rig,f,time,moonTime,reduced)})).sort((a,b)=>b.pose.depth-a.pose.depth);
    for(const {f,pose} of orbits){
      const alpha=(f.retire===undefined?1:clamp(1-(time-f.retire)))*.9;
      this.drawOrbit(pose,alpha,reduced);
      this.drawOrbit(reflectOrbit(this.rig,pose,moonTime),alpha*this.rig.data.sprites[1].modulate_rgba[3],reduced);
    }
    const front=orbits.filter(({pose})=>pose.front).length;
    for(const [name,count] of [['orbitFront',front],['orbitBack',orbits.length-front]]){
      if(this.input.dataset[name]!==String(count))this.input.dataset[name]=String(count);
    }
    if(this.trace){
      const points=this.trace.points.map(toPixel);this.arc(points,1,'#9a9dff',reduced);
      for(let i=0;i<points.length;i++)this.star(points[i],1,i===0?1.65:1.15,i===0?'#f1b0d4':'#e1dfff');
      if(this.hover){
        const anchor=points.at(-1),dx=this.hover[0]-anchor[0],dy=this.hover[1]-anchor[1],length=Math.hypot(dx,dy)||1,scale=Math.min(1,GRID.step*.96/length);
        this.arc([anchor,[anchor[0]+dx*scale,anchor[1]+dy*scale]],.42,'#9a9dff',reduced);
      }
    }
    if(this.trace)this.output.style.opacity='1';
    else if(this.label){const age=time-this.label.born;this.output.style.opacity=String(this.label.valid?clamp((1.2-age)/.5):(reduced?clamp(1-age/1.05):failureAlpha(age)));}
    else this.output.style.opacity='0';
    return true;
  }
  drawOrbit(pose,alpha,reduced){
    const ctx=this.orbitCtx,points=pose.points.map(p=>projectWorld(this.rig,p));
    ctx.save();ctx.beginPath();ctx.rect(0,pose.front?540:0,960,540);ctx.clip();
    if(pose.front)ctx.translate(0,540);
    this.arc(points,alpha,'#ac93e9',reduced,true,ctx);
    for(const p of points)this.star(p,alpha*.8,.65,'#c7c6fb',ctx);
    ctx.restore();
  }
}
