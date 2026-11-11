import{traceLine as _atlasLine}from"../code-trace.js";// Futile batches exported from SS_AI. Positions, UVs and vertex colors are packed
// separately from the original textures so the room is still rasterized live.
const LEVEL=(_atlasLine?.("4022190079051589d81d:3"),5);const PROJECTION=(_atlasLine?.("4022190079051589d81d:4"),8);const STRIDE=(_atlasLine?.("4022190079051589d81d:5"),16);const PEARL_SLOTS=(_atlasLine?.("4022190079051589d81d:6"),5);const VERTEX=(_atlasLine?.("4022190079051589d81d:7"),`#version 300 es
layout(location=0) in vec2 position;
layout(location=1) in vec2 texCoord;
layout(location=2) in vec4 tint;
layout(location=3) in int pearl;
uniform highp int material;
uniform vec2 resolution;
uniform vec4 projectionRect;
uniform int storyPearlIds[${_atlasLine?.("4022190079051589d81d:15"),PEARL_SLOTS}];
uniform vec4 storyPearlPositions[${_atlasLine?.("4022190079051589d81d:16"),PEARL_SLOTS}];
uniform vec2 storyPearlFaults[${_atlasLine?.("4022190079051589d81d:17"),PEARL_SLOTS}];
out vec2 uv;
out vec4 color;
void main() {
  if (material == 8) {
    const vec2 quad[6] = vec2[6](vec2(0,0), vec2(1,0), vec2(0,1), vec2(0,1), vec2(1,0), vec2(1,1));
    uv = quad[gl_VertexID];
    vec2 p = (projectionRect.xy + uv * projectionRect.zw) / resolution;
    gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
    color = vec4(1.0);
    return;
  }
  vec2 p = position / 16384.0;
  uv = texCoord;
  color = tint / 255.0;
  if (pearl >= 0) {
    bool visible = false;
    for (int i = 0; i < ${_atlasLine?.("4022190079051589d81d:34"),PEARL_SLOTS}; ++i) {
      if (pearl == storyPearlIds[i]) {
        vec4 anchor = storyPearlPositions[i];
        p = p - anchor.xy + anchor.zw;
        vec2 fault = storyPearlFaults[i];
        if (fault.x > 0.0) {
          color.rgb = material == 3 ? vec3(1.0, 0.16, 0.30)
            : vec3(1.0, 0.055 + color.g * 0.17, 0.12 + color.g * 0.14);
          p.x += fault.y / resolution.x * (material == 3 ? -1.0 : 1.0);
        }
        visible = true;
        break;
      }
    }
    if (!visible) {
      gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
      return;
    }
  }
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`);const FRAGMENT=(_atlasLine?.("4022190079051589d81d:56"),`#version 300 es
precision highp float;
uniform sampler2D sprite;
uniform sampler2D terrain;
uniform sampler2D coolPalette;
uniform sampler2D redPalette;
uniform sampler2D preLevel;
uniform vec2 resolution;
uniform vec4 levelRect;
uniform vec4 coldLamp;
uniform float redLight;
uniform float projectionOpacity;
uniform highp int material;
in vec2 uv;
in vec4 color;
out vec4 pixel;

vec3 palette(ivec2 cell) {
  return mix(texelFetch(coolPalette, cell, 0).rgb, texelFetch(redPalette, cell, 0).rgb, redLight);
}
ivec3 codeAt(vec2 p) {
  return ivec3(round(texture(terrain, p).rgb * 255.0));
}
float depthAt(vec2 p) {
  ivec3 code = codeAt(p);
  if (all(equal(code, ivec3(255)))) return 1.0;
  return mod(float(code.r - 1), 30.0) / 30.0;
}
bool actorAt(vec2 p) {
  vec3 c = texture(preLevel, p).rgb;
  return c.r > 1.5 / 255.0 || c.g > 0.0 || c.b > 0.0;
}
bool projectionBlocker(vec2 p) {
  return any(greaterThan(texture(preLevel, p).rgb, vec3(1.0 / 255.0, 0.0, 0.0)));
}

// Futile/Projection uses the room's depth map and its pre-level color grab.
// The same image lands at different offsets on each depth plane.
vec4 projectImage(vec2 viewport, vec2 levelUV) {
  const vec2 lightAngle = vec2(0.454, 0.891);
  const vec2 shadowPixel = vec2(-0.454 / 1400.0, 0.891 / 800.0);
  ivec3 terrainCode = codeAt(levelUV);
  int depth = (terrainCode.r - 1) % 30;
  if (depth < 1) discard;
  vec2 shadowOffset = shadowPixel * float(depth - 5);
  const vec2 shadowOrigin = vec2(0.5, 0.3);
  vec2 shadowPoint = (viewport + shadowOffset - shadowOrigin) * (1.0 + float(depth - 5) / 460.0) + shadowOrigin;
  if (!projectionBlocker(viewport) || depth < 5) {
    if (all(equal(terrainCode, ivec3(255))) || terrainCode.r <= 90) discard;
    if (depth > 5 && projectionBlocker(shadowPoint)) discard;
  } else {
    ivec3 occluder = codeAt(levelUV + vec2(shadowOffset.x, -shadowOffset.y));
    if (!all(equal(occluder, ivec3(255)))) {
      if ((occluder.r - 1) % 30 < 6) discard;
      depth = 5;
    }
  }
  vec2 shift = -lightAngle * float(depth - 5) / vec2(textureSize(sprite, 0));
  vec4 image = texture(sprite, uv + shift);
  return vec4(image.rgb, image.a * projectionOpacity);
}

void main() {
  vec2 viewport = gl_FragCoord.xy / resolution;
  vec2 screen = vec2(viewport.x, 1.0 - viewport.y);
  vec2 levelUV = (screen - levelRect.xy) / (levelRect.zw - levelRect.xy);
  if (material == 8) {
    pixel = projectImage(viewport, levelUV);
  } else if (material == 5) {
    ivec3 data = codeAt(uv);
    bool sky = all(equal(data, ivec3(255)));
    int code = max(0, (data.r > 90 ? data.r - 90 : data.r) - 1);
    int depth = code % 30;
    if ((sky || depth >= 5) && actorAt(viewport)) {
      pixel = vec4(texture(preLevel, viewport).rgb, 1.0);
      return;
    }
    if (sky) {
      pixel = vec4(palette(ivec2(0, 0)), 1.0);
      return;
    }
    int surface = min(2, code / 30);
    int column = (data.g & 16) != 0 ? 0 : depth;
    // Rain World's backdrop writes 1 into the red channel. Black oracle
    // projections interrupt that mask and expose the lit palette beneath them.
    vec2 edge = vec2(viewport.x, 1.0 - viewport.y);
    vec2 shadowOffset = vec2(-0.454 / 1400.0, 0.891 / 800.0) * float(depth - 5);
    vec2 projected = viewport + shadowOffset * clamp(edge / 0.3, 0.0, 1.0);
    vec2 origin = vec2(0.5, 0.3);
    vec2 perspective = origin + (projected - origin) * (1.0 + float(depth - 5) / 460.0);
    projected = mix(projected, perspective, clamp(edge / 0.1, 0.0, 1.0));
    vec3 blocker = texture(preLevel, projected).rgb;
    bool shadow = data.r <= 90 || (depth >= 5 && any(greaterThan(blocker, vec3(0.0))));
    vec3 base = palette(ivec2(column, (shadow ? 7 : 4) - surface));
    if ((data.g & 7) == 1 || (data.g & 7) == 2) {
      int row = (data.g & 7) == 1 ? 2 : 4;
      int effectColumn = shadow ? 31 : 30;
      base = mix(base, mix(palette(ivec2(effectColumn, row)), palette(ivec2(effectColumn, row + 1)),
        float(depth) / 30.0), float(data.b) / 255.0);
    }
    float fog = (1.0 - palette(ivec2(9, 0)).r) * float(depth) / 30.0;
    pixel = vec4(mix(base, palette(ivec2(1, 0)), fog), 1.0);
  } else if (material == 6) {
    float depth = depthAt(levelUV);
    if (depth > 5.0/30.0 && actorAt(viewport)) discard;
    vec2 direction = uv - vec2(0.5);
    float radius = min(length(direction), 0.5);
    direction /= max(length(direction), 0.00001);
    float surface = floor(float(codeAt(levelUV).r % 90) / 30.0);
    float blocked = depthAt(levelUV - direction * pow(radius, 1.25) * depth * depth * 0.3);
    vec2 shadowPoint = viewport - vec2(direction.x, -direction.y) * pow(radius, 1.25) * pow(depth, 1.5) * 0.3;
    if (blocked > 5.0/30.0 && actorAt(shadowPoint)) blocked = 6.0/30.0;
    float shadow = pow(clamp(depth - blocked - (surface == 1.0 ? 0.0 : 2.0/30.0), 0.0, 1.0),
      mix(1.0 - depth, 0.5, 0.5));
    if (surface == 0.0) {
      float edge = depthAt(levelUV - direction * (0.01 * radius));
      if (edge < depth && edge > depth - 0.1) shadow = mix(shadow, 1.0, pow(radius * 2.0, 2.5 - radius * 4.0));
    }
    float highlightDepth = depthAt(levelUV - direction * 0.003 * pow(radius * 2.0, 0.25));
    float highlight = highlightDepth > depth + 0.05 ? sin(radius * 6.28) : 0.0;
    float shade = depth < 0.2 ? pow(1.0 - depth * 5.0, 0.35) : clamp((depth - 0.2) * 1.3, 0.0, 1.0);
    float light = (1.0 - shade) * pow(max(0.0, 1.0 - 4.0 * radius * radius), 3.5 * mix(0.5, 3.5, depth));
    light = clamp(mix(light, 0.0, shadow) - shadow * 0.3, 0.0, 1.0);
    if (surface == 0.0) light *= 0.8;
    if (surface == 2.0) light = pow(light, 0.8);
    if (depthAt(levelUV) < 0.01) light = 0.0;
    vec4 lamp = mix(coldLamp, color, coldLamp.a < 0.0 ? 1.0 : redLight);
    pixel = vec4(lamp.rgb, light * texture(sprite, uv).r * lamp.a * (0.65 + highlight * 0.35));
  } else if (material == 3) {
    vec2 glyph = vec2((floor(color.a * 50.0) + uv.x) / 50.0, uv.y);
    if (texture(sprite, glyph).r >= 0.5) discard;
    pixel = vec4(color.rgb, 1.0);
  } else if (material == 4) {
    float edge = length(uv - vec2(0.5)) * 2.0;
    if (edge < 1.0 - color.a || edge >= 1.0) discard;
    pixel = vec4(color.rgb, 1.0);
  } else if (material == 7) {
    if (depthAt(levelUV) < 0.2 || actorAt(viewport)) discard;
    float edge = length(uv - vec2(0.5)) * 2.0;
    pixel = vec4(color.rgb, color.a * pow(max(0.0, 1.0 - edge * edge), 3.5));
  } else {
    pixel = texture(sprite, uv) * color;
  }
}`);function compile(gl,kind,text){_atlasLine?.("4022190079051589d81d:201");const shader=(_atlasLine?.("4022190079051589d81d:202"),gl.createShader(kind));_atlasLine?.("4022190079051589d81d:203");gl.shaderSource(shader,text);_atlasLine?.("4022190079051589d81d:204");gl.compileShader(shader);_atlasLine?.("4022190079051589d81d:205");if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){_atlasLine?.("4022190079051589d81d:205");_atlasLine?.("4022190079051589d81d:205");throw new Error(gl.getShaderInfoLog(shader));}else{void 0;}_atlasLine?.("4022190079051589d81d:206");return shader;}function readFrames(bytes){_atlasLine?.("4022190079051589d81d:209");const data=(_atlasLine?.("4022190079051589d81d:210"),new DataView(bytes));const count=(_atlasLine?.("4022190079051589d81d:211"),data.getUint32(0,true));let offset=(_atlasLine?.("4022190079051589d81d:212"),4);_atlasLine?.("4022190079051589d81d:213");return Array.from({length:count},()=>{_atlasLine?.("4022190079051589d81d:213");const end=(_atlasLine?.("4022190079051589d81d:214"),offset+4+data.getUint32(offset,true));const pose=(_atlasLine?.("4022190079051589d81d:215"),new Float32Array(bytes,offset+4,82));const layerCount=(_atlasLine?.("4022190079051589d81d:216"),data.getUint32(offset+332,true));_atlasLine?.("4022190079051589d81d:217");offset+=336;let first=(_atlasLine?.("4022190079051589d81d:218"),0);const layers=(_atlasLine?.("4022190079051589d81d:219"),Array.from({length:layerCount},()=>{_atlasLine?.("4022190079051589d81d:219");const layer=(_atlasLine?.("4022190079051589d81d:220"),{material:data.getUint8(offset),texture:data.getUint8(offset+1),count:data.getUint32(offset+4,true),first});_atlasLine?.("4022190079051589d81d:222");first+=layer.count;_atlasLine?.("4022190079051589d81d:223");offset+=8;_atlasLine?.("4022190079051589d81d:224");return layer;}));const vertices=(_atlasLine?.("4022190079051589d81d:226"),new Uint8Array(bytes,offset,end-offset));_atlasLine?.("4022190079051589d81d:227");offset=end;_atlasLine?.("4022190079051589d81d:228");return{pose,layers,vertices};});}async function image(url){_atlasLine?.("4022190079051589d81d:232");const result=(_atlasLine?.("4022190079051589d81d:233"),new Image());_atlasLine?.("4022190079051589d81d:234");result.src=url;_atlasLine?.("4022190079051589d81d:235");await result.decode();_atlasLine?.("4022190079051589d81d:236");return result;}export async function loadRoomData(){_atlasLine?.("4022190079051589d81d:239");const[metadata,binary]=(_atlasLine?.("4022190079051589d81d:240"),await Promise.all([(_atlasLine?.("4022190079051589d81d:241"),fetch(new URL('./geometry.json',import.meta.url))),(_atlasLine?.("4022190079051589d81d:241"),fetch(new URL('./geometry.bin.gz',import.meta.url)))]));_atlasLine?.("4022190079051589d81d:243");if((_atlasLine?.("4022190079051589d81d:243"),!metadata.ok)||(_atlasLine?.("4022190079051589d81d:243"),!binary.ok)){_atlasLine?.("4022190079051589d81d:243");_atlasLine?.("4022190079051589d81d:243");throw new Error('The Rain World geometry could not be loaded.');}else{void 0;}const{textures,rig,environmentLights}=(_atlasLine?.("4022190079051589d81d:244"),await metadata.json());const[bytes,images]=(_atlasLine?.("4022190079051589d81d:245"),await Promise.all([(_atlasLine?.("4022190079051589d81d:246"),new Response(binary.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()),(_atlasLine?.("4022190079051589d81d:247"),Promise.all([...textures,'palette25.png','palette26.png'].map(name=>{_atlasLine?.("4022190079051589d81d:247");_atlasLine?.("4022190079051589d81d:247");return image(new URL(name,import.meta.url));})))]));const mesh=(_atlasLine?.("4022190079051589d81d:249"),readFrames(bytes)[0]);// Each native LightSource is a 64-triangle disc. The four room lights
// precede Pebbles' moving amber light in the exported batch.
_atlasLine?.("4022190079051589d81d:252");mesh.layers=mesh.layers.flatMap(layer=>{_atlasLine?.("4022190079051589d81d:252");_atlasLine?.("4022190079051589d81d:253");if((_atlasLine?.("4022190079051589d81d:253"),layer.material!==6)||(_atlasLine?.("4022190079051589d81d:253"),layer.count!==192*(environmentLights.length+1))){_atlasLine?.("4022190079051589d81d:253");_atlasLine?.("4022190079051589d81d:253");return[layer];}else{void 0;}_atlasLine?.("4022190079051589d81d:254");return[...environmentLights,null].map((rgb,index)=>{_atlasLine?.("4022190079051589d81d:254");const strength=(_atlasLine?.("4022190079051589d81d:255"),(_atlasLine?.("4022190079051589d81d:255"),rgb)&&(_atlasLine?.("4022190079051589d81d:255"),Math.max(...rgb)));const coldLamp=(_atlasLine?.("4022190079051589d81d:256"),(_atlasLine?.("4022190079051589d81d:256"),rgb)&&(_atlasLine?.("4022190079051589d81d:256"),[...rgb.map(channel=>{_atlasLine?.("4022190079051589d81d:256");_atlasLine?.("4022190079051589d81d:256");return channel/Math.max(1,strength);}),strength/255]));_atlasLine?.("4022190079051589d81d:257");return{...layer,first:layer.first+index*192,count:192,coldLamp};});});_atlasLine?.("4022190079051589d81d:260");return{mesh,rig,images,whiteTexture:textures.indexOf('white.png'),terrain:textures.indexOf('ss_ai_1.png')};}export function createRoomRenderer(canvas,data){_atlasLine?.("4022190079051589d81d:263");const gl=(_atlasLine?.("4022190079051589d81d:264"),canvas.getContext('webgl2',{alpha:false,antialias:false}));_atlasLine?.("4022190079051589d81d:265");if(!gl){_atlasLine?.("4022190079051589d81d:265");_atlasLine?.("4022190079051589d81d:265");throw new Error('The chamber requires WebGL 2.');}else{void 0;}const{width,height}=(_atlasLine?.("4022190079051589d81d:266"),canvas);const program=(_atlasLine?.("4022190079051589d81d:267"),gl.createProgram());const shaders=(_atlasLine?.("4022190079051589d81d:268"),[compile(gl,gl.VERTEX_SHADER,VERTEX),compile(gl,gl.FRAGMENT_SHADER,FRAGMENT)]);_atlasLine?.("4022190079051589d81d:269");for(const shader of shaders){_atlasLine?.("4022190079051589d81d:269");gl.attachShader(program,shader);}_atlasLine?.("4022190079051589d81d:270");gl.linkProgram(program);_atlasLine?.("4022190079051589d81d:271");for(const shader of shaders){_atlasLine?.("4022190079051589d81d:271");gl.deleteShader(shader);}_atlasLine?.("4022190079051589d81d:272");if(!gl.getProgramParameter(program,gl.LINK_STATUS)){_atlasLine?.("4022190079051589d81d:272");_atlasLine?.("4022190079051589d81d:272");throw new Error(gl.getProgramInfoLog(program));}else{void 0;}_atlasLine?.("4022190079051589d81d:273");gl.useProgram(program);_atlasLine?.("4022190079051589d81d:274");const loc=name=>{_atlasLine?.("4022190079051589d81d:274");_atlasLine?.("4022190079051589d81d:274");return gl.getUniformLocation(program,name);};const light=(_atlasLine?.("4022190079051589d81d:275"),loc('redLight')),mode=(_atlasLine?.("4022190079051589d81d:275"),loc('material')),rect=(_atlasLine?.("4022190079051589d81d:275"),loc('levelRect')),coldLamp=(_atlasLine?.("4022190079051589d81d:275"),loc('coldLamp'));const projectionRect=(_atlasLine?.("4022190079051589d81d:276"),loc('projectionRect')),projectionOpacity=(_atlasLine?.("4022190079051589d81d:276"),loc('projectionOpacity'));const pearlIds=(_atlasLine?.("4022190079051589d81d:277"),loc('storyPearlIds[0]')),pearlPositions=(_atlasLine?.("4022190079051589d81d:277"),loc('storyPearlPositions[0]'));const pearlFaults=(_atlasLine?.("4022190079051589d81d:278"),loc('storyPearlFaults[0]'));const ids=(_atlasLine?.("4022190079051589d81d:279"),new Int32Array(PEARL_SLOTS)),positions=(_atlasLine?.("4022190079051589d81d:279"),new Float32Array(PEARL_SLOTS*4));const faults=(_atlasLine?.("4022190079051589d81d:280"),new Float32Array(PEARL_SLOTS*2));_atlasLine?.("4022190079051589d81d:281");gl.uniform2f(loc('resolution'),width,height);_atlasLine?.("4022190079051589d81d:282");['sprite','terrain','coolPalette','redPalette','preLevel'].forEach((name,i)=>{_atlasLine?.("4022190079051589d81d:283");_atlasLine?.("4022190079051589d81d:283");return gl.uniform1i(loc(name),i);});function texture(){_atlasLine?.("4022190079051589d81d:285");const result=(_atlasLine?.("4022190079051589d81d:286"),gl.createTexture());_atlasLine?.("4022190079051589d81d:287");gl.bindTexture(gl.TEXTURE_2D,result);_atlasLine?.("4022190079051589d81d:288");gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);_atlasLine?.("4022190079051589d81d:289");gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);_atlasLine?.("4022190079051589d81d:290");gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);_atlasLine?.("4022190079051589d81d:291");gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);_atlasLine?.("4022190079051589d81d:292");return result;}_atlasLine?.("4022190079051589d81d:294");gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);const textures=(_atlasLine?.("4022190079051589d81d:295"),data.images.map(source=>{_atlasLine?.("4022190079051589d81d:295");const result=(_atlasLine?.("4022190079051589d81d:296"),texture());_atlasLine?.("4022190079051589d81d:297");gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);_atlasLine?.("4022190079051589d81d:298");return result;}));const pre=(_atlasLine?.("4022190079051589d81d:300"),texture());_atlasLine?.("4022190079051589d81d:301");gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);_atlasLine?.("4022190079051589d81d:302");gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);_atlasLine?.("4022190079051589d81d:303");gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);const grab=(_atlasLine?.("4022190079051589d81d:304"),gl.createFramebuffer());_atlasLine?.("4022190079051589d81d:305");gl.bindFramebuffer(gl.FRAMEBUFFER,grab);_atlasLine?.("4022190079051589d81d:306");gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,pre,0);_atlasLine?.("4022190079051589d81d:307");gl.bindFramebuffer(gl.FRAMEBUFFER,null);const buffer=(_atlasLine?.("4022190079051589d81d:309"),gl.createBuffer());const positionBuffer=(_atlasLine?.("4022190079051589d81d:310"),gl.createBuffer());_atlasLine?.("4022190079051589d81d:311");gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);_atlasLine?.("4022190079051589d81d:312");gl.vertexAttribPointer(0,2,gl.SHORT,false,0,0);_atlasLine?.("4022190079051589d81d:313");gl.bindBuffer(gl.ARRAY_BUFFER,buffer);_atlasLine?.("4022190079051589d81d:314");gl.vertexAttribPointer(1,2,gl.UNSIGNED_SHORT,true,STRIDE,4);_atlasLine?.("4022190079051589d81d:315");gl.vertexAttribPointer(2,4,gl.UNSIGNED_BYTE,false,STRIDE,8);_atlasLine?.("4022190079051589d81d:316");gl.vertexAttribIPointer(3,1,gl.SHORT,STRIDE,12);_atlasLine?.("4022190079051589d81d:317");for(let i=(_atlasLine?.("4022190079051589d81d:317"),0);i<4;i++){_atlasLine?.("4022190079051589d81d:317");gl.enableVertexAttribArray(i);}_atlasLine?.("4022190079051589d81d:318");[textures[data.terrain],...textures.slice(-2),pre].forEach((item,i)=>{_atlasLine?.("4022190079051589d81d:318");_atlasLine?.("4022190079051589d81d:319");gl.activeTexture(gl.TEXTURE1+i);_atlasLine?.("4022190079051589d81d:320");gl.bindTexture(gl.TEXTURE_2D,item);});_atlasLine?.("4022190079051589d81d:322");gl.activeTexture(gl.TEXTURE0);_atlasLine?.("4022190079051589d81d:323");gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);_atlasLine?.("4022190079051589d81d:324");gl.clearColor(0,0,0,0);const projectionTextures=(_atlasLine?.("4022190079051589d81d:326"),new WeakMap());function drawProjection({image,x,y,width,height,opacity,revision}){_atlasLine?.("4022190079051589d81d:327");let source=(_atlasLine?.("4022190079051589d81d:328"),projectionTextures.get(image));_atlasLine?.("4022190079051589d81d:329");if(!source){_atlasLine?.("4022190079051589d81d:329");_atlasLine?.("4022190079051589d81d:330");source={texture:texture(),revision};_atlasLine?.("4022190079051589d81d:331");gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);_atlasLine?.("4022190079051589d81d:332");gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);_atlasLine?.("4022190079051589d81d:333");gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);_atlasLine?.("4022190079051589d81d:334");projectionTextures.set(image,source);}else{_atlasLine?.("4022190079051589d81d:335");_atlasLine?.("4022190079051589d81d:336");gl.bindTexture(gl.TEXTURE_2D,source.texture);_atlasLine?.("4022190079051589d81d:337");if(revision!==source.revision){_atlasLine?.("4022190079051589d81d:337");_atlasLine?.("4022190079051589d81d:338");gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,image);_atlasLine?.("4022190079051589d81d:339");source.revision=revision;}else{void 0;}}_atlasLine?.("4022190079051589d81d:342");gl.uniform1i(mode,PROJECTION);_atlasLine?.("4022190079051589d81d:343");gl.uniform4f(projectionRect,x-width/2,y-height/2,width,height);_atlasLine?.("4022190079051589d81d:344");gl.uniform1f(projectionOpacity,opacity);_atlasLine?.("4022190079051589d81d:345");gl.drawArrays(gl.TRIANGLES,0,6);}let resident,residentPosition,residentDischarges;_atlasLine?.("4022190079051589d81d:349");return(frame,blend=(_atlasLine?.("4022190079051589d81d:349"),0),projection=(_atlasLine?.("4022190079051589d81d:349"),null),pearls=(_atlasLine?.("4022190079051589d81d:349"),[]))=>{_atlasLine?.("4022190079051589d81d:349");_atlasLine?.("4022190079051589d81d:350");if(resident!==frame){_atlasLine?.("4022190079051589d81d:350");_atlasLine?.("4022190079051589d81d:351");gl.bindBuffer(gl.ARRAY_BUFFER,buffer);_atlasLine?.("4022190079051589d81d:352");gl.bufferData(gl.ARRAY_BUFFER,frame.vertices,gl.DYNAMIC_DRAW);_atlasLine?.("4022190079051589d81d:353");gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);_atlasLine?.("4022190079051589d81d:354");gl.bufferData(gl.ARRAY_BUFFER,frame.positions,gl.DYNAMIC_DRAW);_atlasLine?.("4022190079051589d81d:355");gl.uniform4fv(rect,frame.pose.subarray(78,82));_atlasLine?.("4022190079051589d81d:356");resident=frame;_atlasLine?.("4022190079051589d81d:357");residentPosition=frame.positionRevision;_atlasLine?.("4022190079051589d81d:358");residentDischarges=frame.discharge.revisions.slice();}else{_atlasLine?.("4022190079051589d81d:359");_atlasLine?.("4022190079051589d81d:359");if(residentPosition!==frame.positionRevision){_atlasLine?.("4022190079051589d81d:359");_atlasLine?.("4022190079051589d81d:360");gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);_atlasLine?.("4022190079051589d81d:361");gl.bufferSubData(gl.ARRAY_BUFFER,0,frame.positions);_atlasLine?.("4022190079051589d81d:362");residentPosition=frame.positionRevision;const{start,stride,revisions}=(_atlasLine?.("4022190079051589d81d:363"),frame.discharge);_atlasLine?.("4022190079051589d81d:364");for(let i=(_atlasLine?.("4022190079051589d81d:364"),0);i<revisions.length;i++){_atlasLine?.("4022190079051589d81d:365");if(residentDischarges[i]===revisions[i]){_atlasLine?.("4022190079051589d81d:365");_atlasLine?.("4022190079051589d81d:365");continue;}else{void 0;}const offset=(_atlasLine?.("4022190079051589d81d:366"),start+i*stride);_atlasLine?.("4022190079051589d81d:367");gl.bindBuffer(gl.ARRAY_BUFFER,buffer);_atlasLine?.("4022190079051589d81d:368");gl.bufferSubData(gl.ARRAY_BUFFER,offset,frame.vertices,offset,stride);_atlasLine?.("4022190079051589d81d:369");residentDischarges[i]=revisions[i];}}else{void 0;}}_atlasLine?.("4022190079051589d81d:372");gl.uniform1f(light,blend);_atlasLine?.("4022190079051589d81d:373");ids.fill(-1);_atlasLine?.("4022190079051589d81d:374");for(const[index,pearl]of pearls.entries()){_atlasLine?.("4022190079051589d81d:375");ids[index]=pearl.sprite;_atlasLine?.("4022190079051589d81d:376");positions.set([frame.pose[2+pearl.sprite*2],frame.pose[3+pearl.sprite*2],(_atlasLine?.("4022190079051589d81d:377"),pearl.x/width),(_atlasLine?.("4022190079051589d81d:377"),pearl.y/height)],(_atlasLine?.("4022190079051589d81d:377"),index*4));_atlasLine?.("4022190079051589d81d:378");faults.set([Number(Boolean(pearl.corrupted)),(_atlasLine?.("4022190079051589d81d:378"),pearl.glitch)??(_atlasLine?.("4022190079051589d81d:378"),0)],index*2);}_atlasLine?.("4022190079051589d81d:380");gl.uniform1iv(pearlIds,ids);_atlasLine?.("4022190079051589d81d:381");gl.uniform4fv(pearlPositions,positions);_atlasLine?.("4022190079051589d81d:382");gl.uniform2fv(pearlFaults,faults);_atlasLine?.("4022190079051589d81d:383");gl.bindFramebuffer(gl.FRAMEBUFFER,grab);_atlasLine?.("4022190079051589d81d:384");gl.activeTexture(gl.TEXTURE4);_atlasLine?.("4022190079051589d81d:385");gl.bindTexture(gl.TEXTURE_2D,null);_atlasLine?.("4022190079051589d81d:386");gl.activeTexture(gl.TEXTURE0);_atlasLine?.("4022190079051589d81d:387");gl.clear(gl.COLOR_BUFFER_BIT);_atlasLine?.("4022190079051589d81d:388");gl.enable(gl.BLEND);_atlasLine?.("4022190079051589d81d:389");for(const layer of frame.layers){_atlasLine?.("4022190079051589d81d:390");if(layer.material===LEVEL){_atlasLine?.("4022190079051589d81d:390");_atlasLine?.("4022190079051589d81d:391");gl.bindFramebuffer(gl.FRAMEBUFFER,null);_atlasLine?.("4022190079051589d81d:392");gl.activeTexture(gl.TEXTURE4);_atlasLine?.("4022190079051589d81d:393");gl.bindTexture(gl.TEXTURE_2D,pre);_atlasLine?.("4022190079051589d81d:394");gl.activeTexture(gl.TEXTURE0);_atlasLine?.("4022190079051589d81d:395");gl.disable(gl.BLEND);}else{void 0;}_atlasLine?.("4022190079051589d81d:397");gl.uniform1i(mode,layer.material);_atlasLine?.("4022190079051589d81d:398");if(layer.material===6){_atlasLine?.("4022190079051589d81d:398");_atlasLine?.("4022190079051589d81d:398");gl.uniform4fv(coldLamp,(_atlasLine?.("4022190079051589d81d:398"),layer.coldLamp)??(_atlasLine?.("4022190079051589d81d:398"),[0,0,0,-1]));}else{void 0;}_atlasLine?.("4022190079051589d81d:399");gl.bindTexture(gl.TEXTURE_2D,textures[layer.texture]);_atlasLine?.("4022190079051589d81d:400");gl.drawArrays(gl.TRIANGLES,layer.first,layer.count);_atlasLine?.("4022190079051589d81d:401");if(layer.material===LEVEL){_atlasLine?.("4022190079051589d81d:401");_atlasLine?.("4022190079051589d81d:402");gl.enable(gl.BLEND);_atlasLine?.("4022190079051589d81d:403");if(projection){_atlasLine?.("4022190079051589d81d:403");_atlasLine?.("4022190079051589d81d:403");drawProjection(projection);}else{void 0;}}else{void 0;}}};}