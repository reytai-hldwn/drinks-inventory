import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash, randomUUID} from 'node:crypto';
const id = randomUUID;
const plain = value => JSON.parse(JSON.stringify(value));
const backendCode=await readFile(new URL('../../google-apps-script/Code.gs',import.meta.url),'utf8');
export function memorySheet(rows = []) {
  return { rows, getLastRow: () => rows.length, getSheetId: () => 7, setFrozenRows() {},
    getRange(row, column, count = 1, columns = 1) {
      const range = new Proxy({
        getValues: () => Array.from({ length: count }, (_, offset) => Array.from({ length: columns }, (_, col) => rows[row - 1 + offset]?.[column - 1 + col] ?? '')),
        setValues(values) {
          values.forEach((cells, offset) => {
            rows[row - 1 + offset] ||= [];
            cells.forEach((value, col) => { rows[row - 1 + offset][column - 1 + col] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value; });
          });
          return range;
        },
      }, {get: (target, property) => property in target ? target[property] : () => range});
      return range;
    },
  };
}

export function websiteBackend() {
  const props = new Map();
  const sheets = {
    Catalog: memorySheet([['id','name','category','packaging','unit','case','threshold','active'],
      ['tea','茶','茶飲','寶特瓶','瓶',24,10,true],['milk','牛乳','牛奶／豆漿','鋁箔包','包',24,10,true],['old','舊飲料','茶飲','鐵罐','罐',24,10,false]]),
    History: memorySheet([['id','time','type','drink','name','quantity','note','recorder','status'],
      ['baseline-tea','2020-01-01T00:00:00Z','count','tea','茶',20,'原紀錄','小王','採計'],
      ['baseline-milk','2020-01-01T00:00:00Z','count','milk','牛乳',9,'原紀錄','小王','採計']]),
    WishReview: memorySheet([['id','name','url','note','status','time','kind']]),
    WishVotes: memorySheet([['id','wish','voter','time','status','name']]),
    ProductIntake: memorySheet([['id','time','product','name','category','packaging','recorder','status']]),
    Warehouse: memorySheet(), Archive: memorySheet(),
  };
  const ss = { getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST_SHEET/edit', getSheetByName: name => sheets[name] || null, insertSheet(name) { return sheets[name] = memorySheet(); } };
  const ctx = vm.createContext({console: {warn(){}}, Date, JSON, Number,
    PropertiesService: {getScriptProperties: () => ({getProperty: key => props.get(key) ?? null, setProperty(key,value){props.set(key,value);return this;}})},
    Utilities: {DigestAlgorithm:{SHA_256:'sha256'}, Charset:{UTF_8:'utf8'}, computeDigest: (_algorithm,value) => [...createHash('sha256').update(value).digest()]},
    SpreadsheetApp: {flush(){}},
    ContentService: {MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput(body){return {body,setMimeType(){return this;}};}},
    HtmlService: {XFrameOptionsMode:{ALLOWALL:'all'},createHtmlOutput(body){return {body,setXFrameOptionsMode(){return this;}};}},
  });
  vm.runInContext(backendCode, ctx);
  ctx.locked_ = work => work();
  ctx.requiredSpreadsheet_ = () => ss;
  ctx.renderWarehouse_ = () => {};
  ctx.renderArchive_ = () => {};
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({wishKindEntry:'101',voteWishEntry:'201',voteVoterEntry:'202',voteNameEntry:'203'}));
  ctx.forms_ = () => Object.fromEntries(['stocktake','arrival','wish','vote','product'].map(kind=>[kind,{getPublishedUrl:()=>`https://docs.google.com/forms/d/e/TEST_${kind}/viewform`}]));
  const send = (operation,data,requestId = id()) => plain(ctx.submitWebsiteRequest_({requestId,operation,data}));
  const inventory = () => plain(ctx.computeInventory_(ctx.catalog_(ss),ctx.historyEvents_(ss)));
  return {ctx,ss,sheets,props,send,inventory};
}

