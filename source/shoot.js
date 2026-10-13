// 投稿カード用の実画面を撮る。実行: node source/shoot.js <出力フォルダ> [YYYY-MM-DD]
const fs = require('fs'), path = require('path');
const { launch } = require('./cdp');
const OUT = path.resolve(process.argv[2]); const DATE = process.argv[3] || '2026-10-14';
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await launch(9379);
  const rect = sel => b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});const r=e.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,left:r.left,right:r.right}})()`);
  const click = id => b.ev(`document.getElementById('${id}').click()`);
  const radio = (n, v) => b.ev(`document.querySelector('input[name="${n}"][value="${v}"]').click()`);
  // Card1: デスクトップ・Substack・句読点を外した状態
  await b.open(PAGE, 1000, 1300, 2, false);
  await click('sampleBtn'); await b.sleep(400); await radio('preset', 'substack'); await b.sleep(200); await click('punctBtn'); await b.sleep(300);
  await b.ev(`document.getElementById('src').style.height='600px';document.getElementById('out').style.height='600px';true`);
  const lay = await rect('.layout'), a = await rect('.a-in'), o = await rect('.a-out');
  await b.shot(path.join(OUT, '01-desktop-substack-off-' + DATE + '.png'), { x: 0, y: lay.top - 12, width: 1000, height: Math.max(a.bottom, o.bottom) - lay.top + 24 });
  await b.shot(path.join(OUT, 'source-desktop-full.png'), { x: 0, y: 0, width: 1000, height: await b.ev('document.documentElement.scrollHeight') });
  // Card2: 375px・Xプリセット・外す→付ける(元に戻した状態)
  await b.open(PAGE, 375, 900, 2, true);
  await click('sampleBtn'); await b.sleep(400); await click('punctBtn'); await b.sleep(200); await click('punctBtn'); await b.sleep(300);
  await b.ev(`document.getElementById('out').style.height='330px';true`);
  const top = await rect('.a-out'), cm = await rect('#counts');
  await b.shot(path.join(OUT, '02-mobile375-restored-' + DATE + '.png'), { x: 0, y: top.top - 8, width: 375, height: cm.bottom - top.top + 16 });
  await b.shot(path.join(OUT, 'source-mobile375-full.png'), { x: 0, y: 0, width: 375, height: await b.ev('document.documentElement.scrollHeight') });
  b.close(); setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error(e); process.exit(2); });
