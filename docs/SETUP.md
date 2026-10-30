# 宏穩茶水間 · 選配的資料庫部署方式

目前先完成本機示範，不需要設定本文件。若未來希望讓前台公開許願、庫存跨裝置同步，並由指定管理者登入後台，可採用這份 Supabase 方案；Google 試算表／表單也是可另行評估的共用來源。

本網站以原生 HTML、CSS、JavaScript 製作，可放在 GitHub Pages。此選配方案由 GitHub Pages 提供網頁、Supabase 保存共用庫存與登入帳號。

未設定 Supabase 時，網站使用瀏覽器的示範資料。示範模式不會跨裝置同步；不要把其中數字當成公司實際庫存。

## 1. 建立 Supabase 資料庫

1. 在 [Supabase](https://supabase.com/) 建立自己的專案。請依服務當時方案確認額度、暫停政策與費用。
2. 打開專案的 SQL Editor，貼上並執行 [`supabase/schema.sql`](../supabase/schema.sql) 完整內容。
3. SQL 會建立空白庫存，不會把網站的示範庫存寫進正式資料庫。重複執行也不會清除現有資料。

本版本將整份飲料、歷史與許願清單存在一份 JSON 文件，適合約 30 種飲料、兩位編輯者的初期用途。管理者儲存時比對版本，避免覆蓋別人的修改或新願望；公開許願則直接附加到最新資料，不會改動庫存。

## 2. 建立兩位編輯者

1. 在 Supabase 的 Authentication → Users 建立你和老闆娘的 Email／密碼帳號。透過安全方式自行交付密碼，不要放在 GitHub、聊天紀錄或網站設定內。
2. 在 Authentication 設定關閉公開註冊（Allow new users to sign up）。前台免登入查看庫存及提交願望；管理後台提供登入，沒有自助註冊。
3. 在 Users 頁複製各帳號的 User UID。
4. 在 SQL Editor 執行下方指令，把範例 UUID 換成兩位使用者的實際 UUID：

```sql
insert into public.editors (user_id)
values
  ('第一位使用者的 UUID'::uuid),
  ('第二位使用者的 UUID'::uuid)
on conflict (user_id) do nothing;
```

只有登入並且列於 `editors` 的帳號可以在管理後台修改庫存、盤點、到貨入庫、品項或願望狀態。前台任何人都可免登入新增「待評估」願望，但無法修改既有願望或庫存。新建一個帳號本身不會取得管理權限。移除權限可在 SQL Editor 刪除該帳號對應的 `editors` 資料列。

## 3. 設定網站

在 Supabase 專案設定取得 Project URL 與公開的 `anon` key（舊式公開金鑰），填入網站根目錄的 `config.js`：

```js
window.DRINKS_CONFIG = {
  supabaseUrl: 'https://你的專案代號.supabase.co',
  supabaseAnonKey: '你的公開 anon key'
};
```

這兩個值需要提供給瀏覽器，可以放在公開的前端設定中；實際寫入權限由資料庫的 Row Level Security 與 RPC 決定。**不要填入 `service_role`、Secret key、資料庫密碼或使用者登入密碼。**

設定後重新整理網站，確認前台顯示共用資料並可免登入提交願望。從頁首「管理後台」（`#admin`）進入，確認指定帳號登入成功且可以新增飲料。正式資料庫一開始沒有飲料，需由編輯者新增實際品項與盤點數量。

## 4. 部署 GitHub Pages

1. 將網站檔案提交並推送到 `reytai-hldwn/drinks-inventory` 的 `main` 分支。
2. 在 GitHub 儲存庫 Settings → Pages，將 Source 設為 **Deploy from a branch**。
3. 選取 `main` 與 `/ (root)`，儲存並等待 GitHub 完成發布。
4. 以 GitHub Pages 頁面提供的網址開啟網站。

本專案不需要建置指令或 npm 安裝。GitHub Pages 部署是否可用與費用，取決於儲存庫可見性及 GitHub 帳戶方案。只有上述步驟實際完成後，網站才算已公開部署；本機測試或完成設定檔不代表已上線。

## 5. 上線前確認

- 使用未登入的瀏覽器查看前台：應可讀取庫存與許願清單、提交新願望，新願望狀態固定為「待評估」。
- 未登入者進入管理後台應要求登入；不得修改庫存、盤點、入庫、品項或既有願望狀態。
- 從「管理後台」以你的指定帳號登入：新增品項、盤點、實際到貨入庫與願望狀態應能保存。
- 在另一個裝置重新開啟：應看見剛儲存的資料，而不是另一份本機資料。
- 使用老闆娘帳號登入：同樣應可編輯。
- 兩個瀏覽器同時編輯舊版本，或前台剛送出新願望：持舊版本儲存的管理者應收到資料變更提醒，重新載入後再操作，不應靜默覆蓋。

庫存、許願及歷史資料在這個版本允許公開讀取，任何取得網址或專案公開設定的人都可能讀取；前台同時允許免登入提交新願望。請勿填入員工個資、密碼、內部採購合約或其他敏感內容。若日後需要只限公司同事查看，須另外修改讀取權限並要求登入。

## 日常使用與資料維護

- 庫存統一使用單包／瓶／罐，每箱數量只是到貨數量的換算參考。
- 盤點約每三天或每週一次，數字代表最後盤點／補貨紀錄，不代表即時感測庫存。
- 只有實際收到飲料時才登記到貨數量，儲存後增加帳面庫存並自動記錄時間。分批收到就分次登記，未到貨不登記。
- 同事在前台提交飲料名稱、購買連結與備註；新願望一律待評估，由管理者登入後台管理採購狀態。
- 既有歷史紀錄會保留，流程調整不會清除先前的資料。
- 消耗推估使用「前次盤點＋期間到貨－本次盤點」，不等於銷售或收銀紀錄。
- 請定期備份 Supabase 的 `inventory_state` 資料及必要設定。免費服務可能休眠或限制備份功能，請依實際方案安排。

## 前端整合契約

- 讀取：`GET /rest/v1/inventory_state?singleton=eq.true&select=revision,payload,updated_at`，回傳一筆陣列。
- 權限：已登入者查詢 `editors`，`user_id` 等於登入帳號 UUID；RLS 只允許查詢自己的資格。
- 管理者儲存：`POST /rest/v1/rpc/save_inventory`，JSON body 為 `{ "expected_revision": 目前版本, "payload": 完整資料 }`。
- 公開許願：`POST /rest/v1/rpc/submit_wish`，JSON body 為 `{ "wish_name": "飲料名稱", "wish_url": "https://產品連結（可留空）", "wish_note": "備註（可留空）" }`；不需要登入，也不接收庫存、願望狀態、ID、時間或版本參數。名稱最多 80 字、備註最多 500 字、連結最多 2,000 字；只允許不含帳號密碼的 HTTP(S) 連結。
- 兩種儲存操作成功回傳：`[{ "revision": 新版本, "payload": 完整資料, "updated_at": 時間 }]`。
- 版本衝突：錯誤 `code: "40001"`、`message: "inventory_conflict"`，重新讀取後再操作，不要無條件重試寫入。
- 沒有編輯權限：錯誤 `code: "42501"`、`message: "editor_required"`。
- `payload` 格式：`{ "drinks": [], "events": [], "wishes": [], "lastInventoryAt": null }`。

`save_inventory` 使用具名複合回傳型別 `inventory_save_result`，以同時保留輸入與回傳欄位的 `payload` 名稱。整份文件的讀取是公開的，直接寫資料表則禁止。管理者必須透過會檢查資格及版本的 `save_inventory` 儲存；匿名使用者只能呼叫 `submit_wish`，由伺服器產生 ID、時間與 `pending` 狀態，原子附加願望，不接受任意庫存或既有願望狀態的修改。
