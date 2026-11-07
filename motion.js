export const STAGE = { width: 2048, height: 1162 };

export function glowIntensity(time,reduced=false){
  if(reduced)return .24;
  const sample=n=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};
  const noise=t=>{
    const cell=Math.floor(t),f=t-cell,blend=f*f*(3-2*f);
    return sample(cell)+(sample(cell+1)-sample(cell))*blend;
  };
  // Irregular, gently smoothed flicker with a permanent luminous floor.
  return .14+.19*noise(time*2.6)+.045*noise(time*11.3);
}

// This is the same inverse lens mapping used by the fragment shader.
export function toScene(x, y, width, height) {
  const fit = Math.min(width / STAGE.width, height / STAGE.height);
  const px = (x - width / 2) / (STAGE.width * fit / 2);
  const py = (y - height / 2) / (STAGE.height * fit / 2);
  return {
    x: (px * (1 + .048 * py * py + .013 * px * px) + 1) * STAGE.width / 2,
    y: (py * (1 + .23 * px * px + .017 * py * py) + 1) * STAGE.height / 2,
    inside: Math.abs(px) <= 1 && Math.abs(py) <= 1,
  };
}

export function cableNodes(points) {
  const nodes = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i];
    const c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    const steps = Math.max(4, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / 22));
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const sample = k => .5 * ((2 * b[k]) + (-a[k] + c[k]) * t +
        (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 +
        (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
      nodes.push({ x: sample(0), y: sample(1), dx: 0, dy: 0, vx: 0, vy: 0 });
    }
  }
  const end = points.at(-1);
  nodes.push({ x: end[0], y: end[1], dx: 0, dy: 0, vx: 0, vy: 0 });
  return nodes;
}

export function stepCable(nodes, delta, pointer, layerX = 0, layerY = 0) {
  // Small integration steps also keep returning from a suspended tab stable.
  let remaining = Math.min(Math.max(delta, 0), .05);
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120);
    for (let i = 1; i < nodes.length - 1; i++) {
      const p = nodes[i];
      const x = p.x + layerX - pointer.x, y = p.y + layerY - pointer.y;
      const distance = Math.hypot(x, y);
      const influence = pointer.active ? Math.max(0, 1 - distance / 180) : 0;
      const anchored = Math.min(1, i / 3, (nodes.length - 1 - i) / 3);
      const force = influence * influence * 44 * anchored;
      const nx = distance > .01 ? x / distance : 0;
      const ny = distance > .01 ? y / distance : -1;
      p.vx += ((nx * force - p.dx) * 150 - p.vx * 15) * dt;
      p.vy += ((ny * force - p.dy) * 150 - p.vy * 15) * dt;
      p.dx += p.vx * dt; p.dy += p.vy * dt;
    }
    remaining -= dt;
  }
}
