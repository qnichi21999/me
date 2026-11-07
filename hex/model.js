import {isValidPattern} from './patterns.js';
import {cameraRotation,inverseBasis,spriteBasis,spritePosition} from '../moon/model.js';

const step=36,rowHeight=step*Math.sqrt(3)/2,fadeStart=282,fadeEnd=fadeStart+5*rowHeight;
export const GRID=Object.freeze({step,rowHeight,origin:[24,24],width:960,height:Math.ceil(fadeEnd+18),fadeStart,fadeEnd,reveal:112});
// Clockwise neighbours on a triangular lattice: each star has six neighbours.
export const DIRECTIONS=Object.freeze([[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]);
export const TURNS=Object.freeze({w:0,e:1,d:2,a:4,q:5});
const LETTERS=['w','e','d',null,'a','q'];
export const key=point=>point.join(',');
export const equal=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const edge=(a,b)=>[key(a),key(b)].sort().join('/');
export const toPixel=([q,r])=>[GRID.origin[0]+GRID.step*(q+r/2),GRID.origin[1]+GRID.rowHeight*r];
export function nearestNode([x,y]){
  const r=(y-GRID.origin[1])/GRID.rowHeight,q=(x-GRID.origin[0])/GRID.step-r/2;
  let best=null,distance=Infinity;
  for(let row=Math.floor(r)-1;row<=Math.ceil(r)+1;row++)for(let col=Math.floor(q)-1;col<=Math.ceil(q)+1;col++){
    const p=toPixel([col,row]),d=Math.hypot(p[0]-x,p[1]-y);
    if(d<distance){distance=d;best=[col,row];}
  }
  return best;
}
export function inSky(point){const [x,y]=toPixel(point);return x>=16&&x<=944&&y>=18&&y<=GRID.fadeEnd;}
export function gridOpacity(y){
  const t=Math.max(0,Math.min(1,(y-GRID.fadeStart)/(GRID.fadeEnd-GRID.fadeStart)));
  return 1-t*t*(3-2*t);
}
export function gridNodes(){
  const nodes=[];
  const lastRow=Math.floor((GRID.fadeEnd-GRID.origin[1])/GRID.rowHeight);
  for(let r=0;r<=lastRow;r++)for(let q=-Math.ceil(r/2)-1;q<Math.ceil(GRID.width/GRID.step);q++)if(inSky([q,r]))nodes.push({coord:[q,r],point:toPixel([q,r])});
  return nodes;
}
export class HexTrace{
  // Hex Casting's relative-turn, no-reused-edge and last-edge undo semantics.
  // Upstream source/commit and MIT attribution are recorded in README.md.
  constructor(origin){this.points=[[...origin]];this.directions=[];this.edges=new Set();}
  get signature(){return this.directions.slice(1).map((d,i)=>LETTERS[(d-this.directions[i]+6)%6]).join('');}
  step(direction,allowed=()=>true){
    const current=this.points.at(-1),delta=DIRECTIONS[direction],next=[current[0]+delta[0],current[1]+delta[1]];
    if(!allowed(next))return 'outside';
    if(this.points.length>1&&equal(next,this.points.at(-2))){
      this.edges.delete(edge(current,next));this.points.pop();this.directions.pop();return 'undo';
    }
    if(this.edges.has(edge(current,next)))return 'blocked';
    if(this.points.length>=512)return 'blocked';
    this.edges.add(edge(current,next));this.points.push(next);this.directions.push(direction);return 'add';
  }
  get valid(){return this.directions.length>0&&isValidPattern(this.signature);}
}
export function traceSignature(signature,startDirection=0,origin=[0,0]){
  const trace=new HexTrace(origin);let direction=startDirection;trace.step(direction);
  for(const letter of signature){
    if(!(letter in TURNS))throw Error('Unknown hex turn: '+letter);
    direction=(direction+TURNS[letter])%6;
    if(trace.step(direction)!=='add')throw Error('Hex signature reuses an edge.');
  }
  return trace;
}
export function advancePointer(trace,pointer,allowed=()=>true){
  let changed=false;
  for(let i=0;i<32;i++){
    const anchor=toPixel(trace.points.at(-1)),dx=pointer[0]-anchor[0],dy=pointer[1]-anchor[1];
    if(Math.hypot(dx,dy)<GRID.step*.78)break;
    const direction=((Math.round(Math.atan2(dy,dx)/(Math.PI/3))%6)+6)%6;
    const result=trace.step(direction,allowed);
    if(result==='blocked'||result==='outside')break;
    changed=true;
  }
  return changed;
}
export const multiply=(matrix,vector)=>[0,1,2].map(i=>vector.reduce((sum,v,j)=>sum+matrix[j*3+i]*v,0));
export function starPlane(data){
  return {data,rotation:cameraRotation(data.camera_example.rotation_radians),inverse:inverseBasis(spriteBasis(data.sprites[0])),
    camera:data.camera_example.position,fov:Math.tan(data.camera_source.fov_vertical_degrees*Math.PI/360)};
}
export function planeHit(rig,[x,y],time=0){
  const ray=multiply(rig.rotation,[(x/960*2-1)*(960/540)*rig.fov,(1-y/540*2)*rig.fov,-1]);
  const position=spritePosition(rig.data.sprites[0],time);
  const origin=multiply(rig.inverse,rig.camera.map((v,i)=>v-position[i])),direction=multiply(rig.inverse,ray);
  const distance=-origin[2]/direction[2];
  return {world:rig.camera.map((v,i)=>v+ray[i]*distance),local:origin.map((v,i)=>v+direction[i]*distance)};
}
export function moonCovers(rig,point,time){
  const {local}=planeHit(rig,point,time),[w,h]=rig.data.sprite_settings.quad_size;
  return Math.hypot(local[0]/(w*.55),local[1]/(h*.55))<=1;
}
export function projectWorld(rig,point){
  const delta=point.map((v,i)=>v-rig.camera[i]);
  const view=[0,1,2].map(j=>delta.reduce((sum,v,i)=>sum+rig.rotation[j*3+i]*v,0));
  return [480+view[0]/-view[2]*270/rig.fov,270-view[1]/-view[2]*270/rig.fov];
}
export function reflectStar(rig,point){
  const world=planeHit(rig,point).world,[main,reflection]=rig.data.sprites;
  const scale=Math.abs(reflection.basis_columns[1][1]/main.basis_columns[1][1]);
  world[1]=reflection.position[1]-(world[1]-main.position[1])*scale;
  return projectWorld(rig,world);
}
export function miniPattern(trace){
  const points=trace.points.map(toPixel),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
  return {center,points:points.map(p=>[p[0]-center[0],p[1]-center[1]])};
}
