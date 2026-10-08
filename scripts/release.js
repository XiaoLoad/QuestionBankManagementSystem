#!/usr/bin/env node
/**
 * 发版脚本：生成 CHANGELOG + 升版本号 + 提交 + 打 tag
 *
 * 用法：
 *   yarn release:patch   # 修 bug 发 1.0.1
 *   yarn release:minor   # 新功能发 1.1.0
 *   yarn release:major   # 破坏性变更发 2.0.0
 *
 * 流程：
 *   1. 校验工作区干净（未提交改动一律拒绝发版）
 *   2. git-cliff 将未发布提交生成到 CHANGELOG.md，段落标记为新版本号
 *   3. 同步根目录与 frontend 的 package.json 版本号
 *   4. 提交 chore(release): vX.Y.Z 并打同名 annotated tag（携带版本总结）
 *   5. 提示推送命令与 GitHub Release 创建命令
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const bumpType = process.argv[2];

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('[release] 用法: node scripts/release.js <patch|minor|major>');
  process.exit(1);
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function gitOutput(cmd) {
  return execSync(cmd, { cwd: ROOT }).toString().trim();
}

// 1. 校验工作区干净
const status = gitOutput('git status --porcelain');
if (status) {
  console.error('[release] 工作区存在未提交改动，拒绝发版。请先提交或暂存（stash）：');
  console.error(status);
  process.exit(1);
}

// 2. 计算下一个版本号
const pkg = require(path.join(ROOT, 'package.json'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const next = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`,
}[bumpType];
const tag = `v${next}`;

// 3. 生成 CHANGELOG（未发布段落标记为新版本）
const fs = require('fs');
const changelogPath = path.join(ROOT, 'CHANGELOG.md');
const changelogFlag = fs.existsSync(changelogPath) ? '--prepend' : '-o';
run(`npx git-cliff --unreleased --tag ${tag} ${changelogFlag} CHANGELOG.md`);

// 4. 同步版本号（根目录 + frontend）
run(`npm version ${next} --no-git-tag-version`);
run(`npm version ${next} --no-git-tag-version`, { cwd: path.join(ROOT, 'frontend') });

// 5. 提交并打 tag（commit body 与 tag message 均携带版本总结，推送后可直接作为 GitHub Release 说明）
const releaseFiles = ['CHANGELOG.md', 'package.json', 'package-lock.json', 'frontend/package.json'];
if (fs.existsSync(path.join(ROOT, 'frontend', 'package-lock.json'))) {
  releaseFiles.push('frontend/package-lock.json');
}
run(`git add ${releaseFiles.join(' ')}`);

// 从 CHANGELOG 提取当前版本段落作为发布总结
const os = require('os');
const changelog = fs.readFileSync(changelogPath, 'utf8').replace(/\r\n/g, '\n');
const start = changelog.indexOf(`## ${tag}`);
let summary = '';
if (start !== -1) {
  summary = changelog
    .slice(start)
    .split('\n## v')[0]
    .split('\n')
    .slice(1) // 跳过 "## vX.Y.Z（日期）" 标题行
    .join('\n')
    .trim();
}

// tag message：推送后用 gh release create <tag> --notes-from-tag 创建 Release
const notesPath = path.join(os.tmpdir(), `release-notes-${tag}.md`);
fs.writeFileSync(notesPath, summary ? `release ${tag}\n\n${summary}\n` : `release ${tag}\n`);

// commit message：subject + 版本总结 body
const commitMsgPath = path.join(os.tmpdir(), `release-commit-msg-${tag}.txt`);
fs.writeFileSync(commitMsgPath, summary ? `chore(release): ${tag}\n\n${summary}\n` : `chore(release): ${tag}\n`);
run(`git commit --cleanup=verbatim -F "${commitMsgPath}"`);

run(`git tag -a ${tag} --cleanup=verbatim -F "${notesPath}"`);
fs.unlinkSync(notesPath);
fs.unlinkSync(commitMsgPath);

console.log('');
console.log(`[release] 发版完成: ${pkg.version} -> ${next}`);
console.log('[release] 推送远端: git push && git push --tags');
console.log(`[release] 推送后创建 GitHub Release（以 tag 总结为说明）: gh release create ${tag} --notes-from-tag --title ${tag}`);
