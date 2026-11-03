/** A normal HTML POST needs no CORS permission. Only the server's read-only
 *  receipt confirms success; an iframe load or an opaque response never does. */
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
  if (!pageDocument?.body?.appendChild || typeof readReceipt !== 'function') return Promise.reject(new Error('目前的瀏覽器無法送出共用資料。'));

  return new Promise((resolve, reject) => {
    const frame = pageDocument.createElement('iframe');
    const form = pageDocument.createElement('form');
    const field = pageDocument.createElement('input');
    let settled = false, timeoutTimer, pollTimer, polling = false, checkAfterPoll = false;
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

    const finish = (error, receipt) => {
      if (settled) return;
      settled = true;
      cancel(timeoutTimer);
      cancel(pollTimer);
      frame.removeEventListener?.('load', onFrameLoad);
      form.remove();
      frame.remove();
      if (error) reject(error); else resolve(receipt.result || {});
    };
    const poll = async () => {
      if (settled) return;
      if (polling) { checkAfterPoll = true; return; }
      polling = true;
      cancel(pollTimer);
      try {
        const receipt = await readReceipt(command.requestId);
        if (settled) return;
        if (receipt?.ok === true && receipt.requestId === command.requestId && receipt.state === 'accepted') {
          finish(null, receipt);
          return;
        }
        if (receipt?.requestId === command.requestId && receipt.state === 'rejected') {
          const error = new Error(typeof receipt.message === 'string' ? receipt.message : '資料未儲存，請檢查輸入。');
          error.code = 'rejected';
          finish(error);
          return;
        }
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
      if (!settled) { cancel(pollTimer); poll(); }
    };
    frame.addEventListener?.('load', onFrameLoad);
    timeoutTimer = schedule(() => {
      const error = new Error('尚未確認儲存結果。請保留原內容重試，系統會沿用同一筆送出，避免重複入庫。');
      error.code = 'pending';
      finish(error);
    }, options.timeout ?? 90000);
    try {
      pageDocument.body.appendChild(frame);
      pageDocument.body.appendChild(form);
      form.submit();
      pollTimer = schedule(poll, options.initialDelay ?? 1200);
    } catch {
      const error = new Error('尚未確認資料是否送出，請保留原內容重試。');
      error.code = 'pending';
      finish(error);
    }
  });
}
