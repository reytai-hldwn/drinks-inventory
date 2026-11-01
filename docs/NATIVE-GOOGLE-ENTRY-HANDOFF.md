# 原生表單串接 Google 試算表：暫停紀錄

2026-11-01（台灣時間），使用者準備關機，要求先保存，明天再繼續。

## 已確認的需求

- 沿用 Google Apps Script 與既有 Google 試算表。
- 使用 demo 原本的網站表單外觀；不要改成 Google 表單 iframe 或跳轉填寫。
- 許願、贊同、盤點、入庫與新增飲料皆在網站填寫及送出。
- 許願不填姓名，贊同必填姓名；同瀏覽器每個願望一票。
- 部分盤點可送出，0 有效、留白不改動；入庫整箱或零散擇一，每箱預設 24。
- 保留目前定稿外觀、飲料原圖、既有品項與所有歷史紀錄。

## 正式站與進度

- 儲存庫已公開；保存進度時 GitHub 回報已更名為 `reytai-hldwn/pantry`。明天先確認正式 Pages 網址與部署狀態；先前的 `/drinks-inventory/` 網址不要直接當成仍有效。
- main 的網站定稿版本為 `0fa3e36`；使用者已自行設定 Pages 與 Google 資料網址。
- 本次修改尚未完成整合測試，僅存入 WIP 分支，不發布到 main。
- `npm run check` 已通過；新寫入流程的單元、瀏覽器及真實部署驗證尚未完成。

## 已寫但待驗證的部分

- `google-apps-script/Code.gs`：新增 `doPost`、`WebsiteRequests` 收件紀錄、唯讀 receipt 查詢，以及五種指定操作。準備好的資料分塊保存，使用固定事件 ID 重試，預計避免重複入庫；不接受整份試算表覆寫。
- `js/google-write.js`：隱藏 HTML form POST，透過 JSONP 查詢儲存回條；iframe load 不當成成功，逾時保留同一筆請求。
- `js/google-store.js`：辨識 `websiteEntry.version=1`、以 sessionStorage 保存待確認請求，新增網站送出方法；共用資料讀取失敗時保留已確認的儲存成功結果。
- `js/app.js`：新 Google 版本啟用時，沿用 demo 的原生表單；舊 Google 部署仍走原本流程。已修正未首次盤點品項的入庫預覽，不把未知庫存當成 0。
- `scripts/build-demo.mjs` 已加入新模組；生成 demo 與下載包尚未重新建置。

## 明天優先接續

1. 建立 `tests/google-write.test.mjs` 並加入 npm test。目前先移除對不存在測試檔的引用。
2. 測試五種操作、姓名與登記人、許願類型、空白／零數量、每箱 24、封存與未知品項、重複品名、文字及連結驗證、試算表公式跳脫。
3. 模擬寫入中途失敗後重試，確認事件只寫一次、回條只在資料保存後 accepted、同 request ID 不接受不同內容、同瀏覽器不重複加票。
4. 測試 POST／回條逾時、重新整理後沿用請求 ID、不同內容的待確認請求、已儲存但讀取失敗。檢查 sessionStorage.removeItem 失敗不能把已接受的寫入誤報成失敗。
5. 加上原生表單「儲存中」狀態；檢查桌機與手機五個流程沒有跳到 Google 表單，保持輸入內容及錯誤提示。
6. 使用假的 Google 端點／VM 試算表完成瀏覽器測試；不要把測試資料送到使用者正式試算表。
7. 完成檢查與建置，更新 README、Google 操作說明、一般及私人預覽。實際盤點資料維持在儲存庫外，不上傳 GitHub。
8. 完成後由使用者將最新 Code.gs 貼回既有 Apps Script，再在「管理部署 → 編輯 → 新版本」更新原部署；同一個 /exec 網址可沿用。這個 Google 帳號操作目前無法代做。
9. 確認部署版本會回傳 `websiteEntry.version=1` 才驗證原生送出；不要把本機／模擬測試當成已完成真實同步。

備註：先前已取消「全改成內嵌 Google 表單」的方向。不要繼續該方案或切換 Supabase。
