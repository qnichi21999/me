import {multiply,planeHit,projectWorld} from './model.js';
import {spritePosition} from '../moon/model.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const viewDepth=(rig,point)=>-point.reduce((sum,v,i)=>sum+(v-rig.camera[i])*rig.rotation[6+i],0);

export function makeOrbit(rig,mini,born,moonTime,random=Math.random){
  const roll=(random()-.5)*.85,inclination=.65+random()*.22;
  const c=Math.cos(roll),s=Math.sin(roll),tilt=Math.sin(inclination);
  const u=multiply(rig.rotation,[c,s,0]),v=multiply(rig.rotation,[s*tilt,-c*tilt,Math.cos(inclination)]);
  const moon=spritePosition(rig.data.sprites[0],moonTime),screen=projectWorld(rig,moon);
  const dx=mini.center[0]-screen[0],dy=screen[1]-mini.center[1];
  const extent=2*Math.max(1,...mini.points.flat().map(Math.abs));
  return {...mini,born,u,v,up:cross(v,u),radius:52+random()*15,
    phase:Math.atan2((s*dx-c*dy)/tilt,c*dx+s*dy),
    speed:(random()<.5?-1:1)*Math.PI*2/(26+random()*14),
    unit:Math.min(.3,48/extent)*viewDepth(rig,moon)*rig.fov/270,
    launch:mini.points.map(p=>planeHit(rig,p.map((value,i)=>value+mini.center[i]),moonTime).world),
    launchCenter:planeHit(rig,mini.center,moonTime).world};
}

export function inFrontOfMoon(rig,point,moonTime,index=0){
  const center=spritePosition(rig.data.sprites[index],moonTime);
  const side=p=>p.reduce((sum,v,i)=>sum+(v-center[i])*rig.inverse[i*3+2],0);
  return side(point)*side(rig.camera)>1e-6;
}

export function orbitFrame(rig,orbit,time,moonTime,reduced=false){
  const age=Math.max(0,time-orbit.born),t=clamp(age/1.6),arrival=reduced?1:t*t*(3-2*t);
  const angle=orbit.phase+(reduced?0:age*orbit.speed),c=Math.cos(angle),s=Math.sin(angle);
  const moon=spritePosition(rig.data.sprites[0],moonTime);
  const center=moon.map((value,i)=>value+orbit.radius*(orbit.u[i]*c+orbit.v[i]*s));
  // The pattern is a flat card tangent to its orbit: its face points at the
  // moon, rather than always facing the camera. Project every vertex in 3D.
  const tangent=orbit.u.map((value,i)=>-value*s+orbit.v[i]*c);
  const points=orbit.points.map(([x,y],index)=>blend(orbit.launch[index],center.map((value,i)=>value+orbit.unit*(tangent[i]*x-orbit.up[i]*y)),arrival));
  const position=blend(orbit.launchCenter,center,arrival);
  return {points,center:position,front:inFrontOfMoon(rig,position,moonTime),depth:viewDepth(rig,position)};
}

export function reflectOrbit(rig,frame,moonTime){
  const [main,mirror]=rig.data.sprites,scale=Math.abs(mirror.basis_columns[1][1]/main.basis_columns[1][1]);
  const source=spritePosition(main,moonTime),target=spritePosition(mirror,moonTime);
  const reflect=point=>[point[0],target[1]-(point[1]-source[1])*scale,point[2]];
  const center=reflect(frame.center);
  return {points:frame.points.map(reflect),center,front:inFrontOfMoon(rig,center,moonTime,1),depth:viewDepth(rig,center)};
}
