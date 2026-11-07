import {isHexCastingPattern} from './hexcasting-patterns.js';

// Add site-specific angle signatures here; starting orientation is unrestricted.
export const SITE_PATTERNS=Object.freeze(['dewqa']);
export function isValidPattern(signature){
  return SITE_PATTERNS.includes(signature)||isHexCastingPattern(signature);
}
export function patternHints(){
  return [...SITE_PATTERNS];
}
