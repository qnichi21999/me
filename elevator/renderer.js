import * as shaders from './shaders.js';

const W=960,H=540;
export class ElevatorRenderer{
  static async load(canvas){
    const data=await fetch(new URL('./scene.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Elevator data unavailable');return r.json();});
    const names=['ElevatorBack','ElevatorPomp','ElevatorPompFrames','Gear2','WeirdWipe'];
    const images=await Promise.all(names.map(async name=>{const image=new Image();image.src=new URL(`./assets/${name}.png`,import.meta.url).href;await image.decode();return image;}));
    return new ElevatorRenderer(canvas,data,Object.fromEntries(names.map((name,i)=>[name,images[i]])));
  }
  constructor(canvas,data,images){
    this.canvas=canvas;this.data=data;this.images=images;this.frozen=false;
    canvas.width=W;canvas.height=H;
    const gl=this.gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'high-performance',premultipliedAlpha:true});
    if(!gl)throw Error('WebGL2 required for the elevator transition');
    this.halfFloat=!!gl.getExtension('EXT_color_buffer_float');gl.getExtension('OES_texture_float_linear');
    this.programs={sprite:this.program(shaders.spriteVertex,shaders.spriteFragment)};
    for(const name of ['psx','blur','tonemap','composite'])this.programs[name]=this.program(shaders.fullscreen,shaders[name]);
    this.textures=Object.fromEntries(Object.entries(images).map(([k,image])=>[k,this.texture(image)]));
    this.white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.white);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    this.raw=this.target(W,H);this.quantized=this.target(W,H);this.final=this.target(W,H,false);
    this.glow=[];
    for(let i=0;i<5;i++){const w=Math.max(1,W>>(i+1)),h=Math.max(1,H>>(i+1));this.glow.push({h:this.target(w,h),v:this.target(w,h)});}
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);this.uniforms=new Map();
  }
  program(vertex,fragment){
    const gl=this.gl,p=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
      const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
  }
  texture(image){
    const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);return t;
  }
  target(width,height,hdr=true){
    const gl=this.gl,texture=gl.createTexture(),fbo=gl.createFramebuffer();gl.bindTexture(gl.TEXTURE_2D,texture);
    const floating=hdr&&this.halfFloat;
    gl.texImage2D(gl.TEXTURE_2D,0,floating?gl.RGBA16F:gl.RGBA8,width,height,0,gl.RGBA,floating?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Elevator render target unavailable');
    return{texture,fbo,width,height};
  }
  uniform(p,name){let map=this.uniforms.get(p);if(!map){map=new Map();this.uniforms.set(p,map);}if(!map.has(name))map.set(name,this.gl.getUniformLocation(p,name));return map.get(name);}
  f(p,name,value){this.gl.uniform1f(this.uniform(p,name),value);}
  i(p,name,value){this.gl.uniform1i(this.uniform(p,name),value);}
  v2(p,name,x,y){this.gl.uniform2f(this.uniform(p,name),x,y);}
  bind(p,name,texture,unit=0){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);this.i(p,name,unit);}
  pass(p,target){const gl=this.gl;gl.useProgram(p);gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,target?.fbo||null);gl.viewport(0,0,target?.width||W,target?.height||H);}
  quad(texture,x,y,width,height,rotation,tint=[1,1,1,1],uv=[0,0,1,1]){
    const gl=this.gl,p=this.programs.sprite;gl.useProgram(p);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.bind(p,'image',texture);this.v2(p,'center',x,y);this.v2(p,'size',width,height);this.f(p,'rotation',rotation);this.f(p,'camera',this.camera);
    gl.uniform4fv(this.uniform(p,'tint'),tint);gl.uniform4fv(this.uniform(p,'uvRect'),uv);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  paint(s,phase){
    const gl=this.gl;this.camera=s.camera;
    this.pass(this.programs.sprite,this.raw);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
    this.quad(this.textures.ElevatorBack,479+s.shakes[0][0],269+s.shakes[0][1],960,540,0);
    this.quad(this.textures.ElevatorPomp,485+s.shakes[1][0],273+s.shakes[1][1],960,540,0);
    for(const gear of s.gears.filter(g=>!g.vertical_speed_global_px_s))this.quad(this.textures.Gear2,gear.x,gear.y,gear.size_px,gear.size_px,gear.angle,gear.modulate_rgba);
    for(let i=0;i<3;i++)this.quad(this.textures.ElevatorPompFrames,461+s.shakes[i+2][0],334+s.shakes[i+2][1],190,417,0,[1,1,1,1],[i===2?s.blink/3:0,0,1/3,1]);
    for(const gear of s.gears.filter(g=>g.vertical_speed_global_px_s))this.quad(this.textures.Gear2,gear.x,gear.y,gear.size_px,gear.size_px,gear.angle,gear.modulate_rgba);
    for(const beam of s.beams)this.quad(this.white,beam.x,beam.y,beam.width,beam.height,beam.rotation_rad,[0,0,0,1]);
    for(const plate of s.plates)this.quad(this.white,plate.x,plate.y,plate.width,plate.height,plate.angle,[0,0,0,1]);
    const psx=this.programs.psx;this.pass(psx,this.quantized);this.bind(psx,'image',this.raw.texture);gl.drawArrays(gl.TRIANGLES,0,3);
    this.quad(this.white,485.25,s.opening,971.5,552.5,0,[0,0,0,1]);
    this.quad(this.white,485.25,s.closing,1356.5,958.25,0,[0,0,0,1]);
    const blur=this.programs.blur,e=this.data.environment;
    let input=this.quantized;
    for(let i=0;i<this.glow.length;i++){
      const level=this.glow[i];
      for(const vertical of [false,true]){
        const target=vertical?level.v:level.h;
        this.pass(blur,target);this.bind(blur,'image',vertical?level.h.texture:input.texture);
        this.v2(blur,'stepUV',vertical?0:1/target.width,vertical?1/target.height:0);
        this.i(blur,'firstPass',i===0);this.i(blur,'vertical',vertical);
        this.f(blur,'strength',s.glow);this.f(blur,'exposure',e.tonemap_exposure);this.f(blur,'bloom',e.glow_bloom);
        this.f(blur,'hdrScale',2);this.f(blur,'luminanceCap',12);gl.drawArrays(gl.TRIANGLES,0,3);
      }
      input=level.v;
    }
    const tone=this.programs.tonemap;this.pass(tone,this.final);
    this.bind(tone,'image',this.quantized.texture);this.bind(tone,'glow2',this.glow[2].v.texture,1);this.bind(tone,'glow4',this.glow[4].v.texture,2);
    this.f(tone,'exposure',e.tonemap_exposure);this.f(tone,'whitePoint',e.tonemap_white);this.f(tone,'glowMix',e.glow_mix);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  render(snapshot,phase,{reference=false}={}){
    if(phase<7||!this.frozen||reference){this.paint(snapshot,Math.min(7,phase));this.frozen=phase>=7;}
    const gl=this.gl,p=this.programs.composite;this.pass(p,null);
    this.bind(p,'image',this.final.texture);this.bind(p,'pattern',this.textures.WeirdWipe,1);
    this.f(p,'phase',phase);this.i(p,'referenceMode',reference);gl.drawArrays(gl.TRIANGLES,0,3);
  }
}
