export const fullscreen=`#version 300 es
precision highp float;out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;

export const spriteVertex=`#version 300 es
precision highp float;
uniform vec2 center,size;uniform float rotation,camera;uniform vec4 uvRect;out vec2 uv;
const vec2 V[6]=vec2[6](vec2(-.5,-.5),vec2(.5,-.5),vec2(-.5,.5),vec2(-.5,.5),vec2(.5,-.5),vec2(.5,.5));
void main(){
 vec2 v=V[gl_VertexID],p=v*size;float c=cos(rotation),s=sin(rotation);
 p=vec2(p.x*c-p.y*s,p.x*s+p.y*c)+center-vec2(480.,269.);
 c=cos(camera);s=sin(camera);p=vec2(480.,270.)+vec2(c*p.x+s*p.y,-s*p.x+c*p.y);
 gl_Position=vec4(p.x/480.-1.,1.-p.y/270.,0.,1.);uv=uvRect.xy+(v+.5)*uvRect.zw;
}`;
export const spriteFragment=`#version 300 es
precision highp float;uniform sampler2D image;uniform vec4 tint;in vec2 uv;out vec4 outColor;
void main(){outColor=texture(image,uv)*tint;}`;

export const psx=`#version 300 es
precision highp float;uniform sampler2D image;in vec2 uv;out vec4 outColor;
const float P[16]=float[16](0.,.50,.10,.65,.75,.25,.90,.35,.20,.70,.05,.50,.95,.40,.80,.30);
void main(){
 ivec2 pixel=ivec2(gl_FragCoord.x,540.-gl_FragCoord.y);
 float p=P[(pixel.y%4)*4+pixel.x%4],d=((p-.5)*p+.5)*.999;
 vec3 value=texture(image,uv).rgb*7.;
 vec3 result=(floor(value)+vec3(greaterThan(fract(value),vec3(d))))/7.;
 // The non-HDR 2D canvas quantizes display-space channels. Environment glow
 // and ACES operate on that result in linear space, not on linearized sprites.
 vec3 linear=mix(pow((result+.055)/1.055,vec3(2.4)),result/12.92,lessThanEqual(result,vec3(.04045)));
 outColor=vec4(linear,1.);
}`;

// Godot 4.3 glow's Gaussian kernel, firefly reduction, extraction and MIX.
// Source: godotengine/godot 4.3-stable, effects/copy.glsl (MIT).
export const blur=`#version 300 es
precision highp float;uniform sampler2D image;uniform vec2 stepUV;
uniform bool firstPass,vertical;uniform float strength,exposure,bloom,hdrScale,luminanceCap;
in vec2 uv;out vec4 outColor;
const float K[5]=float[5](.2024,.1790,.1240,.0672,.0285);
vec3 read(vec2 at){vec3 c=texture(image,at).rgb;if(firstPass&&!vertical)c/=1.+dot(c,vec3(.299,.587,.114)/max(luminanceCap,6.));return c;}
void main(){
 vec3 color=read(uv)*K[0];
 for(int i=1;i<5;i++){vec2 d=stepUV*float(i);color+=(read(uv+d)+read(uv-d))*K[i];}
 if(vertical){
  if(firstPass)color/=1.-dot(color,vec3(.299,.587,.114)/max(luminanceCap,6.));
  color*=strength;
  if(firstPass){color*=exposure;float luminance=max(color.r,max(color.g,color.b));float feedback=max(smoothstep(0.,hdrScale,luminance),bloom);color=min(color*feedback,vec3(luminanceCap));}
 }
 outColor=vec4(color,1.);
}`;

// ACES matrices/rational fit follow Godot's 4.3 tonemap.glsl (MIT),
// adapted from BakingLab's MIT-licensed ACES fit.
export const tonemap=`#version 300 es
precision highp float;uniform sampler2D image,glow2,glow4;uniform float exposure,whitePoint,glowMix;
in vec2 uv;out vec4 outColor;
vec3 aces(vec3 color){
 const mat3 inputMatrix=mat3(vec3(.59719*1.8,.35458*1.8,.04823*1.8),vec3(.076*1.8,.90834*1.8,.01566*1.8),vec3(.0284*1.8,.13383*1.8,.83777*1.8));
 const mat3 outputMatrix=mat3(vec3(1.60475,-.53108,-.07367),vec3(-.10208,1.10813,-.00605),vec3(-.00327,-.07276,1.07602));
 color*=inputMatrix;
 color=(color*(color+.0245786)-.000090537)/(color*(.983729*color+.432951)+.238081);
 color*=outputMatrix;
 float w=whitePoint*1.8;float mappedWhite=(w*(w+.0245786)-.000090537)/(w*(.983729*w+.432951)+.238081);
 return color/mappedWhite;
}
vec3 toSRGB(vec3 c){c=clamp(c,0.,1.);return mix(1.055*pow(c,vec3(1./2.4))-.055,12.92*c,lessThan(c,vec3(.0031308)));}
void main(){vec3 base=texture(image,uv).rgb*exposure;vec3 glow=texture(glow2,uv).rgb+texture(glow4,uv).rgb;
 outColor=vec4(toSRGB(aces(mix(base,glow,glowMix))),1.);}`;

export const composite=`#version 300 es
precision highp float;uniform sampler2D image,pattern;uniform float phase;uniform bool referenceMode;
in vec2 uv;out vec4 outColor;
float mask(float red,float opacity){return clamp(ceil(red+opacity*1.00001-1.),0.,1.);}
void main(){
 vec3 color=texture(image,uv).rgb;float alpha=1.;float red=texture(pattern,vec2(uv.x,1.-uv.y)).r;
 if(!referenceMode){if(phase<.35)alpha=1.-mask(red,1.-phase/.35);if(phase>=7.)alpha=mask(red,1.-clamp((phase-7.)/2.,0.,1.));}
 outColor=vec4(color*alpha,alpha);
}`;
