---
name: antigravity-status-bar
description: 設定 Antigravity CLI 狀態列（Status Bar）的顯示項目與語系設定。當使用者要求「設定狀態列」、「調整 CLI 頁尾」或啟動此技能時使用。
---

# Antigravity 狀態列設定技能

本技能提供有關 Antigravity CLI 狀態列（Status Bar / Footer）的客製化與語系設定指引，適用於多平台與開源分享。

## 🎯 設定檔路徑規範（動態解析）

為確保取得最新資料與正確寫入，每次執行本技能時，AI 代理（Agent）**必須先動態解析以下路徑並進行讀取（View File）**，嚴禁使用寫死的絕對路徑：

1.  **全域設定檔（Global Settings）**：
    *   路徑語法：`~/.gemini/settings.json`
    *   *AI 執行規範*：請動態獲取當前作業系統的家目錄（環境變數 `$HOME` 或 `USERPROFILE`），並將其展開為當前使用者的絕對路徑後進行讀取。
2.  **CLI 專屬設定檔（CLI-Specific Settings，最高優先級）**：
    *   路徑語法：`~/.gemini/antigravity-cli/settings.json`
    *   *AI 執行規範*：此檔案由 Antigravity CLI（`agy`）自身維護，其優先級**高於**全域設定檔。AI 代理**必須**在 Pre-check 階段讀取此檔案，確認其中是否存在空的 `statusLine` 物件，若存在則需在步驟 5 中同步覆寫為正確的設定。
3.  **專案設定檔（Project Settings）**：
    *   路徑語法：當前工作區根目錄下的 `.gemini/settings.json`
    *   *AI 執行規範*：請動態獲取目前作用中工作區（Workspace）的根目錄絕對路徑，並讀取該目錄下相對路徑 of `.gemini/settings.json`（若專案設定檔存在）。

## 📊 狀態列設計規格

目前 Antigravity CLI 狀態列支援以下原生項目：
*   `model-name`：目前使用的 AI 模型名稱（例如：Gemini 3.5 Flash (High)）
*   `quota`：帳號真實剩餘額度百分比（API Quota）
*   `context-used`：目前對話已消耗 of Context 比例（例如：5.1%）
*   `memory-usage`：CLI 行程所消耗 the RAM 記憶體量（例如：142MB）
*   `token-count`：目前 Session 消耗的精確 Token 數量
*   `quota-reset-countdown`：額度重製時間倒數 (Quota Reset in)
*   `git-branch`：目前工作區專案的 Git 分支名稱 (例如：main，非 Git 環境則顯示「無版本控制」)
*   `project-path`：目前工作區專案的資料夾名稱 (短路徑)
*   `project-full-path`：目前工作區專案的完整絕對路徑

自訂語系偏好將記錄於設定檔的 `ui.language` 屬性中。

---

## 🛠️ 狀態列 Hook 技術實作規範（核心標準）

為確保狀態列在任何極端環境下都能維持極致效能與穩定美觀，AI 代理在建立或修改 `statusline-quota.mjs` 與背景快取更新程序 `fetch-local-quota.mjs` 時，**必須嚴格遵守以下開發標準**：

1.  **純 Node.js 跨平台實作**：
    *   全面廢棄依賴 Python (`ps`, `lsof`) 的作法。
    *   在 Windows 必須使用 `wmic` + `netstat -ano`，在 macOS/Linux 必須使用 `ps auxww` + `lsof`。
    *   所有 `fs.writeFileSync` 呼叫都必須明確帶上 `{ encoding: 'utf8' }`，防止在 Windows 環境下生成 UTF-16 導致 CLI 崩潰。
2.  **智慧型多行換行（Smart Line Wrapping by Feature）**：
    *   讀取 `meta.terminal_width` 或 `process.stdout.columns` 來得知終端機寬度。
    *   組合狀態列字串時，如果下一個加入的「指標」（例如：`API 額度: 94.9%`）會讓目前的整行長度（不含 ANSI 碼）超過終端機寬度，就必須將該指標與後續指標折疊到新的一行（即插入 `\n`）。
3.  **四階段精確色彩辨識（4-Tier ANSI Colors）**：
    *   針對百分比設計顏色：`100~75%` = 綠色、`74~50%` = 黃色、`49~25%` = 橘色、`24~0%` = 紅色。
4.  **無痕清理（Uninstall / Cleanup）**：
    *   當使用者選擇「還原設定」時，AI 不僅要清空 `settings.json`，**還必須無條件刪除** `~/.gemini/hooks/statusline-quota.mjs`、`~/.gemini/hooks/fetch-local-quota.mjs` 以及快取檔 `~/.gemini/tmp/real_quota_cache.json`。

---

## 🔄 執行步驟指南

### 步驟 1：取得最新資料（Pre-check）
在向使用者提問前，**必須動態展開並讀取上述三個設定檔**（全域、CLI 專屬、專案）。檢查目前 `ui.footer.items` 啟用了哪些項目、`ui.language` 設定，以及各設定檔中是否存在空的 `statusLine` 物件。

### 步驟 2：第一階段問卷（選擇語系）
呼叫 `ask_question` 工具並傳送以下問卷，收集使用者的語言偏好（由於 Antigravity CLI 原生支援以 `/statusline` 切換啟用或關閉狀態列，因此無需提供冗長的還原選單，最大化簡化問答流程）：

```json
{
  "questions": [
    {
      "question": "選擇顯示語系 / Select Display Language / 表示言語の選択",
      "is_multi_select": false,
      "options": [
        "繁體中文 (zh-tw)",
        "English (us)",
        "日本語 (jp)"
      ]
    }
  ]
}
```

### 步驟 3：流程控制
*   根據第一階段所選取的語言代碼（如 `zh-tw`, `us`, `jp`），動態決定第二階段問卷的顯示語系，並直接進入步驟 4。

### 步驟 4：第二階段問卷（動態語系細部設定）
請**根據階段一所選取的語言**，動態組合出以下對應語系的問卷內容，並呼叫 `ask_question` 發送。
由於 `ask_question` 的 `options` 僅支援字串陣列（不支援 `label` / `description` 物件），為同時提供直觀的語言翻譯與系統識別碼，我們統一採用 `「說明文字 (識別碼)」` 格式。

*   若為 `zh-tw`，請使用中文說明配上英文識別碼。
*   若為 `us`，請使用英文說明配上英文識別碼。
*   若為 `jp`，請使用日文說明配上英文識別碼。

由於 CLI 狀態列支援「多行智慧折行」且容納指標無上限，**嚴禁將指標拆分為多個問題發送**。必須將所有指標合併至單一多選問題中，以求極致直觀的 UX 體驗。

以下為 `zh-tw` 的問卷 JSON 結構範例：

```json
{
  "questions": [
    {
      "question": "選擇啟用的狀態列指標",
      "is_multi_select": true,
      "options": [
        "目前使用的 AI 模型名稱 (model-name)",
        "帳號真實剩餘額度 (quota)",
        "目前對話已消耗的 Context 比例 (context-used)",
        "CLI 行程所消耗的 RAM 記憶體量 (memory-usage)",
        "目前 Session 消耗的精確 Token 數量 (token-count)",
        "額度重製時間倒數 (quota-reset-countdown)",
        "目前工作區專案的 Git 分支 (git-branch)",
        "目前工作區專案短路徑 (project-path)",
        "目前工作區專案完整路徑 (project-full-path)"
      ]
    }
  ]
}
```

### 步驟 5：設定檔資料合併與寫入
*   確定「語言代碼」：採用第一階段問卷的選擇結果。
*   收集要啟用的項目列表：直接解析第二階段問題中所勾選的項目陣列。
*   在解析使用者的回答時，使用正則表達式 `/\(([^)]+)\)$/` 從選項字串（例如 `"目前使用的 AI 模型名稱 (model-name)"`）中提取出英文識別碼（例如 `"model-name"`）。
*   將 `ui.language` 與解析出的 `ui.footer.items` 寫入動態解析出的全域與專案設定檔中。
*   **【關鍵狀態列註冊（多層設定檔同步寫入）】**：Antigravity CLI 存在**多個層級的設定檔**，且高優先級的設定檔會覆蓋低優先級的設定。若只寫入其中一層，可能會被另一層的空設定靜默覆蓋而導致 Hook 完全失效。
    AI 代理**必須同時在以下所有設定檔中寫入**（或確保存在）正確的 `statusLine` 物件：
    1.  **全域設定檔**：`~/.gemini/settings.json`
    2.  **CLI 專屬設定檔（最高優先級）**：`~/.gemini/antigravity-cli/settings.json`
        > [!CAUTION]
        > 這是最容易被忽略的致命盲點！Antigravity CLI（`agy`）**優先讀取此檔案**。若此檔案中存在 `statusLine` 物件且 `command` 為空字串，將會完全覆蓋全域設定檔中的正確設定，導致狀態列無聲無息地失效。AI 代理**必須**在此檔案中也寫入完整的 `statusLine` 設定。
    3.  **專案設定檔**（若存在）：當前工作區根目錄下的 `.gemini/settings.json`

    AI 代理應在執行時動態獲取當前使用者的家目錄絕對路徑，並直接將**絕對路徑**寫入 `command` 中，避免 CLI 在背景執行 Hook 時因無法展開 Shell 環境變數（如 `$HOME`）而導致路徑解析失敗：
    *   在 **macOS / Linux** 系統下，寫入：
        ```json
        "statusLine": {
          "enabled": true,
          "type": "command",
          "command": "node /Users/[動態解析的使用者名稱]/.gemini/hooks/statusline-quota.mjs"
        }
        ```
    *   在 **Windows** 系統下，寫入（務必以 `{ encoding: 'utf8' }` 寫入設定檔）：
        ```json
        "statusLine": {
          "enabled": true,
          "type": "command",
          "command": "node C:\\Users\\[動態解析的使用者名稱]\\.gemini\\hooks\\statusline-quota.mjs"
        }
        ```

*   **【安全性信任機制註冊（防呆機制）】**：為防止 CLI 的安全性（Security）機制因 Hook 未受信任而將其靜默阻擋，AI 代理**必須**動態讀取並更新全域的 `~/.gemini/trusted_hooks.json` 檔案。
    請在當前專案工作區目錄絕對路徑、使用者家目錄絕對路徑，以及萬用字元鍵 `"*"` 的陣列中，同步寫入或追加（Append）對應的信任規則。
    具體而言，對應路徑的陣列中必須確保包含以下信任標記：
    *   `"statusLine:node [當前使用者家目錄絕對路徑]/.gemini/hooks/statusline-quota.mjs"`

*   完成寫入後，繼續執行**步驟 6（自動部署跨平台 Hook）**。

### 步驟 6：自動部署 Hook 腳本原始碼（開源通用閉環）

> [!IMPORTANT]
> AI 代理必須動態展開家目錄絕對路徑（如 `join(os.homedir(), '.gemini', 'hooks', ...)`），將以下兩份程式碼寫入對應路徑，且寫入時**務必設定 `{ encoding: 'utf8' }`**。

#### 📂 建立/覆蓋背景快取更新腳本：`~/.gemini/hooks/fetch-local-quota.mjs`
```javascript
import { spawnSync, execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import https from 'https';
import os from 'os';

const CACHE_FILE = join(os.homedir(), '.gemini', 'tmp', 'real_quota_cache.json');

function formatResetTime(resetTimeStr) {
  try {
    const reset = new Date(resetTimeStr);
    const diffSeconds = Math.floor((reset.getTime() - Date.now()) / 1000);
    if (diffSeconds <= 0) return 'now';
    const minutes = Math.floor((diffSeconds + 59) / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return remHours ? `${days}d ${remHours}h` : `${days}d`;
    }
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  } catch (e) {
    return '';
  }
}

function findServerCandidates() {
  try {
    let output = '';
    const candidates = [];
    if (process.platform === 'win32') {
      try {
        output = execSync('wmic process where "name like \\'%language_server%\\' or name like \\'%agy%\\'" get ProcessId,CommandLine', { encoding: 'utf8' });
        const lines = output.split('\\n');
        for (const line of lines) {
          const lower = line.toLowerCase();
          const isCli = lower.includes('agy ');
          const isLang = lower.includes('language_server');
          if (!isCli && !isLang) continue;
          const matchToken = line.match(/--csrf_token\\s+([^\\s"']+)/);
          const token = matchToken ? matchToken[1] : '';
          const matchPid = line.trim().match(/\\s+(\\d+)$/);
          if (matchPid) {
            candidates.push({
              pid: parseInt(matchPid[1], 10),
              csrf_token: token,
              score: (isCli ? 40 : 0) + (isLang ? 20 : 0) + (token ? 10 : 0),
              kind: isCli ? 'cli' : 'language_server'
            });
          }
        }
      } catch (e) {}
    } else {
      try {
        output = execSync('ps auxww', { encoding: 'utf8' });
        const lines = output.split('\\n');
        for (const line of lines) {
          const lower = line.toLowerCase();
          const isCli = /\\bagy(\\s|$)/.test(lower);
          const isLang = lower.includes('language_server');
          if (!isCli && !isLang) continue;
          const parts = line.trim().split(/\\s+/);
          if (parts.length < 11) continue;
          const pid = parseInt(parts[1], 10);
          if (isNaN(pid)) continue;
          
          const matchToken = line.match(/--csrf_token(?:=|\\s+)([^\\s"']+)/);
          const token = matchToken ? matchToken[1] : '';
          candidates.push({
            pid,
            csrf_token: token,
            score: (isCli ? 40 : 0) + (isLang ? 20 : 0) + (token ? 10 : 0) - (lower.includes('/applications/antigravity.app') ? 10 : 0),
            kind: isCli ? 'cli' : 'language_server'
          });
        }
      } catch (e) {}
    }
    return candidates.sort((a, b) => b.score - a.score);
  } catch (e) {
    return [];
  }
}

function getListeningPorts(pid) {
  const ports = [];
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr ${pid}`, { encoding: 'utf8' });
      const matches = [...output.matchAll(/TCP\\s+(?:127\\.0\\.0\\.1|0\\.0\\.0\\.0):(\\d+).*?LISTENING/g)];
      for (const m of matches) {
        const port = parseInt(m[1], 10);
        if (!ports.includes(port)) ports.push(port);
      }
    } else {
      const output = execSync(`lsof -nP -a -p ${pid} -iTCP -sTCP:LISTEN`, { encoding: 'utf8' });
      const matches = [...output.matchAll(/:(\\d+)\\s+\\(LISTEN\\)/g)];
      for (const m of matches) {
        const port = parseInt(m[1], 10);
        if (!ports.includes(port)) ports.push(port);
      }
    }
  } catch (e) {}
  return ports.sort((a, b) => a - b);
}

function requestUserStatus(port, csrfToken) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' }
    });
    
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
      method: 'POST',
      rejectUnauthorized: false,
      timeout: 2000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        'X-Codeium-Csrf-Token': csrfToken,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch(e) { reject(e); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

async function fetchLiveQuotaCache() {
  const candidates = findServerCandidates();
  // 跨所有候選者合併模型資料，避免只取到部分模型
  const allModels = {};
  for (const info of candidates) {
    const ports = getListeningPorts(info.pid);
    for (const port of ports) {
      try {
        const response = await requestUserStatus(port, info.csrf_token);
        const userStatus = response.userStatus || {};
        const cascade = userStatus.cascadeModelConfigData || {};
        for (const model of cascade.clientModelConfigs || []) {
          const quotaInfo = model.quotaInfo;
          if (!quotaInfo) continue; // 沒有 quotaInfo 視為不受限，或不需處理
          
          let fraction = 1;
          if (quotaInfo.remainingFraction !== undefined) {
            fraction = parseFloat(quotaInfo.remainingFraction);
          } else if (quotaInfo.resetTime) {
            // 如果有 resetTime 但沒有 remainingFraction，表示 protobuf 將 0 省略了
            fraction = 0;
          } else {
            continue;
          }
          
          const label = model.label || (model.modelOrAlias && model.modelOrAlias.model) || 'Unknown';
          const remaining = Math.max(0, Math.min(100, fraction * 100));
          const entry = {
            name: label,
            remaining_percentage: remaining,
          };
          if (quotaInfo.resetTime) {
            entry.reset_time = quotaInfo.resetTime;
            entry.refreshes_in = formatResetTime(quotaInfo.resetTime);
          }
          const normKey = label.toLowerCase().replace(/[^a-z0-9]+/g, '');
          // 若同一模型已存在，以最新（較低）的額度為準
          if (!allModels[normKey] || entry.remaining_percentage < allModels[normKey].remaining_percentage) {
            allModels[normKey] = entry;
          }
        }
      } catch (e) {
        continue;
      }
    }
  }
  if (Object.keys(allModels).length > 0) {
    return { models: allModels, updatedAt: Date.now() };
  }
  return null;
}

async function main() {
  try {
    const cache = await fetchLiveQuotaCache();
    if (cache) {
      mkdirSync(dirname(CACHE_FILE), { recursive: true });
      writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), { encoding: 'utf8' });
    }
  } catch (e) {}
}

main();
```

#### 📂 建立/覆蓋 Hook 主腳本：`~/.gemini/hooks/statusline-quota.mjs`
```javascript
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { spawn, execSync } from 'child_process';
import { join, basename } from 'path';
import os from 'os';

function getGitBranch(lang) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return branch || (lang === 'zh-tw' ? '無版本控制' : (lang === 'jp' ? 'バージョン管理なし' : 'No VC'));
  } catch (e) {
    return lang === 'zh-tw' ? '無版本控制' : (lang === 'jp' ? 'バージョン管理なし' : 'No VC');
  }
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GRAY = "\x1b[90m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const ORANGE = "\x1b[38;5;208m";
const RED = "\x1b[31m";

// 四階梯色彩辨識：100~75% 綠、74~50% 黃、49~25% 澄、24~0% 紅
function getColorByPercentage(pct) {
  if (pct >= 75) return GREEN;
  if (pct >= 50) return YELLOW;
  if (pct >= 25) return ORANGE;
  return RED;
}

// 根據模型家族取得色彩 (Claude: #dd5013, Gemini: #4796e3, GPT: #74aa9c)
function getModelColor(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('claude')) return "\x1b[38;2;221;80;19m";
  if (lower.includes('gemini')) return "\x1b[38;2;71;150;227m";
  if (lower.includes('gpt') || lower.includes('chatgpt')) return "\x1b[38;2;116;170;156m";
  return "";
}

// 清理 ANSI 碼以計算純文字長度
function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function getCliMemoryMB() {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`wmic process where processid=${process.ppid} get WorkingSetSize`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const match = output.match(/\\d+/);
      if (match) return Math.round(parseInt(match[0], 10) / 1024 / 1024);
    } else {
      const output = execSync(`ps -o rss= -p ${process.ppid}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const memKb = parseInt(output.trim(), 10);
      if (!isNaN(memKb)) return Math.round(memKb / 1024);
    }
  } catch (e) {}
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

function getDisplayWidth(str) {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    width += str.charCodeAt(i) > 0x7F ? 2 : 1;
  }
  return width;
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    let timer = setTimeout(() => resolve(data), 50);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
  });
}

function getSettings() {
  const globalPath = join(os.homedir(), '.gemini', 'settings.json');
  const projectPath = join(process.cwd(), '.gemini', 'settings.json');
  let settings = {};
  try { if (existsSync(globalPath)) settings = JSON.parse(readFileSync(globalPath, 'utf8')); } catch (e) {}
  try {
    if (existsSync(projectPath)) {
      const projSettings = JSON.parse(readFileSync(projectPath, 'utf8'));
      settings = { ...settings, ...projSettings };
      if (projSettings.ui) {
        settings.ui = { ...settings.ui, ...projSettings.ui };
        if (projSettings.ui.footer) settings.ui.footer = { ...settings.ui.footer, ...projSettings.ui.footer };
      }
    }
  } catch (e) {}
  return settings;
}

function formatTokens(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

function normalizeModelName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function main() {
  if (process.env.DISABLE_QUOTA_HOOK) process.exit(0);
  let meta = {};

  try {
    const stdinStr = await readStdin();
    try { if (stdinStr.trim()) meta = JSON.parse(stdinStr); } catch (e) {}

    const settings = getSettings();
    // 扣除 15 格的安全邊距，防止 CLI 左右 padding 導致過晚換行
    const termWidth = Math.max(40, (meta?.terminal_width || process.stdout.columns || 80) - 15);
    
    let fallbackModel = 'Gemini 3.5 Flash (High)';
    if (meta?.model?.display_name) fallbackModel = meta.model.display_name;
    else if (meta?.model?.id) fallbackModel = meta.model.id;
    
    // 退讓模式：若使用者已還原，輸出預設 UI
    if (!settings?.ui?.footer?.items) {
      const leftText = '? for shortcuts';
      const rightText = fallbackModel;
      const spacesCount = Math.max(1, termWidth - getDisplayWidth(leftText) - getDisplayWidth(rightText) - 1);
      const spaces = ' '.repeat(spacesCount);
      console.log(`${leftText}${spaces}${rightText}`);
      process.exit(0);
    }
    
    const lang = settings?.ui?.language || 'zh-tw';
    const footerItems = settings.ui.footer.items;
    
    const cachePath = join(os.homedir(), '.gemini', 'tmp', 'real_quota_cache.json');
    let cache = null;
    let needUpdate = true;
    
    try {
      if (existsSync(cachePath)) {
        cache = JSON.parse(readFileSync(cachePath, 'utf8'));
        if (Date.now() - (cache.updatedAt || 0) < 30000) needUpdate = false;
      }
    } catch (e) {}

    if (needUpdate) {
      try {
        const updaterScript = join(os.homedir(), '.gemini', 'hooks', 'fetch-local-quota.mjs');
        if (existsSync(updaterScript)) {
          spawn('node', [updaterScript], {
            env: { ...process.env, DISABLE_QUOTA_HOOK: '1' },
            stdio: 'ignore',
            detached: true
          }).unref();
        }
      } catch (e) {}
    }

    const normModel = normalizeModelName(fallbackModel);
    let modelQuota = null;
    if (cache && cache.models) {
      // 第一優先：完全匹配
      if (cache.models[normModel]) {
        modelQuota = cache.models[normModel];
      } else {
        // 第二優先：子字串模糊匹配
        for (const k in cache.models) {
          if (normModel.includes(k) || k.includes(normModel)) {
            modelQuota = cache.models[k];
            break;
          }
        }
      }
      // 第三優先：同族群（family）匹配
      // 同一供應商的模型通常共享額度池（如 Claude 系列、GPT 系列）
      if (!modelQuota) {
        const families = ['claude', 'gemini', 'gpt'];
        const modelFamily = families.find(f => normModel.includes(f));
        if (modelFamily) {
          for (const k in cache.models) {
            if (k.includes(modelFamily)) {
              // 取同族群中額度最低的（最保守估計）
              if (!modelQuota || cache.models[k].remaining_percentage < modelQuota.remaining_percentage) {
                modelQuota = cache.models[k];
              }
            }
          }
        }
      }
    }
    // 若所有策略均無法匹配，使用快取中所有模型的最低額度而非預設 100%
    if (!modelQuota && cache && cache.models) {
      const allKeys = Object.keys(cache.models);
      if (allKeys.length > 0) {
        modelQuota = allKeys.reduce((min, k) =>
          cache.models[k].remaining_percentage < min.remaining_percentage ? cache.models[k] : min
        , cache.models[allKeys[0]]);
      }
    }
    if (!modelQuota) modelQuota = { remaining_percentage: 100, refreshes_in: '' };

    const quotaPct = modelQuota.remaining_percentage;
    const quotaColor = getColorByPercentage(quotaPct);
    const quotaVal = `${Math.round(quotaPct)}%`;
    
    const contextWindow = meta.context_window || {};
    const conversationId = meta.conversation_id || 'default';
    const ctxCachePath = join(os.homedir(), '.gemini', 'tmp', `ctx_${conversationId}.json`);
    
    let totalInput = contextWindow.total_input_tokens || 0;
    let totalOutput = contextWindow.total_output_tokens || 0;
    let usedPctNum = contextWindow.used_percentage || 0;
    const contextSize = contextWindow.context_window_size || 1048576;
    
    if (totalInput === 0 && totalOutput === 0) {
      try {
        if (existsSync(ctxCachePath)) {
          const cachedCtx = JSON.parse(readFileSync(ctxCachePath, 'utf8'));
          totalInput = cachedCtx.total_input_tokens || 0;
          totalOutput = cachedCtx.total_output_tokens || 0;
          if (cachedCtx.used_percentage) usedPctNum = cachedCtx.used_percentage;
        }
      } catch (e) {}
    } else {
      try {
        mkdirSync(join(os.homedir(), '.gemini', 'tmp'), { recursive: true });
        writeFileSync(ctxCachePath, JSON.stringify({
          total_input_tokens: totalInput,
          total_output_tokens: totalOutput,
          used_percentage: usedPctNum
        }), { encoding: 'utf8' });
      } catch (e) {}
    }
    
    if (contextSize > 0 && (totalInput + totalOutput) > 0) {
      usedPctNum = ((totalInput + totalOutput) / contextSize) * 100;
    }
    
    const remainCtx = Math.max(0, 100 - usedPctNum);
    const contextColor = getColorByPercentage(remainCtx);
    const usedPct = `${usedPctNum.toFixed(1)}%`;
    
    const rssMem = getCliMemoryMB();
    const memUsage = `${rssMem}MB`;
    const totalTokens = totalInput + totalOutput;
    const tokenCount = `${formatTokens(totalTokens)} / ${formatTokens(contextSize)}`;
    const countdownVal = modelQuota.refreshes_in || (lang === 'zh-tw' ? '無' : (lang === 'jp' ? 'なし' : 'N/A'));
    const gitBranch = getGitBranch(lang);
    const projectName = basename(process.cwd());
    const projectFullPath = process.cwd();

    const i18n = {
      'zh-tw': {
        'model-name': `模型: ${getModelColor(fallbackModel)}${BOLD}${fallbackModel}${RESET}`,
        'quota': `API 額度: ${quotaColor}${quotaVal}${RESET}`,
        'context-used': `Context: ${contextColor}${usedPct}${RESET}`,
        'memory-usage': `記憶體: ${memUsage}`,
        'token-count': `Token: ${tokenCount}`,
        'quota-reset-countdown': `額度重製倒數: ${countdownVal}`,
        'git-branch': `Git 分支: ${BOLD}${gitBranch}${RESET}`,
        'project-path': `專案: ${BOLD}${projectName}${RESET}`,
        'project-full-path': `專案路徑: ${BOLD}${projectFullPath}${RESET}`
      },
      'us': {
        'model-name': `Model: ${getModelColor(fallbackModel)}${BOLD}${fallbackModel}${RESET}`,
        'quota': `Quota: ${quotaColor}${quotaVal}${RESET}`,
        'context-used': `Context: ${contextColor}${usedPct}${RESET}`,
        'memory-usage': `RAM: ${memUsage}`,
        'token-count': `Tokens: ${tokenCount}`,
        'quota-reset-countdown': `Reset in: ${countdownVal}`,
        'git-branch': `Git: ${BOLD}${gitBranch}${RESET}`,
        'project-path': `Project: ${BOLD}${projectName}${RESET}`,
        'project-full-path': `Project Path: ${BOLD}${projectFullPath}${RESET}`
      },
      'jp': {
        'model-name': `モデル: ${getModelColor(fallbackModel)}${BOLD}${fallbackModel}${RESET}`,
        'quota': `API 残高: ${quotaColor}${quotaVal}${RESET}`,
        'context-used': `コンテキスト: ${contextColor}${usedPct}${RESET}`,
        'memory-usage': `メモリ: ${memUsage}`,
        'token-count': `トークン数: ${tokenCount}`,
        'quota-reset-countdown': `リセットまで: ${countdownVal}`,
        'git-branch': `Gitブランチ: ${BOLD}${gitBranch}${RESET}`,
        'project-path': `プロジェクト: ${BOLD}${projectName}${RESET}`,
        'project-full-path': `プロジェクトパス: ${BOLD}${projectFullPath}${RESET}`
      }
    };

    const activeDict = i18n[lang] || i18n['zh-tw'];

    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < footerItems.length; i++) {
      const item = footerItems[i];
      let text = activeDict[item];
      if (!text) continue;
      
      const toAdd = currentLine === '' ? text : ` ${GRAY}│${RESET} ${text}`;
      const toAddPlain = stripAnsi(toAdd);
      const currentPlain = stripAnsi(currentLine);
      
      // 智慧自動換行計算 (以整塊功能為單位換行)
      if (currentLine !== '' && getDisplayWidth(currentPlain) + getDisplayWidth(toAddPlain) > termWidth) {
        lines.push(currentLine);
        currentLine = text;
      } else {
        currentLine += (currentLine === '' ? text : ` ${GRAY}│${RESET} ${text}`);
      }
    }
    if (currentLine !== '') lines.push(currentLine);
    
    console.log(lines.join('\n'));

  } catch (err) {
    try {
      const projectLogDir = join(process.cwd(), '.gemini');
      if (existsSync(projectLogDir)) {
        writeFileSync(join(projectLogDir, 'hook_error.log'), `[${new Date().toISOString()}] ${err.stack || err.message}\\n`, { encoding: 'utf8', flag: 'a' });
      }
    } catch (e) {}
    
    let fallbackModel = 'Gemini 3.5 Flash (High)';
    if (meta?.model?.display_name) fallbackModel = meta.model.display_name;
    else if (meta?.model?.id) fallbackModel = meta.model.id;
    console.log(`? for shortcuts | ${fallbackModel}`);
  }
  process.exit(0);
}
main();
```

### 步驟 7：回報與重新載入提示
完成檔案編輯與自動 Hook 腳本部署後，回報成功訊息。**AI 代理必須嚴格遵守：根據使用者在第一階段所選擇的語系（zh-tw / us / jp）來撰寫最終的回覆訊息**（例如，若使用者選擇日本語 jp，請務必全程使用流利的日文回覆）。請在回覆中告知使用者：「狀態列設定支援熱更新（Hot Reload），設定已自動在 CLI 底部即時生效，無需重新啟動。」

---

## 🔌 Dependencies (依賴環境)

本技能在運作與執行時，依賴以下本機系統環境：
*   **Node.js**: Hook 腳本採用純 Node.js (`.mjs` 模組）實作。執行環境中必須能使用 `node` 指令。
*   **作業系統**: 支援 macOS / Linux / Windows 雙平台與跨平台環境。

---

## 🚀 Quick Start (快速啟用)

要在新裝置或當前工作區中啟用此技能並設定彩色狀態列，AI 代理只需引導使用者執行：
1. 在聊天框中輸入：`/antigravity-status-bar`
2. 在彈出的問卷第一階段選取顯示語系（例如 `zh-tw`）。
3. 在第二階段勾選要啟用的狀態列指標。
4. 代理會全自動註冊與部署 Hook，部署完成後狀態列會即時熱更新見效，無需重開 CLI！
5. 在 CLI 執行期間，使用者可隨時執行 `/statusline` 來即時切換開啟或關閉自訂狀態列。

---

## ⚠️ Common Mistakes (常見錯誤與避坑指南)

當 AI 代理執行此技能時，必須時刻檢視並防範以下 4 個極具破壞性的常見錯誤，以保證極致的健壯性：

### 1. 遺漏全域設定檔中的 `statusLine` Hook 註冊
*   ❌ **錯誤行為**：僅在 `settings.json` 中配置 `ui.footer` 設定，卻忘了在根節點下寫入 `"statusLine"` 物件。這會導致在全新/乾淨的電腦上，CLI 根本不會去載入 Hook，自訂狀態列也完全不會顯現。
*   👉 **修正做法**：必須確保在寫入 `settings.json` 時，同步寫入包含 `"enabled": true`、`"type": "command"` 的 `"statusLine"` 物件，並指向正確的 Hook 腳本路徑。

### 2. 環境變數展開失敗與安全匹配失效（跨電腦移植與執行衝突）
*   ❌ **錯誤行為**：
    *   在 `settings.json` 的 `command` 中僅寫入動態環境變數（例如 `node $HOME/.gemini/...`），但 CLI 在背景以直接呼叫方式執行 Hook 時，**無法透過 Shell 展開環境變數**，導致 Node.js 因找不到路徑而執行失敗。
    *   或者，`settings.json` 中使用了動態環境變數，但 `trusted_hooks.json` 僅信任了絕對路徑，導致安全比對字串不匹配而被系統靜默阻擋。
*   👉 **修正做法（雙保險設計）**：
    *   **寫入 `settings.json` 時**：AI 代理應在執行時動態獲取當前使用者的家目錄絕對路徑，並直接將**絕對路徑**寫入 `command` 中（例如 `node /Users/username/.gemini/...`），這能 100% 確保在本機上執行成功，免去 Shell 展開的依賴。
    *   **寫入 `trusted_hooks.json` 時**：為了同時相容於絕對路徑與未來的動態移植，AI 代理**必須同時追加註冊**絕對路徑指令與環境變數指令（如 `$HOME` 或 `%USERPROFILE%`）的信任規則，以完美通過 CLI 的安全性（Security）檢驗。
    *   **跨電腦移植時**：由於開源分享或複製設定檔到新電腦時絕對路徑會改變，新電腦的 AI 代理在首次執行本技能時，會全自動動態重新解析新電腦的絕對路徑並覆寫更新設定，因此直接寫入絕對路徑是最健壯且無副作用的方案。

### 3. 在 Windows 平台上寫入腳本時遺漏 UTF-8 強制編碼
*   ❌ **錯誤行為**：在 Windows 平台上呼叫 `writeFileSync` 覆寫 Hook 主腳本或快取程式時，沒有指定 `{ encoding: 'utf8' }`。這會使 Windows 預設使用 UTF-16 編碼寫入檔案，導致 agy CLI 啟動時發生解析錯誤並直接崩潰。
*   👉 **修正做法**：每一次進行 `fs.writeFileSync` 或 `fs.writeFile` 寫入時，**必須且強制指定 `{ encoding: 'utf8' }`** 以達成跨平台最高規格防呆。

### 4. 遺漏 CLI 專屬設定檔（`~/.gemini/antigravity-cli/settings.json`）的同步寫入
*   ❌ **錯誤行為**：僅將 `statusLine` 寫入全域設定檔 `~/.gemini/settings.json`，卻忽略了 Antigravity CLI 自身維護的另一份 **CLI 專屬設定檔** `~/.gemini/antigravity-cli/settings.json`。該檔案的優先級**高於**全域設定檔，若其中已存在一個 `statusLine` 物件且 `command` 為空字串（例如 `{ "type": "", "command": "", "enabled": true }`），全域設定檔中正確的 Hook 設定會被完全覆蓋，導致狀態列**無聲無息地徹底失效**，且沒有任何錯誤訊息或日誌輸出，極難排查。
*   👉 **修正做法**：AI 代理在執行步驟 5 時，**必須同時讀取並更新** `~/.gemini/antigravity-cli/settings.json`。若該檔案存在，將正確的 `statusLine` 物件合併寫入；若不存在則跳過。這是本技能中**最致命且最隱蔽的 Bug**，務必嚴格執行。
