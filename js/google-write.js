/** A normal HTML POST needs no CORS permission. A committed receipt, delivered
 *  by the submitting frame or a read-only check, is the only success signal. */
export function submitGoogleWebsiteCommand(endpoint, command, options = {}) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.username || url.password || url.port || url.search || url.hash ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) throw new Error('Google 儲存網址不正確。');
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(command?.requestId || '') ||
      !['wish', 'vote', 'stocktake', 'arrival', 'new-arrival', 'batch-arrival', 'supply-details', 'product', 'supply-arrival', 'supply-stocktake', 'supply-expiry-close', 'supply-expiry-set', 'restock-preference', 'zero-stock-decision', 'archive-wish', 'supply-recorder-correction'].includes(command?.operation)) throw new Error('送出資料格式不正確。');
  const pageDocument = options.document || globalThis.document;
  const schedule = options.setTimeout || globalThis.setTimeout;
  const cancel = options.clearTimeout || globalThis.clearTimeout;
  const readReceipt = options.readReceipt;
  const pageWindow = options.window || globalThis.window;
  if (!pageDocument?.body?.appendChild || typeof readReceipt !== 'function') return Promise.reject(new Error('目前的瀏覽器無法送出共用資料。'));

  return new Promise((resolve, reject) => {
    const frame = pageDocument.createElement('iframe');
    const form = pageDocument.createElement('form');
    const field = pageDocument.createElement('input');
    let settled = false, timeoutTimer, pollTimer, polling = false, checkAfterPoll = false;
    let replyToken = '', replyOrigin = '';
    if(options.messageReceipt && pageWindow?.addEventListener && pageWindow?.removeEventListener){
      try{
        replyOrigin=pageWindow.location.origin;
        replyToken=options.createReplyToken?.()||pageWindow.crypto.randomUUID();
        if(!/^https?:\/\/[^/?#\s]+$/.test(replyOrigin)||!/^[A-Za-z0-9_-]{20,100}$/.test(replyToken))replyToken='';
      }catch{replyToken='';}
    }
    frame.name = `holdwin_write_${command.requestId}`;
    frame.hidden = true;
    frame.title = '儲存共用資料';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    form.hidden = true;
    form.method = 'POST';
    form.action = url.href;
    form.target = frame.name;
    form.enctype = 'application/x-www-form-urlencoded';
    field.type = 'hidden';
    field.name = 'payload';
    field.value = JSON.stringify(command);
    form.appendChild(field);
    if(replyToken)for(const [name,value] of [['replyToken',replyToken],['replyOrigin',replyOrigin]]){
      const input=pageDocument.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input);
    }

    const finish = (error, receipt) => {
      if (settled) return;
      settled = true;
      cancel(timeoutTimer);
      cancel(pollTimer);
      frame.removeEventListener?.('load', onFrameLoad);
      if(replyToken)pageWindow.removeEventListener('message',onMessage);
      form.remove();
      frame.remove();
      if (error) reject(error); else resolve(receipt.result || {});
    };
    const acceptReceipt = receipt => {
      if(receipt?.requestId!==command.requestId)return false;
      if(receipt.ok===true&&receipt.state==='accepted'){finish(null,receipt);return true;}
      if(receipt.state==='rejected'){
        const error=new Error(typeof receipt.message==='string'?receipt.message:'資料未儲存，請檢查輸入。');error.code='rejected';finish(error);return true;
      }
      return false;
    };
    const fromSubmittingFrame = source => {
      const frames=[frame.contentWindow];
      // Apps Script wraps HtmlService in a sandbox frame. Accept that descendant
      // too, while rejecting every unrelated frame or tab, even on Google.
      for(let checked=0;frames.length&&checked<40;checked++){
        const candidate=frames.shift();if(!candidate)continue;if(candidate===source)return true;
        try{for(let i=0;i<Math.min(candidate.length||0,16);i++)frames.push(candidate.frames[i]);}catch{/* polling remains available */}
      }
      return false;
    };
    const onMessage = event => {
      if(settled||!replyToken||event.data?.type!=='pantry-write-receipt'||event.data.replyToken!==replyToken)return;
      let origin;try{origin=new URL(event.origin);}catch{return;}
      if(origin.protocol!=='https:'||origin.port||!(origin.hostname==='script.google.com'||/^(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(origin.hostname))||!fromSubmittingFrame(event.source))return;
      const receipt=event.data.receipt;
      if(receipt?.state==='accepted'&&receipt.result?.operation!==command.operation)return;
      acceptReceipt(receipt);
    };
    const poll = async () => {
      if (settled) return;
      if (polling) { checkAfterPoll = true; return; }
      polling = true;
      cancel(pollTimer);
      try {
        const receipt = await readReceipt(command.requestId);
        if (settled) return;
        if (acceptReceipt(receipt)) return;
      } catch { /* A delayed or lost read is not evidence that a POST failed. */ }
      polling = false;
      if (!settled) {
        const delay = checkAfterPoll ? 0 : (options.pollInterval ?? 2500);
        checkAfterPoll = false;
        pollTimer = schedule(poll, delay);
      }
    };
    const onFrameLoad = () => {
      // about:blank is not a POST response. Cross-origin load is only a hint:
      // success still requires an accepted receipt with the exact request ID.
      try { if (frame.contentWindow?.location?.href === 'about:blank') return; }
      catch { /* The submitted Google page is normally cross-origin. */ }
      if (!settled) { cancel(pollTimer);if(replyToken)pollTimer=schedule(poll,150);else poll(); }
    };
    frame.addEventListener?.('load', onFrameLoad);
    if(replyToken)pageWindow.addEventListener('message',onMessage);
    timeoutTimer = schedule(() => {
      const error = new Error('尚未確認儲存結果。請保留原內容重試，系統會沿用同一筆送出，避免重複入庫。');
      error.code = 'pending';
      finish(error);
    }, options.timeout ?? 90000);
    try {
      pageDocument.body.appendChild(frame);
      pageDocument.body.appendChild(form);
      form.submit();
      pollTimer = schedule(poll, options.initialDelay ?? (replyToken?8000:1200));
    } catch {
      const error = new Error('尚未確認資料是否送出，請保留原內容重試。');
      error.code = 'pending';
      finish(error);
    }
  });
}
