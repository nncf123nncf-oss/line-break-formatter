// 整形の部分(index.html の <script id="core">)の検算。実行: node source/run-checks.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.X=LB;', ctx); const X = ctx.X;
let n = 0, f = 0; const J = v => JSON.stringify(v);
const eq = (a, b, m) => { n++; if (J(a) !== J(b)) { f++; console.log('NG', m, '\n  実際:', J(a), '\n  期待:', J(b)); } };
const tr = (c, m) => eq(!!c, true, m);
const R = (t, preset, strength, on) => {
  const m = X.build(t); preset = preset || 'x';
  return X.render(m, { preset, strength: strength === undefined ? X.DEFAULT_STRENGTH[preset] : strength, on: on === undefined ? m.hadPunct : on }).text;
};

// S1
eq(R(''), '', 'S1 空'); eq(R('   \n 　 \n'), '', 'S1 空白だけ');
// 基本: 1文1行
eq(R('今日は晴れです。明日は雨です。', 'x', 0), '今日は晴れです。\n明日は雨です。', '基本X');
eq(R('今日は晴れです。明日は雨です。', 'substack', 0), '今日は晴れです。\n\n明日は雨です。', '基本Substack');
eq(R('A。\n\nB。\nC。', 'x', 0), 'A。\n\nB。\nC。', '元の空行は段落として残る(X)');
eq(R('すごい！本当ですか？はい。', 'x', 0), 'すごい！\n本当ですか？\nはい。', '！？は文末');
// 外す
eq(R('今日は晴れです。明日は雨です。', 'x', 0, false), '今日は晴れです\n明日は雨です', '外す: 。が消える');
eq(R('すごい！本当ですか？はい。', 'x', 0, false), 'すごい！\n本当ですか？\nはい', '外す: ！？は残る');
// S3 切ってはいけない
eq(R('価格は3.5倍です。次です。', 'x', 0), '価格は3.5倍です。\n次です。', 'S3 小数点');
eq(R('彼は「今日は晴れです。明日も晴れ。」と言った。次です。', 'x', 0), '彼は「今日は晴れです。明日も晴れ。」と言った。\n次です。', 'S3 括弧内');
eq(R('えっと……そうですね。。。はい。', 'x', 0), 'えっと……そうですね。。。はい。', 'S3 …と。。。');
eq(R('詳しくは https://minato-do.example/a_b?c=d.e#f をどうぞ。次です。', 'x', 0), '詳しくは https://minato-do.example/a_b?c=d.e#f をどうぞ。\n次です。', 'S3 URL');
eq(R('詳細→https://minato-do.example/tenugui。次です。', 'x', 0), '詳細→https://minato-do.example/tenugui。\n次です。', 'S3 URL直後の。は文末');
eq(R('#セール #秋 #みなと堂', 'substack', 0), '#セール #秋 #みなと堂', 'S3 ハッシュタグ行');
eq(R('今日の予定です。\n・朝、掃除。昼、買い物。\n・夜、料理。\n以上です。', 'substack', 0), '今日の予定です。\n\n・朝、掃除。昼、買い物。\n・夜、料理。\n\n以上です。', 'S3 箇条書きは1行1項目・箇条書き同士は空行なし');
eq(R('・朝、掃除。昼、買い物。\n・夜、料理。', 'x', 0, false), '・朝 掃除 昼 買い物\n・夜 料理', '箇条書きを外す');
// S7 括弧
eq(R('「今日は晴れ。明日も晴れ。', 'x', 0), '「今日は晴れ。\n明日も晴れ。', 'S7 閉じ忘れは通常ルール');
eq(R('「「A。」B。」C。', 'x', 0), '「「A。」B。」C。', 'S7 入れ子');
// 外す→付ける 往復
const samples = [X.SAMPLE, '今日は、晴れです。明日は、雨かもしれませんが、傘は不要です。\n\n「いいね。」と言った。（注: 例です。）ありがとう！', '・A、B。\n・C。\nD、E。F。\n#タグ #tag https://example.com/x。'];
for (const t of samples) for (const p of ['x', 'substack', 'linkedin']) for (const st of [0, 1, 2]) {
  const m = X.build(t); const o = { preset: p, strength: st };
  const a = X.render(m, Object.assign({ on: true }, o)).text, b = X.render(m, Object.assign({ on: false }, o)).text;
  let ok = true;
  for (let k = 0; k < 10; k++) { const nx = X.render(m, Object.assign({ on: k % 2 === 1 }, o)).text; if (nx !== (k % 2 === 0 ? b : a)) ok = false; }
  tr(ok, 'S2 10往復一致 ' + p + st);
  const stripped = b.replace(/「[^」]*」/g, '').replace(/（[^）]*）/g, '').replace(/https?:\/\/\S+/g, '');
  tr(!/[。、]/.test(stripped), 'S5 外した結果に。、が残らない(括弧内・URL除く) ' + p + st + ' → ' + J(b.slice(0, 60)));
}
// ONは元の文字列を保つ(分割なし・Xで空行を保つ)
for (const t of ['今日は、晴れです。', 'あ。\n\nい、う。']) eq(R(t, 'x', 0, true), t, 'ONは元の文字列を保つ ' + t);
// S5 「、」
eq(R('今日は、晴れです。', 'x', 0, false), '今日は 晴れです', '外す: 直前が短い→スペース');
eq(R('とても長いお知らせのために、みなさまにお知らせします。', 'x', 0, false), 'とても長いお知らせのために\nみなさまにお知らせします', '外す: 、→改行');
eq(R('毎朝のお掃除はとても大切で、を除いて何もしません。', 'x', 0, false), '毎朝のお掃除はとても大切で を除いて何もしません', '外す: 直後が助詞→スペース');
eq(R('これは英語 Hello, world です。', 'x', 0, false), 'これは英語 Hello, world です', '英語の,は触らない');
eq(R('日本語,日本語です。', 'x', 0, false), '日本語 日本語です', '日本語直後の半角,は読点扱い');
eq(R('価格は1,000円です。', 'x', 0, false), '価格は1,000円です', '数字の,は触らない');
// 付ける(最初から句読点なし)
eq(R('今日は晴れです\n明日は雨です', 'x', 0, true), '今日は晴れです。\n明日は雨です。', '付ける: 行末に。');
eq(R('すごい！\nええ？\n「はい」\n#タグ\nhttps://a.example/x\n・項目\nHello world\n123', 'x', 0, true), 'すごい！\nええ？\n「はい」\n#タグ\nhttps://a.example/x\n・項目\nHello world\n123', '付けない行');
eq(R('今日は晴れ、明日は雨です', 'x', 0, true), '今日は晴れ、明日は雨です', '句読点が1つでもある文章は、付ける側で何も足さない(元の位置に戻すだけ)');
eq(R('今日は晴れです 🙂\n今日はお得 #セール', 'x', 0, true), '今日は晴れです 🙂\n今日はお得 #セール', '絵文字・ハッシュタグ末尾は付けない');
{ const m = X.build('今日は晴れです\n明日は雨です'); const r = X.render(m, { preset: 'x', strength: 0, on: true }); eq(r.added, 2, '付けた数'); eq(m.hadPunct, false, 'hadPunct false'); }
// S6 長い文の分割
const L1 = 'あいうえおかきくけこさしすせそ、たちつてとなにぬねのはひふへほ、まみむめもやゆよらりるれろわをん。';
eq(R(L1, 'x', 1), 'あいうえおかきくけこさしすせそ、\nたちつてとなにぬねのはひふへほ、\nまみむめもやゆよらりるれろわをん。', '40字超は読点で分ける');
eq(R(L1, 'x', 0), L1, 'なしは分けない');
{ const T = 'あいうえお、かきくけこ、さしすせそ、たちつてと。'; eq(R(T, 'x', 1), T, '短い文は分けない(' + X.cpLen(T) + '字)'); eq(R(T, 'x', 0), T, 'なし'); }
{ const T = 'あいうえお、かきくけこ、さしすせそ、たちつてと、なにぬねのは、ひふへほまみ。'; eq(R(T, 'x', 2).split('\n').length > 1, true, '細かく(25字超)で分ける ' + X.cpLen(T)); }
eq(R('あいうえおかきくけこさしすせそたちつてとなにぬねの、はひ。', 'x', 2).split('\n').length, 1, '分けた行が5字未満になる場合は見送り');
eq(R('今日はとても天気がよかったけどあまり暑くなかったのでたくさん歩きました。', 'x', 2), '今日はとても天気がよかったけど\nあまり暑くなかったので\nたくさん歩きました。', '接続の言葉で分ける(細かく)');
// S8 プリセット
const Lk = 'これは十分に長い一文目です。これも十分に長い二文目です。三つ目の文もそれなりに長いです。四つ目の文もまた長いですよ。';
eq(R(Lk, 'linkedin', 0), 'これは十分に長い一文目です。\nこれも十分に長い二文目です。\n\n三つ目の文もそれなりに長いです。\n四つ目の文もまた長いですよ。', 'LinkedIn 2文ごとに空行');
eq(R('はい。いいえ。これは十分に長い一文目です。次の長い文です。', 'linkedin', 0), 'はい。\nいいえ。\nこれは十分に長い一文目です。\n次の長い文です。', 'LinkedIn 短い文は数えない');
{ const m = X.build(Lk); const a = X.render(m, { preset: 'x', strength: 0, on: true }).text; X.render(m, { preset: 'substack', strength: 1, on: false }); eq(X.render(m, { preset: 'x', strength: 0, on: true }).text, a, 'プリセット切替で元は変わらない'); }
// S9 英文
eq(R('This is a post. It has two lines.', 'x', 0), 'This is a post.\nIt has two lines.', 'S9 英文');
eq(R('日本語の中のiPhoneやAIの話です。次です。', 'x', 0), '日本語の中のiPhoneやAIの話です。\n次です。', 'S9 日英混在');
// 改行の正規化
eq(R('A。\r\nB。\r\n\r\n\r\nC。', 'x', 0), 'A。\nB。\n\nC。', 'CRLFと連続空行');
// 文字数カウント
eq(X.stats('あa\nb').units, 5, '全角2+半角1+改行1+半角1'); eq(X.stats('あa\nb').lines, 2, '行数');
// S4 長文
function mk(nPara, nSent) { const t = []; for (let p = 0; p < nPara; p++) { const ss = []; for (let s = 0; s < nSent; s++) ss.push('これは' + p + '番目の段落の' + s + '番目の文で、少し長めに書いてあります。'); t.push(ss.join('')); } return t.join('\n\n'); }
for (const [np, ns] of [[10, 6], [15, 7], [30, 20]]) {
  const t = mk(np, ns); const t0 = Date.now(); const m = X.build(t); const r = X.render(m, { preset: 'substack', strength: 1, on: false }); const ms = Date.now() - t0;
  tr(ms < 500, 'S4 ' + X.cpLen(t) + '字 ' + ms + 'ms'); tr(r.text.split('\n\n').length >= np * ns, 'S4 文の数');
}
{
  const t = 'あ。'.repeat(10000); eq(X.build(t).tooLong, false, 'S4 ちょうど20000字は通る');
  const m2 = X.build(t); const t0 = Date.now(); X.render(m2, { preset: 'substack', strength: 1, on: false }); tr(Date.now() - t0 < 500, 'S4 20000字の整形 ' + (Date.now() - t0) + 'ms');
  eq(X.build(t + 'あ').tooLong, true, 'S4 20001字は止める'); eq(X.render(X.build(t + 'あ'), { preset: 'x', strength: 1, on: true }).text, '', 'S4 超過時は空');
}
// サンプル(Card用)の出力
console.log('--- Substack/外す ---\n' + R(X.SAMPLE, 'substack', 1, false) + '\n--- X/ON ---\n' + R(X.SAMPLE, 'x', 1, true));
console.log('\n' + n + ' 件中 ' + (n - f) + ' 件通過' + (f ? '／NG ' + f : '')); process.exit(f ? 1 : 0);
