import {cameraRotation,inverseBasis,spriteBasis,spritePosition} from './model.js';

export const EYE=Object.freeze({center:[121,177],travel:[7,5.5],response:10});

// The iris is its own connected alpha island in Moon.png. Split its exact
// original pixels at load time, leaving the source PNG untouched.
export function separateEye(source,width,height,seed=EYE.center){
  const count=width*height,marked=new Uint8Array(count),queue=new Int32Array(count);
  const origin=seed[1]*width+seed[0];
  if(!source[origin*4+3])throw Error('Moon eye seed is outside the original iris.');
  let head=0,tail=0,minX=width,minY=height,maxX=0,maxY=0;
  function add(index){
    if(!marked[index]&&source[index*4+3]){marked[index]=1;queue[tail++]=index;}
  }
  add(origin);
  while(head<tail){
    const index=queue[head++],x=index%width,y=Math.floor(index/width);
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    if(x>0)add(index-1);if(x<width-1)add(index+1);
    if(y>0)add(index-width);if(y<height-1)add(index+width);
  }
  if(tail>count*.3)throw Error('Moon eye mask unexpectedly includes the outer shell.');
  const bodyAlpha=new Uint8Array(count),eyeAlpha=new Uint8Array(count);
  for(let i=0;i<count;i++){
    if(marked[i])eyeAlpha[i]=source[i*4+3];else bodyAlpha[i]=source[i*4+3];
  }
  return{bodyAlpha,eyeAlpha,bounds:[minX,minY,maxX+1,maxY+1],pixels:tail};
}
export function splitMoonImage(image){
  const source=document.createElement('canvas');source.width=image.width;source.height=image.height;
  const context=source.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  // Only alpha is read back. RGB stays in the original PNG GPU texture, avoiding
  // Canvas premultiplication/unpremultiplication loss in translucent eye pixels.
  return separateEye(context.getImageData(0,0,image.width,image.height).data,image.width,image.height);
}
const multiply=(matrix,vector)=>[0,1,2].map(i=>vector.reduce((sum,v,j)=>sum+matrix[j*3+i]*v,0));
export function eyeRig(data){
  const sprite=data.sprites[0];
  return{sprite,rotation:cameraRotation(data.camera_example.rotation_radians),inverse:inverseBasis(spriteBasis(sprite)),
    camera:data.camera_example.position,size:data.sprite_settings.quad_size,texture:data.sprite_settings.texture_size,
    fov:Math.tan(data.camera_source.fov_vertical_degrees*Math.PI/360)};
}
export function gazeTarget(rig,time,pointer){
  if(!pointer.active)return[0,0];
  const x=Math.max(0,Math.min(960,pointer.x)),y=Math.max(0,Math.min(540,pointer.y));
  const ray=multiply(rig.rotation,[(x/960*2-1)*(960/540)*rig.fov,(1-y/540*2)*rig.fov,-1]);
  const position=spritePosition(rig.sprite,time);
  const origin=multiply(rig.inverse,rig.camera.map((v,i)=>v-position[i]));
  const direction=multiply(rig.inverse,ray),distance=-origin[2]/direction[2];
  if(!Number.isFinite(distance)||distance<=0)return[0,0];
  const point=origin.map((v,i)=>v+direction[i]*distance);
  const dx=(point[0]/rig.size[0]+.5)*rig.texture[0]-EYE.center[0];
  const dy=(.5-point[1]/rig.size[1])*rig.texture[1]-EYE.center[1];
  const length=Math.hypot(dx,dy,80);
  return[EYE.travel[0]*dx/length/rig.texture[0],EYE.travel[1]*dy/length/rig.texture[1]];
}
export function followGaze(current,target,delta,reduced=false){
  const blend=reduced?1:1-Math.exp(-EYE.response*Math.max(0,delta));
  return current.map((v,i)=>Math.abs(target[i]-v)<.00001?target[i]:v+(target[i]-v)*blend);
}

export class EyeBehavior{
  constructor(random=Math.random){
    this.random=random;this.clock=0;this.mode='follow';this.until=this.between(3,5.5);
    this.look=[0,0];this.nextLook=Infinity;
  }
  between(min,max){return min+(max-min)*this.random();}
  glance(){
    const angle=this.between(0,Math.PI*2),amount=this.between(.4,.8);
    this.look=[Math.cos(angle)*amount,Math.sin(angle)*amount];
    this.nextLook=this.clock+this.between(.7,1.25);
  }
  step(delta,followTarget,textureSize,reduced=false){
    // Autonomous glances stop with reduced motion; direct pointer input remains.
    if(reduced)return followTarget;
    this.clock+=Math.max(0,delta);
    if(this.clock>=this.until){
      const choices={follow:['idle','look'],idle:['follow','look'],look:['follow','idle']};
      this.mode=choices[this.mode][this.random()<.6?0:1];
      this.until=this.clock+(this.mode==='follow'?this.between(3,5.5):this.mode==='idle'?this.between(2.5,4.5):this.between(2.5,3.8));
      if(this.mode==='look')this.glance();
    }
    if(this.mode==='look'&&this.clock>=this.nextLook)this.glance();
    if(this.mode==='follow')return followTarget;
    if(this.mode==='idle')return[0,0];
    return this.look.map((v,i)=>v*EYE.travel[i]/textureSize[i]);
  }
}
