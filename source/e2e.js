// 実ブラウザ(Chrome headless / CDP)での検算。実行: node source/e2e.js
const path = require('path'), fs = require('fs');
const { launch } = require('./cdp');
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
let n = 0, f = 0;
const ok = (c, m) => { n++; if (!c) { f++; console.log('NG', m); } };
(async () => {
  const b = await launch(9378);
  const setSrc = t => b.ev(`(()=>{const e=document.getElementById('src');e.value=${JSON.stringify(t)};e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  const wait = () => b.sleep(320);
  const val = id => b.ev(`document.getElementById('${id}').value`);
  const txt = id => b.ev(`document.getElementById('${id}').textContent`);
  const click = id => b.ev(`document.getElementById('${id}').click()`);
  const pickRadio = (name, v) => b.ev(`(()=>{const r=document.querySelector('input[name="${name}"][value="${v}"]');r.click();return r.checked})()`);
  await b.open(PAGE, 375, 800, 2, true);
  await b.ev(`window.__errs=0;window.addEventListener('error',()=>window.__errs++);window.confirm=()=>{window.__confirm=(window.__confirm||0)+1;return window.__confirmAns!==false};true`);
  // E1 初期状態
  ok(await val('out') === '' && await b.ev(`document.getElementById('punctBtn').disabled && document.getElementById('copyBtn').disabled`), 'E1 初期は空・ボタン無効');
  // E2 サンプル → ボタンは「句読点を外す」
  await click('sampleBtn'); await wait();
  ok(await txt('punctBtn') === '句読点を外す', 'E2 句読点ありの文章 → 外す');
  let o = await val('out'); ok(o.includes('みなと堂では、この秋から') && o.includes('。'), 'E2 句読点が出ている');
  // E3 外す → 付ける → 外す
  await click('punctBtn'); await wait();
  ok(await txt('punctBtn') === '句読点を付ける', 'E3 外した後 → 付ける');
  o = await val('out'); ok(!/[。、]/.test(o.replace(/「[^」]*」/g, '')), 'E3 句読点が消える');
  ok(/句読点を外しました（。\d+か所、、\d+か所）/.test(await txt('msg')), 'E3 メッセージ ' + await txt('msg'));
  const off1 = o;
  await click('punctBtn'); await wait();
  ok((await txt('msg')).includes('元に戻しました'), 'E3 戻すメッセージ');
  await click('punctBtn'); await wait(); ok(await val('out') === off1, 'E3 外す→付ける→外す で同じ結果');
  // E4 プリセット
  await pickRadio('preset', 'substack'); await wait(); o = await val('out');
  ok(/\n\n/.test(o) && !(await b.ev(`document.querySelector('input[name="strength"]:checked').value`) !== '1'), 'E4 Substackは空行入り・標準');
  await pickRadio('preset', 'linkedin'); await wait();
  ok(await b.ev(`document.querySelector('input[name="strength"]:checked').value`) === '0', 'E4 LinkedInは分け方「なし」が初期値');
  // E5 句読点なしの文章 → 付ける
  await setSrc('今日は晴れです\n明日は雨です'); await wait();
  ok(await txt('punctBtn') === '句読点を付ける', 'E5 句読点なしの文章 → 付ける');
  await click('punctBtn'); await wait(); ok((await val('out')).includes('今日は晴れです。\n') && (await txt('msg')).includes('「、」は付けていません'), 'E5 行末に。 ' + await txt('msg'));
  // E5b レビュー指摘: 状態行の表示と、貼り替えでの状態の初期化
  ok((await txt('punctState')).includes('行末に「。」を付けた状態'), 'E5b 付けた直後の状態行 ' + await txt('punctState'));
  await setSrc('今日は晴れ。\n明日は雨。'); await wait();   // 全部入れ替え: 句読点あり → on=true のまま行末が増えない・ボタンは外す
  ok(await txt('punctBtn') === '句読点を外す', 'E5b 貼り替え(句読点なし→あり)でボタンが初期に戻る');
  await setSrc('今日は晴れです\n明日は雨です'); await wait();
  ok(!(await val('out')).includes('。') && await txt('punctBtn') === '句読点を付ける', 'E5b 貼り替え(あり→なし)で勝手に「。」が付かない');
  await setSrc('とてもよい天気です。みなさまお元気ですか。'); await wait(); await click('punctBtn'); await wait();   // 外した状態
  await setSrc('まったく別の文章です、ここにあります。続きもあります。'); await wait();
  ok((await val('out')).includes('。') && await txt('punctBtn') === '句読点を外す' && (await txt('msg')) === '', 'E5b 外した状態で貼り替えると初期に戻り、前のメッセージが消える');
  await setSrc('まったく別の文章です、ここにあります。続きもあります！'); await wait();   // 末尾だけ直す: 状態は維持
  await click('punctBtn'); await wait(); await setSrc('まったく別の文章です、ここにあります。続きもあります！！'); await wait();
  ok(await txt('punctBtn') === '句読点を付ける', 'E5b 少し直しただけなら外した状態を保つ');
  await setSrc('今日は晴れです\n明日は雨です'); await wait(); await click('punctBtn'); await wait();
  // E6 編集 → 上書き確認
  await b.ev(`(()=>{const e=document.getElementById('out');e.value='編集した';e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  ok((await txt('msg')).includes('編集しました'), 'E6 編集の通知');
  await b.ev(`window.__confirmAns=false`); await click('punctBtn'); await wait();
  ok(await val('out') === '編集した' && (await b.ev('window.__confirm')) === 1, 'E6 キャンセルすると編集が残る');
  await b.ev(`window.__confirmAns=true`); await click('punctBtn'); await wait();
  ok((await val('out')) !== '編集した', 'E6 OKで上書き');
  // E7 XSS
  await setSrc('<img src=x onerror="window.__x=1"><script>window.__x=2<\/script>です。'); await wait();
  ok(await b.ev(`window.__x===undefined && document.querySelectorAll('img, main script').length===0`), 'E7 HTMLとして解釈されない');
  ok((await val('out')).includes('<img src=x'), 'E7 そのまま文字として出る');
  // E8 20000字
  await setSrc('あ。'.repeat(10000)); await wait();
  ok((await val('out')).length > 0 && (await txt('srcMsg')) === '', 'E8 20000字は整形される');
  await setSrc('あ。'.repeat(10000) + 'あ'); await wait();
  ok((await val('out')) === '' && /20000字を超えています/.test(await txt('srcMsg')) && await b.ev(`document.getElementById('punctBtn').disabled`), 'E8 20001字は止める');
  const t0 = Date.now(); await setSrc('これは文章です、長めに書きます。'.repeat(1000)); await b.ev('document.getElementById("out").value.length'); await wait();
  console.log('  20000字級の反映', Date.now() - t0, 'ms(待ち時間320msを含む)');
  // E9 空にする
  await click('clearBtn'); await wait(); ok(await val('out') === '' && await val('src') === '', 'E9 空にする');
  // E10 375px: 横スクロールなし(長文・長いURL・全文URL)
  for (const t of [await b.ev('LB.SAMPLE'), 'https://example.com/' + 'a'.repeat(200), 'あ'.repeat(300), '😀'.repeat(200), '\n\n\n']) {
    await setSrc(t); await wait();
    const m = await b.ev(`({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})`);
    ok(m.sw <= m.cw, 'E10 横スクロールなし ' + JSON.stringify(m) + ' ' + t.slice(0, 12));
  }
  // E11 タップ領域44px以上
  await setSrc(await b.ev('LB.SAMPLE')); await wait();
  const small = await b.ev(`Array.from(document.querySelectorAll('button, .seg label, summary')).map(e=>{const r=e.getBoundingClientRect();return [e.textContent.trim().slice(0,12),Math.round(r.height)]}).filter(x=>x[1]<44)`);
  ok(small.length === 0, 'E11 44px未満: ' + JSON.stringify(small));
  const fs16 = await b.ev(`Array.from(document.querySelectorAll('main *:not(.mw-footer):not(.mw-footer *)')).filter(e=>e.childNodes.length&&Array.from(e.childNodes).some(c=>c.nodeType===3&&c.textContent.trim())).map(e=>[e.tagName,parseFloat(getComputedStyle(e).fontSize)]).filter(x=>x[1]<16)`);
  ok(fs16.length === 0, 'E11 16px未満の文字: ' + JSON.stringify(fs16));
  // E12 コピー: clipboard 成功・失敗(フォールバック)
  await b.ev(`navigator.clipboard.writeText=function(t){window.__copied=t;return Promise.resolve()};true`);
  await click('copyBtn'); await wait(); ok((await txt('copyMsg')) === 'コピーしました' && (await b.ev('window.__copied')) === await val('out'), 'E12 コピー成功');
  await b.ev(`navigator.clipboard.writeText=function(t){return Promise.reject(new Error('x'))};document.execCommand=function(){return false};true`);
  await click('copyBtn'); await wait(); ok(/長押しして/.test(await txt('copyMsg')) && await b.ev(`document.getElementById('out').selectionEnd>0`), 'E12 失敗時は選択して長押しを案内');
  await b.ev(`Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});document.execCommand=function(){return true};true`);
  await click('copyBtn'); await wait(); ok((await txt('copyMsg')) === 'コピーしました', 'E12 clipboardが無い環境ではexecCommandへ');
  // E13 ダーク
  await b.open(PAGE, 375, 800, 2, true, 'dark'); await click('sampleBtn'); await wait();
  const dk = await b.ev(`(()=>{const cs=getComputedStyle(document.getElementById('punctBtn'));return [cs.color,cs.backgroundColor]})()`);
  console.log('  ダークのボタン', dk);
  ok(!(await b.ev('window.__errs')), 'E13 JSエラーなし');
  // コントラスト
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const cr = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const pairs = [['ライト accent/白', '#2A6F51', '#ffffff'], ['ダーク accent-ink/accent', '#0c2a1d', '#8FD3B0'], ['ライト ink3/bg', '#56605a', '#f4f6f4'], ['ダーク ink3/surface', '#a0aca4', '#1b211e'], ['ライト ink2/surface', '#3e4741', '#ffffff']];
  pairs.forEach(([nm, a, c]) => { const r = cr(a, c); console.log('  コントラスト', nm, r.toFixed(2)); ok(r >= 4.5, 'E13 コントラスト4.5以上 ' + nm + ' ' + r.toFixed(2)); });
  // E14 保存系を使っていない(S11)
  ok(!/localStorage|sessionStorage|indexedDB|\.download\s*=|<a [^>]*download|createObjectURL|navigator\.share/.test(HTML), 'S11 保存・ダウンロード系を使っていない');
  ok((HTML.match(/clipboard/g) || []).length > 0 && !/clipboard\.write\(/.test(HTML), 'S11 clipboardはwriteTextのみ');
  ok(!/href="#"|bit\.ly|forms\.gle|lin\.ee/.test(HTML), '素性: href="#"・短縮URLなし');
  ok(/mw-footer/.test(HTML) && /みちAIワークス/.test(HTML), '素性: mw-footerと屋号');
  const banned = ['完璧', '自動で最適化', '伸びる', 'バズる', 'エンゲージメントが上がる', '読みやすさが保証'];
  ok(!banned.some(w => HTML.includes(w)), '禁止語なし');
  // S12 iOS UA: 分岐に頼らず、操作中に同期でwriteTextを呼ぶ作りか(コード上の確認)
  ok(/click['"],\s*function \(\)\s*\{\s*var text = out\.value;\s*if \(navigator\.clipboard/.test(HTML), 'S12 クリックのハンドラ内で同期的にwriteTextを呼ぶ');
  console.log(n + ' 件中 ' + (n - f) + ' 件通過' + (f ? '／NG ' + f : ''));
  b.close(); setTimeout(() => process.exit(f ? 1 : 0), 300);
})().catch(e => { console.error(e); process.exit(2); });
