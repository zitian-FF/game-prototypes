import {betaFighters} from '../../progress/beta';
import {ITCH_BETA_EDITION} from '../../edition';
export function betaLineupAllowed(chars:readonly string[],skins:readonly string[]=['default','default']):boolean {
 if(!ITCH_BETA_EDITION)return true;
 const available=betaFighters();return chars.length===2&&chars.every(id=>available.includes(id))&&skins.length===2&&skins.every(skin=>skin==='default');
}
