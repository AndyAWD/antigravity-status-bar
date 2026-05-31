import fs from 'fs';
import path from 'path';

console.log('開始打包 Antigravity CLI Statusline...');

const distDir = path.join(process.cwd(), 'dist');
const targetDir = path.join(distDir, 'antigravity-cli-statusline');

// 清理與建立資料夾
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// 複製核心檔案
fs.copyFileSync(
  path.join(process.cwd(), 'SKILL.md'),
  path.join(targetDir, 'SKILL.md')
);

fs.cpSync(
  path.join(process.cwd(), 'scripts'),
  path.join(targetDir, 'scripts'),
  { recursive: true }
);

console.log(`打包完成！乾淨的擴充包已產生於: ${targetDir}`);
console.log('若需發佈為壓縮檔供使用者下載，建議透過 GitHub Actions 自動處理，或直接壓縮該資料夾。');
