// Hex Casting (MIT), FallingColors/HexMod commit
// 2b61049d62d7812d3ca6325229255727c07a4af9. See LICENSE.txt.
// Canonical signatures from HexActions.java, including great spells.
// Sources are retained in reference/hexcasting/. These are deliberately hidden
// from the site's console hints. No Minecraft actions are executed.
export const HEX_CASTING_PATTERNS=Object.freeze([
  "qaq","aa","dd","wa","awq","wq",
  "wqaawdd","weddwaa","weaqa","dde","eaqwqae","eaqwqaewede",
  "eaqwqaewdd","aqwqawaaqa","aawdd","aaeaa","ddqdd","aadaa",
  "aaedd","ddqaa","aadadaaw","qwaeawqaeaqa","aadaadaa","ddad",
  "aada","qaawdde","waaw","wddw","waqaw","wdedw",
  "wqaqw","wedew","ewq","qwe","eqqqqq","qeeeee",
  "qqqqqaww","wdw","waw","dw","dwa","e",
  "q","ee","qq","ad","da","wawdw",
  "wdwaw","aw","awdd","eqqq","qqqqqaa","qqqqqad",
  "wqqqqqadq","ddeeeee","adeeeee","eadeeeeew","deadeeeeewd","eqaqe",
  "addwaad","aweaqa","de","aawaawaa","ddwddwdd","awqqqwaqw",
  "awqqqwaq","qaqqqqq","eeeeede","awddwqawqwawq","dwaawedwewdwe","aqawqadaq",
  "dedwedade","aaqawawa","ddedwdwd","qqa","qqd","wqaqwawqaqw",
  "qqqqqwaeaeaeaeaea","qdqawwaww","wqaqwd","adaa","waqqqqq","wwaqqqqqeaqeaeqqqeaeq",
  "wwaqqqqqeawqwqwqwqwqwwqqeadaeqqeqqeadaeqq","aqqqaqwwaqqqqqeqaqqqawwqwqwqwqwqw","qqqqqaqwawaw","qqqqqawwawawd","qqqqqaewawawe","qqqqqadwawaww",
  "qqqqqadwawaw","qqqqaawawaedd","qqqaawawaeqdd","qqaawawaeqqdd","qaawawaeqqqdd","aawawaeqqqqdd",
  "awawaawq","dwdwdewq","dwdwdeweaqa","waeawae","qdwdqdw","waeawaede",
  "waeawaedwa","waadwawdaaweewq","eawwaeawawaa","eaqawqadaqd","wwwqqqwwwqqeqqwwwqqwqqdqqqqqdqq","waeawaeqqqwqwqqwq",
  "eeewwweeewwaqqddqdqd","wwweeewwweewdawdwad","qeqwqwqwqwqeqaeqeaqeqaeqaqded","qqqwqqqqqaq","eeeweeeeede","qqqaw",
  "wdeee","qqq","eee","qdaqadq","eadedae","aqqqqqwded",
  "eeedw","deaqq","qwaqde","aqdee","aqqqqq","wawqwqwqwqwqw",
  "deeeee","wdwewewewewew","aqqqqqe","wawqwqwqwqwqwew","deeeeeq","wdwewewewewewqw",
  "qeewdweddw","eqqwawqaaw","qqaed","d","aqae","dedq",
  "qqqqqea","qqqqqew","qqqqqed","eeeeeqa","eeeeeqw","eeeeeqd",
  "qqqqq","qdwdq","eawae","aaq","wdded","qqqqqdaqa",
  "qqqqqdaqaawa","qqqqqdaqaawq","qqqqqdaqaaww","qqqqqdaqaawe","qqqqqdaqaawd","qqqqqwded",
  "qqqqqwdeddwa","eeeeewaqaawa","qqqqqwdeddwq","eeeeewaqaawq","qqqqqwdeddww","eeeeewaqaaww",
  "qqqqqwdeddwe","eeeeewaqaawe","qqqqqwdeddwd","eeeeewaqaawd","qqqqqeqeeeee","qwawqwadadwewdwe",
  "aqaeqded","qaeaqeqedqde","qaeaqewqedqde","edqde","qaeaq","deeed",
  "dadad","adeeed","qqaeaae","qqqaede","ewdqdwe","qwaeawq",
  "dedqde","edqdewaqa","qaeaqwded","wqaeaqw","ddewedd","aaqwqaa",
  "aawawwawwa","ddwdwwdwwd"
]);

const registered=new Set(HEX_CASTING_PATTERNS);

export function isHexCastingPattern(signature){
  if(!/^[wedqa]*$/.test(signature))return false;
  if(registered.has(signature))return true;
  // Numerical Reflection: the prefix sets the sign; every legal continuation
  // encodes a number. Geometric edge validity is enforced by HexTrace.
  if(signature.startsWith('aqaa')||signature.startsWith('dedd'))return true;
  // Bookkeeper's Gambit accepts straight strokes and pairs forming dips. The
  // empty angle signature is one straight segment, rather than an empty trace.
  const flat=signature[0]==='a'?5:0,directions=[0];
  for(const letter of signature)directions.push((directions.at(-1)+'wedsaq'.indexOf(letter))%6);
  for(let i=0;i<directions.length;){
    const angle=(directions[i]-flat+6)%6;
    if(angle===0){i++;continue;}
    if(angle===1&&i+1<directions.length&&(directions[i+1]-flat+6)%6===5){i+=2;continue;}
    return false;
  }
  return true;
}
