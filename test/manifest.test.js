const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
const repoRoot = path.join(__dirname, '..');

test('manifest keeps BYO hosts optional and injects both worlds at document_start in all frames', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, '120');
  assert.deepEqual(manifest.host_permissions, ['https://*.zhipin.com/*', 'https://zhipin.com/*']);
  assert.ok(!manifest.host_permissions.includes('https://*/*'));
  assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);
  assert.ok(!manifest.permissions.includes('tabGroups'), 'unused tabGroups permission should not be requested');

  const scripts = manifest.content_scripts;
  const main = scripts.find((script) => script.js.includes('src/content/main-world.js'));
  const isolated = scripts.find((script) => script.js.includes('src/content/content.js'));
  assert.ok(main);
  assert.ok(isolated);
  assert.equal(main.run_at, 'document_start');
  assert.equal(isolated.run_at, 'document_start');
  assert.equal(main.world, 'MAIN');
  assert.equal(isolated.world, 'ISOLATED');
  assert.equal(main.all_frames, true);
  assert.equal(isolated.all_frames, true);
});

test('manifest, UI pages and package scripts reference existing local files', () => {
  const manifestPaths = [
    manifest.background.service_worker,
    manifest.side_panel.default_path,
    manifest.options_page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap((script) => script.js)
  ];

  for (const localPath of manifestPaths) {
    assert.ok(fs.existsSync(path.join(repoRoot, localPath)), `${localPath} should exist`);
  }

  for (const htmlPath of [manifest.side_panel.default_path, manifest.options_page]) {
    const absoluteHtmlPath = path.join(repoRoot, htmlPath);
    const html = fs.readFileSync(absoluteHtmlPath, 'utf8');
    const refs = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g))
      .map((match) => match[1])
      .filter((ref) => !/^(https?:|data:|#)/.test(ref));
    for (const ref of refs) {
      assert.ok(fs.existsSync(path.resolve(path.dirname(absoluteHtmlPath), ref)), `${htmlPath} references missing ${ref}`);
    }
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const scriptRefs = Object.values(pkg.scripts)
    .flatMap((script) => Array.from(script.matchAll(/\b(?:node|tsx)\s+([^\s]+\.m?js)\b/g)).map((match) => match[1]));
  for (const ref of scriptRefs) {
    assert.ok(fs.existsSync(path.join(repoRoot, ref)), `package script references missing ${ref}`);
  }
});

test('BYO-only UI presents custom AI as the only rating path', () => {
  const monitorHtml = fs.readFileSync(path.join(repoRoot, manifest.side_panel.default_path), 'utf8');
  const optionsHtml = fs.readFileSync(path.join(repoRoot, manifest.options_page), 'utf8');

  assert.ok(monitorHtml.includes('自定义 AI'));
  assert.ok(optionsHtml.includes('自定义 AI'));
  assert.ok(!monitorHtml.includes('关闭时使用'));
  assert.ok(!optionsHtml.includes('关闭时使用'));
});

test('monitor theme control is a text-only titlebar action without side panel label', () => {
  const monitorHtml = fs.readFileSync(path.join(repoRoot, manifest.side_panel.default_path), 'utf8');
  const titlebarStart = monitorHtml.indexOf('<header class="sidepanel-titlebar">');
  const titlebarEnd = monitorHtml.indexOf('</header>', titlebarStart);
  const accountStart = monitorHtml.indexOf('<div class="card top-card"');
  const titlebarHtml = monitorHtml.slice(titlebarStart, titlebarEnd);

  assert.ok(titlebarStart >= 0, 'monitor titlebar should exist');
  assert.ok(titlebarEnd > titlebarStart, 'monitor titlebar should close');
  assert.ok(titlebarHtml.includes('id="theme-toggle"'), 'theme toggle should be inside titlebar');
  assert.ok(!titlebarHtml.includes('theme-icon'), 'theme toggle should be text only');
  assert.ok(!titlebarHtml.includes('Side panel'), 'titlebar should not show Side panel');
  assert.ok(monitorHtml.indexOf('id="theme-toggle"') < accountStart, 'theme toggle should not live inside the account card');
});

test('monitor and options UI avoid unexplained BHP and BYO abbreviations', () => {
  const monitorHtml = fs.readFileSync(path.join(repoRoot, manifest.side_panel.default_path), 'utf8');
  const optionsHtml = fs.readFileSync(path.join(repoRoot, manifest.options_page), 'utf8');

  assert.ok(monitorHtml.includes('class="brand-logo"'), 'account header should use the logo image');
  assert.ok(!monitorHtml.includes('>BHP<'), 'monitor should not show BHP as text');
  assert.ok(!monitorHtml.includes('BHP 招聘助手'), 'monitor title should not use BHP abbreviation');
  assert.ok(!monitorHtml.includes('BYO'), 'monitor should use 自定义 AI instead of BYO');
  assert.ok(!optionsHtml.includes('BHP ·'), 'options subtitle should not use BHP abbreviation');
  assert.ok(!optionsHtml.includes('BYO'), 'options should use 自定义 AI instead of BYO');
});

test('monitor settings dialogs are centered and remain scroll-safe', () => {
  const monitorCss = fs.readFileSync(path.join(repoRoot, 'src/ui/monitor/bhp-monitor.css'), 'utf8');
  const backdrop = monitorCss.match(/\.settings-dialog-backdrop\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  const dialog = monitorCss.match(/\.settings-dialog\s*\{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(backdrop, /align-items:\s*center/);
  assert.match(backdrop, /justify-content:\s*center/);
  assert.match(backdrop, /padding:\s*18px/);
  assert.doesNotMatch(dialog, /position:\s*fixed/);
  assert.doesNotMatch(dialog, /top:\s*58px/);
  assert.doesNotMatch(dialog, /transform:\s*translateX\(-50%\)/);
  assert.match(dialog, /max-height:\s*calc\(100vh - 36px\)/);
  assert.match(dialog, /overflow-y:\s*auto/);
});

test('monitor settings save toast is not nested in the bottom save bar', () => {
  const monitorHtml = fs.readFileSync(path.join(repoRoot, manifest.side_panel.default_path), 'utf8');
  const saveBarStart = monitorHtml.indexOf('<div class="settings-save-bar">');
  const settingsOverlayEnd = monitorHtml.indexOf('<!-- 状态', saveBarStart);
  const saveBarEnd = monitorHtml.indexOf('</div>', saveBarStart) + '</div>'.length;
  const saveBarHtml = monitorHtml.slice(saveBarStart, saveBarEnd);

  assert.ok(saveBarStart >= 0, 'settings save bar should exist');
  assert.ok(settingsOverlayEnd > saveBarStart, 'settings overlay should close before status section');
  assert.ok(saveBarEnd > saveBarStart, 'settings save bar should close');
  assert.ok(
    monitorHtml.includes('</div>\n\n  <div class="settings-toast" id="settings-toast"></div>\n\n  <!-- 状态'),
    'settings toast should live outside transformed settings overlay'
  );
  assert.ok(!saveBarHtml.includes('id="settings-toast"'), 'settings toast should not be inside sticky bottom save bar');
});

test('monitor does not present online resume counter as a hard 200/day cap', () => {
  const monitorHtml = fs.readFileSync(path.join(repoRoot, manifest.side_panel.default_path), 'utf8');

  assert.ok(!monitorHtml.includes('/200'), 'online resume counter should not render as capped quota');
  assert.ok(!monitorHtml.includes('到达 200/天后'), 'settings should not describe a hard 200/day stop');
});

test('manifest does not ship request-blocking network rules', () => {
  assert.ok(!manifest.permissions.includes('declarativeNetRequest'));
  assert.equal(manifest.declarative_net_request, undefined);
});

test('monitor settings toast uses content width instead of full side-panel width', () => {
  const monitorCss = fs.readFileSync(path.join(repoRoot, 'src/ui/monitor/bhp-monitor.css'), 'utf8');
  const toast = monitorCss.match(/\.settings-toast\s*\{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(toast, /width:\s*auto/);
  assert.match(toast, /max-width:\s*min\(360px,\s*calc\(100vw - 48px\)\)/);
  assert.doesNotMatch(toast, /width:\s*min\(420px,\s*calc\(100vw - 28px\)\)/);
});
