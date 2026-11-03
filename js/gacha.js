import { escapeHtml as h } from './domain.js';
import { fridgeDisplayName } from './catalog.js';
import { drinkPack } from './fridge.js';
import { findDrinkInformation } from './drink-information.js';

export const GACHA_ODDS = Object.freeze({lucky:.98,steady:.015,pause:.005});
// Append within a bucket: these positions form IDs saved in the daily result.
const GACHA_COPY = {
  lucky:[
    '願你的好運不過擬合，快樂走得長又穩。',
    '今天的好消息，正在低調累積動能。',
    '你的耐心正在生息，驚喜會替它結算。',
    '好運並非隨機漫步，今天正往你這裡靠近。',
    '願報酬保持正偏，快樂持續複利。',
    '今天值得加碼的，是那個還沒被你說出口的好點子。',
    '雜訊留給市場，把好心情留給自己。',
    '幸運已送出委託，成交的可能是你期待的好消息。',
    '小小補給，也能替今天帶來超額快樂。',
    '請把煩惱停損，把值得開心的事繼續持有。',
    '今天的你，值得比昨天更高的信心權重。',
    '願你在喧鬧的盤面裡，總能找到自己的節奏。',
    '好事正在累積訊號，輪到你時會很漂亮。',
    '今天的幸運，不只一個因子在加分。',
    '下一段漂亮的績效曲線，先從照顧好自己開始。',
    '你的靈感已經暖機，好消息也快跟上了。',
    '今天的快樂不必回測，先喝一口就知道。',
    '先補水，再補靈感；屬於你的訊號正在靠近。',
    '別急著為自己定價，世界還沒看完你的潛力。',
    '今天該減碼的是壓力，該加碼的是好心情。',
  ],
  steady:[
    '好的策略容得下一次休息，好的日子也是。',
    '盤面再熱鬧，也可以先讓心情收盤三分鐘。',
    '留一點現金，也留一點餘裕；好機會喜歡從容的人。',
  ],
  pause:[
    '這筆先算了吧。今天的 alpha，可能是保留選擇權。',
    '宇宙暫時沒給進場訊號，倒是給了你一張喝飲料的通行證。',
  ],
};
export const GACHA_FORTUNES=Object.freeze(Object.entries(GACHA_COPY).flatMap(([kind,texts])=>texts.map((text,index)=>Object.freeze({id:`${kind}-${String(index+1).padStart(2,'0')}`,kind,text}))));
const gachaFortuneMap=new Map(GACHA_FORTUNES.map(fortune=>[fortune.id,fortune]));
export const gachaDay=(now=Date.now())=>new Date(+new Date(now)+8*3600000).toISOString().slice(0,10);
export const gachaResetDelay=(now=Date.now())=>Date.parse(`${gachaDay(now)}T16:00:00Z`)-+new Date(now)+50;
export function gachaRandom(){if(globalThis.crypto?.getRandomValues){const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0]/4294967296;}return Math.random();}
const gachaIndex=(length,random)=>Math.min(length-1,Math.max(0,Math.floor(random()*length)));

export function drawGacha({now=Date.now(),random=gachaRandom}={}) {
  const chance=random(),kind=chance<GACHA_ODDS.lucky?'lucky':chance<GACHA_ODDS.lucky+GACHA_ODDS.steady?'steady':'pause';
  const fortunes=GACHA_FORTUNES.filter(fortune=>fortune.kind===kind),fortune=fortunes[gachaIndex(fortunes.length,random)];
  return {version:1,day:gachaDay(now),createdAt:new Date(now).toISOString(),fortuneId:fortune.id,drinkId:null};
}
export function readDailyGacha(storage,key,now=Date.now()) {
  try{
    const raw=storage?.getItem(key);if(!raw||raw.length>6000)return null;
    const value=JSON.parse(raw);
    if(value?.version!==1||value.day!==gachaDay(now)||!gachaFortuneMap.has(value.fortuneId)||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))||gachaDay(value.createdAt)!==value.day)return null;
    if(value.drinkId!==null&&(typeof value.drinkId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(value.drinkId)))return null;
    return {version:1,day:value.day,createdAt:value.createdAt,fortuneId:value.fortuneId,drinkId:value.drinkId};
  }catch{return null;}
}
export function saveDailyGacha(storage,key,draw){try{storage?.setItem(key,JSON.stringify(draw));return !!storage;}catch{return false;}}
export function chooseGachaDrink(drinks,eligibleIds,random=gachaRandom){const eligible=new Set(eligibleIds),items=drinks.filter(drink=>drink.active!==false&&eligible.has(drink.id));return items.length?items[gachaIndex(items.length,random)]:null;}

function gachaMachine(disabled,spinning) {
  const balls=[[121,91,-18,'#d7dec7'],[175,82,22,'#efd6c6'],[210,121,-26,'#e9c77d'],[153,130,12,'#f2dec7'],[106,148,32,'#e8c57d'],[191,168,-14,'#d4dcc2'],[142,185,20,'#efd4c3']];
  return `<button type="button" class="gacha-machine${spinning?' is-spinning':''}" data-action="gacha-draw"${disabled?' disabled':''} aria-label="轉一下，抽今日補給"><svg viewBox="0 0 320 380" role="presentation" aria-hidden="true"><defs><clipPath id="gacha-globe"><circle cx="160" cy="123" r="88"/></clipPath></defs><ellipse cx="161" cy="351" rx="102" ry="8" fill="#eee5d4"/><path d="M88 199 Q77 205 75 224 L67 322 Q64 344 89 347 L231 346 Q252 345 249 322 L241 224 Q238 207 223 201 Z" fill="#f6ead3" stroke="#a78355" stroke-width="2.5"/><path d="M77 310 L242 312 M86 339 Q164 344 238 338" fill="none" stroke="#cfb68d" stroke-width="1.3"/><circle cx="160" cy="123" r="91" fill="#fffcf4" stroke="#a78355" stroke-width="2.5"/><circle cx="160" cy="123" r="86" fill="none" stroke="#dfcfb1" stroke-width="1"/><g clip-path="url(#gacha-globe)"><g class="gacha-balls">${balls.map(([x,y,rotation,color])=>`<g transform="translate(${x} ${y}) rotate(${rotation})"><circle r="25" fill="${color}" stroke="#aa8b64" stroke-width="1.8"/><path d="M-24 0 A25 25 0 0 1 24 0 Z" fill="#fffaf0" stroke="#aa8b64" stroke-width="1.5"/><path d="M-16 -11 Q-12 -18 -4 -19" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>`).join('')}</g></g><path d="M98 59 Q113 40 139 37" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/><path d="M128 28 Q160 19 191 28 L198 37 Q160 44 123 37 Z" fill="#d1ab69" stroke="#a78355" stroke-width="2"/><rect x="109" y="225" width="101" height="62" rx="22" fill="#fffaf0" stroke="#b49469" stroke-width="2"/><g class="gacha-knob"><circle cx="160" cy="256" r="23" fill="#e6c383" stroke="#a78355" stroke-width="2"/><rect x="138" y="250" width="44" height="12" rx="6" fill="#fff9e9" stroke="#a78355" stroke-width="1.7"/><circle cx="160" cy="256" r="4" fill="#cba568"/></g><path d="M117 315 Q117 296 137 296 L184 296 Q204 296 204 315 L203 330 L118 330 Z" fill="#806144" stroke="#a78355" stroke-width="2"/><path d="M127 323 Q160 317 195 324" fill="none" stroke="#d8bb8a" stroke-width="2"/><path d="M55 82 l-5 -9 M263 115 l10 -4 M252 56 l7 -8" stroke="#d0ad70" stroke-width="2" stroke-linecap="round"/></svg><span>${spinning?'好運正在靠近…':disabled?'今日好運已收好':'轉一下，抽今日補給'}</span></button>`;
}

export function renderGacha(state,drinks) {
  const draw=state.draw,fortune=draw?gachaFortuneMap.get(draw.fortuneId):null,drink=draw?.drinkId?drinks.find(drink=>drink.id===draw.drinkId):null;
  const label=fortune?.kind==='pause'?'宇宙小暫停':fortune?.kind==='steady'?'慢慢來也有好運':'今日好籤';
  const drinkCard=drink?`<div class="gacha-drink"><div class="gacha-drink-photo">${drinkPack(drink)}</div><div><p class="eyebrow">今日配對飲料</p><h3>${h(fridgeDisplayName(drink.name))}</h3><p class="subtle">${h(findDrinkInformation(drink)?.container||drink.packaging||drink.unit)}</p><button type="button" class="text-link" data-action="view-drink" data-id="${h(drink.id)}">看看飲料資訊 ↗</button></div></div>`:`<div class="gacha-drink-status" role="status"><p>${state.loading?'正在替你找一份補給…':state.drinkState==='empty'?'今天的飲料推薦先留白，補給到貨後再來看看。':state.drinkState==='error'?'飲料推薦暫時沒有回應，今天的幸運籤已替你收好。':'飲料推薦準備中，先收下今天的好運。'}</p>${state.loading?'':`<div class="inline-actions"><button type="button" class="text-link" data-action="gacha-retry">再看看飲料 ↻</button><a class="text-link" href="#overview">逛逛冰箱 ↗</a></div>`}</div>`;
  return `<div class="gacha-layout"><section class="gacha-play"><div class="gacha-machine-wrap">${gachaMachine(!!draw||state.spinning,state.spinning)}</div><p class="gacha-daily-note">每天一顆，同一瀏覽器會保留今天的結果。</p></section><section id="gacha-result" class="gacha-result" tabindex="-1" aria-live="polite">${fortune&&!state.spinning?`<article class="gacha-ticket"><div class="gacha-ticket-top"><span>✧ ${label}</span><time>${h(draw.day.replaceAll('-',' / '))}</time></div><p class="gacha-fortune">${h(fortune.text)}</p><div class="gacha-ticket-rule"><span>今日的好訊號，請查收</span></div>${drinkCard}</article>${state.saveFailed?'<p class="subtle">此瀏覽器暫時無法保存結果，重新整理後可能會改變。</p>':''}`:`<div class="gacha-invitation"><span aria-hidden="true">✧</span><h2>${state.spinning?'正在轉出你的好訊號':'今天的好運，等你轉開'}</h2><p>一份飲料推薦，一張有點懂你的幸運籤。</p><small>補給一下，讓好心情繼續複利。</small></div>`}</section></div>`;
}
