# Google 共用版上線

正式架構是 GitHub Pages 網站＋Google 表單與私人試算表。公開冰箱不顯示餘量；管理者的 Google 倉庫顯示數量，10 包／瓶／罐以內標紅。

目前已有程式與部署流程，尚需 Google 帳號授權、表單權限設定、正式 `/exec` 網址，以及 GitHub Pages 開站設定。完成後還須實際以兩部手機測試共用與權限，才算正式可用。

## 1. 建立 Google 端

依 [Google 設定說明](GOOGLE-SETUP.md)，把 [Code.gs](../google-apps-script/Code.gs) 貼進自己的 Apps Script 專案。先設定自己的管理者 Google 帳號，執行 `setupOnce` 授權建立私人試算表與三張表單；之後可以加入另一位管理者。

管理表單須收集「已驗證」Email，且只分享給管理者。確認後才執行 `enablePrivateForms`。許願表單允許同事免登入填寫。私人試算表不可發布成公開 CSV。

把 Apps Script 部署成「執行身分：自己；存取：任何人」的網頁應用程式，取得正式 `/exec` 網址。公開端只提供品項與願望，不提供庫存數字或管理者資料。

## 2. GitHub 開站設定

1. 程式放在 `reytai-hldwn/drinks-inventory` 的 `main` 分支。
2. GitHub 儲存庫 **Settings → Pages → Source：GitHub Actions**。
3. **Settings → Secrets and variables → Actions → Variables** 新增 Repository variable：

   | 名稱 | 值 |
   | --- | --- |
   | `GOOGLE_SCRIPT_URL` | 上一步的 `https://script.google.com/macros/s/…/exec` 網址 |

4. **Actions → Deploy Google-connected pantry to GitHub Pages → Run workflow**。
5. 等 `build` 與 `deploy` 成功，使用工作結果提供的 Pages 網址開站。

缺少 `GOOGLE_SCRIPT_URL` 時，部署工作會略過，不代表網站已發布。只改 Variables 不會自動啟動部署，須再執行 Run workflow。

這個網址是網站需要的公開讀取入口，不是密碼或管理金鑰。不要把 Google 密碼、OAuth 權杖或其他秘密填進 GitHub Variables。流程不會改變儲存庫可見性；若私人儲存庫的方案不支援 Pages，需由儲存庫擁有者處理。

## 3. 正式驗證

- 用未登入的手機開網站：29 款飲料、牛奶／豆漿最上層，點門才能往下滑，頁面不顯示餘量。
- 在手機 A 送出願望，手機 B 重新整理後能看到同一筆。
- 管理者可打開私人倉庫與管理表單；其他 Google 帳號與未登入者不可使用管理入口。
- 倉庫初始顯示待盤點。盤點 20、後續入庫 12，應變 32；再盤點 7，應變 7 並標紅。
- `Catalog` 取消 active 後，品項移到歷史區；原本歷史和庫存仍保留。重新上架後回到原分類。

上面的權限與跨手機結果尚未在真實 Google 環境測試；本機及模擬測試通過，不能取代這次正式驗證。
