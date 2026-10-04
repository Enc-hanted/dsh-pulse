window.__ModuleLoader__.load({
	id: "dsh-pulse",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let hostDefineStore = null;
		try { hostDefineStore = require("@deepseek-ai/dsh-client-store").defineStore ?? null; } catch { /* old module table */ }
		let reactDom = null;
		try { reactDom = require("react-dom"); } catch { /* portal-less fallback */ }
		globalThis.__dshPulseHost = { defineStore: hostDefineStore, reactDom };
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/main.js
var main_exports = {};
__export(main_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(main_exports);

// src/client/react.js
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");

// src/client/locale.js
var NS = "dsh-pulse";
var zh = {
  nav: "\u7528\u91CF\u89C2\u6D4B\u53F0",
  title: "Pulse \u7528\u91CF\u89C2\u6D4B\u53F0",
  subtitle: "\u8DE8\u4F1A\u8BDD token \u7528\u91CF\u3001\u7F13\u5B58\u547D\u4E2D\u4E0E\u5DE5\u4F5C\u533A\u5206\u5E03",
  refresh: "\u5237\u65B0",
  loading: "\u6B63\u5728\u805A\u5408\u5168\u90E8\u4F1A\u8BDD...",
  emptyTitle: "\u8FD8\u6CA1\u6709\u53EF\u7EDF\u8BA1\u7684\u4F1A\u8BDD",
  emptyBody: "\u548C agent \u804A\u51E0\u8F6E\u4E4B\u540E\uFF0C\u8FD9\u91CC\u4F1A\u51FA\u73B0\u6309\u5929\u7684 token \u7528\u91CF\u3001\u7F13\u5B58\u547D\u4E2D\u7387\u4EE5\u53CA\u5DE5\u4F5C\u533A\u5206\u5E03\u3002",
  windowEmptyTitle: "\u8FD9\u4E2A\u533A\u95F4\u8FD8\u6CA1\u6709\u7528\u91CF",
  windowEmptyBody: "\u5DF2\u6709\u5176\u5B83\u4F1A\u8BDD\u8BB0\u5F55\uFF0C\u53EA\u662F {from} ~ {to} \u5185\u6CA1\u6709\u7528\u91CF\uFF1B\u6362\u4E2A\u8303\u56F4\u6216\u7B49\u672C\u8F6E\u5BF9\u8BDD\u4EA7\u751F token \u540E\u4F1A\u81EA\u52A8\u66F4\u65B0\u3002",
  filteredTitle: "\u6240\u9009\u8303\u56F4\u5185\u6CA1\u6709\u7528\u91CF",
  filteredBody: "\u6362\u4E00\u4E2A\u65F6\u95F4\u8303\u56F4\u3001\u5DE5\u4F5C\u533A\u6216\u6A21\u578B\u8BD5\u8BD5\u3002",
  errorTitle: "\u8BFB\u53D6\u7EDF\u8BA1\u6570\u636E\u5931\u8D25",
  errorBody: "\u5BBF\u4E3B\u7684 /pulse/stats \u8DEF\u7531\u4E0D\u53EF\u7528\uFF08\u63D2\u4EF6\u5BBF\u4E3B\u534A\u672A\u52A0\u8F7D\uFF0C\u6216\u670D\u52A1\u672A\u5C31\u7EEA\uFF09\u3002",
  retry: "\u91CD\u8BD5",
  rangeLabel: "\u8303\u56F4",
  range1: "\u4ECA\u5929",
  range7: "\u8FD17\u5929",
  range30: "\u8FD130\u5929",
  range90: "\u8FD190\u5929",
  range365: "\u8FD11\u5E74",
  rangeCustom: "\u81EA\u9009",
  calWeek: "\u4E00,\u4E8C,\u4E09,\u56DB,\u4E94,\u516D,\u65E5",
  calPickStart: "\u9009\u62E9\u8D77\u59CB\u65E5\u671F",
  calPickEnd: "\u9009\u62E9\u7ED3\u675F\u65E5\u671F\uFF08\u65E9\u4E8E\u8D77\u70B9\u5219\u4EA4\u6362\uFF09",
  calMonths: "1\u6708,2\u6708,3\u6708,4\u6708,5\u6708,6\u6708,7\u6708,8\u6708,9\u6708,10\u6708,11\u6708,12\u6708",
  calNoFuture: "\u672A\u6765\u65E5\u671F\u4E0D\u53EF\u9009",
  calSpanCap: "\u8DE8\u5EA6\u6700\u591A {n} \u5929",
  calSpanDays: "{n} \u5929",
  calBadDate: "\u65E5\u671F\u65E0\u6548\u3001\u8D85\u51FA\u8DE8\u5EA6\u4E0A\u9650\u6216\u843D\u5728\u672A\u6765",
  calYMHint: "\u70B9\u9009\u6708\u4EFD\u5FEB\u901F\u8DF3\u8F6C",
  yesterday: "\u6628\u5929",
  rangeFrom: "\u8D77\u59CB\u65E5\u671F",
  rangeToDate: "\u7ED3\u675F\u65E5\u671F",
  projectLabel: "\u5DE5\u4F5C\u533A",
  projectAll: "\u5168\u90E8\u5DE5\u4F5C\u533A",
  modelLabel: "\u6A21\u578B",
  modelAll: "\u5168\u90E8\u6A21\u578B",
  searchPlaceholder: "\u641C\u7D22...",
  noMatch: "\u65E0\u5339\u914D\u9879",
  hourCount: "24 \u5C0F\u65F6",
  hcLess: "\u5C11",
  hcMore: "\u591A",
  hcMon: "\u4E00",
  hcWed: "\u4E09",
  hcFri: "\u4E94",
  hcAria: "\u6BCF\u65E5 token \u70ED\u529B\u56FE",
  chipSessions: "\u4F1A\u8BDD",
  chipSubagents: "\u542B\u5B50\u4EE3\u7406 {n}",
  chipTurns: "\u56DE\u5408 / \u5DE5\u5177\u8C03\u7528",
  chipTokens: "Token \u603B\u91CF",
  chipCache: "\u7F13\u5B58\u547D\u4E2D\u7387",
  chipCost: "\u8D39\u7528\u4F30\u7B97",
  costOff: "\u672A\u914D\u7F6E\u5355\u4EF7",
  costHint: "\u5728 profile \u7684 cordis.patch.yml \u4E2D\u914D\u7F6E pricing \u540E\u663E\u793A",
  cmdTokens: "\u603B\u7528\u91CF",
  cmdHit: "\u7F13\u5B58\u547D\u4E2D",
  cmdCost: "\u8D39\u7528\u4F30\u7B97",
  cmdSess: "\u4F1A\u8BDD \xB7 \u56DE\u5408",
  cmdOpen: "\u6253\u5F00\u5B8C\u6574\u89C2\u6D4B\u53F0",
  cmdScope: "\u5DF2\u9650\u5B9A\u5F53\u524D\u5DE5\u4F5C\u533A \xB7 \u8FD1 7 \u5929",
  cmdScopeAll: "\u7EDF\u8BA1\u5168\u90E8\u5DE5\u4F5C\u533A \xB7 \u8FD1 7 \u5929",
  cmdMenuDesc: "\u8DE8\u4F1A\u8BDD\u7528\u91CF\u4E0E\u8D39\u7528\u89C2\u6D4B\u53F0",
  cmdSession: "\u672C\u4F1A\u8BDD",
  cmdProject: "\u672C\u5DE5\u4F5C\u533A \xB7 \u8FD1 7 \u5929",
  cmdModels: "\u6A21\u578B\u5360\u6BD4",
  cmdRecent: "\u6700\u8FD1\u4F1A\u8BDD",
  cmdOthers: "\u5176\u4ED6 {n} \u4E2A",
  cmdNoUsage: "\u8FD1 7 \u5929\u6CA1\u6709\u7528\u91CF",
  cmdTurns: "{n} \u56DE\u5408",
  cmdLast7: "\u8FD1 7 \u5929",
  cmdSessCount: "{n} \u4F1A\u8BDD",
  cmdLoadFailed: "\u52A0\u8F7D\u5931\u8D25\uFF1A{err}",
  aboutTitle: "\u5173\u4E8E",
  aboutVersion: "\u5F53\u524D\u7248\u672C",
  aboutCheck: "\u68C0\u67E5\u66F4\u65B0",
  aboutChecking: "\u68C0\u67E5\u4E2D\u2026",
  aboutUpToDate: "\u5DF2\u662F\u6700\u65B0",
  aboutNewer: "\u6709\u65B0\u7248\u672C {v}",
  aboutDev: "\u5F00\u53D1\u7248\uFF08\u9886\u5148\u5DF2\u53D1\u5E03 {v}\uFF09",
  aboutFailed: "\u68C0\u67E5\u5931\u8D25\uFF1A{err}",
  costGoSet: "\u672A\u914D\u7F6E\u5355\u4EF7 \xB7 \u70B9\u6B64\u5B9A\u4EF7",
  fxNote: "\u542B USD \u6309 {r} \u6298\u7B97",
  unpriced: "{n} token \u672A\u5B9A\u4EF7",
  unpricedHint: "\u6709\u672A\u5B9A\u4EF7\u6D88\u8017",
  refreshCard: "\u5237\u65B0\u4F59\u989D\u4E0E\u8BA2\u9605\u989D\u5EA6",
  balanceTitle: "\u5B98\u65B9\u4F59\u989D",
  balanceGranted: "\u8D60\u9001 {v}",
  balanceTopped: "\u5145\u503C {v}",
  balanceUnavailable: "\u5DF2\u6B20\u8D39",
  balanceAt: "\u66F4\u65B0\u4E8E {t}",
  balanceFailed: "\u67E5\u8BE2\u5931\u8D25\uFF1A{err}",
  actualTip: "\u5B98\u65B9\u6263\u8D39 {v}",
  actualUnknown: "\u5B98\u65B9\u6263\u8D39 \xB7 \u5F53\u65E5\u6709\u5145\u503C\uFF0C\u672A\u77E5",
  trendTitle: "\u7528\u91CF\u8D70\u52BF",
  costTrend: "\u8D39\u7528\u8D70\u52BF",
  costTipPeak: "\u9AD8\u5CF0 {v}",
  costTipOff: "\u7A7A\u95F2 {v}",
  costTipTotal: "\u5408\u8BA1 {v}",
  costHourlyAux: "\u5408\u8BA1\u53E6\u542B\u8F85\u52A9\u8C03\u7528\uFF08\u4F30\u7B97\uFF09{v}",
  dailyCount: "\u8FD1 {n} \u5929",
  costSum: "\u5408\u8BA1 {v}",
  cacheTitle: "\u7F13\u5B58\u547D\u4E2D",
  cacheOf: "\u547D\u4E2D {hit} / \u603B\u8F93\u5165 {total}",
  cacheNa: "\u6682\u65E0\u6570\u636E",
  sideHit: "\u547D\u4E2D",
  sideTotal: "\u603B\u8F93\u5165",
  sideUncached: "\u672A\u7F13\u5B58\u8F93\u5165",
  sideOutput: "\u8F93\u51FA",
  modelsTitle: "\u6A21\u578B\u5206\u5E03",
  projectsTitle: "\u5DE5\u4F5C\u533A\u6392\u884C",
  colRank: "#",
  colProject: "\u5DE5\u4F5C\u533A",
  colSessions: "\u4F1A\u8BDD",
  colTokens: "Token",
  noWorkspace: "\uFF08\u65E0\u5DE5\u4F5C\u533A\uFF09",
  unknownModel: "\u672A\u77E5\u6A21\u578B",
  today: "\u4ECA\u5929",
  tipIn: "\u8F93\u5165 {n}",
  tipCache: "\u547D\u4E2D {n}",
  tipOut: "\u8F93\u51FA {n}",
  tipSessions: "{n} \u4E2A\u4F1A\u8BDD",
  legendInput: "\u672A\u7F13\u5B58\u8F93\u5165",
  legendCache: "\u7F13\u5B58\u8BFB\u53D6",
  legendOutput: "\u8F93\u51FA",
  axisNote: "\u547D\u4E2D(\u5DE6\u8F74) \xB7 \u8F93\u5165/\u8F93\u51FA(\u53F3\u8F74)",
  generatedAt: "\u751F\u6210\u4E8E {t}",
  inOf: "\u5165 {n}",
  outOf: "\u51FA {n}",
  "openOverlay": "\u6253\u5F00\u7528\u91CF\u89C2\u6D4B\u53F0",
  costEnabledLabel: "\u542F\u7528\u8D39\u7528\u4F30\u7B97",
  costEnabledHint: "\u5173\u95ED\u540E\uFF0C\u4EEA\u8868\u76D8\u7684\u8D39\u7528\u4F30\u7B97\u5361\u7247\u4E0E /pulse \u6458\u8981\u91CC\u7684\u8D39\u7528\u5C06\u9690\u85CF\u3002",
  configure: "\u5B9A\u4EF7\u4E0E\u8D39\u7528",
  setTitle: "\u5B9A\u4EF7\u4E0E\u8D39\u7528",
  setSub: "\u6A21\u578B\u5217\u8868\u53D6\u81EA\u8BBE\u7F6E\u7684\u6A21\u578B\u76EE\u5F55\uFF0C\u53EA\u9700\u586B\u5199\u5355\u4EF7\uFF1B\u603B\u989D\u7EDF\u4E00\u6309\u4EBA\u6C11\u5E01\u663E\u793A\u3002\u4FDD\u5B58\u7ACB\u5373\u751F\u6548\u5E76\u6301\u4E45\u5316\u3002",
  setInput: "\u8F93\u5165",
  setCache: "\u7F13\u5B58\u547D\u4E2D",
  setOutput: "\u8F93\u51FA",
  setPeakIn: "\u9AD8\u5CF0\u8F93\u5165",
  setPeakCache: "\u9AD8\u5CF0\u7F13\u5B58",
  setPeakOut: "\u9AD8\u5CF0\u8F93\u51FA",
  setCurrency: "\u5E01\u79CD",
  setPeakNote: "\u5355\u4EF7\u6309\u6BCF\u767E\u4E07 token \u8BA1\uFF08\u5E01\u79CD\u5728\u8BBE\u7F6E\u9875\u7EDF\u4E00\u7BA1\u7406\uFF09\uFF1B\u7F13\u5B58\u547D\u4E2D\u4EF7\u7559\u7A7A\u8868\u793A\u4E0E\u8F93\u5165\u4EF7\u76F8\u540C\u3002",
  setPeakToggle: "\u5CF0\u8C37\u8BA1\u4EF7",
  setPeakHours: "\u9AD8\u5CF0\u65F6\u6BB5\uFF08\u5317\u4EAC\u65F6\u95F4\uFF0C\u70B9\u9009\u5C0F\u65F6\u683C\uFF09",
  setPeakReset: "\u6062\u590D\u5B98\u65B9\u65F6\u6BB5",
  setMonthly: "\u6708\u4ED8\u8D39",
  setMonthlyHint: "\u6708\u4ED8\u8D39\uFF1A\u8BE5\u4F9B\u5E94\u5546\u6309\u8BA2\u9605\u8BA1\u8D39\uFF0C\u65D7\u4E0B\u6A21\u578B\u65E0\u9700\u5355\u4EF7\uFF0C\u8D39\u7528\u6309 0 \u8BA1\u3002",
  setMonthlyFeeHint: "\u6708\u4ED8\u91D1\u989D\uFF08CNY/\u6708\uFF09\uFF1A\u4EC5\u7528\u4E8E\u65B9\u6848\u5BF9\u6BD4\u7684\u8BA2\u9605\u884C\u5C55\u793A\uFF0C\u4E0D\u5F71\u54CD\u6309\u91CF\u6210\u672C\u4F30\u7B97\uFF08\u5305\u6708\u6A21\u578B\u6309 0 \u8FB9\u9645\u8BA1\uFF09\u3002",
  auxModelName: "\u8F85\u52A9\u8C03\u7528\uFF08\u4F30\u7B97\uFF09",
  modelCount: "{n} \u4E2A\u6A21\u578B",
  legendFilterHint: "\u70B9\u51FB\u7B5B\u9009\u6A21\u578B",
  quotaBurnFlat: "\u6D88\u8017\u901F\u7387 \u22480/\u5C0F\u65F6",
  reconTableTitle: "\u5BF9\u8D26\u660E\u7EC6",
  reconColDay: "\u65E5\u671F",
  reconColOfficial: "\u5B98\u65B9\u6263\u8D39",
  reconColEst: "\u672C\u5730\u4F30\u7B97",
  reconColGap: "\u5DEE\u989D",
  auxCalManual: "\u5F62\u72B6\u624B\u52A8\u6307\u5B9A\uFF0C\u81EA\u6821\u51C6\u5DF2\u51BB\u7ED3",
  auxCalCalibrated: "\u81EA\u6821\u51C6 \xD7{s}\uFF08\u6837\u672C {n} \u5929\uFF09",
  auxCalAligned: "\u81EA\u6821\u51C6\u5DF2\u5BF9\u9F50 \xD7{s}\uFF08\u6837\u672C {n} \u5929\uFF09",
  auxCalInsufficient: "\u6837\u672C\u4E0D\u8DB3\uFF08{n} \u5929\uFF09\uFF0C\u6309\u5185\u7F6E\u5F62\u72B6",
  auxCalDivergent: "\u68C0\u6D4B\u5230\u65E0\u6CD5\u5F52\u56E0\u7684\u6D88\u8017\uFF0C\u81EA\u6821\u51C6\u6302\u8D77",
  auxShapeTip: "\u5F62\u72B6 {m}/{h}/{o}",
  expSearch: "\u641C\u7D22\u8C03\u7528",
  expTitle: "\u6807\u9898\u8C03\u7528",
  expGap: "\u5BF9\u8D26\u5DEE\u989D (CNY)",
  hourlyNote: "\u9010\u65F6\u660E\u7EC6\u4EC5\u4FDD\u7559\u6700\u8FD1 3 \u5929",
  auxBadge: "\u641C\u7D22 \xD7{n}",
  detailAuxTitle: "\u8F85\u52A9\u8C03\u7528\uFF08\u4F30\u7B97\uFF09",
  detailAuxLine: "\u641C\u7D22 \xD7{s} \xB7 \u6807\u9898 \xD7{t}",
  setGroupUsage: "\u4F7F\u7528\u4E2D \xB7 \u4E0D\u5728\u6A21\u578B\u76EE\u5F55",
  setGroupCustom: "\u81EA\u5B9A\u4E49\u89C4\u5219",
  setCatalogEmpty: "\u672A\u8BFB\u53D6\u5230\u6A21\u578B\u76EE\u5F55\uFF08\u5BBF\u4E3B\u65E0 llm \u670D\u52A1\uFF09\uFF0C\u65E0\u6CD5\u7F16\u8F91\u8D39\u7387\u3002",
  setFxLabel: "\u7F8E\u5143\u6C47\u7387",
  setFxHint: "1 USD \u5151 CNY\uFF1B\u7F8E\u5143\u5355\u4EF7\u6A21\u578B\u6309\u6B64\u6C47\u7387\u6298\u7B97\u8FDB\u4EBA\u6C11\u5E01\u603B\u989D\u3002",
  setPreview: "\u8FD1 {n} \u5929\u8D39\u7528\u9884\u89C8",
  setAdd: "\u624B\u52A8\u6DFB\u52A0\u6A21\u578B",
  setRemove: "\u5220\u9664",
  setSave: "\u4FDD\u5B58",
  setReset: "\u6062\u590D\u5185\u7F6E\u9ED8\u8BA4",
  setRefresh: "\u5237\u65B0\u76EE\u5F55",
  setOfficialReset: "\u6062\u590D\u5B98\u65B9\u4EF7",
  setDupModel: "\u5B58\u5728\u91CD\u590D\u7684\u6A21\u578B ID\uFF0C\u8BF7\u5220\u9664\u91CD\u590D\u884C\u540E\u91CD\u8BD5",
  setRefold: "\u9AD8\u5CF0\u65F6\u6BB5\u5DF2\u53D8\u66F4\uFF0C\u6B63\u5728\u540E\u53F0\u91CD\u7B97\u5386\u53F2\uFF0C\u9996\u6B21\u5237\u65B0\u53EF\u80FD\u7A0D\u6162\u3002",
  setSaved: "\u5DF2\u4FDD\u5B58\uFF0C\u8D39\u7528\u4F30\u7B97\u5DF2\u66F4\u65B0",
  setFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A{err}",
  setBadNumber: "\u5B58\u5728\u65E0\u6548\u6570\u5B57\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5",
  setConflict: "\u8BBE\u7F6E\u5DF2\u88AB\u5176\u4ED6\u7A97\u53E3\u4FEE\u6539\uFF0C\u5DF2\u5237\u65B0\u672C\u5730\u526F\u672C\uFF0C\u8BF7\u91CD\u8BD5",
  rowConfigSummary: "\u5B9A\u4EF7\u89C4\u5219\u3001\u6C47\u7387\u4E0E\u663E\u793A\u504F\u597D\u7684\u53EF\u89C6\u5316\u7F16\u8F91\u5668\uFF08\u672C\u9875\u53EF\u5B8C\u6574\u914D\u7F6E\uFF09",
  detailBadge: "\u7528\u91CF\u89C2\u6D4B\u53F0",
  detailSectionTitle: "\u7528\u91CF\u89C2\u6D4B\u53F0",
  detailSectionBody: "\u8DE8\u4F1A\u8BDD token \u7528\u91CF\u3001\u7F13\u5B58\u547D\u4E2D\u3001\u5DE5\u4F5C\u533A\u5206\u5E03\u4E0E\u5B98\u65B9\u4F59\u989D\u5BF9\u8D26\u3002\u4EEA\u8868\u76D8\u5165\u53E3\u5728\u5DE6\u4FA7\u8FB9\u680F\uFF08\u6570\u636E\u56FE\u6807\uFF09\u6216 /pulse \u547D\u4EE4\uFF1B\u5B9A\u4EF7\u89C4\u5219\u53EF\u5728\u672C\u9875\u76F4\u63A5\u914D\u7F6E\u3002",
  generalFootBalance: "\u5728\u4FA7\u8FB9\u680F\u663E\u793A\u5B98\u65B9\u4F59\u989D",
  generalFootBalanceDesc: "\u5728\u4FA7\u8FB9\u680F\u5E95\u90E8\u663E\u793A DeepSeek \u5F00\u653E\u5E73\u53F0\u7684\u8D26\u6237\u4F59\u989D\uFF0C\u5207\u6362\u7ACB\u5373\u751F\u6548",
  accentTitle: "\u6A21\u578B\u914D\u8272",
  accentHint: "\u6A21\u578B\u5206\u5E03\u7B49\u56FE\u8868\u7684\u5F3A\u8C03\u8272\uFF1A\u6309\u5382\u5BB6\u54C1\u724C\u8272\u81EA\u52A8\u5206\u914D\uFF0C\u540C\u5382\u6A21\u578B\u540C\u65CF\u6DF1\u6D45\u3001\u672A\u8BC6\u522B\u6A21\u578B\u6309\u8272\u76F8\u9519\u5F00\uFF1B\u70B9\u8272\u5757\u81EA\u5B9A\u4E49\uFF0C\u9ED1\u767D\u4E3B\u9898\u4E0B\u81EA\u52A8\u8272\u8F6C\u4E3A\u7070\u9636\u3002",
  accentAuto: "\u81EA\u52A8",
  accentResetAll: "\u5168\u90E8\u6062\u590D\u81EA\u52A8",
  panelCostTrend: "\u8D39\u7528\u8D70\u52BF",
  panelDescCostTrend: "\u5173\u95ED\u540E\u8D70\u52BF\u533A\u4EC5\u663E\u793A\u7528\u91CF\u8D70\u52BF",
  legendPeak: "\u5CF0\u65F6",
  legendOffpeak: "\u8C37\u65F6",
  stackTiers: "\u8C37\u5CF0",
  stackType: "\u7C7B\u578B",
  stackModel: "\u6A21\u578B",
  stackOther: "\u5176\u4ED6",
  close: "\u5173\u95ED",
  backToDays: "\u8FD4\u56DE\u591A\u65E5",
  focusNote: "\u4F30\u7B97\u53E3\u5F84\u56FE\u8868\uFF0C\u5177\u4F53\u4F7F\u7528\u60C5\u51B5\u4EE5\u5B98\u7F51\u4E3A\u51C6",
  back: "\u8FD4\u56DE",
  windowActivity: "\u533A\u95F4\u5185\uFF1A\u4F1A\u8BDD {s} / \u56DE\u5408 {t} / \u5DE5\u5177\u8C03\u7528 {c}",
  actSessions: "\u4F1A\u8BDD",
  actTurns: "\u56DE\u5408",
  actToolCalls: "\u5DE5\u5177\u8C03\u7528",
  weekCount: "{n} \u5468",
  monthCount: "{n} \u6708",
  drillByHour: "\u6309\u5C0F\u65F6\u67E5\u770B \u2192",
  setNotWritable: "\u5F53\u524D\u73AF\u5883\u672A\u6302\u8F7D\u8BBE\u7F6E\u5B58\u50A8\uFF0C\u65E0\u6CD5\u4ECE\u9762\u677F\u4FEE\u6539\uFF1B\u53EF\u5728 profile \u7684 cordis.patch.yml \u4E2D\u914D\u7F6E pulse \u7684 pricing / costEnabled / usdToCny\u3002",
  setLoading: "\u6B63\u5728\u52A0\u8F7D\u8BBE\u7F6E\u2026",
  setHint: "\u5B98\u65B9 DeepSeek \u4EF7\u5DF2\u5185\u7F6E\uFF1B\u7B2C\u4E09\u65B9\u6A21\u578B\u586B\u597D\u5355\u4EF7\u5373\u53EF\u3002\u5B8C\u5168\u6CA1\u586B\u7684\u884C\u4FDD\u5B58\u65F6\u4E0D\u4F1A\u5199\u5165\u3002",
  compare: "\u65B9\u6848\u5BF9\u6BD4",
  cmpSub: "\u5BF9\u6BD4\u4E0D\u540C\u8D39\u7387\u65B9\u6848\u5728\u76F8\u540C\u7528\u91CF\u4E0B\u7684\u603B\u6210\u672C\u3002\u573A\u666F\u53C2\u6570\u53EF\u6765\u81EA\u771F\u5B9E\u7528\u91CF\uFF0C\u4E5F\u53EF\u624B\u52A8\u8C03\u6574\u3002",
  cmpInput: "\u603B\u8F93\u5165\uFF08\u767E\u4E07\uFF09",
  cmpRatio: "\u8F93\u51FA / \u8F93\u5165\u6BD4\u4F8B\uFF08%\uFF09",
  cmpHit: "\u7F13\u5B58\u547D\u4E2D\u7387\uFF08%\uFF09",
  cmpReal: "\u771F\u5B9E\u573A\u666F",
  cmpAvg: "\u7ECF\u5178\u573A\u666F",
  cmpLong: "\u591A\u8F93\u51FA\u573A\u666F",
  cmpMassive: "\u9AD8\u547D\u4E2D\u573A\u666F",
  cmpBased: "\u57FA\u4E8E {from} ~ {to} \u7684\u771F\u5B9E\u7528\u91CF",
  cmpNoData: "\u6682\u65E0\u7528\u91CF\u6570\u636E",
  cmpName: "\u65B9\u6848\u540D\u79F0",
  cmpMiss: "\u672A\u547D\u4E2D\u8F93\u5165",
  cmpHitIn: "\u547D\u4E2D\u8F93\u5165",
  cmpOut: "\u8F93\u51FA",
  cmpAdd: "\u6DFB\u52A0\u65B9\u6848",
  cmpBest: "\u6700\u4F18",
  cmpDetail: "\u547D\u4E2D {hit} \xB7 \u672A\u547D\u4E2D {miss} \xB7 \u8F93\u51FA {out}",
  cmpHint: "\u65B9\u6848\u6765\u81EA\u5B9A\u4EF7\u4E0E\u8D39\u7528\u9875\u7684\u6709\u6548\u89C4\u5219\uFF0C\u8D39\u7387\u6539\u52A8\u81EA\u52A8\u751F\u6548\uFF1B\u4E34\u65F6\u65B9\u6848\u53EA\u5B58\u5728\u672C\u9875\u3002\u5355\u4EF7\u6309\u6BCF\u767E\u4E07 token \u8BA1\uFF0C\u6210\u672C = \u672A\u547D\u4E2D \xD7 \u672A\u547D\u4E2D\u4EF7 + \u547D\u4E2D \xD7 \u547D\u4E2D\u4EF7 + \u8F93\u51FA \xD7 \u8F93\u51FA\u4EF7\u3002",
  cmpTierOffpeak: "\u8C37\u65F6\u4EF7",
  cmpTierPeak: "\u9AD8\u5CF0\u4EF7",
  cmpFromRules: "\u6765\u81EA\u5B9A\u4EF7\u89C4\u5219",
  cmpShowAll: "\u5168\u90E8\u663E\u793A",
  cmpEmpty: "\u6CA1\u6709\u53EF\u89C1\u7684\u65B9\u6848",
  cmpManual: "\u4E34\u65F6\u65B9\u6848",
  cmpRates: "\u8D39\u7387",
  cmpTierHint: "\u9AD8\u5CF0 / \u8C37\u65F6\u8BA1\u4EF7",
  cmpSubTag: "\u8BA2\u9605",
  cmpSubMonthly: "\u6298\u5408 {v}/\u6708",
  cmpSubNote: "\u5305\u6708\u4E0D\u968F\u7528\u91CF\u53D8\u5316\uFF1B\u4EC5\u8986\u76D6\u5BF9\u5E94\u6A21\u578B\u7684\u8BA2\u9605\u989D\u5EA6",
  cmpUnit: "CNY",
  panels: "\u8BBE\u7F6E",
  panelsSub: "\u9009\u62E9\u5728\u7528\u91CF\u89C2\u6D4B\u53F0\u4E2D\u663E\u793A\u54EA\u4E9B\u9762\u677F\u3002",
  themeSub: "\u4EEA\u8868\u76D8\u914D\u8272\uFF1A\u968F\u5BBF\u4E3B\u7684\u4EAE/\u6697\u4E3B\u9898\u81EA\u52A8\u9002\u914D\uFF0C\u84DD\u8272\u5373\u539F\u4F5C\u9ED8\u8BA4\u5916\u89C2\u3002",
  themeBlue: "\u84DD\u8272",
  themeBw: "\u9ED1\u767D",
  themePink: "\u7C89\u8272",
  themeOrange: "\u6A58\u8272",
  themeHint: "\u672C\u5730\u504F\u597D\uFF0C\u53EA\u5BF9\u672C\u6D4F\u89C8\u5668\u751F\u6548\u3002",
  exportBtn: "\u5BFC\u51FA",
  exportTitle: "\u5BFC\u51FA\u5F53\u524D\u7A97\u53E3\u62A5\u8868\uFF08CSV\uFF0C\u53EF\u7528 Excel \u6253\u5F00\uFF09",
  expDate: "\u65E5\u671F",
  expSessions: "\u4F1A\u8BDD",
  expInput: "\u672A\u7F13\u5B58\u8F93\u5165",
  expCacheRead: "\u7F13\u5B58\u8BFB\u53D6",
  expCacheWrite: "\u7F13\u5B58\u5199\u5165",
  expOutput: "\u8F93\u51FA",
  expTotal: "\u5408\u8BA1",
  expHitRate: "\u7F13\u5B58\u547D\u4E2D\u7387",
  expCost: "\u8D39\u7528 (CNY)",
  expSpend: "\u5B98\u65B9\u6263\u8D39 (CNY)",
  expSum: "\u6C47\u603B",
  panelGroup: "\u663E\u793A\u9762\u677F",
  curLabel: "\u8BA1\u4EF7\u5E01\u79CD",
  curHint: "\u6240\u6709\u6A21\u578B\u7EDF\u4E00\u6309\u6B64\u5E01\u79CD\u8BA1\u4EF7\uFF1BUSD \u5355\u4EF7\u6309\u6C47\u7387\u6298\u7B97\u4E3A CNY \u603B\u989D\u663E\u793A\u3002",
  panelBalance: "\u5B98\u65B9\u4F59\u989D",
  panelDescBalance: "\u5173\u95ED\u540E\u4E0D\u518D\u663E\u793A\u5B98\u65B9\u4F59\u989D\u4E0E\u4F59\u989D\u9884\u4F30\uFF0C\u5BF9\u8D26\u660E\u7EC6\u4E00\u5E76\u9690\u85CF",
  panelQuota: "\u8BA2\u9605\u989D\u5EA6",
  panelDescQuota: "\u5173\u95ED\u540E\u4E0D\u518D\u53D1\u8D77\u8BA2\u9605\u989D\u5EA6\u67E5\u8BE2\uFF0C\u660E\u7EC6\u4E00\u5E76\u9690\u85CF",
  panelTrend: "\u7528\u91CF\u8D70\u52BF",
  panelDescTrend: "\u5173\u95ED\u540E\u8D70\u52BF\u533A\u4EC5\u663E\u793A\u8D39\u7528\u8D70\u52BF",
  panelCache: "\u7F13\u5B58\u547D\u4E2D",
  panelDescCache: "\u5173\u95ED\u540E\u9690\u85CF\u7F13\u5B58\u547D\u4E2D\u73AF\u5F62\u56FE\uFF0C\u6D88\u8D39\u91D1\u989D\u72EC\u5360\u6574\u884C",
  panelModels: "\u6A21\u578B\u5206\u5E03",
  panelDescModels: "\u5173\u95ED\u540E\u9690\u85CF\u6A21\u578B\u5206\u5E03",
  panelProjects: "\u5DE5\u4F5C\u533A\u6392\u884C",
  panelDescProjects: "\u5173\u95ED\u540E\u9690\u85CF\u5DE5\u4F5C\u533A\u6392\u884C\uFF1B\u6392\u884C\u4EC5\u5728\u672A\u7B5B\u9009\u5DE5\u4F5C\u533A\u65F6\u663E\u793A",
  panelSessions: "\u4F1A\u8BDD\u660E\u7EC6",
  panelDescSessions: "\u5173\u95ED\u540E\u9690\u85CF\u4F1A\u8BDD\u660E\u7EC6\uFF1B\u4EC5\u5728\u7B5B\u9009\u5DE5\u4F5C\u533A\u540E\u663E\u793A",
  projectDetailTitle: "\u5DE5\u4F5C\u533A\u660E\u7EC6",
  sessionsTitle: "\u4F1A\u8BDD\u660E\u7EC6",
  sessionMonthly: "\u6708\u4ED8",
  sessionExpand: "\u5C55\u5F00",
  sessionCollapse: "\u6536\u8D77",
  sessionMain: "\u4E3B\u4F1A\u8BDD",
  sessionSub: "\u5B50\u4EE3\u7406",
  sessionCurrent: "\u5F53\u524D\u4F1A\u8BDD",
  sessionMainCount: "\u4E3B {n}",
  sessionSubCount: "\u5B50\u4EE3\u7406 {n}",
  sessionSubTotal: "\u5B50\u4EE3\u7406\u5171 {tokens} \xB7 {cost}",
  sessionCreated: "\u521B\u5EFA",
  sessionTopModel: "\u4E3B\u8981\u6A21\u578B",
  sessionOpenDetail: "\u65AD\u70B9\u5206\u6790",
  sessionDetailTitle: "\u4F1A\u8BDD\u6D88\u8017\u66F2\u7EBF",
  sessionDetailId: "\u4F1A\u8BDD",
  sessionBreaks: "\u65AD\u70B9",
  sessionAddBreak: "\u6EDA\u8F6E\u7F29\u653E\uFF1B\u6309\u4F4F\u66F2\u7EBF\u62D6\u52A8\u653E\u65AD\u70B9\uFF08\u6700\u591A 3 \u4E2A\uFF0C\u5F31\u5438\u9644\u56DE\u5408\u7EBF\uFF09\uFF1B\u70B9\u65AD\u70B9\u65F6\u95F4\u5220\u9664",
  sessionTurnHint: "\u7070\u865A\u7EBF=\u56DE\u5408\u5F00\u59CB",
  turnDuration: "\u65F6\u957F {v}",
  turnTokens: "\u6BB5\u5185 {v}",
  relNow: "\u521A\u521A",
  relMinutes: "{n} \u5206\u949F\u524D",
  relHours: "{n} \u5C0F\u65F6\u524D",
  relDays: "{n} \u5929\u524D",
  relMonths: "{n} \u4E2A\u6708\u524D",
  relYears: "{n} \u5E74\u524D",
  quotaProviderLabel: "\u914D\u989D\u4F9B\u5E94\u5546",
  quotaRangeLabel: "\u7EDF\u8BA1\u8303\u56F4",
  currencyLabel: "\u8D27\u5E01",
  themeLabel: "\u4E3B\u9898",
  budgetModeLabel: "\u9884\u7B97\u53E3\u5F84",
  cmpPresetLabel: "\u57FA\u51C6\u9884\u8BBE",
  trendViewLabel: "\u8D8B\u52BF\u89C6\u56FE",
  stackLabel: "\u5806\u53E0\u53E3\u5F84",
  sessionGap: "\u7A7A\u6863",
  sessionGapHint: "\u8BE5\u65F6\u6BB5\u6CA1\u6709\u4EA7\u751F\u7528\u91CF\u7684\u56DE\u5408\u4E8B\u4EF6\uFF08\u4F1A\u8BDD\u65E5\u5FD7\u7A7A\u6863\uFF09",
  sessionZoomed: "\u7F29\u653E",
  sessionZoomReset: "\u5168\u89C8",
  sessionSegment: "\u5206\u6BB5",
  sessionSegFrom: "\u8D77",
  sessionSegTo: "\u6B62",
  sessionTurnMark: "\u56DE\u5408\u8FB9\u754C",
  sessionNoUsage: "\u8BE5\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7EDF\u8BA1\u7684\u7528\u91CF\u4E8B\u4EF6",
  sessionLoadFailed: "\u8BFB\u53D6\u4F1A\u8BDD\u65E5\u5FD7\u5931\u8D25\uFF1A{err}",
  sessionCloseDetail: "\u5173\u95ED",
  budgetTitle: "\u6708\u5EA6\u9884\u7B97",
  budgetSet: "\u8BBE\u7F6E\u9884\u7B97",
  budgetUsed: "\u672C\u6708\u5DF2\u7528",
  budgetForecast: "\u6708\u5E95\u9884\u8BA1",
  budgetAvg: "\u65E5\u5747 {v}",
  budgetLeftDays: "\u5269 {n} \u5929",
  budgetEmpty: "\u8BBE\u7F6E\u9884\u7B97\u540E\u663E\u793A\u8FDB\u5EA6\u548C\u6708\u5E95\u9884\u6D4B\u3002",
  budgetOver: "\u5DF2\u8D85\u9884\u7B97",
  budgetModeAll: "\u5168\u5468",
  budgetModeWeekdays: "\u5DE5\u4F5C\u65E5",
  budgetModeSingle: "\u5355\u4F11",
  runwayDays: "\u4F59\u989D\u9884\u4F30 {n} \u5929",
  runwayLow: "\u4F59\u989D\u4E0D\u8DB3 {n} \u5929",
  consStatRunway: "\u4F59\u989D\u9884\u4F30",
  consStatDay: "\u5929",
  consStatGranted: "\u8D60\u9001",
  consStatTopped: "\u5145\u503C",
  quotaTitle: "\u8BA2\u9605\u989D\u5EA6",
  quotaFailed: "\u67E5\u8BE2\u5931\u8D25\uFF1A{err}",
  quotaNoCred: "\u672A\u627E\u5230\u51ED\u636E",
  quotaWindow5h: "5\u5C0F\u65F6",
  quotaWindow7d: "\u672C\u5468",
  quotaWindowMonth: "\u672C\u6708",
  quotaWindowGeneric: "\u7A97\u53E3",
  quotaKindTokens: "tokens",
  quotaKindRequests: "\u6B21",
  quotaResetIn: "{v}\u540E\u91CD\u7F6E",
  quotaCalBasis: "\u6309\u672C\u5730 {v} \u6807\u5B9A",
  quotaCalRemain: "\u5269\u4F59 {v}",
  quotaCalTotal: "\u4F30\u7B97\u603B\u989D {v}",
  quotaScopeNote: "dsh \u53E3\u5F84\uFF1A\u767E\u5206\u6BD4 \xD7 \u672C\u5730\u7528\u91CF\u6298\u7B97\uFF0C\u4EC5\u8986\u76D6 dsh \u8BB0\u5F55\u5230\u7684\u6D41\u91CF\uFF0C\u4EC5\u4F9B\u53C2\u8003",
  quotaScopeStable: "\u8FD1 {n} \u4E2A\u533A\u95F4\u7CFB\u6570\u4E00\u81F4",
  quotaScopeThin: "\u6837\u672C\u4E0D\u8DB3\uFF0C\u8986\u76D6\u7387\u672A\u9A8C\u8BC1",
  quotaEstOff: "\u4F30\u7B97\u5DF2\u505C\u7528\uFF1A\u68C0\u6D4B\u5230\u8BE5 key \u5728 dsh \u4E4B\u5916\u7684\u7528\u91CF",
  quotaMoreTitle: "\u5176\u4F59\u8BA2\u9605\uFF1A{names}",
  quotaPlanCount: "{n} \u9879\u8BA2\u9605",
  quotaNoCal: "\u672C\u5730\u7528\u91CF\u4E0D\u8DB3\uFF0C\u6682\u65E0\u6CD5\u4F30\u7B97\u603B\u989D",
  quotaNoLocal: "\u8FD9\u4E2A\u8DE8\u5EA6\u5185\u6CA1\u6709\u672C\u5730\u8BB0\u5F55\u7684\u7528\u91CF",
  quotaBurnRate: "\u6D88\u8017\u901F\u7387\u7EA6 {v}/\u5C0F\u65F6",
  quotaBurnExhaust: "\u7EA6\u8FD8\u53EF\u7528 {v}",
  quotaBurnReset: "\u91CD\u7F6E\u65F6\u9884\u8BA1 {p}%",
  quotaPlanRenew: "{d} \u7EED\u671F",
  quotaTools: "\u8054\u7F51\u5DE5\u5177",
  quotaProjects: "\u5206\u5DE5\u4F5C\u533A\u6D88\u8017",
  quotaProjectCol: "\u5DE5\u4F5C\u533A",
  quotaTokensCol: "tokens",
  quotaShareCol: "\u7528\u91CF\u5360\u6BD4",
  quotaShareTip: "\u8BE5\u5DE5\u4F5C\u533A\u5360\u672C\u8DE8\u5EA6\u5185 dsh \u8BB0\u5F55\u5230\u7684\u8BE5\u4F9B\u5E94\u5546\u7528\u91CF\u7684\u6BD4\u4F8B",
  quotaFeeCol: "\u6708\u8D39\u5206\u644A",
  quotaRangeWeek: "\u672C\u7A97\u53E3",
  quotaRangeMonth: "\u672C\u6708",
  quotaLocalTokens: "\u672C\u5730\u8BB0\u5F55 {v}",
  quotaUpdated: "{t} \u66F4\u65B0",
  "quotaEmpty": "\u6CA1\u6709\u68C0\u6D4B\u5230\u652F\u6301\u989D\u5EA6\u67E5\u8BE2\u7684\u8BA2\u9605",
  quotaOffHint: "\u5173\u95ED\u540E\u4E0D\u518D\u5BF9\u8BE5\u4F9B\u5E94\u5546\u53D1\u8D77\u989D\u5EA6\u67E5\u8BE2",
  quotaSettingsSub: "\u8BA2\u9605\u989D\u5EA6\u67E5\u8BE2",
  quotaSettingsHint: "\u68C0\u6D4B\u5230\u7684\u8BA2\u9605\u4F9B\u5E94\u5546\uFF1B\u5173\u95ED\u5373\u4E0D\u518D\u67E5\u8BE2\u5176\u989D\u5EA6\u3002",
  quotaSettingsOn: "\u67E5\u8BE2",
  quotaSettingsOff: "\u5DF2\u5173",
  quotaDurMin: "{n} \u5206\u949F",
  quotaDurHour: "{n} \u5C0F\u65F6",
  quotaDurDay: "{n} \u5929",
  quotaResetTight: "{v}",
  quotaDurMinTight: "{n}\u5206",
  quotaDurHourTight: "{n}\u65F6",
  quotaDurDayTight: "{n}\u5929",
  quotaPerMonth: "/\u6708"
};
var en = {
  nav: "Usage Pulse",
  title: "Pulse Usage Observatory",
  subtitle: "Cross-session tokens, cache hits and workspace breakdown",
  refresh: "Refresh",
  loading: "Aggregating all sessions...",
  emptyTitle: "No sessions to measure yet",
  emptyBody: "Chat with the agent for a few turns and daily token usage, cache hit rate and workspace breakdown will appear here.",
  windowEmptyTitle: "No usage in this window",
  windowEmptyBody: "Other sessions exist, but nothing landed between {from} and {to}. Pick another range, or let this conversation produce tokens and it refreshes itself.",
  filteredTitle: "No usage in this view",
  filteredBody: "Try a different range, workspace, or model.",
  errorTitle: "Failed to load usage stats",
  errorBody: "The host /pulse/stats route is unavailable (host half not loaded, or service not ready).",
  retry: "Retry",
  rangeLabel: "Range",
  range1: "Today",
  range7: "7d",
  range30: "30d",
  range90: "90d",
  range365: "1y",
  rangeCustom: "Custom",
  calWeek: "Mo,Tu,We,Th,Fr,Sa,Su",
  calPickStart: "Pick a start date",
  calPickEnd: "Pick an end date (earlier picks swap)",
  calMonths: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec",
  calNoFuture: "Future dates are unavailable",
  calSpanCap: "Up to {n} days",
  calSpanDays: "{n} days",
  calBadDate: "Invalid date, over the span cap, or in the future",
  calYMHint: "Click to jump by month",
  yesterday: "Yesterday",
  rangeFrom: "Start date",
  rangeToDate: "End date",
  projectLabel: "Workspace",
  projectAll: "All workspaces",
  modelLabel: "Model",
  modelAll: "All models",
  searchPlaceholder: "Search...",
  noMatch: "No matches",
  hourCount: "24 hours",
  hcLess: "Less",
  hcMore: "More",
  hcMon: "M",
  hcWed: "W",
  hcFri: "F",
  hcAria: "Daily token heatmap",
  chipSessions: "Sessions",
  chipSubagents: "{n} subagents",
  chipTurns: "Turns / tool calls",
  chipTokens: "Total tokens",
  chipCache: "Cache hit rate",
  chipCost: "Estimated cost",
  costOff: "Rates not set",
  costHint: "Configure pricing in the profile cordis.patch.yml to enable",
  cmdTokens: "Total tokens",
  cmdHit: "Cache hit",
  cmdCost: "Est. cost",
  cmdSess: "Sessions \xB7 Turns",
  cmdOpen: "Open the observatory",
  cmdScope: "Scoped to this workspace \xB7 last 7 days",
  cmdScopeAll: "All workspaces \xB7 last 7 days",
  cmdMenuDesc: "Cross-session usage & cost observatory",
  cmdSession: "This session",
  cmdProject: "This workspace \xB7 last 7 days",
  cmdModels: "Model share",
  cmdRecent: "Recent sessions",
  cmdOthers: "{n} others",
  cmdNoUsage: "No usage in the last 7 days",
  cmdTurns: "{n} turns",
  cmdLast7: "last 7 days",
  cmdSessCount: "{n} sessions",
  cmdLoadFailed: "Load failed: {err}",
  aboutTitle: "About",
  aboutVersion: "Version",
  aboutCheck: "Check for updates",
  aboutChecking: "Checking\u2026",
  aboutUpToDate: "Up to date",
  aboutNewer: "New version {v}",
  aboutDev: "Development build (ahead of published {v})",
  aboutFailed: "Check failed: {err}",
  costGoSet: "Rates not set \xB7 click to configure",
  fxNote: "incl. USD at {r}",
  unpriced: "{n} tokens unpriced",
  unpricedHint: "Some usage unpriced",
  refreshCard: "Refresh balance and subscriptions",
  balanceTitle: "Official balance",
  balanceGranted: "granted {v}",
  balanceTopped: "topped up {v}",
  balanceUnavailable: "unavailable",
  balanceAt: "updated {t}",
  balanceFailed: "query failed: {err}",
  actualTip: "Actual spend {v}",
  actualUnknown: "Actual spend \xB7 topped up, unknown",
  trendTitle: "Usage trend",
  costTrend: "Cost trend",
  costTipPeak: "Peak {v}",
  costTipOff: "Off-peak {v}",
  costTipTotal: "Total {v}",
  costHourlyAux: "Includes aux calls (est.) {v}",
  dailyCount: "last {n} days",
  costSum: "total {v}",
  cacheTitle: "Cache hits",
  cacheOf: "{hit} hit / {total} total input",
  cacheNa: "No data yet",
  sideHit: "Hit",
  sideTotal: "total input",
  sideUncached: "Uncached input",
  sideOutput: "Output",
  modelsTitle: "By model",
  projectsTitle: "Top workspaces",
  colRank: "#",
  colProject: "Workspace",
  colSessions: "Sessions",
  colTokens: "Tokens",
  noWorkspace: "(no workspace)",
  unknownModel: "unknown model",
  today: "today",
  tipIn: "In {n}",
  tipCache: "Cache hit {n}",
  tipOut: "Out {n}",
  tipSessions: "{n} sessions",
  legendInput: "Uncached input",
  legendCache: "Cache read",
  legendOutput: "Output",
  axisNote: "Cache hit (left) \xB7 In/out (right)",
  generatedAt: "Generated {t}",
  inOf: "in {n}",
  outOf: "out {n}",
  "openOverlay": "Open usage pulse",
  setTitle: "Pricing & cost",
  setSub: "Model rows come from the configured model catalog \u2014 just fill in rates; totals display in CNY. Saves apply immediately and persist.",
  costEnabledLabel: "Enable cost estimates",
  costEnabledHint: "When off, the dashboard cost chip and the /pulse summary cost figures are hidden.",
  configure: "Pricing & cost",
  setInput: "Input",
  setCache: "Cache hit",
  setOutput: "Output",
  setPeakIn: "Peak in",
  setPeakCache: "Peak cache",
  setPeakOut: "Peak out",
  setCurrency: "Currency",
  setPeakNote: "Rates are per million tokens (the currency is set on the Settings page); an empty cache-hit rate falls back to the input rate.",
  setPeakToggle: "Peak pricing",
  setPeakHours: "Peak hours (Beijing time \u2014 click hour cells)",
  setPeakReset: "Official windows",
  setMonthly: "Monthly",
  setMonthlyHint: "Monthly: this provider bills a flat subscription \u2014 its models need no rates and price at zero.",
  setMonthlyFeeHint: "Monthly price (CNY/mo): shown in plan comparison as the subscription row; it does not affect the pay-per-token estimate (monthly-billed models cost 0 marginal).",
  auxModelName: "Aux calls (est.)",
  modelCount: "{n} models",
  legendFilterHint: "Click to filter models",
  quotaBurnFlat: "Burn rate \u22480/hour",
  reconTableTitle: "Reconciliation detail",
  reconColDay: "Date",
  reconColOfficial: "Official",
  reconColEst: "Local est.",
  reconColGap: "Gap",
  auxCalManual: "Shape set manually \u2014 calibration frozen",
  auxCalCalibrated: "Self-calibrated \xD7{s} ({n} days)",
  auxCalAligned: "Self-calibrated, aligned \xD7{s} ({n} days)",
  auxCalInsufficient: "Not enough samples ({n} days) \u2014 built-in shape",
  auxCalDivergent: "Unattributed spend detected \u2014 calibration suspended",
  auxShapeTip: "Shape {m}/{h}/{o}",
  expSearch: "Search calls",
  expTitle: "Title calls",
  expGap: "Recon gap (CNY)",
  hourlyNote: "Hourly detail is kept for the last 3 days only",
  auxBadge: "Search \xD7{n}",
  detailAuxTitle: "Auxiliary calls (est.)",
  detailAuxLine: "Search \xD7{s} \xB7 Title \xD7{t}",
  setGroupUsage: "In use \xB7 not in the catalog",
  setGroupCustom: "Custom rules",
  setCatalogEmpty: "No model catalog available (no llm service on the host) \u2014 nothing to edit.",
  setFxLabel: "USD rate",
  setFxHint: "1 USD in CNY; USD-priced models convert into the CNY total at this rate.",
  setPreview: "Cost preview \xB7 last {n} days",
  setAdd: "Add model manually",
  setRemove: "Remove",
  setSave: "Save",
  setReset: "Restore defaults",
  setRefresh: "Refresh catalog",
  setOfficialReset: "Official rates",
  setDupModel: "Duplicate model ids \u2014 remove the duplicated rows and retry",
  setRefold: "Peak hours changed \u2014 history is re-folding in the background; the first refresh may be slower.",
  setSaved: "Saved \u2014 cost estimates updated",
  setFailed: "Save failed: {err}",
  setBadNumber: "Invalid number entered, please fix and retry",
  setConflict: "Settings changed in another window \u2014 the local copy was refreshed, please retry",
  rowConfigSummary: "Visual editor for pricing rules, the FX rate and display preferences (fully configurable on this page)",
  detailBadge: "usage observatory",
  detailSectionTitle: "Usage Pulse",
  detailSectionBody: "Cross-session token usage, cache hit rate, workspace breakdown and official-balance reconciliation. Open the dashboard from the sidebar (the data icon) or the /pulse command; pricing rules are configurable right on this page.",
  generalFootBalance: "Show the official balance in the sidebar",
  generalFootBalanceDesc: "Show your DeepSeek open-platform balance at the bottom of the sidebar; the change applies immediately",
  accentTitle: "Model colors",
  accentHint: "Accent colors for the model charts: assigned from vendor brand colors \u2014 same-vendor models share a stepped family, unknown vendors spread by hue. Pick a swatch to override; auto colors turn grayscale in the B&W theme.",
  accentAuto: "Auto",
  accentResetAll: "Restore all to auto",
  panelCostTrend: "Cost trend",
  panelDescCostTrend: "The trend area then only shows the usage trend",
  legendPeak: "Peak",
  legendOffpeak: "Off-peak",
  stackTiers: "Tiers",
  stackType: "Type",
  stackModel: "Models",
  stackOther: "Other",
  close: "Close",
  backToDays: "Back to days",
  focusNote: "Estimates only \u2014 actual usage is subject to the official console",
  back: "Back",
  windowActivity: "In window: {s} sessions / {t} turns / {c} tool calls",
  actSessions: "Sessions",
  actTurns: "Turns",
  actToolCalls: "Tool calls",
  weekCount: "{n} weeks",
  monthCount: "{n} months",
  drillByHour: "View by hour \u2192",
  setNotWritable: "No settings storage in this environment; configure pricing / costEnabled / usdToCny for pulse in the profile cordis.patch.yml instead.",
  setLoading: "Loading settings\u2026",
  setHint: "Official DeepSeek rates are built in; fill in rates for third-party models. Completely empty rows are not saved.",
  compare: "Compare plans",
  cmpSub: "Total cost across rate plans for the same usage. The scenario can come from real usage or be set manually.",
  cmpInput: "Total input (M)",
  cmpRatio: "Output / input (%)",
  cmpHit: "Cache hit rate (%)",
  cmpReal: "Real usage",
  cmpAvg: "Typical",
  cmpLong: "Output-heavy",
  cmpMassive: "High hit",
  cmpBased: "Based on real usage {from} ~ {to}",
  cmpNoData: "No usage data yet",
  cmpName: "Plan name",
  cmpMiss: "Uncached input",
  cmpHitIn: "Cached input",
  cmpOut: "Output",
  cmpAdd: "Add plan",
  cmpBest: "Best",
  cmpDetail: "hit {hit} \xB7 miss {miss} \xB7 out {out}",
  cmpHint: "Plans come from the effective pricing rules and follow rate edits; temporary plans live in this page only. Rates per million tokens; cost = miss \xD7 miss rate + hit \xD7 hit rate + out \xD7 out rate.",
  cmpTierOffpeak: "Off-peak",
  cmpTierPeak: "Peak",
  cmpFromRules: "from pricing rules",
  cmpShowAll: "Show all",
  cmpEmpty: "No visible plans",
  cmpManual: "Temporary plan",
  cmpRates: "rates",
  cmpTierHint: "Peak / off-peak pricing",
  cmpSubTag: "Subscription",
  cmpSubMonthly: "\u2248 {v}/mo",
  cmpSubNote: "Flat regardless of volume; covers only the plan's own models and quota",
  cmpUnit: "CNY",
  panels: "Settings",
  panelsSub: "Choose which panels the observatory shows.",
  themeSub: "Dashboard palette: adapts to the shell's light/dark theme automatically; Blue is the original look.",
  themeBlue: "Blue",
  themeBw: "B&W",
  themePink: "Pink",
  themeOrange: "Orange",
  themeHint: "Local preference \u2014 this browser only.",
  exportBtn: "Export",
  exportTitle: "Export the current window as CSV (opens in Excel)",
  expDate: "Date",
  expSessions: "Sessions",
  expInput: "Uncached input",
  expCacheRead: "Cache read",
  expCacheWrite: "Cache write",
  expOutput: "Output",
  expTotal: "Total",
  expHitRate: "Cache hit rate",
  expCost: "Cost (CNY)",
  expSpend: "Official spend (CNY)",
  expSum: "Total",
  panelGroup: "Panels",
  curLabel: "Pricing currency",
  curHint: "All models price in this currency; USD rates convert to the CNY total at the exchange rate.",
  panelBalance: "Official balance",
  panelDescBalance: "Hides the official balance, the runway estimate and the reconciliation table",
  panelQuota: "Subscription quota",
  panelDescQuota: "Stops subscription quota queries and hides the quota detail",
  panelTrend: "Usage trend",
  panelDescTrend: "The trend area then only shows the cost trend",
  panelCache: "Cache hit rate",
  panelDescCache: "Hides the cache-hit ring; the spending block spans the full row",
  panelModels: "Model distribution",
  panelDescModels: "Hides the model distribution",
  panelProjects: "Workspace ranking",
  panelDescProjects: "Hides the workspace ranking; it only shows while no workspace is filtered",
  panelSessions: "Session detail",
  panelDescSessions: "Hides the session detail; it only shows while a workspace is filtered",
  projectDetailTitle: "Workspace detail",
  sessionsTitle: "Sessions",
  sessionMonthly: "Monthly",
  sessionExpand: "Expand",
  sessionCollapse: "Collapse",
  sessionMain: "Main",
  sessionSub: "Subagent",
  sessionCurrent: "Current",
  sessionMainCount: "main {n}",
  sessionSubCount: "subagent {n}",
  sessionSubTotal: "subagents {tokens} \xB7 {cost}",
  sessionCreated: "created",
  sessionTopModel: "top model",
  sessionOpenDetail: "Break analysis",
  sessionDetailTitle: "Session consumption curve",
  sessionDetailId: "Session",
  sessionBreaks: "Breaks",
  sessionAddBreak: "Wheel to zoom; press & drag on the curve to place a break (max 3, snaps to turn starts); click a break to remove",
  sessionTurnHint: "Gray dashes mark turn starts",
  turnDuration: "Duration {v}",
  turnTokens: "In turn {v}",
  relNow: "just now",
  relMinutes: "{n}m ago",
  relHours: "{n}h ago",
  relDays: "{n}d ago",
  relMonths: "{n}mo ago",
  relYears: "{n}y ago",
  quotaProviderLabel: "Quota providers",
  quotaRangeLabel: "Range",
  currencyLabel: "Currency",
  themeLabel: "Theme",
  budgetModeLabel: "Budget mode",
  cmpPresetLabel: "Baseline preset",
  trendViewLabel: "Trend view",
  stackLabel: "Stacking",
  sessionGap: "Gap",
  sessionGapHint: "No usage events in this window (session log gap)",
  sessionZoomed: "Zoomed",
  sessionZoomReset: "reset",
  sessionSegment: "Segment",
  sessionSegFrom: "from",
  sessionSegTo: "to",
  sessionTurnMark: "turn boundary",
  sessionNoUsage: "This session has no countable usage events",
  sessionLoadFailed: "Reading the session log failed: {err}",
  sessionCloseDetail: "Close",
  budgetTitle: "Monthly budget",
  budgetSet: "Set budget",
  budgetUsed: "Used this month",
  budgetForecast: "Month-end forecast",
  budgetAvg: "{v}/day",
  budgetLeftDays: "{n} days left",
  budgetEmpty: "Set a budget to see progress and the month-end forecast.",
  budgetOver: "Over budget",
  budgetModeAll: "All days",
  budgetModeWeekdays: "Weekdays",
  budgetModeSingle: "Single off",
  runwayDays: "balance est. {n} days",
  runwayLow: "under {n} days left",
  consStatRunway: "Runway",
  consStatDay: "d",
  consStatGranted: "Granted",
  consStatTopped: "Topped up",
  quotaTitle: "Subscription quota",
  quotaFailed: "Query failed: {err}",
  quotaNoCred: "No credential found",
  quotaWindow5h: "5-hour",
  quotaWindow7d: "This week",
  quotaWindowMonth: "This month",
  quotaWindowGeneric: "window",
  quotaKindTokens: "tokens",
  quotaKindRequests: "req",
  quotaResetIn: "resets in {v}",
  quotaCalBasis: "calibrated from {v} local",
  quotaCalRemain: "{v} left",
  quotaCalTotal: "est. total {v}",
  quotaScopeNote: "dsh scope: percentage \xD7 local usage; only covers traffic dsh recorded \u2014 a trend, not accounting",
  quotaScopeStable: "factor consistent across the last {n} intervals",
  quotaScopeThin: "too few samples, coverage unverified",
  quotaEstOff: "estimates off: the key is also being spent outside dsh",
  quotaMoreTitle: "Other subscriptions: {names}",
  quotaPlanCount: "{n} plans",
  quotaNoCal: "Not enough local usage to calibrate the total yet",
  quotaNoLocal: "No locally recorded usage in this span",
  quotaBurnRate: "\u2248 {v}/h",
  quotaBurnExhaust: "\u2248 {v} left at this rate",
  quotaBurnReset: "projected {p}% at reset",
  quotaPlanRenew: "renews {d}",
  quotaTools: "Web tools",
  quotaProjects: "Per-workspace burn",
  quotaProjectCol: "Workspace",
  quotaTokensCol: "tokens",
  quotaShareCol: "Usage share",
  quotaShareTip: "The workspace's share of the provider usage dsh recorded in this span",
  quotaFeeCol: "Fee share",
  quotaRangeWeek: "Window",
  quotaRangeMonth: "Month",
  quotaLocalTokens: "{v} local",
  quotaUpdated: "updated {t}",
  "quotaEmpty": "No quota-capable subscription detected",
  quotaOffHint: "While off, no quota query is issued for this provider",
  quotaSettingsSub: "Subscription quota queries",
  quotaSettingsHint: "Detected subscription providers; switching one off stops its quota queries.",
  quotaSettingsOn: "Query",
  quotaSettingsOff: "Off",
  quotaDurMin: "{n} min",
  quotaDurHour: "{n} h",
  quotaDurDay: "{n} d",
  quotaResetTight: "{v}",
  quotaDurMinTight: "{n}m",
  quotaDurHourTight: "{n}h",
  quotaDurDayTight: "{n}d",
  quotaPerMonth: "/mo"
};

// src/view.js
var MODEL_SEP = "\0";
function modelKey(provider, model) {
  const p = typeof provider === "string" && provider.length > 0 ? provider : "";
  const m = typeof model === "string" && model.length > 0 ? model : "unknown";
  return p === "" ? m : `${p}${MODEL_SEP}${m}`;
}
function splitModelKey(key) {
  const k = String(key);
  const idx = k.indexOf(MODEL_SEP);
  return idx === -1 ? { provider: "", model: k } : { provider: k.slice(0, idx), model: k.slice(idx + MODEL_SEP.length) };
}
function localDay(timeMs) {
  const d = new Date(timeMs);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftDay(day, delta) {
  const [y, m, d] = String(day).split("-").map(Number);
  return localDay(new Date(y, m - 1, d + delta, 12).getTime());
}
function daysBetween(from, to) {
  const [fy, fm, fd] = String(from).split("-").map(Number);
  const [ty, tm, td] = String(to).split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.max(1, Math.round((b - a) / 864e5) + 1);
}
function clampSpan(from, to, maxDays = 30) {
  let f = String(from);
  let t = String(to);
  if (f > t) {
    const swap = f;
    f = t;
    t = swap;
  }
  if (daysBetween(f, t) > maxDays) f = shiftDay(t, -(maxDays - 1));
  return { from: f, to: t };
}
function weekStart(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  const dow = (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
  return shiftDay(day, -dow);
}
function monthKey(day) {
  return String(day).slice(0, 7);
}
function addModelBucket(dayMatrix, modelName, tokens, tier) {
  const acc = dayMatrix.get(modelName) ?? EMPTY_MODEL_ROW();
  addDayModel(acc, tokens, tier);
  dayMatrix.set(modelName, acc);
}
var OFFICIAL_PRICE_SCHEDULES = [
  {
    from: "2026-09-10",
    rules: [
      {
        model: "deepseek-flash",
        input: 1,
        cacheRead: 0.02,
        output: 4,
        peak: { input: 2, cacheRead: 0.04, output: 8 },
        peakHours: [9, 10, 11, 14, 15, 16, 17],
        weekdaysOnly: true,
        currency: "CNY"
      },
      {
        model: "deepseek-v4-pro",
        input: 4.5,
        cacheRead: 0.15,
        output: 13.5,
        peak: { input: 9, cacheRead: 0.3, output: 27 },
        peakHours: [9, 10, 11, 14, 15, 16, 17],
        weekdaysOnly: true,
        currency: "CNY"
      }
    ]
  },
  {
    from: "2026-08-17",
    rules: [
      {
        model: "deepseek-v4-flash",
        input: 1.5,
        cacheRead: 0.05,
        output: 4.5,
        peak: { input: 3, cacheRead: 0.1, output: 9 },
        peakHours: [9, 10, 11, 14, 15, 16, 17],
        weekdaysOnly: true,
        currency: "CNY"
      },
      {
        model: "deepseek-v4-flash-vision-exp",
        input: 1.5,
        cacheRead: 0.05,
        output: 4.5,
        peak: { input: 3, cacheRead: 0.1, output: 9 },
        peakHours: [9, 10, 11, 14, 15, 16, 17],
        weekdaysOnly: true,
        currency: "CNY"
      },
      {
        model: "deepseek-v4-pro",
        input: 4.5,
        cacheRead: 0.15,
        output: 13.5,
        peak: { input: 9, cacheRead: 0.3, output: 27 },
        peakHours: [9, 10, 11, 14, 15, 16, 17],
        weekdaysOnly: true,
        currency: "CNY"
      }
    ]
  }
];
function officialRulesFor(day) {
  for (const schedule of OFFICIAL_PRICE_SCHEDULES) {
    if (day >= schedule.from) return schedule.rules;
  }
  return [];
}
var CN_HOLIDAYS = /* @__PURE__ */ new Set([
  "2025-01-01",
  "2025-01-28",
  "2025-01-29",
  "2025-01-30",
  "2025-01-31",
  "2025-02-01",
  "2025-02-02",
  "2025-02-03",
  "2025-02-04",
  "2025-04-04",
  "2025-04-05",
  "2025-04-06",
  "2025-05-01",
  "2025-05-02",
  "2025-05-03",
  "2025-05-04",
  "2025-05-05",
  "2025-05-31",
  "2025-06-01",
  "2025-06-02",
  "2025-10-01",
  "2025-10-02",
  "2025-10-03",
  "2025-10-04",
  "2025-10-05",
  "2025-10-06",
  "2025-10-07",
  "2025-10-08",
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-02-15",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-21",
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  "2026-05-01",
  "2026-05-02",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
  "2027-01-01",
  "2027-01-02",
  "2027-01-03"
]);
function isOffPeakDay(day) {
  const weekday = (/* @__PURE__ */ new Date(`${day}T00:00:00Z`)).getUTCDay();
  return weekday === 0 || weekday === 6 || CN_HOLIDAYS.has(day);
}
function bucketOf(granularity, day) {
  if (granularity === "week") return weekStart(day);
  if (granularity === "month") return monthKey(day);
  return day;
}
function rangeKeys(granularity, from, to) {
  if (granularity === "month") {
    const [fy, fm] = String(from).split("-").map(Number);
    const [ty, tm] = String(to).split("-").map(Number);
    const end = ty * 12 + (tm - 1);
    const start = Math.max(fy * 12 + (fm - 1), end - 399);
    const keys2 = [];
    for (let m = start; m <= end; m += 1) {
      keys2.push(`${Math.floor(m / 12)}-${String(m % 12 + 1).padStart(2, "0")}`);
    }
    return keys2;
  }
  const step = granularity === "week" ? 7 : 1;
  let count = 0;
  for (let cur = bucketOf(granularity, from); cur <= to; cur = shiftDay(cur, step)) {
    count += 1;
    if (step === 7 && shiftDay(cur, 6) >= to) break;
  }
  const capped = Math.min(count, 400);
  let startKey = bucketOf(granularity, shiftDay(to, -(capped - 1) * step));
  if (startKey < bucketOf(granularity, from)) startKey = bucketOf(granularity, from);
  const keys = [];
  for (let cur = startKey; cur <= to; cur = shiftDay(cur, step)) {
    keys.push(cur);
    if (step === 7 && shiftDay(cur, 6) >= to) break;
  }
  return keys;
}
function bucketLabel(key) {
  return key.length === 7 ? key : key.slice(5);
}
var EMPTY_TOKENS = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
var EMPTY_MODEL_ROW = () => ({ ...EMPTY_TOKENS(), peak: EMPTY_TOKENS(), offpeak: EMPTY_TOKENS() });
var AUX_MODEL_KEY = "web-search";
var AUX_SHAPE = { miss: 8e3, hit: 1500, out: 1e3 };
function auxShapeOf(value) {
  if (value === null || typeof value !== "object") return null;
  const pick = (v, max) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };
  const miss = pick(value.miss, 5e5);
  const hit = pick(value.hit, 5e5);
  const out = pick(value.out, 1e5);
  if (miss === null && hit === null && out === null) return null;
  const seed = AUX_SHAPE;
  return { miss: miss ?? seed.miss, hit: hit ?? seed.hit, out: out ?? seed.out };
}
function modelFilterSet(model, models) {
  const list = (Array.isArray(models) ? models : []).filter((m) => typeof m === "string" && m !== "");
  if (list.length > 0) return new Set(list);
  return model === "" || model === null || model === void 0 ? null : /* @__PURE__ */ new Set([String(model)]);
}
function keyMatchesFilter(set, key) {
  if (set === null) return true;
  const raw = String(key);
  const split = splitModelKey(raw);
  return set.has(raw) || set.has(split.model) || set.has(rollupKeyOf(split.provider, split.model));
}
var ROUTE_FAMILIES = [
  { family: "deepseek", label: "DeepSeek", routes: ["deepseek-official", "deepseek-account"], accountBalance: true }
];
function familyRouteOf(provider) {
  const route = typeof provider === "string" ? provider : "";
  if (route === "") return null;
  return ROUTE_FAMILIES.find((entry) => entry.family === route || entry.routes.includes(route)) ?? null;
}
function providerLabelOf(provider, fallback = "") {
  const entry = familyRouteOf(provider);
  if (entry !== null) return entry.label;
  return typeof provider === "string" && provider !== "" ? provider : fallback;
}
function isOfficialProvider(provider) {
  const route = typeof provider === "string" ? provider : "";
  if (route === "") return true;
  return familyRouteOf(route)?.accountBalance === true;
}
function rollupKeyOf(provider, model) {
  const entry = familyRouteOf(provider);
  return modelKey(entry === null ? provider : entry.family, model);
}
var AUX_PRICE_AS = "deepseek-flash";
function addTokens(bucket, tokens) {
  bucket.input += tokens.input || 0;
  bucket.output += tokens.output || 0;
  bucket.cacheRead += tokens.cacheRead || 0;
  bucket.cacheWrite += tokens.cacheWrite || 0;
}
function cacheHitRateOf(tokens) {
  const inputSide = (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);
  return inputSide > 0 ? (tokens.cacheRead || 0) / inputSide : null;
}
function addDayModel(row, tokens, tier) {
  addTokens(row, tokens);
  if (tier === null || tier === void 0) {
    addTokens(row.offpeak, tokens);
    return;
  }
  for (const kind of ["input", "output", "cacheRead", "cacheWrite"]) {
    row.peak[kind] += tier[kind]?.peak || 0;
    row.offpeak[kind] += tier[kind]?.offpeak || 0;
  }
}
function auxDayUsage(aux, shape) {
  const sPeak = aux?.search?.peak || 0;
  const sOff = aux?.search?.offpeak || 0;
  const tPeak = aux?.title?.peak || 0;
  const tOff = aux?.title?.offpeak || 0;
  const searchCalls = sPeak + sOff;
  const titleCalls = tPeak + tOff;
  if (searchCalls <= 0 && titleCalls <= 0) return null;
  const out = { searchCalls, titleCalls, searchTokens: null, searchTier: null, titleTokens: null, titleTier: null, titleKey: null };
  if (searchCalls > 0) {
    out.searchTokens = { input: shape.miss * searchCalls, cacheRead: shape.hit * searchCalls, output: shape.out * searchCalls, cacheWrite: 0 };
    out.searchTier = {
      input: { peak: shape.miss * sPeak, offpeak: shape.miss * sOff },
      cacheRead: { peak: shape.hit * sPeak, offpeak: shape.hit * sOff },
      output: { peak: shape.out * sPeak, offpeak: shape.out * sOff },
      cacheWrite: { peak: 0, offpeak: 0 }
    };
  }
  if (titleCalls > 0) {
    const inPeak = aux?.titleIn?.peak || 0;
    const inOff = aux?.titleIn?.offpeak || 0;
    const outPeak = aux?.titleOut?.peak || 0;
    const outOff = aux?.titleOut?.offpeak || 0;
    out.titleTokens = { input: inPeak + inOff, cacheRead: 0, output: outPeak + outOff, cacheWrite: 0 };
    out.titleTier = {
      input: { peak: inPeak, offpeak: inOff },
      cacheRead: { peak: 0, offpeak: 0 },
      output: { peak: outPeak, offpeak: outOff },
      cacheWrite: { peak: 0, offpeak: 0 }
    };
    out.titleKey = typeof aux?.titleKey === "string" && aux.titleKey !== "" ? aux.titleKey : null;
  }
  return out;
}
function buildView(sessions, { granularity = "day", from, to, project = "", model = "", models: modelsOpt = [], pricing = [], fx = {}, monthly = [], auxShape: auxShapeOpt = null }) {
  const keys = rangeKeys(granularity, from, to);
  const index = new Map(keys.map((key, i2) => [key, i2]));
  const buckets = keys.map((key) => ({ key, sessions: 0, ...EMPTY_TOKENS(), auxSearch: 0, auxTitle: 0 }));
  const modelBuckets = keys.map(() => /* @__PURE__ */ new Map());
  const userRules = (Array.isArray(pricing) ? pricing : []).filter((rule) => rule?.inherited !== true);
  const dayRuleMaps = /* @__PURE__ */ new Map();
  const rulesOn = (day) => {
    let maps = dayRuleMaps.get(day);
    if (maps === void 0) {
      maps = ruleMaps([...officialRulesFor(day), ...userRules]);
      dayRuleMaps.set(day, maps);
    }
    return maps;
  };
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  const bucketCosts = keys.map((key) => ({ key, peak: 0, offpeak: 0, byModel: /* @__PURE__ */ new Map(), unpriced: { input: 0, output: 0 } }));
  const costAcc = { configured: false, total: 0, converted: 0, unpriced: { input: 0, output: 0 }, unpricedBy: /* @__PURE__ */ new Map() };
  const addDayCost = (idx, day, modelName, tokens, tier, priceAs = modelName) => {
    const owned = splitModelKey(modelName);
    const bare = owned.model;
    const provider = owned.provider;
    const priceProvider = splitModelKey(priceAs).provider;
    if (monthlySet.has(priceProvider)) {
      costAcc.configured = true;
      return;
    }
    const rule = ruleFor(rulesOn(day), priceAs);
    const dayBucket = bucketCosts[idx];
    if (rule === void 0) {
      const inputSide = (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);
      costAcc.unpriced.input += inputSide;
      costAcc.unpriced.output += tokens.output || 0;
      const missing = costAcc.unpricedBy.get(priceAs) ?? { key: priceAs, provider: priceProvider, model: splitModelKey(priceAs).model, input: 0, output: 0 };
      missing.input += inputSide;
      missing.output += tokens.output || 0;
      costAcc.unpricedBy.set(priceAs, missing);
      if (dayBucket !== void 0) {
        dayBucket.unpriced.input += inputSide;
        dayBucket.unpriced.output += tokens.output || 0;
      }
      return;
    }
    costAcc.configured = true;
    const rates = resolveRates(rule);
    const conv = rule.currency === "USD" ? usdToCny : 1;
    const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
    const offSide = flatOff || tier === null || tier === void 0 ? tokens : tierSide(tier, "offpeak");
    const peakSide = flatOff || tier === null || tier === void 0 ? EMPTY_TOKENS() : tierSide(tier, "peak");
    const offPart = priceTier(offSide, rates, "offpeak");
    const peakPart = priceTier(peakSide, rates, "peak");
    const cny = (offPart + peakPart) * conv;
    costAcc.total += cny;
    if (conv !== 1) costAcc.converted += cny;
    if (dayBucket === void 0) return;
    dayBucket.peak += peakPart * conv;
    dayBucket.offpeak += offPart * conv;
    const bm = dayBucket.byModel.get(modelName) ?? { model: bare, provider, priceAs, cost: 0 };
    bm.cost += cny;
    dayBucket.byModel.set(modelName, bm);
  };
  const totals = { sessions: 0, subagents: 0, turns: 0, toolCalls: 0, ...EMPTY_TOKENS() };
  const models = /* @__PURE__ */ new Map();
  const projects = /* @__PURE__ */ new Map();
  const seenProjects = /* @__PURE__ */ new Set();
  const seenModels = /* @__PURE__ */ new Set();
  const modelSet = modelFilterSet(model, modelsOpt);
  const auxShape = auxShapeOf(auxShapeOpt) ?? AUX_SHAPE;
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    const label = record.project === null || record.project === void 0 ? "" : String(record.project);
    seenProjects.add(label);
    if (project !== "" && label !== project) continue;
    const byDay = record.byDay ?? {};
    const daySet = new Set(Object.keys(byDay));
    for (const day of Object.keys(record.turnsByDay ?? {})) daySet.add(day);
    for (const day of Object.keys(record.toolCallsByDay ?? {})) daySet.add(day);
    for (const dayModels of Object.values(record.modelsByDay ?? {})) {
      for (const modelName of Object.keys(dayModels)) seenModels.add(modelName);
    }
    const activeDays = [...daySet].filter((day) => day >= from && day <= to).sort();
    const anchorDay = record.day !== void 0 && record.day >= from && record.day <= to ? record.day : activeDays[0];
    if (anchorDay === void 0) continue;
    const anchorIdx = index.get(bucketOf(granularity, anchorDay));
    if (anchorIdx !== void 0) buckets[anchorIdx].sessions += 1;
    const inRange = EMPTY_TOKENS();
    const inRangeModels = /* @__PURE__ */ new Map();
    for (const day of activeDays) {
      const dayModels = record.modelsByDay?.[day];
      if (modelSet === null) {
        const dayTokens = byDay[day] ?? EMPTY_TOKENS();
        addTokens(inRange, dayTokens);
        const idx = index.get(bucketOf(granularity, day));
        if (idx !== void 0) addTokens(buckets[idx], dayTokens);
        if (dayModels === void 0) {
          if (idx !== void 0) {
            addModelBucket(modelBuckets[idx], "", dayTokens, void 0);
            addDayCost(idx, day, "", dayTokens, void 0);
          }
          continue;
        }
        const attributed = EMPTY_TOKENS();
        for (const [modelName, tokens] of Object.entries(dayModels)) {
          const row = inRangeModels.get(modelName) ?? EMPTY_MODEL_ROW();
          addDayModel(row, tokens, record.tiersByDay?.[day]?.[modelName]);
          inRangeModels.set(modelName, row);
          if (idx !== void 0) {
            addModelBucket(modelBuckets[idx], modelName, tokens, record.tiersByDay?.[day]?.[modelName]);
            addDayCost(idx, day, modelName, tokens, record.tiersByDay?.[day]?.[modelName]);
          }
          addTokens(attributed, tokens);
        }
        if (idx !== void 0) {
          const rest = EMPTY_TOKENS();
          for (const field of ["input", "output", "cacheRead", "cacheWrite"]) rest[field] = (dayTokens[field] || 0) - (attributed[field] || 0);
          if (rest.input || rest.output || rest.cacheRead || rest.cacheWrite) {
            addModelBucket(modelBuckets[idx], "", rest, void 0);
            addDayCost(idx, day, "", rest, void 0);
          }
        }
      } else {
        const matched = dayModels === void 0 ? [] : Object.keys(dayModels).filter((key) => keyMatchesFilter(modelSet, key));
        for (const key of matched) {
          const filtered = dayModels[key];
          addTokens(inRange, filtered);
          const idx = index.get(bucketOf(granularity, day));
          if (idx !== void 0) addTokens(buckets[idx], filtered);
          if (idx !== void 0) {
            addModelBucket(modelBuckets[idx], key, filtered, record.tiersByDay?.[day]?.[key]);
            addDayCost(idx, day, key, filtered, record.tiersByDay?.[day]?.[key]);
          }
          const row = inRangeModels.get(key) ?? EMPTY_MODEL_ROW();
          addDayModel(row, filtered, record.tiersByDay?.[day]?.[key]);
          inRangeModels.set(key, row);
        }
      }
    }
    if (modelSet === null || modelSet.has(AUX_MODEL_KEY)) {
      for (const [day, aux] of Object.entries(record.auxByDay ?? {})) {
        if (day < from || day > to) continue;
        const usage = auxDayUsage(aux, auxShape);
        if (usage === null) continue;
        seenModels.add(AUX_MODEL_KEY);
        const idx = index.get(bucketOf(granularity, day));
        if (idx !== void 0) {
          buckets[idx].auxSearch += usage.searchCalls;
          buckets[idx].auxTitle += usage.titleCalls;
        }
        const parts = [];
        if (usage.searchTokens !== null) parts.push({ tokens: usage.searchTokens, tier: usage.searchTier, priceAs: AUX_PRICE_AS });
        if (usage.titleTokens !== null) parts.push({ tokens: usage.titleTokens, tier: usage.titleTier, priceAs: usage.titleKey ?? AUX_PRICE_AS });
        const auxTokens = {
          input: parts.reduce((s, p) => s + p.tokens.input, 0),
          cacheRead: parts.reduce((s, p) => s + p.tokens.cacheRead, 0),
          output: parts.reduce((s, p) => s + p.tokens.output, 0),
          cacheWrite: 0
        };
        const auxTier = {
          input: { peak: 0, offpeak: 0 },
          cacheRead: { peak: 0, offpeak: 0 },
          output: { peak: 0, offpeak: 0 },
          cacheWrite: { peak: 0, offpeak: 0 }
        };
        for (const part of parts) {
          for (const kind of ["input", "output", "cacheRead", "cacheWrite"]) {
            auxTier[kind].peak += part.tier[kind]?.peak || 0;
            auxTier[kind].offpeak += part.tier[kind]?.offpeak || 0;
          }
        }
        const row = inRangeModels.get(AUX_MODEL_KEY) ?? EMPTY_MODEL_ROW();
        addDayModel(row, auxTokens, auxTier);
        inRangeModels.set(AUX_MODEL_KEY, row);
        if (idx !== void 0) {
          addModelBucket(modelBuckets[idx], AUX_MODEL_KEY, auxTokens, auxTier);
          for (const part of parts) {
            addDayCost(idx, day, AUX_MODEL_KEY, part.tokens, part.tier, part.priceAs);
          }
        }
      }
    }
    totals.sessions += 1;
    if (record.subagent) totals.subagents += 1;
    if (record.turnsByDay === void 0) {
      totals.turns += Number(record.turns) || 0;
      totals.toolCalls += Number(record.toolCalls) || 0;
    } else {
      for (const day of activeDays) {
        totals.turns += Number(record.turnsByDay[day]) || 0;
        totals.toolCalls += Number(record.toolCallsByDay?.[day]) || 0;
      }
    }
    addTokens(totals, inRange);
    for (const [modelName, tokens] of inRangeModels) {
      const acc = models.get(modelName) ?? EMPTY_MODEL_ROW();
      addTokens(acc, tokens);
      addTokens(acc.peak, tokens.peak ?? EMPTY_TOKENS());
      addTokens(acc.offpeak, tokens.offpeak ?? EMPTY_TOKENS());
      models.set(modelName, acc);
    }
    const projectRow = projects.get(label) ?? { project: label === "" ? null : label, sessions: 0, ...EMPTY_TOKENS() };
    projectRow.sessions += 1;
    addTokens(projectRow, inRange);
    projects.set(label, projectRow);
  }
  totals.cacheHitRate = cacheHitRateOf(totals);
  const modelsArr = [...models.entries()].map(([modelName, tokens]) => ({ key: modelName, ...splitModelKey(modelName), ...tokens })).sort((a, b) => b.input + b.output + b.cacheRead - (a.input + a.output + a.cacheRead));
  const projectsArr = [...projects.values()].map((row) => ({ ...row, total: row.input + row.output + row.cacheRead + row.cacheWrite })).sort((a, b) => b.total - a.total);
  const grandTotal = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  const unpricedModels = [...costAcc.unpricedBy.values()].sort((a, b) => b.input + b.output - (a.input + a.output)).slice(0, 4).map((row) => ({ ...row, total: row.input + row.output }));
  return {
    buckets,
    modelBuckets,
    bucketCosts,
    totals,
    models: modelsArr,
    projects: projectsArr,
    // Epoch-accurate window cost: every day priced under the official
    // schedule in effect, user rules overlaid — same numbers as the cost
    // trend panel's days sum to.
    cost: costAcc.configured ? {
      configured: true,
      total: Math.round(costAcc.total * 1e6) / 1e6,
      currency: "CNY",
      usdToCny,
      convertedFromUsd: Math.round(costAcc.converted * 1e6) / 1e6,
      unpriced: costAcc.unpriced,
      unpricedModels
    } : { configured: false, total: null, currency: null, usdToCny, convertedFromUsd: 0, unpriced: costAcc.unpriced, unpricedModels },
    hasData: grandTotal > 0 || totals.sessions > 0,
    knownProjects: [...seenProjects].filter((p) => p !== "").sort(),
    knownModels: [...seenModels].sort()
  };
}
function resolveRates(rule) {
  const offInput = rule.input || 0;
  const offCache = typeof rule.cacheRead === "number" ? rule.cacheRead : offInput;
  const offOutput = rule.output || 0;
  const peakRule = rule.peak ?? {};
  const peakInput = typeof peakRule.input === "number" ? peakRule.input : offInput;
  const peakCache = typeof peakRule.cacheRead === "number" ? peakRule.cacheRead : peakInput;
  const peakOutput = typeof peakRule.output === "number" ? peakRule.output : offOutput;
  return { offInput, offCache, offOutput, peakInput, peakCache, peakOutput };
}
function priceTier(tokens, rates, tier) {
  const input = tier === "peak" ? rates.peakInput : rates.offInput;
  const cache = tier === "peak" ? rates.peakCache : rates.offCache;
  const output = tier === "peak" ? rates.peakOutput : rates.offOutput;
  return ((tokens.input + tokens.cacheWrite) * input + tokens.cacheRead * cache + tokens.output * output) / 1e6;
}
var tierSide = (tier, side) => ({
  input: tier.input?.[side] || 0,
  output: tier.output?.[side] || 0,
  cacheRead: tier.cacheRead?.[side] || 0,
  cacheWrite: tier.cacheWrite?.[side] || 0
});
function ruleMaps(pricing) {
  const exact = /* @__PURE__ */ new Map();
  const wild = /* @__PURE__ */ new Map();
  for (const rule of Array.isArray(pricing) ? pricing : []) {
    const model = typeof rule?.model === "string" && rule.model !== "" ? rule.model : null;
    if (model === null) continue;
    const provider = typeof rule?.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
    if (provider === "") wild.set(model, rule);
    else exact.set(modelKey(provider, model), rule);
  }
  return { exact, wild };
}
function ruleFor(maps, key) {
  const hit = maps.exact.get(key);
  if (hit !== void 0) return hit;
  return maps.wild.get(splitModelKey(key).model);
}
var DEFAULT_USD_TO_CNY = 6.8;
function costOf(models, pricing, fx = {}, monthly = []) {
  const maps = ruleMaps(pricing);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  let total = 0;
  let converted = 0;
  let configured = false;
  const unpriced = EMPTY_TOKENS();
  for (const row of Array.isArray(models) ? models : []) {
    const key = typeof row?.key === "string" && row.key !== "" ? row.key : modelKey(row?.provider, row?.model);
    const provider = typeof row?.provider === "string" ? row.provider : splitModelKey(key).provider;
    if (monthlySet.has(provider)) {
      configured = true;
      continue;
    }
    const rule = ruleFor(maps, key);
    if (rule === void 0) {
      unpriced.input += row.input + row.cacheRead + row.cacheWrite;
      unpriced.output += row.output;
      continue;
    }
    configured = true;
    const rates = resolveRates(rule);
    const offpeak = row.offpeak ?? row;
    const peak = row.peak ?? EMPTY_TOKENS();
    const native = priceTier(offpeak, rates, "offpeak") + priceTier(peak, rates, "peak");
    if (rule.currency === "USD") {
      const cny = native * usdToCny;
      total += cny;
      converted += cny;
    } else {
      total += native;
    }
  }
  return configured ? {
    configured: true,
    total: Math.round(total * 1e6) / 1e6,
    currency: "CNY",
    usdToCny,
    convertedFromUsd: Math.round(converted * 1e6) / 1e6,
    unpriced
  } : { configured: false, total: null, currency: null, usdToCny, convertedFromUsd: 0, unpriced };
}
function costSeries(sessions, { from, to, project = "", model = "", models: modelsOpt = [], pricing = [], fx = {}, monthly = [], auxShape = null } = {}) {
  const userRules = (Array.isArray(pricing) ? pricing : []).filter((rule) => rule?.inherited !== true);
  const dayRuleMaps = /* @__PURE__ */ new Map();
  const rulesOn = (day) => {
    let maps = dayRuleMaps.get(day);
    if (maps === void 0) {
      maps = ruleMaps([...officialRulesFor(day), ...userRules]);
      dayRuleMaps.set(day, maps);
    }
    return maps;
  };
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  const shape = auxShapeOf(auxShape) ?? AUX_SHAPE;
  const keys = rangeKeys("day", from, to);
  const index = new Map(keys.map((key, i2) => [key, i2]));
  const days = keys.map((key) => ({ key, peak: 0, offpeak: 0 }));
  const modelSet = modelFilterSet(model, modelsOpt);
  const auxVisible = modelSet === null || modelSet.has(AUX_MODEL_KEY);
  const foldAuxDay = (maps, day, idx, aux) => {
    if (!auxVisible) return;
    const usage = auxDayUsage(aux, shape);
    if (usage === null) return;
    const parts = [];
    if (usage.searchTokens !== null) parts.push({ tokens: usage.searchTokens, tier: usage.searchTier, priceAs: AUX_PRICE_AS });
    if (usage.titleTokens !== null) parts.push({ tokens: usage.titleTokens, tier: usage.titleTier, priceAs: usage.titleKey ?? AUX_PRICE_AS });
    for (const part of parts) {
      if (monthlySet.has(splitModelKey(part.priceAs).provider)) continue;
      const rule = ruleFor(maps, part.priceAs);
      if (rule === void 0) continue;
      const rates = resolveRates(rule);
      const conv = rule.currency === "USD" ? usdToCny : 1;
      const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
      if (flatOff) {
        days[idx].offpeak += priceTier(part.tokens, rates, "offpeak") * conv;
      } else {
        days[idx].peak += priceTier(tierSide(part.tier, "peak"), rates, "peak") * conv;
        days[idx].offpeak += priceTier(tierSide(part.tier, "offpeak"), rates, "offpeak") * conv;
      }
    }
  };
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    if (project !== "" && String(record.project ?? "") !== project) continue;
    for (const [day, dayModels] of Object.entries(record.modelsByDay ?? {})) {
      const idx = index.get(day);
      if (idx === void 0 || dayModels === null || typeof dayModels !== "object") continue;
      const maps = rulesOn(day);
      for (const [modelName, tokens] of Object.entries(dayModels)) {
        if (!keyMatchesFilter(modelSet, modelName)) continue;
        if (monthlySet.has(splitModelKey(modelName).provider)) continue;
        const rule = ruleFor(maps, modelName);
        if (rule === void 0) continue;
        const rates = resolveRates(rule);
        const conv = rule.currency === "USD" ? usdToCny : 1;
        const tier = record.tiersByDay?.[day]?.[modelName];
        const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
        if (tier === null || tier === void 0 || flatOff) {
          days[idx].offpeak += priceTier(tokens, rates, "offpeak") * conv;
        } else {
          days[idx].peak += priceTier(tierSide(tier, "peak"), rates, "peak") * conv;
          days[idx].offpeak += priceTier(tierSide(tier, "offpeak"), rates, "offpeak") * conv;
        }
      }
    }
    for (const [day, aux] of Object.entries(record.auxByDay ?? {})) {
      const idx = index.get(day);
      if (idx === void 0) continue;
      foldAuxDay(rulesOn(day), day, idx, aux);
    }
  }
  const round = (v) => Math.round(v * 1e6) / 1e6;
  return days.map((day) => ({ key: day.key, peak: round(day.peak), offpeak: round(day.offpeak) }));
}
function reconcileSeries(sessions, { from, to, pricing = [], fx = {}, monthly = [], auxShape = null, official = [] } = {}) {
  const userRules = (Array.isArray(pricing) ? pricing : []).filter((rule) => rule?.inherited !== true);
  const dayRuleMaps = /* @__PURE__ */ new Map();
  const rulesOn = (day) => {
    let maps = dayRuleMaps.get(day);
    if (maps === void 0) {
      maps = ruleMaps([...officialRulesFor(day), ...userRules]);
      dayRuleMaps.set(day, maps);
    }
    return maps;
  };
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  const shape = auxShapeOf(auxShape) ?? AUX_SHAPE;
  const keys = rangeKeys("day", from, to);
  const index = new Map(keys.map((key, i2) => [key, i2]));
  const days = keys.map((key) => ({ key, est: 0, aux: 0, auxCalls: 0, unpricedTokens: 0 }));
  const priceInto = (day, idx, tokens, tier, priceAs, sink) => {
    if (monthlySet.has(splitModelKey(priceAs).provider)) return;
    const maps = rulesOn(day);
    const rule = ruleFor(maps, priceAs);
    if (rule === void 0) {
      if (sink === "est") {
        days[idx].unpricedTokens += (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0) + (tokens.output || 0);
      }
      return;
    }
    const rates = resolveRates(rule);
    const conv = rule.currency === "USD" ? usdToCny : 1;
    const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
    const cost = flatOff || tier === null || tier === void 0 ? priceTier(tokens, rates, "offpeak") : priceTier(tierSide(tier, "peak"), rates, "peak") + priceTier(tierSide(tier, "offpeak"), rates, "offpeak");
    days[idx][sink] += cost * conv;
  };
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    for (const [day, dayModels] of Object.entries(record.modelsByDay ?? {})) {
      const idx = index.get(day);
      if (idx === void 0 || dayModels === null || typeof dayModels !== "object") continue;
      for (const [modelName, tokens] of Object.entries(dayModels)) {
        if (!isOfficialProvider(splitModelKey(modelName).provider)) continue;
        priceInto(day, idx, tokens, record.tiersByDay?.[day]?.[modelName], modelName, "est");
      }
    }
    for (const [day, aux] of Object.entries(record.auxByDay ?? {})) {
      const idx = index.get(day);
      if (idx === void 0) continue;
      const usage = auxDayUsage(aux, shape);
      if (usage === null) continue;
      days[idx].auxCalls += usage.searchCalls + usage.titleCalls;
      if (usage.searchTokens !== null) priceInto(day, idx, usage.searchTokens, usage.searchTier, AUX_PRICE_AS, "aux");
      if (usage.titleTokens !== null) {
        const key = usage.titleKey ?? AUX_PRICE_AS;
        if (isOfficialProvider(splitModelKey(key).provider)) {
          priceInto(day, idx, usage.titleTokens, usage.titleTier, key, "aux");
        }
      }
    }
  }
  const spendBy = new Map((Array.isArray(official) ? official : []).filter((row) => row !== null && typeof row === "object").map((row) => [row.key, {
    spend: Number.isFinite(row.spend) ? row.spend : null,
    sparse: row.sparse === true
  }]));
  return days.map((day) => {
    const entry = spendBy.get(day.key);
    const officialSpend = entry !== void 0 ? entry.spend : null;
    const gap = officialSpend === null ? null : officialSpend - day.est - day.aux;
    return {
      key: day.key,
      est: Math.round(day.est * 1e6) / 1e6,
      aux: Math.round(day.aux * 1e6) / 1e6,
      official: officialSpend,
      gap: gap === null ? null : Math.round(gap * 1e6) / 1e6,
      auxCalls: day.auxCalls,
      unpriced: day.unpricedTokens > 0,
      sparse: entry !== void 0 && entry.sparse
    };
  });
}
function medianOf(list) {
  const sorted = [...list].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function auxCalibration(rows, { seed = AUX_SHAPE, manual = false, today } = {}) {
  const base = auxShapeOf(seed) ?? AUX_SHAPE;
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row !== null && typeof row === "object" && typeof row.key === "string" && row.official !== null && Number.isFinite(row.official) && today !== void 0 && row.key < today && row.unpriced !== true && row.sparse !== true);
  const control = [];
  const implied = [];
  let divergentDays = 0;
  for (const row of list) {
    const tolerance = Math.max(0.1, row.official * 0.03);
    if (row.auxCalls <= 0) {
      control.push(row);
      if (row.gap !== null && Math.abs(row.gap) > tolerance) divergentDays += 1;
      continue;
    }
    if (row.auxCalls < 3 && row.aux < 0.05) continue;
    if (row.gap === null || row.aux <= 0) continue;
    const s = (row.aux + row.gap) / row.aux;
    if (s >= 0.5 && s <= 3) implied.push(s);
  }
  const medianS = medianOf(implied);
  let status = "insufficient";
  let shape = base;
  if (manual === true) {
    status = "manual";
  } else if (divergentDays > 0) {
    status = "divergent";
  } else if (implied.length >= 3 && medianS !== null && Math.max(...implied) / Math.min(...implied) <= 1.6) {
    status = "calibrated";
    if (Math.abs(medianS - 1) > 0.03) {
      shape = {
        miss: Math.round(base.miss * medianS),
        hit: Math.round(base.hit * medianS),
        out: base.out
      };
    }
  }
  return {
    shape,
    status,
    samples: implied.length,
    medianS: medianS === null ? null : Math.round(medianS * 1e3) / 1e3,
    controlDays: control.length,
    divergentDays,
    checkedDays: list.length
  };
}
function accentHash(id, salt = 14) {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i2 = 0; i2 < id.length; i2 += 1) {
    h ^= id.charCodeAt(i2);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function accentHueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
var VENDOR_ACCENTS = [
  { keys: ["deepseek"], hex: "#4d6bfe", soft: "#00c2d8" },
  { keys: ["claude", "anthropic"], hex: "#d97757", soft: "#e8703a" },
  { keys: ["openai", "chatgpt", "gpt", "davinci", "o1", "o3", "o4"], hex: "#10a37f", soft: "#35c48d" },
  { keys: ["qwen", "qwq", "tongyi"], hex: "#847ace", soft: "#4796e4" },
  { keys: ["glm", "zhipu", "chatglm"], hex: "#2f6bff", soft: "#12b5a5" },
  { keys: ["minimax", "abab"], hex: "#ff3763", soft: "#ff7038" },
  { keys: ["grok", "xai"], hex: "#6e6d66", soft: "#c2c2bc" },
  { keys: ["mimo", "xiaomi"], hex: "#ff6900", soft: "#ffb02e" },
  { keys: ["llama", "meta"], hex: "#0668e1", soft: "#00a2ff" },
  { keys: ["gemini", "google", "gemma"], hex: "#1c69ff", soft: "#8ab4f8" },
  { keys: ["mistral", "mixtral", "codestral", "magistral"], hex: "#ff7000", soft: "#ffc400" },
  { keys: ["kimi", "moonshot", "k3"], hex: "#4b4b52", soft: "#9aa0aa" },
  { keys: ["hunyuan"], hex: "#0052d9", soft: "#26a5e2" },
  { keys: ["doubao", "skylark"], hex: "#4d53e8", soft: "#33c2ff" }
];
function vendorAccentOf(id) {
  const tokens = id.split(/[^a-z0-9]+/);
  return VENDOR_ACCENTS.find((entry) => entry.keys.some((key) => key.length >= 4 ? id.includes(key) : tokens.includes(key))) ?? null;
}
function hexHue(hex) {
  const s = hex.replace("#", "");
  const v = s.length === 3 ? [...s].map((c) => c + c).join("") : s;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function hexRgb(hex) {
  const s = String(hex).replace("#", "");
  const v = s.length === 3 ? [...s].map((c) => c + c).join("") : s.padEnd(6, "0");
  return [0, 2, 4].map((i2) => parseInt(v.slice(i2, i2 + 2), 16) / 255);
}
function srgbToLab(rgb) {
  const lin = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [R, G, B] = [lin(rgb[0]), lin(rgb[1]), lin(rgb[2])];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}
function oklchLab(l, c, hueDeg) {
  const rad = hueDeg * Math.PI / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}
function labToCss(lab) {
  const c = Math.hypot(lab[1], lab[2]);
  const hue = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
  return `oklch(${(lab[0] * 100).toFixed(1)}% ${c.toFixed(3)} ${hue.toFixed(1)})`;
}
function accentLabDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
var VENDOR_ANCHOR_HUES = VENDOR_ACCENTS.flatMap((entry) => [hexHue(entry.hex), hexHue(entry.soft)]);
var ACCENT_FAMILY_SLOTS = 9;
var AUX_ACCENT_HUE = 80;
var stripeCss = (lab) => {
  const dark = [Math.max(0.2, lab[0] - 0.12), lab[1], lab[2]];
  return `repeating-linear-gradient(135deg, ${labToCss(lab)} 0 3px, ${labToCss(dark)} 3px 6px)`;
};
var AUX_ACCENT_LAB = oklchLab(0.68, 0.13, AUX_ACCENT_HUE);
var AUX_ACCENT_CSS = stripeCss(AUX_ACCENT_LAB);
var ACCENT_LUMA_STEPS = [0, 0.055, -0.055, 0.11, -0.11];
var ACCENT_HUE_STEP = 26;
var ACCENT_ANCHOR_KEEP = 24;
var ACCENT_MIN_DISTANCE = 0.07;
function accentSpecOf(id) {
  const key = String(id).toLowerCase();
  if (key === AUX_MODEL_KEY) return { kind: "aux" };
  const vendor = vendorAccentOf(key);
  if (vendor !== null) return { kind: "vendor", vendor, slot: accentHash(key) % ACCENT_FAMILY_SLOTS };
  let hue = accentHash(key) % 360;
  for (let guard = 0; guard < 12 && VENDOR_ANCHOR_HUES.some((h) => accentHueGap(h, hue) < ACCENT_ANCHOR_KEEP); guard += 1) {
    hue = (hue + 137.508) % 360;
  }
  return { kind: "free", hue };
}
var vendorSlotCss = (vendor, slot) => {
  const pct = slot / (ACCENT_FAMILY_SLOTS - 1) * 100;
  return `color-mix(in srgb, ${vendor.hex} ${100 - pct}%, ${vendor.soft} ${pct}%)`;
};
var vendorSlotLab = (vendor, slot) => {
  const t = slot / (ACCENT_FAMILY_SLOTS - 1);
  const a = hexRgb(vendor.hex);
  const b = hexRgb(vendor.soft);
  return srgbToLab([0, 1, 2].map((i2) => a[i2] + (b[i2] - a[i2]) * t));
};
function accentSpecPaint(spec) {
  if (spec.kind === "aux") return { css: AUX_ACCENT_CSS, lab: AUX_ACCENT_LAB };
  if (spec.kind === "vendor") return { css: vendorSlotCss(spec.vendor, spec.slot), lab: vendorSlotLab(spec.vendor, spec.slot) };
  return { css: `oklch(68% 0.13 ${spec.hue.toFixed(1)})`, lab: oklchLab(0.68, 0.13, spec.hue) };
}
function accentCandidates(spec) {
  const out = [];
  const push = (lab, css2, rank) => out.push({ lab, css: css2, rank });
  if (spec.kind === "aux") {
    const paint = accentSpecPaint(spec);
    push(paint.lab, paint.css, 0);
    return out;
  }
  if (spec.kind === "vendor") {
    for (let slot = 0; slot < ACCENT_FAMILY_SLOTS; slot += 1) {
      const base = vendorSlotLab(spec.vendor, slot);
      for (const dL of ACCENT_LUMA_STEPS) {
        const lab = dL === 0 ? base : [base[0] + dL, base[1], base[2]];
        push(lab, dL === 0 ? vendorSlotCss(spec.vendor, slot) : labToCss(lab), Math.abs(slot - spec.slot) + Math.abs(dL) * 10);
      }
    }
  } else {
    for (let lane = 0; lane <= 12; lane += 1) {
      const offset = Math.ceil(lane / 2) * ACCENT_HUE_STEP * (lane % 2 === 0 ? 1 : -1);
      const hue = (spec.hue + offset + 360) % 360;
      for (const dL of ACCENT_LUMA_STEPS) {
        const lab = oklchLab(0.68 + dL, 0.13, hue);
        push(lab, labToCss(lab), lane + Math.abs(dL) * 10);
      }
    }
  }
  out.sort((a, b) => a.rank - b.rank);
  return out;
}
function modelAccentMap(models, overrides, { bw = false } = {}) {
  const colorRe = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  const entries = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of Array.isArray(models) ? models : []) {
    const id = String(row?.model ?? row?.key ?? "");
    if (id === "" || id === "unknown") continue;
    const rawKey = row?.key === void 0 ? "" : String(row.key);
    const provider = typeof row?.provider === "string" ? row.provider : rawKey.includes("\0") ? splitModelKey(rawKey).provider : "";
    const key = rawKey.includes("\0") ? rawKey : modelKey(provider, id);
    if (seen.has(key)) continue;
    seen.add(key);
    const raw = overrides?.[id];
    const custom = typeof raw === "string" && colorRe.test(raw.trim()) ? raw.trim().toLowerCase() : null;
    entries.push({
      key,
      spec: custom === null ? accentSpecOf(id) : null,
      custom,
      customLab: custom === null ? null : srgbToLab(hexRgb(custom))
    });
  }
  const project = (lab) => bw === true ? [lab[0], 0, 0] : lab;
  const placed = [];
  const out = /* @__PURE__ */ new Map();
  const place = (entry, css2, lab, distance) => {
    placed.push(project(lab));
    const paint = bw === true && entry.custom === null ? entry.spec?.kind === "aux" ? stripeCss([lab[0], 0, 0]) : labToCss([lab[0], 0, 0]) : css2;
    out.set(entry.key, {
      fill: paint,
      custom: entry.custom !== null,
      aux: entry.spec?.kind === "aux",
      lab,
      distance
    });
  };
  for (const entry of entries) {
    if (entry.custom !== null) place(entry, entry.custom, entry.customLab, Infinity);
  }
  const aux = entries.filter((entry) => entry.custom === null && entry.spec.kind === "aux");
  for (const entry of aux) {
    const paint = accentSpecPaint(entry.spec);
    const probe = project(paint.lab);
    place(entry, paint.css, paint.lab, placed.reduce((m, lab) => Math.min(m, accentLabDistance(probe, lab)), Infinity));
  }
  const movers = entries.filter((entry) => entry.custom === null && entry.spec.kind !== "aux").sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  for (const entry of movers) {
    let best = null;
    let bestDistance = -1;
    let fallback = null;
    let fallbackDistance = -1;
    for (const candidate of accentCandidates(entry.spec)) {
      const probe = project(candidate.lab);
      const distance = placed.reduce((m, lab) => Math.min(m, accentLabDistance(probe, lab)), Infinity);
      if (distance >= ACCENT_MIN_DISTANCE && best === null) {
        best = candidate;
        bestDistance = distance;
        break;
      }
      if (distance > fallbackDistance + 1e-9) {
        fallbackDistance = distance;
        fallback = candidate;
      }
    }
    const pick = best ?? fallback;
    place(entry, pick.css, pick.lab, best !== null ? bestDistance : fallbackDistance);
  }
  return out;
}
function accentEntryOf(map, provider, model) {
  if (map === void 0 || map === null || typeof map.get !== "function") return void 0;
  const id = String(model ?? "");
  if (id === "") return void 0;
  const route = typeof provider === "string" ? provider : "";
  const composite = map.get(modelKey(route, id));
  if (composite !== void 0) return composite;
  const rolled = map.get(rollupKeyOf(route, id));
  if (rolled !== void 0) return rolled;
  return map.get(id) ?? map.get(modelKey("", id));
}
function rollupModelFamilies(view) {
  if (view === null || typeof view !== "object") return { view: null, modelRoutes: [] };
  const foldRows = /* @__PURE__ */ new Map();
  const familyRows = /* @__PURE__ */ new Map();
  const order = [];
  const sourceRows = Array.isArray(view.models) ? view.models : [];
  for (const row of sourceRows) {
    const rawKey = String(row?.key ?? "");
    const provider = typeof row?.provider === "string" ? row.provider : splitModelKey(rawKey).provider;
    const model = typeof row?.model === "string" ? row.model : splitModelKey(rawKey).model;
    const fold = rollupKeyOf(provider, model);
    const acc = foldRows.get(fold) ?? { ...EMPTY_MODEL_ROW(), key: fold, model, providers: [] };
    addTokens(acc, row);
    addTokens(acc.peak, row.peak ?? EMPTY_TOKENS());
    addTokens(acc.offpeak, row.offpeak ?? EMPTY_TOKENS());
    acc.providers.push(provider);
    foldRows.set(fold, acc);
    const entry = familyRouteOf(provider);
    if (entry !== null) {
      if (!familyRows.has(entry.family)) familyRows.set(entry.family, []);
      familyRows.get(entry.family).push({ ...row, provider, model, family: entry.family });
    }
    if (!order.includes(fold)) order.push(fold);
  }
  const models = order.map((fold) => {
    const acc = foldRows.get(fold);
    const entry = familyRouteOf(acc.providers[0]);
    const provider = entry === null ? acc.providers[0] : entry.routes.find((route) => acc.providers.includes(route)) ?? acc.providers[0];
    return { ...acc, provider, routes: [...new Set(acc.providers)] };
  }).sort((a, b) => b.input + b.output + b.cacheRead - (a.input + a.output + a.cacheRead));
  const foldMatrix = (matrix) => {
    if (!(matrix instanceof Map)) return matrix;
    const out = /* @__PURE__ */ new Map();
    for (const [key, tokens] of matrix) {
      const fold = rollupKeyOf(splitModelKey(key).provider, splitModelKey(key).model);
      const acc = out.get(fold) ?? EMPTY_MODEL_ROW();
      addTokens(acc, tokens);
      addTokens(acc.peak, tokens.peak ?? EMPTY_TOKENS());
      addTokens(acc.offpeak, tokens.offpeak ?? EMPTY_TOKENS());
      out.set(fold, acc);
    }
    return out;
  };
  const modelBuckets = Array.isArray(view.modelBuckets) ? view.modelBuckets.map(foldMatrix) : view.modelBuckets;
  const bucketCosts = Array.isArray(view.bucketCosts) ? view.bucketCosts.map((bucket) => {
    if (bucket === null || typeof bucket !== "object" || !(bucket.byModel instanceof Map)) return bucket;
    const byModel = /* @__PURE__ */ new Map();
    for (const [key, row] of bucket.byModel) {
      const split = splitModelKey(key);
      const fold = rollupKeyOf(split.provider, split.model);
      const acc = byModel.get(fold) ?? { model: split.model, provider: split.provider, priceAs: row?.priceAs, cost: 0 };
      acc.cost += row?.cost || 0;
      byModel.set(fold, acc);
    }
    return { ...bucket, byModel };
  }) : view.bucketCosts;
  const modelRoutes = [];
  for (const [family, rows] of familyRows) {
    if (new Set(rows.map((row) => row.provider)).size < 2) continue;
    for (const row of rows) modelRoutes.push({ family, ...row });
  }
  const knownModels = Array.isArray(view.knownModels) ? [...new Set(view.knownModels.map((key) => rollupKeyOf(splitModelKey(key).provider, splitModelKey(key).model)))].sort() : view.knownModels;
  return { view: { ...view, models, modelBuckets, bucketCosts, knownModels }, modelRoutes };
}
function niceMax(value) {
  if (!(value > 0)) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 5, 10]) {
    if (m * base >= value) return m * base;
  }
  return 10 * base;
}
function fmtCost(total) {
  const v = Number(total) || 0;
  if (v >= 1) return v.toFixed(2);
  return String(Number(v.toPrecision(3)));
}
function moneyParts(total, currency) {
  return currency === "CNY" || currency === null || currency === void 0 ? { text: `\xA5${fmtCost(total)}`, unit: "" } : { text: fmtCost(total), unit: currency };
}
function moneyCny(total) {
  return moneyParts(total, "CNY").text;
}
var PEAK_HOURS_DEFAULT = [9, 10, 11, 14, 15, 16, 17];
var BEIJING_OFFSET_MS = 8 * 36e5;
function tierAtMs(timeMs, peakHours) {
  const hh = new Date(Number(timeMs) + BEIJING_OFFSET_MS).getUTCHours();
  const hours = Array.isArray(peakHours) ? peakHours : PEAK_HOURS_DEFAULT;
  return hours.includes(hh) ? "peak" : "offpeak";
}
function fmtClockMs(timeMs) {
  const d = new Date(Number(timeMs) || 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function sessionModelRows(record) {
  const models = /* @__PURE__ */ new Map();
  for (const [day, dayModels] of Object.entries(record?.modelsByDay ?? {})) {
    if (dayModels === null || typeof dayModels !== "object") continue;
    for (const [modelName, tokens] of Object.entries(dayModels)) {
      const row = models.get(modelName) ?? EMPTY_MODEL_ROW();
      addDayModel(row, tokens, record?.tiersByDay?.[day]?.[modelName]);
      models.set(modelName, row);
    }
  }
  return [...models.entries()].map(([modelName, tokens]) => ({ key: modelName, ...splitModelKey(modelName), ...tokens })).sort((a, b) => b.input + b.output + b.cacheRead - (a.input + a.output + a.cacheRead));
}
function recordTokens(record) {
  const out = EMPTY_TOKENS();
  for (const dayTokens of Object.values(record?.byDay ?? {})) {
    if (dayTokens === null || typeof dayTokens !== "object") continue;
    addTokens(out, dayTokens);
  }
  return out;
}
function foldModelTokens(models) {
  const out = EMPTY_TOKENS();
  for (const row of Array.isArray(models) ? models : []) {
    if (row === null || typeof row !== "object") continue;
    addTokens(out, row);
  }
  return out;
}
function catalogProviders(catalog, modelId) {
  const out = [];
  for (const group of Array.isArray(catalog) ? catalog : []) {
    if (group === null || typeof group !== "object") continue;
    const has = (Array.isArray(group.models) ? group.models : []).some((m) => m !== null && typeof m === "object" && (m.id === modelId || typeof m.name === "string" && m.name === modelId));
    if (!has) continue;
    if (group.provider !== null && group.provider !== void 0 && !out.includes(group.provider)) out.push(group.provider);
  }
  return out;
}
function resolveProviderFor(catalog, modelId, monthlySet) {
  const candidates = catalogProviders(catalog, modelId);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && typeof monthlySet?.has === "function") {
    const monthly = candidates.filter((p) => monthlySet.has(p));
    if (monthly.length === 1) return monthly[0];
  }
  return "";
}
function sessionGroups(sessions, { pricing = [], fx = {}, monthly = [], model = "", models = [], catalog = null } = {}) {
  const modelSet = modelFilterSet(model, models);
  const matchesModel = (row) => keyMatchesFilter(modelSet, row.key ?? modelKey(row.provider, row.model));
  const auxVisible = modelSet === null || modelSet.has(AUX_MODEL_KEY);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const resolveProvider = (row) => row.provider !== "" ? row.provider : resolveProviderFor(catalog, row.model, monthlySet);
  const allMonthly = (rows) => rows.length > 0 && rows.every((m) => monthlySet.has(resolveProvider(m)));
  const byProject = /* @__PURE__ */ new Map();
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    const allModels = sessionModelRows(record);
    const models2 = modelSet === null ? allModels : allModels.filter(matchesModel);
    if (models2.length === 0 && modelSet !== null) continue;
    let auxSearch = 0;
    if (auxVisible) {
      for (const aux of Object.values(record.auxByDay ?? {})) {
        auxSearch += (aux?.search?.peak || 0) + (aux?.search?.offpeak || 0);
      }
    }
    for (const m of models2) if (m.provider === "") m.provider = resolveProvider(m);
    const tokens = modelSet === null ? recordTokens(record) : foldModelTokens(models2);
    const total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
    if (total <= 0 && models2.length === 0) continue;
    const label = record.project === null || record.project === void 0 ? "" : String(record.project);
    let group = byProject.get(label);
    if (group === void 0) {
      group = {
        project: label === "" ? null : label,
        sessions: [],
        mainSessions: 0,
        subagentSessions: 0,
        tokens: EMPTY_TOKENS(),
        subagentTokens: EMPTY_TOKENS(),
        models: [],
        subagentModels: []
      };
      byProject.set(label, group);
    }
    const cost = costOf(models2, pricing, fx, monthly);
    const subagent = record.subagent === true;
    const modelRows = models2.map((m) => ({
      key: m.key,
      provider: m.provider,
      model: m.model,
      tokens: { input: m.input, output: m.output, cacheRead: m.cacheRead, cacheWrite: m.cacheWrite },
      cost: costOf([m], pricing, fx, monthly),
      monthly: monthlySet.has(m.provider)
    }));
    const row = {
      id: record.id ?? null,
      createdAt: record.createdAt ?? null,
      title: record.title ?? null,
      day: record.day ?? null,
      subagent,
      parentSession: record.parentSession ?? null,
      delegationDepth: record.delegationDepth ?? 0,
      tokens,
      cost,
      topModel: models2[0]?.key ?? null,
      monthly: allMonthly(models2),
      modelRows,
      auxSearch
    };
    group.sessions.push(row);
    addTokens(group.tokens, tokens);
    group.models.push(...models2);
    if (subagent) {
      group.subagentSessions += 1;
      addTokens(group.subagentTokens, tokens);
      group.subagentModels.push(...models2);
    } else {
      group.mainSessions += 1;
    }
  }
  const groups = [...byProject.values()].map((g) => ({
    project: g.project,
    sessions: g.sessions,
    mainSessions: g.mainSessions,
    subagentSessions: g.subagentSessions,
    tokens: g.tokens,
    subagentTokens: g.subagentTokens,
    cost: costOf(g.models, pricing, fx, monthly),
    subagentCost: g.subagentSessions > 0 ? costOf(g.subagentModels, pricing, fx, monthly) : null,
    subagentMonthly: g.subagentSessions > 0 ? allMonthly(g.subagentModels) : false,
    total: g.tokens.input + g.tokens.output + g.tokens.cacheRead + g.tokens.cacheWrite
  }));
  return groups.sort((a, b) => b.total - a.total);
}
function breaksSegments(events, breaks, { pricing = [], fx = {}, monthly = [], model = "", models = [], catalog = null } = {}) {
  const modelSet = modelFilterSet(model, models);
  const list = (Array.isArray(events) ? events : []).filter((e) => e !== null && typeof e === "object" && Number.isFinite(e.t) && keyMatchesFilter(modelSet, e.key));
  if (list.length === 0) return [];
  list.sort((a, b) => a.t - b.t);
  const minT = list[0].t;
  const maxT = list[list.length - 1].t;
  const marks = (Array.isArray(breaks) ? breaks : []).filter((t) => Number.isFinite(t) && t > minT && t < maxT).sort((a, b) => a - b).slice(0, 3);
  const bounds = [minT, ...marks, maxT];
  const maps = ruleMaps(pricing);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const segments = [];
  for (let i2 = 0; i2 < bounds.length - 1; i2 += 1) {
    const from = bounds[i2];
    const to = bounds[i2 + 1];
    const last = i2 === bounds.length - 2;
    const models2 = /* @__PURE__ */ new Map();
    const tokens = EMPTY_TOKENS();
    for (const e of list) {
      if (e.t < from) continue;
      if (i2 > 0 && e.t === from) continue;
      if (e.t > to) break;
      const bucket = { input: e.i || 0, output: e.o || 0, cacheRead: e.cr || 0, cacheWrite: e.cw || 0 };
      addTokens(tokens, bucket);
      const row = models2.get(e.key) ?? EMPTY_MODEL_ROW();
      addTokens(row, bucket);
      const rule = ruleFor(maps, e.key);
      addTokens(row[tierAtMs(e.t, rule?.peakHours)], bucket);
      models2.set(e.key, row);
    }
    const modelsArr = [...models2.entries()].map(([modelName, tokens2]) => {
      const row = { key: modelName, ...splitModelKey(modelName), ...tokens2 };
      if (row.provider === "") row.provider = resolveProviderFor(catalog, row.model, monthlySet);
      return row;
    }).sort((a, b) => b.input + b.output + b.cacheRead - (a.input + a.output + a.cacheRead));
    const allMonthly = modelsArr.length > 0 && modelsArr.every((m) => monthlySet.has(m.provider));
    segments.push({ from, to, tokens, cost: costOf(modelsArr, pricing, fx, monthly), models: modelsArr, monthly: allMonthly });
  }
  return segments;
}
function heatmapCells(buckets) {
  const rows = Array.isArray(buckets) ? buckets : [];
  const first = rows[0]?.key;
  if (first === void 0) return { cells: [], weeks: 0, months: [] };
  const [y, m, d] = String(first).split("-").map(Number);
  const offset = (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
  const cells = [];
  for (let i2 = 0; i2 < offset; i2 += 1) cells.push(null);
  const months = [];
  rows.forEach((bucket, i2) => {
    if (i2 === 0 || String(bucket.key).endsWith("-01")) {
      months.push({ col: cells.length, label: monthKey(bucket.key) });
    }
    cells.push(bucket);
  });
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, weeks: cells.length / 7, months };
}
function heatmapLevel(value, max) {
  const v = Number(value) || 0;
  const m = Number(max) || 0;
  if (v <= 0 || m <= 0) return 0;
  const r = v / m;
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.75) return 3;
  return 4;
}
function hourlySeries(sessions, day, { project = "", model = "", models = [] } = {}) {
  const hours = Array.from({ length: 24 }, (_, i2) => ({ key: String(i2).padStart(2, "0"), ...EMPTY_TOKENS() }));
  const modelSet = modelFilterSet(model, models);
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    if (project !== "" && String(record.project ?? "") !== project) continue;
    const dayHours = record.hoursByDay?.[day];
    if (dayHours === null || typeof dayHours !== "object") continue;
    for (const [key, byModel] of Object.entries(dayHours)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx > 23) continue;
      if (byModel === null || typeof byModel !== "object") continue;
      for (const [modelName, tokens] of Object.entries(byModel)) {
        if (!keyMatchesFilter(modelSet, modelName)) continue;
        addTokens(hours[idx], tokens);
      }
    }
  }
  return hours;
}
function hourlyCostSeries(sessions, day, { pricing = [], fx = {}, monthly = [], models = [], project = "" } = {}) {
  const hours = Array.from({ length: 24 }, (_, i2) => ({ key: String(i2).padStart(2, "0"), cost: 0, peak: 0, offpeak: 0 }));
  let unpricedTokens = 0;
  if (typeof day !== "string" || /^\d{4}-\d{2}-\d{2}$/.test(day) === false) return { hours, unpricedTokens };
  const modelSet = modelFilterSet("", models);
  const userRules = (Array.isArray(pricing) ? pricing : []).filter((rule) => rule?.inherited !== true);
  const maps = ruleMaps([...officialRulesFor(day), ...userRules]);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  const dayMs = quotaDayStart(day);
  const priceHour = (idx, modelName, tokens) => {
    const provider = splitModelKey(modelName).provider;
    if (monthlySet.has(provider)) return;
    const rule = ruleFor(maps, modelName);
    if (rule === void 0) {
      unpricedTokens += (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0) + (tokens.output || 0);
      return;
    }
    const rates = resolveRates(rule);
    const conv = rule.currency === "USD" ? usdToCny : 1;
    const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
    const tier = flatOff ? "offpeak" : tierAtMs(dayMs + idx * 36e5 + 18e5, rule.peakHours);
    const cost = priceTier(tokens, rates, tier) * conv;
    hours[idx].cost += cost;
    if (tier === "peak") hours[idx].peak += cost;
    else hours[idx].offpeak += cost;
  };
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    if (project !== "" && String(record.project ?? "") !== project) continue;
    const dayHours = record.hoursByDay?.[day];
    if (dayHours === null || typeof dayHours !== "object") continue;
    for (const [key, byModel] of Object.entries(dayHours)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx > 23) continue;
      if (byModel === null || typeof byModel !== "object") continue;
      for (const [modelName, tokens] of Object.entries(byModel)) {
        if (tokens === null || typeof tokens !== "object") continue;
        if (!keyMatchesFilter(modelSet, modelName)) continue;
        priceHour(idx, modelName, tokens);
      }
    }
  }
  for (const hour of hours) {
    hour.cost = Math.round(hour.cost * 1e6) / 1e6;
    hour.peak = Math.round(hour.peak * 1e6) / 1e6;
    hour.offpeak = Math.round((hour.cost - hour.peak) * 1e6) / 1e6;
  }
  return { hours, unpricedTokens };
}
var QUOTA_DAY_MS = 864e5;
var QUOTA_HOUR_MS = 36e5;
function quotaDayStart(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}
function providerTokensOf(byModel, provider) {
  if (byModel === null || typeof byModel !== "object") return null;
  let acc = null;
  for (const [key, tokens] of Object.entries(byModel)) {
    if (tokens === null || typeof tokens !== "object") continue;
    if (splitModelKey(key).provider !== provider) continue;
    const row = { input: quotaNum(tokens.input), output: quotaNum(tokens.output), cacheRead: quotaNum(tokens.cacheRead), cacheWrite: quotaNum(tokens.cacheWrite) };
    if (row.input + row.output + row.cacheRead + row.cacheWrite <= 0) continue;
    if (acc === null) acc = row;
    else {
      acc.input += row.input;
      acc.output += row.output;
      acc.cacheRead += row.cacheRead;
      acc.cacheWrite += row.cacheWrite;
    }
  }
  return acc;
}
function quotaAddInto(acc, row) {
  acc.input += row.input;
  acc.output += row.output;
  acc.cacheRead += row.cacheRead;
  acc.cacheWrite += row.cacheWrite;
}
var quotaEmpty = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
function quotaNum(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function quotaEachSlice(sessions, fromMs, toMs, provider, visit) {
  const from = Math.floor(Number(fromMs));
  const to = Math.floor(Number(toMs));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    const project = record.project === null || record.project === void 0 ? "" : String(record.project);
    const modelsByDay = record.modelsByDay ?? {};
    const hoursByDay = record.hoursByDay ?? {};
    const days = new Set(Object.keys(modelsByDay));
    for (const day of days) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const startMs = quotaDayStart(day);
      const endMs = startMs + QUOTA_DAY_MS;
      if (endMs <= from || startMs >= to) continue;
      const dayTokens = providerTokensOf(modelsByDay[day], provider);
      if (dayTokens === null) continue;
      if (from <= startMs && to >= endMs) {
        visit(project, dayTokens, 1);
        continue;
      }
      const dayHours = hoursByDay[day];
      if (dayHours !== null && typeof dayHours === "object") {
        let hourAcc = null;
        for (const [hh, byModel] of Object.entries(dayHours)) {
          const hourIdx = Number(hh);
          if (!Number.isInteger(hourIdx) || hourIdx < 0 || hourIdx > 23) continue;
          const hStart = startMs + hourIdx * QUOTA_HOUR_MS;
          if (hStart + QUOTA_HOUR_MS <= from || hStart >= to) continue;
          const part = providerTokensOf(byModel, provider);
          if (part === null) continue;
          if (hourAcc === null) hourAcc = { ...part };
          else quotaAddInto(hourAcc, part);
        }
        if (hourAcc !== null) visit(project, hourAcc, 1);
        continue;
      }
      const overlap = Math.min(to, endMs) - Math.max(from, startMs);
      const frac = Math.max(0, Math.min(1, overlap / QUOTA_DAY_MS));
      if (frac <= 0) continue;
      visit(project, dayTokens, frac);
    }
  }
}
function quotaWindowTokens(sessions, fromMs, toMs, provider) {
  const acc = quotaEmpty();
  quotaEachSlice(sessions, fromMs, toMs, provider, (_project, tokens, weight) => {
    acc.input += tokens.input * weight;
    acc.output += tokens.output * weight;
    acc.cacheRead += tokens.cacheRead * weight;
    acc.cacheWrite += tokens.cacheWrite * weight;
  });
  acc.total = acc.input + acc.output + acc.cacheRead + acc.cacheWrite;
  return acc;
}
function quotaCoverage(series, sessions, provider, bounds = {}) {
  const fromMs = Number(bounds?.fromMs);
  const toMs = Number(bounds?.toMs);
  const hasBounds = Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs;
  const points = (Array.isArray(series) ? series : []).filter((p) => p !== null && typeof p === "object" && p.provider === provider).map((p) => ({ t: quotaNum(p.t), pct: Number(p.pct) })).filter((p) => p.t > 0 && Number.isFinite(p.pct) && p.pct >= 0 && p.pct <= 100).sort((a, b) => a.t - b.t);
  const ratios = [];
  let external = false;
  for (let i2 = 1; i2 < points.length; i2 += 1) {
    const start = points[i2 - 1].t;
    const end = points[i2].t;
    if (hasBounds && (start < fromMs || end > toMs)) continue;
    const deltaPct = points[i2].pct - points[i2 - 1].pct;
    const deltaMs = end - start;
    if (deltaMs < 6e5) continue;
    if (deltaPct <= 0) continue;
    const local = localTokensBetween(sessions, start, end, provider);
    if (local <= 0) {
      if (deltaPct >= 2) external = true;
      continue;
    }
    if (deltaPct >= 1) ratios.push(local / deltaPct);
  }
  if (external) return { state: "external", intervals: ratios.length };
  if (ratios.length >= 2) {
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    return { state: max / min <= 4 ? "ok" : "thin", intervals: ratios.length };
  }
  return { state: "thin", intervals: ratios.length };
}
function localTokensBetween(sessions, fromMs, toMs, provider) {
  return quotaWindowTokens(sessions, fromMs, toMs, provider).total;
}
function quotaProjectAttribution(sessions, fromMs, toMs, provider) {
  const byProject = /* @__PURE__ */ new Map();
  let grand = 0;
  quotaEachSlice(sessions, fromMs, toMs, provider, (project, tokens, weight) => {
    const row = byProject.get(project) ?? { project, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
    row.input += tokens.input * weight;
    row.output += tokens.output * weight;
    row.cacheRead += tokens.cacheRead * weight;
    row.cacheWrite += tokens.cacheWrite * weight;
    row.total = row.input + row.output + row.cacheRead + row.cacheWrite;
    byProject.set(project, row);
    grand += (tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite) * weight;
  });
  return [...byProject.values()].map((row) => ({ ...row, share: grand > 0 ? row.total / grand : 0 })).sort((a, b) => b.total - a.total);
}
function quotaCalibrate(usedPct, localTokens) {
  const pct = Number(usedPct);
  const local = Number(localTokens);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100 || !Number.isFinite(local) || local <= 0) return null;
  const totalEst = local / (pct / 100);
  return { totalEst, remainingEst: Math.max(0, totalEst - local), basisTokens: local };
}
function quotaBurn(points, now = Date.now(), resetsAt = null) {
  void now;
  const list = (Array.isArray(points) ? points : []).map((p) => ({ t: quotaNum(p?.t), pct: Number(p?.pct) })).filter((p) => p.t > 0 && Number.isFinite(p.pct) && p.pct >= 0 && p.pct <= 100).sort((a, b) => a.t - b.t);
  if (list.length < 2) return null;
  const first = list[0];
  const last = list[list.length - 1];
  const hours = (last.t - first.t) / 36e5;
  if (!(hours >= 1 / 6)) return null;
  const perHour = (last.pct - first.pct) / hours;
  const out = { perHour, pct: last.pct, from: first.t, to: last.t };
  if (perHour > 0) out.exhaustsAt = last.t + (100 - last.pct) / perHour * 36e5;
  const reset = Number(resetsAt);
  if (Number.isFinite(reset) && reset > last.t) {
    out.pctAtReset = Math.max(0, Math.min(100, last.pct + perHour * (reset - last.t) / 36e5));
  }
  return out;
}
function quotaMonthlyFee(fee) {
  const amount = Number(fee?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const divisor = { monthly: 1, quarterly: 3, semiannually: 6, annually: 12, yearly: 12 }[fee?.cycle];
  if (divisor === void 0) return null;
  const currency = typeof fee?.currency === "string" && fee.currency !== "" ? fee.currency : "CNY";
  return { monthly: amount / divisor, currency };
}
function quotaFeeShare(fee, projectTokens, totalTokens) {
  const monthly = quotaMonthlyFee(fee);
  const total = Number(totalTokens);
  const part = Number(projectTokens);
  if (monthly === null || !Number.isFinite(total) || total <= 0 || !Number.isFinite(part) || part <= 0) return null;
  return monthly.monthly * (part / total);
}

// src/client/stores.js
function httpError(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
function payloadError(res, body) {
  if (!res.ok || body?.ok !== true) throw new Error(body?.error ?? `HTTP ${res.status}`);
}
var UNPRICED_HINT_TOKENS = 5e3;
function fmtTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return String(Math.round(v));
}
function fmtClock(ms) {
  const d = new Date(Number(ms) || 0);
  const p = (x) => String(x).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fill(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (_, key) => key in vars ? String(vars[key]) : `{${key}}`);
}
var RANGE_PRESETS = { "1": 1, "7": 7, "30": 30, "90": 90, "365": 365 };
var statsState = { key: null, from: null, to: null, status: "loading", data: null, error: null, busy: false };
var statsSeq = 0;
var statsAbort = null;
var statsListeners = /* @__PURE__ */ new Set();
var PAYLOAD_CACHE_MS = 6e4;
var EMPTY_RETRY_FIRST_MS = 1200;
var EMPTY_RETRY_BACKOFF_MS = 4e3;
var EMPTY_RETRY_MAX = 8;
var statsEmptyAttempts = 0;
var payloadCache = /* @__PURE__ */ new Map();
var statsRetry = null;
function setStatsState(next) {
  statsState = next;
  for (const listener of statsListeners) listener();
}
function subscribeStats(listener) {
  statsListeners.add(listener);
  return () => {
    statsListeners.delete(listener);
  };
}
function isCachable(data) {
  return Array.isArray(data?.sessions) && data.sessions.length > 0;
}
function scheduleEmptyRetry(from, to) {
  if (statsRetry !== null) return;
  if (statsEmptyAttempts >= EMPTY_RETRY_MAX) return;
  const delay = statsEmptyAttempts === 0 ? EMPTY_RETRY_FIRST_MS : EMPTY_RETRY_BACKOFF_MS;
  statsEmptyAttempts += 1;
  statsRetry = setTimeout(() => {
    statsRetry = null;
    if (statsState.status === "error") return;
    const data = statsState.data;
    if (data !== null && Array.isArray(data.sessions) && data.sessions.length > 0) {
      statsEmptyAttempts = 0;
      return;
    }
    loadStats(statsState.from ?? from, statsState.to ?? to);
  }, delay);
}
function loadStats(from, to) {
  const seq = ++statsSeq;
  const key = `${from}:${to}`;
  if (statsAbort !== null) statsAbort.abort();
  statsAbort = new AbortController();
  const entry = payloadCache.get(key);
  const cached = entry !== void 0 && Date.now() - entry.at < PAYLOAD_CACHE_MS ? entry.payload : void 0;
  if (entry !== void 0 && cached === void 0) payloadCache.delete(key);
  setStatsState({
    ...statsState,
    key,
    from,
    to,
    status: cached !== void 0 ? "ready" : statsState.data === null ? "loading" : "ready",
    data: cached !== void 0 ? cached : statsState.data,
    busy: true,
    error: null
  });
  fetch(`/pulse/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal: statsAbort.signal
  }).then(async (res) => {
    httpError(res);
    const data = await res.json();
    if (data?.schema !== 4 && data?.schema !== 3 && data?.schema !== 2) throw new Error("unexpected payload schema");
    if (seq !== statsSeq) return;
    if (isCachable(data)) {
      statsEmptyAttempts = 0;
      payloadCache.delete(key);
      payloadCache.set(key, { at: Date.now(), payload: data });
      while (payloadCache.size > 4) payloadCache.delete(payloadCache.keys().next().value);
    } else {
      payloadCache.delete(key);
    }
    setStatsState({ key, from, to, status: "ready", data, error: null, busy: false });
    if (!isCachable(data)) scheduleEmptyRetry(from, to);
  }).catch((error) => {
    if (seq !== statsSeq) return;
    setStatsState({ ...statsState, key, from, to, status: "error", error: String(error?.message ?? error), busy: false });
  });
}
function usePulseStats(from, to) {
  const state = (0, import_react.useSyncExternalStore)(subscribeStats, () => statsState);
  const key = `${from}:${to}`;
  (0, import_react.useEffect)(() => {
    if (statsState.key !== key || statsState.status === "error") loadStats(from, to);
  }, [key, from, to]);
  return { ...state, reload: () => loadStats(from, to) };
}
var BALANCE_EVENT = "pulse:balance";
function publishBalance(data) {
  try {
    window.dispatchEvent(new CustomEvent(BALANCE_EVENT, { detail: data }));
  } catch {
  }
}
var BALANCE_POLL_MS = 6e4;
function useBalance(enabled = true) {
  const [state, setState] = (0, import_react.useState)({ data: null, busy: false, error: null });
  const seq = (0, import_react.useRef)(0);
  const load = (refresh) => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, busy: true }));
    fetch(`/pulse/balance${refresh === true ? "?refresh=1" : ""}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" }
    }).then(async (res) => {
      httpError(res);
      return res.json();
    }).then((data) => {
      if (mine === seq.current) setState({ data, busy: false, error: null });
      publishBalance(data);
    }).catch((error) => {
      if (mine === seq.current) setState({ data: null, busy: false, error: String(error?.message ?? error) });
    });
  };
  (0, import_react.useEffect)(() => {
    if (!enabled) return void 0;
    load();
    const onPeer = (e) => {
      if (!e.detail) return;
      seq.current += 1;
      setState({ data: e.detail, busy: false, error: null });
    };
    const poll = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(poll, BALANCE_POLL_MS);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener(BALANCE_EVENT, onPeer);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener(BALANCE_EVENT, onPeer);
    };
  }, [enabled]);
  return { ...state, refresh: () => load(true) };
}
var QUOTA_EVENT = "dsh-pulse:quota";
var QUOTA_POLL_MS = 6e4;
function publishQuota(data) {
  try {
    window.dispatchEvent(new CustomEvent(QUOTA_EVENT, { detail: data }));
  } catch {
  }
}
function useQuota(enabled = true) {
  const [state, setState] = (0, import_react.useState)({ data: null, busy: false, error: null });
  const seq = (0, import_react.useRef)(0);
  const load = (refresh) => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, busy: true }));
    fetch(`/pulse/quota${refresh === true ? "?refresh=1" : ""}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" }
    }).then(async (res) => {
      httpError(res);
      return res.json();
    }).then((data) => {
      if (mine === seq.current) setState({ data, busy: false, error: null });
      publishQuota(data);
    }).catch((error) => {
      if (mine === seq.current) setState((s) => ({ ...s, busy: false, error: String(error?.message ?? error) }));
    });
  };
  (0, import_react.useEffect)(() => {
    if (!enabled) return void 0;
    load();
    const onPeer = (e) => {
      if (!e.detail) return;
      seq.current += 1;
      setState({ data: e.detail, busy: false, error: null });
    };
    const poll = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(poll, QUOTA_POLL_MS);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener(QUOTA_EVENT, onPeer);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener(QUOTA_EVENT, onPeer);
    };
  }, [enabled]);
  return { ...state, refresh: () => load(true) };
}
var SETTINGS_CACHE_MS = 3e4;
var settingsCache = { at: 0, value: null, inflight: null };
function fetchSettings(force = false) {
  if (settingsCache.inflight !== null) return settingsCache.inflight;
  if (!force && settingsCache.value !== null && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) {
    return Promise.resolve(settingsCache.value);
  }
  settingsCache.inflight = fetch("/pulse/settings", { credentials: "same-origin", headers: { accept: "application/json" } }).then((res) => {
    httpError(res);
    return res.json();
  }).then((data) => {
    settingsCache.value = data;
    settingsCache.at = Date.now();
    return data;
  }).finally(() => {
    settingsCache.inflight = null;
  });
  return settingsCache.inflight;
}
function invalidateSettings() {
  settingsCache.value = null;
  settingsCache.at = 0;
}
var PANELS_STORAGE = "dsh-pulse:panels";
var PANEL_DEFAULTS = {
  chips: true,
  balance: true,
  trend: true,
  cache: true,
  models: true,
  projects: true,
  cost: true,
  budget: true,
  footBalance: true,
  sessions: true,
  costTrend: true,
  quota: true
};
function loadPanels() {
  try {
    const raw = localStorage.getItem(PANELS_STORAGE);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object") return { ...PANEL_DEFAULTS, ...parsed };
    }
  } catch (error) {
  }
  return { ...PANEL_DEFAULTS };
}
function savePanels(panels) {
  try {
    localStorage.setItem(PANELS_STORAGE, JSON.stringify(panels));
  } catch (error) {
  }
  for (const listener of [...panelsListeners]) listener(panels);
}
var panelsListeners = /* @__PURE__ */ new Set();
function subscribePanels(listener) {
  panelsListeners.add(listener);
  return () => panelsListeners.delete(listener);
}
var TREND_STACK_STORAGE = "dsh-pulse:trend-stack";
function loadTrendStack() {
  try {
    return localStorage.getItem(TREND_STACK_STORAGE) === "model" ? "model" : "type";
  } catch {
    return "type";
  }
}
var COST_STACK_STORAGE = "dsh-pulse:cost-stack";
function loadCostStack() {
  try {
    return localStorage.getItem(COST_STACK_STORAGE) === "model" ? "model" : "tiers";
  } catch {
    return "tiers";
  }
}
var THEME_STORAGE = "dsh-pulse:theme";
var THEMES = ["blue", "pink", "orange", "bw"];
function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE);
    if (raw !== null) {
      if (THEMES.includes(raw)) return raw;
    }
  } catch (error) {
  }
  return "blue";
}
var themeListeners = /* @__PURE__ */ new Set();
function subscribeTheme(listener) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}
var overlayState = { open: false, mode: "full", focus: null };
var overlayListeners = /* @__PURE__ */ new Set();
var publishOverlay = (next) => {
  overlayState = next;
  for (const listener of overlayListeners) listener(next);
};
function openOverlay(mode, focus = null) {
  if (overlayState.open && overlayState.mode === mode && overlayState.focus === focus) return;
  publishOverlay({ open: true, mode, focus });
}
function setOverlayOpen(value) {
  if (overlayState.open === value) return;
  publishOverlay({ ...overlayState, open: value });
}
function subscribeOverlay(listener) {
  overlayListeners.add(listener);
  return () => {
    overlayListeners.delete(listener);
  };
}
function catalogNames(catalog, keys = []) {
  const names = /* @__PURE__ */ new Map();
  const byId = /* @__PURE__ */ new Map();
  const byIdLower = /* @__PURE__ */ new Map();
  const providerName = /* @__PURE__ */ new Map();
  for (const group of Array.isArray(catalog) ? catalog : []) {
    const pid = group.provider ?? "";
    providerName.set(pid, group.displayName || pid);
    for (const model of Array.isArray(group.models) ? group.models : []) {
      if (typeof model?.id !== "string" || model.id === "") continue;
      const name = model.name && model.name !== "" ? model.name : model.id;
      names.set(modelKey(pid, model.id), name);
      if (!byId.has(model.id)) byId.set(model.id, name);
      const idLower = model.id.toLowerCase();
      if (!byIdLower.has(idLower)) byIdLower.set(idLower, name);
    }
  }
  const nameProviders = /* @__PURE__ */ new Map();
  for (const [key, name] of names) {
    const { provider } = splitModelKey(key);
    if (provider === "") continue;
    let set = nameProviders.get(name);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      nameProviders.set(name, set);
    }
    set.add(provider);
  }
  const ambiguous = /* @__PURE__ */ new Set();
  for (const [name, set] of nameProviders) if (set.size > 1) ambiguous.add(name);
  const idProviders = /* @__PURE__ */ new Map();
  for (const key of keys) {
    const { provider, model } = splitModelKey(key);
    if (provider === "" || names.has(key)) continue;
    let set = idProviders.get(model);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      idProviders.set(model, set);
    }
    set.add(provider);
    if (set.size > 1) ambiguous.add(model);
  }
  const displayNameOf = (provider, model) => {
    const p = typeof provider === "string" ? provider : "";
    if (p !== "") {
      const hit2 = names.get(modelKey(p, model));
      if (hit2 !== void 0) return hit2;
    }
    const hit = byId.get(model);
    if (hit !== void 0) return hit;
    const lower = byIdLower.get(String(model).toLowerCase());
    if (lower !== void 0) return lower;
    return model;
  };
  const labelOf = (provider, model) => {
    const p = typeof provider === "string" ? provider : "";
    const name = displayNameOf(p, model);
    if (p === "" || !ambiguous.has(name)) return name;
    return `${providerLabelOf(p, providerName.get(p) || p)} \xB7 ${name}`;
  };
  const fullLabelOf = (provider, model) => {
    const p = typeof provider === "string" ? provider : "";
    const name = displayNameOf(p, model);
    if (p === "") return name;
    return `${providerLabelOf(p, providerName.get(p) || p)} \xB7 ${name}`;
  };
  return { displayNameOf, labelOf, fullLabelOf };
}
var catalogPromise = null;
function fetchCatalog() {
  if (catalogPromise === null) {
    catalogPromise = fetchSettings().then((data) => Array.isArray(data.catalog) ? data.catalog : []).catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}
function useCatalog() {
  const [catalog, setCatalog] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    let alive = true;
    fetchCatalog().then((list) => {
      if (alive) setCatalog(list);
    }).catch(() => {
      if (alive) setCatalog([]);
    });
    return () => {
      alive = false;
    };
  }, []);
  return catalog === null ? [] : catalog;
}

// src/client/adapter.js
var primitivesModule = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);
var LEGACY_ICON_ALIASES = {
  IconChevronDownOutline14: "IconChevronDownOutlineMedium",
  IconChevronUpOutline14: "IconChevronUpOutlineMedium",
  IconClockOutline16: "IconClockOutlineMedium",
  IconCloseOutline16: "IconCloseOutlineMedium",
  IconDataOutline16: "IconDataOutlineMedium",
  IconRefreshOutline16: "IconRefreshOutlineMedium",
  IconSearchOutline16: "IconSearchOutlineMedium",
  IconWarningOutline16: "IconWarningOutlineMedium"
};
var noopIcon = () => null;
var primitives = new Proxy(primitivesModule, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(LEGACY_ICON_ALIASES, prop)) {
      const modern = target[LEGACY_ICON_ALIASES[prop]];
      return modern !== void 0 ? modern : noopIcon;
    }
    return void 0;
  }
});
var TooltipPrim = primitives.Tooltip ?? null;
var HoverCardPrim = primitives.HoverCard ?? null;
var relativeTimePrim = primitives.relativeTime ?? null;
var defineStore = globalThis.__dshPulseHost?.defineStore ?? null;
var createPortal = globalThis.__dshPulseHost?.reactDom?.createPortal ?? null;
function Seg({ id, value, options, onChange, label, className }) {
  const Official = primitives.SegmentedControl;
  if (typeof Official === "function") {
    return (0, import_jsx_runtime.jsx)(Official, { id, value, options, onChange, label, className });
  }
  return (0, import_jsx_runtime.jsx)("div", {
    className: className ? `dp_seg ${className}` : "dp_seg",
    role: "group",
    "aria-label": label,
    children: options.map((option) => (0, import_jsx_runtime.jsx)("button", {
      type: "button",
      className: `dp_segBtn${option.value === value ? " dp_segBtnActive" : ""}`,
      disabled: option.disabled === true,
      onClick: () => onChange(option.value),
      "aria-pressed": option.value === value,
      children: option.label
    }, option.value))
  });
}
function Btn({ variant = "ghost", size = "md", icon, className, fallbackClass = "", children, ...rest }) {
  const Official = primitives.Button;
  if (typeof Official === "function") {
    return (0, import_jsx_runtime.jsx)(Official, { variant, size, icon, className, ...rest, children });
  }
  return (0, import_jsx_runtime.jsx)("button", {
    type: "button",
    className: fallbackClass || className,
    ...rest,
    children: icon !== void 0 && icon !== null ? icon : children
  });
}
function PillBtn({ active = false, fallbackClass = "dp_miniBtn", fallbackActiveClass = "dp_miniBtnOn", className, children, ...rest }) {
  const Official = primitives.Pill;
  if (typeof Official === "function") {
    return (0, import_jsx_runtime.jsx)(Official, { active, className, ...rest, children });
  }
  return (0, import_jsx_runtime.jsx)("button", {
    type: "button",
    className: `${fallbackClass}${active ? ` ${fallbackActiveClass}` : ""}`,
    "aria-pressed": active,
    ...rest,
    children
  });
}
function Tag({ tone = "outline", fallbackClass = "dp_sessBadge", className, children }) {
  const Official = primitives.Tag;
  if (typeof Official === "function") return (0, import_jsx_runtime.jsx)(Official, { tone, className, children });
  return (0, import_jsx_runtime.jsx)("span", { className: fallbackClass, children });
}
function Switch({ checked, onChange, label, disabled, title, className }) {
  const Official = primitives.Switch;
  if (typeof Official === "function") {
    return (0, import_jsx_runtime.jsx)(Official, { checked, onChange, label, disabled, title, className });
  }
  return (0, import_jsx_runtime.jsx)("input", {
    type: "checkbox",
    className: className ?? "dp_setSwitchBox",
    checked,
    disabled,
    title,
    "aria-label": label,
    onChange: (e) => onChange(e.target.checked)
  });
}
function Checkbox({ checked, onChange, label, disabled, title, className }) {
  const Official = primitives.Checkbox;
  if (typeof Official === "function") {
    return (0, import_jsx_runtime.jsx)(Official, { checked, onChange, label, disabled, title, className });
  }
  return (0, import_jsx_runtime.jsxs)("label", {
    className,
    children: [
      (0, import_jsx_runtime.jsx)("input", {
        type: "checkbox",
        checked,
        disabled,
        title,
        onChange: (e) => onChange(e.target.checked)
      }),
      (0, import_jsx_runtime.jsx)("span", { children: label })
    ]
  });
}
function Input({ className, icon, ...rest }) {
  const Official = primitives.Input;
  if (typeof Official === "function") {
    return (0, import_jsx_runtime.jsx)(Official, { className, icon, ...rest });
  }
  return (0, import_jsx_runtime.jsx)("input", { className, ...rest });
}
var noPosition = () => null;
var noMaxHeight = () => 0;
var noDismiss = () => {
};
function floatReady() {
  return typeof primitives.MenuSurface === "function" && typeof primitives.useAnchoredPosition === "function" && typeof primitives.useDismissOnOutsidePointer === "function" && createPortal !== null;
}
function Float({ open, onClose, rootRef, anchorRef, children, align = "start", gap = 6, maxHeight = 320 }) {
  const panelRef = (0, import_react.useRef)(null);
  const position = (primitives.useAnchoredPosition ?? noPosition)({ open, anchorRef, panelRef, side: "bottom", align, gap, margin: 8 });
  const cap = (primitives.useAnchoredMaxHeight ?? noMaxHeight)(panelRef, maxHeight, open);
  (primitives.useDismissOnOutsidePointer ?? noDismiss)(rootRef, open && floatReady(), onClose, panelRef);
  if (!open || !floatReady() || position === null) return null;
  return createPortal((0, import_jsx_runtime.jsx)(primitives.MenuSurface, {
    ref: panelRef,
    className: "dp_floatPanel",
    style: { ...position, maxHeight: cap > 0 ? cap : void 0 },
    children
  }), document.body);
}

// src/client/dashboard.js
function BudgetCard({ t }) {
  const [budget, setBudget] = (0, import_react.useState)(() => {
    try {
      const raw = localStorage.getItem("dsh-pulse:budget");
      const v = raw === null ? null : Number(raw);
      return v !== null && Number.isFinite(v) && v > 0 ? v : null;
    } catch (error) {
      return null;
    }
  });
  const [mode, setMode] = (0, import_react.useState)(() => {
    try {
      const raw = localStorage.getItem("dsh-pulse:budget-days-mode");
      return raw === "weekdays" || raw === "single" ? raw : "all";
    } catch (error) {
      return "all";
    }
  });
  const [month, setMonth] = (0, import_react.useState)({ status: "loading", used: null, from: null, to: null, totalDays: 0, error: null });
  (0, import_react.useEffect)(() => {
    const today = localDay(Date.now());
    const from = `${today.slice(0, 8)}01`;
    let cancelled = false;
    fetch(`/pulse/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(today)}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" }
    }).then(async (res) => {
      httpError(res);
      return res.json();
    }).then((payload) => {
      if (cancelled) return;
      const fromDay = typeof payload?.fromDay === "string" ? payload.fromDay : from;
      const toDay = typeof payload?.toDay === "string" ? payload.toDay : today;
      const view = buildView(Array.isArray(payload?.sessions) ? payload.sessions : [], {
        granularity: "day",
        from: fromDay,
        to: toDay,
        pricing: payload.pricing,
        fx: payload.fx,
        auxShape: payload?.auxShape ?? null
      });
      const used2 = view.cost?.configured === true && Number.isFinite(view.cost.total) ? view.cost.total : null;
      const totalDays = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
      setMonth({ status: "ready", used: used2, from: fromDay, to: toDay, totalDays, error: null });
    }).catch((error) => {
      if (!cancelled) setMonth((s) => ({ ...s, status: "error", error: String(error?.message ?? error) }));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const onBudget = (value) => {
    const v = value === "" ? null : Number(value);
    const next = v !== null && Number.isFinite(v) && v > 0 ? v : null;
    setBudget(next);
    try {
      if (next === null) localStorage.removeItem("dsh-pulse:budget");
      else localStorage.setItem("dsh-pulse:budget", String(next));
    } catch (error) {
    }
  };
  const onMode = (next) => {
    setMode(next);
    try {
      localStorage.setItem("dsh-pulse:budget-days-mode", next);
    } catch (error) {
    }
  };
  const isWorkDay = (day) => {
    const [y, m, d] = String(day).split("-").map(Number);
    const dow = (new Date(y, m - 1, d, 12).getDay() + 6) % 7;
    if (mode === "weekdays") return dow < 5;
    if (mode === "single") return dow !== 6;
    return true;
  };
  const countWorkDays = (from, to) => {
    let n = 0;
    for (let d = String(from); d <= String(to); d = shiftDay(d, 1)) {
      if (isWorkDay(d)) n += 1;
    }
    return n;
  };
  const used = month.used;
  const over = budget !== null && used !== null && used > budget;
  const pct = budget !== null && used !== null && budget > 0 ? Math.min(100, used / budget * 100) : 0;
  const workDays = used !== null && month.from !== null ? countWorkDays(month.from, month.to) : 0;
  const avg = used !== null && workDays > 0 ? used / workDays : null;
  const remaining = used !== null && month.to !== null ? countWorkDays(shiftDay(month.to, 1), `${month.to.slice(0, 8)}${String(month.totalDays).padStart(2, "0")}`) : 0;
  const forecast = used !== null && avg !== null ? used + avg * remaining : null;
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_balanceBar dp_budgetBar", children: [
    (0, import_jsx_runtime.jsx)("span", { className: "dp_balanceLabel", children: t("budgetTitle") }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_budgetInputRow", children: [
      (0, import_jsx_runtime.jsx)(Input, {
        className: "dp_budgetInput",
        inputMode: "decimal",
        placeholder: t("budgetSet"),
        value: budget === null ? "" : String(budget),
        onChange: (e) => onBudget(e.target.value)
      }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_balanceLabel", children: "CNY" })
    ] }),
    (0, import_jsx_runtime.jsx)(Seg, {
      id: "pulse-budget-mode",
      value: mode,
      options: [
        { value: "all", label: t("budgetModeAll") },
        { value: "weekdays", label: t("budgetModeWeekdays") },
        { value: "single", label: t("budgetModeSingle") }
      ],
      onChange: onMode,
      label: t("budgetModeLabel")
    }),
    over && (0, import_jsx_runtime.jsx)("span", { className: "dp_balanceWarn", children: t("budgetOver") }),
    budget !== null && used !== null && (0, import_jsx_runtime.jsx)("div", { className: "dp_budgetTrack", children: (0, import_jsx_runtime.jsx)("div", { className: `dp_budgetFill${over ? " dp_budgetFillOver" : ""}`, style: { width: `${pct}%` } }) }),
    month.status === "error" ? (0, import_jsx_runtime.jsx)("span", { className: "dp_balanceSub", children: fill(t("setFailed"), { err: month.error }) }) : budget === null ? (0, import_jsx_runtime.jsx)("span", { className: "dp_balanceSub", children: t("budgetEmpty") }) : used === null ? (0, import_jsx_runtime.jsx)("span", { className: "dp_balanceSub", children: t("costOff") }) : (0, import_jsx_runtime.jsxs)("span", { className: "dp_balanceSub", children: [
      `${t("budgetUsed")} ${fmtCost(used)} / ${fmtCost(budget)} (${Math.round(pct)}%)`,
      avg !== null ? ` \xB7 ${fill(t("budgetAvg"), { v: fmtCost(avg) })}` : "",
      forecast !== null ? ` \xB7 ${t("budgetForecast")} ${fmtCost(forecast)}` : "",
      ` \xB7 ${fill(t("budgetLeftDays"), { n: remaining })}`
    ] })
  ] });
}

// src/client/quota.js
var quotaDur = (ms, t) => {
  const minutes = Math.max(1, Math.round(ms / 6e4));
  if (minutes < 60) return fill(t("quotaDurMin"), { n: minutes });
  const hours = ms / 36e5;
  if (hours < 48) return fill(t("quotaDurHour"), { n: Math.round(hours) });
  return fill(t("quotaDurDay"), { n: Math.max(1, Math.round(ms / 864e5)) });
};
var quotaWindowLabel = (id, t) => id === "5h" ? t("quotaWindow5h") : id === "7d" || id === "week" ? t("quotaWindow7d") : id === "month" ? t("quotaWindowMonth") : `${t("quotaWindowGeneric")} ${id}`;
var quotaWindowCls = (pct) => pct === null ? "dp_qwFill" : pct >= 90 ? "dp_qwFill dp_qwFillHot" : pct >= 70 ? "dp_qwFill dp_qwFillWarm" : "dp_qwFill";
var quotaMoney = (value, currency) => {
  const money = moneyParts(value, currency);
  return money.unit === "" ? money.text : `${money.text} ${money.unit}`;
};
var quotaEntryName = (entry) => entry.plan?.name ?? entry.label ?? entry.displayName ?? entry.provider;
function quotaRankEntries(entries, sessions, now) {
  const dayStart = new Date(now);
  const todayFrom = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate()).getTime();
  return entries.map((entry) => ({
    entry,
    today: sessions.length > 0 ? quotaWindowTokens(sessions, todayFrom, now, entry.provider).total : 0,
    pct: (Array.isArray(entry.windows) ? entry.windows : []).find((w) => w.id === "7d")?.usedPct ?? 0
  })).sort((a, b) => b.today - a.today || b.pct - a.pct).map((row) => row.entry);
}
function QuotaPanel({ quota, data, t }) {
  const providers = (Array.isArray(quota.data?.providers) ? quota.data.providers : []).filter((entry) => entry.ok === true);
  const [providerId, setProviderId] = (0, import_react.useState)(null);
  const [range, setRange] = (0, import_react.useState)("week");
  const now = Date.now();
  const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
  const series = Array.isArray(quota.data?.series) ? quota.data.series : [];
  const ranked = quotaRankEntries(providers, sessions, now);
  const active = providers.find((entry) => entry.provider === providerId) ?? ranked[0] ?? null;
  const fee = active !== null ? quotaMonthlyFee(active.fee) : null;
  const boundsFrom = typeof data?.fromDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.fromDay) ? quotaDayStart(data.fromDay) : void 0;
  const boundsTo = typeof data?.toDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.toDay) ? quotaDayStart(data.toDay) + 864e5 : void 0;
  const coverage = active !== null ? quotaCoverage(series, sessions, active.provider, { fromMs: boundsFrom, toMs: boundsTo }) : { state: "thin", intervals: 0 };
  const weekly = active?.windows?.find((w) => w.id === "7d") ?? active?.windows?.[0] ?? null;
  const weekFrom = weekly !== null && weekly.windowMs !== null && weekly.windowMs !== void 0 ? (weekly.resetsAt ?? now) - weekly.windowMs : now - 7 * 864e5;
  const monthStart = new Date(now);
  const monthFrom = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1).getTime();
  const from = range === "month" ? monthFrom : weekFrom;
  const attribution = (0, import_react.useMemo)(
    () => active === null || sessions.length === 0 ? [] : quotaProjectAttribution(sessions, from, now, active.provider),
    [active?.provider, from, now, sessions]
  );
  const grandTotal = attribution.reduce((sum, row) => sum + row.total, 0);
  if (active === null) {
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_quotaPanel", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_estCard", children: [
        (0, import_jsx_runtime.jsx)("div", { className: "dp_cardHead", children: (0, import_jsx_runtime.jsx)("span", { className: "dp_cardLabel", children: t("quotaTitle") }) }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("quotaEmpty") })
      ] })
    ] });
  }
  const providerSwitch = providers.length > 1 && (0, import_jsx_runtime.jsx)(Seg, {
    id: "pulse-quota-provider",
    value: active.provider,
    options: providers.map((entry) => ({ value: entry.provider, label: quotaEntryName(entry) })),
    onChange: setProviderId,
    label: t("quotaProviderLabel")
  });
  const planLine = (0, import_jsx_runtime.jsxs)("div", { className: "dp_qPlanBlock", children: [
    (0, import_jsx_runtime.jsxs)("span", { className: "dp_qPlanName", children: [
      active.plan?.name ?? active.displayName ?? active.provider,
      active.plan?.level !== null && active.plan?.level !== void 0 && active.plan?.level !== active.plan?.name ? ` \xB7 ${active.plan.level}` : ""
    ] }),
    active.plan?.renewsAt !== null && active.plan?.renewsAt !== void 0 || fee !== null ? (0, import_jsx_runtime.jsxs)("span", { className: "dp_qPlanSub", children: [
      active.plan?.renewsAt ? fill(t("quotaPlanRenew"), { d: String(active.plan.renewsAt).slice(0, 10) }) : "",
      active.plan?.renewsAt && fee !== null ? " \xB7 " : "",
      fee !== null ? `${quotaMoney(fee.monthly, fee.currency)}${t("quotaPerMonth")}` : ""
    ] }) : null
  ] });
  const windowRows = (Array.isArray(active.windows) ? active.windows : []).map((w) => {
    const windowMs = w.windowMs ?? (w.id === "5h" ? 5 * 36e5 : w.id === "7d" ? 7 * 864e5 : 7 * 864e5);
    const winFrom = w.resetsAt !== null && w.resetsAt !== void 0 ? w.resetsAt - windowMs : now - windowMs;
    const local = sessions.length > 0 ? quotaWindowTokens(sessions, winFrom, now, active.provider) : { total: 0 };
    const cal = coverage.state !== "external" && w.kind === "tokens" ? quotaCalibrate(w.usedPct, local.total) : null;
    const burn = quotaBurn(series.filter((p) => p.provider === active.provider && p.window === w.id), now, w.resetsAt ?? null);
    const usedText = w.used !== null && w.used !== void 0 && w.total !== null && w.total !== void 0 ? `${w.used}/${w.total} ${t("quotaKindRequests")}` : null;
    const resetText = w.resetsAt !== null && w.resetsAt !== void 0 && w.resetsAt > now ? fill(t("quotaResetIn"), { v: quotaDur(w.resetsAt - now, t) }) : null;
    const estParts = [];
    if (cal !== null) {
      estParts.push((0, import_jsx_runtime.jsxs)("span", { className: "dp_qCal", title: [t("quotaScopeNote"), fill(t("quotaCalBasis"), { v: fmtTokens(cal.basisTokens) }), coverage.state === "ok" ? fill(t("quotaScopeStable"), { n: coverage.intervals }) : t("quotaScopeThin")].join("\n"), children: [
        fill(t("quotaCalTotal"), { v: fmtTokens(cal.totalEst) }),
        " \xB7 ",
        fill(t("quotaCalRemain"), { v: fmtTokens(cal.remainingEst) })
      ] }, "cal"));
    }
    if (burn !== null) {
      estParts.push((0, import_jsx_runtime.jsx)("span", { children: burn.perHour > 0 ? fill(t("quotaBurnRate"), { v: `${burn.perHour.toFixed(1)}%` }) : t("quotaBurnFlat") }, "rate"));
      if (burn.exhaustsAt !== void 0 && burn.exhaustsAt !== null) estParts.push((0, import_jsx_runtime.jsx)("span", { children: fill(t("quotaBurnExhaust"), { v: quotaDur(burn.exhaustsAt - now, t) }) }, "exhaust"));
      else if (burn.pctAtReset !== void 0 && burn.pctAtReset !== null) estParts.push((0, import_jsx_runtime.jsx)("span", { children: fill(t("quotaBurnReset"), { p: Math.round(burn.pctAtReset) }) }, "reset"));
    }
    const stateNote = cal === null && burn === null ? coverage.state === "external" ? t("quotaEstOff") : w.kind === "tokens" ? t("quotaNoCal") : null : coverage.state === "external" ? t("quotaEstOff") : null;
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_qWin", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_qWinMain", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qwLabel", children: quotaWindowLabel(w.id, t) }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qwTrack", style: { width: 110 }, children: (0, import_jsx_runtime.jsx)("span", { className: quotaWindowCls(w.usedPct), style: { width: `${Math.max(2, Math.min(100, w.usedPct ?? 0))}%` } }) }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qwPct", children: w.usedPct === null ? "\u2014" : `${Math.round(w.usedPct)}%` }),
        (0, import_jsx_runtime.jsxs)("span", { className: "dp_qEst", title: t("quotaScopeNote"), children: [
          estParts.flatMap((part, i2) => i2 === 0 ? [part] : [(0, import_jsx_runtime.jsx)("span", { className: "dp_qEstSep", children: "\xB7" }, `sep-${i2}`), part]),
          estParts.length > 0 && stateNote !== null && (0, import_jsx_runtime.jsx)("span", { className: "dp_qEstSep", children: "\xB7" }),
          stateNote !== null && (0, import_jsx_runtime.jsx)("span", { className: "dp_qNote", children: stateNote }),
          estParts.length === 0 && stateNote === null && (0, import_jsx_runtime.jsx)("span", { children: "\u2014" })
        ] }),
        (0, import_jsx_runtime.jsxs)("span", { className: "dp_qWinRight", children: [
          usedText !== null && (0, import_jsx_runtime.jsx)("span", { children: usedText }),
          resetText !== null && (0, import_jsx_runtime.jsx)("span", { children: resetText })
        ] })
      ] })
    ] }, w.id);
  });
  const extraRows = (Array.isArray(active.extras) ? active.extras : []).map((extra) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_qWin", children: [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_qWinMain", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_qwLabel", children: extra.label ?? t("quotaTools") }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_qwTrack", style: { width: 110 }, children: (0, import_jsx_runtime.jsx)("span", { className: quotaWindowCls(extra.usedPct), style: { width: `${Math.max(2, Math.min(100, extra.usedPct ?? 0))}%` } }) }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_qwPct", children: extra.usedPct === null ? "\u2014" : `${Math.round(extra.usedPct)}%` }),
      extra.used !== null && extra.used !== void 0 && extra.total !== null && extra.total !== void 0 ? (0, import_jsx_runtime.jsx)("span", { className: "dp_qWinRight", style: { gridColumn: "4 / 6" }, children: `${extra.used}/${extra.total}` }) : (0, import_jsx_runtime.jsx)("span", { style: { gridColumn: "4 / 6" } })
    ] })
  ] }, extra.id));
  const headRows = [
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTh", children: t("quotaProjectCol") }, "h-project"),
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTh", children: t("quotaTokensCol") }, "h-tokens"),
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTh", title: t("quotaShareTip"), children: t("quotaShareCol") }, "h-share"),
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTh", children: fee !== null ? t("quotaFeeCol") : "" }, "h-fee")
  ];
  const top = attribution.slice(0, 6);
  const rest = attribution.slice(6);
  const bodyRows = top.map((row) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_qTr", children: [
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd dp_qTdFirst", title: row.project, children: row.project === "" ? "\u2014" : row.project }),
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd dp_qTdNum", children: fmtTokens(row.total) }),
    (0, import_jsx_runtime.jsxs)("span", { className: "dp_qTd", style: { display: "flex", alignItems: "center", gap: 8 }, children: [
      (0, import_jsx_runtime.jsx)("span", { children: `${Math.round(row.share * 100)}%` }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_qShareTrack", style: { flex: 1 }, children: (0, import_jsx_runtime.jsx)("span", { className: "dp_qShareFill", style: { width: `${Math.max(2, Math.min(100, row.share * 100))}%`, display: "block" } }) })
    ] }),
    fee !== null ? (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd dp_qTdNum", children: quotaMoney(quotaFeeShare(active.fee, row.total, grandTotal) ?? 0, fee.currency) }) : (0, import_jsx_runtime.jsx)("span", {}, "f")
  ] }, row.project || "__"));
  const restRow = rest.length > 0 ? (0, import_jsx_runtime.jsxs)("div", { className: "dp_qTr", children: [
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd dp_qTdFirst", children: fill(t("cmdOthers"), { n: rest.length }) }),
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd dp_qTdNum", children: fmtTokens(rest.reduce((sum, row) => sum + row.total, 0)) }),
    (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd", children: `${Math.round((grandTotal > 0 ? rest.reduce((sum, row) => sum + row.total, 0) / grandTotal : 0) * 100)}%` }),
    fee !== null ? (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd dp_qTdNum", children: quotaMoney(quotaFeeShare(active.fee, rest.reduce((sum, row) => sum + row.total, 0), grandTotal) ?? 0, fee.currency) }) : (0, import_jsx_runtime.jsx)("span", {}, "f")
  ] }, "__rest") : null;
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_quotaPanel", children: [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_estCard", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_cardHead", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_cardLabel", children: t("quotaTitle") }),
        providerSwitch
      ] }),
      planLine,
      (0, import_jsx_runtime.jsx)("div", { className: "dp_qDivider" }),
      windowRows,
      extraRows.length > 0 && (0, import_jsx_runtime.jsx)("div", { className: "dp_qDivider" }),
      extraRows
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_estCard", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_cardHead", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_cardLabel", children: t("quotaProjects") }),
        (0, import_jsx_runtime.jsx)(Seg, {
          id: "pulse-quota-range",
          value: range,
          options: [
            { value: "week", label: t("quotaRangeWeek") },
            { value: "month", label: t("quotaRangeMonth") }
          ],
          onChange: setRange,
          label: t("quotaRangeLabel")
        })
      ] }),
      attribution.length === 0 ? (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("quotaNoLocal") }) : (0, import_jsx_runtime.jsxs)("div", { className: "dp_qTable", children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_qTr", children: headRows }),
        bodyRows,
        restRow
      ] }),
      grandTotal > 0 && (0, import_jsx_runtime.jsx)("div", { className: "dp_qNote dp_qFoot", children: fill(t("quotaLocalTokens"), { v: fmtTokens(grandTotal) }) })
    ] })
  ] });
}

// src/client/charts.js
function accentOf(map, provider, model, fallback = "var(--dsw-alias-label-tertiary)") {
  return accentEntryOf(map, provider, model)?.fill ?? fallback;
}
function BucketChart({ buckets, granularity, today, modelBuckets, accentMap, byModel, names, legendRows, legendSel = null, onLegendToggle, hourlyFrom = null, onDrillChange, onDrillHourly, children, t }) {
  const [hover, setHover] = (0, import_react.useState)(null);
  const [drillIdx, setDrillIdx] = (0, import_react.useState)(null);
  const [hoverSeg, setHoverSeg] = (0, import_react.useState)(null);
  const [pinnedSeg, setPinnedSeg] = (0, import_react.useState)(null);
  const [seed, setSeed] = (0, import_react.useState)(null);
  const outerRef = (0, import_react.useRef)(null);
  const drillOuterRef = (0, import_react.useRef)(null);
  const rows = Array.isArray(buckets) ? buckets : [];
  const matrices = Array.isArray(modelBuckets) ? modelBuckets : [];
  const exitDrill = () => {
    setDrillIdx(null);
    setHoverSeg(null);
    setPinnedSeg(null);
    onDrillChange?.(null);
  };
  (0, import_react.useEffect)(() => {
    setDrillIdx(null);
    setHoverSeg(null);
    setPinnedSeg(null);
    onDrillChange?.(null);
  }, [buckets, byModel]);
  (0, import_react.useEffect)(() => {
    if (drillIdx === null || seed === null) return void 0;
    const frame = requestAnimationFrame(() => setSeed(null));
    return () => cancelAnimationFrame(frame);
  }, [drillIdx, seed]);
  (0, import_react.useEffect)(() => {
    if (drillIdx === null) return void 0;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (pinnedSeg !== null) setPinnedSeg(null);
      else exitDrill();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drillIdx, pinnedSeg]);
  const maxRaw = rows.reduce((m, b) => Math.max(
    m,
    (b.input || 0) + (b.cacheRead || 0) + (b.cacheWrite || 0) + (b.output || 0)
  ), 0);
  const max = niceMax(maxRaw);
  const total = rows.reduce((m, b) => m + (b.input || 0) + (b.cacheRead || 0) + (b.cacheWrite || 0) + (b.output || 0), 0);
  const todayKey = bucketOf(granularity, today);
  const hovered = hover !== null && rows[hover] !== void 0 ? rows[hover] : null;
  const otherFill = "var(--dsw-alias-label-tertiary)";
  const segsFor = (i2, bucket) => {
    const inSide = (bucket.input || 0) + (bucket.cacheWrite || 0);
    const cacheRead = bucket.cacheRead || 0;
    const out = bucket.output || 0;
    if (!byModel) {
      return [
        { key: "out", tokens: out, cls: "dp_segOut" },
        { key: "cache", tokens: cacheRead, cls: "dp_segCache" },
        { key: "in", tokens: inSide, cls: "dp_segIn" }
      ];
    }
    const matrix = matrices[i2];
    const entries = matrix instanceof Map ? [...matrix.entries()].map(([mid, tk]) => ({
      key: mid,
      bare: mid === "" ? "" : String(splitModelKey(mid).model ?? mid),
      provider: mid === "" ? "" : String(splitModelKey(mid).provider ?? ""),
      tokens: (tk?.input || 0) + (tk?.output || 0) + (tk?.cacheRead || 0) + (tk?.cacheWrite || 0),
      tk: tk ?? {}
    })).filter((seg) => seg.tokens > 0).sort((a, b) => b.tokens - a.tokens) : [];
    const top = entries.slice(0, 4);
    const restRows = entries.slice(4);
    const restTokens = restRows.reduce((s, seg) => s + seg.tokens, 0);
    if (restTokens > 0) top.push({
      key: "__other__",
      bare: "",
      provider: "",
      tokens: restTokens,
      tk: restRows.reduce((acc, seg) => {
        acc.input += seg.tk?.input || 0;
        acc.output += seg.tk?.output || 0;
        acc.cacheRead += seg.tk?.cacheRead || 0;
        acc.cacheWrite += seg.tk?.cacheWrite || 0;
        return acc;
      }, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
    });
    return top.map((seg) => ({
      ...seg,
      fill: seg.key === "__other__" || seg.bare === "" ? otherFill : accentOf(accentMap, seg.provider, seg.bare, otherFill),
      cls: "dp_segModel"
    }));
  };
  const enterDrill = (i2, e) => {
    const b = rows[i2];
    if (b === void 0 || (b.input || 0) + (b.output || 0) + (b.cacheRead || 0) + (b.cacheWrite || 0) <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const outerRect = outerRef.current?.getBoundingClientRect();
    const outerW = outerRect?.width || 0;
    setHover(null);
    setHoverSeg(null);
    setSeed(outerW > 0 ? { x: rect.left - outerRect.left, scale: Math.max(0.02, rect.width / outerW) } : null);
    setDrillIdx(i2);
    onDrillChange?.(i2);
  };
  if (drillIdx !== null && rows[drillIdx] !== void 0) {
    const bucket = rows[drillIdx];
    const dayTotal = (bucket.input || 0) + (bucket.output || 0) + (bucket.cacheRead || 0) + (bucket.cacheWrite || 0);
    const segs = segsFor(drillIdx, bucket);
    const dateLabel = bucket.key === todayKey ? `${bucket.key} \xB7 ${t("today")}` : bucket.key;
    const drillStyle = seed !== null ? { transform: `translateX(${seed.x}px) scaleX(${seed.scale})` } : void 0;
    const focusSeg = hoverSeg ?? pinnedSeg;
    const subSeg = focusSeg !== null ? segs.find((seg) => seg.key === focusSeg) ?? null : null;
    const subTk = subSeg?.tk ?? null;
    const subIn = (subTk?.input || 0) + (subTk?.cacheWrite || 0);
    const subCache = subTk?.cacheRead || 0;
    const subOut = subTk?.output || 0;
    const subSum = subIn + subCache + subOut;
    const fmtPct = (v) => {
      if (subSum <= 0 || v <= 0) return "0%";
      const p = v / subSum * 100;
      return p >= 10 ? `${Math.round(p)}%` : p >= 0.1 ? `${p.toFixed(1)}%` : "<0.1%";
    };
    const subLabel = subSeg === null ? "" : subSeg.key === "__other__" || subSeg.bare === "" ? t("stackOther") : subSeg.key === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(subSeg.provider ?? "", subSeg.bare);
    const level2 = byModel && pinnedSeg !== null ? segs.find((s) => s.key === pinnedSeg) ?? null : null;
    const level2Tk = level2 === null ? null : level2.tk ?? null;
    const l2Parts = level2 === null ? [] : [
      { key: "in", label: t("legendInput"), v: (level2Tk?.input || 0) + (level2Tk?.cacheWrite || 0), fill: "var(--dsw-alias-state-business-primary)" },
      { key: "cache", label: t("legendCache"), v: level2Tk?.cacheRead || 0, fill: "color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))" },
      { key: "out", label: t("legendOutput"), v: level2Tk?.output || 0, fill: "var(--dsw-alias-state-success-primary)" }
    ];
    const l2Sum = l2Parts.reduce((s, p) => s + p.v, 0);
    return (0, import_jsx_runtime.jsxs)("div", { children: [
      (0, import_jsx_runtime.jsxs)("div", { ref: drillOuterRef, className: "dp_chartOuter", onClick: () => {
        if (pinnedSeg !== null) setPinnedSeg(null);
        else exitDrill();
      }, children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_drillHead", children: [
          /** 返回按钮随层级变化：模型占比层 → 返回上一层；当日
           *  模型层 → 返回多日视图（与点图内空白同语义）。 */
          (0, import_jsx_runtime.jsx)("button", {
            type: "button",
            className: "dp_setLink",
            onClick: () => {
              if (pinnedSeg !== null) setPinnedSeg(null);
              else exitDrill();
            },
            children: pinnedSeg !== null ? `\u2190 ${t("back")}` : `\u2190 ${t("backToDays")}`
          }),
          (0, import_jsx_runtime.jsxs)("span", { className: "dp_drillTotal", children: [
            (0, import_jsx_runtime.jsx)("b", { children: dateLabel }),
            (0, import_jsx_runtime.jsx)("span", { children: fmtTokens(dayTotal) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("tipSessions"), { n: bucket.sessions || 0 }) }),
            typeof onDrillHourly === "function" && (hourlyFrom === null || bucket.key >= hourlyFrom) && (0, import_jsx_runtime.jsx)("button", {
              type: "button",
              className: "dp_setLink",
              onClick: (e) => {
                e.stopPropagation();
                onDrillHourly(bucket.key);
              },
              children: t("drillByHour")
            })
          ] }),
          // The focused model's split rides in the head so even a
          // 0.3% share stays readable (its segment is too thin
          // for inline text).
          byModel && subSeg !== null && (0, import_jsx_runtime.jsx)("div", { className: "dp_drillSubNote dp_drillCap", children: `${subLabel} \xB7 ${t("legendInput")} ${fmtPct(subIn)} (${fmtTokens(subIn)}) \xB7 ${t("legendCache")} ${fmtPct(subCache)} (${fmtTokens(subCache)}) \xB7 ${t("legendOutput")} ${fmtPct(subOut)} (${fmtTokens(subOut)})` })
        ] }),
        (0, import_jsx_runtime.jsxs)("div", {
          className: "dp_drillStage",
          children: (0, import_jsx_runtime.jsx)("div", {
            className: "dp_drillBar",
            style: drillStyle,
            children: level2 !== null ? l2Parts.map((p) => {
              const pct = l2Sum > 0 ? p.v / l2Sum * 100 : 0;
              return (0, import_jsx_runtime.jsx)("div", {
                className: "dp_drillSeg",
                style: { width: `${pct}%`, background: p.fill },
                onClick: (e) => e.stopPropagation(),
                children: pct >= 14 ? `${Math.round(pct)}%` : null
              }, p.key);
            }) : segs.map((seg) => {
              const pct = dayTotal > 0 ? seg.tokens / dayTotal * 100 : 0;
              return (0, import_jsx_runtime.jsx)("div", {
                className: seg.cls === "dp_segModel" ? "dp_drillSeg" : `dp_drillSeg ${seg.cls}`,
                style: { width: `${pct}%`, ...seg.fill !== void 0 ? { background: seg.fill } : {} },
                onMouseEnter: () => byModel && setHoverSeg(seg.key),
                onMouseLeave: () => setHoverSeg(null),
                onClick: (e) => {
                  e.stopPropagation();
                  if (pinnedSeg === seg.key) {
                    setPinnedSeg(null);
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  const outerRect = drillOuterRef.current?.getBoundingClientRect();
                  const outerW = outerRect?.width || 0;
                  setSeed(outerW > 0 ? { x: rect.left - outerRect.left, scale: Math.max(0.02, rect.width / outerW) } : null);
                  setPinnedSeg(seg.key);
                },
                children: pct >= 14 ? `${Math.round(pct)}%` : null
              }, seg.key);
            })
          })
        })
      ] }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_legend", children: level2 !== null ? l2Parts.map((p) => (0, import_jsx_runtime.jsxs)("span", { children: [
        (0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: { background: p.fill } }),
        p.label,
        (0, import_jsx_runtime.jsx)("span", { className: "dp_legendVal", children: fmtTokens(p.v) })
      ] }, p.key)) : segs.map((seg) => (0, import_jsx_runtime.jsxs)("span", { children: [
        (0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: { background: seg.fill ?? otherFill } }),
        seg.key === "__other__" || seg.bare === "" ? t("stackOther") : seg.key === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(seg.provider ?? "", seg.bare),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_legendVal", children: fmtTokens(seg.tokens) })
      ] }, seg.key)) })
    ] });
  }
  const multiLegend = byModel ? (Array.isArray(legendRows) ? legendRows : []).map((row) => (0, import_jsx_runtime.jsxs)("span", {
    className: typeof onLegendToggle === "function" && row.key !== void 0 ? `dp_legendBtn${legendSel !== null && !legendSel.has(row.key) ? " dp_legendDim" : ""}` : void 0,
    onClick: typeof onLegendToggle === "function" && row.key !== void 0 ? () => onLegendToggle(row.key) : void 0,
    role: typeof onLegendToggle === "function" && row.key !== void 0 ? "button" : void 0,
    title: row.title !== void 0 && row.title !== null ? row.title : typeof onLegendToggle === "function" && row.key !== void 0 ? t("legendFilterHint") : void 0,
    children: [
      (0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: row.fill !== void 0 ? { background: row.fill } : void 0 }),
      row.label
    ]
  }, row.label)) : [
    (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot dp_legendIn" }), t("legendInput")] }),
    (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot dp_legendCache" }), t("legendCache")] }),
    (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot dp_legendOut" }), t("legendOutput")] })
  ];
  return (0, import_jsx_runtime.jsxs)("div", { children: [
    (0, import_jsx_runtime.jsx)("div", { ref: outerRef, className: "dp_chartOuter", children: (0, import_jsx_runtime.jsxs)("div", { className: "dp_chartGrid", children: [
      (0, import_jsx_runtime.jsx)("div", { key: "g0", className: "dp_gridline", style: { top: "0%" } }),
      (0, import_jsx_runtime.jsx)("div", { key: "g50", className: "dp_gridline", style: { top: "50%" } }),
      (0, import_jsx_runtime.jsx)("div", { key: "g100", className: "dp_gridline", style: { top: "100%" } }),
      (0, import_jsx_runtime.jsx)("span", { key: "l0", className: "dp_gridlabel", style: { top: "0%" }, children: fmtTokens(max) }),
      (0, import_jsx_runtime.jsx)("span", { key: "l50", className: "dp_gridlabel", style: { top: "50%" }, children: fmtTokens(max / 2) }),
      total === 0 && (0, import_jsx_runtime.jsxs)("div", { key: "empty", className: "dp_emptyChart", children: [
        (0, import_jsx_runtime.jsx)(primitives.IconDataOutline16, { size: 20 }),
        (0, import_jsx_runtime.jsx)("span", { children: t("cacheNa") })
      ] }),
      rows.map((bucket, i2) => {
        const inSide = (bucket.input || 0) + (bucket.cacheWrite || 0);
        const cacheRead = bucket.cacheRead || 0;
        const out = bucket.output || 0;
        const sum = inSide + cacheRead + out;
        const isToday = bucket.key === todayKey;
        const height = sum > 0 ? sum / max * 100 : 0;
        const stack = segsFor(i2, bucket).sort((a, b) => a.tokens - b.tokens);
        return (0, import_jsx_runtime.jsx)("div", {
          className: `dp_col${sum === 0 ? " dp_colZero" : ""}`,
          onMouseEnter: () => setHover(i2),
          onMouseLeave: () => setHover(null),
          onClick: (e) => enterDrill(i2, e),
          children: [
            (0, import_jsx_runtime.jsx)("div", { key: "hit", className: "dp_colHit" }),
            sum === 0 ? (0, import_jsx_runtime.jsx)("div", { key: "zero", className: "dp_barZero" }) : null,
            (0, import_jsx_runtime.jsxs)("div", {
              key: "bar",
              className: `dp_bar${isToday ? " dp_barToday" : ""}${sum > 0 ? " dp_barNonzero" : ""}`,
              style: { height: `${height}%` },
              children: stack.map((seg) => (0, import_jsx_runtime.jsx)("div", {
                className: seg.cls,
                style: { height: `${sum > 0 ? seg.tokens / sum * 100 : 0}%`, ...seg.fill !== void 0 ? { background: seg.fill } : {} }
              }, seg.key))
            })
          ]
        }, bucket.key ?? i2);
      }),
      hovered !== null && hover !== null && (0, import_jsx_runtime.jsx)("div", {
        key: "tip",
        className: "dp_tipAnchor",
        style: { left: `${(hover + 0.5) / rows.length * 100}%` },
        children: (0, import_jsx_runtime.jsx)("div", {
          className: "dp_tip",
          style: hover < 2 ? { left: "0" } : hover >= rows.length - 2 ? { left: "0", transform: "translateX(-100%)" } : { left: "0", transform: "translateX(-50%)" },
          children: (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            (0, import_jsx_runtime.jsx)("b", { children: hovered.key === todayKey ? `${hovered.key} ${t("today")}` : hovered.key }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("tipSessions"), { n: hovered.sessions || 0 }) })
          ] })
        })
      })
    ] }) }),
    children ?? null,
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_legend", children: multiLegend })
  ] });
}
function BucketXLabels({ buckets, granularity, today, t }) {
  const rows = Array.isArray(buckets) ? buckets : [];
  const labelStep = rows.length <= 12 ? 1 : Math.max(1, Math.ceil(rows.length / 6));
  const todayKey = bucketOf(granularity, today);
  return (0, import_jsx_runtime.jsx)("div", { className: "dp_xlabels", children: rows.map((bucket, i2) => (0, import_jsx_runtime.jsx)("span", {
    className: `dp_xlabel${bucket.key === todayKey ? " dp_xlabelToday" : ""}`,
    children: (rows.length - 1 - i2) % labelStep === 0 ? bucketLabel(bucket.key) : ""
  }, bucket.key ?? i2)) });
}
function costPeriodRows(rows, bucket) {
  const list = Array.isArray(rows) ? rows : [];
  if (bucket !== "week" && bucket !== "month") return list;
  const map = /* @__PURE__ */ new Map();
  const out = [];
  const fmtDay = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  for (const row of list) {
    let key;
    let start = row.key;
    if (bucket === "month") {
      key = row.key.slice(0, 7);
    } else {
      const [y, m, d] = [Number(row.key.slice(0, 4)), Number(row.key.slice(5, 7)), Number(row.key.slice(8, 10))];
      const monday = new Date(y, m - 1, d - (new Date(y, m - 1, d).getDay() + 6) % 7);
      start = fmtDay(monday);
      key = start;
    }
    let acc = map.get(key);
    if (acc === void 0) {
      acc = { key, start, end: row.key, peak: 0, offpeak: 0, byModel: /* @__PURE__ */ new Map() };
      map.set(key, acc);
      out.push(acc);
    }
    acc.end = row.key;
    acc.peak += row.peak || 0;
    acc.offpeak += row.offpeak || 0;
    if (row.byModel instanceof Map) row.byModel.forEach((bm, mk) => {
      const prev = acc.byModel.get(mk) ?? { model: bm.model, provider: bm.provider, cost: 0 };
      prev.cost += bm.cost;
      acc.byModel.set(mk, prev);
    });
  }
  return out;
}
function CostTrendPanel({ costs, today, actualByDay, accentMap, byModel, names, bucket = "day", legendSel = null, onLegendToggle, auxTip = null, onDrillChange, children, t }) {
  const [hover, setHover] = (0, import_react.useState)(null);
  const [drillIdx, setDrillIdx] = (0, import_react.useState)(null);
  const [seed, setSeed] = (0, import_react.useState)(null);
  const outerRef = (0, import_react.useRef)(null);
  const rows = costPeriodRows(Array.isArray(costs) ? costs : [], bucket);
  (0, import_react.useEffect)(() => {
    setDrillIdx(null);
    onDrillChange?.(null);
  }, [costs, byModel]);
  (0, import_react.useEffect)(() => {
    if (drillIdx === null || seed === null) return void 0;
    const frame = requestAnimationFrame(() => setSeed(null));
    return () => cancelAnimationFrame(frame);
  }, [drillIdx, seed]);
  const exitDrill = () => {
    setDrillIdx(null);
    setHover(null);
    onDrillChange?.(null);
  };
  (0, import_react.useEffect)(() => {
    if (drillIdx === null) return void 0;
    const onKey = (e) => {
      if (e.key === "Escape") exitDrill();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drillIdx]);
  const maxRaw = rows.reduce((m, b) => Math.max(m, (b.peak || 0) + (b.offpeak || 0)), 0);
  const max = niceMax(maxRaw);
  const total = rows.reduce((m, b) => m + (b.peak || 0) + (b.offpeak || 0), 0);
  const todayKey = bucketOf("day", today);
  const hovered = hover !== null && rows[hover] !== void 0 ? rows[hover] : null;
  const actualMap = new Map((Array.isArray(actualByDay) ? actualByDay : []).map((row) => [row?.key, Number.isFinite(row?.spend) ? row.spend : null]));
  const otherFill = "var(--dsw-alias-label-tertiary)";
  const peakFill = "var(--dsw-alias-state-business-primary)";
  const offFill = "color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,var(--dsw-alias-label-tertiary))";
  const segsFor = (row) => {
    if (!byModel) {
      return [
        { key: "peak", tokens: row.peak || 0, fill: peakFill, cls: "dp_segModel" },
        { key: "off", tokens: row.offpeak || 0, fill: offFill, cls: "dp_segModel" }
      ];
    }
    const entries = row.byModel instanceof Map ? [...row.byModel.values()].map((bm) => ({ key: bm.model, bare: bm.model, provider: bm.provider, tokens: bm.cost })).filter((seg) => seg.tokens > 0).sort((a, b) => b.tokens - a.tokens) : [];
    const top = entries.slice(0, 4);
    const rest = entries.slice(4).reduce((s, seg) => s + seg.tokens, 0);
    if (rest > 0) top.push({ key: "__other__", bare: "", tokens: rest });
    return top.map((seg) => ({
      ...seg,
      fill: seg.key === "__other__" ? otherFill : accentOf(accentMap, seg.provider, seg.bare, otherFill),
      cls: "dp_segModel"
    }));
  };
  const enterDrill = (i2, e) => {
    const row = rows[i2];
    if (row === void 0 || (row.peak || 0) + (row.offpeak || 0) <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const outerRect = outerRef.current?.getBoundingClientRect();
    const outerW = outerRect?.width || 0;
    setHover(null);
    setSeed(outerW > 0 ? { x: rect.left - outerRect.left, scale: Math.max(0.02, rect.width / outerW) } : null);
    setDrillIdx(i2);
    onDrillChange?.(i2);
  };
  const segLabel = (seg) => !byModel ? seg.key === "peak" ? t("legendPeak") : t("legendOffpeak") : seg.key === "__other__" ? t("stackOther") : seg.key === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(seg.provider ?? "", seg.bare);
  if (drillIdx !== null && rows[drillIdx] !== void 0) {
    const row = rows[drillIdx];
    const dayTotal = (row.peak || 0) + (row.offpeak || 0);
    const segs = segsFor(row);
    const actual = actualMap.get(row.key);
    const drillStyle = seed !== null ? { transform: `translateX(${seed.x}px) scaleX(${seed.scale})` } : void 0;
    return (0, import_jsx_runtime.jsxs)("div", { children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_chartOuter", onClick: exitDrill, children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_drillHead", children: [
          (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_setLink", onClick: exitDrill, children: `\u2190 ${t("backToDays")}` }),
          (0, import_jsx_runtime.jsxs)("span", { className: "dp_drillTotal", children: [
            (0, import_jsx_runtime.jsx)("b", { children: (() => {
              const start = row.start ?? row.key;
              const end = row.end ?? row.key;
              if (start !== end) return `${start} ~ ${end}`;
              return row.key === todayKey ? `${row.key} \xB7 ${t("today")}` : row.key;
            })() }),
            (0, import_jsx_runtime.jsx)("span", { children: moneyCny(dayTotal) }),
            actual !== null && actual !== void 0 && (0, import_jsx_runtime.jsx)("span", { children: fill(t("actualTip"), { v: moneyCny(actual) }) })
          ] })
        ] }),
        (0, import_jsx_runtime.jsx)("div", { className: "dp_drillStage", children: (0, import_jsx_runtime.jsx)("div", { className: "dp_drillBar", style: drillStyle, children: segs.map((seg) => {
          const pct = dayTotal > 0 ? seg.tokens / dayTotal * 100 : 0;
          return (0, import_jsx_runtime.jsx)("div", {
            className: "dp_drillSeg",
            style: { width: `${pct}%`, background: seg.fill },
            children: pct >= 14 ? `${Math.round(pct)}%` : null
          }, seg.key);
        }) }) })
      ] }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_legend", children: segs.map((seg) => (0, import_jsx_runtime.jsxs)("span", { children: [
        (0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: { background: seg.fill } }),
        segLabel(seg),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_legendVal", children: moneyCny(seg.tokens) })
      ] }, seg.key)) })
    ] });
  }
  const windowCostByModel = /* @__PURE__ */ new Map();
  rows.forEach((row) => {
    if (row.byModel instanceof Map) row.byModel.forEach((bm, key) => {
      windowCostByModel.set(key, (windowCostByModel.get(key) ?? 0) + bm.cost);
    });
  });
  const modelLegend = [...windowCostByModel.entries()].map(([mid, cost]) => {
    const split = splitModelKey(mid);
    return { key: mid, label: mid === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(split.provider, split.model), fill: accentOf(accentMap, split.provider, split.model, otherFill), cost };
  }).sort((a, b) => b.cost - a.cost).slice(0, 4);
  const multiLegend = byModel ? modelLegend.map((row) => (0, import_jsx_runtime.jsxs)("span", {
    className: typeof onLegendToggle === "function" ? `dp_legendBtn${legendSel !== null && !legendSel.has(row.key) ? " dp_legendDim" : ""}` : void 0,
    onClick: typeof onLegendToggle === "function" ? () => onLegendToggle(row.key) : void 0,
    role: typeof onLegendToggle === "function" ? "button" : void 0,
    title: row.key === AUX_MODEL_KEY && auxTip !== null ? auxTip : typeof onLegendToggle === "function" ? t("legendFilterHint") : void 0,
    children: [
      (0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: { background: row.fill } }),
      row.label,
      (0, import_jsx_runtime.jsx)("span", { className: "dp_legendVal", children: moneyCny(row.cost) })
    ]
  }, row.label)) : [
    (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: { background: peakFill } }), t("legendPeak")] }),
    (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: { background: offFill } }), t("legendOffpeak")] })
  ];
  return (0, import_jsx_runtime.jsxs)("div", { children: [
    (0, import_jsx_runtime.jsx)("div", { ref: outerRef, className: "dp_chartOuter", children: (0, import_jsx_runtime.jsxs)("div", { className: "dp_chartGrid", children: [
      (0, import_jsx_runtime.jsx)("div", { key: "g0", className: "dp_gridline", style: { top: "0%" } }),
      (0, import_jsx_runtime.jsx)("div", { key: "g50", className: "dp_gridline", style: { top: "50%" } }),
      (0, import_jsx_runtime.jsx)("div", { key: "g100", className: "dp_gridline", style: { top: "100%" } }),
      (0, import_jsx_runtime.jsx)("span", { key: "l0", className: "dp_gridlabel", style: { top: "0%" }, children: moneyCny(max) }),
      (0, import_jsx_runtime.jsx)("span", { key: "l50", className: "dp_gridlabel", style: { top: "50%" }, children: moneyCny(max / 2) }),
      total === 0 && (0, import_jsx_runtime.jsxs)("div", { key: "empty", className: "dp_emptyChart", children: [
        (0, import_jsx_runtime.jsx)(primitives.IconDataOutline16, { size: 20 }),
        (0, import_jsx_runtime.jsx)("span", { children: t("cacheNa") })
      ] }),
      rows.map((row, i2) => {
        const sum = (row.peak || 0) + (row.offpeak || 0);
        const height = sum > 0 ? sum / max * 100 : 0;
        const stack = segsFor(row).sort((a, b) => a.tokens - b.tokens);
        const coversToday = row.start !== void 0 ? row.start <= today && today <= row.end : row.key === todayKey;
        return (0, import_jsx_runtime.jsx)("div", {
          className: `dp_col${bucket === "day" && isOffPeakDay(row.key) ? " dp_colOff" : ""}${sum === 0 ? " dp_colZero" : ""}`,
          onMouseEnter: () => setHover(i2),
          onMouseLeave: () => setHover(null),
          onClick: (e) => enterDrill(i2, e),
          children: [
            (0, import_jsx_runtime.jsx)("div", { key: "hit", className: "dp_colHit" }),
            sum === 0 ? (0, import_jsx_runtime.jsx)("div", { key: "zero", className: "dp_barZero" }) : null,
            (0, import_jsx_runtime.jsxs)("div", {
              key: "bar",
              className: `dp_bar${coversToday ? " dp_barToday" : ""}${sum > 0 ? " dp_barNonzero" : ""}`,
              style: { height: `${height}%` },
              children: stack.map((seg) => (0, import_jsx_runtime.jsx)("div", {
                className: seg.cls,
                style: { height: `${sum > 0 ? seg.tokens / sum * 100 : 0}%`, background: seg.fill }
              }, seg.key))
            })
          ]
        }, row.key);
      }),
      hovered !== null && hover !== null && (0, import_jsx_runtime.jsx)("div", {
        key: "tip",
        className: "dp_tipAnchor",
        style: { left: `${(hover + 0.5) / rows.length * 100}%` },
        children: (0, import_jsx_runtime.jsx)("div", {
          className: "dp_tip",
          style: hover < 2 ? { left: "0" } : hover >= rows.length - 2 ? { left: "0", transform: "translateX(-100%)" } : { left: "0", transform: "translateX(-50%)" },
          children: (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            (0, import_jsx_runtime.jsx)("b", { children: hovered.key === todayKey ? `${hovered.key} ${t("today")}` : hovered.key }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("costTipPeak"), { v: fmtCost(hovered.peak || 0) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("costTipOff"), { v: fmtCost(hovered.offpeak || 0) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("costTipTotal"), { v: fmtCost((hovered.peak || 0) + (hovered.offpeak || 0)) }) })
          ] })
        })
      })
    ] }) }),
    children ?? null,
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_legend", children: multiLegend })
  ] });
}
function HourlyCostChart({ hours, t }) {
  const [hover, setHover] = (0, import_react.useState)(null);
  const rows = Array.isArray(hours) ? hours : [];
  const maxRaw = rows.reduce((m, h) => Math.max(m, h.cost || 0), 0);
  const max = niceMax(maxRaw);
  const peakTotal = rows.reduce((s, h) => s + (h.peak || 0), 0);
  const offTotal = rows.reduce((s, h) => s + (h.offpeak || 0), 0);
  const total = peakTotal + offTotal;
  const hovered = hover !== null && rows[hover] !== void 0 ? rows[hover] : null;
  const peakFill = "var(--dsw-alias-state-business-primary)";
  const offFill = "color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,var(--dsw-alias-label-tertiary))";
  return (0, import_jsx_runtime.jsxs)("div", { children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_chartOuter", children: (0, import_jsx_runtime.jsxs)("div", { className: "dp_chartGrid", children: [
      (0, import_jsx_runtime.jsx)("div", { key: "g0", className: "dp_gridline", style: { top: "0%" } }),
      (0, import_jsx_runtime.jsx)("div", { key: "g50", className: "dp_gridline", style: { top: "50%" } }),
      (0, import_jsx_runtime.jsx)("div", { key: "g100", className: "dp_gridline", style: { top: "100%" } }),
      maxRaw > 0 && (0, import_jsx_runtime.jsx)("span", { key: "l0", className: "dp_gridlabel", style: { top: "0%" }, children: moneyCny(max) }),
      maxRaw > 0 && (0, import_jsx_runtime.jsx)("span", { key: "l50", className: "dp_gridlabel", style: { top: "50%" }, children: moneyCny(max / 2) }),
      total === 0 && (0, import_jsx_runtime.jsxs)("div", { key: "empty", className: "dp_emptyChart", children: [
        (0, import_jsx_runtime.jsx)(primitives.IconDataOutline16, { size: 20 }),
        (0, import_jsx_runtime.jsx)("span", { children: t("cacheNa") })
      ] }),
      rows.map((h, i2) => {
        const cost = h.cost || 0;
        const height = cost > 0 ? cost / max * 100 : 0;
        return (0, import_jsx_runtime.jsxs)("div", {
          className: `dp_col${cost === 0 ? " dp_colZero" : ""}`,
          onMouseEnter: () => setHover(i2),
          onMouseLeave: () => setHover(null),
          children: [
            (0, import_jsx_runtime.jsx)("div", { key: "hit", className: "dp_colHit" }),
            cost === 0 && (0, import_jsx_runtime.jsx)("div", { key: "zero", className: "dp_barZero" }),
            cost > 0 && (0, import_jsx_runtime.jsx)("div", {
              key: "bar",
              className: "dp_bar dp_barNonzero",
              style: { height: `${height}%`, background: (h.peak || 0) > 0 ? peakFill : offFill }
            })
          ]
        }, h.key);
      }),
      hovered !== null && hover !== null && (0, import_jsx_runtime.jsx)("div", {
        key: "tip",
        className: "dp_tipAnchor",
        style: { left: `${(hover + 0.5) / Math.max(rows.length, 1) * 100}%` },
        children: (0, import_jsx_runtime.jsx)("div", {
          className: "dp_tip",
          style: hover < 2 ? { left: "0" } : hover >= rows.length - 2 ? { left: "0", transform: "translateX(-100%)" } : { left: "0", transform: "translateX(-50%)" },
          children: (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            (0, import_jsx_runtime.jsx)("b", { children: `${hovered.key}:00` }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("costTipPeak"), { v: moneyCny(hovered.peak || 0) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("costTipOff"), { v: moneyCny(hovered.offpeak || 0) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("costTipTotal"), { v: moneyCny((hovered.peak || 0) + (hovered.offpeak || 0)) }) })
          ] })
        })
      })
    ] }) }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_hourXlabels", children: ["00", "06", "12", "18", "23"].map((label) => (0, import_jsx_runtime.jsx)("span", { key: label, children: label })) }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_legend", children: [
      (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: { background: peakFill } }), t("legendPeak"), (0, import_jsx_runtime.jsx)("span", { className: "dp_legendVal", children: moneyCny(peakTotal) })] }),
      (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { className: "dp_legendDot", style: { background: offFill } }), t("legendOffpeak"), (0, import_jsx_runtime.jsx)("span", { className: "dp_legendVal", children: moneyCny(offTotal) })] })
    ] })
  ] });
}
function HeatmapChart({ buckets, today, t }) {
  const [hover, setHover] = (0, import_react.useState)(null);
  const { cells, weeks, months } = heatmapCells(buckets);
  const gridStyle = { gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` };
  const maxRaw = cells.reduce((m, c) => c === null ? m : Math.max(
    m,
    (c.input || 0) + (c.cacheRead || 0) + (c.cacheWrite || 0) + (c.output || 0)
  ), 0);
  const hovered = hover !== null && cells[hover] !== void 0 && cells[hover] !== null ? cells[hover] : null;
  return (0, import_jsx_runtime.jsxs)("div", { children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_chartOuter", children: (0, import_jsx_runtime.jsxs)("div", { className: "dp_hcWrap", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_hcGutter", children: [0, 2, 4].map((row) => (0, import_jsx_runtime.jsx)("span", {
        key: `g${row}`,
        style: { gridRowStart: row + 2 },
        children: row === 0 ? t("hcMon") : row === 2 ? t("hcWed") : t("hcFri")
      })) }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_hcBody", children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_hcMonths", style: gridStyle, children: months.map(({ col, label }) => {
          const showYear = label.endsWith("-01");
          return (0, import_jsx_runtime.jsx)("span", {
            key: `m${col}`,
            style: { gridColumnStart: col + 1 },
            children: showYear ? label : label.slice(5)
          });
        }) }),
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_hcGrid", role: "img", "aria-label": t("hcAria"), style: gridStyle, children: cells.map((bucket, i2) => {
          if (bucket === null) return (0, import_jsx_runtime.jsx)("span", { key: `f${i2}`, className: "dp_hcCell dp_hcFuture" });
          const total = (bucket.input || 0) + (bucket.cacheRead || 0) + (bucket.cacheWrite || 0) + (bucket.output || 0);
          const level = heatmapLevel(total, maxRaw);
          const isToday = bucket.key === today;
          return (0, import_jsx_runtime.jsx)("button", {
            key: bucket.key,
            type: "button",
            className: `dp_hcCell${level > 0 ? ` dp_hcL${level}` : ""}${isToday ? " dp_hcToday" : ""}`,
            onMouseEnter: () => setHover(i2),
            onMouseLeave: () => setHover(null),
            onFocus: () => setHover(i2),
            onBlur: () => setHover(null),
            "aria-label": bucket.key
          });
        }) })
      ] })
    ] }) }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_hcDetail", children: hovered !== null ? [
      (0, import_jsx_runtime.jsx)("b", { key: "d", children: hovered.key === today ? `${hovered.key} ${t("today")}` : hovered.key }),
      (0, import_jsx_runtime.jsx)("span", { key: "i", children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
      (0, import_jsx_runtime.jsx)("span", { key: "c", children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
      (0, import_jsx_runtime.jsx)("span", { key: "o", children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) }),
      (0, import_jsx_runtime.jsx)("span", { key: "s", children: fill(t("tipSessions"), { n: hovered.sessions || 0 }) })
    ] : (0, import_jsx_runtime.jsx)("span", { children: "\xA0" }) }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_hcScale", children: [
      (0, import_jsx_runtime.jsx)("span", { children: t("hcLess") }),
      [0, 1, 2, 3, 4].map((level) => (0, import_jsx_runtime.jsx)("i", { key: level, className: `dp_hcSwatch${level > 0 ? ` dp_hcL${level}` : ""}` })),
      (0, import_jsx_runtime.jsx)("span", { children: t("hcMore") })
    ] })
  ] });
}
function SearchPicker({ value, options, placeholder, displayName, onChange, t }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const [query, setQuery] = (0, import_react.useState)("");
  const rootRef = (0, import_react.useRef)(null);
  const btnRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  (0, import_react.useEffect)(() => {
    if (!open || floatReady()) return;
    const onDoc = (e) => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const q = query.trim().toLowerCase();
  const rows = options.filter((option) => q === "" || option.label.toLowerCase().includes(q));
  const shown = value === "" || value === null || value === void 0 ? placeholder : displayName(value);
  const menuItems = [
    (0, import_jsx_runtime.jsx)("input", {
      key: "search",
      className: "dp_pickerSearch",
      type: "text",
      placeholder: t("searchPlaceholder"),
      value: query,
      autoFocus: true,
      onChange: (e) => setQuery(e.target.value)
    }),
    (0, import_jsx_runtime.jsxs)("div", { key: "list", className: "dp_pickerList", children: [
      rows.map((option) => (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        key: option.value,
        role: "option",
        "aria-selected": value === option.value,
        className: `dp_pickerItem${value === option.value ? " dp_pickerItemActive" : ""}`,
        onClick: () => {
          onChange(option.value);
          setOpen(false);
          setQuery("");
        },
        children: option.label
      })),
      rows.length === 0 && (0, import_jsx_runtime.jsx)("div", { className: "dp_pickerEmpty", children: t("noMatch") })
    ] })
  ];
  return (0, import_jsx_runtime.jsxs)("div", { ref: rootRef, className: "dp_picker", children: [
    (0, import_jsx_runtime.jsx)("button", {
      ref: btnRef,
      type: "button",
      className: "dp_pickerBtn",
      onClick: () => setOpen(!open),
      "aria-haspopup": "listbox",
      "aria-expanded": open,
      title: shown,
      children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_pickerValue", children: shown }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_pickerCaret", children: open ? (0, import_jsx_runtime.jsx)(primitives.IconChevronUpOutline14, { size: 14 }) : (0, import_jsx_runtime.jsx)(primitives.IconChevronDownOutline14, { size: 14 }) })
      ]
    }),
    open && floatReady() && (0, import_jsx_runtime.jsx)(Float, {
      open,
      onClose: () => setOpen(false),
      rootRef,
      anchorRef: btnRef,
      maxHeight: 320,
      children: menuItems
    }),
    open && !floatReady() && (0, import_jsx_runtime.jsxs)("div", { className: "dp_pickerMenu", role: "listbox", children: menuItems })
  ] });
}
function ModelMultiPicker({ selected, onToggle, onClear, knownModels, names, t }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const [query, setQuery] = (0, import_react.useState)("");
  const rootRef = (0, import_react.useRef)(null);
  const btnRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  (0, import_react.useEffect)(() => {
    if (!open || floatReady()) return;
    const onDoc = (e) => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const label = (key) => {
    const { provider, model } = splitModelKey(key);
    return model === "unknown" ? t("unknownModel") : model === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(provider, model);
  };
  const q = query.trim().toLowerCase();
  const rows = (Array.isArray(knownModels) ? knownModels : []).filter((key) => q === "" || label(key).toLowerCase().includes(q));
  const sel = new Set(Array.isArray(selected) ? selected : []);
  const menuItems = [
    (0, import_jsx_runtime.jsx)("input", {
      key: "search",
      className: "dp_pickerSearch",
      type: "text",
      placeholder: t("searchPlaceholder"),
      value: query,
      autoFocus: true,
      onChange: (e) => setQuery(e.target.value)
    }),
    (0, import_jsx_runtime.jsxs)("div", { key: "list", className: "dp_pickerList", children: [
      (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        role: "option",
        "aria-selected": sel.size === 0,
        className: `dp_pickerItem${sel.size === 0 ? " dp_pickerItemActive" : ""}`,
        onClick: () => {
          onClear();
          setOpen(false);
          setQuery("");
        },
        children: t("modelAll")
      }),
      rows.map((key) => (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        role: "option",
        "aria-selected": sel.has(key),
        className: `dp_pickerItem${sel.has(key) ? " dp_pickerItemActive" : ""}`,
        onClick: () => onToggle(key),
        title: label(key),
        children: (0, import_jsx_runtime.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }, children: [
          sel.has(key) && (0, import_jsx_runtime.jsx)("i", { className: "dp_mselDot" }),
          (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: label(key) })
        ] })
      }, key)),
      rows.length === 0 && (0, import_jsx_runtime.jsx)("div", { className: "dp_pickerEmpty", children: t("noMatch") })
    ] })
  ];
  return (0, import_jsx_runtime.jsxs)("div", { ref: rootRef, className: "dp_picker", children: [
    (0, import_jsx_runtime.jsx)("button", {
      ref: btnRef,
      type: "button",
      className: "dp_pickerBtn",
      onClick: () => setOpen(!open),
      "aria-haspopup": "listbox",
      "aria-expanded": open,
      title: sel.size === 0 ? t("modelAll") : [...sel].map(label).join(" \xB7 "),
      children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_pickerValue", children: sel.size === 0 ? t("modelAll") : fill(t("modelCount"), { n: sel.size }) }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_pickerCaret", children: open ? (0, import_jsx_runtime.jsx)(primitives.IconChevronUpOutline14, { size: 14 }) : (0, import_jsx_runtime.jsx)(primitives.IconChevronDownOutline14, { size: 14 }) })
      ]
    }),
    open && floatReady() && (0, import_jsx_runtime.jsx)(Float, {
      open,
      onClose: () => setOpen(false),
      rootRef,
      anchorRef: btnRef,
      maxHeight: 320,
      children: menuItems
    }),
    open && !floatReady() && (0, import_jsx_runtime.jsxs)("div", { className: "dp_pickerMenu", role: "listbox", children: menuItems })
  ] });
}
function HourlyChart({ hours, t }) {
  const [hover, setHover] = (0, import_react.useState)(null);
  const rows = Array.isArray(hours) ? hours : [];
  const sumOf = (h) => (h.input || 0) + (h.cacheRead || 0) + (h.cacheWrite || 0) + (h.output || 0);
  const total = rows.reduce((m, h) => m + sumOf(h), 0);
  const cacheMaxRaw = rows.reduce((m, h) => Math.max(m, h.cacheRead || 0), 0);
  const rightMaxRaw = rows.reduce((m, h) => Math.max(m, (h.input || 0) + (h.cacheWrite || 0), h.output || 0), 0);
  const cacheMax = niceMax(cacheMaxRaw);
  const rightMax = niceMax(rightMaxRaw);
  const px = (i2) => (i2 + 0.5) / 24 * 100;
  const pyCache = (v) => 100 - v / cacheMax * 100;
  const pyRight = (v) => 100 - v / rightMax * 100;
  const lineCache = rows.map((h, i2) => `${px(i2)},${pyCache(h.cacheRead || 0)}`).join(" ");
  const lineIn = rows.map((h, i2) => `${px(i2)},${pyRight((h.input || 0) + (h.cacheWrite || 0))}`).join(" ");
  const lineOut = rows.map((h, i2) => `${px(i2)},${pyRight(h.output || 0)}`).join(" ");
  const hovered = hover !== null && rows[hover] !== void 0 ? rows[hover] : null;
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_hourWrap", children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_chartOuter", children: (0, import_jsx_runtime.jsxs)("div", { className: "dp_hourGrid", children: [
      (0, import_jsx_runtime.jsx)("div", { key: "g0", className: "dp_gridline", style: { top: "0%" } }),
      (0, import_jsx_runtime.jsx)("div", { key: "g50", className: "dp_gridline", style: { top: "50%" } }),
      (0, import_jsx_runtime.jsx)("div", { key: "g100", className: "dp_gridline", style: { top: "100%" } }),
      cacheMaxRaw > 0 && (0, import_jsx_runtime.jsx)("span", { key: "cl0", className: "dp_gridlabel dp_gridlabelAxisL", style: { top: "0%" }, children: fmtTokens(cacheMax) }),
      cacheMaxRaw > 0 && (0, import_jsx_runtime.jsx)("span", { key: "cl50", className: "dp_gridlabel dp_gridlabelAxisL", style: { top: "50%" }, children: fmtTokens(cacheMax / 2) }),
      rightMaxRaw > 0 && (0, import_jsx_runtime.jsx)("span", { key: "rl0", className: "dp_gridlabel", style: { top: "0%" }, children: fmtTokens(rightMax) }),
      rightMaxRaw > 0 && (0, import_jsx_runtime.jsx)("span", { key: "rl50", className: "dp_gridlabel", style: { top: "50%" }, children: fmtTokens(rightMax / 2) }),
      total === 0 && (0, import_jsx_runtime.jsxs)("div", { key: "empty", className: "dp_emptyChart", children: [
        (0, import_jsx_runtime.jsx)(primitives.IconDataOutline16, { size: 20 }),
        (0, import_jsx_runtime.jsx)("span", { children: t("cacheNa") })
      ] }),
      (0, import_jsx_runtime.jsx)("svg", {
        key: "plot",
        className: "dp_hourSvg",
        viewBox: "0 0 100 100",
        preserveAspectRatio: "none",
        "aria-hidden": "true",
        children: [
          (0, import_jsx_runtime.jsx)("polyline", { key: "in", className: "dp_hourLine dp_hourLineIn", points: lineIn }),
          (0, import_jsx_runtime.jsx)("polyline", { key: "cache", className: "dp_hourLine dp_hourLineCache", points: lineCache }),
          (0, import_jsx_runtime.jsx)("polyline", { key: "out", className: "dp_hourLine dp_hourLineOut", points: lineOut })
        ]
      }),
      rows.map((h, i2) => (0, import_jsx_runtime.jsx)("div", {
        key: h.key,
        className: "dp_hourHover",
        style: { left: `${i2 / 24 * 100}%`, width: `${100 / 24}%` },
        onMouseEnter: () => setHover(i2),
        onMouseLeave: () => setHover(null)
      })),
      hovered !== null && (0, import_jsx_runtime.jsx)("div", {
        key: "cursor",
        className: "dp_hourCursor",
        style: { left: `${px(hover)}%` }
      }),
      hovered !== null && (0, import_jsx_runtime.jsx)("div", {
        key: "tip",
        className: "dp_tipAnchor",
        style: { left: `${px(hover)}%` },
        children: (0, import_jsx_runtime.jsx)("div", {
          className: "dp_tip",
          style: hover < 4 ? { left: "0" } : hover >= 20 ? { left: "0", transform: "translateX(-100%)" } : { left: "0", transform: "translateX(-50%)" },
          children: (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
            (0, import_jsx_runtime.jsx)("b", { children: `${hovered.key}:00` }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
            (0, import_jsx_runtime.jsx)("span", { children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) })
          ] })
        })
      })
    ] }) }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_hourXlabels", children: ["00", "06", "12", "18", "23"].map((label) => (0, import_jsx_runtime.jsx)("span", { key: label, children: label })) }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_legend", children: [
      (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { key: "d", className: "dp_legendDot dp_legendIn" }), t("legendInput")] }),
      (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { key: "d", className: "dp_legendDot dp_legendCache" }), t("legendCache")] }),
      (0, import_jsx_runtime.jsxs)("span", { children: [(0, import_jsx_runtime.jsx)("i", { key: "d", className: "dp_legendDot dp_legendOut" }), t("legendOutput")] }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_axisNote", children: t("axisNote") })
    ] })
  ] });
}
function balanceRunwayDays(data, series) {
  if (data?.currency !== "CNY") return null;
  const total = Number(data.total);
  if (!(total > 0)) return null;
  const spends = (Array.isArray(series) ? series : []).map((row) => Number.isFinite(row?.spend) && row.spend > 0 ? row.spend : null).filter((v) => v !== null).slice(-7);
  if (spends.length === 0) return null;
  return Math.max(1, Math.floor(total / (spends.reduce((a, b) => a + b, 0) / spends.length)));
}
function ReconTable({ rows, t }) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r !== null && typeof r === "object");
  if (list.length === 0) return null;
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_consRecon", children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_panelTitle", children: t("reconTableTitle") }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_qTable", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_qTr", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qTh", children: t("reconColDay") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qTh", children: t("reconColOfficial") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qTh", children: t("reconColEst") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qTh", children: t("reconColGap") })
      ] }),
      list.map((row) => {
        const est = (row.est || 0) + (row.aux || 0);
        const official = Number.isFinite(row.official) ? row.official : null;
        const drifted = official !== null && row.sparse !== true && Math.abs(row.gap ?? 0) >= 0.1 && Math.abs(row.gap ?? 0) >= 0.15 * official;
        return (0, import_jsx_runtime.jsxs)("div", { className: "dp_qTr", children: [
          (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd dp_qTdFirst", children: row.key }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd", children: official === null ? "\u2014" : `${row.sparse === true ? "\u2248" : ""}${moneyCny(official)}` }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_qTd", children: moneyCny(est) }),
          (0, import_jsx_runtime.jsx)("span", { className: `dp_qTd${drifted ? " dp_reconGapBad" : ""}`, children: row.gap === null ? "\u2014" : `${(row.gap ?? 0) > 0 ? "+" : ""}${moneyCny(row.gap ?? 0)}` })
        ] }, row.key);
      })
    ] })
  ] });
}
var statSideRow = (label, value, key) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_ringSideRow", children: [
  (0, import_jsx_runtime.jsx)("span", { children: `${label} ` }),
  (0, import_jsx_runtime.jsx)("b", { children: value })
] }, key);
function ModelBars({ models, modelColors, pricing = [], fx, costEnabled = false, monthly = [], names, legendSel = null, onLegendToggle, auxTip = null, bw = false, t }) {
  const rows = (Array.isArray(models) ? models : []).filter((m) => (m.input || 0) + (m.output || 0) + (m.cacheRead || 0) + (m.cacheWrite || 0) > 0).slice(0, 6);
  const accents = (0, import_react.useMemo)(() => modelAccentMap(rows, modelColors, { bw }), [rows, modelColors, bw]);
  const max = rows.reduce((m, r) => Math.max(
    m,
    (r.input || 0) + (r.cacheRead || 0) + (r.cacheWrite || 0) + (r.output || 0)
  ), 0) || 1;
  const costs = (0, import_react.useMemo)(() => rows.map((row) => costOf([row], pricing, fx, monthly)), [rows, pricing, fx, monthly]);
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_listBox", children: [
    rows.length === 0 && (0, import_jsx_runtime.jsx)("div", { className: "dp_ringSideRow", children: (0, import_jsx_runtime.jsx)("span", { children: t("cacheNa") }) }),
    rows.map((row, i2) => {
      const total = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0) + (row.output || 0);
      const inSide = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0);
      const cost = costEnabled === true ? costs[i2] : null;
      const label = row.model === "unknown" ? t("unknownModel") : row.model === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(row.provider ?? "", row.model);
      const toggleable = typeof onLegendToggle === "function" && row.key !== void 0;
      const dimmed = legendSel !== null && !legendSel.has(row.key ?? modelKey(row.provider ?? "", row.model));
      return (0, import_jsx_runtime.jsxs)("div", {
        className: `dp_barRow${toggleable ? " dp_barRowBtn" : ""}${dimmed ? " dp_barRowDim" : ""}`,
        onClick: toggleable ? () => onLegendToggle(row.key ?? modelKey(row.provider ?? "", row.model)) : void 0,
        role: toggleable ? "button" : void 0,
        title: row.model === AUX_MODEL_KEY && auxTip !== null ? auxTip : toggleable ? t("legendFilterHint") : row.key ?? row.model,
        children: [
          (0, import_jsx_runtime.jsx)("span", { className: "dp_barRowName", children: label }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_barRowTrack", children: (0, import_jsx_runtime.jsx)("span", {
            className: `dp_barRowFill${accentEntryOf(accents, row.provider ?? "", row.model)?.custom === true ? " dp_accentCustom" : ""}`,
            style: { width: `${total / max * 100}%`, "--dp-accent-fill": accentEntryOf(accents, row.provider ?? "", row.model)?.fill }
          }) }),
          (0, import_jsx_runtime.jsxs)("span", {
            className: "dp_barRowVal",
            title: `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(row.output || 0) })}`,
            children: [
              fmtTokens(total),
              cost !== null && cost.configured === true ? (0, import_jsx_runtime.jsx)("span", { className: "dp_barRowCost", children: `${fmtCost(cost.total ?? 0)} CNY` }) : null
            ]
          })
        ]
      }, row.key ?? row.model);
    })
  ] });
}
function ProjectTable({ projects, topProjects, onSelect, t }) {
  const cap = Number(topProjects) > 0 ? Math.floor(Number(topProjects)) : 8;
  const rows = (Array.isArray(projects) ? projects : []).slice(0, cap);
  const max = rows.reduce((m, r) => Math.max(m, r.total || 0), 0) || 1;
  const clickable = typeof onSelect === "function";
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_table", children: [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_tableRow dp_tableHead", children: [
      (0, import_jsx_runtime.jsx)("span", { children: t("colRank") }),
      (0, import_jsx_runtime.jsx)("span", { children: t("colProject") }),
      (0, import_jsx_runtime.jsx)("span", { style: { textAlign: "right" }, children: t("colSessions") }),
      (0, import_jsx_runtime.jsx)("span", { style: { textAlign: "right" }, children: t("colTokens") }),
      (0, import_jsx_runtime.jsx)("span", { children: "" })
    ] }),
    rows.map((row, i2) => {
      const total = row.total || 0;
      const inSide = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0);
      const name = row.project === null || row.project === void 0 || row.project === "" ? t("noWorkspace") : row.project;
      const projectCell = clickable ? (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        className: "dp_tableName dp_tableNameBtn",
        title: name,
        onClick: () => onSelect(row.project),
        children: name
      }) : (0, import_jsx_runtime.jsx)("span", { className: "dp_tableName", title: name, children: name });
      return (0, import_jsx_runtime.jsxs)("div", { className: "dp_tableRow", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_tableRank", children: String(i2 + 1) }),
        projectCell,
        (0, import_jsx_runtime.jsx)("span", { className: "dp_tableNum", children: String(row.sessions || 0) }),
        (0, import_jsx_runtime.jsx)("span", {
          className: "dp_tableTokens",
          title: `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(row.output || 0) })}`,
          children: fmtTokens(total)
        }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_tableTrack", children: (0, import_jsx_runtime.jsx)("span", { className: "dp_barRowTrack", children: (0, import_jsx_runtime.jsx)("span", { className: "dp_barRowFill", style: { width: `${total / max * 100}%` } }) }) })
      ] }, `${row.project ?? ""}#${i2}`);
    })
  ] });
}
function SessionDetail({ sessionId, pricing = [], fx = {}, monthly = [], costEnabled = true, models = [], auxShape = null, catalog = null, names, t }) {
  const [state, setState] = (0, import_react.useState)({ status: "loading", data: null, error: null });
  const [breaks, setBreaks] = (0, import_react.useState)([]);
  const svgRef = (0, import_react.useRef)(null);
  const [drag, setDrag] = (0, import_react.useState)(null);
  const [zoom, setZoom] = (0, import_react.useState)(null);
  const [hoverTurn, setHoverTurn] = (0, import_react.useState)(null);
  const vFromRef = (0, import_react.useRef)(0);
  const vSpanRef = (0, import_react.useRef)(1);
  (0, import_react.useEffect)(() => {
    let alive = true;
    setState({ status: "loading", data: null, error: null });
    setBreaks([]);
    setZoom(null);
    fetch(`/pulse/session?id=${encodeURIComponent(sessionId)}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" }
    }).then(async (res) => {
      httpError(res);
      return res.json();
    }).then((data) => {
      if (alive) setState({ status: "ready", data, error: null });
    }).catch((error) => {
      if (alive) setState({ status: "error", data: null, error: String(error?.message ?? error) });
    });
    return () => {
      alive = false;
    };
  }, [sessionId]);
  const modelSet = modelFilterSet("", models);
  const events = (Array.isArray(state.data?.events) ? state.data.events : []).filter((e) => e !== null && typeof e === "object" && keyMatchesFilter(modelSet, e.key)).sort((a, b) => a.t - b.t);
  const minT = events.length > 0 ? events[0].t : 0;
  const maxT = events.length > 0 ? events[events.length - 1].t : 1;
  const fullSpan = Math.max(1, maxT - minT);
  const MIN_ZOOM_MS = 1e3;
  (0, import_react.useEffect)(() => {
    const el = svgRef.current;
    if (!el) return void 0;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const anchor = vFromRef.current + ratio * vSpanRef.current;
      const factor = e.deltaY < 0 ? 1 / 1.25 : 1.25;
      const nextSpan = Math.max(MIN_ZOOM_MS, Math.min(Math.max(1, vSpanRef.current * factor), fullSpan));
      const anchorRatio = (anchor - vFromRef.current) / vSpanRef.current;
      const from = Math.max(minT, Math.min(anchor - nextSpan * anchorRatio, maxT - nextSpan));
      setZoom({ from, to: from + nextSpan });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [state.status, minT, maxT, fullSpan]);
  if (state.status === "loading") {
    return (0, import_jsx_runtime.jsx)("div", { className: "dp_sessDetail", children: (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg", children: t("loading") }) });
  }
  if (state.status === "error") {
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_sessDetail", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsgErr", children: fill(t("sessionLoadFailed"), { err: state.error }) })
    ] });
  }
  if (events.length === 0) {
    return (0, import_jsx_runtime.jsx)("div", { className: "dp_sessDetail", children: (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg", children: t("sessionNoUsage") }) });
  }
  const vFrom = zoom === null ? minT : Math.max(minT, Math.min(zoom.from, maxT - Math.max(1, zoom.to - zoom.from)));
  const vTo = zoom === null ? maxT : Math.max(vFrom + 1, Math.min(zoom.to, maxT));
  const vSpan = Math.max(1, vTo - vFrom);
  vFromRef.current = vFrom;
  vSpanRef.current = vSpan;
  let sum = 0;
  const cumulative = events.map((e) => {
    sum += (e.i || 0) + (e.o || 0) + (e.cr || 0) + (e.cw || 0);
    return { t: e.t, y: sum };
  });
  const fullYMax = cumulative.length > 0 ? cumulative[cumulative.length - 1].y : 1;
  const W = 1e3;
  const H = 120;
  const x = (t2) => (t2 - vFrom) / vSpan * W;
  let startY = 0;
  for (const p of cumulative) {
    if (p.t <= vFrom) startY = p.y;
    else break;
  }
  const visible = cumulative.filter((p) => p.t >= vFrom && p.t <= vTo);
  const lastY = visible.length > 0 ? visible[visible.length - 1].y : startY;
  const ys = [startY, ...visible.map((p) => p.y)];
  const vMinY = zoom === null ? 0 : Math.min(...ys);
  const vMaxY = zoom === null ? fullYMax : Math.max(...ys);
  const vRangeY = Math.max(1, vMaxY - vMinY);
  const y = (v) => H - (v - vMinY) / vRangeY * H;
  const points = [{ t: vFrom, y: startY }, ...visible, { t: vTo, y: lastY }].map((p) => `${x(p.t).toFixed(2)},${y(p.y).toFixed(2)}`).join(" ");
  const turns = Array.isArray(state.data?.turns) ? state.data.turns : [];
  const segments = breaksSegments(events, breaks, { pricing, fx, monthly, models, catalog });
  const auxEvents = (Array.isArray(state.data?.aux) ? state.data.aux : []).filter((e) => e !== null && typeof e === "object" && Number.isFinite(e.t));
  const billShape = auxShape !== null && typeof auxShape === "object" ? auxShape : AUX_SHAPE;
  let auxSearchN = 0;
  let auxTitleN = 0;
  let auxCost = 0;
  if (auxEvents.length > 0 && costEnabled) {
    const maps = ruleMaps(pricing);
    const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
    const usd = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
    for (const e of auxEvents) {
      const priceAs = e.kind === "title" && typeof e.key === "string" && e.key !== "" ? e.key : modelKey("", AUX_PRICE_AS);
      if (e.kind === "title" && !isOfficialProvider(splitModelKey(priceAs).provider)) continue;
      if (monthlySet.has(splitModelKey(priceAs).provider)) {
        if (e.kind === "search") auxSearchN += 1;
        else auxTitleN += 1;
        continue;
      }
      const rule = ruleFor(maps, priceAs);
      if (rule === void 0) continue;
      const rates = resolveRates(rule);
      const conv = rule.currency === "USD" ? usd : 1;
      const tier = tierAtMs(e.t, rule.peakHours);
      if (e.kind === "search") {
        auxSearchN += 1;
        auxCost += priceTier({ input: billShape.miss, cacheRead: billShape.hit, output: billShape.out, cacheWrite: 0 }, rates, tier) * conv;
      } else {
        auxTitleN += 1;
        auxCost += priceTier({ input: e.in || 0, cacheRead: 0, output: e.out || 0, cacheWrite: 0 }, rates, tier) * conv;
      }
    }
  }
  const SNAP_PX = 8;
  const tFromPointer = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return minT;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const t2 = Math.round(vFrom + ratio * vSpan);
    const scale = W / rect.width;
    let best = t2;
    let bestD = SNAP_PX * scale;
    for (const tr of turns) {
      const d = Math.abs(x(tr.start) - x(t2));
      if (d < bestD) {
        bestD = d;
        best = tr.start;
      }
    }
    return best;
  };
  const commitBreak = (t2) => setBreaks((prev) => prev.length >= 3 || prev.includes(t2) ? prev : [...prev, t2].sort((a, b) => a - b));
  const removeBreak = (bt) => setBreaks((prev) => prev.filter((b) => b !== bt));
  const HOVER_PX = 14;
  const nearestTurn = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const at = vFrom + ratio * vSpan;
    let best = null;
    let bestD = HOVER_PX * W / Math.max(1, rect.width);
    for (let i2 = 0; i2 < turns.length; i2 += 1) {
      const d = Math.abs(turns[i2].start - at);
      if (d < bestD) {
        bestD = d;
        best = i2;
      }
    }
    return best;
  };
  const turnTokenTotal = (tr) => events.reduce(
    (sum2, e) => e.t >= tr.start && e.t < tr.end ? sum2 + (e.i || 0) + (e.o || 0) + (e.cr || 0) + (e.cw || 0) : sum2,
    0
  );
  const hoverInfo = hoverTurn === null || turns[hoverTurn] === void 0 ? null : (() => {
    const tr = turns[hoverTurn];
    return {
      preview: tr.preview ?? null,
      when: fmtClockMs(tr.start),
      duration: quotaDur(Math.max(0, tr.end - tr.start), t),
      tokens: fmtTokens(turnTokenTotal(tr)),
      left: `${(tr.start - vFrom) / vSpan * 100}%`
    };
  })();
  const probeStrip = hoverInfo === null ? null : (0, import_jsx_runtime.jsx)("span", {
    className: "dp_turnProbe",
    style: { left: hoverInfo.left },
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDrag({ t: turns[hoverTurn].start });
    },
    onPointerMove: (e) => {
      if (drag !== null) setDrag({ t: tFromPointer(e.clientX) });
    },
    onPointerUp: (e) => {
      if (drag === null) return;
      commitBreak(tFromPointer(e.clientX));
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null)
  });
  const hoverCardNode = hoverInfo === null ? null : (0, import_jsx_runtime.jsxs)("div", { className: "dp_turnInfo", children: [
    hoverInfo.preview !== null && (0, import_jsx_runtime.jsx)("div", { className: "dp_turnPreview", children: hoverInfo.preview }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_turnMeta", children: [
      (0, import_jsx_runtime.jsx)("span", { children: hoverInfo.when }),
      (0, import_jsx_runtime.jsx)("span", { children: fill(t("turnDuration"), { v: hoverInfo.duration }) }),
      (0, import_jsx_runtime.jsx)("span", { children: fill(t("turnTokens"), { v: hoverInfo.tokens }) })
    ] })
  ] });
  const hoverNode = hoverInfo === null ? null : HoverCardPrim !== null ? (0, import_jsx_runtime.jsx)(HoverCardPrim, { anchor: probeStrip, content: hoverCardNode, variant: "compact", openDelayMs: 120, disabled: drag !== null }) : (0, import_jsx_runtime.jsx)("span", { className: "dp_curveTag dp_turnTagFallback", style: { left: hoverInfo.left }, children: hoverInfo.preview ?? hoverInfo.when });
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_sessDetail", children: [
    auxEvents.length > 0 && (0, import_jsx_runtime.jsxs)("div", { className: "dp_auxBill", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_auxBillName", children: t("detailAuxTitle") }),
      (0, import_jsx_runtime.jsx)("span", { children: fill(t("detailAuxLine"), { s: auxSearchN, t: auxTitleN }) }),
      costEnabled && auxCost > 0 && (0, import_jsx_runtime.jsx)("span", { children: `\u2248${fmtCost(auxCost)} CNY` })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_curveWrap", onPointerLeave: () => setHoverTurn(null), children: [
      (0, import_jsx_runtime.jsx)("svg", {
        ref: svgRef,
        viewBox: `0 0 ${W} ${H}`,
        preserveAspectRatio: "none",
        style: { width: "100%", height: 84, display: "block", cursor: "crosshair", touchAction: "none" },
        onPointerDown: (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setDrag({ t: tFromPointer(e.clientX) });
        },
        onPointerMove: (e) => {
          if (drag !== null) setDrag({ t: tFromPointer(e.clientX) });
          else setHoverTurn(nearestTurn(e.clientX));
        },
        onPointerUp: (e) => {
          if (drag === null) return;
          commitBreak(tFromPointer(e.clientX));
          setDrag(null);
        },
        onPointerCancel: () => setDrag(null),
        children: [
          (0, import_jsx_runtime.jsx)("polyline", { key: "line", points, fill: "none", stroke: "var(--dsw-alias-state-business-primary)", strokeWidth: 2 }),
          turns.map((tr, i2) => (0, import_jsx_runtime.jsx)("line", {
            key: `t${i2}`,
            x1: x(tr.start),
            y1: 0,
            x2: x(tr.start),
            y2: H,
            stroke: "rgba(127,127,127,.5)",
            strokeDasharray: "3 3",
            strokeWidth: 1
          })),
          breaks.map((b, i2) => (0, import_jsx_runtime.jsx)("line", {
            key: `b${i2}`,
            x1: x(b),
            y1: 0,
            x2: x(b),
            y2: H,
            stroke: "var(--dsw-alias-color-danger, #e5484d)",
            strokeWidth: 2
          })),
          drag !== null && (0, import_jsx_runtime.jsx)("line", {
            key: "preview",
            x1: x(drag.t),
            y1: 0,
            x2: x(drag.t),
            y2: H,
            stroke: "var(--dsw-alias-state-business-primary)",
            strokeWidth: 2,
            strokeDasharray: "4 3"
          })
        ]
      }),
      drag !== null && (0, import_jsx_runtime.jsx)("span", { className: "dp_curveTag", style: { left: `${(drag.t - vFrom) / vSpan * 100}%` }, children: fmtClockMs(drag.t) }),
      hoverNode
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_breakRow", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_breakHint", children: t("sessionAddBreak") }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_breakTurn", children: t("sessionTurnHint") }),
      zoom !== null && (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        className: "dp_breakChip dp_zoomReset",
        onClick: () => setZoom(null),
        title: t("sessionZoomReset"),
        children: `${t("sessionZoomed")} ${fmtClockMs(vFrom)} \u2192 ${fmtClockMs(vTo)} \xB7 ${t("sessionZoomReset")}`
      }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_breakCount", children: `${t("sessionBreaks")} ${breaks.length}/3` }),
      breaks.map((b) => {
        const bt = turns.find((tr) => tr.start === b);
        return (0, import_jsx_runtime.jsx)("button", {
          key: b,
          type: "button",
          className: "dp_breakChip",
          onClick: () => removeBreak(b),
          title: bt?.preview ?? void 0,
          children: `\u2715 ${fmtClockMs(b)}${bt?.preview ? ` \xB7 ${bt.preview}` : ""}`
        });
      })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_segTable", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_tableRow dp_tableHead", children: [
        (0, import_jsx_runtime.jsx)("span", { children: t("sessionSegment") }),
        (0, import_jsx_runtime.jsx)("span", { children: `${t("sessionSegFrom")} \u2192 ${t("sessionSegTo")}` }),
        (0, import_jsx_runtime.jsx)("span", { children: t("sessionTopModel") }),
        (0, import_jsx_runtime.jsx)("span", { style: { textAlign: "right" }, children: t("colTokens") }),
        (0, import_jsx_runtime.jsx)("span", { style: { textAlign: "right" }, children: t("chipCost") })
      ] }),
      segments.map((seg, i2) => {
        const inSide = (seg.tokens.input || 0) + (seg.tokens.cacheRead || 0) + (seg.tokens.cacheWrite || 0);
        const range = `${fmtClockMs(seg.from)} \u2192 ${fmtClockMs(seg.to)}`;
        const tokenTotal = (seg.tokens.input || 0) + (seg.tokens.output || 0) + (seg.tokens.cacheRead || 0) + (seg.tokens.cacheWrite || 0);
        const isGap = (Array.isArray(seg.models) ? seg.models.length : 0) === 0 && tokenTotal === 0;
        const top = seg.models && seg.models[0];
        const topKey = top ? splitModelKey(top.key) : null;
        const topLabel = top ? typeof names?.fullLabelOf === "function" ? names.fullLabelOf(top.provider ?? topKey.provider, topKey.model) : topKey.model : "\u2014";
        const cost = seg.monthly === true ? t("sessionMonthly") : costEnabled === true && seg.cost?.configured === true && seg.cost.total > 0 ? `${fmtCost(seg.cost.total)} CNY` : "\u2014";
        return (0, import_jsx_runtime.jsxs)("div", { className: "dp_tableRow", children: [
          (0, import_jsx_runtime.jsx)("span", { className: "dp_tableRank", children: String(i2 + 1) }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_tableName", title: range, children: range }),
          (0, import_jsx_runtime.jsx)("span", {
            className: "dp_tableName",
            title: isGap ? t("sessionGapHint") : topLabel,
            children: isGap ? t("sessionGap") : topLabel
          }),
          (0, import_jsx_runtime.jsx)("span", {
            className: "dp_tableNum",
            title: isGap ? t("sessionGapHint") : `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(seg.tokens.output || 0) })}`,
            children: isGap ? "\u2014" : fmtTokens(tokenTotal)
          }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_tableNum", children: isGap ? "\u2014" : cost })
        ] }, i2);
      })
    ] })
  ] });
}
function relLabel(day, t) {
  if (relativeTimePrim === null || typeof day !== "string" || day.length !== 10) return null;
  const at = (/* @__PURE__ */ new Date(`${day}T12:00:00`)).getTime();
  if (!Number.isFinite(at)) return null;
  const bucket = relativeTimePrim(at, Date.now());
  const key = bucket.unit === "now" ? "relNow" : `rel${bucket.unit[0].toUpperCase()}${bucket.unit.slice(1)}`;
  return fill(t(key), { n: bucket.n });
}
function SessionsPanel({ groups = [], costEnabled = true, pricing = [], fx = {}, monthly = [], models = [], auxShape = null, catalog = null, names, t, focusSessionId = null }) {
  const [open, setOpen] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [detail, setDetail] = (0, import_react.useState)(null);
  const isCurrent = (s) => focusSessionId !== null && focusSessionId !== void 0 && s?.id !== null && s?.id !== void 0 && String(s.id) === String(focusSessionId);
  const autoOpened = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    if (autoOpened.current || focusSessionId === null || focusSessionId === void 0) return;
    for (const g of groups) {
      if ((g.sessions ?? []).some(isCurrent)) {
        autoOpened.current = true;
        const name = g.project === null ? t("noWorkspace") : g.project;
        setOpen((prev) => {
          if (prev.has(name)) return prev;
          const next = new Set(prev);
          next.add(name);
          return next;
        });
        break;
      }
    }
  });
  const toggleProject = (label) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    return next;
  });
  if (groups.length === 0) {
    return (0, import_jsx_runtime.jsx)("div", { className: "dp_setMsg", children: t("sessionNoUsage") });
  }
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_sessList", children: groups.map((group) => {
    const name = group.project === null ? t("noWorkspace") : group.project;
    const expanded = open.has(name);
    const subCost = group.subagentSessions === 0 ? "\u2014" : group.subagentMonthly === true ? t("sessionMonthly") : costEnabled && group.subagentCost?.configured === true && group.subagentCost.total > 0 ? `${fmtCost(group.subagentCost.total)} CNY` : "\u2014";
    const sessions = focusSessionId === null ? group.sessions : [...group.sessions].sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)));
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_sessGroup", children: [
      (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "dp_sessHead", onClick: () => toggleProject(name), children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_sessName", children: name }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_sessMeta", children: `${fill(t("sessionMainCount"), { n: group.mainSessions })} \xB7 ${fill(t("sessionSubCount"), { n: group.subagentSessions })}` }),
        group.subagentSessions > 0 && (0, import_jsx_runtime.jsx)("span", { className: "dp_sessSubTotal", children: fill(t("sessionSubTotal"), {
          tokens: fmtTokens((group.subagentTokens.input || 0) + (group.subagentTokens.output || 0) + (group.subagentTokens.cacheRead || 0) + (group.subagentTokens.cacheWrite || 0)),
          cost: subCost
        }) }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_sessToggle", children: expanded ? t("sessionCollapse") : t("sessionExpand") })
      ] }),
      expanded && (0, import_jsx_runtime.jsxs)("div", { className: "dp_sessBody", children: [
        sessions.map((s) => {
          const { provider: sp, model: sm } = splitModelKey(s.topModel ?? "");
          const modelLabel = s.topModel !== null && s.topModel !== void 0 ? typeof names?.labelOf === "function" ? names.labelOf(sp, sm) : sm : "\u2014";
          const cost = s.monthly === true ? t("sessionMonthly") : costEnabled === true && s.cost?.configured === true && s.cost.total > 0 ? `${fmtCost(s.cost.total)} CNY` : "\u2014";
          const detailOpen = detail === s.id;
          const modelRow = (mr) => {
            const rm = mr.model ?? splitModelKey(mr.key).model;
            const rp = mr.provider ?? splitModelKey(mr.key).provider;
            const mrLabel = (typeof names?.fullLabelOf === "function" ? names.fullLabelOf(rp, rm) : rm) || "\u2014";
            const mrCost = mr.monthly === true ? t("sessionMonthly") : costEnabled === true && mr.cost?.configured === true && mr.cost.total > 0 ? `${fmtCost(mr.cost.total)} CNY` : "\u2014";
            return (0, import_jsx_runtime.jsxs)("div", { className: "dp_sessModelRow", children: [
              (0, import_jsx_runtime.jsx)("span", { className: "dp_sessModelName", title: mrLabel, children: mrLabel }),
              (0, import_jsx_runtime.jsx)("span", { className: "dp_sessNum", children: fmtTokens((mr.tokens.input || 0) + (mr.tokens.output || 0) + (mr.tokens.cacheRead || 0) + (mr.tokens.cacheWrite || 0)) }),
              (0, import_jsx_runtime.jsx)("span", { className: "dp_sessNum", children: mrCost })
            ] }, mr.key);
          };
          const current = isCurrent(s);
          return (0, import_jsx_runtime.jsxs)("div", { className: `dp_sessRow${current ? " dp_sessRowCurrent" : ""}`, children: [
            (0, import_jsx_runtime.jsx)(Tag, { tone: "neutral", fallbackClass: s.subagent ? "dp_sessBadge dp_sessBadgeSub" : "dp_sessBadge", children: s.subagent ? `${t("sessionSub")}${s.delegationDepth > 0 ? " " + s.delegationDepth : ""}` : t("sessionMain") }),
            current && (0, import_jsx_runtime.jsx)(Tag, { tone: "solid", fallbackClass: "dp_sessBadge dp_sessBadgeCurrent", children: t("sessionCurrent") }),
            // 辅助调用徽标：纯文本「搜索 ×N」，不用 emoji。计数是
            // 该会话在窗口内的实测请求次数，与模型筛选一致。
            s.auxSearch > 0 && (0, import_jsx_runtime.jsx)(Tag, { tone: "info", fallbackClass: "dp_sessBadge", children: fill(t("auxBadge"), { n: s.auxSearch }) }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_sessTitle", title: s.title ?? void 0, children: s.title ?? (s.id === null || s.id === void 0 ? "\u2014" : String(s.id).slice(-8)) }),
            s.day && (0, import_jsx_runtime.jsx)("span", { className: "dp_sessRel", title: s.day, children: relLabel(s.day, t) }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_sessModel", title: modelLabel, children: modelLabel }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_sessNum", children: fmtTokens((s.tokens.input || 0) + (s.tokens.output || 0) + (s.tokens.cacheRead || 0) + (s.tokens.cacheWrite || 0)) }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_sessNum", children: cost }),
            (0, import_jsx_runtime.jsx)(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_miniBtn", onClick: () => setDetail(detailOpen ? null : s.id), children: t("sessionOpenDetail") }),
            (0, import_jsx_runtime.jsx)("div", { className: "dp_sessModels", children: (Array.isArray(s.modelRows) ? s.modelRows : []).map(modelRow) }),
            detailOpen && (0, import_jsx_runtime.jsx)(SessionDetail, { key: s.id, sessionId: s.id, pricing, fx, monthly, costEnabled, models, auxShape, catalog, names, t })
          ] }, s.id ?? i);
        })
      ] })
    ] }, name);
  }) });
}
function focusProjectLabel(data, focus) {
  if (focus === null || !Array.isArray(data?.sessions)) return null;
  const id = focus.id === null || focus.id === void 0 ? "" : String(focus.id);
  if (id !== "") {
    const own = data.sessions.find((s) => s?.id !== null && s?.id !== void 0 && String(s.id) === id);
    if (typeof own?.project === "string" && own.project !== "") return own.project;
  }
  const cwd = typeof focus.cwd === "string" ? focus.cwd : "";
  if (cwd === "") return null;
  const parts = cwd.split(/[\\/]/).filter((p) => p.length > 0);
  for (let d = 1; d <= Math.min(3, parts.length); d += 1) {
    const label = parts.slice(-d).join("/");
    if (data.sessions.some((s) => s?.project === label)) return label;
  }
  return null;
}

// src/client/heroCard.js
function HeroCard({
  balance,
  quota,
  series,
  sessions,
  cost,
  totals,
  estOn,
  balanceOn,
  quotaOn,
  cacheOn,
  quotaOpenable,
  openX = null,
  onHot,
  onConfigure,
  rangeLabel = null,
  activityLine = null,
  t
}) {
  const balanceData = balance.data;
  const balanceResolved = balanceData !== null && balanceData.configured === true && balanceData.ok === true;
  const balanceError = balanceOn && (balance.error !== null || balanceData !== null && balanceData.configured === true && balanceData.ok !== true);
  const runway = balanceResolved ? balanceRunwayDays(balanceData, series) : null;
  const balMoney = balanceResolved ? moneyParts(balanceData.total ?? 0, balanceData.currency) : null;
  const now = Date.now();
  const busy = balance.busy === true || quota.busy === true;
  const refreshCard = () => {
    balance.refresh();
    if (quotaOn) quota.refresh();
  };
  const estHot = estOn && typeof onHot === "function";
  const quotaHot = quotaOn && quotaOpenable && typeof onHot === "function";
  const hotProps = (x, hot) => hot ? {
    role: "button",
    tabIndex: 0,
    "aria-expanded": openX === x,
    "aria-controls": "dp-pulse-expand",
    onClick: () => onHot(x),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onHot(x);
      }
    }
  } : {};
  const unpricedList = Array.isArray(cost.unpricedModels) ? cost.unpricedModels : [];
  const unpricedTotal = (cost.unpriced?.input || 0) + (cost.unpriced?.output || 0);
  const unpricedNote = cost.configured === true && unpricedTotal >= UNPRICED_HINT_TOKENS ? onConfigure === void 0 ? (0, import_jsx_runtime.jsx)("span", { className: "dp_consNote", children: t("unpricedHint") }) : (0, import_jsx_runtime.jsx)("button", {
    type: "button",
    className: "dp_consNote dp_chipNoteBtn",
    title: unpricedList.length > 0 ? unpricedList.map((row) => `${row.key} ${fmtTokens(row.total ?? 0)}`).join(" \xB7 ") : fill(t("unpriced"), { n: fmtTokens(unpricedTotal) }),
    onClick: (e) => {
      e.stopPropagation();
      onConfigure();
    },
    children: t("unpricedHint")
  }) : null;
  const fxNote = cost.configured === true && unpricedNote === null && (cost.convertedFromUsd || 0) > 0 ? fill(t("fxNote"), { r: cost.usdToCny }) : null;
  const estBlk = estOn && (0, import_jsx_runtime.jsxs)("div", { className: `dp_hBlk dp_hEst${estHot ? " dp_hHot" : ""}`, ...hotProps("est", estHot), children: [
    (0, import_jsx_runtime.jsxs)("span", { className: "dp_hHead", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_consLabel", children: t("chipCost") }),
      rangeLabel !== null && (0, import_jsx_runtime.jsx)("span", { className: "dp_hRange", children: rangeLabel })
    ] }),
    // 无值不穿主值尺寸：未配置的「未配置单价」是注解级安静态，
    // 显著度由去定价按钮的下划线承载，不靠字号。
    cost.configured === true ? (0, import_jsx_runtime.jsx)("span", { className: "dp_consHeroVal", children: moneyParts(cost.total ?? 0, "CNY").text }) : onConfigure !== void 0 ? (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_chipValueBtn", onClick: (e) => {
      e.stopPropagation();
      onConfigure();
    }, children: t("costGoSet") }) : (0, import_jsx_runtime.jsx)("span", { className: "dp_consNote dp_costOff", children: t("costOff") }),
    unpricedNote,
    fxNote !== null && (0, import_jsx_runtime.jsx)("span", { className: "dp_consNote", title: fxNote, children: fxNote })
  ] });
  const balBlk = balanceOn && (balanceResolved || balanceError) && (0, import_jsx_runtime.jsxs)("div", { className: "dp_hBlk dp_hBal", children: [
    (0, import_jsx_runtime.jsxs)("span", { className: "dp_hHead", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_consLabel", children: t("balanceTitle") }),
      balanceResolved && runway !== null && (0, import_jsx_runtime.jsx)("span", {
        className: runway < 3 ? "dp_hBadge dp_hBadgeLow" : "dp_hBadge",
        children: runway < 3 ? fill(t("runwayLow"), { n: runway }) : fill(t("runwayDays"), { n: runway })
      })
    ] }),
    balanceResolved && (0, import_jsx_runtime.jsxs)("span", { className: "dp_consHeroVal", children: [
      balMoney.text,
      balMoney.unit !== "" && (0, import_jsx_runtime.jsx)("span", { className: "dp_consUnit", children: ` ${balMoney.unit}` })
    ] }),
    balanceResolved && (0, import_jsx_runtime.jsxs)("span", { className: "dp_hMetrics", children: [
      Number(balanceData.granted) > 0 && (0, import_jsx_runtime.jsxs)("span", { className: "dp_hMetric", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_consLabel", children: t("consStatGranted") }),
        (0, import_jsx_runtime.jsx)("b", { className: "dp_hMetricOk", children: fmtCost(balanceData.granted) })
      ] }, "granted"),
      Number(balanceData.topped) > 0 && (0, import_jsx_runtime.jsxs)("span", { className: "dp_hMetric", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_consLabel", children: t("consStatTopped") }),
        (0, import_jsx_runtime.jsx)("b", { children: fmtCost(balanceData.topped) })
      ] }, "topped"),
      balanceData.isAvailable !== true && (0, import_jsx_runtime.jsx)("span", { className: "dp_balanceWarn", children: t("balanceUnavailable") }, "warn")
    ] }),
    !balanceResolved && (0, import_jsx_runtime.jsx)("span", {
      className: "dp_consNote",
      title: fill(t("balanceFailed"), { err: balance.error ?? balanceData?.error ?? "?" }),
      children: fill(t("balanceFailed"), { err: balance.error ?? balanceData?.error ?? "?" })
    }),
    !balanceResolved && (0, import_jsx_runtime.jsx)(Btn, {
      variant: "ghost",
      size: "sm",
      fallbackClass: "dp_miniBtn",
      onClick: (e) => {
        e.stopPropagation();
        balance.refresh();
      },
      disabled: balance.busy,
      children: t("retry")
    })
  ] });
  const providers = Array.isArray(quota.data?.providers) ? quota.data.providers : [];
  const okEntries = quotaRankEntries(providers.filter((entry) => entry.ok === true), Array.isArray(sessions) ? sessions : [], now);
  const shownQuota = okEntries.slice(0, 2);
  const restQuota = okEntries.slice(2);
  const actionableQuota = quotaOn ? providers.filter((entry) => entry.ok !== true && entry.disabled !== true) : [];
  const quotaRow = (entry) => {
    const windows = Array.isArray(entry.windows) ? entry.windows : [];
    return (0, import_jsx_runtime.jsxs)("span", { className: "dp_qwRow", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_qName", title: quotaEntryName(entry), children: quotaEntryName(entry) }),
      (0, import_jsx_runtime.jsxs)("span", { className: "dp_qWins", children: windows.map((w) => {
        const pct = w.usedPct === null || w.usedPct === void 0 ? "\u2014" : `${Math.round(w.usedPct)}%`;
        const resetIn = w.resetsAt !== null && w.resetsAt !== void 0 && w.resetsAt > now ? fill(t("quotaResetIn"), { v: quotaDur(w.resetsAt - now, t) }) : null;
        const label = `${quotaWindowLabel(w.id, t)} ${pct}`;
        const anchor = (0, import_jsx_runtime.jsxs)("span", {
          className: "dp_qwWin",
          title: TooltipPrim === null ? resetIn === null ? label : `${label} \xB7 ${resetIn}` : void 0,
          children: [
            (0, import_jsx_runtime.jsx)("span", { className: "dp_qwTag", children: quotaWindowLabel(w.id, t) }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_qwTrack", children: (0, import_jsx_runtime.jsx)("span", { className: quotaWindowCls(w.usedPct), style: { width: `${Math.max(2, Math.min(100, w.usedPct ?? 0))}%` } }) }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_qwPct", children: pct })
          ]
        }, w.id);
        if (TooltipPrim === null || resetIn === null) return anchor;
        return (0, import_jsx_runtime.jsx)(TooltipPrim, { label: resetIn, side: "top", portal: true, delayMs: 300, children: anchor }, w.id);
      }) })
    ] }, entry.provider);
  };
  const quotaBlk = quotaOn && (shownQuota.length > 0 || actionableQuota.length > 0) && (0, import_jsx_runtime.jsxs)("div", { className: `dp_hBlk dp_hQuota${quotaHot ? " dp_hHot" : ""}`, ...hotProps("quota", quotaHot), children: [
    (0, import_jsx_runtime.jsxs)("span", { className: "dp_hHead", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_consLabel", children: t("quotaTitle") }),
      okEntries.length > 0 && (0, import_jsx_runtime.jsx)("span", { className: "dp_hRange", children: fill(t("quotaPlanCount"), { n: okEntries.length }) })
    ] }),
    (0, import_jsx_runtime.jsxs)("span", { className: "dp_qChips", children: [
      shownQuota.map(quotaRow),
      restQuota.length > 0 && (0, import_jsx_runtime.jsx)("span", {
        className: "dp_qAux",
        title: fill(t("quotaMoreTitle"), { names: restQuota.map((entry) => quotaEntryName(entry)).join(" \xB7 ") }),
        children: `+${restQuota.length}`
      }, "quota-more"),
      actionableQuota.map((entry) => (0, import_jsx_runtime.jsxs)("span", { className: "dp_qwRow", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qName", children: quotaEntryName(entry) }),
        (0, import_jsx_runtime.jsxs)("span", { className: "dp_qwErr", children: [
          (0, import_jsx_runtime.jsx)("span", { children: entry.configured === false ? t("quotaNoCred") : fill(t("quotaFailed"), { err: entry.error ?? "?" }) }),
          entry.configured === true && (0, import_jsx_runtime.jsx)(Btn, {
            variant: "ghost",
            size: "sm",
            fallbackClass: "dp_miniBtn",
            onClick: (e) => {
              e.stopPropagation();
              quota.refresh();
            },
            disabled: quota.busy,
            children: t("retry")
          })
        ] })
      ] }, entry.provider)),
      quota.error !== null && (0, import_jsx_runtime.jsx)("span", { className: "dp_qAux", children: fill(t("quotaFailed"), { err: quota.error }) })
    ] })
  ] });
  const rate = typeof totals?.cacheHitRate === "number" && Number.isFinite(totals.cacheHitRate) ? Math.max(0, Math.min(1, totals.cacheHitRate)) : null;
  const R = 48;
  const C = 2 * Math.PI * R;
  const sideRows = rate === null ? [(0, import_jsx_runtime.jsx)("div", { className: "dp_ringSideRow", children: (0, import_jsx_runtime.jsx)("span", { children: t("cacheNa") }) }, "na")] : [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_ringSideRow", children: [
      (0, import_jsx_runtime.jsx)("span", { children: `${t("sideHit")} ` }),
      (0, import_jsx_runtime.jsx)("b", { className: "dp_hitVal", children: fmtTokens(totals.cacheRead) }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_hitSub", children: ` / ${t("sideTotal")} ${fmtTokens((totals.cacheRead || 0) + (totals.input || 0) + (totals.cacheWrite || 0))}` })
    ] }, "of"),
    statSideRow(t("sideUncached"), fmtTokens((totals.input || 0) + (totals.cacheWrite || 0)), "uncached"),
    statSideRow(t("sideOutput"), fmtTokens(totals.output || 0), "output")
  ];
  const cacheBlk = cacheOn && (0, import_jsx_runtime.jsxs)("div", { className: "dp_hBlk dp_hCache", children: [
    (0, import_jsx_runtime.jsx)("span", { className: "dp_hHead", children: (0, import_jsx_runtime.jsx)("span", { className: "dp_consLabel", children: t("chipCache") }) }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_cardBody dp_ringBody", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_ringWrap", role: "img", "aria-label": rate === null ? t("cacheNa") : `${t("chipCache")} ${Math.round(rate * 100)}%`, children: [
        (0, import_jsx_runtime.jsxs)("svg", { viewBox: "0 0 116 116", width: "116", height: "116", "aria-hidden": "true", children: [
          (0, import_jsx_runtime.jsx)("circle", { className: "dp_ringTrack", cx: "58", cy: "58", r: String(R), fill: "none", strokeWidth: "12" }),
          rate !== null && (0, import_jsx_runtime.jsx)("circle", {
            className: "dp_ringValue",
            cx: "58",
            cy: "58",
            r: String(R),
            fill: "none",
            strokeWidth: "12",
            strokeDasharray: String(C),
            strokeDashoffset: String(C * (1 - rate)),
            transform: "rotate(-90 58 58)"
          })
        ] }),
        (0, import_jsx_runtime.jsx)("div", { className: "dp_ringCenter", children: (0, import_jsx_runtime.jsx)("span", { className: rate === null ? "dp_ringPct dp_ringNa" : "dp_ringPct", children: rate === null ? "\u2014" : `${Math.round(rate * 100)}%` }) })
      ] }),
      /** The evidence column holds only the ring's own numbers and
       *  stretches to the ring's height, its rows spread along it —
       *  the ring is the benchmark, the ledger answers to it. */
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_ringSide", children: sideRows })
    ] })
  ] });
  const moneyCol = (estOn || balanceOn) && (0, import_jsx_runtime.jsxs)("div", { className: "dp_hCol", children: [
    estBlk,
    balBlk
  ] });
  return (0, import_jsx_runtime.jsxs)("div", { className: `dp_chip dp_heroCard${balanceOn || quotaOn ? " dp_hasRefresh" : ""}`, children: [
    (balanceOn || quotaOn) && (0, import_jsx_runtime.jsx)("button", {
      type: "button",
      className: "dp_qRefresh dp_consActions",
      onClick: (e) => {
        e.stopPropagation();
        refreshCard();
      },
      disabled: busy,
      title: t("refreshCard"),
      "aria-label": t("refreshCard"),
      children: (0, import_jsx_runtime.jsx)(primitives.IconRefreshOutline16, { size: 13 })
    }),
    moneyCol,
    quotaBlk,
    cacheBlk,
    activityLine !== null && (0, import_jsx_runtime.jsx)("div", { className: "dp_hFoot", children: activityLine })
  ] });
}

// src/client/toolbar.js
function RangeCalendar({ from, to, onPick, onClose, anchorRef, t }) {
  const MAX_SPAN = 365;
  const [month, setMonth] = (0, import_react.useState)(() => {
    const anchor = typeof from === "string" && from.length === 10 ? from : localDay(Date.now());
    return anchor.slice(0, 7);
  });
  const [pending, setPending] = (0, import_react.useState)(null);
  const [hoverDay, setHoverDay] = (0, import_react.useState)(null);
  const [ymOpen, setYmOpen] = (0, import_react.useState)(false);
  const [ymYear, setYmYear] = (0, import_react.useState)(Number(month.slice(0, 4)));
  const [draftFrom, setDraftFrom] = (0, import_react.useState)(typeof from === "string" ? from : "");
  const [draftTo, setDraftTo] = (0, import_react.useState)(typeof to === "string" ? to : "");
  const [badFrom, setBadFrom] = (0, import_react.useState)(false);
  const [badTo, setBadTo] = (0, import_react.useState)(false);
  const today = localDay(Date.now());
  const shiftMonth = (key, delta) => {
    const [y2, m2] = key.split("-").map(Number);
    const t2 = y2 * 12 + (m2 - 1) + delta;
    return `${String(Math.floor(t2 / 12)).padStart(4, "0")}-${String(t2 % 12 + 1).padStart(2, "0")}`;
  };
  const makeDay = (yy, mm, dd) => {
    if (!(Number.isInteger(yy) && Number.isInteger(mm) && Number.isInteger(dd))) return null;
    if (mm < 1 || mm > 12 || dd < 1) return null;
    const probe = new Date(yy, mm - 1, dd, 12);
    if (probe.getMonth() !== mm - 1 || probe.getDate() !== dd) return null;
    return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  };
  const parseDay = (raw) => {
    const parts = String(raw).trim().split(/[^\d]+/).filter((p) => p !== "").map(Number);
    if (parts.length === 3) return makeDay(parts[0], parts[1], parts[2]);
    if (parts.length === 2) return makeDay(Number(today.slice(0, 4)), parts[0], parts[1]);
    return null;
  };
  const applyDrafts = () => {
    setBadFrom(false);
    setBadTo(false);
    const fRaw = draftFrom.trim();
    const tRaw = draftTo.trim();
    if (fRaw === "" && tRaw === "") return;
    const parsedFrom = fRaw === "" ? typeof from === "string" && from !== "" ? from : null : parseDay(fRaw);
    const parsedTo = tRaw === "" ? typeof to === "string" && to !== "" ? to : null : parseDay(tRaw);
    if (fRaw !== "" && parsedFrom === null) {
      setBadFrom(true);
      return;
    }
    if (tRaw !== "" && parsedTo === null) {
      setBadTo(true);
      return;
    }
    if (parsedFrom === null || parsedTo === null) {
      setBadFrom(parsedFrom === null);
      setBadTo(parsedTo === null);
      return;
    }
    let start = parsedFrom;
    let end = parsedTo;
    if (start > end) {
      const swap = start;
      start = end;
      end = swap;
    }
    if (parsedFrom > today || parsedTo > today) {
      setBadFrom(parsedFrom > today);
      setBadTo(parsedTo > today);
      return;
    }
    if (daysBetween(start, end) > MAX_SPAN) {
      setBadFrom(true);
      setBadTo(true);
      return;
    }
    onPick({ from: start, to: end });
  };
  const pick = (day) => {
    setHoverDay(null);
    if (pending === null) {
      setPending(day);
      return;
    }
    let start = pending;
    let end = day;
    if (end < start) {
      start = day;
      end = pending;
    }
    onPick({ from: start, to: end });
  };
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1, 12).getDay() + 6) % 7;
  const cells = [];
  for (let i2 = 0; i2 < offset; i2 += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(localDay(new Date(y, m - 1, d, 12).getTime()));
  const capStart = pending !== null ? pending : typeof from === "string" && from !== "" ? from : null;
  const capEnd = capStart !== null ? shiftDay(capStart, MAX_SPAN - 1) : null;
  const isDayOff = (day) => day > today || capEnd !== null && day > capEnd;
  const hoverEnd = pending !== null && typeof hoverDay === "string" && hoverDay !== pending ? hoverDay : "";
  let rangeStart = pending !== null ? pending : typeof from === "string" ? from : "";
  let rangeEnd = pending !== null ? hoverEnd : typeof to === "string" ? to : "";
  if (rangeStart !== "" && rangeEnd !== "" && rangeEnd < rangeStart) {
    const swapped = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = swapped;
  }
  const isStart = (day) => rangeStart !== "" && day === rangeStart;
  const isEnd = (day) => rangeEnd !== "" && day === rangeEnd;
  const inRange = (day) => rangeStart !== "" && rangeEnd !== "" && day > rangeStart && day < rangeEnd;
  const quick = [
    [t("range1"), today, today],
    [t("yesterday"), shiftDay(today, -1), shiftDay(today, -1)],
    [t("range7"), shiftDay(today, -6), today],
    [t("range30"), shiftDay(today, -29), today]
  ];
  const card = (0, import_jsx_runtime.jsxs)("div", { className: "dp_calCard", onClick: (e) => e.stopPropagation(), children: [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_calQuick", children: quick.map(([quickText, quickFrom, quickTo]) => (0, import_jsx_runtime.jsx)("button", {
      type: "button",
      className: "dp_segBtn",
      onClick: () => onPick({ from: quickFrom, to: quickTo }),
      children: quickText
    }, quickText)) }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_calHead", children: [
      (0, import_jsx_runtime.jsx)(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_calNav", "aria-label": t("back"), onClick: () => setMonth(shiftMonth(month, -1)), children: "\u2039" }),
      (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_calMonth", title: t("calYMHint"), onClick: () => {
        setYmYear(Number(month.slice(0, 4)));
        setYmOpen(!ymOpen);
      }, children: month }),
      (0, import_jsx_runtime.jsx)(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_calNav", onClick: () => setMonth(shiftMonth(month, 1)), children: "\u203A" })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_calInputs", children: [
      (0, import_jsx_runtime.jsx)(Input, {
        className: `dp_calInput${badFrom ? " dp_calInputBad" : ""}`,
        type: "text",
        placeholder: t("rangeFrom"),
        "aria-label": t("rangeFrom"),
        value: draftFrom,
        onChange: (e) => {
          setDraftFrom(e.target.value);
          setBadFrom(false);
        },
        onKeyDown: (e) => {
          if (e.key === "Enter") applyDrafts();
        }
      }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_calSep", children: "~" }),
      (0, import_jsx_runtime.jsx)(Input, {
        className: `dp_calInput${badTo ? " dp_calInputBad" : ""}`,
        type: "text",
        placeholder: t("rangeToDate"),
        "aria-label": t("rangeToDate"),
        value: draftTo,
        onChange: (e) => {
          setDraftTo(e.target.value);
          setBadTo(false);
        },
        onKeyDown: (e) => {
          if (e.key === "Enter") applyDrafts();
        }
      })
    ] }),
    ymOpen ? (0, import_jsx_runtime.jsxs)("div", { className: "dp_calYM", children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_calHead", children: [
        (0, import_jsx_runtime.jsx)(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_calNav", "aria-label": t("back"), onClick: () => setYmYear(ymYear - 1), children: "\u2039" }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_calMonth", children: String(ymYear) }),
        (0, import_jsx_runtime.jsx)(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_calNav", onClick: () => setYmYear(ymYear + 1), children: "\u203A" })
      ] }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_calYMGrid", children: t("calMonths").split(",").map((monthLabel, idx) => (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        className: `dp_calCell${month === `${ymYear}-${String(idx + 1).padStart(2, "0")}` ? " dp_calStart" : ""}`,
        onClick: () => {
          setMonth(`${ymYear}-${String(idx + 1).padStart(2, "0")}`);
          setYmOpen(false);
        },
        children: monthLabel
      }, monthLabel)) })
    ] }) : (0, import_jsx_runtime.jsxs)("div", { className: "dp_calGrid", onMouseLeave: () => setHoverDay(null), children: [
      t("calWeek").split(",").map((w) => (0, import_jsx_runtime.jsx)("span", { className: "dp_calDow", children: w }, w)),
      cells.map((day, i2) => day === null ? (0, import_jsx_runtime.jsx)("span", { key: `e${i2}`, className: "dp_calCell dp_calEmpty" }) : (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        key: day,
        className: `dp_calCell${isStart(day) ? " dp_calStart" : ""}${isEnd(day) ? " dp_calEnd" : ""}${inRange(day) ? " dp_calIn" : ""}${day === today ? " dp_calToday" : ""}${isDayOff(day) ? " dp_calOff" : ""}`,
        disabled: isDayOff(day),
        title: isDayOff(day) ? day > today ? t("calNoFuture") : fill(t("calSpanCap"), { n: MAX_SPAN }) : void 0,
        onClick: () => pick(day),
        onMouseEnter: pending !== null && !isDayOff(day) ? () => setHoverDay(day) : void 0,
        children: String(Number(day.slice(8)))
      }))
    ] }),
    (0, import_jsx_runtime.jsx)("div", { className: "dp_calFoot", children: (0, import_jsx_runtime.jsx)("span", {
      className: "dp_costNote",
      children: badFrom || badTo ? t("calBadDate") : pending !== null ? t("calPickEnd") : typeof from === "string" && from !== "" && typeof to === "string" && to !== "" ? `${from} ~ ${to} \xB7 ${fill(t("calSpanDays"), { n: daysBetween(from, to) })}` : t("calPickStart")
    }) })
  ] });
  if (floatReady()) {
    return (0, import_jsx_runtime.jsx)(Float, { open: true, onClose, rootRef: anchorRef, anchorRef, maxHeight: 460, children: card });
  }
  return (0, import_jsx_runtime.jsx)("div", { className: "dp_calOverlay", onClick: onClose, children: card });
}
function Toolbar({ rangeKey, setRangeKey, custom, setCustom, project, setProject, knownProjects, models, onModelToggle, onModelClear, knownModels, names, t, filterSlot }) {
  const [calOpen, setCalOpen] = (0, import_react.useState)(false);
  const dateBtnRef = (0, import_react.useRef)(null);
  const rangeOptions = [["1", t("range1")], ["7", t("range7")], ["30", t("range30")], ["90", t("range90")], ["365", t("range365")], ["custom", t("rangeCustom")]];
  const projectOptions = (0, import_react.useMemo)(() => [
    { value: "", label: t("projectAll") },
    ...knownProjects.map((name) => ({ value: name, label: name }))
  ], [knownProjects, t]);
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_toolbar", children: [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_toolbarGroup", children: [
      (0, import_jsx_runtime.jsx)(Seg, {
        id: "pulse-toolbar-range",
        value: rangeKey,
        options: rangeOptions.map(([value, label]) => ({ value, label })),
        onChange: setRangeKey,
        label: t("rangeLabel")
      })
    ] }),
    rangeKey === "custom" && (0, import_jsx_runtime.jsxs)("div", { className: "dp_toolbarGroup", children: [
      (0, import_jsx_runtime.jsx)(Btn, {
        ref: dateBtnRef,
        variant: "outline",
        size: "sm",
        fallbackClass: "dp_dateBtn",
        onClick: () => setCalOpen(true),
        // A one-day range says so once — "09-28 ~ 09-28" is noise.
        children: custom.from && custom.to ? custom.from === custom.to ? custom.from : `${custom.from} ~ ${custom.to}` : t("rangeCustom")
      }),
      calOpen && (0, import_jsx_runtime.jsx)(RangeCalendar, {
        from: custom.from,
        to: custom.to,
        onPick: (range) => {
          setCustom(range);
          setCalOpen(false);
        },
        onClose: () => setCalOpen(false),
        anchorRef: dateBtnRef,
        t
      })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_toolbarGroup", children: [
      (0, import_jsx_runtime.jsx)(SearchPicker, {
        value: project,
        options: projectOptions,
        placeholder: t("projectAll"),
        displayName: (name) => name,
        onChange: setProject,
        t
      })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_toolbarGroup", children: [
      (0, import_jsx_runtime.jsx)(ModelMultiPicker, {
        selected: models,
        onToggle: onModelToggle,
        onClear: onModelClear,
        knownModels,
        names,
        t
      })
    ] }),
    // Extension filters (`pulse.dashboard.filter` list slot): rendered
    // after the built-in project/model pickers.
    typeof filterSlot === "function" && filterSlot("pulse.dashboard.filter", {})
  ] });
}

// src/client/csv.js
function csvCell(value) {
  const s = value === null || value === void 0 ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename, text) {
  if (typeof document === "undefined" || typeof Blob === "undefined") return;
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function exportDailyCsv({ t, view, costDays, balanceSeries = [], fromDay, toDay }) {
  const costBy = new Map(Array.isArray(costDays) ? costDays.map((d) => [d.key, d]) : []);
  const spendBy = new Map(Array.isArray(balanceSeries) ? balanceSeries.map((d) => [d.key, d]) : []);
  const buckets = Array.isArray(view?.buckets) ? view.buckets : [];
  const rows = [];
  let sumSessions = 0, sumIn = 0, sumRead = 0, sumWrite = 0, sumOut = 0, sumCost = 0, sumSearch = 0, sumTitle = 0;
  for (const bucket of buckets) {
    const input = bucket.input || 0;
    const read = bucket.cacheRead || 0;
    const write = bucket.cacheWrite || 0;
    const out = bucket.output || 0;
    const prompt = input + read + write;
    const cost = costBy.get(bucket.key);
    const costVal = cost ? (cost.peak || 0) + (cost.offpeak || 0) : null;
    const spend = spendBy.get(bucket.key);
    const spendVal = spend === void 0 || spend?.spend === null ? null : spend.spend;
    const searchCalls = bucket.auxSearch || 0;
    const titleCalls = bucket.auxTitle || 0;
    sumSessions += bucket.sessions || 0;
    sumIn += input;
    sumRead += read;
    sumWrite += write;
    sumOut += out;
    sumSearch += searchCalls;
    sumTitle += titleCalls;
    if (costVal !== null) sumCost += costVal;
    rows.push([
      bucket.key,
      bucket.sessions || 0,
      input,
      read,
      write,
      out,
      prompt + out,
      prompt > 0 ? `${(read / prompt * 100).toFixed(1)}%` : "",
      searchCalls > 0 || titleCalls > 0 ? searchCalls : "",
      searchCalls > 0 || titleCalls > 0 ? titleCalls : "",
      costVal === null ? "" : Math.round(costVal * 1e6) / 1e6,
      spendVal === null ? "" : spendVal,
      costVal !== null && spendVal !== null ? Math.round((spendVal - costVal) * 1e6) / 1e6 : ""
    ]);
  }
  const header = [
    t("expDate"),
    t("expSessions"),
    t("expInput"),
    t("expCacheRead"),
    t("expCacheWrite"),
    t("expOutput"),
    t("expTotal"),
    t("expHitRate"),
    t("expSearch"),
    t("expTitle"),
    t("expCost"),
    t("expSpend"),
    t("expGap")
  ];
  const grand = [
    t("expSum"),
    sumSessions,
    sumIn,
    sumRead,
    sumWrite,
    sumOut,
    sumIn + sumRead + sumWrite + sumOut,
    "",
    sumSearch,
    sumTitle,
    Math.round(sumCost * 1e6) / 1e6,
    "",
    ""
  ];
  const csv = "\uFEFF" + [header, ...rows, grand].map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadCsv(`pulse-${fromDay}_${toDay}.csv`, csv);
}
function PulseDashboard({ t, headerExtra, onConfigure, floatActions = false, focusSession = null, renderSlot: renderPanelsSlot, actions }) {
  const [panels] = (0, import_react.useState)(loadPanels);
  const [theme, setTheme2] = (0, import_react.useState)(loadTheme);
  (0, import_react.useEffect)(() => subscribeTheme(setTheme2), []);
  const [rangeKey, setRangeKey] = (0, import_react.useState)("7");
  const [custom, setCustom] = (0, import_react.useState)(() => {
    const today = localDay(Date.now());
    return { from: shiftDay(today, -6), to: today };
  });
  const [project, setProject] = (0, import_react.useState)("");
  const [projectTouched, setProjectTouched] = (0, import_react.useState)(false);
  const setProjectUser = (value) => {
    setProjectTouched(true);
    setProject(value);
  };
  const [models, setModels] = (0, import_react.useState)([]);
  const toggleModel = (key) => setModels((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  const clearModels = () => setModels([]);
  const modelSelSet = models.length > 0 ? new Set(models) : null;
  const [trendStack, setTrendStack] = (0, import_react.useState)(loadTrendStack);
  const applyTrendStack = (mode) => {
    setTrendStack(mode);
    try {
      localStorage.setItem(TREND_STACK_STORAGE, mode);
    } catch {
    }
  };
  const [trendDrilled, setTrendDrilled] = (0, import_react.useState)(false);
  const [swapTab, setSwapTab] = (0, import_react.useState)("use");
  const [expandX, setExpandX] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    if (expandX === null) return void 0;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setExpandX(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [expandX]);
  const [costDrilled, setCostDrilled] = (0, import_react.useState)(false);
  const [costStack, setCostStack] = (0, import_react.useState)(loadCostStack);
  const applyCostStack = (mode) => {
    setCostStack(mode);
    try {
      localStorage.setItem(COST_STACK_STORAGE, mode);
    } catch {
    }
  };
  const presetDays = RANGE_PRESETS[rangeKey] ?? 7;
  const range = (0, import_react.useMemo)(() => {
    const today = localDay(Date.now());
    let from;
    let to;
    if (rangeKey !== "custom") {
      from = shiftDay(today, -(Math.min(1095, presetDays) - 1));
      to = today;
    } else {
      const clamped = clampSpan(custom.from || shiftDay(today, -6), custom.to || today, 365);
      from = clamped.from;
      to = clamped.to;
    }
    return { from, to };
  }, [rangeKey, custom, presetDays]);
  const heatmap = rangeKey === "90" || rangeKey === "365" || rangeKey === "custom" && daysBetween(range.from, range.to) > 60;
  const stats = usePulseStats(range.from, range.to);
  const data = stats.data;
  const balance = useBalance();
  const quota = useQuota(panels.quota !== false);
  const payloadShape = data?.auxShape !== null && typeof data?.auxShape === "object" ? data.auxShape : null;
  const reconSeed = (0, import_react.useMemo)(() => data === null ? [] : reconcileSeries(data.sessions, {
    from: typeof data.fromDay === "string" ? data.fromDay : range.from,
    to: typeof data.toDay === "string" ? data.toDay : range.to,
    pricing: data.pricing,
    fx: data.fx,
    monthly: data.monthly,
    auxShape: payloadShape,
    official: Array.isArray(data.balanceSeries) ? data.balanceSeries : []
  }), [data, range]);
  const calib = (0, import_react.useMemo)(() => auxCalibration(reconSeed, {
    seed: payloadShape ?? null,
    manual: payloadShape?.manual === true,
    today: typeof data?.today === "string" ? data.today : localDay(Date.now())
  }), [reconSeed, data]);
  const recon = (0, import_react.useMemo)(() => data === null ? [] : reconcileSeries(data.sessions, {
    from: typeof data.fromDay === "string" ? data.fromDay : range.from,
    to: typeof data.toDay === "string" ? data.toDay : range.to,
    pricing: data.pricing,
    fx: data.fx,
    monthly: data.monthly,
    auxShape: calib.shape,
    official: Array.isArray(data.balanceSeries) ? data.balanceSeries : []
  }), [data, range, calib]);
  const reconByKey = (0, import_react.useMemo)(() => new Map(recon.map((row) => [row.key, row])), [recon]);
  const auxTip = (0, import_react.useMemo)(() => {
    const shapePart = fill(t("auxShapeTip"), { m: fmtTokens(calib.shape.miss), h: fmtTokens(calib.shape.hit), o: fmtTokens(calib.shape.out) });
    const s = calib.medianS;
    const statusText = calib.status === "manual" ? t("auxCalManual") : calib.status === "divergent" ? t("auxCalDivergent") : calib.status === "insufficient" ? fill(t("auxCalInsufficient"), { n: calib.checkedDays }) : s !== null && Math.abs(s - 1) <= 0.03 ? fill(t("auxCalAligned"), { s: s.toFixed(2), n: calib.samples }) : fill(t("auxCalCalibrated"), { s: s === null ? "1.00" : s.toFixed(2), n: calib.samples });
    return `${shapePart} \xB7 ${statusText}`;
  }, [calib, t]);
  (0, import_react.useEffect)(() => {
    if (focusSession === null || projectTouched || project !== "" || data === null) return;
    const label = focusProjectLabel(data, focusSession);
    if (label !== null) setProject(label);
  }, [focusSession, projectTouched, project, data]);
  const rawView = (0, import_react.useMemo)(() => {
    if (data === null) return null;
    const from = typeof data.fromDay === "string" ? data.fromDay : range.from;
    const to = typeof data.toDay === "string" ? data.toDay : range.to;
    return buildView(data.sessions, {
      granularity: "day",
      from,
      to,
      project,
      models,
      auxShape: calib.shape,
      pricing: data.pricing,
      fx: data.fx,
      monthly: data.monthly
    });
  }, [data, range, project, models, calib]);
  const view = (0, import_react.useMemo)(() => rollupModelFamilies(rawView).view, [rawView]);
  const catalog = useCatalog();
  const names = (0, import_react.useMemo)(() => catalogNames(
    catalog,
    (view === null ? [] : view.models).map((m) => m.key ?? modelKey(m.provider ?? "", m.model))
  ), [catalog, view]);
  const accentMap = (0, import_react.useMemo)(
    () => modelAccentMap(view === null ? [] : view.models, data === null ? {} : data.modelColors, { bw: theme === "bw" }),
    [view, data, theme]
  );
  const hasModelSplit = view !== null && (Array.isArray(view.modelBuckets) ? view.modelBuckets : []).some((day) => day instanceof Map && day.size > 0);
  const byModel = hasModelSplit && trendStack === "model";
  const modelLegendRows = byModel && view !== null ? (Array.isArray(view.models) ? view.models : []).slice(0, 4).map((m) => ({
    key: m.key,
    fill: accentOf(accentMap, m.provider ?? "", m.model),
    label: m.model === "unknown" ? t("unknownModel") : m.model === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(m.provider ?? "", m.model),
    title: m.model === AUX_MODEL_KEY ? auxTip : null
  })) : null;
  const sessionGroupsData = (0, import_react.useMemo)(
    () => data === null ? [] : sessionGroups(data.sessions, { pricing: data.pricing, fx: data.fx, monthly: data.monthly, models, catalog }),
    [data, models, catalog]
  );
  const hourly = data === null ? range.from === range.to : data.fromDay === data.toDay;
  const hourlyDay = data !== null && typeof data.fromDay === "string" ? data.fromDay : range.from;
  const hourlyCutoff = data !== null && typeof data.today === "string" ? shiftDay(data.today, -2) : null;
  const hours = (0, import_react.useMemo)(() => {
    if (data === null || !hourly || panels.trend === false) return null;
    return hourlySeries(data.sessions, hourlyDay, { project, models });
  }, [data, hourly, hourlyDay, project, models, panels.trend]);
  const hourlyCost = (0, import_react.useMemo)(() => {
    if (data === null || !hourly || panels.costTrend === false || data.costEnabled === false) return null;
    return hourlyCostSeries(data.sessions, hourlyDay, { pricing: data.pricing, fx: data.fx, monthly: data.monthly, models, project });
  }, [data, hourly, hourlyDay, project, models, panels.costTrend]);
  const costDays = (0, import_react.useMemo)(() => {
    if (data === null || data.costEnabled === false) return null;
    return costSeries(data.sessions, {
      from: typeof data.fromDay === "string" ? data.fromDay : range.from,
      to: typeof data.toDay === "string" ? data.toDay : range.to,
      project,
      models,
      auxShape: calib.shape,
      pricing: data.pricing,
      fx: data.fx,
      monthly: data.monthly
    });
  }, [data, range, project, models, calib]);
  const syncStore = typeof actions?.sync === "function" ? actions.sync : null;
  (0, import_react.useEffect)(() => {
    if (syncStore !== null) syncStore(data, view, stats.busy);
  }, [syncStore, data, view, stats.busy]);
  const refreshBtn = (0, import_jsx_runtime.jsx)(Btn, {
    variant: "toolbar",
    size: "sm",
    fallbackClass: "dp_iconBtn",
    onClick: () => stats.reload(),
    "aria-label": t("refresh"),
    title: t("refresh"),
    disabled: stats.busy,
    icon: (0, import_jsx_runtime.jsx)(primitives.IconRefreshOutline16, { size: 15 })
  });
  const exportBtn = (0, import_jsx_runtime.jsx)(Btn, {
    variant: "toolbar",
    size: "sm",
    fallbackClass: "dp_iconBtn",
    "aria-label": t("exportBtn"),
    title: t("exportTitle"),
    disabled: data === null,
    onClick: () => exportDailyCsv({
      t,
      view,
      costDays,
      balanceSeries: Array.isArray(data?.balanceSeries) ? data.balanceSeries : [],
      fromDay: range.from,
      toDay: range.to
    }),
    icon: (0, import_jsx_runtime.jsx)("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [
      (0, import_jsx_runtime.jsx)("path", { d: "M8 2.2v7.3M8 9.5 4.9 6.4M8 9.5l3.1-3.1", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }),
      (0, import_jsx_runtime.jsx)("path", { d: "M2.9 10.6v2.5h10.2v-2.5", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" })
    ] })
  });
  const header = (0, import_jsx_runtime.jsxs)("div", { className: `dp_headerRow${floatActions ? " dp_headerRowFloat" : ""}`, children: [
    (0, import_jsx_runtime.jsx)("span", { className: "dp_title", children: t("title") }),
    (0, import_jsx_runtime.jsx)("span", { className: "dp_sub", children: data ? fill(t("generatedAt"), { t: fmtClock(data.generatedAt) }) : t("subtitle") }),
    !floatActions && refreshBtn,
    !floatActions && exportBtn,
    !floatActions && (headerExtra !== void 0 && headerExtra !== null ? headerExtra : null)
  ] });
  const staleWindow = data !== null && data.schema === 3 && (data.fromDay !== range.from || data.toDay !== range.to);
  if (stats.status === "error" && data === null) {
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_root", "data-dp-theme": theme, children: [
      header,
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_stateBox", children: [
        (0, import_jsx_runtime.jsx)(primitives.IconWarningOutline16, { size: 22, className: "dp_stateIcon" }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_stateTitle", children: t("errorTitle") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_stateBody", children: `${t("errorBody")} (${stats.error})` }),
        (0, import_jsx_runtime.jsx)("div", { className: "dp_retryRow", children: (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => stats.reload(), children: t("retry") }) })
      ] })
    ] });
  }
  if (data === null || stats.status === "loading" || staleWindow) {
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_root", "data-dp-theme": theme, children: [
      header,
      // The toolbar stays interactive across switches (retargeting
      // is cheap: the store aborts and re-sequences); only the
      // initial load has no window to source picker options from.
      view !== null ? (0, import_jsx_runtime.jsx)(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject: setProjectUser, knownProjects: view.knownProjects, models, onModelToggle: toggleModel, onModelClear: clearModels, knownModels: view.knownModels, names, t, filterSlot: renderPanelsSlot }) : (0, import_jsx_runtime.jsx)("div", { className: "dp_skeleton dp_skeletonShort" }),
      (0, import_jsx_runtime.jsx)("div", { className: "dp_skeleton", children: (0, import_jsx_runtime.jsx)("div", { className: "dp_emptyChart", children: (0, import_jsx_runtime.jsx)("span", { children: t("loading") }) }) })
    ] });
  }
  if (view === null) return null;
  const totals = view.totals;
  const activityCells = [
    ["actSessions", totals.sessions || 0],
    ["actTurns", totals.turns || 0],
    ["actToolCalls", totals.toolCalls || 0]
  ];
  const activityTitle = fill(t("windowActivity"), { s: totals.sessions || 0, t: totals.turns || 0, c: totals.toolCalls || 0 });
  const activityLine = (0, import_jsx_runtime.jsx)("div", {
    className: "dp_actGrid",
    title: activityTitle,
    children: activityCells.map(([label, value]) => (0, import_jsx_runtime.jsxs)("span", { className: "dp_actCell", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_actLabel", children: t(label) }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_actVal", children: String(value) })
    ] }, label))
  });
  const grandTotal = (totals.input || 0) + (totals.output || 0) + (totals.cacheRead || 0) + (totals.cacheWrite || 0);
  const corpusEmpty = Number.isFinite(data.corpusSessions) ? data.corpusSessions === 0 : (data.sessions ?? []).length === 0;
  if (corpusEmpty) {
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_root", "data-dp-theme": theme, children: [
      header,
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_stateBox", children: [
        (0, import_jsx_runtime.jsx)(primitives.IconDataOutline16, { size: 22, className: "dp_stateIcon" }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_stateTitle", children: t("emptyTitle") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_stateBody", children: t("emptyBody") })
      ] })
    ] });
  }
  if ((data.sessions ?? []).length === 0) {
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_root", "data-dp-theme": theme, children: [
      header,
      (0, import_jsx_runtime.jsx)(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject: setProjectUser, knownProjects: view.knownProjects, models, onModelToggle: toggleModel, onModelClear: clearModels, knownModels: view.knownModels, names, t, filterSlot: renderPanelsSlot }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_stateBox", children: [
        (0, import_jsx_runtime.jsx)(primitives.IconClockOutline16, { size: 22, className: "dp_stateIcon" }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_stateTitle", children: t("windowEmptyTitle") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_stateBody", children: fill(t("windowEmptyBody"), { from: data.fromDay, to: data.toDay }) })
      ] })
    ] });
  }
  if (!view.hasData) {
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_root", "data-dp-theme": theme, children: [
      header,
      (0, import_jsx_runtime.jsx)(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject: setProjectUser, knownProjects: view.knownProjects, models, onModelToggle: toggleModel, onModelClear: clearModels, knownModels: view.knownModels, names, t, filterSlot: renderPanelsSlot }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_stateBox", children: [
        (0, import_jsx_runtime.jsx)(primitives.IconSearchOutline16, { size: 20, className: "dp_stateIcon" }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_stateTitle", children: t("filteredTitle") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_stateBody", children: t("filteredBody") })
      ] })
    ] });
  }
  const cost = view.cost;
  const costEnabled = data.costEnabled !== false;
  const thirdParty = models.length > 0 && models.every((key) => !isOfficialProvider(splitModelKey(key).provider));
  const modelConfigured = models.length > 0 && models.every((key) => {
    const { provider, model: bare } = splitModelKey(key);
    if (isOfficialProvider(provider)) return true;
    return (Array.isArray(data.monthly) ? data.monthly : []).includes(provider) || (Array.isArray(data.pricing) ? data.pricing : []).some((rule) => {
      if (typeof rule?.model !== "string" || rule.model !== bare) return false;
      const ruleProvider = typeof rule.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
      return ruleProvider === "" || ruleProvider === provider;
    });
  });
  const hideCostish = thirdParty && !modelConfigured;
  const bucketCount = view.buckets.length;
  const costFocusable = panels.costTrend !== false && costEnabled && !hideCostish && view !== null && view.cost.configured === true && costDays !== null;
  const swapView = swapTab === "cost" && costFocusable ? "cost" : panels.trend !== false ? "use" : costFocusable ? "cost" : "use";
  const trendFocused = typeof trendDrilled === "number";
  const costDrillOn = typeof costDrilled === "number";
  const costSpanDays = data !== null && typeof data.fromDay === "string" && typeof data.toDay === "string" ? Math.round((Date.parse(`${data.toDay}T00:00:00`) - Date.parse(`${data.fromDay}T00:00:00`)) / 864e5) + 1 : 0;
  const costBucket = costSpanDays > 180 ? "month" : costSpanDays > 45 ? "week" : "day";
  const rangeText = hourly ? t("hourCount") : typeof data.fromDay === "string" && typeof data.toDay === "string" ? data.fromDay === data.toDay ? data.fromDay : `${data.fromDay} ~ ${data.toDay}` : fill(t("dailyCount"), { n: bucketCount });
  const balanceBaseOn = panels.balance !== false && !thirdParty;
  const estOn = costEnabled && !hideCostish;
  const budgetOn = estOn;
  const quotaOk = (Array.isArray(quota.data?.providers) ? quota.data.providers : []).some((entry) => entry.ok === true);
  const quotaOpenable = panels.quota !== false && quotaOk;
  const reconOn = estOn && balanceBaseOn && balance.data !== null && balance.data.configured === true;
  const heroOpenable = estOn || quotaOpenable;
  const showChips = panels.cache !== false || estOn || panels.balance !== false || panels.quota !== false;
  const cacheOn = panels.cache !== false;
  const extChips = typeof renderPanelsSlot === "function" ? renderPanelsSlot("pulse.dashboard.chip", { data, view, busy: stats.busy }) : null;
  const dimWrap = (node) => expandX !== null && heroOpenable && node !== null && node !== void 0 && node !== false ? (0, import_jsx_runtime.jsx)("div", { className: "dp_blurSec", children: node }) : node;
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_root", "data-dp-theme": theme, children: [
    header,
    (0, import_jsx_runtime.jsx)(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject: setProjectUser, knownProjects: view.knownProjects, models, onModelToggle: toggleModel, onModelClear: clearModels, knownModels: view.knownModels, names, t, filterSlot: renderPanelsSlot }),
    showChips && (0, import_jsx_runtime.jsx)("div", {
      className: "dp_chips",
      children: (0, import_jsx_runtime.jsx)(HeroCard, {
        balance,
        quota,
        series: Array.isArray(data?.balanceSeries) ? data.balanceSeries : null,
        sessions: data.sessions,
        cost,
        totals,
        estOn,
        balanceOn: balanceBaseOn,
        quotaOn: panels.quota !== false,
        cacheOn,
        quotaOpenable,
        openX: expandX,
        onHot: (x) => setExpandX((cur) => cur === x ? null : x),
        onConfigure,
        rangeLabel: rangeKey === "custom" ? `${range.from} ~ ${range.to}` : t(rangeKey === "1" ? "range1" : rangeKey === "7" ? "range7" : rangeKey === "30" ? "range30" : rangeKey === "90" ? "range90" : "range365"),
        activityLine,
        t
      })
    }),
    // Extension chips (`pulse.dashboard.panel`'s sibling for KPI
    // tiles) — same grid, separate row, so their height can never
    // stretch the KPI row above.
    extChips !== null && extChips !== void 0 && extChips !== false ? (0, import_jsx_runtime.jsx)("div", { className: "dp_chips", children: extChips }) : null,
    /** 热区点击 → 同一下滑展开槽：估算块展开「费用估算+月度预算」
     *  与对账明细表（纯数据：官方扣费 / 本地估算 / 差额，稀疏日带
     *  ≈，偏差日标红不加引导文案），额度块展开订阅额度明细（窗口/
     *  燃速/分工作区）。再点同块或按 Esc 收起；展开时其余面板模糊
     *  压暗。 */
    expandX !== null && heroOpenable && (0, import_jsx_runtime.jsxs)("div", { className: "dp_consExpand", id: "dp-pulse-expand", children: [
      expandX === "est" && (estOn || budgetOn) && (0, import_jsx_runtime.jsxs)("div", { className: "dp_estBudgetPanel", children: [
        estOn && (0, import_jsx_runtime.jsxs)("div", { className: "dp_estCard", children: [
          (0, import_jsx_runtime.jsxs)("div", { className: "dp_cardHead", children: [
            (0, import_jsx_runtime.jsx)("span", { className: "dp_cardLabel", children: t("chipCost") }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_cardCount", children: fill(t("dailyCount"), { n: bucketCount }) })
          ] }),
          cost.configured === true ? (0, import_jsx_runtime.jsx)("span", { className: "dp_chipValue dp_costOk", children: moneyParts(cost.total ?? 0, "CNY").text }) : onConfigure !== void 0 ? (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_chipValueBtn", onClick: onConfigure, children: t("costGoSet") }) : (0, import_jsx_runtime.jsx)("span", { className: "dp_chipNote dp_costOff", children: t("costOff") }),
          cost.configured === true && (cost.unpriced?.input || 0) + (cost.unpriced?.output || 0) >= UNPRICED_HINT_TOKENS ? onConfigure !== void 0 ? (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_chipNoteBtn", onClick: onConfigure, children: fill(t("unpriced"), { n: fmtTokens((cost.unpriced.input || 0) + (cost.unpriced.output || 0)) }) }) : (0, import_jsx_runtime.jsx)("span", { className: "dp_chipNote", children: fill(t("unpriced"), { n: fmtTokens((cost.unpriced.input || 0) + (cost.unpriced.output || 0)) }) }) : cost.configured === true && (cost.convertedFromUsd || 0) > 0 ? (0, import_jsx_runtime.jsx)("span", { className: "dp_chipNote", children: fill(t("fxNote"), { r: cost.usdToCny }) }) : cost.configured !== true && (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("costHint") }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("focusNote") })
        ] }),
        budgetOn && (0, import_jsx_runtime.jsx)("div", { className: "dp_balanceGrow", children: (0, import_jsx_runtime.jsx)(BudgetCard, { t }) })
      ] }),
      expandX === "quota" && quotaOpenable && (0, import_jsx_runtime.jsx)(QuotaPanel, { quota, data, t }),
      expandX === "est" && reconOn && (0, import_jsx_runtime.jsx)(ReconTable, { rows: recon, t })
    ] }),
    /** 切换容器：表头左上 [用量走势｜费用走势] 页签（费用可用时），
     *  页签右侧范围文本精确镜像工具栏窗口；右侧堆叠切换不变。展开
     *  消费金额卡时整个容器模糊压暗。视图等高（256px），key 切换
     *  重放轻量过渡；费用走势底部附官网口径小字。 */
    dimWrap((panels.trend !== false || costFocusable) && (0, import_jsx_runtime.jsxs)("div", { children: [
      (0, import_jsx_runtime.jsxs)("div", { key: swapView, className: "dp_swapIn", children: [
        (0, import_jsx_runtime.jsxs)("div", { className: `dp_panelTitle${swapView === "cost" && !hourly || swapView !== "cost" && !hourly && !heatmap && hasModelSplit ? " dp_hasStack" : ""}`, children: [
          panels.trend !== false && costFocusable ? (0, import_jsx_runtime.jsx)(Seg, {
            id: "pulse-trend-view",
            className: "dp_trendTabs",
            value: swapView === "cost" ? "cost" : "use",
            options: [
              { value: "use", label: t("trendTitle") },
              { value: "cost", label: t("costTrend") }
            ],
            onChange: setSwapTab,
            label: t("trendViewLabel")
          }) : (0, import_jsx_runtime.jsx)("span", { children: swapView === "cost" ? t("costTrend") : t("trendTitle") }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_panelCount", children: rangeText }),
          // 右侧切换：多日费用 = 峰谷/模型 堆叠；多日用量 = 类型/模型。
          swapView === "cost" && !hourly ? (0, import_jsx_runtime.jsx)(Seg, {
            id: "pulse-cost-stack",
            className: "dp_stackToggle",
            value: costStack === "model" ? "model" : "tiers",
            options: [
              { value: "tiers", label: t("stackTiers") },
              { value: "model", label: t("stackModel") }
            ],
            onChange: applyCostStack,
            label: t("stackLabel")
          }) : swapView !== "cost" && !hourly && !heatmap && hasModelSplit && (0, import_jsx_runtime.jsx)(Seg, {
            id: "pulse-trend-stack",
            className: "dp_stackToggle",
            value: byModel ? "model" : "type",
            options: [
              { value: "type", label: t("stackType") },
              { value: "model", label: t("stackModel") }
            ],
            onChange: applyTrendStack,
            label: t("stackLabel")
          })
        ] }),
        (0, import_jsx_runtime.jsx)("div", { className: "dp_trendBody", children: swapView === "cost" ? hourly ? (0, import_jsx_runtime.jsxs)("div", { children: [
          (0, import_jsx_runtime.jsx)(HourlyCostChart, { hours: hourlyCost?.hours ?? [], t }),
          hourlyCost !== null && hourlyCost.unpricedTokens > 0 && (0, import_jsx_runtime.jsx)("div", { className: "dp_focusNote", children: fill(t("unpriced"), { n: fmtTokens(hourlyCost.unpricedTokens) }) }),
          project === "" && (reconByKey.get(hourlyDay)?.aux ?? 0) > 0 && (0, import_jsx_runtime.jsx)("div", { className: "dp_focusNote", children: fill(t("costHourlyAux"), { v: moneyCny(reconByKey.get(hourlyDay).aux) }) }),
          hourlyCutoff !== null && hourlyDay < hourlyCutoff && (0, import_jsx_runtime.jsx)("div", { className: "dp_focusNote", children: t("hourlyNote") }),
          (0, import_jsx_runtime.jsx)("div", { className: "dp_focusNote", children: t("focusNote") })
        ] }) : (0, import_jsx_runtime.jsxs)("div", { children: [
          (0, import_jsx_runtime.jsx)(CostTrendPanel, {
            costs: view.bucketCosts,
            today: data.today,
            actualByDay: thirdParty ? null : Array.isArray(data?.balanceSeries) ? data.balanceSeries : null,
            accentMap,
            byModel: costStack === "model",
            names,
            bucket: costBucket,
            legendSel: modelSelSet,
            onLegendToggle: toggleModel,
            auxTip,
            onDrillChange: setCostDrilled,
            children: !costDrillOn && (0, import_jsx_runtime.jsx)(BucketXLabels, { buckets: view.buckets, granularity: "day", today: data.today, t }),
            t
          }),
          (0, import_jsx_runtime.jsx)("div", { className: "dp_focusNote", children: t("focusNote") })
        ] }) : hourly ? (0, import_jsx_runtime.jsxs)("div", { children: [
          (0, import_jsx_runtime.jsx)(HourlyChart, { hours, t }),
          hourlyCutoff !== null && hourlyDay < hourlyCutoff && (0, import_jsx_runtime.jsx)("div", { className: "dp_focusNote", children: t("hourlyNote") })
        ] }) : heatmap ? (0, import_jsx_runtime.jsx)("div", { className: "dp_projScroll", children: (0, import_jsx_runtime.jsx)(HeatmapChart, { buckets: view.buckets, today: data.today, t }) }) : (0, import_jsx_runtime.jsx)(BucketChart, {
          buckets: view.buckets,
          granularity: "day",
          today: data.today,
          modelBuckets: view.modelBuckets,
          accentMap,
          byModel,
          names,
          legendRows: modelLegendRows,
          legendSel: modelSelSet,
          onLegendToggle: toggleModel,
          hourlyFrom: hourlyCutoff,
          onDrillHourly: (day) => {
            if (day === data.today) setRangeKey("1");
            else {
              setCustom({ from: day, to: day });
              setRangeKey("custom");
            }
          },
          onDrillChange: setTrendDrilled,
          children: !trendFocused && (0, import_jsx_runtime.jsx)(BucketXLabels, { buckets: view.buckets, granularity: "day", today: data.today, t }),
          t
        }) })
      ] })
    ] })),
    /** 模型分布：全宽汇总节，标题在卡外（与工作区排行同构）。 */
    dimWrap(panels.models !== false && (0, import_jsx_runtime.jsxs)("div", { children: [
      (0, import_jsx_runtime.jsx)("div", { className: "dp_panelTitle", children: t("modelsTitle") }),
      (0, import_jsx_runtime.jsx)(ModelBars, { models: view.models, modelColors: data.modelColors, pricing: data.pricing, fx: data.fx, costEnabled, monthly: data.monthly, names, legendSel: modelSelSet, onLegendToggle: toggleModel, auxTip, bw: theme === "bw", t })
    ] })),
    dimWrap(panels.projects !== false && project === "" && (0, import_jsx_runtime.jsxs)("div", { children: [
      (0, import_jsx_runtime.jsx)("div", { className: "dp_panelTitle", children: t("projectsTitle") }),
      (0, import_jsx_runtime.jsx)(ProjectTable, { projects: view.projects, topProjects: data.topProjects, onSelect: setProjectUser, t })
    ] })),
    dimWrap(panels.sessions !== false && project !== "" && (0, import_jsx_runtime.jsxs)("div", { children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_panelTitle", children: [
        (0, import_jsx_runtime.jsx)("span", { children: t("projectDetailTitle") }),
        (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_setLink", style: { marginLeft: "auto" }, onClick: () => setProjectUser(""), children: `\u2190 ${t("back")}` })
      ] }),
      (0, import_jsx_runtime.jsx)(SessionsPanel, {
        groups: sessionGroupsData.filter((g) => g.project === project),
        costEnabled,
        pricing: data.pricing,
        fx: data.fx,
        monthly: data.monthly,
        models,
        auxShape: calib.shape,
        catalog,
        names,
        t,
        focusSessionId: focusSession === null ? null : focusSession.id
      })
    ] })),
    // Extension panels from other client plugins (`pulse.dashboard.panel`
    // child slot). Rendered only in the loaded, non-empty view; the
    // render-site props carry the raw payload, the derived view model
    // and the busy flag (entries also get `t` from the factory locale).
    dimWrap(typeof renderPanelsSlot === "function" ? renderPanelsSlot("pulse.dashboard.panel", { data, view, busy: stats.busy }) : null)
  ] });
}

// src/client/settings.js
var OFFICIAL_PEAK_HOURS = [9, 10, 11, 14, 15, 16, 17];
function buildEditorRows(data) {
  const exact = /* @__PURE__ */ new Map();
  const wild = /* @__PURE__ */ new Map();
  for (const rule of Array.isArray(data.pricing) ? data.pricing : []) {
    if (typeof rule?.model !== "string" || rule.model === "") continue;
    const provider = typeof rule.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
    if (provider === "") wild.set(rule.model, rule);
    else exact.set(modelKey(provider, rule.model), rule);
  }
  const ruleFor2 = (provider, model) => exact.get(modelKey(provider, model)) ?? wild.get(model);
  const rows = [];
  for (const groupEntry of Array.isArray(data.catalog) ? data.catalog : []) {
    const provider = groupEntry.provider ?? "";
    const family = familyRouteOf(provider);
    const identity = family === null ? provider : "";
    const group = providerLabelOf(provider, groupEntry.displayName ?? provider);
    for (const model of Array.isArray(groupEntry.models) ? groupEntry.models : []) {
      if (typeof model?.id !== "string" || model.id === "") continue;
      const key = modelKey(identity, model.id);
      if (rows.some((row) => row.key === key)) continue;
      const exact2 = family === null ? void 0 : family.routes.map((route) => ruleFor2(route, model.id)).find((hit) => hit !== void 0);
      const rule = exact2 ?? ruleFor2(identity, model.id) ?? {};
      rows.push({
        key,
        provider: identity,
        model: model.id,
        routes: family === null ? [provider] : [...family.routes],
        name: model.name ?? "",
        group,
        origin: "catalog",
        input: rule.input ?? "",
        cacheRead: rule.cacheRead ?? "",
        output: rule.output ?? "",
        currency: rule.currency === "USD" ? "USD" : "CNY",
        peak: {
          input: rule.peak?.input ?? "",
          cacheRead: rule.peak?.cacheRead ?? "",
          output: rule.peak?.output ?? ""
        },
        peakHours: Array.isArray(rule.peakHours) ? [...rule.peakHours] : null,
        expanded: rule.peak !== null && typeof rule.peak === "object",
        dirty: false
      });
    }
  }
  return rows;
}
function mergeRows(fresh, edited) {
  const byKey = new Map(edited.map((row) => [row.key, row]));
  return fresh.map((row) => {
    const prev = byKey.get(row.key);
    if (prev === void 0) return row;
    return {
      ...row,
      input: prev.input,
      cacheRead: prev.cacheRead,
      output: prev.output,
      currency: prev.currency,
      peak: prev.peak,
      peakHours: prev.peakHours,
      expanded: prev.expanded,
      dirty: prev.dirty === true
    };
  });
}
function cleanNum(value) {
  if (value === "" || value === null || value === void 0) return void 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
function PricingPage({ t }) {
  const [state, setState] = (0, import_react.useState)({
    status: "loading",
    costEnabled: true,
    usdToCny: String(DEFAULT_USD_TO_CNY),
    rows: [],
    official: [],
    monthly: [],
    monthlyFee: {},
    modelColors: {},
    pricingDirty: false,
    writable: false,
    hasCatalog: false,
    revision: void 0,
    saving: false,
    saved: false,
    refold: false,
    error: null
  });
  const stats = (0, import_react.useSyncExternalStore)(subscribeStats, () => statsState);
  const load = () => {
    fetchSettings().then((data) => setState((s) => ({
      ...s,
      status: "ready",
      costEnabled: data.costEnabled !== false,
      usdToCny: String(Number(data.fx?.usdToCny) > 0 ? data.fx.usdToCny : DEFAULT_USD_TO_CNY),
      rows: s.status === "ready" ? mergeRows(buildEditorRows(data), s.rows) : buildEditorRows(data),
      official: Array.isArray(data.official) ? data.official : [],
      monthly: Array.isArray(data.monthly) ? [...data.monthly] : [],
      monthlyFee: data.monthlyFee !== null && typeof data.monthlyFee === "object" ? { ...data.monthlyFee } : {},
      modelColors: data.modelColors !== null && typeof data.modelColors === "object" ? data.modelColors : {},
      hasCatalog: (Array.isArray(data.catalog) ? data.catalog : []).some((group) => (group.models ?? []).length > 0),
      writable: data.writable === true,
      revision: typeof data.revision === "number" ? data.revision : void 0,
      error: null
    }))).catch((error) => setState((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
  };
  (0, import_react.useEffect)(() => {
    if (statsState.key === null) {
      const day = localDay(Date.now());
      loadStats(shiftDay(day, -89), day);
    }
  }, []);
  (0, import_react.useEffect)(() => {
    if ((stats.data !== null || stats.status === "error") && state.status === "loading") load();
  }, [stats.data, stats.status, state.status]);
  const patchRow = (i2, fn) => setState((s) => ({
    ...s,
    saved: false,
    refold: false,
    pricingDirty: true,
    rows: s.rows.map((row, j) => j === i2 ? fn(row) : row)
  }));
  const patch = (i2, key, value) => patchRow(i2, (row) => ({ ...row, [key]: value, dirty: true }));
  const patchPeak = (i2, key, value) => patchRow(i2, (row) => ({ ...row, peak: { ...row.peak, [key]: value }, dirty: true }));
  const toggleHour = (i2, hour) => patchRow(i2, (row) => {
    const base = row.peakHours ?? [...OFFICIAL_PEAK_HOURS];
    const next = base.includes(hour) ? base.filter((h) => h !== hour) : [...base, hour].sort((a, b) => a - b);
    return { ...row, peakHours: next, dirty: true };
  });
  const toggleMonthly = (provider) => setState((s) => ({
    ...s,
    saved: false,
    monthly: s.monthly.includes(provider) ? s.monthly.filter((id) => id !== provider) : [...s.monthly, provider]
  }));
  const patchFee = (provider, value) => setState((s) => ({
    ...s,
    saved: false,
    monthlyFee: { ...s.monthlyFee, [provider]: value }
  }));
  const cleanFees = () => {
    const out = {};
    for (const [id, v] of Object.entries(state.monthlyFee ?? {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[id] = Math.round(n * 100) / 100;
    }
    return out;
  };
  const officialMap = (0, import_react.useMemo)(() => new Map(state.official.map((rule) => [rule.model, rule])), [state.official]);
  const restoreOfficial = (i2) => patchRow(i2, (row) => {
    const rule = officialMap.get(row.model);
    if (rule === void 0) return row;
    return {
      ...row,
      input: rule.input ?? "",
      cacheRead: rule.cacheRead ?? "",
      output: rule.output ?? "",
      currency: rule.currency === "USD" ? "USD" : "CNY",
      peak: {
        input: rule.peak?.input ?? "",
        cacheRead: rule.peak?.cacheRead ?? "",
        output: rule.peak?.output ?? ""
      },
      peakHours: null,
      expanded: rule.peak !== null && typeof rule.peak === "object",
      dirty: false
    };
  });
  const buildRows = () => state.rows.filter((row) => row.dirty === true).map((row) => {
    const model = String(row.model ?? "").trim();
    const provider = typeof row.provider === "string" && row.provider !== "" ? row.provider : "";
    const input = cleanNum(row.input);
    const cacheRead = cleanNum(row.cacheRead);
    const output = cleanNum(row.output);
    const pi = cleanNum(row.peak?.input);
    const pc = cleanNum(row.peak?.cacheRead);
    const po = cleanNum(row.peak?.output);
    if (model === "") return null;
    if (![input, cacheRead, output, pi, pc, po].some((v) => typeof v === "number" && Number.isFinite(v))) return null;
    const out = { model };
    if (provider !== "") out.provider = provider;
    if (input !== void 0) out.input = input;
    if (cacheRead !== void 0) out.cacheRead = cacheRead;
    if (output !== void 0) out.output = output;
    if (pi !== void 0 || pc !== void 0 || po !== void 0) {
      out.peak = {};
      if (pi !== void 0) out.peak.input = pi;
      if (pc !== void 0) out.peak.cacheRead = pc;
      if (po !== void 0) out.peak.output = po;
    }
    if (Array.isArray(row.peakHours)) out.peakHours = row.peakHours;
    return out;
  }).filter((row) => row !== null);
  const fxNumber = () => cleanNum(state.usdToCny);
  const preview = (0, import_react.useMemo)(() => {
    const data = stats.data;
    if (data === null || state.status !== "ready") return null;
    const fx = fxNumber();
    if (typeof fx !== "number" || !Number.isFinite(fx) || fx <= 0) return null;
    const rules = /* @__PURE__ */ new Map();
    for (const rule of Array.isArray(data.pricing) ? data.pricing : []) {
      if (typeof rule?.model !== "string" || rule.model === "") continue;
      rules.set(modelKey(rule.provider ?? "", rule.model), rule);
    }
    for (const row of buildRows()) {
      rules.set(modelKey(row.provider ?? "", row.model), row);
    }
    return buildView(data.sessions, {
      granularity: "day",
      from: data.fromDay,
      to: data.toDay,
      pricing: [...rules.values()],
      fx: { usdToCny: fx },
      monthly: state.monthly,
      auxShape: data.auxShape ?? null
    }).cost;
  }, [stats.data, state.rows, state.usdToCny, state.monthly, state.status]);
  const persist = (payload) => {
    setState((s) => ({ ...s, saving: true, saved: false, refold: false, error: null }));
    fetch("/pulse/settings", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      // The revision observed at read time: a revisioned host (0.1.7+)
      // refuses the write when the section moved underneath us.
      body: JSON.stringify({ ...payload, revision: state.revision })
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || data?.conflict !== void 0) {
        invalidateSettings();
        load();
        throw new Error(t("setConflict"));
      }
      payloadError(res, data);
      setState((s) => ({
        ...s,
        saving: false,
        saved: true,
        refold: data?.refold === true,
        error: null,
        // Only the sections this save carried are persisted — a
        // colors-only write must not drop unsaved pricing edits.
        pricingDirty: payload.pricing !== void 0 ? false : s.pricingDirty,
        rows: payload.pricing !== void 0 ? s.rows.map((row) => ({ ...row, dirty: false })) : s.rows
      }));
      if (statsState.key !== null) {
        payloadCache.delete(statsState.key);
        loadStats(statsState.from, statsState.to);
      }
      invalidateSettings();
      load();
    }).catch((error) => setState((s) => ({ ...s, saving: false, error: String(error?.message ?? error) })));
  };
  const save = () => {
    const rows = buildRows();
    const ids = rows.map((row) => modelKey(row.provider ?? "", row.model));
    if (ids.some((id, i2) => ids.indexOf(id) !== i2)) {
      setState((s) => ({ ...s, error: t("setDupModel") }));
      return;
    }
    const bad = rows.some((row) => [row.input, row.cacheRead, row.output, row.peak?.input, row.peak?.cacheRead, row.peak?.output].some((v) => typeof v === "number" && !Number.isFinite(v)));
    const fx = fxNumber();
    if (bad || typeof fx !== "number" || !Number.isFinite(fx) || fx <= 0) {
      setState((s) => ({ ...s, error: t("setBadNumber") }));
      return;
    }
    const payload = { costEnabled: state.costEnabled === true, monthly: state.monthly, monthlyFee: cleanFees() };
    if (state.pricingDirty === true) payload.pricing = rows;
    persist(payload);
  };
  const reset = () => persist({ reset: true });
  const setAccent = (model, hex) => {
    const next = { ...state.modelColors ?? {} };
    const clean = String(hex ?? "").trim().toLowerCase();
    if (clean === "") delete next[model];
    else next[model] = clean;
    setState((s) => ({ ...s, modelColors: next, saved: false }));
    persist({ modelColors: next });
  };
  const resetAccents = () => {
    setState((s) => ({ ...s, modelColors: {}, saved: false }));
    persist({ modelColors: {} });
  };
  const accentRows = [];
  const accentSeen = /* @__PURE__ */ new Set();
  for (const row of state.rows) {
    if (typeof row.model !== "string" || row.model === "" || accentSeen.has(row.model)) continue;
    accentSeen.add(row.model);
    accentRows.push(row);
  }
  const accentPreview = modelAccentMap(
    accentRows.map((row) => ({ model: row.model, provider: row.provider ?? "" })),
    state.modelColors
  );
  const setField = (label, value, onChange) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_setField", key: label, children: [
    (0, import_jsx_runtime.jsx)("span", { className: "dp_setLabel", children: label }),
    (0, import_jsx_runtime.jsx)(Input, {
      className: "dp_setInput",
      inputMode: "decimal",
      value: value === void 0 || value === null ? "" : String(value),
      disabled: !state.writable || state.saving,
      onChange: (e) => onChange(e.target.value)
    })
  ] });
  const rowView = (row, i2) => {
    const monthly = state.monthly.includes(row.provider);
    const disabled = !state.writable || state.saving;
    const identity = (0, import_jsx_runtime.jsxs)("div", { className: "dp_setModelInfo", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_modelId", title: row.model, children: row.model }),
      (0, import_jsx_runtime.jsxs)("span", { className: "dp_modelName", children: [
        row.name !== "" ? row.name : null,
        row.name !== "" && officialMap.has(row.model) ? " \xB7 " : null,
        officialMap.has(row.model) ? (0, import_jsx_runtime.jsx)("button", {
          type: "button",
          className: "dp_setLink",
          disabled,
          onClick: () => restoreOfficial(i2),
          children: t("setOfficialReset")
        }) : null
      ] })
    ] });
    if (monthly) {
      return (0, import_jsx_runtime.jsxs)("div", { className: "dp_setRow dp_priceRow dp_priceMonthlyRow", children: [
        identity,
        (0, import_jsx_runtime.jsx)("span", { className: "dp_priceMonthly", children: t("setMonthly") })
      ] }, `${row.origin}:${row.key}:${i2}`);
    }
    return (0, import_jsx_runtime.jsxs)("div", { children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_setRow dp_priceRow", children: [
        identity,
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_priceFields", children: [
          setField(t("setInput"), row.input, (v) => patch(i2, "input", v)),
          setField(t("setCache"), row.cacheRead, (v) => patch(i2, "cacheRead", v)),
          setField(t("setOutput"), row.output, (v) => patch(i2, "output", v))
        ] }),
        (0, import_jsx_runtime.jsx)(PillBtn, {
          active: row.expanded,
          "aria-expanded": row.expanded,
          disabled,
          onClick: () => patch(i2, "expanded", !row.expanded),
          children: t("setPeakToggle")
        })
      ] }),
      row.expanded && (0, import_jsx_runtime.jsxs)("div", { className: "dp_peakSub", children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_priceFields", children: [
          setField(t("setPeakIn"), row.peak?.input, (v) => patchPeak(i2, "input", v)),
          setField(t("setPeakCache"), row.peak?.cacheRead, (v) => patchPeak(i2, "cacheRead", v)),
          setField(t("setPeakOut"), row.peak?.output, (v) => patchPeak(i2, "output", v))
        ] }),
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_setField", children: [
          (0, import_jsx_runtime.jsxs)("span", { className: "dp_setLabel", style: { marginBottom: "6px" }, children: [
            `${t("setPeakHours")} `,
            (0, import_jsx_runtime.jsx)("button", {
              type: "button",
              className: "dp_setLink",
              disabled,
              onClick: () => patch(i2, "peakHours", null),
              children: t("setPeakReset")
            })
          ] }),
          (0, import_jsx_runtime.jsxs)("div", { className: "dp_peakGrid", role: "group", "aria-label": t("setPeakHours"), children: [
            Array.from({ length: 24 }, (_, h) => {
              const on = (row.peakHours ?? OFFICIAL_PEAK_HOURS).includes(h);
              return (0, import_jsx_runtime.jsx)("button", {
                type: "button",
                className: `dp_hourCell${on ? " dp_hourCellOn" : ""}`,
                "aria-pressed": on,
                disabled,
                onClick: () => toggleHour(i2, h),
                children: String(h).padStart(2, "0")
              }, h);
            })
          ] })
        ] })
      ] })
    ] }, `${row.origin}:${row.key}:${i2}`);
  };
  const rendered = [];
  let lastProvider = null;
  state.rows.forEach((row, i2) => {
    if (row.provider !== lastProvider) {
      const monthlyOn = state.monthly.includes(row.provider);
      rendered.push((0, import_jsx_runtime.jsxs)("div", { className: "dp_setGroup", children: [
        (0, import_jsx_runtime.jsx)("span", { children: row.group }),
        monthlyOn && (0, import_jsx_runtime.jsx)(Input, {
          type: "number",
          className: "dp_setFeeInput",
          inputMode: "decimal",
          min: 0,
          step: "0.01",
          placeholder: "CNY/\u6708",
          title: t("setMonthlyFeeHint"),
          value: state.monthlyFee[row.provider] ?? "",
          disabled: !state.writable || state.saving,
          onChange: (e) => patchFee(row.provider, e.target.value)
        }),
        (0, import_jsx_runtime.jsx)(PillBtn, {
          active: monthlyOn,
          fallbackClass: "dp_miniBtn dp_setMonthlyBtn",
          disabled: !state.writable || state.saving,
          onClick: () => toggleMonthly(row.provider),
          children: t("setMonthly")
        })
      ] }, `g:${row.provider}`));
      lastProvider = row.provider;
    }
    rendered.push(rowView(row, i2));
  });
  let body;
  if (state.status === "loading") {
    body = (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("setLoading") });
  } else if (state.status === "error") {
    body = (0, import_jsx_runtime.jsxs)("span", { className: "dp_setMsg dp_setMsgErr", children: [
      fill(t("setFailed"), { err: state.error }),
      " ",
      (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_setRemove", onClick: load, children: t("retry") })
    ] });
  } else {
    body = (0, import_jsx_runtime.jsxs)("div", { className: "dp_setGrid", children: [
      (0, import_jsx_runtime.jsxs)("label", { className: "dp_setSwitch", children: [
        (0, import_jsx_runtime.jsx)("input", {
          type: "checkbox",
          checked: state.costEnabled === true,
          disabled: !state.writable || state.saving,
          onChange: (e) => setState((s) => ({ ...s, costEnabled: e.target.checked, saved: false }))
        }),
        (0, import_jsx_runtime.jsx)("span", { children: t("costEnabledLabel") })
      ] }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("costEnabledHint") }),
      !state.hasCatalog && (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("setCatalogEmpty") }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("setPeakNote") }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("setMonthlyHint") }),
      ...rendered,
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_accentCard", children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_accentHead", children: [
          (0, import_jsx_runtime.jsx)("span", { className: "dp_panelTitle", children: t("accentTitle") }),
          (0, import_jsx_runtime.jsx)("button", {
            type: "button",
            className: "dp_setLink",
            disabled: !state.writable || state.saving || Object.keys(state.modelColors ?? {}).length === 0,
            onClick: resetAccents,
            children: t("accentResetAll")
          })
        ] }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("accentHint") }),
        accentRows.map((row) => {
          const accent = accentEntryOf(accentPreview, row.provider ?? "", row.model);
          const custom = state.modelColors?.[row.model];
          return (0, import_jsx_runtime.jsxs)("div", { className: "dp_accentRow", children: [
            (0, import_jsx_runtime.jsx)("span", { className: "dp_accentDot", style: { background: accent?.fill } }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_accentName", title: row.model, children: row.name !== "" ? row.name : row.model }),
            (0, import_jsx_runtime.jsx)("input", {
              type: "color",
              className: "dp_accentPick",
              "aria-label": `${t("accentTitle")} ${row.model}`,
              value: /^#[0-9a-f]{6}$/.test(String(custom ?? "")) ? custom : "#888888",
              disabled: !state.writable || state.saving,
              onChange: (e) => setAccent(row.model, e.target.value)
            }),
            (0, import_jsx_runtime.jsx)("button", {
              type: "button",
              className: "dp_setLink",
              disabled: !state.writable || state.saving || typeof custom !== "string",
              onClick: () => setAccent(row.model, ""),
              children: t("accentAuto")
            })
          ] }, row.model);
        })
      ] }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_setActions", children: [
        (0, import_jsx_runtime.jsx)(Btn, {
          fallbackClass: "dp_miniBtn",
          variant: "primary",
          size: "sm",
          disabled: !state.writable || state.saving,
          onClick: save,
          children: t("setSave")
        }),
        (0, import_jsx_runtime.jsx)(Btn, {
          fallbackClass: "dp_miniBtn",
          variant: "outline",
          size: "sm",
          disabled: !state.writable || state.saving,
          onClick: reset,
          children: t("setReset")
        }),
        (0, import_jsx_runtime.jsx)(Btn, {
          fallbackClass: "dp_miniBtn",
          variant: "outline",
          size: "sm",
          disabled: state.saving,
          onClick: load,
          title: t("setRefresh"),
          children: t("setRefresh")
        }),
        state.saved && (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
        state.saved && state.refold && (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("setRefold") }),
        state.error !== null && (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: state.error }) })
      ] }),
      preview !== null && preview.configured === true && (0, import_jsx_runtime.jsxs)("div", { className: "dp_setPreview", children: [
        `${fill(t("setPreview"), { n: daysBetween(stats.data.fromDay, stats.data.toDay) })}: ${fmtCost(preview.total ?? 0)} CNY`,
        (preview.convertedFromUsd || 0) > 0 ? ` \xB7 ${fill(t("fxNote"), { r: preview.usdToCny })}` : ""
      ] }),
      !state.writable && (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgErr", children: t("setNotWritable") }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("setHint") })
    ] });
  }
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_setPanel", children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_setSub", children: t("setSub") }),
    body
  ] });
}

// src/client/compare.js
var COMPARE_PRESETS = {
  avg: { input: 100, ratio: 0.57, hit: 98.9 },
  long: { input: 100, ratio: 1.05, hit: 97.38 },
  massive: { input: 100, ratio: 0.32, hit: 99.48 }
};
var COMPARE_STATE_KEY = "dsh-pulse:compare-state";
var clampNum = (v, min, max) => Math.min(max, Math.max(min, v));
function rateOf(rule, tier) {
  const offInput = Number(rule.input) || 0;
  const offCache = typeof rule.cacheRead === "number" ? rule.cacheRead : offInput;
  const offOutput = Number(rule.output) || 0;
  if (tier !== "peak" || rule.peak === null || typeof rule.peak !== "object") {
    return { miss: offInput, hit: offCache, out: offOutput };
  }
  const peakInput = Number(rule.peak.input) || offInput;
  return {
    miss: peakInput,
    hit: typeof rule.peak.cacheRead === "number" ? rule.peak.cacheRead : peakInput,
    out: Number(rule.peak.output) || offOutput
  };
}
function loadCompareState() {
  try {
    const raw = localStorage.getItem(COMPARE_STATE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      return {
        visible: parsed !== null && typeof parsed === "object" && parsed.visible !== null && typeof parsed.visible === "object" ? parsed.visible : {},
        manuals: Array.isArray(parsed?.manuals) ? parsed.manuals.filter((m) => m !== null && typeof m === "object" && typeof m.name === "string").map((m) => ({ id: String(m.id), name: m.name, miss: Number(m.miss) || 0, hit: Number(m.hit) || 0, out: Number(m.out) || 0 })) : [],
        tiers: parsed !== null && typeof parsed === "object" && parsed.tiers !== null && typeof parsed.tiers === "object" ? parsed.tiers : {}
      };
    }
  } catch (error) {
  }
  return { visible: {}, manuals: [], tiers: {} };
}
function saveCompareState(state) {
  try {
    localStorage.setItem(COMPARE_STATE_KEY, JSON.stringify(state));
  } catch (error) {
  }
}
function ComparePage({ t }) {
  const [settings, setSettings] = (0, import_react.useState)({ status: "loading", pricing: [], catalog: [], monthly: [], monthlyFee: {}, fx: null, currency: "CNY", error: null });
  const [params, setParams] = (0, import_react.useState)({ ...COMPARE_PRESETS.avg });
  const [preset, setPreset] = (0, import_react.useState)("avg");
  const [state, setState] = (0, import_react.useState)(loadCompareState);
  const stats = (0, import_react.useSyncExternalStore)(subscribeStats, () => statsState);
  (0, import_react.useEffect)(() => {
    fetchSettings().then((data) => setSettings({
      status: "ready",
      pricing: Array.isArray(data.pricing) ? data.pricing : [],
      catalog: Array.isArray(data.catalog) ? data.catalog : [],
      monthly: Array.isArray(data.monthly) ? data.monthly : [],
      fx: Number(data.fx?.usdToCny) > 0 ? Number(data.fx.usdToCny) : DEFAULT_USD_TO_CNY,
      currency: data.currency === "USD" ? "USD" : "CNY",
      error: null
    })).catch((error) => setSettings((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
  }, []);
  (0, import_react.useEffect)(() => {
    if (statsState.key === null) {
      const day = localDay(Date.now());
      loadStats(shiftDay(day, -29), day);
    }
  }, []);
  const [subs, setSubs] = (0, import_react.useState)([]);
  (0, import_react.useEffect)(() => {
    let alive = true;
    fetch("/pulse/quota", { headers: { accept: "application/json" } }).then(async (r) => {
      httpError(r);
      return r.json();
    }).then((payload) => {
      if (!alive) return;
      const providers = Array.isArray(payload?.providers) ? payload.providers : [];
      setSubs(providers.filter((entry) => entry?.ok === true).map((entry) => ({ entry, fee: quotaMonthlyFee(entry.fee) })).filter((row) => row.fee !== null).map((row) => ({
        key: `sub:${row.entry.provider}`,
        provider: row.entry.provider,
        name: quotaEntryName(row.entry),
        monthly: row.fee.monthly,
        currency: row.fee.currency === "USD" ? "USD" : "CNY"
      })));
    }).catch(() => {
      if (alive) setSubs([]);
    });
    return () => {
      alive = false;
    };
  }, []);
  const patchState = (fn) => setState((prev) => {
    const next = fn(prev);
    saveCompareState(next);
    return next;
  });
  const real = (0, import_react.useMemo)(() => {
    const data = stats.data;
    if (data === null || !Array.isArray(data.sessions)) return null;
    const totals = buildView(data.sessions, { granularity: "day", from: data.fromDay, to: data.toDay }).totals;
    const side = totals.input + totals.cacheRead + totals.cacheWrite;
    if (!(side > 0)) return null;
    const round3 = (v) => Math.round(v * 1e3) / 1e3;
    return {
      input: round3(side / 1e6),
      ratio: round3(totals.output / side * 100),
      hit: round3(totals.cacheRead / side * 100),
      from: data.fromDay,
      to: data.toDay
    };
  }, [stats.data]);
  const autoTouched = (0, import_react.useRef)(false);
  const autoApplied = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    if (autoTouched.current || autoApplied.current || real === null || settings.status !== "ready") return;
    autoApplied.current = true;
    setParams({
      input: clampNum(real.input, 0.1, 1e9),
      ratio: clampNum(real.ratio, 0, 50),
      hit: clampNum(real.hit, 0, 100)
    });
    setPreset("real");
  }, [real, settings.status]);
  const names = (0, import_react.useMemo)(() => catalogNames(
    settings.catalog,
    settings.pricing.map((rule) => modelKey(rule.provider ?? "", rule.model))
  ), [settings.catalog, settings.pricing]);
  const rows = (0, import_react.useMemo)(() => {
    const monthlySet = new Set(Array.isArray(settings.monthly) ? settings.monthly : []);
    const ruleRows = settings.pricing.filter((rule) => typeof rule?.model === "string" && rule.model !== "" && !monthlySet.has(rule.provider ?? "")).map((rule) => {
      const key = modelKey(rule.provider ?? "", rule.model);
      const hasPeak = rule.peak !== null && typeof rule.peak === "object";
      const rowTier = state.tiers[key] === "peak" ? "peak" : "offpeak";
      const rates = rateOf(rule, rowTier);
      return {
        key: `rule:${key}`,
        origin: "rule",
        id: key,
        model: rule.model,
        provider: rule.provider ?? "",
        name: names.labelOf(rule.provider ?? "", rule.model),
        miss: rates.miss,
        hit: rates.hit,
        out: rates.out,
        currency: rule.currency === "USD" ? "USD" : "CNY",
        tier: rowTier,
        hasPeak
      };
    });
    const manualRows = state.manuals.map((m) => ({
      key: `manual:${m.id}`,
      origin: "manual",
      id: m.id,
      model: "",
      name: m.name,
      miss: m.miss,
      hit: m.hit,
      out: m.out,
      currency: settings.currency === "USD" ? "USD" : "CNY"
    }));
    const feeMap = settings.monthlyFee !== null && typeof settings.monthlyFee === "object" ? settings.monthlyFee : {};
    const feeOf = (id) => Number(feeMap[id]) > 0 ? Number(feeMap[id]) : null;
    const subRows = subs.map((s) => ({
      key: s.key,
      origin: "sub",
      id: s.provider,
      model: "",
      provider: s.provider,
      name: s.name,
      miss: 0,
      hit: 0,
      out: 0,
      monthly: feeOf(s.provider) ?? s.monthly,
      currency: s.currency === "USD" ? "USD" : "CNY"
    }));
    const manualSubRows = (Array.isArray(settings.monthly) ? settings.monthly : []).filter((id) => feeOf(id) !== null && !subs.some((s) => s.provider === id)).map((id) => ({
      key: `sub:p:${id}`,
      origin: "sub",
      id,
      model: "",
      provider: id,
      name: id,
      miss: 0,
      hit: 0,
      out: 0,
      monthly: feeOf(id),
      currency: "CNY"
    }));
    return [...ruleRows, ...subRows, ...manualSubRows, ...manualRows];
  }, [settings.pricing, settings.catalog, settings.currency, settings.monthly, settings.monthlyFee, state.manuals, state.tiers, names, subs]);
  const isVisible = (key) => state.visible[key] !== false;
  const toggleVisible = (key) => patchState((s) => ({ ...s, visible: { ...s.visible, [key]: s.visible[key] === false } }));
  const toggleTier = (key) => patchState((s) => ({
    ...s,
    tiers: { ...s.tiers, [key]: s.tiers[key] === "peak" ? "offpeak" : "peak" }
  }));
  const showAll = () => patchState((s) => {
    const visible = { ...s.visible };
    for (const row of rows) visible[row.key] = true;
    return { ...s, visible };
  });
  const addManual = () => patchState((s) => ({
    ...s,
    manuals: [...s.manuals, { id: String(Date.now()), name: `${t("cmpManual")} ${s.manuals.length + 1}`, miss: 1, hit: 0.2, out: 2 }]
  }));
  const patchManual = (id, fn) => patchState((s) => ({
    ...s,
    manuals: s.manuals.map((m) => m.id === id ? fn(m) : m)
  }));
  const removeManual = (id) => patchState((s) => {
    const visible = { ...s.visible };
    delete visible[`manual:${id}`];
    return { ...s, visible, manuals: s.manuals.filter((m) => m.id !== id) };
  });
  const setParam = (key, value) => {
    autoTouched.current = true;
    setParams((p) => ({ ...p, [key]: value }));
    setPreset("");
  };
  const applyReal = () => {
    autoTouched.current = true;
    if (real === null) return;
    setParams({
      input: clampNum(real.input, 0.1, 1e9),
      ratio: clampNum(real.ratio, 0, 50),
      hit: clampNum(real.hit, 0, 100)
    });
    setPreset("real");
  };
  const applyPreset = (key) => {
    autoTouched.current = true;
    setParams({ ...COMPARE_PRESETS[key] });
    setPreset(key);
  };
  const { input, ratio, hit } = params;
  const hitM = input * hit / 100;
  const missM = input * (1 - hit / 100);
  const outM = input * ratio / 100;
  const results = rows.filter((r) => isVisible(r.key)).map((r) => ({
    ...r,
    // 订阅行计"折合月费"——不随场景量变化，这正是它与按量
    // 计费的对比点；"最优"徽标只在按量方案之间产生：包月
    // 覆盖面不同，不当场判优。
    cost: r.origin === "sub" ? r.monthly * (r.currency === "USD" ? settings.fx : 1) : (missM * r.miss + hitM * r.hit + outM * r.out) * (r.currency === "USD" ? settings.fx : 1)
  }));
  const perTokenCosts = results.filter((r) => r.origin !== "sub").map((r) => r.cost);
  const bestCost = perTokenCosts.length > 1 ? Math.min(...perTokenCosts) : null;
  const maxCost = niceMax(Math.max(...results.map((r) => r.cost), 1e-6));
  const paramControl = (label, key, sliderMin, sliderMax, step, inputMax) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpControl", children: [
    (0, import_jsx_runtime.jsxs)("span", { className: "dp_cmpLabel", children: [
      (0, import_jsx_runtime.jsx)("span", { children: label }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpValue", children: String(params[key].toFixed(step >= 1 ? 1 : 2)) })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpRow", children: [
      (0, import_jsx_runtime.jsx)("input", {
        type: "range",
        className: "dp_cmpRange",
        min: sliderMin,
        max: sliderMax,
        step,
        value: Math.min(params[key], sliderMax),
        onChange: (e) => setParam(key, Number(e.target.value))
      }),
      (0, import_jsx_runtime.jsx)("input", {
        type: "number",
        className: "dp_cmpNum",
        min: sliderMin,
        ...inputMax !== void 0 ? { max: inputMax } : {},
        step,
        value: params[key].toFixed(step >= 1 ? 1 : 2),
        onChange: (e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) setParam(key, clampNum(v, sliderMin, inputMax ?? sliderMax));
        }
      })
    ] })
  ] });
  const visCheck = (key, label) => (0, import_jsx_runtime.jsx)("input", {
    type: "checkbox",
    className: "dp_cmpVis",
    checked: isVisible(key),
    "aria-label": label,
    title: label,
    onChange: () => toggleVisible(key)
  });
  const ruleRow = (r) => {
    const rateField = (label, value) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_setField", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_setLabel", children: label }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpRate", children: String(value) })
    ] });
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_setRow", children: [
      visCheck(r.key, r.name),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_setField", children: [
        (0, import_jsx_runtime.jsxs)("span", { className: "dp_setLabel", children: [
          (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpRuleTag", children: t("cmpFromRules") })
        ] }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpModelName", title: r.model, children: r.name })
      ] }),
      rateField(t("cmpMiss"), r.miss),
      rateField(t("cmpHitIn"), r.hit),
      rateField(t("cmpOut"), r.out),
      r.hasPeak && (0, import_jsx_runtime.jsx)(PillBtn, {
        active: r.tier === "peak",
        title: t("cmpTierHint"),
        onClick: () => toggleTier(r.id),
        children: r.tier === "peak" ? t("cmpTierPeak") : t("cmpTierOffpeak")
      })
    ] }, r.key);
  };
  const manualRow = (m) => {
    const field = (label, key) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_setField", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_setLabel", children: label }),
      (0, import_jsx_runtime.jsx)("input", {
        className: "dp_setInput",
        inputMode: "decimal",
        value: m[key],
        onChange: (e) => patchManual(m.id, (row) => ({ ...row, [key]: Number(e.target.value) || 0 }))
      })
    ] });
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_setRow", children: [
      visCheck(`manual:${m.id}`, m.name),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_setField dp_setModel", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_setLabel", children: t("cmpName") }),
        (0, import_jsx_runtime.jsx)(Input, {
          className: "dp_setInput",
          value: m.name,
          onChange: (e) => patchManual(m.id, (row) => ({ ...row, name: e.target.value }))
        })
      ] }),
      field(t("cmpMiss"), "miss"),
      field(t("cmpHitIn"), "hit"),
      field(t("cmpOut"), "out"),
      (0, import_jsx_runtime.jsx)("button", {
        type: "button",
        className: "dp_setRemove",
        onClick: () => removeManual(m.id),
        children: t("setRemove")
      })
    ] }, `manual:${m.id}`);
  };
  const resultCard = (r, i2) => {
    const isBest = bestCost !== null && r.cost === bestCost;
    const isSub = r.origin === "sub";
    return (0, import_jsx_runtime.jsxs)("div", { className: `dp_cmpCard${isBest ? " dp_cmpBest" : ""}`, children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpCardInfo", children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpCardHead", children: [
          (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpCardName", children: r.name }),
          isSub && (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpBadge", children: t("cmpSubTag") }),
          isBest && (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpBadge", children: t("cmpBest") })
        ] }),
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpCardDetail", children: [
          isSub ? (0, import_jsx_runtime.jsx)("span", { children: fill(t("cmpSubMonthly"), { v: fmtCost(r.cost) }) }) : (0, import_jsx_runtime.jsx)("span", { children: fill(t("cmpDetail"), { hit: hitM.toFixed(1), miss: missM.toFixed(1), out: outM.toFixed(1) }) }),
          isSub ? (0, import_jsx_runtime.jsx)("span", { title: t("cmpSubNote"), children: t("cmpSubNote") }) : (0, import_jsx_runtime.jsx)("span", { children: `${t("cmpRates")} ${r.miss} / ${r.hit} / ${r.out}${r.origin === "rule" && r.hasPeak ? ` \xB7 ${r.tier === "peak" ? t("cmpTierPeak") : t("cmpTierOffpeak")}` : ""}` })
        ] })
      ] }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpCardRight", children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpCardCost", children: [
          fmtCost(r.cost),
          (0, import_jsx_runtime.jsx)("small", { children: t("cmpUnit") })
        ] }),
        (0, import_jsx_runtime.jsx)("div", { className: "dp_cmpBarOuter", children: (0, import_jsx_runtime.jsx)("div", { className: "dp_cmpBar", style: { width: `${Math.min(100, r.cost / maxCost * 100)}%` } }) })
      ] })
    ] }, `${i2}:${r.name}`);
  };
  const subRow = (r) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_setRow", children: [
    visCheck(r.key, r.name),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_setField", children: [
      (0, import_jsx_runtime.jsxs)("span", { className: "dp_setLabel", children: [
        (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpRuleTag", children: t("cmpSubTag") })
      ] }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpModelName", children: r.name })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_setField", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_setLabel", children: t("cmpSubTag") }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_cmpRate", children: fill(t("cmpSubMonthly"), { v: fmtCost(r.monthly) }) })
    ] })
  ] }, r.key);
  const rowView = (r) => r.origin === "rule" ? ruleRow(r) : r.origin === "sub" ? subRow(r) : manualRow(r);
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_setPanel", children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_setSub", children: t("cmpSub") }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpControls", children: [
      paramControl(t("cmpInput"), "input", 0.1, 1e3, 0.1, 1e9),
      paramControl(t("cmpRatio"), "ratio", 0, 50, 0.01),
      paramControl(t("cmpHit"), "hit", 0, 100, 0.01)
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpPresets", children: [
      (0, import_jsx_runtime.jsx)(Seg, {
        id: "pulse-cmp-preset",
        value: preset,
        options: [
          { value: "real", label: t("cmpReal"), disabled: real === null },
          { value: "avg", label: t("cmpAvg") },
          { value: "long", label: t("cmpLong") },
          { value: "massive", label: t("cmpMassive") }
        ],
        onChange: (key) => key === "real" ? applyReal() : applyPreset(key),
        label: t("cmpPresetLabel")
      }),
      real === null ? (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("cmpNoData") }) : preset === "real" && (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: fill(t("cmpBased"), { from: real.from, to: real.to }) })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_setGrid", children: [
      settings.status === "loading" ? (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("setLoading") }) : settings.status === "error" ? (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: settings.error }) }) : rows.map(rowView),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_setActions", children: [
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: addManual, children: t("cmpAdd") }),
        (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_setLink", onClick: showAll, children: t("cmpShowAll") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("cmpHint") })
      ] })
    ] }),
    results.length > 0 ? (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmpCards", children: results.map(resultCard) }) : (0, import_jsx_runtime.jsx)("span", { className: "dp_costNote", children: t("cmpEmpty") })
  ] });
}

// src/client/css.js
var css = `.dp_root{--dp-gap:12px;--dp-t-fast:.16s;--dp-t-slot:.24s;--dp-t-draw:.6s;--dp-ease:cubic-bezier(.25,.7,.3,1);color:var(--dsw-alias-label-primary);font-size:var(--dp-fs-lead);line-height:20px;display:flex;flex-direction:column;gap:var(--dp-gap);color-scheme:light}body[data-ds-dark-theme] .dp_root{color-scheme:dark}/* Design tokens for every surface this bundle owns. .dp_root/.dp_themeScope
 * wrap the dashboard and the settings page, but the plugin's markup also lands
 * in seats dsh frames itself \u2014 the chat commandview row, the sidebar foot
 * action, general-settings rows, the plugin detail page \u2014 where an undeclared
 * var(--dp-*) silently drops padding, radius and type scale. Declaring the
 * same values on those top-level classes keeps every surface identical.
 *
 * The second half of the block BRIDGES token names: the sheet historically
 * spells six host tokens by names the host theme never defined \u2014 error red
 * lives at --dsw-alias-state-error-primary, warnings at
 * --dsw-alias-state-warn-primary, and the hover fills carry the alias
 * infix \u2014 so those vars resolved to nothing and every surface that wore
 * them (quota hot/warm fills, low-balance badge, error copy, hover states)
 * failed silently. Declaring the plugin's names inside :where (zero
 * specificity) resolves them from the host's real tokens; the plugin
 * palettes in themeCss keep overriding the danger/error names they already
 * target (higher specificity), and the host wins back control the day it
 * defines these names itself (:root beats :where). Fallbacks are a
 * last-resort palette, not the intended values. */
:where(.dp_root,.dp_themeScope,.dp_card,.dp_cmdCard,.dp_footBtn,.dp_setRow,.dp_cfgRow,.dp_sessBadge){--dp-pad-card:12px 14px;--dp-pad-row:8px 14px;--dp-pad-inset:10px 12px;--dp-r-card:12px;--dp-r-inset:8px;--dp-r-chip:6px;--dp-fs-micro:10px;--dp-fs-body:11px;--dp-fs-title:12px;--dp-fs-lead:13px;--dp-fs-value:17px;--dp-fs-stat:15px;--dp-fs-hero:20px;--dsw-alias-color-danger:var(--dsw-alias-state-error-primary,#e5484d);--dsw-alias-label-error:var(--dsw-alias-state-error-primary,#e5484d);--dsw-alias-color-warning:var(--dsw-alias-state-warn-primary,#e0a34e);--dsw-alias-state-success:var(--dsw-alias-state-success-primary,#22c55e);--dsw-interactive-bg-hover:var(--dsw-alias-interactive-bg-hover,#ffffff14);--dsw-interactive-bg-hover-accent:var(--dsw-alias-interactive-bg-hover-accent,#ffffff3d)}.dp_headerRow{display:flex;align-items:center;gap:6px;min-width:0}.dp_title{font-size:15px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary);flex:none}.dp_sub{color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-title);line-height:18px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.dp_iconBtn{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);background:transparent;border:none;border-radius:999px;cursor:pointer}.dp_iconBtn:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dp_iconBtn:disabled{opacity:.4;cursor:default}.dp_toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}.dp_toolbarGroup{display:flex;align-items:center;gap:6px;min-width:0}.dp_seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-inset);overflow:hidden;background:var(--dsw-alias-bg-base)}.dp_segBtn{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-title);line-height:18px;padding:4px 10px;cursor:pointer}.dp_segBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_segBtnActive{background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent);color:var(--dsw-alias-label-primary);font-weight:600}.dp_segBtnActive:hover{background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 24%,transparent)}.dp_chips{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(max(46%,22em),1fr));gap:.75em;align-items:stretch}.dp_chips:empty{display:none}.dp_chips>*:empty{display:none}.dp_chips>.dp_chip{box-sizing:border-box;width:100%;aspect-ratio:1.74;min-height:158px;max-height:236px;min-width:0}.dp_chips>*{align-self:start}.dp_chips .dp_balanceBar{grid-column:1/-1}.dp_cardBody.dp_ringBody{flex:1 1 auto;min-height:0;min-width:0;display:flex;align-items:center;gap:1.2em}.dp_ringBody .dp_ringWrap{position:relative;flex:0 0 auto;height:max(9em,min(100%,10.5em,46cqw));aspect-ratio:1}.dp_ringBody .dp_ringWrap svg{width:100%;height:100%;display:block}.dp_ringBody .dp_ringPct{font-size:clamp(16px,2.3cqw,25px);line-height:1.2}.dp_chip{position:relative;min-width:0;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:var(--dp-r-card);padding:var(--dp-pad-card);display:flex;flex-direction:column;gap:6px;overflow:hidden}.dp_cardBody{flex:1 1 0;min-height:0;min-width:0}.dp_chipValue{font-size:var(--dp-fs-value);font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.dp_chipNote{color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-body);line-height:16px}.dp_costOk{color:var(--dsw-alias-state-success-primary)}.dp_costOff{color:var(--dsw-alias-label-tertiary);font-weight:500}.dp_panelTitle{display:flex;align-items:baseline;gap:8px;color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-title);font-weight:600;line-height:18px;margin:2px 0 8px}.dp_panelCount{color:var(--dsw-alias-label-tertiary);font-weight:400}.dp_chartOuter{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dp-r-card);background:var(--dsw-specific-tip);padding:12px 14px 8px}.dp_chartGrid{position:relative;box-sizing:border-box;width:100%;height:auto;aspect-ratio:4.6;min-height:112px;max-height:188px;margin-top:10px;display:flex;align-items:flex-end;gap:2px}.dp_gridline{position:absolute;left:0;right:0;border-top:1px dashed var(--dsw-alias-border-l2);pointer-events:none}.dp_gridlabel{position:absolute;right:0;transform:translateY(-50%);font-size:var(--dp-fs-micro);color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-tip);padding:0 3px;pointer-events:none;font-variant-numeric:tabular-nums}.dp_gridlabelAxisL{left:0;right:auto;color:var(--dsw-alias-state-business-tertiary);color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_axisNote{color:var(--dsw-alias-label-caption);font-size:var(--dp-fs-body);line-height:16px;margin-left:auto}.dp_col{position:relative;flex:1 1 0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;cursor:default}.dp_colHit{position:absolute;inset:-3px 0 -1px;border-radius:4px;background:transparent}.dp_col:hover .dp_colHit{background:var(--dsw-interactive-bg-hover-accent)}.dp_bar{display:flex;flex-direction:column;justify-content:flex-end;width:100%;min-height:0;border-radius:3px 3px 0 0;overflow:hidden;position:relative;z-index:1}.dp_barNonzero{min-height:2px}.dp_segIn{background:var(--dsw-alias-state-business-primary);width:100%}.dp_segCache{background:var(--dsw-alias-state-business-tertiary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary));width:100%}.dp_segOut{background:var(--dsw-alias-state-success-primary);width:100%}.dp_barToday{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:2px;border-radius:4px 4px 0 0}.dp_xlabels{display:flex;gap:2px;margin-top:6px}.dp_xlabel{flex:1 1 0;text-align:center;font-size:var(--dp-fs-micro);color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}.dp_xlabelToday{color:var(--dsw-alias-label-secondary);font-weight:600}.dp_emptyChart{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-title)}.dp_legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-body);line-height:16px}.dp_legendDot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:-1px}.dp_legendIn{background:var(--dsw-alias-state-business-primary)}.dp_legendCache{background:var(--dsw-alias-state-business-tertiary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_legendOut{background:var(--dsw-alias-state-success-primary)}.dp_tip{position:absolute;bottom:calc(100% + 6px);z-index:3;pointer-events:none;background:var(--dsw-alias-tooltip-bg);color:#f7f8fa;border-radius:var(--dp-r-inset);padding:8px 10px;font-size:var(--dp-fs-body);line-height:17px;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.18)}.dp_tipAnchor{position:absolute;top:0;bottom:0;width:0;pointer-events:none}.dp_cardHead{display:flex;align-items:baseline;gap:8px;min-width:0}.dp_ringWrap{position:relative}.dp_ringTrack{stroke:var(--dsw-alias-border-l2)}.dp_ringValue{stroke:var(--dsw-alias-state-business-primary);transition:stroke-dashoffset var(--dp-t-draw) var(--dp-ease)}.dp_ringCenter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}.dp_ringPct{font-size:20px;font-weight:700;line-height:26px;font-variant-numeric:tabular-nums}
.dp_ringPct.dp_ringNa{color:var(--dsw-alias-label-tertiary);font-weight:600}.dp_ringSide{display:flex;flex-direction:column;gap:6px;min-width:0;justify-content:center;flex:1 1 auto}.dp_cardLabel{color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-body);line-height:16px;letter-spacing:.02em;flex:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_ringSideRow{color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-body);line-height:16px;display:flex;gap:6px;align-items:baseline;font-variant-numeric:tabular-nums}.dp_ringSideRow b{color:var(--dsw-alias-label-secondary);font-weight:600;font-size:var(--dp-fs-title)}
/* \u4E3B\u884C\uFF08\u65B9\u6848 A\uFF09\uFF1A\u547D\u4E2D\u503C\u4E0E\u5DE6\u5361 \xA519.01 \u540C\u7EA7\uFF0815px/600/\u4E3B\u8272\uFF09\u2014\u2014\u73AF\u91CC\u7684 98%
   \u662F\u7ED3\u8BBA\uFF0C\u8FD9\u4E00\u884C\u662F\u8BC1\u636E\uFF1B\u603B\u8F93\u5165\u8DDF\u5728\u540E\u9762\u4FDD\u6301\u5C0F\u5B57\u7070\u3002 */
.dp_ringSideRow .dp_hitVal{font-size:var(--dp-fs-stat);line-height:20px;color:var(--dsw-alias-label-primary)}
.dp_ringSideRow .dp_hitSub{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}.dp_listBox{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dp-r-card);background:var(--dsw-specific-tip);padding:var(--dp-pad-card);display:flex;flex-direction:column;gap:9px;min-width:0}.dp_barRow{display:grid;grid-template-columns:minmax(64px,220px) minmax(0,1fr) 96px;gap:10px;align-items:center;font-size:var(--dp-fs-title);line-height:17px;min-width:0}.dp_barRowName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}.dp_barRowTrack{position:relative;height:8px;border-radius:4px;background:var(--dsw-alias-bg-skeleton);overflow:hidden}.dp_barRowFill{position:absolute;inset:0 auto 0 0;border-radius:4px;background:var(--dsw-alias-state-business-primary)}.dp_barRowVal{text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}.dp_table{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dp-r-card);background:var(--dsw-specific-tip);overflow:hidden}.dp_tableRow{display:grid;grid-template-columns:28px minmax(80px,1.6fr) minmax(52px,.7fr) minmax(70px,1fr) 3fr;gap:8px;align-items:center;padding:var(--dp-pad-row);font-size:var(--dp-fs-title);line-height:17px;min-width:0}.dp_tableRow:nth-child(odd){background:var(--dsw-interactive-bg-hover)}.dp_tableHead{background:transparent!important;color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-body);font-weight:500}.dp_tableRank{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_tableName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-weight:500}.dp_tableNum{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}.dp_tableTokens{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);white-space:nowrap}.dp_tableTrack{height:6px}.dp_tableTrack .dp_barRowTrack{height:6px;border-radius:3px}.dp_tableTrack .dp_barRowFill{border-radius:3px}.dp_stateBox{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dp-r-card);background:var(--dsw-specific-tip);padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}.dp_stateTitle{font-size:14px;font-weight:600}.dp_stateBody{color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-title);line-height:18px;max-width:420px}.dp_stateIcon{color:var(--dsw-alias-label-tertiary)}.dp_skeleton{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dp-r-card);background:var(--dsw-specific-tip);height:220px;position:relative;overflow:hidden}.dp_skeleton::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,var(--dsw-alias-bg-skeleton),transparent);animation:dp_shimmer 1.4s infinite}.dp_skeletonShort{height:56px}@keyframes dp_shimmer{to{transform:translateX(100%)}}.dp_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:var(--dp-r-card);padding:var(--dp-pad-card);max-width:100%}.dp_variantCard{--dp-gap:10px}.dp_page{padding:2px 2px 16px}.dp_overlaySeat{position:fixed;inset:0;pointer-events:auto;z-index:60}.dp_overlayCard{position:absolute;right:20px;bottom:20px;width:min(880px,calc(100vw - 48px));max-height:min(78vh,760px);overflow:hidden;display:flex;flex-direction:column;pointer-events:auto;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.22)}.dp_overlayCardSummary{width:min(520px,calc(100vw - 32px));max-height:min(86vh,620px)}.dp_overlayScroll{overflow:auto;max-height:min(78vh,760px);padding:16px 18px 20px}.dp_overlayActions{position:absolute;top:14px;right:18px;display:flex;gap:6px;z-index:3}.dp_headerRowFloat{padding-right:80px}.dp_footBtn{display:inline-flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:6px 10px;border:none;background:transparent;border-radius:var(--dp-r-inset);color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-lead);cursor:pointer}.dp_footBtn:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dp_footRail{width:40px;min-height:32px;justify-content:center;padding:6px}.dp_costNote{color:var(--dsw-alias-label-caption);font-size:var(--dp-fs-body);line-height:16px}.dp_retryRow{display:flex;gap:8px}.dp_hcWrap{display:flex;gap:8px;min-width:0;box-sizing:border-box;width:100%;height:auto;aspect-ratio:4.2;min-height:140px;max-height:196px}.dp_hcGutter{flex:none;display:grid;grid-template-rows:16px repeat(7,minmax(0,1fr));color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-micro);line-height:1}.dp_hcGutter>span{display:flex;align-items:center;justify-content:flex-end;padding-right:4px}.dp_hcBody{flex:1;min-width:0;display:flex;flex-direction:column}.dp_hcMonths{flex:none;display:grid;column-gap:2px;height:16px;font-size:var(--dp-fs-micro);line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden}.dp_hcMonths>span{overflow:visible;white-space:nowrap;min-width:0}.dp_hcGrid{flex:1;min-height:0;display:grid;gap:2px;grid-template-rows:repeat(7,minmax(0,1fr))}.dp_hcCell{appearance:none;border:none;padding:0;margin:0;min-width:0;border-radius:2px;background:var(--dsw-alias-bg-skeleton);cursor:pointer}.dp_hcCell:hover,.dp_hcCell:focus-visible{outline:1px solid var(--dsw-alias-border-l4)}.dp_hcFuture{opacity:.35;cursor:default}.dp_hcToday{outline:1px solid var(--dsw-alias-state-business-primary)}.dp_hcL1{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}.dp_hcL2{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 34%,transparent)}.dp_hcL3{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,transparent)}.dp_hcL4{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 82%,transparent)}.dp_hcDetail{display:flex;align-items:center;gap:10px;min-height:20px;margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-body);line-height:18px}.dp_hcDetail b{font-weight:600;color:var(--dsw-alias-label-primary)}.dp_hcScale{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-body);line-height:16px}.dp_hcSwatch{width:10px;height:10px;border-radius:2px;background:var(--dsw-alias-bg-skeleton);display:inline-block}.dp_picker{position:relative;min-width:0}.dp_pickerBtn{display:flex;align-items:center;gap:6px;max-width:200px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:var(--dp-r-inset);font-size:var(--dp-fs-title);line-height:18px;padding:4px 8px;cursor:pointer}.dp_pickerBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_pickerValue{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_pickerCaret{color:var(--dsw-alias-label-tertiary);flex:none}.dp_pickerMenu{position:absolute;z-index:30;top:calc(100% + 4px);left:0;width:224px;max-height:280px;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-inset);background:var(--dsw-alias-bg-overlay);box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden}.dp_pickerSearch{margin:8px 8px 0;flex:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:var(--dp-r-chip);font-size:var(--dp-fs-title);line-height:18px;padding:4px 8px}.dp_pickerSearch:focus{outline:1px solid var(--dsw-alias-state-business-primary)}.dp_pickerList{overflow-y:auto;padding:4px;margin-top:4px}.dp_pickerItem{display:block;width:100%;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary);font-size:var(--dp-fs-title);line-height:18px;padding:4px 8px;border-radius:var(--dp-r-chip);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_pickerItem:hover{background:var(--dsw-interactive-bg-hover)}.dp_pickerItemActive{font-weight:600;background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent)}.dp_pickerEmpty{padding:8px 10px;color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-title)}.dp_pickerCaret{display:inline-flex;color:var(--dsw-alias-label-tertiary);flex:none}.dp_trendBody{box-sizing:border-box;min-height:206px;display:flex;flex-direction:column}.dp_trendBody>*{min-height:0}.dp_balanceGrow{flex:1;min-height:0;display:flex;flex-direction:column}.dp_balanceGrow>*{flex:1;min-height:0}.dp_projScroll{height:100%;min-height:0;overflow:auto}.dp_hourGrid{position:relative;box-sizing:border-box;width:100%;height:auto;aspect-ratio:4.6;min-height:112px;max-height:188px;margin-top:10px}.dp_hourSvg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.dp_hourLine{fill:none;stroke-width:1.5;vector-effect:non-scaling-stroke}.dp_hourLineIn{stroke:var(--dsw-alias-state-business-primary)}.dp_hourLineCache{stroke:var(--dsw-alias-state-business-tertiary);stroke:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_hourLineOut{stroke:var(--dsw-alias-state-success-primary)}.dp_hourHover{position:absolute;top:0;bottom:0;cursor:crosshair}.dp_hourCursor{position:absolute;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l4);pointer-events:none}.dp_hourXlabels{display:flex;justify-content:space-between;margin-top:6px;font-size:var(--dp-fs-micro);color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_setPanel{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-card);background:var(--dsw-alias-bg-layer-2)}.dp_setTitle{font-size:var(--dp-fs-lead);font-weight:600;color:var(--dsw-alias-label-primary)}.dp_setSub{font-size:var(--dp-fs-title);color:var(--dsw-alias-label-tertiary);line-height:18px}.dp_setGrid{display:flex;flex-direction:column;gap:6px}.dp_setRow{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}.dp_setRowMid{align-items:center}.dp_setInline{display:flex;align-items:center;gap:6px;min-width:0}.dp_aboutVersion{flex:none;font-size:var(--dp-fs-lead);line-height:18px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.dp_priceRow{align-items:center}.dp_priceFields{display:grid;grid-template-columns:repeat(3,minmax(0,92px));gap:8px}.dp_priceMonthly{color:var(--dsw-alias-state-business-primary);font-size:var(--dp-fs-title);font-weight:600;white-space:nowrap}.dp_priceMonthlyRow{opacity:.85}.dp_setMonthlyBtn{flex:none;padding:2px 8px}.dp_setField{display:flex;flex-direction:column;gap:4px;min-width:0}.dp_setLabel{font-size:var(--dp-fs-body);color:var(--dsw-alias-label-tertiary);white-space:nowrap}.dp_setInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:30px;font:inherit;font-size:var(--dp-fs-title);color:var(--dsw-alias-label-primary);border-radius:var(--dp-r-chip);padding:0 8px;min-width:64px;width:100%;box-sizing:border-box}.dp_setInput:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.dp_setModel{min-width:140px;flex:1}.dp_setActions{display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap}.dp_setMsg{font-size:var(--dp-fs-title);line-height:16px}.dp_setMsgOk{color:var(--dsw-alias-state-success-primary)}.dp_setMsgErr{color:var(--dsw-alias-label-error)}.dp_setSwitch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:var(--dp-fs-lead);color:var(--dsw-alias-label-primary)}.dp_setSwitch input{accent-color:var(--dsw-alias-brand-primary)}.dp_setRemove{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:var(--dp-fs-title);padding:4px 6px;border-radius:var(--dp-r-chip)}.dp_setRemove:hover:not(:disabled){color:var(--dsw-alias-label-error)}.dp_setRemove:disabled{cursor:default;opacity:.5}.dp_backBtn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:var(--dp-fs-title);line-height:18px;padding:4px 10px;border-radius:var(--dp-r-inset);cursor:pointer}.dp_backBtn:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dp_setGroup{display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-title);font-weight:600;line-height:18px}.dp_setGroup::after{content:"";flex:1;border-top:1px solid var(--dsw-alias-border-l1)}.dp_setModelInfo{display:flex;flex-direction:column;gap:1px;min-width:170px;flex:1;justify-content:flex-end;padding-bottom:3px}.dp_modelId{font-size:var(--dp-fs-title);line-height:17px;color:var(--dsw-alias-label-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_modelName{font-size:var(--dp-fs-body);line-height:15px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_peakSub{margin-top:8px;padding:var(--dp-pad-inset);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:8px}.dp_peakGrid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px}.dp_hourCell{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:var(--dp-fs-micro);line-height:14px;height:24px;padding:0;border-radius:5px;cursor:pointer;font-variant-numeric:tabular-nums}.dp_hourCell:hover:not(:disabled){border-color:var(--dsw-alias-border-l4)}.dp_hourCellOn{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 26%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,transparent);color:var(--dsw-alias-label-primary);font-weight:600}.dp_hourCell:disabled{cursor:default;opacity:.5}.dp_setLink{border:none;background:transparent;color:var(--dsw-alias-state-business-primary);cursor:pointer;font:inherit;font-size:var(--dp-fs-body);line-height:16px;padding:0}.dp_setLink:hover{text-decoration:underline}.dp_miniBtn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:var(--dp-fs-body);line-height:16px;padding:3px 8px;border-radius:7px;cursor:pointer}.dp_miniBtn:hover:not(:disabled){background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dp_miniBtn:disabled{cursor:default;opacity:.5}.dp_miniBtnOn{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);color:var(--dsw-alias-label-primary);font-weight:600}.dp_setFxInput{width:74px}.dp_setPreview{color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-title);line-height:18px;font-variant-numeric:tabular-nums}.dp_chipValueBtn{font:inherit;font-size:var(--dp-fs-value);font-weight:600;line-height:24px;color:var(--dsw-alias-label-tertiary);background:none;border:none;padding:0;cursor:pointer;text-align:left;text-decoration:underline;text-underline-offset:3px;font-variant-numeric:tabular-nums}.dp_chipValueBtn:hover{color:var(--dsw-alias-label-secondary)}.dp_chipNoteBtn{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:var(--dp-fs-body);line-height:16px;padding:0;text-align:left;text-decoration:underline;text-underline-offset:2px}.dp_chipNoteBtn:hover{color:var(--dsw-alias-label-secondary)}/* The ONE "more" mark: geometry twins of the border-chevron the hot-zone
   heads paint (.4em corner, 1.5px arms); inline context so inline-block and
   a baseline nudge replace the flex child's align-self. Note buttons stop
   appending a literal \u203A so every pointer on the canvas is one glyph
   technology, and it follows currentColor through the hover step. */
.dp_chipNoteBtn::after{content:"";display:inline-block;width:.4em;height:.4em;margin-left:.3em;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);vertical-align:.08em}@media (max-width:560px){.dp_peakGrid{grid-template-columns:repeat(6,minmax(0,1fr))}}.dp_colZero:hover{background:transparent}.dp_colZero:hover .dp_colHit{background:transparent}.dp_swapIn{animation:dpSwapIn .2s ease}.dp_focusNote{display:flex;align-items:center;gap:5px;color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-body);line-height:16px;margin:8px 2px 0}@keyframes dpSwapIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.dp_swapIn{animation:none}}.dp_cardCount{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-body);line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dp_estCard{display:flex;flex-direction:column;gap:2px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:var(--dp-r-card);padding:var(--dp-pad-inset)}.dp_estBudgetPanel{display:grid;grid-template-columns:minmax(240px,340px) minmax(0,1fr);gap:10px;align-items:stretch;animation:dpSlideDown var(--dp-t-slot) var(--dp-ease)}.dp_estBudgetPanel>*{min-height:0}@media (max-width:760px){.dp_estBudgetPanel{grid-template-columns:1fr}}@keyframes dpSlideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.dp_estBudgetPanel{animation:none}}.dp_balanceBar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dp-r-card);background:var(--dsw-specific-tip);padding:var(--dp-pad-row)}.dp_balanceLabel{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-tertiary);letter-spacing:.02em}.dp_balanceSub{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_balanceWarn{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-error);font-weight:600}.dp_barRowCost{display:block;font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_cmpControls{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px}.dp_cmpControl{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-card);padding:8px 10px;background:var(--dsw-alias-bg-layer-3)}.dp_cmpLabel{display:flex;justify-content:space-between;gap:8px;font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-tertiary)}.dp_cmpValue{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);font-weight:600}.dp_cmpRow{display:flex;align-items:center;gap:8px}.dp_cmpRange{flex:1;min-width:0;accent-color:var(--dsw-alias-state-business-primary);height:4px}.dp_cmpNum{width:76px;height:30px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:var(--dp-r-chip);padding:0 6px;font-size:var(--dp-fs-title);font-variant-numeric:tabular-nums;box-sizing:border-box}.dp_cmpPresets{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.dp_cmpVis{accent-color:var(--dsw-alias-state-business-primary);width:14px;height:14px;flex:none;cursor:pointer;align-self:center}.dp_cmpRate{font-size:var(--dp-fs-title);line-height:18px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;white-space:nowrap;min-width:64px;padding:6px 8px;border:1px solid transparent;border-radius:var(--dp-r-chip)}.dp_cmpRuleTag{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 6px;white-space:nowrap;display:inline-flex}.dp_cmpModelName{display:flex;align-items:baseline;gap:6px;font-size:var(--dp-fs-lead);font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap}.dp_cmpCards{display:flex;flex-direction:column;gap:8px}.dp_cmpCard{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-card);padding:10px 14px;background:var(--dsw-alias-bg-layer-2)}.dp_cmpBest{border-color:var(--dsw-alias-state-success);background:color-mix(in srgb,var(--dsw-alias-state-success) 8%,transparent)}.dp_cmpCardInfo{display:flex;flex-direction:column;gap:2px;min-width:0}.dp_cmpCardHead{display:flex;align-items:center;gap:8px}.dp_cmpCardName{font-weight:600;font-size:var(--dp-fs-lead)}.dp_cmpBadge{background:var(--dsw-alias-state-success);color:#fff;font-size:var(--dp-fs-micro);font-weight:600;padding:1px 8px;border-radius:999px}.dp_cmpCardDetail{display:flex;flex-direction:column;gap:2px;font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_cmpCardRight{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}.dp_cmpCardCost{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}.dp_cmpCardCost small{font-size:var(--dp-fs-body);font-weight:400;color:var(--dsw-alias-label-tertiary);margin-left:2px}.dp_cmpBarOuter{width:110px;height:4px;border-radius:2px;background:var(--dsw-interactive-bg-hover);overflow:hidden}.dp_cmpBar{height:100%;border-radius:2px;background:var(--dsw-alias-state-business-primary)}.dp_budgetInput{width:90px;height:26px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:var(--dp-r-chip);padding:0 8px;font:inherit;font-size:var(--dp-fs-title);font-variant-numeric:tabular-nums}.dp_budgetInputRow{display:inline-flex;align-items:center;gap:6px}.dp_budgetTrack{flex:1 1 100%;height:6px;border-radius:3px;background:var(--dsw-interactive-bg-hover);overflow:hidden}.dp_budgetFill{height:100%;border-radius:3px;background:var(--dsw-alias-state-business-primary);transition:width .2s}.dp_budgetFillOver{background:var(--dsw-alias-label-error)}.dp_footBalance{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);border-radius:999px;padding:1px 8px;white-space:nowrap}.dp_dateBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:var(--dp-r-chip);padding:3px 8px;font:inherit;font-size:var(--dp-fs-title);font-variant-numeric:tabular-nums;cursor:pointer}.dp_dateBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_calOverlay{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}.dp_calCard{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-card);padding:var(--dp-pad-card);display:flex;flex-direction:column;gap:8px;max-width:320px;width:100%}.dp_calHead{display:flex;align-items:center;justify-content:space-between}.dp_calNav{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);width:26px;height:26px;border-radius:var(--dp-r-chip);cursor:pointer;font-size:14px;line-height:1}.dp_calMonth{border:none;background:transparent;padding:0;cursor:pointer;font-family:inherit;font-size:var(--dp-fs-lead);font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.dp_calGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.dp_calDow{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);text-align:center;padding:2px 0}.dp_calCell{height:30px;border:none;background:transparent;color:var(--dsw-alias-label-primary);border-radius:var(--dp-r-chip);cursor:pointer;font-size:var(--dp-fs-title);font-variant-numeric:tabular-nums}.dp_calCell:hover{background:var(--dsw-interactive-bg-hover)}.dp_calEmpty{cursor:default}.dp_calIn{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent)}.dp_calStart,.dp_calEnd{background:var(--dsw-alias-state-business-primary);color:#fff;font-weight:600}.dp_calToday{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}.dp_calFoot{text-align:center}.dp_calQuick{display:flex;flex-wrap:wrap;gap:4px}.dp_calQuick .dp_segBtn{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-chip);padding:2px 8px;font-size:var(--dp-fs-micro);line-height:16px}.dp_calOff{opacity:.35;cursor:default}.dp_calCell.dp_calOff:hover{background:transparent}.dp_calInputs{display:flex;align-items:center;gap:6px}.dp_calSep{flex:none;color:var(--dsw-alias-label-tertiary)}.dp_calInput{display:inline-flex;align-items:center;min-width:0;flex:1 1 40%;height:26px;padding:0 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-chip);background:var(--dsw-alias-bg-base)}.dp_calInput input{flex:1 1 auto;min-width:0;border:none;background:transparent;color:inherit;font:inherit;font-size:var(--dp-fs-title);line-height:18px;padding:0;outline:none;font-variant-numeric:tabular-nums}.dp_calInputBad{border-color:var(--dsw-alias-color-danger)}.dp_calYM{display:flex;flex-direction:column;gap:8px}.dp_calYMGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.dp_page > .dp_headerRow{margin-bottom:12px}.dp_panelsGrid{display:flex;flex-direction:column;gap:2px}.dp_panelItem{display:flex;flex-direction:column;gap:2px;min-width:0}.dp_panelItem .dp_setSwitch{flex:none}.dp_panelItemDesc{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary)} .dp_sessList{display:flex;flex-direction:column;gap:6px}.dp_sessGroup{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-inset);overflow:hidden}.dp_sessHead{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;background:var(--dsw-alias-bg-base);border:none;cursor:pointer;text-align:left;font:inherit;color:inherit}.dp_sessHead:hover{background:var(--dsw-interactive-bg-hover)}.dp_sessName{font-weight:600;flex:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_sessMeta{color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-title);flex:none}.dp_sessSubTotal{color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-title);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_sessToggle{flex:none;color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-title)}.dp_sessBody{display:flex;flex-direction:column;border-top:1px solid var(--dsw-alias-border-l2)}.dp_sessRow{display:flex;align-items:center;gap:8px;padding:5px 10px;flex-wrap:wrap}.dp_sessRow:nth-child(even){background:var(--dsw-interactive-bg-hover)}.dp_sessBadge{flex:none;font-size:var(--dp-fs-body);line-height:16px;padding:0 6px;border-radius:999px;background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dp_sessBadgeSub{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);color:var(--dsw-alias-label-primary)}.dp_sessTitle{flex:none;min-width:0;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dp-fs-body);color:var(--dsw-alias-label-primary)}.dp_sessModel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-title)}.dp_sessNum{flex:none;font-size:var(--dp-fs-title);text-align:right}.dp_sessDetail{display:flex;flex-direction:column;gap:8px;width:100%;padding:8px 10px 10px;border-top:1px dashed var(--dsw-alias-border-l2)}.dp_breakRow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.dp_breakHint{color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-title)}.dp_breakCount{flex:none;font-size:var(--dp-fs-title);color:var(--dsw-alias-label-secondary)}.dp_breakChip{flex:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);border-radius:999px;font-size:var(--dp-fs-body);line-height:16px;padding:1px 8px;cursor:pointer}.dp_breakChip:hover{border-color:var(--dsw-alias-state-business-primary)}.dp_segTable{display:flex;flex-direction:column}.dp_tableNameBtn{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:none;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:0}.dp_tableNameBtn:hover{color:var(--dsw-alias-state-business-primary);text-decoration:underline}.dp_sessModels{display:flex;flex-direction:column;width:100%;gap:2px;padding:2px 0 2px 24px;border-top:1px dashed var(--dsw-alias-border-l2)}.dp_sessModelRow{display:flex;align-items:center;gap:8px}.dp_sessModelName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-title)}.dp_curveWrap{position:relative}.dp_curveTag{position:absolute;top:2px;transform:translateX(-50%);pointer-events:none;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:0 5px;font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-primary);white-space:nowrap;z-index:2;box-shadow:0 1px 4px rgba(0,0,0,.14)}.dp_breakTurn{color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-body);line-height:16px;flex:none}.dp_sessRowCurrent{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);outline:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);outline-offset:-1px;border-radius:var(--dp-r-inset)}.dp_sessBadgeCurrent{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 20%,transparent);color:var(--dsw-alias-state-business-primary);font-weight:600}.dp_cmdCard{--dp-gap:10px;display:flex;flex-direction:column;gap:var(--dp-gap)}.dp_cmdHead{display:flex;align-items:center;gap:8px;min-width:0}.dp_cmdTitle{font-size:14px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary);flex:none}.dp_cmdWs{min-width:0;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dp-fs-title);line-height:18px;color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);border-radius:999px;padding:1px 8px}.dp_cmdHead>svg{color:var(--dsw-alias-state-business-primary);flex:none}.dp_cmdHero{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;padding:8px 10px;border-radius:var(--dp-r-inset);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent)}.dp_cmdHeroLabel{font-size:var(--dp-fs-body);line-height:18px;color:var(--dsw-alias-label-secondary);flex:none}.dp_cmdHeroValue{font-size:var(--dp-fs-value);font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.dp_cmdHeroMeta{min-width:0;font-size:var(--dp-fs-title);line-height:18px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_cmdScopeLine{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_cmdGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(238px,1fr));gap:10px 24px;max-width:820px}.dp_cmdBlock{display:flex;flex-direction:column;gap:6px;min-width:0;max-width:440px}.dp_cmdBlockTitle{display:flex;align-items:baseline;gap:6px;font-size:var(--dp-fs-title);font-weight:600;line-height:18px;color:var(--dsw-alias-label-secondary)}.dp_cmdBlockSub{font-weight:400;color:var(--dsw-alias-label-tertiary)}.dp_cmdBars{display:flex;flex-direction:column;gap:5px;min-width:0}.dp_cmdBar{display:grid;grid-template-columns:minmax(56px,118px) minmax(24px,1fr) 38px 54px;align-items:center;gap:8px;min-width:0}.dp_cmdBarName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dp-fs-title);line-height:16px;color:var(--dsw-alias-label-secondary)}.dp_cmdBarTrack{display:block;height:7px;border-radius:999px;background:var(--dsw-alias-bg-skeleton);overflow:hidden}.dp_cmdBarFill{display:block;height:100%;min-width:2px;border-radius:999px;background:var(--dsw-alias-state-business-primary)}.dp_cmdBarFill.dp_cmdBarFillRest{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 38%,transparent)}.dp_cmdBarPct{font-size:var(--dp-fs-title);line-height:16px;color:var(--dsw-alias-label-primary);text-align:right;font-variant-numeric:tabular-nums}.dp_cmdBarCost{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-tertiary);text-align:right;font-variant-numeric:tabular-nums}.dp_cmdSess{display:flex;flex-direction:column;gap:4px;min-width:0}.dp_cmdSessRow{display:grid;grid-template-columns:42px 64px minmax(0,1fr) 52px;align-items:center;gap:8px;min-width:0;font-size:var(--dp-fs-title);line-height:16px;font-variant-numeric:tabular-nums}.dp_cmdSessDay{color:var(--dsw-alias-label-tertiary)}.dp_cmdSessTok{font-weight:600;color:var(--dsw-alias-label-primary)}.dp_cmdSessMeta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary)}.dp_cmdSessCost{text-align:right;color:var(--dsw-alias-label-secondary)}.dp_cmdFoot{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:2px}.dp_cmdNote{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-tertiary)}`;
var themeCss = `body:not([data-ds-dark-theme]) .dp_themeScope[data-dp-theme="pink"],body:not([data-ds-dark-theme]) .dp_root[data-dp-theme="pink"]{--dsw-alias-bg-base:#fff8fb;--dsw-alias-bg-layer-2:#fff;--dsw-alias-bg-layer-3:#fdf0f6;--dsw-alias-bg-overlay:#fbe5ef;--dsw-alias-bg-skeleton:#e8588f12;--dsw-alias-border-l1:#e8588f26;--dsw-alias-border-l2:#e8588f3d;--dsw-alias-border-l4:#e8588f59;--dsw-alias-brand-primary:#b03066;--dsw-alias-color-danger:#e5484d;--dsw-alias-interactive-bg-hover:#e8588f1a;--dsw-alias-label-caption:#b06e86;--dsw-alias-label-error:#e5484d;--dsw-alias-label-primary:#45162c;--dsw-alias-label-primary-inverted:#fff8fb;--dsw-alias-label-secondary:#7d4358;--dsw-alias-label-tertiary:#a06880;--dsw-alias-state-business-primary:#e8588f;--dsw-alias-state-business-tertiary:#fbd6e4;--dsw-alias-state-success:#22c55e;--dsw-alias-state-success-primary:#22c55e;--dsw-alias-tooltip-bg:#5a2840}body[data-ds-dark-theme] .dp_themeScope[data-dp-theme="pink"],body[data-ds-dark-theme] .dp_root[data-dp-theme="pink"]{--dsw-alias-bg-base:#1b1418;--dsw-alias-bg-layer-2:#241a20;--dsw-alias-bg-layer-3:#2c2127;--dsw-alias-bg-overlay:#3a2b33;--dsw-alias-bg-skeleton:#e8588f1f;--dsw-alias-border-l1:#e8588f33;--dsw-alias-border-l2:#e8588f4d;--dsw-alias-border-l4:#e8588f66;--dsw-alias-brand-primary:#f2709f;--dsw-alias-color-danger:#f25a5a;--dsw-alias-interactive-bg-hover:#e8588f24;--dsw-alias-label-caption:#9a7186;--dsw-alias-label-error:#f25a5a;--dsw-alias-label-primary:#fbe4ee;--dsw-alias-label-primary-inverted:#1b1418;--dsw-alias-label-secondary:#d5a8bd;--dsw-alias-label-tertiary:#b98da2;--dsw-alias-state-business-primary:#f2709f;--dsw-alias-state-business-tertiary:#5c2f43;--dsw-alias-state-success:#22c55e;--dsw-alias-state-success-primary:#22c55e;--dsw-alias-tooltip-bg:#3f2b36}body:not([data-ds-dark-theme]) .dp_themeScope[data-dp-theme="orange"],body:not([data-ds-dark-theme]) .dp_root[data-dp-theme="orange"]{--dsw-alias-bg-base:#fff9f2;--dsw-alias-bg-layer-2:#fff;--dsw-alias-bg-layer-3:#fdf2e5;--dsw-alias-bg-overlay:#fbe7cf;--dsw-alias-bg-skeleton:#f08a2e14;--dsw-alias-border-l1:#f08a2e29;--dsw-alias-border-l2:#f08a2e40;--dsw-alias-border-l4:#f08a2e5c;--dsw-alias-brand-primary:#b35f12;--dsw-alias-color-danger:#e5484d;--dsw-alias-interactive-bg-hover:#f08a2e1a;--dsw-alias-label-caption:#b08054;--dsw-alias-label-error:#e5484d;--dsw-alias-label-primary:#4a2a10;--dsw-alias-label-primary-inverted:#fff9f2;--dsw-alias-label-secondary:#855932;--dsw-alias-label-tertiary:#a87d52;--dsw-alias-state-business-primary:#f08a2e;--dsw-alias-state-business-tertiary:#fce3c6;--dsw-alias-state-success:#22c55e;--dsw-alias-state-success-primary:#22c55e;--dsw-alias-tooltip-bg:#5e3c1c}body[data-ds-dark-theme] .dp_themeScope[data-dp-theme="orange"],body[data-ds-dark-theme] .dp_root[data-dp-theme="orange"]{--dsw-alias-bg-base:#1c150e;--dsw-alias-bg-layer-2:#251c13;--dsw-alias-bg-layer-3:#2e241a;--dsw-alias-bg-overlay:#3d2f20;--dsw-alias-bg-skeleton:#f08a2e1f;--dsw-alias-border-l1:#f08a2e33;--dsw-alias-border-l2:#f08a2e4d;--dsw-alias-border-l4:#f08a2e66;--dsw-alias-brand-primary:#f5a04a;--dsw-alias-color-danger:#f25a5a;--dsw-alias-interactive-bg-hover:#f08a2e26;--dsw-alias-label-caption:#a58868;--dsw-alias-label-error:#f25a5a;--dsw-alias-label-primary:#fdeed8;--dsw-alias-label-primary-inverted:#1c150e;--dsw-alias-label-secondary:#dbbc95;--dsw-alias-label-tertiary:#bd9c72;--dsw-alias-state-business-primary:#f5a04a;--dsw-alias-state-business-tertiary:#5e3f22;--dsw-alias-state-success:#22c55e;--dsw-alias-state-success-primary:#22c55e;--dsw-alias-tooltip-bg:#432e1a}body:not([data-ds-dark-theme]) .dp_themeScope[data-dp-theme="bw"],body:not([data-ds-dark-theme]) .dp_root[data-dp-theme="bw"]{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-2:#fff;--dsw-alias-bg-layer-3:#fff;--dsw-alias-bg-overlay:#e9ecf2;--dsw-alias-bg-skeleton:#0000000a;--dsw-alias-border-l1:#0000000a;--dsw-alias-border-l2:#0000001a;--dsw-alias-border-l4:#00000029;--dsw-alias-brand-primary:#0f1115;--dsw-alias-color-danger:#545557;--dsw-alias-interactive-bg-hover:#2631480f;--dsw-alias-label-caption:#adb2b8;--dsw-alias-label-error:#545557;--dsw-alias-label-primary:#0f1115;--dsw-alias-label-primary-inverted:#fff;--dsw-alias-label-secondary:#61666b;--dsw-alias-label-tertiary:#81858c;--dsw-alias-state-business-primary:#0f1115;--dsw-alias-state-business-tertiary:#e9ecf2;--dsw-alias-state-success:#61666b;--dsw-alias-state-success-primary:#61666b;--dsw-alias-tooltip-bg:#2c2c2e}body[data-ds-dark-theme] .dp_themeScope[data-dp-theme="bw"],body[data-ds-dark-theme] .dp_root[data-dp-theme="bw"]{--dsw-alias-bg-base:#151517;--dsw-alias-bg-layer-2:#2c2c2e;--dsw-alias-bg-layer-3:#353638;--dsw-alias-bg-overlay:#61666b;--dsw-alias-bg-skeleton:#ffffff14;--dsw-alias-border-l1:#ffffff0f;--dsw-alias-border-l2:#ffffff1f;--dsw-alias-border-l4:#fff3;--dsw-alias-brand-primary:#f9fafb;--dsw-alias-color-danger:#adb2b8;--dsw-alias-interactive-bg-hover:#ffffff14;--dsw-alias-label-caption:#81858c;--dsw-alias-label-error:#adb2b8;--dsw-alias-label-primary:#f9fafb;--dsw-alias-label-primary-inverted:#0f1115;--dsw-alias-label-secondary:#cfd3d6;--dsw-alias-label-tertiary:#adb2b8;--dsw-alias-state-business-primary:#f9fafb;--dsw-alias-state-business-tertiary:#2c2c2e;--dsw-alias-state-success:#adb2b8;--dsw-alias-state-success-primary:#adb2b8;--dsw-alias-tooltip-bg:#43454a}`;
var rowCss = `.dp_cfgRow{border-bottom:.5px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:24px;padding:16px 0;display:flex}.dp_setRowText{min-width:0}.dp_setRowTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px}.dp_setRowDesc{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}.dp_setSwitchBox{accent-color:var(--dsw-alias-brand-primary);width:16px;height:16px;flex:none;margin:0}.dp_setFeeInput{width:96px;padding:4px 8px;font-size:var(--dp-fs-title);line-height:18px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-chip);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}`;
var chartCss = `.dp_barZero{position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:1px;background:color-mix(in srgb,var(--dsw-alias-border-l3) 80%,transparent)}.dp_col:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 6%,transparent);border-radius:4px 4px 0 0}.dp_barRowFill{background:var(--dp-accent-fill,var(--dsw-alias-state-business-primary))}.dp_accentCard{display:flex;flex-direction:column;gap:8px;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2);margin-top:4px}.dp_accentHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.dp_accentRow{display:flex;align-items:center;gap:10px;min-width:0}.dp_accentDot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--dsw-alias-bg-skeleton)}.dp_accentName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dp-fs-title);line-height:18px;color:var(--dsw-alias-label-secondary)}.dp_accentPick{flex:none;width:28px;height:24px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-inset);background:var(--dsw-alias-bg-base);cursor:pointer}.dp_col{cursor:pointer}.dp_segModel{width:100%}.dp_stackToggle{margin-left:auto;flex:none}.dp_panelTitle.dp_hasStack .dp_panelCount{margin-left:8px}.dp_drillStage{position:relative;box-sizing:border-box;width:100%;height:auto;aspect-ratio:5.2;min-height:100px;max-height:164px;margin:8px 0 0;display:flex;align-items:stretch}.dp_drillCap{margin-left:auto;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}.dp_drillHead{display:flex;align-items:center;gap:14px;min-width:0;font-size:var(--dp-fs-title);line-height:18px}.dp_drillTotal{display:flex;align-items:center;gap:10px;min-width:0;color:var(--dsw-alias-label-secondary);overflow:hidden;white-space:nowrap}.dp_drillTotal b{color:var(--dsw-alias-label-primary)}.dp_drillBar{display:flex;width:100%;height:100%;border-radius:10px;overflow:hidden;transform-origin:left center;transition:transform 260ms ease-out}.dp_drillSeg{display:flex;align-items:center;justify-content:center;min-width:2px;overflow:hidden;font-size:var(--dp-fs-body);line-height:14px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.28);white-space:nowrap;cursor:pointer;transition:filter 120ms ease}.dp_drillSeg:hover{filter:brightness(1.1)}.dp_drillSubNote{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}.dp_legendVal{margin-left:6px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_colOff{background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 7%,transparent);border-radius:4px 4px 0 0}.dp_legendBtn{cursor:pointer;border-radius:4px;padding:1px 4px;margin:-1px -4px;display:inline-flex;align-items:center}.dp_legendBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_legendDim{opacity:.35}.dp_barRowBtn{cursor:pointer}.dp_barRowBtn:hover .dp_barRowName{color:var(--dsw-alias-label-primary)}.dp_barRowDim{opacity:.4}.dp_auxBill{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dp-r-inset);font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-secondary)}.dp_auxBillName{color:var(--dsw-alias-label-primary);font-weight:600}.dp_mselDot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}`;
var quotaCss = `.dp_qwLabel{flex:none;font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary)} /* F1 turn hover: probe strip + hover card content (break analyzer) */ .dp_turnProbe{position:absolute;top:0;bottom:0;width:10px;transform:translateX(-50%);cursor:crosshair;z-index:3}.dp_turnInfo{display:flex;flex-direction:column;gap:4px;max-width:280px;min-width:0}.dp_turnPreview{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.dp_turnMeta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}.dp_turnTagFallback{max-width:280px;overflow:hidden;text-overflow:ellipsis}.dp_breakChip{max-width:22em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} /* P3 anchored floats: the portaled MenuSurface panel (search pickers) */ .dp_floatPanel{min-width:200px;max-width:280px;padding:4px;display:flex;flex-direction:column;gap:4px;overflow:auto}.dp_qwTrack{flex:none;width:56px;height:5px;border-radius:3px;background:var(--dsw-interactive-bg-hover);overflow:hidden}.dp_qwFill{display:block;height:100%;border-radius:3px;background:var(--dsw-alias-state-business-primary)}.dp_qwFillWarm{background:color-mix(in srgb,var(--dsw-alias-color-danger) 55%,var(--dsw-alias-state-business-primary))}.dp_qwFillHot{background:var(--dsw-alias-color-danger)}.dp_qwPct{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}.dp_qTable{display:flex;flex-direction:column;gap:2px;min-width:0}.dp_qTr{display:grid;grid-template-columns:minmax(100px,1.6fr) minmax(84px,1fr) minmax(150px,1.4fr) minmax(90px,.9fr);gap:12px;align-items:center;font-size:var(--dp-fs-body);line-height:18px}.dp_qTh{color:var(--dsw-alias-label-tertiary);font-size:var(--dp-fs-micro);line-height:14px}.dp_qTd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_qTdFirst{color:var(--dsw-alias-label-primary)}.dp_qShareTrack{height:4px;border-radius:2px;background:var(--dsw-interactive-bg-hover);overflow:hidden;min-width:40px}.dp_qShareFill{height:100%;background:var(--dsw-alias-state-business-primary);border-radius:2px}.dp_qNote{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary)}.dp_qPlanName{font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-primary);font-weight:600}.dp_qPlanSub{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary)}.dp_qDivider{border-top:1px solid var(--dsw-alias-border-l2);margin:6px 0}.dp_qPlanBlock{display:flex;flex-direction:column;gap:2px;padding:4px 0 2px}.dp_qChips{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1 1 auto}.dp_qwRow{display:grid;grid-template-columns:minmax(0,1fr) max-content max-content max-content;align-items:center;column-gap:10px;min-width:0}.dp_qName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-secondary);font-weight:600}.dp_qwWin{display:inline-flex;align-items:center;gap:6px;min-width:0}.dp_qwWin .dp_qwPct{min-width:36px}.dp_qAux{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}.dp_qRefresh{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:none;background:transparent;border-radius:999px;color:var(--dsw-alias-label-tertiary);cursor:pointer;position:relative}
/* An invisible ::after widens the hit area past the 24px glyph without
   moving a single pixel of paint; the focus ring matches the hot blocks'. */
.dp_qRefresh::after{content:"";position:absolute;inset:-5px}
/* ONE focus recipe for every canvas focusable \u2014 the hot zones and the
   refresh were the anchors; inner action buttons (retry, unpriced
   click-through, go-set) stop falling back to the UA default outline.
   WCAG 2.4.13: at least 2px. */
.dp_heroCard :is(button,[role="button"]):focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,transparent);outline-offset:2px}.dp_qRefresh:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}/* Disabled here has exactly one cause \u2014 a refresh in flight \u2014 so say that
   with a spin instead of vanishing the button; reduced-motion users keep
   the old dim as the signal. */
.dp_qRefresh:disabled{opacity:.9;cursor:progress}
.dp_qRefresh:disabled svg{animation:dpSpin .9s linear infinite}
@keyframes dpSpin{to{transform:rotate(360deg)}}.dp_qWin{padding:5px 0;min-width:0}.dp_qWin+.dp_qWin{border-top:1px solid var(--dsw-alias-border-l1)}.dp_qWinMain{display:grid;grid-template-columns:44px 110px 40px minmax(0,1fr) auto;gap:10px;align-items:center}.dp_qEst{min-width:0;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-body);line-height:16px;font-variant-numeric:tabular-nums}.dp_qEstSep{flex:none;color:var(--dsw-alias-label-tertiary)}.dp_qWinRight{justify-self:end;display:inline-flex;align-items:center;gap:8px;min-width:0;max-width:100%;color:var(--dsw-alias-label-secondary);font-size:var(--dp-fs-body);line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dp_qFoot{margin-top:6px}/* The expansion slot is ONE material: everything it reveals wears the same
   inset-card recipe as the estimate card (hairline + tip surface + inset
   padding) \u2014 one instrument panel opening under the canvas, not loose rows
   under a carded sibling. The budget bar keeps its card and gains the
   inset padding so the two twins align. */
.dp_quotaPanel{display:flex;flex-direction:column;gap:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dp-r-card);background:var(--dsw-specific-tip);padding:var(--dp-pad-inset);box-sizing:border-box;animation:dpSlideDown var(--dp-t-slot) var(--dp-ease)}.dp_budgetBar{padding:var(--dp-pad-inset)}.dp_qCal{cursor:help;border-bottom:1px dashed var(--dsw-alias-border-l2)}.dp_qTdNum{text-align:right}.dp_qwWin+.dp_qwWin::before{content:"\xB7";margin:0 8px 0 0;color:var(--dsw-alias-label-tertiary);font-weight:600}.dp_qwRow+.dp_qwRow{border-top:1px solid var(--dsw-alias-border-l1);padding-top:3px}@container (min-width: 680px){.dp_qChips{flex-direction:row;flex-wrap:wrap;column-gap:20px;row-gap:3px}.dp_qwRow{flex:none}.dp_qwRow+.dp_qwRow{border-top:none;padding-top:0;border-left:1px solid var(--dsw-alias-border-l2);padding-left:20px}}/*dp-card-layout-start*/
/* The head canvas: ONE adaptive card solved as THREE ZONES \u2014 the money
   COLUMN (cost stacked over balance), the quota zone, the cache zone.
   Zones declare only a weight and a cqi-dominant ideal width; the browser
   solves the composition per container width and per toggle combination,
   degrading in order (cache wraps full-width first, then all stack) with
   no per-combo templates. container-type:inline-size (never size) makes
   the card the width container for the zones' cqi widths and the ring's
   cqw diameter \u2014 a size container has no intrinsic height, which is how
   the ring once overflowed its body and painted over the card title.
   Extension chips render in their OWN row so nothing foreign can size
   this one. (The base .dp_chips>.dp_chip shape rule above is for
   extension chips.) */
.dp_chips>.dp_heroCard{aspect-ratio:auto;height:auto;min-height:0;max-height:none;align-self:stretch;container-type:inline-size}

/* Height from CONTENT; blocks flow and wrap. flex-direction:row is EXPLICIT
   and load-bearing: the root also wears .dp_chip (the extension-tile shape
   contract), whose flex-direction:column would otherwise turn the canvas
   into a column box \u2014 the blocks' flex-basis ideal WIDTHS would then be
   applied as HEIGHTS, stacking every block full-width with dead air below
   its content. The column gap carries the canvas's rhythm, the row gap
   keeps a wrapped second line breathable, and the refresh button parks in
   the card's own top-right padding band. */
.dp_heroCard{position:relative;flex-direction:row;padding:var(--dp-pad-card);min-width:0;display:flex;flex-wrap:wrap;align-items:stretch;justify-content:space-between;gap:.9em 2.4em}
/* The card refresh parks in the top-right padding band (dp_consActions).
   The reservation follows the threatened object, not the card: only the
   head line sharing the button's corner gives way (2.6em clears the 24px
   button plus its .4em offset). The old card-level padding-right taxed
   every row of the canvas for one corner \u2014 the ring's cqw diameter and
   every right-flush number paid full-height for a 24px glyph. When the
   last zone is the money COLUMN, the column's own last half-head yields
   (the solo est|bal canvas parks the runway badge under the button). On a
   wrapped line the reservation rides the last zone's head wherever it
   sits \u2014 a small, honest cost. */
.dp_heroCard.dp_hasRefresh>.dp_hBlk:not(:has(~ .dp_hBlk))>.dp_hHead,
.dp_heroCard.dp_hasRefresh>.dp_hCol:not(:has(~ .dp_hBlk))>.dp_hBlk:not(:has(~ .dp_hBlk))>.dp_hHead{padding-right:2.6em}
/* Semantic blocks: label, value, then that value's OWN caveats under it.
   Each block declares weight + an em/cqi ideal width \u2014 cost is the spine
   (heaviest), quota rows need room, balance and cache follow. Blocks sit
   FLUSH with their zone: the old negative-margin hover-lift shell existed
   only to pad the slab hover and is gone with it. */
.dp_hBlk{display:flex;flex-direction:column;gap:.45em;min-width:0}
/* Vertical grammar per block (the design's space-between look): the label
   pins top, the value group floats to the visual middle, caveats pin bottom
   \u2014 and it survives every toggle combination because it rides child order,
   not content. */
.dp_hEst>:nth-child(2),.dp_hBal>:nth-child(2){margin-block:auto}
/* Three ZONES own the canvas line. The money COLUMN stacks the two short
   \xA5 blocks (cost over balance \u2014 one semantic unit), so every zone is
   naturally card-height tall and nothing floats as a loose fragment. Ideal
   widths are cqi-dominant (em only as the legibility floor), so the bases'
   sum is a fixed fraction of the canvas: the zones share one line whenever
   it mathematically fits, and the wrap point tracks the CANVAS, not the
   host's font scaling. The column is ONE instrument cell of two halves:
   est and bal each fill half its height under a hairline \u2014 stacked, never
   spread apart by dead air. Zones also carry a growth cap of the form
   max(em floor, cqi share): the em floor keeps the DENSE regimes honest \u2014
   narrow canvases and the wrapped lines, where growing to fill the line is
   exactly right and a gutter would be a hole \u2014 while the cqi term (a few
   points above the zone's natural three-zone share) bites only when a
   sparse toggle combo lets one instrument stretch toward a full-width
   banner on a wide canvas. There the row's space-between parks the
   surplus in the GUTTER between zones: two instruments, clearly side by
   side. A lone zone stays left-anchored at its cap. */
.dp_hCol{flex:1.1 1 clamp(12em,18cqi,21em);max-width:max(26em,30cqi);display:grid;grid-auto-rows:minmax(min-content,1fr);min-width:0}
.dp_hQuota{flex:1.3 1 clamp(13em,26cqi,30em);max-width:max(30em,42cqi)}
.dp_hCache{flex:1.4 1 clamp(14em,37cqi,34em);max-width:max(42em,56cqi)}
/* A cap is a THREE-zone instrument: sized so three zones can share one
   line, it says nothing useful about a sparser canvas. So any zone whose
   line is missing one of the others drops its cap: the weights take over
   and the zone's own composition absorbs the width \u2014 head annotations
   ride to the far edge, the split hairline spans the canvas, the ring
   pair centers, ledger tracks stretch. (Pairs used to keep the caps and
   park the surplus in the inter-zone gutter; at two-zone widths that
   gutter grew to hundreds of px of nothing between two capped
   instruments \u2014 exactly the dead middle this canvas forbids.) */
.dp_heroCard:not(:has(.dp_hCache)) :is(.dp_hCol,.dp_hQuota){max-width:none}
.dp_heroCard:not(:has(.dp_hQuota)) :is(.dp_hCol,.dp_hCache){max-width:none}
.dp_heroCard:not(:has(.dp_hCol)) :is(.dp_hQuota,.dp_hCache){max-width:none}
/* And a LONE money canvas lays its two blocks SIDE BY SIDE \u2014 equal halves
   split by the gap alone, no divider line, each half's annotations riding
   its own right edge; the halves' contents stay flush (label top, value
   middle, caveats bottom) so both columns read as one height. Stacked
   remains the rule whenever the column has a neighbor zone: there the
   stacked column is what matches the neighbors' height. */
.dp_heroCard:not(:has(.dp_hQuota,.dp_hCache)) .dp_hCol{grid-template-columns:repeat(auto-fit,minmax(0,1fr));grid-auto-rows:auto;column-gap:2.4em}
.dp_heroCard:not(:has(.dp_hQuota,.dp_hCache)) .dp_hCol>.dp_hBlk{padding:0}
.dp_heroCard:not(:has(.dp_hQuota,.dp_hCache)) .dp_hCol>.dp_hEst+.dp_hBal{border-top:none;padding-top:0}
/* A half ALONE in the column keeps the SHARED vertical grammar (label
   top, value floating mid-band, caveats bottom) and borrows the hero
   size \u2014 a bigger instrument for the soloist. The height it inherits
   from a tall ring/ledger neighbor therefore splits EVENLY around the
   value instead of pooling under the content. The money-only canvas
   renders the same either way: there the column is the card's only zone,
   the card's height is content-driven, and the auto margins have no free
   space to hand out. (The old exception pinned the value under the label
   with margin-block:0 \u2014 right look on a short canvas, but with a
   neighbor stretching the column it read as a top-packed block with a
   dead zone below it.) */
.dp_hCol:not(:has(.dp_hEst)) .dp_hBal>:nth-child(2),
.dp_hCol:not(:has(.dp_hBal)) .dp_hEst>:nth-child(2){font-size:clamp(20px,2.6cqi,34px);line-height:1.15}
/* The est-ONLY canvas (est \xB1 cache; balance and quota off) asks one
   instrument to answer a full-width line \u2014 let the hero value climb a
   step higher so the soloist fills its stage instead of leaning on air
   (est+cache was the matrix's loosest state). Left-anchored: the
   dashboard grammar keeps its edge. */
.dp_heroCard:not(:has(.dp_hBal,.dp_hQuota)) .dp_hEst .dp_consHeroVal{font-size:clamp(24px,3.2cqi,42px)}
/* The column's halves are SLOTS of the same primitive the quota ledger
   runs on (minmax(min-content,1fr), the same .45em breathing): equal bands
   that fill the zone's height, each carrying its own vertical grammar
   (label top, value middle, caveats bottom). The border-top on the second
   slot IS the divider \u2014 a slot boundary, not a calibrated position. The
   old 1.45em flex-basis promised the split line and the ledger's first
   rule would land on one optical line, but the ledger's rules live between
   equal bands whose count and content floors vary with plans and windows;
   the promise drifted into a near-miss, which reads worse than either
   aligned or clearly apart. Honest grammar instead: both zones share ONE
   band material, and each zone's rules belong to their own instrument. */
.dp_hCol>.dp_hBlk{min-width:0;margin:0;padding:0 0 .45em}
.dp_hCol>.dp_hEst+.dp_hBal{border-top:1px solid var(--dsw-alias-border-l2);padding-top:.45em}
/* Hot zones: the text block itself is the click target. Only the cost and
   quota blocks carry these \u2014 balance and cache never pretend to be
   clickable, so the cursor always tells the truth. */
.dp_hHot{cursor:pointer}
/* Hover is a quiet cue \u2014 the block's LABEL brightens one step toward the
   reader \u2014 never a painted slab: on a stretched block the highlight
   rectangle read as an arbitrary box floating over dead air. Cursor and
   this cue carry the affordance at every width; the keyboard focus ring is
   the canvas's shared recipe. */
.dp_hHot:hover .dp_consLabel{color:var(--dsw-alias-label-secondary)}
/* A hot block owes a STATIC click cue \u2014 hover-only hints fail touch and
   discoverability. A quiet chevron rides the shared head line's right
   edge and turns downward when the expansion is open; it reads off
   aria-expanded, which the block already carries. */
.dp_hHot>.dp_hHead::after{content:"";flex:none;align-self:center;width:.4em;height:.4em;margin-left:.15em;border-right:1.5px solid var(--dsw-alias-label-tertiary);border-bottom:1.5px solid var(--dsw-alias-label-tertiary);transform:rotate(-45deg);transition:transform var(--dp-t-fast) var(--dp-ease)}
.dp_hHot:hover>.dp_hHead::after{border-color:var(--dsw-alias-label-secondary)}
.dp_hHot[aria-expanded="true"]>.dp_hHead::after{transform:rotate(45deg)}
.dp_hHead{display:flex;align-items:baseline;justify-content:space-between;gap:.6em;min-width:0}
/* A tight block squeezes the LABEL (ellipsis), never the annotation \u2014 the
   range/badge is the block's truth about scope and stays whole. */
.dp_hHead .dp_consLabel{flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dp_hRange{flex:none;font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}
/* Hero values scale with the CANVAS (cqi) between readability floors and
   composition ceilings \u2014 the cost value leads, the balance follows. The
   slopes are tuned so the overlay's ~850px canvas reads lively (\u224823px)
   while the full settings page (~1663px) reaches the 34px ceiling. */
.dp_hEst .dp_consHeroVal{font-size:clamp(20px,2.6cqi,34px);line-height:1.15}
.dp_hBal .dp_consHeroVal{font-size:clamp(17px,2cqi,27px);line-height:1.15}
/* Runway badge in the balance head's right slot; under 3 days it reads in
   the danger color. */
.dp_hBadge{flex:none;font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);border-radius:999px;padding:.08em .65em;white-space:nowrap;font-variant-numeric:tabular-nums}
.dp_hBadgeLow{color:var(--dsw-alias-color-danger);background:color-mix(in srgb,var(--dsw-alias-color-danger) 12%,transparent)}
/* Balance metrics: granted / topped up as label-over-value pairs. */
.dp_hMetrics{display:flex;gap:1.6em;flex-wrap:wrap;min-width:0}
.dp_hMetric{display:flex;flex-direction:column;gap:.1em;min-width:0}
.dp_hMetric b{font-size:var(--dp-fs-stat);line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.dp_hMetricOk{color:var(--dsw-alias-state-success-primary)}
/* The window activity always closes the canvas: a full-width foot row under
   a hairline, its three cells spread along the canvas width \u2014 the shared
   bottom edge of every zone composition. */
.dp_hFoot{flex:0 0 100%;border-top:1px solid var(--dsw-alias-border-l2);padding-top:.5em}
/* The card's refresh lives in the CARD's own top-right corner: absolutely
   positioned inside the padding band, it costs the flow nothing \u2014 no head row
   above the first stat. */
.dp_consActions{position:absolute;top:.4em;right:.4em;z-index:1}
/* Block caveat buttons (the unpriced click-through) never outrun their
   block: they ellipsize and carry the sentence in the tooltip. */
.dp_hBlk>.dp_chipNoteBtn{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dp_consLabel{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);letter-spacing:.02em;min-width:0}
.dp_consHeroVal{font-size:var(--dp-fs-hero);line-height:26px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;white-space:nowrap}
.dp_consUnit{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);font-weight:500;white-space:nowrap}
.dp_consNote{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);min-width:0}
/* The RING is the card's height benchmark and its one incompressible
   element: the diameter derives from the CANVAS WIDTH (cqw), never from
   row height (which it would otherwise drive in a circular loop) and it is
   never squeezed \u2014 every other zone stretches or compresses around it.
   The ring row is [ring | evidence]: the pair centers as one unit inside
   the zone, and the evidence column stretches to the ring's height with its
   rows spread evenly along it \u2014 one instrument, not a pile. The 17.5em
   ceiling is a legibility cap, not a compression guard: with 21cqw the
   ring keeps growing with the canvas until ~1030px of width, so the wide
   settings page and every sparse toggle combo keep sizing it up. */
.dp_ringBody .dp_ringWrap{height:clamp(9em,21cqw,17.5em)}
.dp_cardBody.dp_ringBody{flex-wrap:wrap;row-gap:.7em;justify-content:center}
.dp_ringBody .dp_ringSide{max-width:26em;align-self:stretch;justify-content:space-evenly}
/* \u8BC1\u636E\u884C\u6570\u503C\u8D34\u5757\u7F18\u53F3\u5BF9\u9F50\uFF08\u8BBE\u8BA1\u7A3F\u6784\u56FE\uFF09\uFF1A\u6807\u7B7E\u7559\u5DE6\uFF0C\u503C\u4E0E\u5176\u540E\u7F00\u8D34\u53F3\uFF1B
   \u6781\u7A84\u65F6\u540E\u7F00\u6298\u5230\u503C\u4E0B\u4E00\u884C\u800C\u4E0D\u662F\u88C1\u51FA\u5361\u5916\u3002 */
.dp_ringSideRow{flex-wrap:wrap}
.dp_ringSideRow>b{margin-left:auto;font-size:var(--dp-fs-stat);line-height:20px}
/* Quota lines: the provider name stays LEFT, the windows stay a CONTENT-SIZED
   group pushed flush RIGHT (margin-left:auto) \u2014 no element stretches to soak up
   width, so every column lands where the previous row put it and the row ends
   exactly at the card's edge. The utilization track is a fixed em width and the
   percentage a fixed right-aligned column, which is what lines the counts up
   across rows. The nearest reset rides the window it belongs to: one compressed
   countdown per provider. */
/* \u8BA2\u9605\u989D\u5EA6\u884C\uFF1A\u540D\u5B57\u5217 + \u7A97\u53E3\u82AF\u7247\u5217\uFF08\u5951\u7EA6\u6CE8\u91CA\u2014\u2014\u52A8\u6570\u5B57\u524D\u5148\u8BFB\u8FD9\u6BB5\uFF09\u3002
   [\u540D\u79F0 \u22649em \u6536\u7F29\u7701\u7565][\u82AF\u7247\u5217 dp_qWins\uFF1A\u6BCF\u4E2A\u7A97\u53E3\u4E00\u884C [\u6807\u7B7E][\u8F68\u9053 flex\u226416em][\u767E\u5206\u6BD4 2.4em \u53F3\u5BF9\u9F50]]
   \u82AF\u7247\u5217\u6C38\u8FDC\u7AD6\u6392\uFF0C\u8F68\u9053 flex:1 \u5403\u6389\u884C\u5185\u5269\u4F59\u5BBD\u5EA6 \u2192 \u540C\u4E00\u5757\u5185\u6240\u6709\u8F68\u9053\u7B49\u957F\u3001
   \u767E\u5206\u6BD4\u4E00\u5F8B\u8D34\u5757\u7F18\u53F3\u5BF9\u9F50\uFF08\u8BBE\u8BA1\u7A3F\u6784\u56FE\uFF09\u3002\u5757\u518D\u7A84\u4E5F\u53EA\u662F\u540D\u5B57\u51FA\u7701\u7565\u53F7\u3001\u8F68\u9053
   \u53D8\u77ED\uFF0C\u6C38\u4E0D\u628A\u5185\u5BB9\u9876\u51FA\u5361\u5916\u2014\u2014\u65E7\u7684\u300C\u5B9A\u5BBD\u52A0\u6CD5\u300D\u5951\u7EA6\u968F\u6D41\u5F0F\u753B\u5E03\u9000\u5F79\uFF1A\u5B83\u66FE
   \u56E0\u5B9A\u5BBD\u548C\u8D85\u51FA\u5757\u5BBD + minmax \u4E0B\u9650\u628A\u5185\u5BB9\u9876\u51FA\u5361\u5916\u3002\u884C\u5185\u6CA1\u6709\u5012\u8BA1\u65F6\uFF1A\u6BCF\u4E2A\u7A97
   \u53E3\u7EC4\u7684\u60AC\u6D6E\u5C42\uFF08\u5B98\u65B9 Tooltip \u539F\u8BED\uFF0C\u8001\u5BBF\u4E3B\u9000\u56DE\u539F\u751F title\uFF09\u663E\u793A\u8BE5\u7A97\u53E3\u81EA\u5DF1
   \u7684\u300C{v}\u540E\u91CD\u7F6E\u300D\u3002 */
/* The ledger is a GRID of slots \u2014 the same primitive the money column's
   halves run on: grid-auto-rows:minmax(min-content,1fr) grows every row
   into an equal band that fills the zone's height AND keeps the intrinsic
   height honest when no ring drives the canvas tall (the old flex
   1 1 0 basis contributed nothing to intrinsic height \u2014 quota-only
   collapsed to overlapping rows, and min-height:max-content was the patch).
   The provider name tops out at its FIRST window row (flex-start, not
   center): centered, the name floats between its two window lines and the
   pairing goes ambiguous the moment bands shrink toward content. */
.dp_hQuota .dp_qChips{display:grid;grid-auto-rows:minmax(min-content,1fr);gap:.4em 0;min-width:0;flex:1 1 auto}
.dp_hQuota .dp_qwRow{display:flex;align-items:flex-start;column-gap:.75em;min-width:0}
.dp_hQuota .dp_qwRow>.dp_qName{flex:0 1 9em;min-width:6em}
.dp_hQuota .dp_qwRow+.dp_qwRow{border-top:1px solid var(--dsw-alias-border-l1);border-left:none;padding-top:.4em;padding-left:0}
/* The window group is a three-column ledger GRID shared by every window of
   the provider \u2014 the win row itself is display:contents, so the tag column
   sizes to the group's WIDEST label and the percentage column to its widest
   value. Every track in a group starts and ends on the same lines and the
   bars are directly comparable; a content-sized tag ("5\u5C0F\u65F6" vs "\u672C\u5468")
   used to shove each track's left edge apart by a character width, in every
   locale. The track fills the middle column uncapped: a fixed max once
   stranded dead air between track and percentage on wide canvases. */
.dp_hQuota .dp_qWins{flex:1 1 12em;display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;align-items:baseline;column-gap:.6em;row-gap:.4em;min-width:0}
.dp_hQuota .dp_qWins .dp_qwWin{display:contents}
/* Ribbon weight tracks the canvas: a long thin ribbon reads as a hairline
   next to the ring's mass on wide canvases; the clamp floor keeps the
   narrow canvas exactly as it is. */
.dp_hQuota .dp_qWins .dp_qwTrack{width:auto;height:clamp(.4em,.55cqi,.62em);border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 26%,transparent)}
.dp_hQuota .dp_qwTag{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dp_hQuota .dp_qWins .dp_qwPct{flex:none;min-width:2.4em;text-align:right;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
/* Color must not be the only tier channel: a warm/hot window's percentage
   sits one weight step heavier \u2014 readable by eyes that cannot tell the
   fills apart, invisible to those who can. No palette change. */
.dp_hQuota .dp_qwWin:has(.dp_qwFillWarm) .dp_qwPct,.dp_hQuota .dp_qwWin:has(.dp_qwFillHot) .dp_qwPct{font-weight:700}
.dp_hQuota .dp_qwWin+.dp_qwWin::before{content:none}
.dp_hQuota .dp_qwErr{flex:1 1 auto;display:flex;flex-wrap:wrap;align-items:baseline;gap:.6em;min-width:0;font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-secondary)}
/* The "+N more" line is the ledger's continuation ROW, not an orphan: it
   sits in the last band pinned to its floor (align-self:end) and wears the
   error rows' quiet recipe \u2014 same size, same ink, name-column left edge. */
.dp_hQuota .dp_qAux{flex:none;align-self:end;font-size:var(--dp-fs-body);line-height:16px;color:var(--dsw-alias-label-secondary)}
/* The window's activity as three equal cells; a WIDE-row fallback that only
   mounts as the head canvas's foot row once the cache block is switched off
   (the cache block wears the same numbers as side-column rows instead). */
/* The window's activity as three cells justified to the canvas EDGES \u2014
   left cell at the left margin, right cell at the right margin \u2014 so the
   foot row's rule and its numbers span the full composition. */
.dp_actGrid{display:flex;justify-content:space-between;gap:.15em 2.4em;min-width:0}
.dp_actCell{display:flex;flex-direction:column;gap:.1em;min-width:0}
.dp_actLabel{font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dp_actVal{font-size:var(--dp-fs-stat);line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
/* The right cell's NUMBER kisses the canvas edge like every other
   right-flush figure (evidence values, ledger percentages), the label
   riding with it; the left cell stays flush left, the middle floats. */
.dp_actGrid .dp_actCell:last-child{align-items:flex-end;text-align:right}
/*dp-card-layout-end*/@media (prefers-reduced-motion:reduce){.dp_ringValue{transition:none}.dp_budgetFill{transition:none}.dp_hHot>.dp_hHead::after{transition:none}}.dp_consExpand{display:flex;flex-direction:column;gap:10px;animation:dpSlideDown var(--dp-t-slot) var(--dp-ease)}.dp_consExpand .dp_estBudgetPanel{animation:none}.dp_blurSec{opacity:.4;filter:blur(1.5px);pointer-events:none;user-select:none;transition:opacity var(--dp-t-slot) var(--dp-ease),filter var(--dp-t-slot) var(--dp-ease)}@media (prefers-reduced-motion:reduce){.dp_consExpand,.dp_quotaPanel{animation:none}.dp_blurSec{transition:none}}.dp_reconGapBad{color:var(--dsw-alias-color-danger)}.dp_trendTabs{flex:none}.dp_trendTabs .dp_segBtn{white-space:nowrap}.dp_panelTitle{flex-wrap:wrap}.dp_panelTitle .dp_panelCount{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} /* P2 input migration: the official Input puts the class on a wrapper span, so the box css stays on the class while the inner input goes chrome-less (the fallback path renders a bare input and matches none of the descendant rules) */.dp_setInput{display:inline-flex;align-items:center}.dp_setInput input{flex:1 1 auto;min-width:0;border:none;background:transparent;color:inherit;font:inherit;font-size:inherit;padding:0;outline:none;height:100%}.dp_setInput:focus-within{border-color:var(--dsw-alias-brand-primary)}.dp_budgetInput{display:inline-flex;align-items:center}.dp_budgetInput input{flex:1 1 auto;min-width:0;border:none;background:transparent;color:inherit;font:inherit;font-size:inherit;padding:0;outline:none;height:100%}.dp_setFeeInput{display:inline-flex;align-items:center}.dp_setFeeInput input{flex:1 1 auto;min-width:0;border:none;background:transparent;color:inherit;font:inherit;font-size:inherit;line-height:inherit;padding:0;outline:none} /* F2 relative trailing label on session rows */.dp_sessRel{flex:none;font-size:var(--dp-fs-micro);line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}`;
var cssTagId = "dsh-pulse/pulse.css";
var DP_BUILD = "0.5.1";
if (typeof document !== "undefined") {
  let tag = document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]");
  if (tag === null) {
    tag = document.createElement("style");
    tag.setAttribute("data-plugin-css", cssTagId);
    document.head.append(tag);
  }
  tag.setAttribute("data-plugin-css-rev", DP_BUILD);
  tag.textContent = css + themeCss + rowCss + chartCss + quotaCss;
}

// src/client/panels.js
var PANEL_ITEMS = (t) => [
  ["balance", t("panelBalance"), t("panelDescBalance")],
  ["quota", t("panelQuota"), t("panelDescQuota")],
  ["trend", t("panelTrend"), t("panelDescTrend")],
  ["costTrend", t("panelCostTrend"), t("panelDescCostTrend")],
  ["cache", t("panelCache"), t("panelDescCache")],
  ["models", t("panelModels"), t("panelDescModels")],
  ["projects", t("panelProjects"), t("panelDescProjects")],
  ["sessions", t("panelSessions"), t("panelDescSessions")]
];
function compareVersions(a, b) {
  const parts = (value) => String(value ?? "").split("-")[0].split(".").map((n) => Number(n) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i2 = 0; i2 < 3; i2 += 1) {
    const diff = (left[i2] ?? 0) - (right[i2] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
function PulseAboutPanel({ t }) {
  const [state, setState] = (0, import_react.useState)({ kind: "idle", latest: null, error: null });
  const check = () => {
    setState((s) => ({ ...s, kind: "checking", error: null }));
    fetch("/pulse/update-check", { credentials: "same-origin", headers: { accept: "application/json" } }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      payloadError(res, body);
      const latest = typeof body.latest === "string" ? body.latest : null;
      const diff = latest === null ? 0 : compareVersions(latest, DP_BUILD);
      setState({ kind: diff > 0 ? "newer" : diff < 0 ? "dev" : "current", latest, error: null });
    }).catch((error) => setState({ kind: "error", latest: null, error: String(error?.message ?? error) }));
  };
  const line = state.kind === "checking" ? t("aboutChecking") : state.kind === "current" ? t("aboutUpToDate") : state.kind === "newer" ? fill(t("aboutNewer"), { v: state.latest ?? "?" }) : state.kind === "dev" ? fill(t("aboutDev"), { v: state.latest ?? "?" }) : state.kind === "error" ? fill(t("aboutFailed"), { err: state.error ?? "" }) : null;
  const cls = state.kind === "error" ? "dp_setMsg dp_setMsgErr" : state.kind === "newer" ? "dp_setMsg dp_setMsgOk" : "dp_setMsg";
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_setPanel", children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_setSub", children: t("aboutTitle") }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_setRow dp_setRowMid", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_aboutVersion", children: `dsh-pulse ${DP_BUILD}` }),
      line !== null && (0, import_jsx_runtime.jsx)("span", { className: cls, children: line }),
      (0, import_jsx_runtime.jsx)(Btn, {
        fallbackClass: "dp_miniBtn",
        variant: "outline",
        size: "sm",
        disabled: state.kind === "checking",
        onClick: check,
        children: t("aboutCheck")
      })
    ] })
  ] });
}
function QuotaSettingsPanel({ t }) {
  const quota = useQuota(true);
  const [state, setState] = (0, import_react.useState)({ status: "loading", off: [], writable: false, revision: void 0, saving: null, error: null, saved: false });
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    fetchSettings().then((data) => {
      if (cancelled) return;
      setState((s) => ({
        ...s,
        status: "ready",
        off: Array.isArray(data.quotaOff) ? data.quotaOff : [],
        writable: data.writable === true,
        revision: typeof data.revision === "number" ? data.revision : void 0
      }));
    }).catch((error) => {
      if (!cancelled) setState((s) => ({ ...s, status: "error", error: String(error?.message ?? error) }));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const reloadSettings = () => {
    invalidateSettings();
    fetchSettings().then((data) => setState((s) => ({
      ...s,
      off: Array.isArray(data.quotaOff) ? data.quotaOff : s.off,
      writable: data.writable === true,
      revision: typeof data.revision === "number" ? data.revision : s.revision
    }))).catch(() => {
    });
  };
  const toggle = (provider, on) => {
    const next = on ? state.off.filter((id) => id !== provider) : [.../* @__PURE__ */ new Set([...state.off, provider])];
    setState((s) => ({ ...s, saving: provider, error: null, saved: false }));
    fetch("/pulse/settings", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ quotaOff: next, revision: state.revision })
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || data?.conflict !== void 0) {
        setState((s) => ({ ...s, saving: null, error: t("setConflict") }));
        reloadSettings();
        return;
      }
      payloadError(res, data);
      setState((s) => ({ ...s, saving: null, saved: true, off: next }));
      reloadSettings();
      quota.refresh();
    }).catch((error) => setState((s) => ({ ...s, saving: null, error: String(error?.message ?? error) })));
  };
  const entries = (Array.isArray(quota.data?.providers) ? quota.data.providers : []).slice().sort((a, b) => String(a.displayName ?? a.provider).localeCompare(String(b.displayName ?? b.provider)));
  if (entries.length === 0) return null;
  const statusLine = (entry) => entry.disabled === true ? t("quotaSettingsOff") : entry.ok !== true ? entry.configured === false ? t("quotaNoCred") : fill(t("quotaFailed"), { err: entry.error ?? "?" }) : entry.windows?.map((w) => `${quotaWindowLabel(w.id, t)} ${Math.round(w.usedPct ?? 0)}%`).join(" \xB7 ");
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_setPanel", children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_setSub", children: t("quotaSettingsHint") }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_panelsGrid", children: entries.map((entry) => (0, import_jsx_runtime.jsxs)("label", { className: "dp_setSwitch", children: [
      (0, import_jsx_runtime.jsx)("input", {
        type: "checkbox",
        checked: entry.disabled !== true,
        disabled: state.status !== "ready" || !state.writable || state.saving !== null,
        onChange: (e) => toggle(entry.provider, e.target.checked)
      }),
      (0, import_jsx_runtime.jsxs)("span", { children: [
        entry.plan?.name ?? entry.label ?? entry.displayName ?? entry.provider,
        (0, import_jsx_runtime.jsx)("span", { className: "dp_qNote", style: { display: "block" }, children: statusLine(entry) })
      ] })
    ] }, entry.provider)) }),
    state.status === "error" ? (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: state.error ?? "" }) }) : state.error !== null ? (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgErr", children: state.error }) : state.saved && (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") })
  ] });
}
function PanelsPage({ t, theme, setTheme: setTheme2 }) {
  const [panels, setPanels] = (0, import_react.useState)(loadPanels);
  const [currency, setCurrency] = (0, import_react.useState)({
    status: "loading",
    code: "CNY",
    usdToCny: String(DEFAULT_USD_TO_CNY),
    writable: false,
    revision: void 0,
    saving: false,
    saved: false,
    error: null
  });
  const toggle = (key) => setPanels((prev) => {
    const next = { ...prev, [key]: prev[key] === false };
    savePanels(next);
    return next;
  });
  const loadCurrency = () => {
    fetchSettings().then((data) => setCurrency((s) => ({
      ...s,
      status: "ready",
      code: data.currency === "USD" ? "USD" : "CNY",
      usdToCny: String(Number(data.fx?.usdToCny) > 0 ? data.fx.usdToCny : DEFAULT_USD_TO_CNY),
      writable: data.writable === true,
      revision: typeof data.revision === "number" ? data.revision : void 0,
      error: null
    }))).catch((error) => setCurrency((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
  };
  (0, import_react.useEffect)(loadCurrency, []);
  const saveCurrency = () => {
    const fx = Number(currency.usdToCny);
    if (!Number.isFinite(fx) || fx <= 0) {
      setCurrency((s) => ({ ...s, error: t("setBadNumber") }));
      return;
    }
    setCurrency((s) => ({ ...s, saving: true, saved: false, error: null }));
    fetch("/pulse/settings", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ currency: currency.code, usdToCny: fx, revision: currency.revision })
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || data?.conflict !== void 0) {
        invalidateSettings();
        loadCurrency();
        throw new Error(t("setConflict"));
      }
      payloadError(res, data);
      setCurrency((s) => ({ ...s, saving: false, saved: true, error: null }));
      if (statsState.key !== null) {
        payloadCache.delete(statsState.key);
        loadStats(statsState.from, statsState.to);
      }
      invalidateSettings();
    }).catch((error) => setCurrency((s) => ({ ...s, saving: false, error: String(error?.message ?? error) })));
  };
  const curLocked = currency.status !== "ready" || !currency.writable || currency.saving;
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_setGrid", children: [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_setPanel", children: [
      (0, import_jsx_runtime.jsx)("div", { className: "dp_setSub", children: t("curHint") }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_setRow dp_setRowMid", children: [
        (0, import_jsx_runtime.jsx)(Seg, {
          id: "pulse-currency",
          value: currency.code,
          options: [
            { value: "CNY", label: "CNY", disabled: curLocked },
            { value: "USD", label: "USD", disabled: curLocked }
          ],
          onChange: (code) => setCurrency((s) => ({ ...s, code, saved: false })),
          label: t("currencyLabel")
        }),
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_setInline", children: [
          (0, import_jsx_runtime.jsx)("span", { className: "dp_setLabel", children: `${t("setFxLabel")} 1 USD =` }),
          (0, import_jsx_runtime.jsx)(Input, {
            className: "dp_setInput dp_setFxInput",
            inputMode: "decimal",
            value: currency.usdToCny,
            disabled: currency.status !== "ready" || !currency.writable || currency.saving,
            onChange: (e) => setCurrency((s) => ({ ...s, usdToCny: e.target.value, saved: false }))
          })
        ] }),
        (0, import_jsx_runtime.jsx)(Btn, {
          fallbackClass: "dp_miniBtn",
          variant: "primary",
          size: "sm",
          disabled: currency.status !== "ready" || !currency.writable || currency.saving,
          onClick: saveCurrency,
          children: t("setSave")
        })
      ] }),
      currency.status === "error" ? (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: currency.error }) }) : !currency.writable && currency.status === "ready" ? (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgErr", children: t("setNotWritable") }) : currency.saved && (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_setPanel", children: [
      (0, import_jsx_runtime.jsx)("div", { className: "dp_setSub", children: t("panelsSub") }),
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_panelsGrid", children: PANEL_ITEMS(t).map(([key, label, desc]) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_panelItem", children: [
        (0, import_jsx_runtime.jsx)(Checkbox, {
          className: "dp_setSwitch",
          checked: panels[key] !== false,
          onChange: () => toggle(key),
          label
        }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_panelItemDesc", children: desc })
      ] }, key)) })
    ] }),
    (0, import_jsx_runtime.jsx)(QuotaSettingsPanel, { t }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_setPanel", children: [
      (0, import_jsx_runtime.jsx)("div", { className: "dp_setSub", children: t("themeSub") }),
      (0, import_jsx_runtime.jsx)(Seg, {
        id: "pulse-theme",
        value: theme,
        options: THEMES.map((key) => ({
          value: key,
          label: key === "blue" ? t("themeBlue") : key === "pink" ? t("themePink") : key === "orange" ? t("themeOrange") : t("themeBw")
        })),
        onChange: setTheme2,
        label: t("themeLabel")
      }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_setMsg", children: t("themeHint") })
    ] }),
    (0, import_jsx_runtime.jsx)(PulseAboutPanel, { t })
  ] });
}

// src/client/slots.js
function PulseSection({ t, renderFactorySlot }) {
  const [page, setPage] = (0, import_react.useState)("dashboard");
  const [theme, setTheme2] = (0, import_react.useState)(loadTheme);
  (0, import_react.useEffect)(() => subscribeTheme(setTheme2), []);
  const tabs = [
    ["pricing", t("setTitle")],
    ["compare", t("compare")],
    ["panels", t("panels")]
  ];
  const tabButtons = tabs.map(([target, label], i2) => (0, import_jsx_runtime.jsx)(Btn, {
    fallbackClass: "dp_miniBtn",
    variant: target === page ? "primary" : "outline",
    size: "sm",
    style: i2 === 0 ? { marginLeft: "auto" } : void 0,
    onClick: () => setPage(target),
    children: label
  }, target));
  if (page !== "dashboard") {
    const title = page === "pricing" ? t("setTitle") : page === "compare" ? t("compare") : t("panels");
    const body = page === "pricing" ? (0, import_jsx_runtime.jsx)(PricingPage, { t }) : page === "compare" ? (0, import_jsx_runtime.jsx)(ComparePage, { t }) : (0, import_jsx_runtime.jsx)(PanelsPage, { t, theme, setTheme: setTheme2 });
    return (0, import_jsx_runtime.jsxs)("div", { className: "dp_page dp_themeScope", "data-dp-theme": theme, children: [
      (0, import_jsx_runtime.jsxs)("div", { className: "dp_headerRow", children: [
        (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dp_backBtn", onClick: () => setPage("dashboard"), children: t("back") }),
        (0, import_jsx_runtime.jsx)("span", { className: "dp_title", children: title }),
        ...tabButtons
      ] }),
      body
    ] });
  }
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_page dp_themeScope", "data-dp-theme": theme, children: [
    // The factory occurrence carries `t` from its locale; passing `t`
    // again as an input prop would collide with the framework kit.
    typeof renderFactorySlot === "function" ? renderFactorySlot("pulse.dashboard", {
      onConfigure: () => setPage("pricing"),
      headerExtra: (0, import_jsx_runtime.jsxs)("div", { className: "dp_headerRow", children: [
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("pricing"), children: t("configure") }),
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("compare"), children: t("compare") }),
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("panels"), children: t("panels") })
      ] })
    }, { fallback: (0, import_jsx_runtime.jsx)(PulseDashboard, {
      t,
      onConfigure: () => setPage("pricing"),
      headerExtra: (0, import_jsx_runtime.jsxs)("div", { className: "dp_headerRow", children: [
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("pricing"), children: t("configure") }),
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("compare"), children: t("compare") }),
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("panels"), children: t("panels") })
      ] })
    }) }) : (0, import_jsx_runtime.jsx)(PulseDashboard, {
      t,
      onConfigure: () => setPage("pricing"),
      headerExtra: (0, import_jsx_runtime.jsxs)("div", { className: "dp_headerRow", children: [
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("pricing"), children: t("configure") }),
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("compare"), children: t("compare") }),
        (0, import_jsx_runtime.jsx)(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("panels"), children: t("panels") })
      ] })
    })
  ] });
}
function PulseSummaryCard({ t, focus = null, onOpenFull = null, flush = false }) {
  const focusSession = focus;
  const range = (0, import_react.useMemo)(() => {
    const today = localDay(Date.now());
    return { from: shiftDay(today, -6), to: today };
  }, []);
  const stats = usePulseStats(range.from, range.to);
  const data = stats.data;
  const project = (0, import_react.useMemo)(
    () => data === null ? null : focusProjectLabel(data, focusSession),
    [data, focusSession]
  );
  const view = (0, import_react.useMemo)(() => {
    if (data === null) return null;
    return buildView(data.sessions, {
      granularity: "day",
      from: typeof data.fromDay === "string" ? data.fromDay : range.from,
      to: typeof data.toDay === "string" ? data.toDay : range.to,
      project: project ?? "",
      pricing: data.pricing,
      fx: data.fx,
      monthly: data.monthly,
      auxShape: data.auxShape ?? null
    });
  }, [data, project, range]);
  const pricing = data === null ? [] : data.pricing;
  const fx = data === null ? {} : data.fx;
  const monthly = data === null ? [] : data.monthly;
  const costOn = data !== null && data.costEnabled !== false;
  const tokenTotal = (tokens) => (tokens.input || 0) + (tokens.output || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);
  const hitText = (tokens) => {
    const rate = cacheHitRateOf(tokens);
    return rate === null ? null : `${Math.round(rate * 100)}%`;
  };
  const turnsOf = (record) => {
    let turns = 0;
    for (const value of Object.values(record.turnsByDay ?? {})) turns += Number(value) || 0;
    return turns;
  };
  const dayOf = (record) => {
    if (typeof record.day === "string" && record.day !== "") return record.day.slice(5);
    const created = Number(record.createdAt) || 0;
    return created > 0 ? localDay(created).slice(5) : "\u2014";
  };
  const costOrNull = (rows) => {
    if (!costOn) return null;
    const priced = costOf(rows, pricing, fx, monthly);
    return priced.configured ? priced.total : null;
  };
  const money = (value) => value === null ? null : moneyCny(value);
  const totals = view === null ? null : view.totals;
  const sessionRecord = (0, import_react.useMemo)(() => {
    if (data === null || focusSession === null) return null;
    const list = Array.isArray(data.sessions) ? data.sessions : [];
    return list.find((record) => record !== null && typeof record === "object" && record.id === focusSession.id) ?? null;
  }, [data, focusSession]);
  const hero = (0, import_react.useMemo)(() => {
    if (sessionRecord !== null) {
      const tokens = recordTokens(sessionRecord);
      return {
        label: t("cmdSession"),
        session: true,
        value: `${fmtTokens(tokenTotal(tokens))} tok`,
        hit: hitText(tokens),
        cost: costOrNull(sessionModelRows(sessionRecord)),
        turns: turnsOf(sessionRecord)
      };
    }
    if (totals === null) return null;
    return {
      label: t("cmdProject"),
      session: false,
      value: `${fmtTokens(tokenTotal(totals))} tok`,
      hit: typeof totals.cacheHitRate === "number" && Number.isFinite(totals.cacheHitRate) ? `${Math.round(totals.cacheHitRate * 100)}%` : null,
      cost: costOn && view.cost.configured === true ? view.cost.total : null,
      turns: totals.turns ?? 0
    };
  }, [sessionRecord, totals, view, t, costOn, pricing, fx, monthly]);
  const scopeLine = (0, import_react.useMemo)(() => {
    if (sessionRecord === null || totals === null) return null;
    const parts = [`${fmtTokens(tokenTotal(totals))} tok`];
    const costText = costOn && view.cost.configured === true ? moneyCny(view.cost.total) : null;
    if (costText !== null) parts.push(costText);
    parts.push(fill(t("cmdSessCount"), { n: totals.sessions ?? 0 }));
    return `${t("cmdProject")} \xB7 ${parts.join(" \xB7 ")}`;
  }, [sessionRecord, totals, view, t, costOn]);
  const modelRows = (0, import_react.useMemo)(() => {
    if (view === null || !Array.isArray(view.models)) return [];
    const all = view.models.map((row) => ({
      key: row.key,
      name: typeof row.model === "string" && row.model !== "" ? row.model : row.key,
      total: tokenTotal(row),
      row
    })).filter((entry) => entry.total > 0);
    const grand = all.reduce((sum, entry) => sum + entry.total, 0);
    if (grand <= 0) return [];
    const rows = all.slice(0, 3).map((entry) => ({
      key: entry.key,
      name: entry.name,
      pct: entry.total / grand * 100,
      cost: costOrNull([entry.row]),
      rest: false
    }));
    const rest = all.slice(3);
    if (rest.length > 0) {
      rows.push({
        key: "__dpRest",
        name: fill(t("cmdOthers"), { n: rest.length }),
        pct: rest.reduce((sum, entry) => sum + entry.total, 0) / grand * 100,
        cost: costOrNull(rest.map((entry) => entry.row)),
        rest: true
      });
    }
    return rows;
  }, [view, t, costOn, pricing, fx, monthly]);
  const recentSessions = (0, import_react.useMemo)(() => {
    if (data === null) return [];
    const list = Array.isArray(data.sessions) ? data.sessions : [];
    const want = project ?? "";
    const rows = [];
    for (const record of list) {
      if (record === null || typeof record !== "object") continue;
      const label = record.project === null || record.project === void 0 ? "" : String(record.project);
      if (want !== "" && label !== want) continue;
      const tokens = recordTokens(record);
      const total = tokenTotal(tokens);
      if (total <= 0) continue;
      rows.push({
        key: typeof record.id === "string" && record.id !== "" ? record.id : `${label}#${rows.length}`,
        day: dayOf(record),
        tokens: total,
        turns: turnsOf(record),
        cost: costOrNull(sessionModelRows(record)),
        createdAt: Number(record.createdAt) || 0
      });
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt || (a.day < b.day ? 1 : -1)).slice(0, 3);
  }, [data, project, costOn, pricing, fx, monthly]);
  const heroMeta = hero === null ? [] : [
    hero.hit === null ? null : `${t("cmdHit")} ${hero.hit}`,
    money(hero.cost),
    hero.turns > 0 ? fill(t("cmdTurns"), { n: hero.turns }) : null
  ].filter((part) => part !== null);
  const hasUsage = view !== null && view.hasData === true;
  return (0, import_jsx_runtime.jsxs)("div", { className: flush ? "dp_cmdCard" : "dp_card dp_variantCard dp_cmdCard", children: [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmdHead", children: [
      (0, import_jsx_runtime.jsx)(primitives.IconDataOutline16, { size: 15 }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdTitle", children: t("title") }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdWs", title: project ?? void 0, children: project ?? t("projectAll") })
    ] }),
    data === null ? (0, import_jsx_runtime.jsx)("div", { className: "dp_cmdNote", children: stats.status === "error" ? fill(t("cmdLoadFailed"), { err: stats.error ?? "" }) : t("loading") }) : (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmdHero", children: [
      (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdHeroLabel", children: hero === null ? t("cmdNoUsage") : hero.label }),
      hero !== null && (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdHeroValue", children: hero.value }),
      heroMeta.length > 0 && (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdHeroMeta", children: heroMeta.join(" \xB7 ") })
    ] }),
    scopeLine !== null && (0, import_jsx_runtime.jsx)("div", { className: "dp_cmdScopeLine", children: scopeLine }),
    hasUsage && (modelRows.length > 0 || recentSessions.length > 0) && (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmdGrid", children: [
      modelRows.length > 0 && (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmdBlock", children: [
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmdBlockTitle", children: [
          (0, import_jsx_runtime.jsx)("span", { children: t("cmdModels") }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdBlockSub", children: t("cmdLast7") })
        ] }),
        (0, import_jsx_runtime.jsx)("div", { className: "dp_cmdBars", children: modelRows.map((row) => (0, import_jsx_runtime.jsxs)("div", {
          className: "dp_cmdBar",
          title: `${row.name} \xB7 ${row.pct.toFixed(1)}%${row.cost === null ? "" : ` \xB7 ${moneyCny(row.cost)}`}`,
          children: [
            (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdBarName", children: row.name }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdBarTrack", children: (0, import_jsx_runtime.jsx)("span", {
              className: `dp_cmdBarFill${row.rest ? " dp_cmdBarFillRest" : ""}`,
              style: { width: `${Math.max(row.pct, 1.5)}%` }
            }) }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdBarPct", children: `${Math.round(row.pct)}%` }),
            (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdBarCost", children: money(row.cost) ?? "" })
          ]
        }, row.key)) })
      ] }),
      recentSessions.length > 0 && (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmdBlock", children: [
        (0, import_jsx_runtime.jsx)("div", { className: "dp_cmdBlockTitle", children: (0, import_jsx_runtime.jsx)("span", { children: t("cmdRecent") }) }),
        (0, import_jsx_runtime.jsx)("div", { className: "dp_cmdSess", children: recentSessions.map((row) => (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmdSessRow", children: [
          (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdSessDay", children: row.day }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdSessTok", children: `${fmtTokens(row.tokens)} tok` }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdSessMeta", children: row.turns > 0 ? fill(t("cmdTurns"), { n: row.turns }) : "" }),
          (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdSessCost", children: money(row.cost) ?? "" })
        ] }, row.key)) })
      ] })
    ] }),
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_cmdFoot", children: [
      (0, import_jsx_runtime.jsx)(Btn, {
        fallbackClass: "dp_miniBtn",
        variant: "outline",
        size: "sm",
        onClick: () => typeof onOpenFull === "function" ? onOpenFull() : openOverlay("full", focusSession),
        children: t("cmdOpen")
      }),
      (0, import_jsx_runtime.jsx)("span", { className: "dp_cmdNote", children: focusSession === null ? t("cmdScopeAll") : t("cmdScope") })
    ] })
  ] });
}
function PulseCommandCard({ t, sessionId, useSessions }) {
  const readSessions = typeof useSessions === "function" ? useSessions : (sel) => sel(void 0);
  const cwd = readSessions((s) => s?.byId?.[sessionId]?.cwd ?? null) ?? null;
  const focus = typeof sessionId === "string" && sessionId !== "" ? { id: sessionId, cwd } : null;
  return (0, import_jsx_runtime.jsx)(PulseSummaryCard, { t, focus, onOpenFull: () => openOverlay("full", focus) });
}
function PulseFooterAction({ wide, t }) {
  const [panels, setPanelsLive] = (0, import_react.useState)(loadPanels);
  (0, import_react.useEffect)(() => subscribePanels((next) => setPanelsLive({ ...next })), []);
  const balance = useBalance(panels.footBalance !== false);
  const showBalance = wide && panels.footBalance !== false && balance.data !== null && balance.data.ok === true;
  return (0, import_jsx_runtime.jsx)("button", {
    type: "button",
    className: `dp_footBtn${wide ? "" : " dp_footRail"}`,
    onClick: () => openOverlay("full", null),
    "aria-label": t("openOverlay"),
    title: t("openOverlay"),
    children: wide ? [
      (0, import_jsx_runtime.jsx)(primitives.IconDataOutline16, { key: "i", size: 16 }),
      (0, import_jsx_runtime.jsx)("span", { key: "l", children: t("nav") }),
      showBalance && (0, import_jsx_runtime.jsx)("span", { key: "b", className: "dp_footBalance", children: moneyCny(balance.data.total ?? 0) })
    ] : (0, import_jsx_runtime.jsx)(primitives.IconDataOutline16, { size: 16 })
  });
}
function PulseOverlay({ t, renderFactorySlot }) {
  const overlay = (0, import_react.useSyncExternalStore)(subscribeOverlay, () => overlayState);
  const open = overlay.open;
  const summary = overlay.mode === "summary";
  const stats = (0, import_react.useSyncExternalStore)(subscribeStats, () => statsState);
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOverlayOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;
  const refreshBtn = (0, import_jsx_runtime.jsx)(Btn, {
    variant: "toolbar",
    size: "sm",
    fallbackClass: "dp_iconBtn",
    onClick: () => loadStats(stats.from, stats.to),
    "aria-label": t("refresh"),
    title: t("refresh"),
    disabled: stats.busy || stats.from === null,
    icon: (0, import_jsx_runtime.jsx)(primitives.IconRefreshOutline16, { size: 15 })
  });
  const closeBtn = (0, import_jsx_runtime.jsx)(Btn, {
    variant: "toolbar",
    size: "sm",
    fallbackClass: "dp_iconBtn",
    onClick: () => setOverlayOpen(false),
    "aria-label": t("close"),
    title: t("close"),
    icon: (0, import_jsx_runtime.jsx)(primitives.IconCloseOutline16, { size: 14 })
  });
  const onBackdrop = (e) => {
    if (e.target === e.currentTarget) setOverlayOpen(false);
  };
  const dashboard = typeof renderFactorySlot === "function" ? renderFactorySlot("pulse.dashboard", { floatActions: true }, { fallback: (0, import_jsx_runtime.jsx)(PulseDashboard, { t, floatActions: true }) }) : (0, import_jsx_runtime.jsx)(PulseDashboard, { t, floatActions: true });
  const body = summary ? (0, import_jsx_runtime.jsx)(PulseSummaryCard, {
    t,
    flush: true,
    focus: overlay.focus,
    onOpenFull: () => openOverlay("full", overlay.focus)
  }) : dashboard;
  return (0, import_jsx_runtime.jsx)("div", {
    className: "dp_overlaySeat",
    onClick: onBackdrop,
    children: (0, import_jsx_runtime.jsx)("div", {
      className: `dp_overlayCard${summary ? " dp_overlayCardSummary" : ""}`,
      role: "dialog",
      "aria-label": t("title"),
      children: [
        (0, import_jsx_runtime.jsx)("div", { className: "dp_overlayScroll", children: body }),
        (0, import_jsx_runtime.jsxs)("div", { className: "dp_overlayActions", children: summary ? [closeBtn] : [refreshBtn, closeBtn] })
      ]
    })
  });
}

// src/client/plugin.js
function FootBalanceRow({ t, setFootBalance, useStore }) {
  const enabled = useStore ? useStore((s) => s.enabled) : true;
  const change = (next) => setFootBalance(next === true);
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_cfgRow", children: [
    (0, import_jsx_runtime.jsxs)("div", { className: "dp_setRowText", children: [
      (0, import_jsx_runtime.jsx)("div", { className: "dp_setRowTitle", children: t("generalFootBalance") }),
      (0, import_jsx_runtime.jsx)("div", { className: "dp_setRowDesc", children: t("generalFootBalanceDesc") })
    ] }),
    (0, import_jsx_runtime.jsx)(Switch, { checked: enabled, label: t("generalFootBalance"), onChange: change })
  ] });
}
function PulseRowConfig({ t, view }) {
  const [theme, setTheme2] = (0, import_react.useState)(loadTheme);
  (0, import_react.useEffect)(() => subscribeTheme(setTheme2), []);
  if (view === "summary") return (0, import_jsx_runtime.jsx)("span", { children: t("rowConfigSummary") });
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_page dp_themeScope", "data-dp-theme": theme, children: [
    (0, import_jsx_runtime.jsx)(PricingPage, { t })
  ] });
}
var isPulseDetail = (subject) => subject?.kind === "bundle" && (subject.pkg?.name === "dsh-pulse" || String(subject.pkg?.name ?? "").endsWith("/dsh-pulse"));
function PulseDetailBadge({ t, subject }) {
  if (!isPulseDetail(subject)) return null;
  return (0, import_jsx_runtime.jsx)(Tag, { tone: "outline", fallbackClass: "dp_sessBadge", children: t("detailBadge") });
}
function PulseDetailSection({ t, subject }) {
  if (!isPulseDetail(subject)) return null;
  return (0, import_jsx_runtime.jsxs)("div", { className: "dp_card", children: [
    (0, import_jsx_runtime.jsx)("div", { className: "dp_setTitle", children: t("detailSectionTitle") }),
    (0, import_jsx_runtime.jsx)("div", { className: "dp_setSub", children: t("detailSectionBody") })
  ] });
}
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-pulse: copy dictionaries");
  const t = ctx.locale.bind(NS);
  let menuFaceRegistered = false;
  const registerMenuFace = (scope) => {
    if (menuFaceRegistered) return;
    const commandUi = typeof scope.get === "function" ? scope.get("commandUi") : scope.commandUi;
    if (commandUi === void 0 || typeof commandUi.register !== "function") return;
    menuFaceRegistered = true;
    scope.effect(() => commandUi.register({
      name: "pulse",
      label: () => t("nav"),
      description: () => t("cmdMenuDesc"),
      icon: primitives.IconDataOutline16,
      available: () => true,
      ui: {
        kind: "action",
        run: (session) => {
          const id = typeof session?.sessionId === "string" && session.sessionId !== "" ? session.sessionId : null;
          openOverlay("summary", id === null ? null : { id });
        }
      }
    }), "dsh-pulse: /pulse menu contribution");
  };
  try {
    if (typeof ctx.inject === "function") ctx.inject(["commandUi"], registerMenuFace);
    else registerMenuFace(ctx);
  } catch (error) {
    ctx.logger?.warn?.("dsh-pulse: /pulse menu contribution unavailable", error);
    registerMenuFace(ctx);
  }
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "pulse",
    order: 25,
    label: () => t("nav"),
    inject: () => ({ t })
  }, PulseSection));
  ctx.slots.inject("conversation.chat.commandview", () => ctx.slots.register({
    name: "conversation.chat.commandview",
    key: "pulse-usage",
    inject: () => ({ t })
  }, PulseCommandCard));
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "pulse",
    order: 5,
    label: () => t("nav"),
    inject: () => ({ t })
  }, PulseFooterAction));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "pulse",
    order: 10,
    inject: () => ({ t })
  }, PulseOverlay));
  const statsStore = defineStore !== null ? defineStore({
    init: () => ({ data: null, view: null, busy: false }),
    actions: { sync: (draft, data, view, busy) => {
      draft.data = data;
      draft.view = view;
      draft.busy = busy;
    } }
  }) : null;
  const footBalanceStore = defineStore !== null ? defineStore({
    init: () => ({ enabled: loadPanels().footBalance !== false }),
    actions: { setEnabled: (draft, enabled) => {
      draft.enabled = enabled;
    } }
  }) : null;
  let footBalanceBound = null;
  if (typeof ctx.slots.registerFactory === "function") {
    try {
      ctx.effect(() => ctx.slots.registerFactory({
        name: "pulse.dashboard",
        scope: "root",
        locale: NS,
        store: statsStore ?? void 0,
        children: {
          "pulse.dashboard.chip": { kind: "list", scope: "root" },
          "pulse.dashboard.filter": { kind: "list", scope: "root" },
          "pulse.dashboard.panel": { kind: "list", scope: "root" }
        }
      }, PulseDashboard), "dsh-pulse: dashboard factory");
    } catch {
    }
  }
  if (footBalanceStore !== null) {
    ctx.effect(() => subscribePanels((panels) => {
      footBalanceBound?.setEnabled?.(panels.footBalance !== false);
    }), "dsh-pulse: foot-balance store sync");
    ctx.effect(() => ctx.slots.inject("settings.general.item", () => ctx.slots.register({
      name: "settings.general.item",
      id: "pulse-foot-balance",
      order: 20,
      store: footBalanceStore,
      locale: NS,
      inject: (actions) => {
        footBalanceBound = actions;
        actions?.setEnabled?.(loadPanels().footBalance !== false);
        return { setFootBalance: (enabled) => {
          savePanels({ ...loadPanels(), footBalance: enabled === true });
        } };
      }
    }, FootBalanceRow)), "dsh-pulse: general foot-balance row");
  }
  const seatAttempt = (attempt) => {
    try {
      attempt();
    } catch {
    }
  };
  seatAttempt(() => ctx.effect(() => ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
    name: "plugins.row.config",
    key: "dsh-pulse#pulse",
    inject: () => ({ t })
  }, PulseRowConfig)), "dsh-pulse: row config"));
  seatAttempt(() => ctx.effect(() => ctx.slots.inject("plugins.detail.badge", () => ctx.slots.register({
    name: "plugins.detail.badge",
    id: "pulse",
    inject: () => ({ t })
  }, PulseDetailBadge)), "dsh-pulse: detail badge"));
  seatAttempt(() => ctx.effect(() => ctx.slots.inject("plugins.detail.section", () => ctx.slots.register({
    name: "plugins.detail.section",
    id: "pulse",
    inject: () => ({ t })
  }, PulseDetailSection)), "dsh-pulse: detail section"));
}

		return module.exports;
	}
});
