import {
  blinkFrame, blackGearRotation, sideGearRotation, sideGearLocalX,
  sidePlateRotation, openingShutterY, closingShutterY, glowStrength,
  newCameraState, stepCamera, slideGlobalY, shakeOffset, clamp01,
} from './reference-motion.js';

export const STEP=1/60;
export const TRAVEL_SECONDS=7;
export const WIPE_SECONDS=2;
export const SCROLL_UNITS_PER_SECOND=250;

function rng(seed){return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};}

// Fixed-step lookup preserves the original strict reset and discards overshoot.
// Scrubbing backwards returns to the same position; elapsed wall time is absent.
export function beamTrack(initialY,speed){
  const values=[initialY];
  for(let i=1;i<=420;i++)values.push(slideGlobalY(values[i-1],speed,STEP));
  return seconds=>{
    const sample=clamp01(seconds/TRAVEL_SECONDS)*420;
    const a=Math.floor(sample+1e-8),b=Math.min(420,a+1);
    return values[b]>values[a]?values[a]:values[a]+(values[b]-values[a])*(sample-a);
  };
}

export class ElevatorModel{
  constructor(data,seed=0x50535943){
    this.data=data;
    this.beams=data.geometry.filter(g=>g.role==='scrolling_beam').map(g=>({...g,at:beamTrack(g.center[1],g.vertical_speed_global_px_s)}));
    this.reset(seed);
  }
  reset(seed=0x50535943){
    this.time=0;this.frame=0;this.camera=newCameraState();this.accumulator=0;
    this.rngs=Array.from({length:6},(_,i)=>rng(seed+(i+1)*0x9e3779b9));
    this.shakes=Array.from({length:6},()=>[0,0]);
    this.sideY=this.data.gears.filter(g=>g.vertical_speed_global_px_s).map(g=>g.group_position[1]);
  }
  step(){
    this.frame++;this.time=this.frame*STEP;
    this.shakes=[1,1,5,3,1,2].map((power,i)=>shakeOffset(power,this.rngs[i]));
    const parent=this.shakes[5];
    this.sideY=this.sideY.map(y=>slideGlobalY(y+parent[1],250,STEP)-parent[1]);
    stepCamera(this.camera,this.time,STEP);
  }
  advance(delta){
    this.accumulator+=Math.min(.1,Math.max(0,delta));
    while(this.accumulator>=STEP){this.step();this.accumulator-=STEP;}
  }
  atFrame(frame){this.reset();for(let i=0;i<frame;i++)this.step();return this;}
  snapshot(scrollSeconds){
    const t=this.time,shaker=this.shakes[5],pomp=this.shakes[1];
    let index=0;
    const gears=this.data.gears.map(g=>{
      if(!g.vertical_speed_global_px_s)return{...g,x:g.world_nominal_center[0]+pomp[0],y:g.world_nominal_center[1]+pomp[1],angle:blackGearRotation(t)};
      const y=this.sideY[index++];
      return{...g,x:g.group_position[0]+sideGearLocalX(t,Math.sign(g.x_delta_local))*g.scale+shaker[0],y:y+shaker[1],angle:sideGearRotation(t)};
    });
    return{
      time:t,camera:this.camera.angle,shakes:this.shakes,gears,
      beams:this.beams.map(g=>({...g,x:g.center[0]+shaker[0],y:g.at(scrollSeconds)+shaker[1]})),
      plates:this.data.geometry.filter(g=>g.role==='side_plate').map(g=>({...g,x:g.center[0]+shaker[0],y:g.center[1]+shaker[1],angle:sidePlateRotation(t)})),
      opening:openingShutterY(scrollSeconds),closing:closingShutterY(scrollSeconds),
      blink:blinkFrame(t),glow:glowStrength(t),
    };
  }
}

export function scrollLayout(screenCount,width,height){
  const scale=Math.min(width/960,height/540);
  const hold=0;
  const travel=(TRAVEL_SECONDS+WIPE_SECONDS)*SCROLL_UNITS_PER_SECOND*scale;
  return{hold,travel,span:hold+travel,height:height+Math.max(0,screenCount-1)*(hold+travel)};
}
export function scrollState(scrollY,count,layout){
  const position=Math.max(0,scrollY);
  // Native scroll positions round to device pixels; the last page must still
  // become interactive when a fractional document height rounds down.
  const segment=Math.min(count-1,Math.floor((position+1)/layout.span));
  const local=position-segment*layout.span;
  const transitioning=segment<count-1&&local>layout.hold;
  const phase=transitioning?Math.min(9,(local-layout.hold)/layout.travel*9):0;
  return{segment,phase,transitioning,screen:transitioning&&phase>=7?segment+1:segment};
}
