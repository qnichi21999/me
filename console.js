import { Shell } from './shell.js';
import { visibleInput } from './prompt-layout.js';

export class CRTConsole {
  constructor(invalidate, onReboot = () => {}) {
    this.shell = new Shell();
    this.input = document.querySelector('#command-input');
    this.live = document.querySelector('#terminal-transcript');
    this.invalidate = invalidate;
    this.onReboot = onReboot;
    this.focused = false;
    this.cursor = true;
    this.scroll = 0;
    this.historyIndex = 0;
    this.draft = '';
    this.composing = false;
    this.historyVersion = 0;
    this.wrappedVersion = -1;
    this.wrappedCache = [];
    this.input.addEventListener('focus', () => { this.focused = true; this.cursor = true; invalidate(); });
    this.input.addEventListener('blur', () => { this.focused = false; invalidate(); });
    this.input.addEventListener('input', () => {
      if (!this.composing && /[\r\n]/.test(this.input.value)) this.input.value = this.input.value.replace(/[\r\n]+/g, ' ');
      this.scroll = 0; this.cursor = true; invalidate();
    });
    this.input.addEventListener('compositionstart', () => { this.composing = true; });
    this.input.addEventListener('compositionend', () => { this.composing = false; invalidate(); });
    this.input.addEventListener('select', () => invalidate());
    this.input.addEventListener('keyup', e => {
      if (/^(Arrow|Home|End)/.test(e.key)) { this.cursor = true; invalidate(); }
    });
    this.input.addEventListener('keydown', event => this.keydown(event));
    this.blink = setInterval(() => {
      if (!this.focused || document.hidden) return;
      this.cursor = !this.cursor; invalidate();
    }, 500);
  }
  focus() { this.input.focus({ preventScroll: true }); }
  insertText(text) {
    this.focus();
    const room = this.input.maxLength - this.input.value.length + this.input.selectionEnd - this.input.selectionStart;
    this.input.setRangeText(text.slice(0, Math.max(0, room)), this.input.selectionStart, this.input.selectionEnd, 'end');
    this.scroll = 0; this.cursor = true; this.invalidate();
  }
  keydown(e) {
    e.stopPropagation();
    if (e.isComposing || this.composing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const command = this.input.value;
      const result = this.shell.execute(command);
      this.historyVersion++;
      this.input.value = '';
      this.historyIndex = this.shell.history.length;
      this.draft = ''; this.scroll = 0; this.cursor = true;
      if (result.reboot) {
        this.live.replaceChildren();
        this.onReboot();
      } else {
        const entry = document.createElement('p');
        entry.textContent = `${command}\n${result.output.join('\n')}`;
        this.live.append(entry);
        while (this.live.children.length > 30) this.live.firstElementChild.remove();
      }
      this.invalidate();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIndex === this.shell.history.length) this.draft = this.input.value;
      this.historyIndex = Math.max(0, Math.min(this.shell.history.length, this.historyIndex + (e.key === 'ArrowUp' ? -1 : 1)));
      this.input.value = this.historyIndex === this.shell.history.length ? this.draft : this.shell.history[this.historyIndex];
      this.input.setSelectionRange(this.input.value.length, this.input.value.length);
      this.cursor = true; this.invalidate();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault(); this.shell.lines = []; this.shell.started = true; this.scroll = 0; this.historyVersion++; this.invalidate();
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault(); this.scrollBy(e.key === 'PageUp' ? 9 : -9);
    } else if (e.key === 'Escape') {
      e.preventDefault(); this.input.blur();
    }
  }
  scrollBy(rows) {
    const total = this.wrappedLines().length;
    this.scroll = Math.max(0, Math.min(Math.max(0, total - 14), this.scroll + rows));
    this.invalidate();
  }
  wrappedLines() {
    if (this.wrappedVersion === this.historyVersion) return this.wrappedCache;
    const rows = [];
    for (const line of this.shell.lines) {
      const chars = Array.from(line.text);
      if (!chars.length) rows.push(line);
      for (let i = 0; i < chars.length; i += 68) rows.push({ text: chars.slice(i, i + 68).join(''), color: line.color });
    }
    this.wrappedVersion = this.historyVersion;
    this.wrappedCache = rows;
    return rows;
  }
  drawHistory(glowText) {
    const rows = this.wrappedLines();
    this.scroll = Math.min(this.scroll, Math.max(0, rows.length - 14));
    const end = rows.length - this.scroll;
    const visible = rows.slice(Math.max(0, end - 14), end);
    visible.forEach((line, i) => glowText(line.text, 370, 185 + i * 48, 39, line.color, .80));
    if (this.scroll) glowText(`[scrollback +${this.scroll}]`, 1325, 870, 26, '#888e87', .75);
  }
  drawPrompt(ctx, glowText) {
    const size = 57, scale = .84;
    const x = 350, y = 919;
    const value = this.input.value;
    const chars = Array.from(value);
    const cursorIndex = Array.from(value.slice(0, this.input.selectionStart)).length;
    ctx.save(); ctx.font = `${size}px Terminal`;
    const cell = ctx.measureText('M').width * scale;
    const prefix = this.shell.prompt;
    const measure = text => ctx.measureText(text).width * scale;
    const available = 1670 - x - cell;
    const { start, end } = visibleInput(chars, cursorIndex, available - measure(prefix), measure);
    const shown = chars.slice(start, end).join('');
    ctx.beginPath(); ctx.rect(342, 895, 1340, 104); ctx.clip();
    if (this.focused && this.input.selectionEnd > this.input.selectionStart) {
      const from = Array.from(value.slice(0, this.input.selectionStart)).length;
      const to = Array.from(value.slice(0, this.input.selectionEnd)).length;
      ctx.fillStyle = '#65676288';
      const left = measure(prefix + chars.slice(start, Math.max(start, from)).join(''));
      const right = measure(prefix + chars.slice(start, Math.min(to, end)).join(''));
      ctx.fillRect(x + left, y + 9, Math.max(0, right - left), size * .77);
    }
    glowText(prefix + shown, x, y, size, '#ebedeb', scale);
    if (!this.focused || this.cursor) {
      const caretX = x + measure(prefix + chars.slice(start, cursorIndex).join(''));
      ctx.fillStyle = '#d0d2cc';
      ctx.shadowColor = '#bbb'; ctx.shadowBlur = 8;
      ctx.fillRect(caretX, y + 8, Math.max(3, cell * .75), 43);
    }
    ctx.restore();
  }
}
