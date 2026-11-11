import{traceLine as _atlasLine}from"../code-trace.js";export const fullscreen=(_atlasLine?.("e40c8d3ba1e5b92b6af8:1"),`#version 300 es
precision highp float;out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`);const common=(_atlasLine?.("e40c8d3ba1e5b92b6af8:5"),`
precision highp float;
uniform sampler2D panorama;
uniform mat3 cameraRotation;
uniform float fovScale,skyEnergy;
in vec2 uv;
vec3 worldRay(){return normalize(cameraRotation*vec3((uv.x*2.-1.)*(960./540.)*fovScale,(uv.y*2.-1.)*fovScale,-1.));}
vec3 skyColor(vec3 ray){
 float longitude=atan(ray.x,-ray.z);
 if(longitude<0.)longitude+=6.283185307179586;
 vec2 skyUV=vec2(longitude/6.283185307179586,acos(clamp(ray.y,-1.,1.))/3.141592653589793);
 return textureLod(panorama,skyUV,0.).rgb*skyEnergy;
}`);export const sky=(_atlasLine?.("e40c8d3ba1e5b92b6af8:19"),`#version 300 es
${_atlasLine?.("e40c8d3ba1e5b92b6af8:20"),common}
out vec4 outColor;
void main(){outColor=vec4(skyColor(worldRay()),1.);}`);export const compose=(_atlasLine?.("e40c8d3ba1e5b92b6af8:24"),`#version 300 es
${_atlasLine?.("e40c8d3ba1e5b92b6af8:25"),common}
uniform sampler2D moon,bodyAlpha,eyeAlpha,skyCache,stars,orbitStars;
uniform bool cachedSky;
uniform vec3 cameraPosition,moonPosition[2];
uniform mat3 inverseBasis[2];
uniform float moonAlpha[2];
uniform vec2 quadSize,clipRange,gaze;
uniform float irisFault;
uniform vec3 starMirror;
uniform float starHeight;
uniform int spriteCount;
out vec4 outColor;
vec3 toSRGB(vec3 c){c=clamp(c,0.,1.);return mix(1.055*pow(c,vec3(1./2.4))-.055,12.92*c,lessThanEqual(c,vec3(.0031308)));}
vec4 starAt(vec2 screen){
 if(screen.x<0.||screen.x>1.||screen.y<0.||screen.y>=starHeight/540.)return vec4(0.);
 return texture(stars,vec2(screen.x,screen.y*540./starHeight));
}
vec3 starsOver(vec3 color,vec3 ray){
 vec4 direct=starAt(vec2(uv.x,1.-uv.y));
 color+=direct.rgb*direct.a;
 // Reflect points in the moon's original 3D plane, using the same inverted
 // Y scale and linear-space opacity as Moon2. The screen-space dither follows.
 vec3 origin=inverseBasis[0]*(cameraPosition-moonPosition[0]);
 vec3 direction=inverseBasis[0]*ray;
 float distance=-origin.z/direction.z;
 vec3 source=cameraPosition+ray*distance;
 source.y=starMirror.x+(starMirror.y-source.y)/starMirror.z;
 vec3 view=transpose(cameraRotation)*(source-cameraPosition);
 vec2 screen=vec2((view.x/(-view.z)/(960./540.)/fovScale+1.)*.5,(1.-view.y/(-view.z)/fovScale)*.5);
 vec4 reflected=starAt(screen);
 return color+reflected.rgb*reflected.a*moonAlpha[1];
}
float lunarDisc(vec3 ray,int index){
 vec3 origin=inverseBasis[index]*(cameraPosition-moonPosition[index]);
 vec3 direction=inverseBasis[index]*ray;
 float distance=-origin.z/direction.z;
 vec3 hit=origin+direction*distance;
 if(index>=spriteCount||distance<clipRange.x||distance>clipRange.y)return 0.;
 return 1.-smoothstep(.995,1.005,length(hit.xy/(quadSize*.5)));
}
vec3 orbitsOver(vec3 color,bool front,vec3 ray){
 vec4 pattern=texture(orbitStars,vec2(uv.x,((1.-uv.y)+(front?1.:0.))*.5));
 // The original moon has transparent gaps around its iris. A distant orbit
 // belongs behind the lunar silhouette, rather than shining through those gaps.
 if(!front&&pattern.a>0.)pattern.a*=(1.-lunarDisc(ray,0))*(1.-lunarDisc(ray,1));
 return color+pattern.rgb*pattern.a;
}
vec3 spriteOver(vec3 color,vec3 ray,int index){
 // Intersect the original fixed 3D quad. This keeps perspective, its slanted
 // basis and the reflected negative Y axis; neither sprite is a billboard.
 vec3 origin=inverseBasis[index]*(cameraPosition-moonPosition[index]);
 vec3 direction=inverseBasis[index]*ray;
 float distance=-origin.z/direction.z;
 vec3 hit=origin+direction*distance;
 vec2 spriteUV=vec2(hit.x/quadSize.x+.5,.5-hit.y/quadSize.y);
 vec2 gradientX=dFdx(spriteUV),gradientY=dFdy(spriteUV);
 vec4 body=textureGrad(moon,spriteUV,gradientX,gradientY);
 vec2 eyeUV=spriteUV-gaze;
 eyeUV.x+=irisFault*step(.65,fract(eyeUV.y*37.));
 vec4 eye=textureGrad(moon,eyeUV,gradientX,gradientY);
 body.a=textureGrad(bodyAlpha,spriteUV,gradientX,gradientY).r;
 eye.a=textureGrad(eyeAlpha,eyeUV,gradientX,gradientY).r;
 bool inside=all(lessThanEqual(abs(hit.xy),quadSize*.5));
 if(index>=spriteCount||!inside||distance<clipRange.x||distance>clipRange.y)return color;
 // The iris moves behind the stationary moon shell. The reflected quad uses
 // the same texture-space gaze, so its negative Y basis mirrors the motion.
 float alpha=(body.a+eye.a*(1.-body.a))*moonAlpha[index];
 vec3 premultiplied=body.rgb*body.a+eye.rgb*eye.a*(1.-body.a);
 return premultiplied*moonAlpha[index]+color*(1.-alpha);
}
void main(){
 vec3 ray=worldRay();
 vec3 color=cachedSky?texture(skyCache,uv).rgb:skyColor(ray);
 color=starsOver(color,ray);
 color=orbitsOver(color,false,ray);
 color=spriteOver(color,ray,0);
 color=spriteOver(color,ray,1);
 color=orbitsOver(color,true,ray);
 outColor=vec4(toSRGB(color),1.);
}`);export const psx=(_atlasLine?.("e40c8d3ba1e5b92b6af8:106"),`#version 300 es
precision highp float;
uniform sampler2D image;uniform bool enabled;
in vec2 uv;out vec4 outColor;
const float P[16]=float[16](0.,.50,.10,.65,.75,.25,.90,.35,.20,.70,.05,.50,.95,.40,.80,.30);
void main(){
 ivec2 pixel=ivec2(gl_FragCoord.x,540.-gl_FragCoord.y);
 vec3 color=texelFetch(image,ivec2(gl_FragCoord.xy),0).rgb;
 // Preserve the source ColorRect's two uncovered bottom rows.
 if(enabled&&pixel.y<538){
  float p=P[(pixel.y%4)*4+pixel.x%4],threshold=((p-.5)*p+.5)*.999;
  vec3 value=color*7.;color=(floor(value)+vec3(greaterThan(fract(value),vec3(threshold))))/7.;
 }
 outColor=vec4(color,1.);
}`);