import Phaser from 'phaser';
import {controlModePanel} from '../prototypes/punchies/src/ui/controlModePanel';
import {VIEW,PIXEL_RATIO,applyCameraPixelRatio} from '../prototypes/punchies/src/render/pixelRatio';
import {setLocaleLoader,setLanguage} from '../prototypes/punchies/src/i18n';
import {isLangCode} from '../prototypes/punchies/src/i18n/languages';
import {installTextLocale} from '../prototypes/punchies/src/i18n/textStyle';
const tables=import.meta.glob('../prototypes/punchies/src/i18n/locales/*.json',{eager:true,import:'default'});
setLocaleLoader(async code=>tables['../prototypes/punchies/src/i18n/locales/'+code+'.json'] as Record<string,string>,{});installTextLocale(Phaser);
class Review extends Phaser.Scene {async create(){applyCameraPixelRatio(this);const code=new URLSearchParams(location.search).get('lang');if(isLangCode(code))await setLanguage(code);controlModePanel(this,()=>this.scene.restart());}}
new Phaser.Game({type:Phaser.CANVAS,parent:'app',width:VIEW.width*PIXEL_RATIO,height:VIEW.height*PIXEL_RATIO,backgroundColor:'#071024',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Review});
