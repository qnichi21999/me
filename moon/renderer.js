import {fullscreen,sky,compose,psx} from './shaders.js';
import {inverseBasis,cameraRotation,spritePosition,spriteBasis} from './model.js';
import {splitMoonImage} from './eye.js';
import {GRID} from '../hex/model.js';

export class MoonRenderer{
  static async load(canvas){
    const base=new URL('./',import.meta.url);
    const response=await fetch(new URL('scene.json',base));
    if(!response.ok)throw Error(`Moon scene: HTTP ${response.status}`);
    const data=await response.json();
    const images=await Promise.all([data.sky.texture,data.sprite_settings.texture].map(async path=>{
      const image=new Image();image.src=new URL(path,base).href;await image.decode();return image;
    }));
    return new MoonRenderer(canvas,data,images);
  }
  constructor(canvas,data,images){
    this.canvas=canvas;this.data=data;this.images=images;
    canvas.width=data.viewport.width;canvas.height=data.viewport.height;
    const gl=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
    if(!gl)throw Error('WebGL 2 is required for the moon scene.');
    gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.DITHER);
    this.uniforms=new Map();
    this.skyProgram=this.program(sky);this.composeProgram=this.program(compose);this.psxProgram=this.program(psx);
    const layers=splitMoonImage(images[1]);
    canvas.dataset.eyeBounds=JSON.stringify(layers.bounds);canvas.dataset.eyePixels=String(layers.pixels);
    this.panorama=this.texture(images[0],false);this.moon=this.texture(images[1],true);
    this.bodyAlpha=this.alphaTexture(layers.bodyAlpha,images[1].width,images[1].height);
    this.eyeAlpha=this.alphaTexture(layers.eyeAlpha,images[1].width,images[1].height);
    const stars=document.createElement('canvas');stars.width=GRID.width;stars.height=GRID.height;
    this.stars=this.texture(stars,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    const orbits=document.createElement('canvas');orbits.width=960;orbits.height=1080;
    this.orbits=this.texture(orbits,false);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    this.encoded=this.target(false);
    this.skyCache=gl.getExtension('EXT_color_buffer_float')?this.target(true):null;
    this.rotation=cameraRotation(data.camera_example.rotation_radians);
    this.inverse=data.sprites.map(sprite=>inverseBasis(spriteBasis(sprite)));
    if(this.skyCache){
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.skyCache.fbo);gl.viewport(0,0,960,540);
      this.use(this.skyProgram);this.bind(this.skyProgram,'panorama',this.panorama,0);
      this.setCamera(this.skyProgram);gl.drawArrays(gl.TRIANGLES,0,3);
    }
  }
  program(fragment){
    const gl=this.gl,program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,fullscreen],[gl.FRAGMENT_SHADER,fragment]]){
      const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    this.uniforms.set(program,new Map());return program;
  }
  location(program,name){const map=this.uniforms.get(program);if(!map.has(name))map.set(name,this.gl.getUniformLocation(program,name));return map.get(name);}
  use(program){this.gl.useProgram(program);}
  bind(program,name,texture,unit){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(this.location(program,name),unit);}
  texture(image,mipmaps){
    const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,mipmaps?gl.CLAMP_TO_EDGE:gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mipmaps?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
    if(mipmaps)gl.generateMipmap(gl.TEXTURE_2D);return texture;
  }
  alphaTexture(values,width,height){
    const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,width,height,0,gl.RED,gl.UNSIGNED_BYTE,values);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);return texture;
  }
  updateStars(canvas,orbits){
    const gl=this.gl;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    for(const [source,texture,unit] of [[canvas,this.stars,5],[orbits,this.orbits,6]]){
      if(!source)continue;
      gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,source);
    }
  }
  target(float){
    const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,float?gl.RGBA16F:gl.RGBA8,960,540,0,gl.RGBA,float?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete moon framebuffer');
    return{texture,fbo};
  }
  setCamera(program){
    const gl=this.gl,data=this.data;
    gl.uniformMatrix3fv(this.location(program,'cameraRotation'),false,this.rotation);
    gl.uniform1f(this.location(program,'fovScale'),Math.tan(data.camera_source.fov_vertical_degrees*Math.PI/360));
    gl.uniform1f(this.location(program,'skyEnergy'),data.sky.background_energy_multiplier*data.sky.material_energy_multiplier);
  }
  render(time,{layer='full',gaze=[0,0]}={}){
    const gl=this.gl,data=this.data,p=this.composeProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.encoded.fbo);gl.viewport(0,0,960,540);this.use(p);
    this.bind(p,'panorama',this.panorama,0);this.bind(p,'moon',this.moon,1);this.bind(p,'skyCache',this.skyCache?.texture||this.panorama,2);
    this.bind(p,'bodyAlpha',this.bodyAlpha,3);this.bind(p,'eyeAlpha',this.eyeAlpha,4);
    this.bind(p,'stars',this.stars,5);
    this.bind(p,'orbitStars',this.orbits,6);
    gl.uniform1f(this.location(p,'starHeight'),GRID.height);
    gl.uniform1i(this.location(p,'cachedSky'),!!this.skyCache);this.setCamera(p);
    gl.uniform3fv(this.location(p,'cameraPosition'),data.camera_example.position);
    gl.uniform2fv(this.location(p,'quadSize'),data.sprite_settings.quad_size);
    gl.uniform2f(this.location(p,'clipRange'),data.camera_source.near,data.camera_source.far);
    gl.uniform2fv(this.location(p,'gaze'),gaze);
    gl.uniform3f(this.location(p,'starMirror'),data.sprites[0].position[1],data.sprites[1].position[1],Math.abs(data.sprites[1].basis_columns[1][1]/data.sprites[0].basis_columns[1][1]));
    gl.uniform1i(this.location(p,'spriteCount'),layer.startsWith('sky')?0:layer==='moon'?1:2);
    data.sprites.forEach((sprite,i)=>{
      gl.uniform3fv(this.location(p,`moonPosition[${i}]`),spritePosition(sprite,time));
      gl.uniformMatrix3fv(this.location(p,`inverseBasis[${i}]`),false,this.inverse[i]);
      gl.uniform1f(this.location(p,`moonAlpha[${i}]`),sprite.modulate_rgba[3]);
    });
    gl.drawArrays(gl.TRIANGLES,0,3);
    const post=this.psxProgram;gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.use(post);
    this.bind(post,'image',this.encoded.texture,0);gl.uniform1i(this.location(post,'enabled'),layer!=='sky'&&layer!=='raw');gl.drawArrays(gl.TRIANGLES,0,3);
  }
}
