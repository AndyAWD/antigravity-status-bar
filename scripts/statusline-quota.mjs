import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { spawn, execSync } from 'child_process';
import { join, basename } from 'path';
import os from 'os';

function getGitBranch(lang) {
  try {
    const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true };
    let branch = '';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', opts).trim();
    } catch (err) {
      if (process.platform === 'win32') {
        const gitPath = 'C:\\Program Files\\Git\\cmd\\git.exe';
        if (existsSync(gitPath)) {
          branch = execSync(`"${gitPath}" rev-parse --abbrev-ref HEAD`, opts).trim();
        }
      }
    }
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
      const output = execSync(`wmic process where "name='agy.exe'" get WorkingSetSize`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      const matches = output.match(/\d+/g);
      if (matches) {
        const totalBytes = matches.reduce((sum, val) => sum + parseInt(val, 10), 0);
        return Math.round(totalBytes / 1024 / 1024);
      }
    } else {
      const output = execSync(`ps -o rss= -p ${process.ppid}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
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
            detached: true,
            windowsHide: true
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
    
    if (contextSize > 0 && totalInput > 0 && !usedPctNum) {
      usedPctNum = (totalInput / contextSize) * 100;
    }
    
    const remainCtx = Math.max(0, 100 - usedPctNum);
    const contextColor = getColorByPercentage(remainCtx);
    const usedPct = `${usedPctNum.toFixed(1)}%`;
    
    const rssMem = getCliMemoryMB();
    const memUsage = `${rssMem}MB`;
    const totalTokens = totalInput;
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