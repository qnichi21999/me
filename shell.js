import {patternHints} from './hex/patterns.js';
const files = {pattern: patternHints().join('\n')};

export class Shell {
  constructor() {
    this.lines = [];
    this.history = [];
    this.started = false;
    this.cwd = 'D:\\';
  }
  get prompt() { return `${this.cwd}>`; }
  execute(raw, now = new Date()) {
    const command = raw.replace(/[\r\n]/g, ' ').trim().slice(0, 512);
    const prompt = this.prompt;
    this.started = true;
    if (!command) { this.lines.push({ text: prompt, color: '#9b9d9b' }); return { output: [] }; }
    this.history.push(command);
    const match = command.match(/^(\S+)(?:\s+([\s\S]*))?$/);
    const name = match[1].toLowerCase(), args = match[2] || '';
    let output = [], error = false, reboot = false;
    switch (name) {
      case 'help':
        output = ['Q16 / COMMANDS', '',
          'help          list commands',
          'echo <text>   print text',
          'clear / cls   clear the screen',
          'dir / ls      list files',
          'cat <file>    read a file',
          'pwd / cd      current directory / change directory',
          'whoami        show your identity',
          'date / time   current date and time',
          'history       command history',
          'reboot        restore the initial screen']; break;
      case 'echo': output = [args.replace(/^(["'])([\s\S]*)\1$/, '$2')]; break;
      case 'clear': case 'cls': this.lines = []; return { output: [] };
      case 'dir': case 'ls': output = Object.keys(files); if (!output.length) output = ['Directory is empty.']; break;
      case 'cat': case 'type': {
        const file = args.trim().replace(/^D:[\\/]/i, '').toLowerCase();
        if (Object.hasOwn(files, file)) output = files[file].split('\n');
        else { output = [`File not found: ${args || '(specify a filename)'}`]; error = true; }
        break;
      }
      case 'pwd': output = [this.cwd]; break;
      case 'cd':
        if (!args) output = [this.cwd];
        else if (['.', '..', '/', '\\', 'd:', 'd:\\', 'd:/'].includes(args.toLowerCase())) this.cwd = 'D:\\';
        else { output = [`Directory not found: ${args}`]; error = true; }
        break;
      case 'whoami': output = ['qnichi']; break;
      case 'date': output = [now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })]; break;
      case 'time': output = [now.toLocaleTimeString('en-US')]; break;
      case 'history': output = this.history.map((item, i) => `${String(i + 1).padStart(3)}  ${item}`); break;
      case 'reboot': this.lines = []; this.started = false; this.cwd = 'D:\\'; reboot = true; break;
      default: output = [`Command not found: ${match[1]}`, 'Type help for a list of commands.']; error = true;
    }
    if (!reboot) {
      this.lines.push({ text: `${prompt}${command}`, color: '#b8bbb8' });
      this.lines.push(...output.map(text => ({ text, color: error ? '#ec101c' : '#e4e5df' })));
      this.lines.push({ text: '', color: '#e4e5df' });
      this.lines = this.lines.slice(-500);
    }
    return { output, reboot, error };
  }
}
