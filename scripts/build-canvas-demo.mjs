/**
 * build-canvas-demo.mjs — generate v4-canvas.html, the local visual harness
 * for the head canvas (dp_heroCard).
 *
 * The product CSS is extracted LIVE from src/client/css.js (all five sheet
 * literals), so the harness always renders the current source — edit css.js,
 * re-run this script, refresh. The host's `--dsw-*` design tokens are stubbed
 * with a dark, blue-accent approximation of the default dsh shell; the
 * product's own theme overrides (themeCss) ride on top untouched.
 *
 * SYNC DUTY: the markup below mirrors src/client/heroCard.js block-for-block.
 * When heroCard's structure changes, change the template here to match — the
 * harness is a visual tool, the style-test lock guards the real contract.
 *
 *   node scripts/build-canvas-demo.mjs
 *
 * Environment variants (decoupling the fixtures from one host setup):
 *   ?lang=en        mirror the REAL en dictionary from src/client/locale.js
 *   &cur=usd        official balance in USD (product rule: no ¥, " USD" unit)
 *   &plans=N        rebuild the ledger with N providers (1..6)
 *   &longnames=1    long provider-name fixture (ellipsis-boundary stress)
 *   Any of these retires the "第 3 个订阅" toggle for that load.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssSource = readFileSync(join(root, "src", "client", "css.js"), "utf8");

/** Every sheet the bundle injects, in injection order. Backticks cannot
 *  appear inside (the style suite forbids them), so a lazy match to the
 *  closing backtick is exact. */
const sheets = [];
for (const name of ["css", "themeCss", "rowCss", "chartCss", "quotaCss", "floatCss"]) {
	const m = cssSource.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`));
	if (m === null) throw new Error(`sheet ${name} not found in src/client/css.js`);
	sheets.push(m[1]);
}
const pulseCss = sheets.join("\n");

/** The host shell's `--dsw-*` tokens are NOT owned by this plugin (only the
 *  pink/orange/bw overrides in themeCss are). The stub is FAITHFUL to the
 *  host theme (`@deepseek-ai/dsh-client-ui-theme`, dark face): it defines
 *  ONLY names the host really defines. The six names the sheet once used
 *  that the host never had (color-danger / color-warning / label-error /
 *  bare state-success / bare interactive-bg-hover*) are deliberately absent
 *  here — the product's :where bridge resolves them from these real ones,
 *  and this stub must never re-lie about the host (it once did, which is
 *  how invisible hot fills shipped through a green matrix). Values
 *  approximate the host's dark face (static-red-400 / amber-500 /
 *  green-500 through its ramps). */
const dswStub = `:root{
--dsw-alias-bg-base:#0e1013;--dsw-alias-bg-layer-2:#14171c;--dsw-alias-bg-layer-3:#1a1e25;
--dsw-alias-bg-overlay:#22262f;--dsw-alias-bg-skeleton:#4f8df51f;
--dsw-alias-border-l1:#ffffff12;--dsw-alias-border-l2:#ffffff1f;--dsw-alias-border-l3:#ffffff2e;--dsw-alias-border-l4:#ffffff3d;
--dsw-alias-brand-primary:#4f8df5;
--dsw-alias-label-caption:#676c76;
--dsw-alias-label-primary:#ecedf1;--dsw-alias-label-primary-inverted:#0e1013;
--dsw-alias-label-secondary:#9ba0a9;--dsw-alias-label-tertiary:#676c76;
--dsw-alias-state-business-primary:#4f8df5;--dsw-alias-state-business-tertiary:#26334d;
--dsw-alias-state-error-primary:#f25a5a;--dsw-alias-state-warn-primary:#e0a34e;
--dsw-alias-state-success-primary:#2fbf9a;
--dsw-alias-tooltip-bg:#2a2e37;
--dsw-alias-interactive-bg-hover:#ffffff14;--dsw-alias-interactive-bg-hover-accent:#ffffff3d;
--dsw-specific-tip:#141519;
}`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pulse 头部画布 harness v4 —— 真实 CSS · 生成于 ${new Date().toISOString().slice(0, 16).replace("T", " ")}</title>
<style>
${dswStub}
/* ---------- 仅 harness 自身的舞台样式（产品样式在下方整块内联） ---------- */
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:var(--dsw-alias-bg-base)}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;color:var(--dsw-alias-label-primary);padding:26px 30px 60px;-webkit-font-smoothing:antialiased}
.wrap{max-width:1720px;margin:0 auto}
.page-head{display:flex;align-items:baseline;gap:14px;margin-bottom:16px}
.page-head h1{font-size:15px;font-weight:600}
.page-head span{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.controls{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;margin-bottom:10px}
.tgl{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12.5px;cursor:pointer;user-select:none}
.tgl .dot{width:7px;height:7px;border-radius:50%;background:#3a3d44}
.tgl[aria-pressed="true"]{color:var(--dsw-alias-label-primary);border-color:#4f8df573;background:#4f8df51a}
.tgl[aria-pressed="true"] .dot{background:var(--dsw-alias-state-business-primary)}
.width-bar{display:flex;align-items:center;gap:14px;margin:0 2px 12px;flex-wrap:wrap}
.width-bar label{font-size:12.5px;color:var(--dsw-alias-label-tertiary)}
.width-bar input[type=range]{-webkit-appearance:none;appearance:none;width:280px;height:3px;border-radius:99px;background:#2a2d33;outline:none;cursor:pointer}
.width-bar input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-state-business-primary);border:3px solid var(--dsw-alias-bg-base);box-shadow:0 0 0 1px #4f8df580}
.wchip{padding:4px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11.5px;cursor:pointer}
.wchip:hover{color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l2)}
.size-read{font-size:12.5px;color:var(--dsw-alias-label-tertiary)}
.size-read b{color:var(--dsw-alias-label-secondary);font-weight:500}
.stage{width:100%;max-width:1663px;margin:0 auto;transition:width .2s ease}
/* bare=1：无头截图模式——只剩卡片本身，舞台宽度即卡宽，禁止过渡 */
.bare .page-head,.bare .controls,.bare .width-bar{display:none}
.bare body{padding:12px}
.bare .stage{margin:0;transition:none;max-width:none}
/* ---------- 产品样式（由 build-canvas-demo.mjs 从 src/client/css.js 整块抽取） ---------- */
${pulseCss}
</style>
</head>
<body data-ds-dark-theme>
<div class="wrap">
  <div class="page-head">
    <h1>Pulse 头部画布 harness <span style="color:var(--dsw-alias-state-business-primary)">v4</span></h1>
    <span>CSS 实时抽自 src/client/css.js · 标记镜像 heroCard.js · 拖宽度验证自适应</span>
  </div>
  <div class="controls" id="toggles">
    <button class="tgl" data-m="est" aria-pressed="true"><span class="dot"></span>费用估算</button>
    <button class="tgl" data-m="bal" aria-pressed="true"><span class="dot"></span>官方余额</button>
    <button class="tgl" data-m="quota" aria-pressed="true"><span class="dot"></span>订阅额度</button>
    <button class="tgl" data-m="cache" aria-pressed="true"><span class="dot"></span>缓存命中</button>
    <button class="tgl" data-m="x" aria-pressed="false"><span class="dot"></span>第 3 个订阅</button>
  </div>
  <div class="width-bar">
    <label>卡宽模拟</label>
    <input type="range" id="widthSlider" min="560" max="1663" step="1" value="1663">
    <button class="wchip" data-w="1663">1663</button>
    <button class="wchip" data-w="1280">1280</button>
    <button class="wchip" data-w="1000">1000</button>
    <button class="wchip" data-w="850">850</button>
    <button class="wchip" data-w="700">700</button>
    <button class="wchip" data-w="560">560</button>
    <span class="size-read" id="sizeRead"></span>
  </div>

  <div class="stage" id="stage">
    <div class="dp_root">
      <div class="dp_chips">
        <div class="dp_chip dp_heroCard dp_hasRefresh" id="card">
          <button type="button" class="dp_qRefresh dp_consActions" title="刷新">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89M13.5 2.5v3h-3"/></svg>
          </button>

          <!-- 资金列：消费估算（上）+ 官方余额（下） -->
          <div class="dp_hCol" id="moneyCol">
            <div class="dp_hBlk dp_hEst dp_hHot" id="blk-est" role="button" tabindex="0">
              <span class="dp_hHead"><span class="dp_consLabel">费用估算</span><span class="dp_hRange">近7天</span></span>
              <span class="dp_consHeroVal">¥12.45</span>
              <button type="button" class="dp_consNote dp_chipNoteBtn">有未定价消耗</button>
            </div>
            <div class="dp_hBlk dp_hBal" id="blk-bal">
              <span class="dp_hHead"><span class="dp_consLabel">官方余额</span><span class="dp_hBadge">余额预估 11 天</span></span>
              <span class="dp_consHeroVal">¥17.90</span>
              <span class="dp_hMetrics">
                <span class="dp_hMetric"><span class="dp_consLabel">赠送</span><b class="dp_hMetricOk">1.00</b></span>
                <span class="dp_hMetric"><span class="dp_consLabel">充值</span><b>16.89</b></span>
              </span>
            </div>
          </div>

          <!-- 订阅额度区 -->
          <div class="dp_hBlk dp_hQuota dp_hHot" id="blk-quota" role="button" tabindex="0">
            <span class="dp_hHead"><span class="dp_consLabel">订阅额度</span><span class="dp_hRange" id="planCount">2 项订阅</span></span>
            <span class="dp_qChips" id="qChips">
              <span class="dp_qwRow">
                <span class="dp_qName">GLM Coding Pro</span>
                <span class="dp_qWins">
                  <span class="dp_qwWin"><span class="dp_qwTag">5小时</span><span class="dp_qwTrack"><span class="dp_qwFill" style="width:38%"></span></span><span class="dp_qwPct">38%</span></span>
                  <span class="dp_qwWin"><span class="dp_qwTag">本周</span><span class="dp_qwTrack"><span class="dp_qwFill" style="width:66%"></span></span><span class="dp_qwPct">66%</span></span>
                </span>
              </span>
              <span class="dp_qwRow">
                <span class="dp_qName">Kimi For Coding</span>
                <span class="dp_qWins">
                  <span class="dp_qwWin"><span class="dp_qwTag">5小时</span><span class="dp_qwTrack"><span class="dp_qwFill dp_qwFillHot" style="width:100%"></span></span><span class="dp_qwPct">100%</span></span>
                  <span class="dp_qwWin"><span class="dp_qwTag">本周</span><span class="dp_qwTrack"><span class="dp_qwFill dp_qwFillWarm" style="width:97%"></span></span><span class="dp_qwPct">97%</span></span>
                </span>
              </span>
              <span class="dp_qwRow" id="planX" style="display:none">
                <span class="dp_qName">Claude Code</span>
                <span class="dp_qWins">
                  <span class="dp_qwWin"><span class="dp_qwTag">5小时</span><span class="dp_qwTrack"><span class="dp_qwFill" style="width:62%"></span></span><span class="dp_qwPct">62%</span></span>
                  <span class="dp_qwWin"><span class="dp_qwTag">本周</span><span class="dp_qwTrack"><span class="dp_qwFill dp_qwFillWarm" style="width:81%"></span></span><span class="dp_qwPct">81%</span></span>
                </span>
              </span>
            </span>
          </div>

          <!-- 缓存命中区：头行与另两区共享同一条 label 线 -->
          <div class="dp_hBlk dp_hCache" id="blk-cache">
            <span class="dp_hHead"><span class="dp_consLabel">缓存命中率</span></span>
            <div class="dp_cardBody dp_ringBody">
              <div class="dp_ringWrap" role="img" aria-label="缓存命中率">
                <svg viewBox="0 0 116 116" width="116" height="116" aria-hidden="true">
                  <circle class="dp_ringTrack" cx="58" cy="58" r="48" fill="none" stroke-width="12"/>
                  <circle class="dp_ringValue" cx="58" cy="58" r="48" fill="none" stroke-width="12" stroke-dasharray="301.59" stroke-dashoffset="6.03" transform="rotate(-90 58 58)"/>
                </svg>
                <div class="dp_ringCenter"><span class="dp_ringPct">98%</span></div>
              </div>
              <div class="dp_ringSide">
                <div class="dp_ringSideRow"><span>命中 </span><b class="dp_hitVal">989.4M</b><span class="dp_hitSub"> / 总输入 1.0B</span></div>
                <div class="dp_ringSideRow"><span>未缓存输入 </span><b>15.3M</b></div>
                <div class="dp_ringSideRow"><span>输出 </span><b>4.4M</b></div>
              </div>
            </div>
          </div>

          <!-- 通栏脚行：区间内活动永远收边画布，hairline 之下三格铺全宽 -->
          <div class="dp_hFoot">
            <div class="dp_actGrid" title="区间内活动：会话 20 · 回合 202 · 工具调用 1,204">
              <span class="dp_actCell"><span class="dp_actLabel">会话</span><span class="dp_actVal">20</span></span>
              <span class="dp_actCell"><span class="dp_actLabel">回合</span><span class="dp_actVal">202</span></span>
              <span class="dp_actCell"><span class="dp_actLabel">工具调用</span><span class="dp_actVal">1,204</span></span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</div>

<script>
const card = document.getElementById('card');
const stage = document.getElementById('stage');
const blocks = {est:document.getElementById('blk-est'), bal:document.getElementById('blk-bal'), quota:document.getElementById('blk-quota'), cache:document.getElementById('blk-cache')};
const moneyCol = document.getElementById('moneyCol');
const planX = document.getElementById('planX');
const planCount = document.getElementById('planCount');
const sizeRead = document.getElementById('sizeRead');
const slider = document.getElementById('widthSlider');
const toggles = [...document.querySelectorAll('.tgl')];
function on(m){ return toggles.find(t=>t.dataset.m===m).getAttribute('aria-pressed')==='true'; }
const footEl = document.querySelector('#card .dp_hFoot');
/* 产品里关闭的区是“根本不渲染”（React 条件子节点为 false），不是 display:none
   —— :has() 对 display:none 的后代照样命中，会把“独苗”误判成“成对”。所以
   harness 的开关必须真移除/插回节点，保持与 heroCard.js 同一 DOM 事实。 */
function show(el,on){
  if(on){ if(el.parentNode!==card) card.insertBefore(el,footEl); }
  else if(el.parentNode===card) el.remove();
}
function apply(){
  /* est/bal 与区一样“不渲染即不在 DOM”（与 heroCard.js 对齐）：独占列的
     半块语法依赖 :has(.dp_hEst/.dp_hBal)，display:none 会骗过它。 */
  if(on('est')||on('bal')){ if(moneyCol.parentNode!==card) card.insertBefore(moneyCol,footEl); }
  else if(moneyCol.parentNode===card) moneyCol.remove();
  if(on('est')){ if(blocks.est.parentNode!==moneyCol) moneyCol.insertBefore(blocks.est,blocks.bal); }
  else if(blocks.est.parentNode===moneyCol) blocks.est.remove();
  if(on('bal')){ if(blocks.bal.parentNode!==moneyCol) moneyCol.appendChild(blocks.bal); }
  else if(blocks.bal.parentNode===moneyCol) blocks.bal.remove();
  show(blocks.quota, on('quota'));
  show(blocks.cache, on('cache'));
  planX.style.display = (!VARIANT && on('x')) ? '' : 'none';  /* [hidden] 敌不过产品 CSS 的 display:flex，必须用内联 display */
  if(!VARIANT) planCount.textContent = on('x') ? '3 项订阅' : '2 项订阅';
}
toggles.forEach(t=>t.addEventListener('click', ()=>{
  t.setAttribute('aria-pressed', t.getAttribute('aria-pressed')==='true' ? 'false' : 'true');
  apply();
}));
function setWidth(w){ slider.value=w; stage.style.width = Math.min(w,1663)+'px'; }
slider.addEventListener('input', ()=>setWidth(+slider.value));
document.querySelectorAll('.wchip').forEach(ch=>ch.addEventListener('click', ()=>setWidth(+ch.dataset.w)));
new ResizeObserver(()=>{
  const r = card.getBoundingClientRect();
  sizeRead.innerHTML = '画幅 <b>'+Math.round(r.width)+' × '+Math.round(r.height)+'</b> · 宽高比 <b>'+(r.width/r.height).toFixed(2)+':1</b>';
}).observe(card);
const params = new URLSearchParams(location.search);
if(params.get('bare')==='1') document.documentElement.classList.add('bare');
setWidth(+(params.get('w')||1663));
for(const m of ['est','bal','quota','cache','x']){ if(params.get(m)==='0'||params.get(m)==='1') toggles.find(t=>t.dataset.m===m).setAttribute('aria-pressed', params.get(m)==='1'?'true':'false'); }
/* ---- 环境变体：让夹具与「一台机器的现状」解耦。语种串全部镜像
   src/client/locale.js 的真实词典（en 表），不是 harness 自造文案；供应商
   名字是数据（产品里原样显示），长短两套夹具卡在省略号边界两侧。 ---- */
const VARIANT = ['lang','cur','plans','longnames'].some(k=>params.get(k)!==null);
const LANG_EN = params.get('lang')==='en';
const CUR_USD = params.get('cur')==='usd';
const SHORT_NAMES=['GLM Coding Pro','Kimi For Coding','Claude Code','Codex Pro','Copilot Workspace','DeepSeek Chat'];
const LONG_NAMES=['DeepSeek Anthology Max Pro (Annual Billing)','GitHub Copilot Workspace Enterprise Tier','Anthropic Claude Code Max 20x Plan','OpenAI ChatGPT Pro Workspace','Google Gemini Code Assist Standard Edition','Cursor Bundle Pro Team Annual'];
const P5=[38,100,62,47,88,24], PW=[66,97,81,72,93,55];
function tierCls(p){ return p>=90?' dp_qwFillHot':(p>=70?' dp_qwFillWarm':''); }
function buildProviders(n,long,en){
  const names=(long?LONG_NAMES:SHORT_NAMES).slice(0,n);
  const shown=names.slice(0,2), rest=names.slice(2);
  const L=en?{h:'5-hour',w:'This week',c:function(k){return k+' plans';}}:{h:'5小时',w:'本周',c:function(k){return k+' 项订阅';}};
  const win=function(tag,p){return '<span class="dp_qwWin"><span class="dp_qwTag">'+tag+'</span><span class="dp_qwTrack"><span class="dp_qwFill'+tierCls(p)+'" style="width:'+p+'%"></span></span><span class="dp_qwPct">'+p+'%</span></span>';};
  /* 产品契约（heroCard.js）：只挂前两家，其余收进 +N 徽标（dp_qAux，
     title 带全名）——harness 必须镜像这个上限，否则 +N 态永远拍不到。 */
  document.getElementById('qChips').innerHTML = shown.map(function(nm,i){
    return '<span class="dp_qwRow"><span class="dp_qName" title="'+nm+'">'+nm+'</span><span class="dp_qWins">'+win(L.h,P5[i])+win(L.w,PW[i])+'</span></span>';
  }).join('') + (rest.length ? '<span class="dp_qAux" title="'+rest.join(' · ')+'">+'+rest.length+'</span>' : '');
  planCount.textContent = L.c(n);
}
function applyLang(en){
  const q=function(s){return document.querySelector(s);};
  const qa=function(s){return Array.prototype.slice.call(document.querySelectorAll(s));};
  const set=function(el,zh,enT){ if(el) el.textContent = en?enT:zh; };
  set(q('#blk-est .dp_consLabel'),'费用估算','Estimated cost');
  set(q('#blk-est .dp_hRange'),'近7天','7d');
  set(q('#blk-est .dp_chipNoteBtn'),'有未定价消耗','Some usage unpriced');
  set(q('#blk-bal .dp_consLabel'),'官方余额','Official balance');
  set(q('#blk-bal .dp_hBadge'),'余额预估 11 天','balance est. 11 days');
  const m=qa('#blk-bal .dp_hMetric .dp_consLabel');
  set(m[0],'赠送','Granted'); set(m[1],'充值','Topped up');
  set(q('#blk-quota .dp_hHead .dp_consLabel'),'订阅额度','Subscription quota');
  set(q('#blk-cache .dp_consLabel'),'缓存命中率','Cache hit rate');
  const ring=q('#blk-cache .dp_ringWrap'); if(ring) ring.setAttribute('aria-label', en?'Cache hit rate':'缓存命中率');
  const side=qa('#blk-cache .dp_ringSideRow');
  if(side.length===3){
    set(side[0].children[0],'命中 ','Hit ');
    set(side[0].querySelector('.dp_hitSub'),' / 总输入 1.0B',' / total input 1.0B');
    set(side[1].children[0],'未缓存输入 ','Uncached input ');
    set(side[2].children[0],'输出 ','Output ');
  }
  const A=[['会话','Sessions'],['回合','Turns'],['工具调用','Tool calls']];
  qa('#card .dp_actCell').forEach(function(c,i){ set(c.querySelector('.dp_actLabel'),A[i][0],A[i][1]); });
  const rbtn=q('#card .dp_qRefresh');
  if(rbtn){ rbtn.title = en?'Refresh balance and subscriptions':'刷新余额与订阅额度'; rbtn.setAttribute('aria-label', rbtn.title); }
}
function applyCurrency(usd){
  const bal=q2Hero(); if(!bal) return;
  if(usd){ bal.textContent='17.90'; const u=document.createElement('span'); u.className='dp_consUnit'; u.textContent=' USD'; bal.appendChild(u); }
  else bal.textContent='¥17.90';
}
function q2Hero(){ return document.querySelector('#blk-bal .dp_consHeroVal'); }
if(VARIANT){
  const n=Math.max(1,Math.min(6, parseInt(params.get('plans')||'2',10)||2));
  buildProviders(n, params.get('longnames')==='1', LANG_EN);
  applyCurrency(CUR_USD);
  applyLang(LANG_EN);
  toggles.find(t=>t.dataset.m==='x').setAttribute('aria-pressed','false');
}
apply();
/* probe=1：把各区实测几何写进 document.title，供无头 --dump-dom 取证（同步强制重排即可） */
if(params.get('probe')==='1'){
  const g=(s)=>{const el=document.querySelector(s);if(!el)return 'null';const r=el.getBoundingClientRect();return Math.round(r.x)+','+Math.round(r.y)+','+Math.round(r.width)+','+Math.round(r.height);};
  const mw=(s)=>{const el=document.querySelector(s);return el?getComputedStyle(el).maxWidth:'-';};
  document.title = ['#card','.dp_hCol','.dp_hEst','.dp_hBal','.dp_hQuota','.dp_hCache','.dp_ringWrap','.dp_hFoot'].map(s=>s+':'+g(s)).join(' | ')
    + ' || mw hCol='+mw('.dp_hCol')+' mw hQuota='+mw('.dp_hQuota')+' mw hCache='+mw('.dp_hCache')
    + ' || match='+(()=>{const c=document.getElementById('card');try{return c.matches(':not(:has(.dp_hQuota,.dp_hCache))');}catch(e){return 'ERR:'+e.message;}})()
    + ' kids='+document.getElementById('card').children.length;;
}
</script>
</body>
</html>
`;

writeFileSync(join(root, "v4-canvas.html"), html);
console.log(`v4-canvas.html written (${(html.length / 1024).toFixed(1)} KB, CSS extracted from src/client/css.js)`);
