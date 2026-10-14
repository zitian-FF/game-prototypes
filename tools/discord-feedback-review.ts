import {initPortal} from '../prototypes/punchies/src/portal';
import {initLanguage} from '../prototypes/punchies/src/i18n/init';

// Real game bootstrap and menu. Only the DOM-ready proof signal is test-only.
void initPortal().then(initLanguage).then(()=>import('../prototypes/punchies/src/boot')).then(({game})=>{
  const watch=()=>{
    const menu=game.scene.keys.Menu;
    if(!menu){game.events.once('step',watch);return;}
    const ready=()=>{document.querySelector('#ready')!.textContent='Menu ready';};
    if(menu.scene.isActive())ready();else menu.events.once('create',ready);
  };
  watch();
}).catch(error=>{document.querySelector('#ready')!.textContent='Review error: '+String(error);});
