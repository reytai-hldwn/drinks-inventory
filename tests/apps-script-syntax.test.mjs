import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {parse} from 'acorn';

// Node's current V8 accepts syntax the Apps Script editor may reject. Keep the
// complete standalone backend within this conservative ES2019 syntax subset.
test('the complete Apps Script backend parses without newer unsupported syntax',async()=>{
 const source=await readFile(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8');
 parse(source,{ecmaVersion:2019,sourceType:'script'});
});
