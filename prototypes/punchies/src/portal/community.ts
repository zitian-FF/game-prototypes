import {portal} from './select';

export const DISCORD_FEEDBACK_INVITE='https://discord.gg/jfugatFzX';

// Community links are secondary main-menu actions on web/CrazyGames.
// Other portal editions retain their current menus until their policy is reviewed.
export function discordFeedbackAvailable():boolean {
  return portal.id==='web'||portal.id==='crazygames';
}

// Keep synchronous: pointer, keyboard and controller menu callbacks share this
// path. No network/open action occurs during import, boot, render or focus.
export function openDiscordFeedback():void {
  if(!discordFeedbackAvailable())return;
  try {
    const opened=window.open(DISCORD_FEEDBACK_INVITE,'_blank','noopener,noreferrer');
    if(opened)opened.opener=null;
  }
  catch {/* A host may block popups; never navigate the game away or break its menu. */}
}
