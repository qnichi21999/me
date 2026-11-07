import {bobWeight} from './reference-math.js';

export function spriteBasis(sprite){
  // The package labels these triples "basis_columns", but its TSCN serializes
  // nine scalar Basis arguments in row order. Match the native reference frame
  // and the actual Godot 4.3 parser, rather than the mislabeled JSON/GLB export.
  return sprite.basis_columns[0].map((_,i)=>sprite.basis_columns.map(row=>row[i]));
}

// Column-major matrices, matching the extracted Godot basis columns.
export function inverseBasis(columns){
  const [a,b,c]=columns;
  const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const x=cross(b,c),y=cross(c,a),z=cross(a,b);
  const determinant=a.reduce((sum,v,i)=>sum+v*x[i],0);
  return [x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]].map(v=>v/determinant);
}
export function cameraRotation([x,y,z]){
  const sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
  // Godot's default YXZ Euler order: Ry * Rx * Rz.
  return [cy*cz+sy*sx*sz,cx*sz,-sy*cz+cy*sx*sz,
    -cy*sz+sy*sx*cz,cx*cz,sy*sz+cy*sx*cz,
    sy*cx,-sx,cy*cx];
}
export function spritePosition(sprite,time){
  const weight=bobWeight(time);
  return sprite.position.map((v,i)=>v+sprite.motion_delta[i]*weight);
}
