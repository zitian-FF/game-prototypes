import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
// Execute the installed Phaser method, not a duplicate wrapper implementation.
const src=fs.readFileSync('node_modules/phaser/src/gameobjects/text/Text.js','utf8'),sf=ts.createSourceFile('Text.js',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let method;
function visit(n){if(ts.isPropertyAssignment(n)&&n.name.getText(sf)==='advancedWordWrap')method=n.initializer.getText(sf);ts.forEachChild(n,visit);}visit(sf);assert(method);
const wrap=vm.runInNewContext('('+method+')'),ctx={measureText:text=>({width:[...text].reduce((sum,ch)=>sum+(/[\u3000-\u9fff]/.test(ch)?17:9),0)})};
for(const lang of ['ja','zh']){const table=JSON.parse(fs.readFileSync('prototypes/punchies/src/i18n/locales/'+lang+'.json','utf8')),text=table['survival.instructions'],width=344,wrapped=wrap.call({splitRegExp:/\r\n|\r|\n/,letterSpacing:0},text,ctx,width),lines=wrapped.trimEnd().split('\n');assert(lines.length>=2&&lines.length<=4,lang+': CJK should wrap rather than shrink one line');for(const line of lines)assert(ctx.measureText(line).width<=width);assert.equal(lines.join('').replaceAll(' ',''),text.replaceAll(' ',''),'no character or placeholder loss');assert(lines.length*20+8<=88);}
assert(fs.readFileSync('prototypes/punchies/src/ui/survivalChrome.ts','utf8').includes('useAdvancedWrap:true'));
console.log('PASS installed Phaser advanced wrap: JA/ZH instructions split into bounded readable lines, content preserved and horizontal padding reserved');
