const W = 2048, H = 1162;
const quad = new Float32Array([-.5,-.5,.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,.5]);

export class WireMesh {
  constructor() { this.data = new Float32Array(600000); this.count = 0; }
  reset() { this.count = 0; }
  add(points, color, width, feather, progress=1, reverse=false, offsetX=0, offsetY=0) {
    const core = width / 2, extent = core + feather;
    const r = parseInt(color.slice(1,3),16)/255;
    const g = parseInt(color.slice(3,5),16)/255;
    const b = parseInt(color.slice(5,7),16)/255;
    const emit = (x,y,edge) => {
      const n = this.count;
      this.data[n]=x+offsetX;this.data[n+1]=y+offsetY;this.data[n+2]=r;this.data[n+3]=g;
      this.data[n+4]=b;this.data[n+5]=edge;this.data[n+6]=core;this.count+=7;
    };
    const end=points.length-1,travel=end*Math.max(0,Math.min(1,progress));
    for(let i=0;i<Math.ceil(travel);i++) {
      const a=points[reverse?end-i:i],b=points[reverse?end-i-1:i+1];
      const fraction=Math.min(1,travel-i),bx=a.rx+(b.rx-a.rx)*fraction,by=a.ry+(b.ry-a.ry)*fraction;
      const dx=bx-a.rx,dy=by-a.ry,length=Math.hypot(dx,dy)||1;
      const nx=-dy/length*extent,ny=dx/length*extent;
      emit(a.rx+nx,a.ry+ny,extent);emit(a.rx-nx,a.ry-ny,-extent);emit(bx+nx,by+ny,extent);
      emit(bx+nx,by+ny,extent);emit(a.rx-nx,a.ry-ny,-extent);emit(bx-nx,by-ny,-extent);
    }
  }
}

export class GPURenderer {
  constructor(canvas) {
    this.canvas=canvas;
    const gl=this.gl=canvas.getContext('webgl', {alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});
    if(!gl)throw Error('WebGL unavailable');
    const program=(vs,fs)=>{
      const p=gl.createProgram();
      for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
        const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
        gl.attachShader(p,s);gl.deleteShader(s);
      }
      gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
      return p;
    };
    this.wires=program(`
      attribute vec2 position;attribute vec3 color;attribute float edge;attribute float core;
      uniform vec2 offset;varying vec3 vColor;varying float vEdge;varying float vCore;
      void main(){vec2 p=position+offset;gl_Position=vec4(p.x/1024.-1.,1.-p.y/581.,0.,1.);vColor=color;vEdge=edge;vCore=core;}
    `,`precision mediump float;varying vec3 vColor;varying float vEdge;varying float vCore;uniform float feather;
      void main(){float a=1.-smoothstep(vCore,vCore+feather,abs(vEdge));gl_FragColor=vec4(vColor*a,a);}`);
    const layerVertex=`
      attribute vec2 position;uniform vec2 center;uniform vec2 size;uniform float angle;varying vec2 vUv;
      void main(){vec2 p=position*size;float c=cos(angle),s=sin(angle);p=vec2(p.x*c-p.y*s,p.x*s+p.y*c)+center;
      gl_Position=vec4(p.x/1024.-1.,1.-p.y/581.,0.,1.);vUv=position+.5;}`;
    this.layers=program(layerVertex,`precision mediump float;uniform sampler2D image;uniform float opacity;uniform float startupGlow;varying vec2 vUv;
      void main(){
        vec4 col=texture2D(image,vUv);
        // Clip inside the bezel in the terminal's own coordinates, before
        // entrance scaling, parallax, rotation and the common CRT distortion.
        vec2 pixel=vUv*vec2(2048.,1162.);
        float inside=smoothstep(334.,340.,pixel.x)*(1.-smoothstep(1704.,1710.,pixel.x))
          *smoothstep(150.,156.,pixel.y)*(1.-smoothstep(1019.,1025.,pixel.y));
        float beam=exp(-pow((pixel.y-581.)/435.75,2.))*inside*startupGlow*1.65;
        col.rgb+=vec3(.8,.91,1.)*beam;
        gl_FragColor=col*opacity;
      }`);
    this.echo=program(layerVertex,`
      precision highp float;uniform sampler2D image;uniform float opacity,time,activity;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float silhouette(vec2 p){vec4 c=texture2D(image,p);return smoothstep(.025,.17,max(c.r,max(c.g,c.b))*c.a);}
      void main(){
        // Keep the echo around the figure, rather than duplicating long wires
        // across the original full image. Preserve the original PNG untouched.
        float focus=1.-smoothstep(.34,.47,length((vUv-.5)*vec2(2.4,1.)));
        if(focus<.001)discard;
        float tick=floor(time*12.),row=floor(vUv.y*86.);
        float tear=(hash(vec2(row,tick))-.5)*step(.86,hash(vec2(row*.71,floor(time*3.))));
        vec2 warp=vec2(sin(vUv.y*83.+time*2.6)*.0017+sin(vUv.y*171.-time*3.5)*.0009+tear*.009,
          sin(vUv.x*71.-time*2.4)*.0014)*(.4+activity*.9);
        vec2 ghostUV=vUv+warp;
        vec4 ghost=texture2D(image,ghostUV);
        float ring=silhouette(ghostUV)*(1.-silhouette((vUv-.5)*1.1+.5));
        float grain=hash(floor(ghostUV*vec2(960.,540.))+vec2(tick,tick*.37));
        float bands=.72+.28*sin(vUv.y*440.+time*5.);
        float fray=mix(.42,1.,smoothstep(.12,.73,grain));
        float light=.35+.65*sqrt(max(0.,dot(ghost.rgb,vec3(.2126,.7152,.0722))));
        float alpha=ring*focus*opacity*bands*fray;
        gl_FragColor=vec4(vec3(light)*alpha,alpha);
      }`);
    this.post=program(`attribute vec2 position;varying vec2 vUv;
      void main(){vUv=position+.5;gl_Position=vec4(position*2.,0.,1.);}`,`
      precision highp float;varying vec2 vUv;uniform sampler2D image;uniform vec2 resolution;uniform float fit;uniform float time;
      float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
      void main(){
        vec2 p=(vUv-.5)*resolution/(vec2(2048.,1162.)*fit*.5);
        if(abs(p.x)>1.002||abs(p.y)>1.002){gl_FragColor=vec4(0.,0.,0.,1.);return;}
        vec2 q=p*vec2(1.+.048*p.y*p.y+.013*p.x*p.x,1.+.23*p.x*p.x+.017*p.y*p.y);
        vec2 uv=q*.5+.5;
        if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
        float split=.00049*(.6+length(uv-.5));
        vec3 col=vec3(texture2D(image,uv+vec2(split,0.)).r,texture2D(image,uv).g,texture2D(image,uv-vec2(split,0.)).b)*1.035;
        col*=.962+.038*sin(uv.y*1162.*3.14159265);
        col*=1.+.004*sin(time*18.4)+.002*sin(time*49.1);
        col+=(hash(floor(uv*vec2(2048.,1162.))+mod(floor(time*12.),100.))-.5)*.017;
        col*=1.-.22*pow(length(p*vec2(.76,.65)),2.);
        gl_FragColor=vec4(pow(max(col,0.),vec3(.94)),1.);
      }`);
    this.attributes=new Map();this.uniforms=new Map();
    for(const p of [this.wires,this.layers,this.echo,this.post]){
      this.attributes.set(p,Object.fromEntries(['position','color','edge','core'].map(n=>[n,gl.getAttribLocation(p,n)])));
      this.uniforms.set(p,Object.fromEntries(['offset','feather','image','center','size','angle','opacity','resolution','fit','time','startupGlow','activity'].map(n=>[n,gl.getUniformLocation(p,n)])));
    }
    this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);
    this.meshBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.meshBuffer);gl.bufferData(gl.ARRAY_BUFFER,600000*4,gl.DYNAMIC_DRAW);
    this.target=gl.createFramebuffer();this.sceneTexture=this.texture();
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    this.resize();
  }
  texture(source) {
    const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
    for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
    if(source){gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
    return t;
  }
  update(texture,source,x=0,y=0){
    const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,gl.RGBA,gl.UNSIGNED_BYTE,source);
  }
  resize(){
    const gl=this.gl;
    const dpr=Math.min(devicePixelRatio||1,1.25,Math.sqrt(1500000/(innerWidth*innerHeight)));
    this.canvas.width=Math.round(innerWidth*dpr);this.canvas.height=Math.round(innerHeight*dpr);
    const fit=Math.min(this.canvas.width/W,this.canvas.height/H);
    this.width=Math.min(1600,Math.max(640,Math.round(W*fit)));
    this.height=Math.round(this.width*H/W);this.feather=W/this.width;
    gl.bindTexture(gl.TEXTURE_2D,this.sceneTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.width,this.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.target);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.sceneTexture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete scene framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  use(program,buffer){
    const gl=this.gl;gl.useProgram(program);
    for(let i=0;i<4;i++)gl.disableVertexAttribArray(i);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    return [this.attributes.get(program),this.uniforms.get(program)];
  }
  begin(){
    const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.target);gl.viewport(0,0,this.width,this.height);
    gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  }
  drawWires(mesh,x,y){
    const gl=this.gl,[a,u]=this.use(this.wires,this.meshBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.data.subarray(0,mesh.count));
    for(const [name,size,offset] of [['position',2,0],['color',3,8],['edge',1,20],['core',1,24]]){
      gl.enableVertexAttribArray(a[name]);gl.vertexAttribPointer(a[name],size,gl.FLOAT,false,28,offset);
    }
    gl.uniform2f(u.offset,x,y);gl.uniform1f(u.feather,this.feather);
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,mesh.count/7);
  }
  drawLayer(texture,x,y,width,height,angle=0,opacity=1,screen=false,startupGlow=0){
    const gl=this.gl,[a,u]=this.use(this.layers,this.quad);
    gl.enableVertexAttribArray(a.position);gl.vertexAttribPointer(a.position,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(u.image,0);
    gl.uniform2f(u.center,x,y);gl.uniform2f(u.size,width,height);gl.uniform1f(u.angle,angle);gl.uniform1f(u.opacity,opacity);
    gl.uniform1f(u.startupGlow,startupGlow);
    gl.blendFunc(gl.ONE,screen?gl.ONE_MINUS_SRC_COLOR:gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  drawEcho(texture,x,y,width,height,angle,opacity,time,activity){
    const gl=this.gl,[a,u]=this.use(this.echo,this.quad);
    gl.enableVertexAttribArray(a.position);gl.vertexAttribPointer(a.position,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(u.image,0);
    gl.uniform2f(u.center,x,y);gl.uniform2f(u.size,width,height);gl.uniform1f(u.angle,angle);
    gl.uniform1f(u.opacity,opacity);gl.uniform1f(u.time,time);gl.uniform1f(u.activity,activity);
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_COLOR);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  finish(time){
    const gl=this.gl,[a,u]=this.use(this.post,this.quad);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.disable(gl.BLEND);
    gl.enableVertexAttribArray(a.position);gl.vertexAttribPointer(a.position,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.sceneTexture);gl.uniform1i(u.image,0);
    gl.uniform2f(u.resolution,this.canvas.width,this.canvas.height);
    gl.uniform1f(u.fit,Math.min(this.canvas.width/W,this.canvas.height/H));gl.uniform1f(u.time,time);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
}
