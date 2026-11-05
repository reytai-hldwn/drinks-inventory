import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {websiteBackend} from './helpers/google-website.mjs';
import {submitGoogleWebsiteCommand} from '../js/google-write.js';
import {renderFridge} from '../js/fridge.js';
import {GoogleInventoryStore} from '../js/google-store.js';

const endpoint='https://script.google.com/macros/s/FAST_RECEIPT_TEST/exec';
const requestId='fast-receipt-request-00000001',token='fast-reply-token-0000000000001';
const command={requestId,operation:'wish',data:{kind:'drink',name:'虛構茶',url:'',note:''}};
const plain=value=>JSON.parse(JSON.stringify(value));
function browser(){
  const nodes=[],timers=new Map(),listeners=new Map();let counter=0,reads=0;
  const child={length:0},frameWindow={length:1,frames:[child],location:{href:endpoint}};
  const window={location:{origin:'https://example.test'},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  const document={body:{appendChild:node=>nodes.push(node)},createElement:type=>({type,children:[],listeners:new Map(),contentWindow:type==='iframe'?frameWindow:null,
    appendChild(node){this.children.push(node);},setAttribute(){},addEventListener(type,fn){this.listeners.set(type,fn);},removeEventListener(type){this.listeners.delete(type);},submit(){},remove(){nodes.splice(nodes.indexOf(this),1);}})};
  const receipt={ok:true,requestId,state:'accepted',result:{operation:'wish',id:'wish-web-'+requestId}};
  return {nodes,timers,listeners,window,child,frameWindow,document,receipt,get reads(){return reads;},
    setTimeout:(fn,delay)=>{const id=++counter;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),createReplyToken:()=>token,
    readReceipt:async()=>{reads++;return receipt;},messageReceipt:true,
    message(overrides={}){listeners.get('message')?.({origin:'https://n-123-script.googleusercontent.com',source:child,data:{type:'pantry-write-receipt',replyToken:token,receipt},...overrides});},
    async run(delay){const entry=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(entry,'timer '+delay);timers.delete(entry[0]);await entry[1].fn();}};
}

test('committed same-frame message resolves without a receipt read and cleans up listeners and timers',async()=>{
  const page=browser(),pending=submitGoogleWebsiteCommand(endpoint,command,page);
  const form=page.nodes.find(node=>node.type==='form');assert.deepEqual(JSON.parse(form.children[0].value),command);
  assert.equal(form.children.find(node=>node.name==='replyToken').value,token);assert.equal(form.children.find(node=>node.name==='replyOrigin').value,'https://example.test');
  page.message();assert.deepEqual(await pending,page.receipt.result);assert.equal(page.reads,0);assert.equal(page.nodes.length,0);assert.equal(page.timers.size,0);assert.equal(page.listeners.size,0);
});

test('messages from unrelated sources, origins, nonces, request ids and operations never confirm a write',async()=>{
  const page=browser();let resolved=false;const pending=submitGoogleWebsiteCommand(endpoint,command,page).then(value=>{resolved=true;return value;});
  for(const origin of ['null','https://evil.test','https://script.google.com.evil.test','https://evil.script.google.com','https://script.google.com:8443'])page.message({origin});
  page.message({source:{}});page.message({data:{type:'pantry-write-receipt',replyToken:'wrong',receipt:page.receipt}});
  page.message({data:{type:'pantry-write-receipt',replyToken:token,receipt:{...page.receipt,requestId:'another-request'}}});
  page.message({data:{type:'pantry-write-receipt',replyToken:token,receipt:{...page.receipt,result:{operation:'vote'}}}});
  page.message({data:{type:'pantry-write-receipt',replyToken:token,receipt:{...page.receipt,state:'pending'}}});
  await Promise.resolve();assert.equal(resolved,false);assert.equal(page.nodes.length,2);
  page.message({origin:'https://script.google.com',source:page.frameWindow});assert.deepEqual(await pending,page.receipt.result);
});

test('blocked messages retain receipt polling, explicit validation failures and uncertain timeouts',async()=>{
  const page=browser(),pending=submitGoogleWebsiteCommand(endpoint,command,page);await page.run(8000);assert.deepEqual(await pending,page.receipt.result);assert.equal(page.reads,1);
  const rejected=browser(),failure=submitGoogleWebsiteCommand(endpoint,command,rejected);const checked=assert.rejects(failure,error=>error.code==='rejected');rejected.message({data:{type:'pantry-write-receipt',replyToken:token,receipt:{requestId,state:'rejected',message:'請填寫名稱'}}});await checked;assert.equal(rejected.nodes.length,0);
  const uncertain=browser(),timeout=submitGoogleWebsiteCommand(endpoint,command,uncertain);const timed=assert.rejects(timeout,error=>error.code==='pending');await uncertain.run(90000);await timed;assert.equal(uncertain.listeners.size,0);
});

test('unsupported browser message capabilities use the original transport',async()=>{
  const page=browser();delete page.window.addEventListener;const pending=submitGoogleWebsiteCommand(endpoint,command,page);
  assert.equal(page.nodes.find(node=>node.type==='form').children.length,1);await page.run(1200);await pending;
});

test('Apps Script sends only committed receipts and never stores transient message routing fields',()=>{
  const b=websiteBackend(),parameters={payload:JSON.stringify(command),replyToken:token,replyOrigin:'https://example.test'};
  const html=b.ctx.doPost({parameter:parameters}).body,script=html.match(/<script>([\s\S]*?)<\/script>/)[1],messages=[];
  vm.runInNewContext(script,{window:{top:{postMessage:(message,origin)=>messages.push({message:plain(message),origin})}}});
  assert.equal(messages.length,1);assert.equal(messages[0].origin,parameters.replyOrigin);assert.deepEqual(messages[0].message.receipt,plain(b.ctx.websiteReceipt_(requestId)));
  assert.equal(JSON.stringify(b.sheets.WebsiteRequests.rows).includes(token),false);assert.equal(b.ctx.publicData_().websiteEntry.fastReceiptVersion,1);
  const interrupted=websiteBackend();let count=0;interrupted.ctx.SpreadsheetApp.flush=()=>{if(++count===3)throw Error('commit interrupted');};
  assert.doesNotMatch(interrupted.ctx.doPost({parameter:parameters}).body,/postMessage/);
});

test('reply JSON escapes inline-script delimiters and invalid origins leave the fallback intact',()=>{
  const b=websiteBackend(),payload={...command,data:{...command.data,name:'</script><script>bad()</script>'}};
  const html=b.ctx.doPost({parameter:{payload:JSON.stringify(payload),replyToken:token,replyOrigin:'https://example.test'}}).body;
  assert.equal((html.match(/<script>/g)||[]).length,1);assert.doesNotMatch(html,/<script>bad/);assert.match(html,/\\u003c/);
  assert.doesNotMatch(b.ctx.doPost({parameter:{payload:JSON.stringify({...command,requestId:requestId+'-invalid-origin'}),replyToken:token,replyOrigin:'https://example.test/path'}}).body,/postMessage/);
});

test('homepage loading scene has a real waiting state instead of reporting an empty refrigerator',()=>{
  const html=renderFridge([],{loading:true});assert.match(html,/正在讀取冰箱裡的飲料/);assert.doesNotMatch(html,/這一格還沒有飲料/);assert.match(html,/fridge-popularity" hidden/);
  assert.match(renderFridge([]),/這一格還沒有飲料/);
});

test('fast receipt capability survives the public-only cache and is optional on older deployments',async()=>{
  const b=websiteBackend(),values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},sent=[];
  const options={publicStorage:storage,readPublicData:async()=>plain(b.ctx.publicData_()),submitWebsiteCommand:async(_url,_command,opts)=>{sent.push(opts);return {};}};
  const fresh=new GoogleInventoryStore({googleScriptUrl:endpoint},options);await fresh.init();assert.equal(fresh.fastReceiptVersion,1);
  const cached=new GoogleInventoryStore({googleScriptUrl:endpoint},{...options,readPublicData:()=>{throw Error('cached');}});await cached.init();assert.equal(cached.fastReceiptVersion,1);
  const old=plain(b.ctx.publicData_());delete old.websiteEntry.fastReceiptVersion;const legacy=new GoogleInventoryStore({googleScriptUrl:endpoint},{readPublicData:async()=>old});await legacy.init();assert.equal(legacy.fastReceiptVersion,0);
});

test('restock authentication rejections keep their safe error code in both receipt transports',async()=>{
 for(const messageReceipt of [true,false]){
  const page=browser(),receipt={ok:false,requestId,state:'rejected',errorCode:'restock_auth',message:'認證碼不正確'};
  const pending=submitGoogleWebsiteCommand(endpoint,{...command,operation:'restock-preference'},{...page,messageReceipt,readReceipt:async()=>receipt});const checked=assert.rejects(pending,error=>error.code==='restock_auth');
  if(messageReceipt)page.message({data:{type:'pantry-write-receipt',replyToken:token,receipt}});else await page.run(1200);await checked;
 }
});
