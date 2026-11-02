# 統一標題字型

頁面、區塊、品項卡片與彈窗中的 `h1` 到 `h4` 使用同一款 **LXGW WenKai TC Bold v1.330**。字級仍依標題層級保留差異，字型與字重固定一致；正文與操作欄位保留原本易讀的介面字體。

- 官方來源：[v1.330](https://github.com/lxgw/LxgwWenkaiTC/releases/tag/v1.330)，`LXGWWenKaiTC-Bold.ttf`。
- 授權：[SIL Open Font License](../assets/Pantry-Hand-OFL.txt)。
- `assets/pantry-ui.woff2`：包含目前 HTML、JS 與 CSS 使用字元的精簡版，首頁預載，供既有標題優先使用。
- `assets/fonts/pantry-hand-*.woff2`：同版本、同字重的補充字型，以每 512 個尚未收錄字元分檔並指定 Unicode 範圍。新願望與新飲料只下載實際缺少字元所在的片段。
- `assets/pantry-hand-complete.woff2`：保留完整來源及離線預覽內嵌用途；正式 CSS 不再下載這份 5.3 MB 檔案。

所有檔案都是由相同官方 TTF 以 FontTools／Brotli 產生的 WOFF2。CSS 的 `--heading-font` 統一指定精簡與補充字型；標題規則涵蓋主畫面與彈窗，優先於舊主題的標題字型設定。補充片段僅在精簡檔缺少實際顯示字元時載入，字型均由網站提供，不連外部字型服務。

新增固定文案時，可用 FontTools 對相同官方 TTF 重新取出 `index.html`、`js/*.js` 與根目錄 `*.css` 的字元集合，更新精簡檔；執行 `python3 scripts/build-font-fallbacks.py` 重建補充片段與 CSS；`scripts/build-display-assets.mjs` 也會自動執行這一步。需要 FontTools 與 Brotli。一般 `npm run build` 不需要安裝字型工具，離線預覽維持內嵌精簡檔、完整檔與授權，不會要求本機存取額外字型片段。

片段使用 Brotli 品質 6，編碼速度與大小有差異，字形仍為無損；與完整來源相同的字重、輪廓與字距保留。
