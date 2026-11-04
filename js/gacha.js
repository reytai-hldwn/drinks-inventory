import { escapeHtml as h } from './domain.js';
import { fridgeDisplayName } from './catalog.js';
import { drinkPack } from './fridge.js';
import { findDrinkInformation } from './drink-information.js';

// IDs are saved with the daily result; keep them stable when editing copy.
export const GACHA_FORTUNES=Object.freeze([
  ['lucky-01','lucky','願你的好運不過擬合，快樂走得長又穩。'],
  ['lucky-02','lucky','今天的好消息，正在低調累積動能。'],
  ['lucky-03','lucky','好消息尚在途中，今日宜補水，不宜把耐心停損。'],
  ['lucky-04','lucky','好運並非隨機漫步，今天正往你這裡靠近。'],
  ['lucky-05','lucky','願報酬保持正偏，快樂持續複利。'],
  ['lucky-06','lucky','小訊號也有長大的時候，別急著把靈感當成雜訊。'],
  ['lucky-07','lucky','雜訊留給市場，好心情留給自己。'],
  ['lucky-08','lucky','幸運已送出委託，成交的可能是你期待的好消息。'],
  ['lucky-09','lucky','小小補給，希望也能替今天帶來超額快樂。'],
  ['lucky-10','lucky','把煩惱停損，繼續持有值得開心的事。'],
  ['lucky-16','lucky','眼前無解，不妨離席補給；換個位置，或許就找到 alpha。'],
  ['lucky-17','lucky','今天的快樂不必回測，先喝一口就知道。'],
  ['lucky-20','lucky','今天該減碼的是壓力，該加碼的是好心情。'],
  ['pause-02','pause','宇宙暫時沒給進場訊號，倒是給了你一張喝飲料的通行證。'],
  ['supply-15','lucky','今日未見大行情，也有小確幸悄悄成交。'],
  ['supply-16','lucky','今日宜多聊兩句，別人的一句話，可能補上你缺的那個因子。'],
  ['supply-17','lucky','看似繞路的那一段，日後可能成為最有用的訓練資料。'],
  ['supply-18','lucky','卡住的那一行，或許只差一口飲料的距離。'],
  ['supply-19','lucky','願你的策略少些漂移，日子多些踏實。'],
  ['supply-20','lucky','有些好運來得很安靜，別只盯著波動最大的那一筆。'],
  ['supply-21','lucky','今日的好運有多個來源，請留意飲料以外的小驚喜。'],
  ['supply-22','lucky','今日有望遇見意外的共識，兩個人的靈感，可以跑出新的策略。'],
  ['supply-23','lucky','今天允許自己暫時離線，快樂不需要全年無休地運算。'],
  ['supply-24','lucky','一時的烏雲不必外推，明天的天色還有新的樣本。'],
  ['supply-25','lucky','今天的好消息接連成交，壞心情自動撤單。'],
  ['supply-26','lucky','今天最大的回撤，只是杯子裡的飲料變少了。'],
  ['supply-27','lucky','今日宜替好奇心留一席，下一個有效因子，也許藏在平常不看的地方。'],
  ['pause-01','pause','今日慢下來，先把飲料拿穩。'],
  ['lucky-12','lucky','盤面再怎麼波動，也別讓每根 K 棒決定你的心情。'],
  ['lucky-18','lucky','先補水，再補靈感；今天的好點子，也許就差這一口。'],
  ['supply-31','lucky','今天的休息不算時間耗損，喝杯飲料，也是在替明天留點餘裕。'],
  ['supply-32','lucky','有些機會會到期，對自己的照顧不用等到結算日。'],
  ['supply-33','lucky','Rolling Window 往前走，過去的烏雲不必一直留在視窗裡。'],
  ['supply-34','lucky','別只用最累的那幾天估計自己，換個視窗，再看一次。'],
  ['supply-35','lucky','今天的報錯容易定位，好消息不用 Debug。'],
  ['supply-36','lucky','有些驚喜不在回測裡，但會剛好出現在你需要的時候。'],
  ['supply-37','lucky','今日宜讓好心情低延遲，別等收盤才開始開心。'],
  ['supply-38','lucky','今天的好運帶點 Gamma，開心的事一來，笑意就越來越藏不住。'],
  ['supply-39','lucky','有些煩惱適合交給 Theta，放一放，也許就沒那麼值錢。'],
].map(([id,kind,text])=>Object.freeze({id,kind,text})));
const gachaFortuneMap=new Map(GACHA_FORTUNES.map(fortune=>[fortune.id,fortune]));
export const gachaDay=(now=Date.now())=>new Date(+new Date(now)+8*3600000).toISOString().slice(0,10);
export const gachaResetDelay=(now=Date.now())=>Date.parse(`${gachaDay(now)}T16:00:00Z`)-+new Date(now)+50;
export function gachaRandom(){if(globalThis.crypto?.getRandomValues){const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0]/4294967296;}return Math.random();}
const gachaIndex=(length,random)=>Math.min(length-1,Math.max(0,Math.floor(random()*length)));

export function drawGacha({now=Date.now(),random=gachaRandom}={}) {
  const fortune=GACHA_FORTUNES[gachaIndex(GACHA_FORTUNES.length,random)];
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

export const GACHA_ANIMATION_MS=1950;
export const GACHA_OPEN_MS=650;
export const GACHA_UNFOLD_MS=550;

function renderFortuneText(text) {
  const clauses=[];let clause='';
  for(const character of text){clause+=character;if('，,；;'.includes(character)){clauses.push(clause);clause='';}}
  if(clause)clauses.push(clause);
  return clauses.map(value=>`<span class="gacha-fortune-clause">${h(value)}</span>`).join('<wbr>');
}

function gachaMachine(disabled,phase) {
  const spinning=phase==='spinning',opening=phase==='opening';
  const balls=[[121,91,-18,'#d7dec7'],[175,82,22,'#efd6c6'],[210,121,-26,'#e9c77d'],[153,130,12,'#f2dec7'],[106,148,32,'#e8c57d'],[191,168,-14,'#d4dcc2'],[142,185,20,'#efd4c3']];
  return `<button type="button" class="gacha-machine${spinning?' is-spinning':disabled?` is-dispensed ${opening?'is-opening':'is-opened'}`:''}" data-action="gacha-draw"${disabled?' disabled':''} aria-label="轉一下，抽今日補給"><svg viewBox="0 0 320 410" role="presentation" aria-hidden="true"><defs><clipPath id="gacha-globe"><circle cx="160" cy="123" r="88"/></clipPath></defs><ellipse cx="161" cy="351" rx="102" ry="8" fill="#eee5d4"/><path d="M88 199 Q77 205 75 224 L67 322 Q64 344 89 347 L231 346 Q252 345 249 322 L241 224 Q238 207 223 201 Z" fill="#f6ead3" stroke="#a78355" stroke-width="2.5"/><path d="M77 310 L242 312 M86 339 Q164 344 238 338" fill="none" stroke="#cfb68d" stroke-width="1.3"/><circle cx="160" cy="123" r="91" fill="#fffcf4" stroke="#a78355" stroke-width="2.5"/><circle cx="160" cy="123" r="86" fill="none" stroke="#dfcfb1" stroke-width="1"/><g clip-path="url(#gacha-globe)"><g class="gacha-balls">${balls.map(([x,y,rotation,color])=>`<g transform="translate(${x} ${y}) rotate(${rotation})"><circle r="25" fill="${color}" stroke="#aa8b64" stroke-width="1.8"/><path d="M-24 0 A25 25 0 0 1 24 0 Z" fill="#fffaf0" stroke="#aa8b64" stroke-width="1.5"/><path d="M-16 -11 Q-12 -18 -4 -19" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>`).join('')}</g></g><path d="M98 59 Q113 40 139 37" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/><path d="M128 28 Q160 19 191 28 L198 37 Q160 44 123 37 Z" fill="#d1ab69" stroke="#a78355" stroke-width="2"/><rect x="109" y="225" width="101" height="62" rx="22" fill="#fffaf0" stroke="#b49469" stroke-width="2"/><g class="gacha-knob"><circle cx="160" cy="256" r="23" fill="#e6c383" stroke="#a78355" stroke-width="2"/><rect x="138" y="250" width="44" height="12" rx="6" fill="#fff9e9" stroke="#a78355" stroke-width="1.7"/><circle cx="160" cy="256" r="4" fill="#cba568"/><circle cx="146" cy="256" r="2" fill="#a78355"/></g><path d="M112 316 Q112 292 136 292 L184 292 Q208 292 208 316 L207 338 L113 338 Z" fill="#806144" stroke="#a78355" stroke-width="2"/><path d="M124 333 Q160 328 198 334" fill="none" stroke="#d8bb8a" stroke-width="2"/><g transform="translate(160 316)"><g class="gacha-capsule-out"><g class="gacha-capsule-note"><path d="M-11 -14 Q0 -16 11 -14 L11 16 Q0 14 -11 16 Z" fill="#fffdf7" stroke="#b49469" stroke-width="1.3"/><path d="M-6 -6 L6 -6 M-6 0 L5 0 M-6 6 L3 6" fill="none" stroke="#d0ad70" stroke-width="1.3" stroke-linecap="round"/></g><g class="gacha-capsule-bottom"><path d="M-18 0 A18 18 0 0 0 18 0 Z" fill="#e8c57d" stroke="#a78355" stroke-width="1.8"/></g><g class="gacha-capsule-top"><path d="M-18 0 A18 18 0 0 1 18 0 Z" fill="#fffaf0" stroke="#a78355" stroke-width="1.6"/><path d="M-11 -8 Q-8 -13 -3 -14" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g></g></g><path d="M55 82 l-5 -9 M263 115 l10 -4 M252 56 l7 -8" stroke="#d0ad70" stroke-width="2" stroke-linecap="round"/></svg><span>${spinning?'好運正在靠近…':opening?'正在打開今日補給…':disabled?'今日好運已收好':'轉一下，抽今日補給'}</span></button>`;
}

export function renderGacha(state,drinks) {
  const draw=state.draw,fortune=draw?gachaFortuneMap.get(draw.fortuneId):null,drink=draw?.drinkId?drinks.find(drink=>drink.id===draw.drinkId):null;
  const phase=state.phase||'ready',pending=phase==='spinning'||phase==='opening',unfolding=phase==='unfolding';
  const label=fortune?.kind==='pause'?'宇宙小暫停':'今日補給';
  const drinkCard=drink?`<div class="gacha-drink"><div class="gacha-drink-photo">${drinkPack(drink)}</div><div><p class="eyebrow">今日配對飲料</p><h3>要來一${h(drink.unit||'份')}${h(fridgeDisplayName(drink.name))}嗎？</h3><p class="subtle">${h(findDrinkInformation(drink)?.container||drink.packaging||drink.unit)}</p><button type="button" class="text-link" data-action="view-drink" data-id="${h(drink.id)}">看看飲料資訊 ↗</button></div></div>`:`<div class="gacha-drink-status" role="status"><p>${state.loading?'正在替你找一份補給…':state.drinkState==='empty'?'今天的飲料推薦先留白，補給到貨後再來看看。':state.drinkState==='error'?'飲料推薦暫時沒有回應，今天的幸運籤已替你收好。':'飲料推薦準備中，先收下今天的好運。'}</p>${state.loading?'':`<div class="inline-actions"><button type="button" class="text-link" data-action="gacha-retry">再看看飲料 ↻</button><a class="text-link" href="#overview">逛逛冰箱 ↗</a></div>`}</div>`;
  return `<div class="gacha-layout" style="--gacha-cycle:${GACHA_ANIMATION_MS}ms;--gacha-open:${GACHA_OPEN_MS}ms;--gacha-unfold:${GACHA_UNFOLD_MS}ms"><section class="gacha-play"><div class="gacha-machine-wrap">${gachaMachine(!!draw,phase)}</div><p class="gacha-daily-note">每天一顆，同一瀏覽器會保留今天的結果。</p></section><section id="gacha-result" class="gacha-result" tabindex="-1" aria-live="polite">${fortune&&!pending?`<article class="gacha-ticket${unfolding?' is-unfolding':''}"${unfolding?' inert':''}><div class="gacha-ticket-top"><span>✧ ${label}</span><time>${h(draw.day.replaceAll('-',' / '))}</time></div><p class="gacha-fortune">${renderFortuneText(fortune.text)}</p><div class="gacha-ticket-rule"><span>今日的好訊號，請查收</span></div>${drinkCard}</article>${state.saveFailed?'<p class="subtle">此瀏覽器暫時無法保存結果，重新整理後可能會改變。</p>':''}`:`<div class="gacha-invitation"><span aria-hidden="true">✧</span><h2>${phase==='opening'?'正在打開你的今日補給':phase==='spinning'?'正在轉出你的好訊號':'今天的好運，等你轉開'}</h2><p>一份飲料推薦，一張有點懂你的幸運籤。</p><small>補給一下，讓好心情繼續複利。</small></div>`}${fortune&&!pending&&!unfolding?'<button type="button" class="gacha-replay" data-action="gacha-replay">重看開蛋動畫 ↻</button>':''}</section></div>`;
}
