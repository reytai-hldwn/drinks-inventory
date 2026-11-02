# 統一標題字型

頁面、區塊、品項卡片與彈窗中的 `h1` 到 `h4` 使用同一款 **LXGW WenKai TC Bold v1.330**。字級仍依標題層級保留差異，字型與字重固定一致；正文與操作欄位保留原本易讀的介面字體。

- 官方來源：[v1.330](https://github.com/lxgw/LxgwWenkaiTC/releases/tag/v1.330)，`LXGWWenKaiTC-Bold.ttf`。
- 授權：[SIL Open Font License](../assets/Pantry-Hand-OFL.txt)。
- `assets/pantry-hand.woff2`：包含目前 HTML、JS 與 CSS 使用字元的精簡版，首頁預載，供既有標題優先使用。
- `assets/pantry-hand-complete.woff2`：同版本、同字重的完整字型，補足新願望與新飲料等使用者輸入內容，不依賴裝置的中文字型。

兩份檔案都是由相同官方 TTF 以 FontTools／Brotli 產生的 WOFF2。CSS 的 `--heading-font` 統一指定這兩份字型；標題規則涵蓋主畫面與彈窗，優先於舊主題的標題字型設定。完整檔僅在精簡檔缺少實際顯示字元時載入，兩份均由網站提供，不連外部字型服務。

新增固定文案時，可用 FontTools 對相同官方 TTF 重新取出 `index.html`、`js/*.js` 與根目錄 `*.css` 的字元集合，更新精簡檔；完整檔仍會補足尚未放入精簡檔的字元。一般 `npm run build` 不需要安裝字型工具，會把兩份 WOFF2 與授權內嵌到離線預覽。
