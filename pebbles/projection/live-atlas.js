import {setTraceListener} from '../../code-trace.js';

const HOLD_MS = 420;
const SAMPLE_MS = 50;
const MINT = '#00ffad';
const PINK = '#ef4aac';
const CYAN = '#00bbc7';

class LiveAtlas {
  constructor(base, marks, aperture) {
    this.base = base;
    this.width = base.width;
    this.height = base.height;
    this.duration = 9.5;
    const [left, top, right, bottom] = aperture;
    this.aperture = [left, top, right - left + 1, bottom - top + 1];
    this.marks = new Map(Object.entries(marks).map(([id, mark]) => [id, mark.rect]));
    this.recent = new Map();
    this.pending = new Set();
    this.image = document.createElement('canvas');
    this.image.width = this.width;
    this.image.height = this.height;
    this.context = this.image.getContext('2d');
    this.context.drawImage(base, 0, 0);
    this.revision = 0;
    this.active = false;
    this.previous = '';
    this.nextSample = 0;
    this.record = id => {
      this.pending.add(id);
      this.latest = id;
    };
  }

  sample() {
    if (!this.active) {
      setTraceListener(this.record);
      this.active = true;
    }
    const now = performance.now();
    if (now < this.nextSample) return this;
    this.nextSample = now + SAMPLE_MS;
    for (const id of this.pending) {
      if (!this.marks.has(id)) continue;
      // Keep a newly active line visible even amid regularly executed frame code.
      if (now - (this.recent.get(id) ?? -Infinity) > HOLD_MS) {
        this.accent = {id, until:now + HOLD_MS};
      }
      this.recent.set(id, now);
    }
    this.pending.clear();
    for (const [id, time] of this.recent) {
      if (now - time > HOLD_MS) this.recent.delete(id);
    }
    const focus = this.accent?.until > now ? this.accent.id : this.latest;
    const newest = this.recent.has(focus) ? focus : '';
    const signature = JSON.stringify([newest, ...this.recent.keys()]);
    if (signature === this.previous) return this;
    this.previous = signature;

    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgb(0 0 0 / 42%)';
    ctx.fillRect(...this.aperture);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = MINT;
    for (const id of this.recent.keys()) ctx.fillRect(...this.marks.get(id));
    if (newest) {
      const [x,y,width,height] = this.marks.get(newest);
      ctx.fillStyle = PINK;
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = CYAN;
      ctx.fillRect(x, y, Math.min(width, 3), height);
    }
    this.revision++;
    return this;
  }

  stop() {
    if (!this.active) return;
    setTraceListener(null);
    this.active = false;
    this.latest = null;
    this.accent = null;
    this.pending.clear();
    this.recent.clear();
    this.nextSample = 0;
  }
}

export async function loadLiveAtlas(url, fetchResource = fetch) {
  const tableURL = new URL('me-atlas.trace.json', url);
  const [png, table] = await Promise.all([fetchResource(url), fetchResource(tableURL)]);
  if (!png.ok || !table.ok) throw new Error('Could not load the live atlas pair');
  const [blob, data] = await Promise.all([png.blob(), table.json()]);
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const hex = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (data.version !== 2 || data.sha256 !== hex) throw new Error('Live atlas needs to be rebuilt');
  const image = await createImageBitmap(blob);
  if (image.width !== data.size[0] || image.height !== data.size[1]) {
    image.close();
    throw new Error('Live atlas dimensions do not match its map');
  }
  return new LiveAtlas(image, data.marks, data.aperture);
}
