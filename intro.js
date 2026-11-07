const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const easeOut=x=>1-Math.pow(1-clamp(x),3);

// A single entrance, measured in visible scene time. No timers or input lock.
export function introState(time,reduced=false){
  if(reduced)time=4;
  return{
    x:.001+.999*easeOut((time-.02)/.28),
    y:.004+.996*easeOut((time-.30)/.60),
    opacity:smooth(time/.045),
    flash:smooth(time/.045)*(1-smooth((time-.32)/.44)),
    ascii:!((time>=.80&&time<.90)||(time>=.98&&time<1.08)),
  };
}

// Only the terminal uses this power cycle. The character, wires and scene
// clock continue independently; keep the previous texture until it is dark.
export function rebootState(time,reduced=false){
  if(reduced)return {...introState(4),keepFrame:false,phase:'on',done:true};
  if(time>=.66)return {...introState(time-.66),keepFrame:false,phase:time>=1.8?'on':'startup',done:time>=1.8};
  return{
    x:.001+.999*(1-smooth((time-.24)/.20)),
    y:.004+.996*(1-smooth(time/.24)),
    opacity:1-smooth((time-.40)/.06),
    flash:smooth(time/.045)*(1-smooth((time-.30)/.14)),
    ascii:true,keepFrame:time<.46,phase:time<.46?'shutdown':'off',done:false,
  };
}
export function growth(time,index,front=false){
  return easeOut((time-(front?.95:1.05)-index*.022)/1.35);
}
export function coilArrival(time,index){return easeOut((time-1.12-index*.035)/1.25);}
