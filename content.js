/* 批量核验助手 v1.7
 * 规则：出弹窗=已录入（收集该号，自动点"确定"关弹窗）；无弹窗=忽略。
 * 导出只有一张表：已录入名单。进度按号码记忆，可断点续跑，可手动重新核验。
 */
(function () {
  if (window.__bzLoaded) return;
  window.__bzLoaded = true;

  var CFG = {
    ID_LABEL: '身份证件号码',
    TYPE_LABEL: '身份证件种类',
    TYPE_TEXT: '居民身份证',
    WAIT_MS: 200,   // 等弹窗最长 200ms（真实系统弹窗慢可调大）
    POLL_MS: 50,
    GAP_MS: 50,
    KEY: 'bz_progress_v16'
  };

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- 定位 ---------- */
  function findItem(label) {
    var t = label.replace(/\s|\*/g, '');
    var nodes = document.querySelectorAll('label, .el-form-item__label, span, div');
    for (var i = 0; i < nodes.length; i++) {
      var s = (nodes[i].textContent || '').replace(/\s|\*/g, '');
      if (!s || s.length > t.length + 2 || s.indexOf(t) === -1) continue;
      var it = nodes[i].closest('.el-form-item, .layui-form-item, .form-group, .col, div');
      if (it && it.querySelector('input, select, textarea')) return it;
    }
    return null;
  }
  function findInput() {
    var it = findItem(CFG.ID_LABEL);
    var el = it ? it.querySelector('input:not([type=hidden]), textarea') : null;
    return el || document.querySelector('input[placeholder*="身份证"], input[name*="idcard" i]');
  }
  function setType() {
    var it = findItem(CFG.TYPE_LABEL);
    var sel = it ? it.querySelector('select') : null;
    if (!sel) return;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if ((o.text || '').replace(/\s/g, '').indexOf(CFG.TYPE_TEXT) !== -1 && sel.value !== o.value) {
        sel.value = o.value;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }
  function setVal(el, v) {
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------- 弹窗 ---------- */
  function findDlg() {
    var sels = ['.el-message-box', '.layui-layer', '.el-dialog__wrapper', '.ant-modal', '.modal.show'];
    for (var i = 0; i < sels.length; i++) {
      var ds = document.querySelectorAll(sels[i]);
      for (var j = 0; j < ds.length; j++) {
        var d = ds[j];
        var cs = getComputedStyle(d);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        var r = d.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return d;  // 不能用 offsetParent：fixed 定位元素它恒为 null
      }
    }
    return null;
  }
  function closeDlg() {
    var d = findDlg();
    if (!d) return;
    var btns = d.querySelectorAll('button, a, .layui-layer-btn a');
    var ok = null;
    for (var i = 0; i < btns.length; i++) {
      if (/确\s*定/.test(btns[i].textContent || '')) { ok = btns[i]; break; }
    }
    if (!ok) ok = d.querySelector('.el-button--primary') || d.querySelector('.layui-layer-btn0') || btns[0];
    if (ok) ok.click();
  }

  /* ---------- 单条查询 ---------- */
  async function queryOne(id) {
    var input = findInput();
    if (!input) return { stop: '页面上没找到「' + CFG.ID_LABEL + '」输入框，请确认当前页面正确' };
    setType();
    setVal(input, '');
    await sleep(150);
    setVal(input, id);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
    input.blur();
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    var deadline = Date.now() + CFG.WAIT_MS;
    var dlg = null;
    while (Date.now() < deadline) {
      await sleep(CFG.POLL_MS);
      dlg = findDlg();
      if (dlg) break;
    }
    if (dlg) {
      var text = (dlg.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      closeDlg();
      await sleep(80);
      if (findDlg()) closeDlg();
      return { hit: true, text: text };
    }
    return { hit: false };
  }

  /* ---------- 面板 ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#bz-panel{position:fixed;right:16px;top:80px;z-index:2147483647;width:300px;background:#fff;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.18);font:13px/1.6 "Microsoft YaHei",sans-serif;color:#333;}',
    '#bz-panel .hd{background:#2b7cff;color:#fff;padding:10px 14px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;font-weight:bold;}',
    '#bz-panel .hd .x{cursor:pointer;font-weight:normal;opacity:.8;}',
    '#bz-panel .bd{padding:12px;}',
    '#bz-panel .row{margin-bottom:8px;}',
    '#bz-panel button{border:0;border-radius:6px;padding:8px 14px;cursor:pointer;font:13px "Microsoft YaHei";margin-right:6px;}',
    '#bz-panel .b1{background:#2b7cff;color:#fff;}',
    '#bz-panel .b2{background:#f0f2f5;color:#333;}',
    '#bz-panel .b3{background:#f90;color:#fff;}',
    '#bz-panel .b4{background:#ff6b35;color:#fff;}',
    '#bz-panel button:disabled{opacity:.5;cursor:not-allowed;}',
    '#bz-panel .row button{margin-bottom:4px;}',
    '#bz-panel .bar{height:6px;background:#eef1f6;border-radius:3px;overflow:hidden;margin:6px 0;}',
    '#bz-panel .bar i{display:block;height:100%;width:0;background:#2b7cff;transition:width .3s;}',
    '#bz-panel .st{font-size:12px;color:#666;}',
    '#bz-panel .lg{max-height:150px;overflow:auto;font-size:12px;background:#f7f8fa;border-radius:6px;padding:6px 8px;margin-top:6px;}',
    '#bz-panel .ok{color:#1a9c3e;}',
    '#bz-panel .dim{color:#aaa;}'
  ].join('');
  document.head.appendChild(css);

  var panel = document.createElement('div');
  panel.id = 'bz-panel';
  panel.innerHTML = [
    '<div class="hd"><span>批量核验助手</span><span class="x">—</span></div>',
    '<div class="bd">',
    '<div class="row">',
    '<button class="b2" id="bz-file-btn">① 选择 Excel 名单</button>',
    '<span class="st" id="bz-file-name">未选择</span>',
    '<input type="file" id="bz-file" accept=".xlsx,.xls,.csv" style="display:none">',
    '</div>',
    '<div class="row">',
    '<button class="b1" id="bz-start" disabled>② 开始核验</button>',
    '<button class="b2" id="bz-stop" disabled>暂停</button>',
    '<button class="b4" id="bz-restart" disabled>重新核验</button>',
    '</div>',
    '<div class="bar"><i id="bz-bar"></i></div>',
    '<div class="st" id="bz-stat">请先选择名单文件</div>',
    '<div class="row" style="margin-top:8px">',
    '<button class="b3" id="bz-export" disabled>③ 导出已录入名单</button>',
    '<button class="b2" id="bz-copy" disabled>复制 CSV</button>',
    '<button class="b2" id="bz-clearmem">清空全部进度</button>',
    '</div>',
    '<div class="lg" id="bz-log"></div>',
    '</div>'
  ].join('');
  document.body.appendChild(panel);
  panel.querySelector('.x').onclick = function () {
    var bd = panel.querySelector('.bd');
    bd.style.display = bd.style.display === 'none' ? '' : 'none';
  };

  function $(id) { return document.getElementById(id); }

  /* ---------- 状态 ---------- */
  var LIST = [];   // [{id, name, done, status:'已录入'|'无弹窗', text}]
  var running = false;
  var mem = {};
  try { mem = JSON.parse(localStorage.getItem(CFG.KEY) || '{}') || {}; } catch (e) { mem = {}; }

  function saveMem() {
    try { localStorage.setItem(CFG.KEY, JSON.stringify(mem)); } catch (e) { }
  }
  function log(text, cls) {
    var lg = $('bz-log');
    var d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    lg.appendChild(d);
    lg.scrollTop = lg.scrollHeight;
  }
  function refresh() {
    var n = LIST.length, done = 0, hit = 0;
    for (var i = 0; i < n; i++) {
      if (LIST[i].done) done++;
      if (LIST[i].status === '已录入') hit++;
    }
    $('bz-bar').style.width = n ? (done / n * 100) + '%' : '0';
    $('bz-stat').textContent = n ? '进度 ' + done + '/' + n + ' ｜ 已录入 ' + hit : '请先选择名单文件';
    $('bz-export').disabled = hit === 0;
    $('bz-copy').disabled = hit === 0;
    $('bz-restart').disabled = !LIST.length || (!running && done === 0);
  }

  function buildHits() {
    var hits = [];
    for (var i = 0; i < LIST.length; i++) {
      if (LIST[i].done && LIST[i].status === '已录入') hits.push(LIST[i]);
    }
    return hits;
  }
  function buildCsv(hits) {
    var lines = ['\uFEFF序号,身份证号,姓名'];
    for (var j = 0; j < hits.length; j++) {
      var id = String(hits[j].id || '').replace(/"/g, '""');
      var nm = String(hits[j].name || '').replace(/"/g, '""');
      lines.push((j + 1) + ',"' + id + '","' + nm + '"');
    }
    return lines.join('\r\n');
  }

  /* ---------- ① 选择文件 ---------- */
  $('bz-file-btn').onclick = function () { $('bz-file').click(); };
  $('bz-file').onchange = async function (e) {
    var f = e.target.files[0];
    if (!f) return;
    $('bz-file-name').textContent = f.name;
    try {
      var wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      var list = [];
      if (rows.length) {
        var cols = Object.keys(rows[0]);
        var idCol = null, nameCol = null;
        for (var i = 0; i < cols.length; i++) {
          if (/身份|证件/.test(cols[i]) && !idCol) idCol = cols[i];
          if (/姓名/.test(cols[i]) && !nameCol) nameCol = cols[i];
        }
        if (!idCol) idCol = cols[0];
        list = rows.map(function (r) {
          return { id: String(r[idCol] || '').trim(), name: nameCol ? String(r[nameCol] || '').trim() : '' };
        });
      }
      if (!list.length) {
        var arr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        list = [].concat.apply([], arr).map(function (v) { return { id: String(v).trim(), name: '' }; });
      }
      list = list.filter(function (x) { return x.id && x.id !== '身份证号'; });
      var seen = {};
      list = list.filter(function (x) { if (seen[x.id]) return false; seen[x.id] = 1; return true; });
      if (!list.length) { log('没有读到身份证号，请检查文件'); return; }
      var resumed = 0;
      LIST = list;
      for (var j = 0; j < LIST.length; j++) {
        var p = mem[LIST[j].id];
        if (p) { LIST[j].done = true; LIST[j].status = p.status; LIST[j].text = p.text || ''; resumed++; }
      }
      log('导入 ' + LIST.length + ' 条' + (resumed ? '，已核验 ' + resumed + ' 条自动跳过' : ''));
      $('bz-start').disabled = false;
      refresh();
    } catch (err) {
      log('读取文件失败: ' + err.message);
    }
  };

  /* ---------- ② 主循环 ---------- */
  $('bz-start').onclick = async function () {
    if (running || !LIST.length) return;
    running = true;
    $('bz-start').disabled = true;
    $('bz-stop').disabled = false;
    for (var i = 0; i < LIST.length; i++) {
      if (!running) break;
      var item = LIST[i];
      if (item.done) continue;
      var r = await queryOne(item.id);
      if (r.stop) { log(r.stop); break; }
      item.done = true;
      if (r.hit) {
        item.status = '已录入';
        item.text = r.text;
        log('[' + (i + 1) + '] ' + item.id + ' 已录入', 'ok');
      } else {
        item.status = '无弹窗';
        log('[' + (i + 1) + '] ' + item.id + ' 无弹窗', 'dim');
      }
      mem[item.id] = { status: item.status, text: item.text || '' };
      saveMem();
      refresh();
      await sleep(CFG.GAP_MS);
    }
    running = false;
    $('bz-stop').disabled = true;
    $('bz-start').disabled = false;
    if (LIST.length && LIST.every(function (x) { return x.done; })) log('全部完成，点「③ 导出已录入名单」拿结果');
    else log('已暂停，点「② 开始核验」继续');
  };
  $('bz-stop').onclick = function () { running = false; };

  /* ---------- 重新核验：清空当前 LIST 的进度后从头跑 ---------- */
  $('bz-restart').onclick = function () {
    if (running) { log('正在核验中，先点「暂停」'); return; }
    if (!LIST.length) return;
    var doneCount = 0;
    for (var i = 0; i < LIST.length; i++) if (LIST[i].done) doneCount++;
    if (!doneCount) { log('当前没有进度，无需重新核验'); return; }
    if (!confirm('确定要清空当前 ' + doneCount + ' 条进度，从头重新核验？\n（原结果会从本地缓存删除，不可恢复）')) return;
    for (var j = 0; j < LIST.length; j++) {
      delete mem[LIST[j].id];
      LIST[j].done = false;
      LIST[j].status = '';
      LIST[j].text = '';
    }
    saveMem();
    log('已清空 ' + doneCount + ' 条进度，准备重新核验', 'ok');
    refresh();
    // 直接触发新一轮核验
    $('bz-start').click();
  };

  /* ---------- 清空全部进度：彻底抹掉 localStorage ---------- */
  $('bz-clearmem').onclick = function () {
    if (running) { log('正在核验中，先点「暂停」'); return; }
    var keys = Object.keys(mem).length;
    if (!keys) { log('本地没有保存的进度'); return; }
    if (!confirm('确定要清空本地保存的全部 ' + keys + ' 条进度？\n（重新选择文件后将从零开始）')) return;
    mem = {};
    saveMem();
    for (var i = 0; i < LIST.length; i++) {
      LIST[i].done = false;
      LIST[i].status = '';
      LIST[i].text = '';
    }
    log('已清空本地全部进度', 'ok');
    refresh();
  };

  /* ---------- 复制 CSV 到剪贴板（下载失败时兜底） ---------- */
  $('bz-copy').onclick = function () {
    var hits = buildHits();
    if (!hits.length) { log('还没有已录入的号码'); return; }
    var csv = buildCsv(hits);
    var done = function () { log('已复制 ' + hits.length + ' 条 CSV 到剪贴板', 'ok'); };
    var fail = function () { log('复制失败，请改用「导出 Excel」按钮'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(csv).then(done).catch(function () {
        legacyCopy(csv) ? done() : fail();
      });
    } else if (legacyCopy(csv)) {
      done();
    } else {
      fail();
    }
  };
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* ---------- ③ 导出：只有已录入名单（用 Blob + <a download>） ---------- */
  $('bz-export').onclick = function () {
    var hits = buildHits();
    if (!hits.length) { log('还没有已录入的号码'); return; }
    var aoa = [['序号', '身份证号', '姓名']];
    for (var j = 0; j < hits.length; j++) aoa.push([j + 1, hits[j].id, hits[j].name || '']);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), '已录入名单');
    var d = new Date();
    var ds = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    var fname = '已录入名单_' + ds + '.xlsx';
    var ok = false;
    try {
      // 1) 首选：Blob + <a download>（更可控，绕过 XLSX.writeFile 在某些浏览器下的失效）
      var buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fname;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
      ok = true;
    } catch (e1) {
      try {
        // 2) 兜底：XLSX.writeFile 原生方式
        XLSX.writeFile(wb, fname);
        ok = true;
      } catch (e2) {
        log('导出失败：' + (e2 && e2.message || e2));
      }
    }
    if (ok) {
      log('已导出 ' + hits.length + ' 条（' + fname + '），如未弹出下载框请检查浏览器是否拦截，或改用「复制 CSV」按钮', 'ok');
    }
  };

  refresh();
})();
