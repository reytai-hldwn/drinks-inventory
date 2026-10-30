# 用 Google 表單與試算表正式共用

網站前台是可愛飲料冰箱，只顯示品項與願望，不公開庫存數字。私人 Google 試算表是管理後台；管理者以指定 Google 帳號盤點、登記實際到貨、查看庫存。可先由你一個人使用，再加入老闆娘。數量預設 **10 個以下標紅色**。

以下五步需要由擁有 Google 帳號的管理者完成授權。程式已準備好，但尚未替你建立 Google 專案、表單、試算表或公開網址。

## 1. 貼上程式，設定你的管理帳號

開啟 [Google Apps Script](https://script.google.com/)，建立新專案，把 [`google-apps-script/Code.gs`](../google-apps-script/Code.gs) 完整貼入 `Code.gs`。在最上方 `ADMIN_EMAILS = []` 填入你的實際 Google 帳號；至少一個即可，老闆娘的帳號可之後加入。這些帳號只保留在私人程式設定中，不會送到公開網站，也不要提交到公開 GitHub；不用在聊天中提供密碼或任何金鑰。

29 種飲料已依公司確認的清單放入程式，包裝分類也已帶入。**每箱數量留白，庫存保持待盤點，沒有假設實際數量。** 初始清單來源為網站的 `js/catalog.js`；之後日常增修以私人試算表的 `Catalog` 工作表為準，不需要反覆替換初始常數。

## 2. 執行一次設定

在 Apps Script 上方選擇並執行 `setupOnce`，同意 Google 顯示的表單與試算表存取授權。執行紀錄會提供私人試算表入口，裡面有：

- `Warehouse`：庫存列表、盤點及到貨表單入口。這是自動產生的檢視，請用表單更新數量。
- `Archive`：已封存品項及其數量紀錄；舊盤點與到貨不會被刪除。
- `Catalog`：品項、包裝、每箱數量、提醒門檻與啟用狀態。停用時將 `active` 改為 `FALSE`，不要刪除舊列。
- `History`：實際盤點、到貨與未採計回應的紀錄；請保留舊列，不要直接修改歷史數量。更換管理帳號也不會重算或移除先前已採計的紀錄。
- `WishReview`：同事的願望，管理者可將 `pending` 改成 `purchased` 或 `declined`。
- `Setup`：三張 Google 表單的入口。Google 自動建立的回應分頁也會保留。

盤點表單一次填完全部啟用品項；到貨表單選飲料、填實際收到的單包／瓶／罐數量。時間由 Google 收件時間記錄。每箱數量尚未確認也能使用。

## 3. 鎖好管理入口，再啟用管理表單

將**整份試算表**設為「受限制」，只分享給管理名單中的 Google 帳號，勿開啟「知道連結的任何人」。目前只有你的帳號也可以。兩張管理表單（完整盤點、到貨入庫）都要：

1. 在表單設定將「收集電子郵件地址」選成 **已驗證／Verified**；不可選「填答者輸入」，也不可新增一題 Email 當作身分證明。
2. 在表單發布／管理填答者權限中，**只允許名單中的指定帳號回覆**。管理者登入 Google 後才能填寫。
3. 確認這兩項都完成，才把程式最上方 `PRIVATE_FORMS_VERIFIED_AND_RESTRICTED` 改為 `true`，執行 `enablePrivateForms`。

管理表單初始關閉。程式還會檢查 Google 回傳的填答者 Email 是否在管理名單，且忽略啟用驗證前的回應；它不信任自己填寫的 Email 欄位。Apps Script 無法替你確認 Google 後台選的是哪種驗證模式或分享對象，因此不能省略上面的人工設定與實測。

之後加入老闆娘時，在私人 Apps Script 的 `ADMIN_EMAILS` 增加她的帳號並執行 `setupConfig`，再把試算表與兩張管理表單的權限一併分享給她。先前已採計的歷史資料會保留。

第三張「飲料許願」表單則可公開回覆，不收集 Email、不要求登入；請在 Google 表單的發布設定允許任何人填寫。若公司 Google Workspace 政策不允許公開表單或網頁應用程式，需由公司管理員調整，不能僅靠網站繞過。

## 4. 發布唯讀資料網址，接上網站

在 Apps Script 選「部署 → 新增部署 → 網頁應用程式」，執行身分選 **自己／專案擁有者**，存取者選 **任何人**。複製產生的 `/exec` 網址，作為網站的 `googleScriptUrl`。前台只用這個網址讀取公開品項、願望、許願表單入口和受 Google 權限保護的倉庫入口。

資料端不公開庫存數字、盤點數量、歷史、填答者 Email 或兩張管理表單網址。只有 Google 許願表單收新願望，網站不使用未驗證的公開寫入 API。更改程式後需在「管理部署」建立新版本，既有 `/exec` 網址可維持。

網站部署到 GitHub Pages 是另一步；Apps Script 發布不等於網站已上線。完成設定後應以網站實際提供的設定欄位／部署程式接上，不要把私人試算表發布成公開 CSV。

## 5. 管理者與同事各測一次

- 未登入 Google 的手機：能看冰箱、看不到庫存數字；許願會開啟 Google 表單。送出後重新整理網站，願望應出現且為待評估。
- 目前已設定的管理帳號：能打開私人倉庫、填盤點及到貨；其他 Google 帳號與未登入者必須被拒絕。老闆娘加入後也要以她的帳號測一次。
- 第一次盤點前：庫存顯示待盤點。盤點 20、之後到貨 12，應變成 32；再盤點 7，應以 7 為準並標紅，不把以前的到貨重算一次。
- 新願望不能改變庫存；管理表單回應與歷史會保留。停用品項移到封存清單，前台不顯示數量，私人 `Archive` 仍保留數量紀錄。恢復啟用時不用重建品項或歷史。

表單送出後，安裝的觸發器會更新倉庫及願望，可能需要等幾秒再重新整理。若沒有更新，在 Apps Script「執行項目」查看失敗紀錄，或手動執行 `refreshWarehouse`；不要刪除舊回應來重試。

### 公開資料 API 契約

`GET /exec?callback=holdwinCallback`（也接受 `action=public`）以 JSONP 回傳：

```js
holdwinCallback({
  ok: true,
  provider: 'google',
  drinks: [/* id, name, category, packaging, unit, perCase, threshold, active */],
  wishes: [/* id, name, url, note, status, createdAt */],
  formUrls: { wish: 'Google 許願表單的正式回覆網址' },
  adminUrl: 'Google 權限保護的 Warehouse 工作表網址',
  updatedAt: '公開品項／願望最近同步時間'
});
```

不提供 `stock`、`quantity`、`events`、`lastCountAt` 或 Email。未知 action 回覆 `unsupported_action`，不會因 query 參數改成提供私人資料。沒有 `doPost` 公開寫入入口。`updatedAt` 是公開內容同步時間，不代表即時庫存。
