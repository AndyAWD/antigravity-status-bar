# Antigravity CLI 狀態列設定技能

[![版本](https://img.shields.io/badge/版本-1.0.0-blue.svg)](./SKILL.md)
[![授權條款: MIT](https://img.shields.io/badge/授權條款-MIT-yellow.svg)](./LICENSE)
[![平台](https://img.shields.io/badge/平台-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

繁體中文 | [English](README.md)

本專案提供 Antigravity CLI 狀態列（Statusline / Footer）的客製化與語系設定技能，適用於多平台並確保在各種環境下都能維持高效與穩定的顯示。

## 實際畫面 (Screenshot)

### Windows
![Windows 狀態列截圖](path/to/your/windows_screenshot.png) <!-- TODO: 請在此替換為你的 Windows 截圖路徑 -->

### macOS
![macOS 狀態列截圖](path/to/your/macos_screenshot.png) <!-- TODO: 請在此替換為你的 macOS 截圖路徑 -->

## 功能特色

- **豐富的狀態列指標**：可自由選擇顯示以下資訊：
  - 目前使用的 AI 模型名稱
  - 帳號真實 API 可用額度 (Quota)
  - API 重置時間倒數
  - 目前對話已消耗的 Context 比例
  - 目前 Session 消耗的精確 Token 數量
  - CLI 行程所消耗的 RAM 記憶體量
  - 目前工作區專案的 Git 分支
  - 目前工作區專案路徑 (短路徑 / 完整路徑)
- **多國語言支援**：內建繁體中文、英文與日文，並提供讓 AI 一鍵擴充其他語系的動態架構，任何人都能輕鬆新增專屬的語言版本。
- **設定檔動態解析**：自動處理全域 (`~/.gemini/settings.json`)、CLI 專屬 (`~/.gemini/antigravity-cli/settings.json`) 以及專案層級的設定檔。
- **無 Python 依賴的跨平台架構**：捨棄傳統的 Python 依賴。針對 macOS/Linux 使用原生指令 (`ps`, `lsof`)；針對 Windows 更實作了專屬的靜默 C# 橋接器 (Silent C# Bridge) 並結合 `windowsHide`，徹底解決終端機閃爍問題，同時強化對 Git 環境變數缺失與記憶體 (`agy.exe`) 抓取準確度的深度相容。
- **智慧型換行**：自動偵測終端機寬度，避免狀態列內容超出畫面時發生顯示錯亂。
- **動態視覺色彩回饋**：不僅能依據 API 額度或 Context 消耗比例提供四階段（綠、黃、橘、紅）的警告色，也會根據目前使用的 AI 模型家族自動套用專屬的品牌識別色，提供極致直觀的終端機體驗。

## 環境需求 (Prerequisites)

- **Node.js**: 本技能腳本採用純 Node.js (`.mjs`) 實作，您的系統必須已安裝 Node.js 並且可以在終端機執行 `node` 指令。
- **Git** *(選用)*: 狀態列中會讀取目前專案的 Git 分支。若需正常顯示，建議您的系統有安裝 Git（本專案已對 Windows 下未設定環境變數的情況提供了強化相容）。

## 使用方式

1. 請前往本專案的 **[Releases 頁面](../../releases/latest)** 下載最新的發佈壓縮檔（`.zip` 或 `.tar.gz`）。
2. 解壓縮後，將裡面的 `antigravity-cli-statusline` 資料夾直接放入你的 `~/.gemini/skills/` 目錄中。
3. 透過 Antigravity CLI 執行時，直接輸入 `/antigravity-cli-statusline` 即可啟動本技能。

## 使用 AI 一鍵新增其他語言

你可以使用 AI 助理快速產生其他語言的翻譯版本。為了讓快速模型（如 Gemini Flash）也能精確執行，請直接複製下方的提示詞。

請把 `[LANG_CODE]` 換成你的語系代碼（例如 `ja`），把 `【目標語言】` 換成語言名稱（例如「日文」）：

````
我想為這個 Antigravity CLI Skill 新增【目標語言】翻譯版本（語系代碼：[LANG_CODE]）。

由於本專案是透過單一檔案動態處理多國語系，請「不要」建立新的資料夾。請嚴格遵守以下步驟，直接修改現有檔案：

### 1. 修改 `SKILL.md`
- **尋找「步驟 2」**：在第一階段問卷 JSON 的 `options` 陣列中，新增 `"【目標語言】 ([LANG_CODE])"` 的選項。
- **尋找「步驟 4」**：在列舉說明格式的地方，補上你的語系（例如：`* 若為 [LANG_CODE]，請使用【目標語言】說明配上英文識別碼。`）。

### 2. 修改 `scripts/statusline-quota.mjs`
- **尋找 `const i18n = {` 字典**：在裡面新增一個 `[LANG_CODE]` 的物件，並把裡面 9 個狀態列指標翻譯成【目標語言】。請參考 `zh-tw` 或 `us` 的格式，務必保留原有的 ANSI 色彩變數。
- **尋找 `getGitBranch(lang)` 函式**：修改裡面**所有**寫死的三元運算子（共兩處），加上【目標語言】對於「無版本控制」的翻譯。
- **尋找 `countdownVal` 變數**：修改後面的三元運算子，加上【目標語言】對於「無 / N/A」的翻譯。
````

## 貢獻指南 (Contributing)

非常歡迎大家提交 PR（Pull Request）來參與貢獻！如果你對這個專案有任何新功能的想法、發現 Bug，或是想要最佳化程式碼，都歡迎隨時發起 PR 或建立 Issue。不論是新增更多的狀態列指標、改善跨平台相容性，或是修正錯字，都非常期待你的加入！

## 鳴謝

特別感謝 [60ke/antigravity-statusline](https://github.com/60ke/antigravity-statusline) 專案。本專案的額度監控靈感正是來自於此，由於該原專案主要是使用 Python 撰寫，在 Windows 和 macOS 跨平台執行上可能遇到環境設定的困難，因此我使用 JavaScript (Node.js) 進行改寫，以實現真正的跨平台免安裝依賴執行。

## 授權條款

本專案採用 [MIT License](LICENSE) 授權。
