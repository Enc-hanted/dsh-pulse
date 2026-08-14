window.__ModuleLoader__.load({
	id: "dsh-pulse",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const { useState, useEffect, useMemo, useRef, useSyncExternalStore } = React;
		const { jsx, jsxs } = require("react/jsx-runtime");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region pulse.css
		const css = `.dp_root{--dp-gap:12px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;display:flex;flex-direction:column;gap:var(--dp-gap);color-scheme:light}body[data-ds-dark-theme] .dp_root{color-scheme:dark}.dp_headerRow{display:flex;align-items:center;gap:6px;min-width:0}.dp_title{font-size:15px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary);flex:none}.dp_sub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.dp_iconBtn{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);background:transparent;border:none;border-radius:999px;cursor:pointer}.dp_iconBtn:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dp_iconBtn:disabled{opacity:.4;cursor:default}.dp_toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}.dp_toolbarGroup{display:flex;align-items:center;gap:6px;min-width:0}.dp_toolbarLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;flex:none}.dp_seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-base)}.dp_segBtn{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;padding:4px 10px;cursor:pointer}.dp_segBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_segBtnActive{background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent);color:var(--dsw-alias-label-primary);font-weight:600}.dp_segBtnActive:hover{background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 24%,transparent)}.dp_dateInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;font-size:12px;line-height:18px;padding:4px 8px;max-width:180px}.dp_rangeBox{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);padding:2px 6px}.dp_rangeBox .dp_dateInput{border:none;background:transparent;padding:2px 2px;max-width:140px}.dp_dateInput{max-width:140px}.dp_chips{display:flex;flex-wrap:wrap;gap:8px}.dp_chip{flex:1 1 150px;min-width:140px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}.dp_chipLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;letter-spacing:.02em}.dp_chipValue{font-size:17px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.dp_chipNote{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.dp_costOk{color:var(--dsw-alias-state-success-primary)}.dp_costOff{color:var(--dsw-alias-label-tertiary);font-weight:500}.dp_panelTitle{display:flex;align-items:baseline;gap:8px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;line-height:18px;margin:2px 0 8px}.dp_panelCount{color:var(--dsw-alias-label-tertiary);font-weight:400}.dp_chartOuter{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:12px 14px 8px}.dp_chartGrid{position:relative;height:168px;margin-top:10px;display:flex;align-items:flex-end;gap:2px}.dp_gridline{position:absolute;left:0;right:0;border-top:1px dashed var(--dsw-alias-border-l2);pointer-events:none}.dp_gridlabel{position:absolute;right:0;transform:translateY(-50%);font-size:10px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-tip);padding:0 3px;pointer-events:none;font-variant-numeric:tabular-nums}.dp_gridlabelAxisL{left:0;right:auto;color:var(--dsw-alias-state-business-tertiary);color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_axisNote{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;margin-left:auto}.dp_col{position:relative;flex:1 1 0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;cursor:default}.dp_colHit{position:absolute;inset:-3px 0 -1px;border-radius:4px;background:transparent}.dp_col:hover .dp_colHit{background:var(--dsw-interactive-bg-hover-accent)}.dp_bar{display:flex;flex-direction:column;justify-content:flex-end;width:100%;min-height:0;border-radius:3px 3px 0 0;overflow:hidden;position:relative;z-index:1}.dp_barNonzero{min-height:2px}.dp_segIn{background:var(--dsw-alias-state-business-primary);width:100%}.dp_segCache{background:var(--dsw-alias-state-business-tertiary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary));width:100%}.dp_segOut{background:var(--dsw-alias-state-success-primary);width:100%}.dp_barToday{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:2px;border-radius:4px 4px 0 0}.dp_xlabels{display:flex;gap:2px;margin-top:6px}.dp_xlabel{flex:1 1 0;text-align:center;font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}.dp_xlabelToday{color:var(--dsw-alias-label-secondary);font-weight:600}.dp_emptyChart{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:12px}.dp_legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.dp_legendDot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:-1px}.dp_legendIn{background:var(--dsw-alias-state-business-primary)}.dp_legendCache{background:var(--dsw-alias-state-business-tertiary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_legendOut{background:var(--dsw-alias-state-success-primary)}.dp_tip{position:absolute;bottom:calc(100% + 6px);z-index:3;pointer-events:none;background:var(--dsw-alias-tooltip-bg);color:var(--dsw-alias-label-primary-inverted);border-radius:8px;padding:8px 10px;font-size:11px;line-height:17px;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.18)}.dp_tipAnchor{position:absolute;top:0;bottom:0;width:0;pointer-events:none}.dp_twoCol{display:grid;grid-template-columns:auto 1fr;gap:var(--dp-gap);align-items:start}@media (max-width:640px){.dp_twoCol{grid-template-columns:1fr}}.dp_ringBox{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:14px 16px;display:flex;align-items:center;gap:16px}.dp_ringWrap{position:relative;width:116px;height:116px;flex:none}.dp_ringTrack{stroke:var(--dsw-alias-border-l2)}.dp_ringValue{stroke:var(--dsw-alias-state-business-primary);transition:stroke-dashoffset .6s cubic-bezier(.25,.7,.3,1)}.dp_ringCenter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}.dp_ringPct{font-size:20px;font-weight:700;line-height:26px;font-variant-numeric:tabular-nums}.dp_ringLabel{font-size:10px;color:var(--dsw-alias-label-tertiary)}.dp_ringSide{display:flex;flex-direction:column;gap:6px;min-width:0}.dp_ringSideTitle{font-weight:600;font-size:12px;line-height:18px}.dp_ringSideRow{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;display:flex;gap:6px;align-items:baseline;font-variant-numeric:tabular-nums}.dp_ringSideRow b{color:var(--dsw-alias-label-secondary);font-weight:600;font-size:12px}.dp_listBox{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:12px 14px;display:flex;flex-direction:column;gap:9px;min-width:0}.dp_barRow{display:grid;grid-template-columns:minmax(64px,1.4fr) 3fr minmax(70px,.8fr);gap:10px;align-items:center;font-size:12px;line-height:17px;min-width:0}.dp_barRowName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}.dp_barRowTrack{position:relative;height:8px;border-radius:4px;background:var(--dsw-alias-bg-skeleton);overflow:hidden}.dp_barRowFill{position:absolute;inset:0 auto 0 0;border-radius:4px;background:var(--dsw-alias-state-business-primary)}.dp_barRowFillAlt{background:var(--dsw-alias-state-success-primary)}.dp_barRowVal{text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}.dp_table{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);overflow:hidden}.dp_tableRow{display:grid;grid-template-columns:28px minmax(80px,1.6fr) minmax(52px,.7fr) minmax(70px,1fr) 3fr;gap:8px;align-items:center;padding:8px 14px;font-size:12px;line-height:17px;min-width:0}.dp_tableRow:nth-child(odd){background:var(--dsw-interactive-bg-hover)}.dp_tableHead{background:transparent!important;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:500}.dp_tableRank{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_tableName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-weight:500}.dp_tableNum{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}.dp_tableTokens{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);white-space:nowrap}.dp_tableTrack{height:6px}.dp_tableTrack .dp_barRowTrack{height:6px;border-radius:3px}.dp_tableTrack .dp_barRowFill{border-radius:3px}.dp_stateBox{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}.dp_stateTitle{font-size:14px;font-weight:600}.dp_stateBody{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;max-width:420px}.dp_stateIcon{color:var(--dsw-alias-label-tertiary)}.dp_skeleton{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);height:220px;position:relative;overflow:hidden}.dp_skeleton::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,var(--dsw-alias-bg-skeleton),transparent);animation:dp_shimmer 1.4s infinite}.dp_skeletonShort{height:56px}@keyframes dp_shimmer{to{transform:translateX(100%)}}.dp_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:12px;padding:14px 16px;max-width:100%}.dp_variantCard{--dp-gap:10px}.dp_page{padding:2px 2px 16px}.dp_overlaySeat{position:fixed;inset:0;pointer-events:none;z-index:60}.dp_overlayCard{position:absolute;right:20px;bottom:20px;width:min(880px,calc(100vw - 48px));max-height:min(78vh,760px);overflow:auto;pointer-events:auto;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.22);padding:16px 18px 20px}.dp_footBtn{display:inline-flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:6px 10px;border:none;background:transparent;border-radius:8px;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer}.dp_footBtn:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dp_footRail{width:40px;min-height:32px;justify-content:center;padding:6px}.dp_costNote{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}.dp_retryRow{display:flex;gap:8px}.dp_hcWrap{display:flex;gap:8px;min-width:0;height:184px}.dp_hcGutter{flex:none;display:grid;grid-template-rows:16px repeat(7,minmax(0,1fr));color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1}.dp_hcGutter>span{display:flex;align-items:center;justify-content:flex-end;padding-right:4px}.dp_hcBody{flex:1;min-width:0;display:flex;flex-direction:column}.dp_hcMonths{flex:none;display:grid;column-gap:2px;height:16px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden}.dp_hcMonths>span{overflow:visible;white-space:nowrap;min-width:0}.dp_hcGrid{flex:1;min-height:0;display:grid;gap:2px;grid-template-rows:repeat(7,minmax(0,1fr))}.dp_hcCell{appearance:none;border:none;padding:0;margin:0;min-width:0;border-radius:2px;background:var(--dsw-alias-bg-skeleton);cursor:pointer}.dp_hcCell:hover,.dp_hcCell:focus-visible{outline:1px solid var(--dsw-alias-border-l4)}.dp_hcFuture{opacity:.35;cursor:default}.dp_hcToday{outline:1px solid var(--dsw-alias-state-business-primary)}.dp_hcL1{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}.dp_hcL2{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 34%,transparent)}.dp_hcL3{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,transparent)}.dp_hcL4{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 82%,transparent)}.dp_hcDetail{display:flex;align-items:center;gap:10px;min-height:20px;margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}.dp_hcDetail b{font-weight:600;color:var(--dsw-alias-label-primary)}.dp_hcScale{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.dp_hcSwatch{width:10px;height:10px;border-radius:2px;background:var(--dsw-alias-bg-skeleton);display:inline-block}.dp_picker{position:relative;min-width:0}.dp_pickerBtn{display:flex;align-items:center;gap:6px;max-width:200px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;font-size:12px;line-height:18px;padding:4px 8px;cursor:pointer}.dp_pickerBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_pickerValue{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_pickerCaret{color:var(--dsw-alias-label-tertiary);flex:none}.dp_pickerMenu{position:absolute;z-index:30;top:calc(100% + 4px);left:0;width:224px;max-height:280px;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay);box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden}.dp_pickerSearch{margin:8px 8px 0;flex:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;font-size:12px;line-height:18px;padding:4px 8px}.dp_pickerSearch:focus{outline:1px solid var(--dsw-alias-state-business-primary)}.dp_pickerList{overflow-y:auto;padding:4px;margin-top:4px}.dp_pickerItem{display:block;width:100%;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;padding:4px 8px;border-radius:6px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_pickerItem:hover{background:var(--dsw-interactive-bg-hover)}.dp_pickerItemActive{font-weight:600;background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent)}.dp_pickerEmpty{padding:8px 10px;color:var(--dsw-alias-label-tertiary);font-size:12px}.dp_pickerCaret{display:inline-flex;color:var(--dsw-alias-label-tertiary);flex:none}.dp_trendBody{min-height:204px;display:flex;flex-direction:column}.dp_hourGrid{position:relative;height:168px;margin-top:10px}.dp_hourSvg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.dp_hourLine{fill:none;stroke-width:1.5;vector-effect:non-scaling-stroke}.dp_hourLineIn{stroke:var(--dsw-alias-state-business-primary)}.dp_hourLineCache{stroke:var(--dsw-alias-state-business-tertiary);stroke:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_hourLineOut{stroke:var(--dsw-alias-state-success-primary)}.dp_hourHover{position:absolute;top:0;bottom:0;cursor:crosshair}.dp_hourCursor{position:absolute;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l4);pointer-events:none}.dp_hourXlabels{display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}`;
		const cssTagId = "dsh-pulse/pulse.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.setAttribute("data-plugin-css", cssTagId);
			tag.textContent = css;
			document.head.append(tag);
		}
		//#endregion

		//#region locale
		const NS = "dsh-pulse";
		const zh = {
			nav: "用量观测台",
			title: "Pulse 用量观测台",
			subtitle: "跨会话 token 用量、缓存命中与项目分布",
			refresh: "刷新",
			loading: "正在聚合全部会话...",
			emptyTitle: "还没有可统计的会话",
			emptyBody: "和 agent 聊几轮之后，这里会出现按天的 token 用量、缓存命中率以及项目分布。",
			filteredTitle: "所选范围内没有用量",
			filteredBody: "换一个时间范围、项目或模型试试。",
			errorTitle: "读取统计数据失败",
			errorBody: "宿主的 /pulse/stats 路由不可用（插件宿主半未加载，或服务未就绪）。",
			retry: "重试",
			rangeLabel: "范围",
			range1: "今天",
			range7: "近7天",
			range30: "近30天",
			range90: "近90天",
			range365: "近1年",
			rangeCustom: "自选",
			rangeFrom: "起始日期",
			rangeToDate: "结束日期",
			projectLabel: "项目",
			projectAll: "全部项目",
			modelLabel: "模型",
			modelAll: "全部模型",
			searchPlaceholder: "搜索...",
			noMatch: "无匹配项",
			hourCount: "24 小时",
			hcLess: "少",
			hcMore: "多",
			hcMon: "一",
			hcWed: "三",
			hcFri: "五",
			hcAria: "每日 token 热力图",
			chipSessions: "会话",
			chipSubagents: "含子代理 {n}",
			chipTurns: "回合 / 工具调用",
			chipTokens: "Token 总量",
			chipCache: "缓存命中率",
			chipCost: "费用估算",
			costOff: "未配置单价",
			costHint: "在 profile 的 cordis.patch.yml 中配置 pricing 后显示",
			unpriced: "{n} token 未定价",
			trendTitle: "用量走势",
			dailyCount: "近 {n} 天",
			cacheTitle: "缓存命中",
			cacheOf: "命中 {hit} / 总输入 {total}",
			cacheNa: "暂无数据",
			sideUncached: "未缓存输入",
			sideOutput: "输出",
			modelsTitle: "模型分布",
			projectsTitle: "项目排行",
			colRank: "#",
			colProject: "项目",
			colSessions: "会话",
			colTokens: "Token",
			noWorkspace: "（无工作区）",
			unknownModel: "未知模型",
			today: "今天",
			tipIn: "输入 {n}",
			tipCache: "命中 {n}",
			tipOut: "输出 {n}",
			tipSessions: "{n} 个会话",
			legendInput: "未缓存输入",
			legendCache: "缓存读取",
			legendOutput: "输出",
			axisNote: "命中(左轴) · 输入/输出(右轴)",
			generatedAt: "生成于 {t}",
			inOf: "入 {n}",
			outOf: "出 {n}",
			openOverlay: "打开用量观测台",
			close: "关闭",
		};
		const en = {
			nav: "Usage Pulse",
			title: "Pulse Usage Observatory",
			subtitle: "Cross-session tokens, cache hits and project breakdown",
			refresh: "Refresh",
			loading: "Aggregating all sessions...",
			emptyTitle: "No sessions to measure yet",
			emptyBody: "Chat with the agent for a few turns and daily token usage, cache hit rate and project breakdown will appear here.",
			filteredTitle: "No usage in this view",
			filteredBody: "Try a different range, project, or model.",
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
			rangeFrom: "Start date",
			rangeToDate: "End date",
			projectLabel: "Project",
			projectAll: "All projects",
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
			unpriced: "{n} tokens unpriced",
			trendTitle: "Usage trend",
			dailyCount: "last {n} days",
			cacheTitle: "Cache hits",
			cacheOf: "{hit} hit / {total} total input",
			cacheNa: "No data yet",
			sideUncached: "Uncached input",
			sideOutput: "Output",
			modelsTitle: "By model",
			projectsTitle: "Top projects",
			colRank: "#",
			colProject: "Project",
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
			axisNote: "Cache hit (left) · In/out (right)",
			generatedAt: "Generated {t}",
			inOf: "in {n}",
			outOf: "out {n}",
			openOverlay: "Open usage pulse",
			close: "Close",
		};
		//#endregion

		//#region view model (mirror of src/view.js — keep both in sync)
		/**
		 * dsh-pulse view model - pure, client-side aggregation of the windowed
		 * per-session records served by `/pulse/stats` into chartable buckets
		 * (day / week / month), filtered totals, per-model splits, cost estimates,
		 * and the GitHub-style heatmap cells used by the 90-day / 1-year views.
		 *
		 * The same code is mirrored into the browser bundle (lib/client.js) because
		 * a dsh client half is a single self-registering file that cannot require
		 * node-side modules. `scripts/sync-mirror.mjs` regenerates the mirrored
		 * region from this file and `test/mirror-test.mjs` fails on drift - edit
		 * this file, then run `node scripts/sync-mirror.mjs`.
		 *
		 * @module dsh-pulse/view
		 */

		/** Local-timezone `YYYY-MM-DD` for a Unix epoch millisecond stamp. */
		function localDay(timeMs) {
		  const d = new Date(timeMs);
		  const p = (n) => String(n).padStart(2, "0");
		  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
		}

		/** Add (or subtract) whole days from a `YYYY-MM-DD` string, local time. */
		function shiftDay(day, delta) {
		  const [y, m, d] = String(day).split("-").map(Number);
		  return localDay(new Date(y, m - 1, d + delta, 12).getTime());
		}

		/** Days between two `YYYY-MM-DD` strings (inclusive, at least 1). */
		function daysBetween(from, to) {
		  const [fy, fm, fd] = String(from).split("-").map(Number);
		  const [ty, tm, td] = String(to).split("-").map(Number);
		  const a = Date.UTC(fy, fm - 1, fd);
		  const b = Date.UTC(ty, tm - 1, td);
		  return Math.max(1, Math.round((b - a) / 86400000) + 1);
		}

		/**
		 * Normalize a custom date range: swap a reversed pair and trim an over-long
		 * span to `maxDays` (default 30) by moving the start toward the end. Preset
		 * ranges (90d/1y) are served by their own windows and skip this clamp.
		 */
		function clampSpan(from, to, maxDays = 30) {
		  let f = String(from);
		  let t = String(to);
		  if (f > t) { const swap = f; f = t; t = swap; }
		  if (daysBetween(f, t) > maxDays) f = shiftDay(t, -(maxDays - 1));
		  return { from: f, to: t };
		}

		/** Monday-start week key (`YYYY-MM-DD` of the week's Monday) for a day. */
		function weekStart(day) {
		  const [y, m, d] = String(day).split("-").map(Number);
		  const dow = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // Monday = 0
		  return shiftDay(day, -dow);
		}

		/** Month key `YYYY-MM` for a day. */
		function monthKey(day) {
		  return String(day).slice(0, 7);
		}

		/** Bucket key for one day under a granularity (`day` | `week` | `month`). */
		function bucketOf(granularity, day) {
		  if (granularity === "week") return weekStart(day);
		  if (granularity === "month") return monthKey(day);
		  return day;
		}

		/** Contiguous bucket keys covering [`from`, `to`] under a granularity
		 *  (capped to the most recent 400 buckets for chart readability). */
		function rangeKeys(granularity, from, to) {
		  if (granularity === "month") {
		    const [fy, fm] = String(from).split("-").map(Number);
		    const [ty, tm] = String(to).split("-").map(Number);
		    const end = ty * 12 + (tm - 1);
		    const start = Math.max(fy * 12 + (fm - 1), end - 399);
		    const keys = [];
		    for (let m = start; m <= end; m += 1) {
		      keys.push(`${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`);
		    }
		    return keys;
		  }
		  const step = granularity === "week" ? 7 : 1;
		  // Count first, then keep the most recent ≤400 buckets ending at `to`.
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

		/** Short human label for a bucket key (`MM-DD` for days, `YYYY-MM` for months). */
		function bucketLabel(key) {
		  return key.length === 7 ? key : key.slice(5);
		}

		const EMPTY_TOKENS = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

		function addTokens(bucket, tokens) {
		  bucket.input += tokens.input || 0;
		  bucket.output += tokens.output || 0;
		  bucket.cacheRead += tokens.cacheRead || 0;
		  bucket.cacheWrite += tokens.cacheWrite || 0;
		}

		/**
		 * Fold windowed session records into one dashboard view.
		 *
		 * Records carry per-day maps (`byDay`, `modelsByDay`, `hoursByDay`,
		 * `turnsByDay`, `toolCallsByDay`) - the host slices the projection state to
		 * the requested window, so a session's turns/tool-calls are summed over the
		 * same in-range days as its tokens and no totals can leak from outside the
		 * view. Schema-2 records (hosts without the projection unit) carry scalar
		 * window-scoped turns/tool-calls instead, which the view accepts as-is.
		 *
		 * @param {Array<object>} sessions - payload session records.
		 * @param {object} options
		 * @param {('day'|'week'|'month')} [options.granularity='day'] - chart bucket size.
		 * @param {string} options.from - inclusive `YYYY-MM-DD`.
		 * @param {string} options.to - inclusive `YYYY-MM-DD`.
		 * @param {string} [options.project] - restrict to one project label ("" = all).
		 * @param {string} [options.model] - restrict to one model id ("" = all).
		 * @param {Array<{model: string, input: number, cacheRead?: number, output: number}>} [options.pricing]
		 * @returns {{buckets: Array, totals: object, models: Array, projects: Array, cost: object, hasData: boolean, knownProjects: string[], knownModels: string[]}}
		 */
		function buildView(sessions, { granularity = "day", from, to, project = "", model = "", pricing = [] }) {
		  const keys = rangeKeys(granularity, from, to);
		  const index = new Map(keys.map((key, i) => [key, i]));
		  const buckets = keys.map((key) => ({ key, sessions: 0, ...EMPTY_TOKENS() }));
		  const totals = { sessions: 0, subagents: 0, turns: 0, toolCalls: 0, ...EMPTY_TOKENS() };
		  const models = new Map();
		  const projects = new Map();
		  const seenProjects = new Set();
		  const seenModels = new Set();
		  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);

		  for (const record of Array.isArray(sessions) ? sessions : []) {
		    if (record === null || typeof record !== "object") continue;
		    const label = record.project === null || record.project === undefined ? "" : String(record.project);
		    seenProjects.add(label);
		    if (project !== "" && label !== project) continue;

		    // Active days = union of token days and turn/tool-call days, so a step
		    // whose adapter reported no usage still contributes its turn count.
		    const byDay = record.byDay ?? {};
		    const daySet = new Set(Object.keys(byDay));
		    for (const day of Object.keys(record.turnsByDay ?? {})) daySet.add(day);
		    for (const day of Object.keys(record.toolCallsByDay ?? {})) daySet.add(day);
		    // Model options come from the whole window, independent of the filters,
		    // so the picker stays stable while filtering.
		    for (const dayModels of Object.values(record.modelsByDay ?? {})) {
		      for (const modelName of Object.keys(dayModels)) seenModels.add(modelName);
		    }
		    const activeDays = [...daySet].filter((day) => day >= from && day <= to).sort();
		    const anchorDay = record.day !== undefined && record.day >= from && record.day <= to
		      ? record.day
		      : activeDays[0];
		    if (anchorDay === undefined) continue;
		    const anchorIdx = index.get(bucketOf(granularity, anchorDay));
		    if (anchorIdx !== undefined) buckets[anchorIdx].sessions += 1;

		    const inRange = EMPTY_TOKENS();
		    const inRangeModels = new Map();
		    for (const day of activeDays) {
		      const dayModels = record.modelsByDay?.[day];
		      if (modelFilter === null) {
		        // Unfiltered: day totals drive buckets/totals, per-model splits ride along.
		        const dayTokens = byDay[day] ?? EMPTY_TOKENS();
		        addTokens(inRange, dayTokens);
		        const idx = index.get(bucketOf(granularity, day));
		        if (idx !== undefined) addTokens(buckets[idx], dayTokens);
		        if (dayModels === undefined) continue;
		        for (const [modelName, tokens] of Object.entries(dayModels)) {
		          const row = inRangeModels.get(modelName) ?? EMPTY_TOKENS();
		          addTokens(row, tokens);
		          inRangeModels.set(modelName, row);
		        }
		      } else if (dayModels !== undefined && dayModels[modelFilter] !== undefined) {
		        // Model-filtered: only the selected model's tokens flow anywhere,
		        // so buckets, chips, projects and the cost chip all agree.
		        const filtered = dayModels[modelFilter];
		        addTokens(inRange, filtered);
		        const idx = index.get(bucketOf(granularity, day));
		        if (idx !== undefined) addTokens(buckets[idx], filtered);
		        const row = inRangeModels.get(modelFilter) ?? EMPTY_TOKENS();
		        addTokens(row, filtered);
		        inRangeModels.set(modelFilter, row);
		      }
		    }

		    totals.sessions += 1;
		    if (record.subagent) totals.subagents += 1;
		    if (record.turnsByDay === undefined) {
		      // Schema-2 compatibility: hosts without the projection unit serve
		      // window-scoped scalar counts instead of per-day maps.
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
		      const row = models.get(modelName) ?? EMPTY_TOKENS();
		      addTokens(row, tokens);
		      models.set(modelName, row);
		    }
		    const projectRow = projects.get(label) ?? { project: label === "" ? null : label, sessions: 0, ...EMPTY_TOKENS() };
		    projectRow.sessions += 1;
		    addTokens(projectRow, inRange);
		    projects.set(label, projectRow);
		  }

		  // Cache-write tokens were cache misses: they belong in the denominator,
		  // so providers that report them (pi-ai) don't inflate the hit rate.
		  const inputSide = totals.input + totals.cacheRead + totals.cacheWrite;
		  totals.cacheHitRate = inputSide > 0 ? totals.cacheRead / inputSide : null;

		  const modelsArr = [...models.entries()]
		    .map(([modelName, tokens]) => ({ model: modelName, ...tokens }))
		    .sort((a, b) => (b.input + b.output + b.cacheRead) - (a.input + a.output + a.cacheRead));

		  const projectsArr = [...projects.values()]
		    .map((row) => ({ ...row, total: row.input + row.output + row.cacheRead + row.cacheWrite }))
		    .sort((a, b) => b.total - a.total);

		  const grandTotal = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
		  return {
		    buckets,
		    totals,
		    models: modelsArr,
		    projects: projectsArr,
		    cost: costOf(modelsArr, pricing),
		    hasData: grandTotal > 0 || totals.sessions > 0,
		    knownProjects: [...seenProjects].filter((p) => p !== "").sort(),
		    knownModels: [...seenModels].sort(),
		  };
		}

		/**
		 * Cost estimate over per-model token splits.
		 * Uncached input (miss + cache write) at `input`; cache reads at `cacheRead`
		 * (defaults to the miss rate when the rule omits it); output at `output`.
		 *
		 * @returns {{configured: boolean, total: number|null, currency: string|null, unpriced: object}}
		 */
		function costOf(models, pricing) {
		  const rate = new Map((Array.isArray(pricing) ? pricing : []).map((rule) => [rule.model, rule]));
		  let total = 0;
		  let currency = null;
		  let configured = false;
		  const unpriced = EMPTY_TOKENS();
		  for (const row of Array.isArray(models) ? models : []) {
		    const rule = rate.get(row.model);
		    if (rule === undefined) {
		      unpriced.input += row.input + row.cacheRead + row.cacheWrite;
		      unpriced.output += row.output;
		      continue;
		    }
		    configured = true;
		    currency = rule.currency ?? currency;
		    const cacheRate = typeof rule.cacheRead === "number" ? rule.cacheRead : (rule.input || 0);
		    total += ((row.input + row.cacheWrite) * (rule.input || 0)
		      + row.cacheRead * cacheRate
		      + row.output * (rule.output || 0)) / 1e6;
		  }
		  return configured
		    ? { configured: true, total: Math.round(total * 1e6) / 1e6, currency: currency ?? "CNY", unpriced }
		    : { configured: false, total: null, currency: null, unpriced };
		}

		/** Axis maximum rounded to a 1/2/5×10^k ceiling so gridlines read clean. */
		function niceMax(value) {
		  if (!(value > 0)) return 1;
		  const exp = Math.floor(Math.log10(value));
		  const base = Math.pow(10, exp);
		  for (const m of [1, 2, 5, 10]) {
		    if (m * base >= value) return m * base;
		  }
		  return 10 * base;
		}

		/**
		 * Cost formatting: whole amounts keep two decimals, sub-unit amounts keep
		 * three significant digits (so `0.000278` stays readable instead of raw).
		 */
		function fmtCost(total) {
		  const v = Number(total) || 0;
		  if (v >= 1) return v.toFixed(2);
		  return String(Number(v.toPrecision(3)));
		}

		/**
		 * GitHub-style heatmap layout over day-granularity buckets: cells aligned to
		 * Monday-start weeks, padded with leading/trailing nulls so the grid always
		 * covers whole weeks, plus the column index of each month's first day.
		 *
		 * @param {Array<{key: string}>} buckets - contiguous day buckets (from `rangeKeys("day", ...)`).
		 * @returns {{cells: Array<object|null>, weeks: number, months: Array<{col: number, label: string}>}}
		 */
		function heatmapCells(buckets) {
		  const rows = Array.isArray(buckets) ? buckets : [];
		  const first = rows[0]?.key;
		  if (first === undefined) return { cells: [], weeks: 0, months: [] };
		  const [y, m, d] = String(first).split("-").map(Number);
		  const offset = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // Monday = 0
		  const cells = [];
		  for (let i = 0; i < offset; i += 1) cells.push(null);
		  const months = [];
		  rows.forEach((bucket, i) => {
		    if (i === 0 || String(bucket.key).endsWith("-01")) {
		      months.push({ col: cells.length, label: monthKey(bucket.key) });
		    }
		    cells.push(bucket);
		  });
		  while (cells.length % 7 !== 0) cells.push(null);
		  return { cells, weeks: cells.length / 7, months };
		}

		/** Discrete intensity level (0-4) for one heatmap cell against the range max. */
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

		/**
		 * Hourly line-series for one day (the "today" view): 24 `HH` buckets summed
		 * over every in-scope record's `hoursByDay`, honoring the project and model
		 * filters. Schema-2 records carry no hour maps and simply contribute zeros.
		 *
		 * @param {Array<object>} sessions - payload session records.
		 * @param {string} day - `YYYY-MM-DD` to bucket.
		 * @param {{project?: string, model?: string}} [filters]
		 * @returns {Array<{key: string, input: number, output: number, cacheRead: number, cacheWrite: number}>} 24 buckets, "00".."23".
		 */
		function hourlySeries(sessions, day, { project = "", model = "" } = {}) {
		  const hours = Array.from({ length: 24 }, (_, i) => ({ key: String(i).padStart(2, "0"), ...EMPTY_TOKENS() }));
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
		        if (model !== "" && modelName !== model) continue;
		        addTokens(hours[idx], tokens);
		      }
		    }
		  }
		  return hours;
		}
		//#endregion

		//#region utils
		/** Token-count formatting: 1.2k / 3.4M / 5.6B. */
		function fmtTokens(n) {
			const v = Number(n) || 0;
			if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
			if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
			if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
			return String(Math.round(v));
		}
		/** Locale-stable short time for the generated-at stamp. */
		function fmtClock(ms) {
			const d = new Date(Number(ms) || 0);
			const p = (x) => String(x).padStart(2, "0");
			return `${p(d.getHours())}:${p(d.getMinutes())}`;
		}
		/** Replace `{key}` placeholders in a copy string. */
		function fill(text, vars) {
			return String(text).replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
		}
		const RANGE_PRESETS = { "1": 1, "7": 7, "30": 30, "90": 90, "365": 365 };
		//#endregion

		//#region stats store
		/**
		 * One shared stats store for every mounted dashboard surface, so the
		 * settings page, the /pulse command card and the floating overlay all
		 * read one fetch instead of each triggering its own full aggregation.
		 * A request sequence number plus an AbortController make switching
		 * windows race-free: only the newest request may land state.
		 */
		let statsState = { key: null, from: null, to: null, status: "loading", data: null, error: null, busy: false };
		let statsSeq = 0;
		let statsAbort = null;
		const statsListeners = new Set();
		/** Recently fetched windows (LRU, max 4) - switching back to a range
		 *  renders instantly from cache while a background fetch refreshes it. */
		const payloadCache = new Map();
		function setStatsState(next) {
			statsState = next;
			for (const listener of statsListeners) listener();
		}
		function subscribeStats(listener) {
			statsListeners.add(listener);
			return () => { statsListeners.delete(listener); };
		}
		function loadStats(from, to) {
			const seq = ++statsSeq;
			const key = `${from}:${to}`;
			if (statsAbort !== null) statsAbort.abort();
			statsAbort = new AbortController();
			const cached = payloadCache.get(key);
			setStatsState({
				...statsState,
				key,
				from,
				to,
				status: cached !== undefined ? "ready" : statsState.data === null ? "loading" : "ready",
				data: cached !== undefined ? cached : statsState.data,
				busy: true,
				error: null,
			});
			fetch(`/pulse/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
				credentials: "same-origin",
				headers: { accept: "application/json" },
				signal: statsAbort.signal,
			}).then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				// Schema 3 hosts serve window-exact from/to payloads; schema 2
				// hosts (previous release) serve a today-anchored `days` window
				// the view model still understands - tolerated for rolling
				// upgrades, never a hard error.
				if (data?.schema !== 3 && data?.schema !== 2) throw new Error("unexpected payload schema");
				if (seq !== statsSeq) return;
				payloadCache.delete(key);
				payloadCache.set(key, data);
				// The current key was just re-inserted (newest), so LRU eviction
				// never drops it.
				while (payloadCache.size > 4) payloadCache.delete(payloadCache.keys().next().value);
				setStatsState({ key, from, to, status: "ready", data, error: null, busy: false });
			}).catch((error) => {
				if (seq !== statsSeq) return;
				setStatsState({ ...statsState, key, from, to, status: "error", error: String(error?.message ?? error), busy: false });
			});
		}
		/** Read the shared store; triggers a load when this mount's window differs. */
		function usePulseStats(from, to) {
			const state = useSyncExternalStore(subscribeStats, () => statsState);
			const key = `${from}:${to}`;
			useEffect(() => {
				if (statsState.key !== key || statsState.status === "error") loadStats(from, to);
			}, [key, from, to]);
			return { ...state, reload: () => loadStats(from, to) };
		}
		//#endregion

		//#region overlay store
		let overlayOpen = false;
		const overlayListeners = new Set();
		function setOverlayOpen(value) {
			if (overlayOpen === value) return;
			overlayOpen = value;
			for (const listener of overlayListeners) listener(value);
		}
		function subscribeOverlay(listener) {
			overlayListeners.add(listener);
			return () => { overlayListeners.delete(listener); };
		}
		//#endregion

		//#region charts
		/** Stacked bucket bar chart built from divs - responsive without measurement. */
		function BucketChart({ buckets, granularity, today, t }) {
			const [hover, setHover] = useState(null);
			const rows = Array.isArray(buckets) ? buckets : [];
			const maxRaw = rows.reduce((m, b) => Math.max(m,
				(b.input || 0) + (b.cacheRead || 0) + (b.cacheWrite || 0) + (b.output || 0)), 0);
			const max = niceMax(maxRaw);
			const total = rows.reduce((m, b) => m + (b.input || 0) + (b.cacheRead || 0) + (b.cacheWrite || 0) + (b.output || 0), 0);
			const labelStep = Math.max(1, Math.ceil(rows.length / 6));
			const todayKey = bucketOf(granularity, today);
			const hovered = hover !== null && rows[hover] !== undefined ? rows[hover] : null;
			return jsx("div", { className: "dp_chartOuter", children: jsxs("div", { className: "dp_chartGrid", children: [
				jsx("div", { key: "g0", className: "dp_gridline", style: { top: "0%" } }),
				jsx("div", { key: "g50", className: "dp_gridline", style: { top: "50%" } }),
				jsx("div", { key: "g100", className: "dp_gridline", style: { top: "100%" } }),
				jsx("span", { key: "l0", className: "dp_gridlabel", style: { top: "0%" }, children: fmtTokens(max) }),
				jsx("span", { key: "l50", className: "dp_gridlabel", style: { top: "50%" }, children: fmtTokens(max / 2) }),
				total === 0 && jsxs("div", { key: "empty", className: "dp_emptyChart", children: [
					jsx(primitives.IconDataOutline16, { size: 20 }),
					jsx("span", { children: t("cacheNa") }),
				] }),
				rows.map((bucket, i) => {
					const inSide = (bucket.input || 0) + (bucket.cacheWrite || 0);
					const cacheRead = bucket.cacheRead || 0;
					const out = bucket.output || 0;
					const sum = inSide + cacheRead + out;
					const isToday = bucket.key === todayKey;
					const height = sum > 0 ? (sum / max) * 100 : 0;
					return jsx("div", {
						className: "dp_col",
						onMouseEnter: () => setHover(i),
						onMouseLeave: () => setHover(null),
						children: [
							jsx("div", { key: "hit", className: "dp_colHit" }),
							jsxs("div", {
								key: "bar",
								className: `dp_bar${isToday ? " dp_barToday" : ""}${sum > 0 ? " dp_barNonzero" : ""}`,
								style: { height: `${height}%` },
								children: [
									jsx("div", { className: "dp_segOut", style: { height: sum > 0 ? `${(out / sum) * 100}%` : "0%" } }),
									jsx("div", { className: "dp_segCache", style: { height: sum > 0 ? `${(cacheRead / sum) * 100}%` : "0%" } }),
									jsx("div", { className: "dp_segIn", style: { height: sum > 0 ? `${(inSide / sum) * 100}%` : "0%" } }),
								],
							}),
						],
					}, bucket.key ?? i);
				}),
				hovered !== null && hover !== null && jsx("div", {
					key: "tip",
					className: "dp_tipAnchor",
					style: { left: `${((hover + 0.5) / rows.length) * 100}%` },
					children: jsx("div", {
						className: "dp_tip",
						style: hover < 2
							? { left: "0" }
							: hover >= rows.length - 2
								? { left: "0", transform: "translateX(-100%)" }
								: { left: "0", transform: "translateX(-50%)" },
						children: jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
							jsx("b", { children: hovered.key === todayKey ? `${hovered.key} ${t("today")}` : hovered.key }),
							jsx("span", { children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
							jsx("span", { children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
							jsx("span", { children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) }),
							jsx("span", { children: fill(t("tipSessions"), { n: hovered.sessions || 0 }) }),
						] }),
					}),
				}),
			] }) });
		}

		/** X-axis labels under the bucket chart (sparse, today highlighted).
		 *  Small windows label every bucket; long windows thin them out. */
		function BucketXLabels({ buckets, granularity, today, t }) {
			const rows = Array.isArray(buckets) ? buckets : [];
			const labelStep = rows.length <= 12 ? 1 : Math.max(1, Math.ceil(rows.length / 6));
			const todayKey = bucketOf(granularity, today);
			return jsx("div", { className: "dp_xlabels", children: rows.map((bucket, i) => jsx("span", {
				className: `dp_xlabel${bucket.key === todayKey ? " dp_xlabelToday" : ""}`,
				children: i % labelStep === 0 || bucket.key === todayKey ? bucketLabel(bucket.key) : "",
			}, bucket.key ?? i)) });
		}

		/** GitHub-style daily heatmap for the 90-day / 1-year views - fluid
		 *  cells inside the same dp_chartOuter frame as the bar chart, so the
		 *  plot fills the trend body evenly at every panel width. */
		function HeatmapChart({ buckets, today, t }) {
			const [hover, setHover] = useState(null);
			const { cells, weeks, months } = heatmapCells(buckets);
			const gridStyle = { gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` };
			const maxRaw = cells.reduce((m, c) => (c === null ? m : Math.max(m,
				(c.input || 0) + (c.cacheRead || 0) + (c.cacheWrite || 0) + (c.output || 0))), 0);
			const hovered = hover !== null && cells[hover] !== undefined && cells[hover] !== null ? cells[hover] : null;
			return jsxs("div", { children: [
				jsx("div", { className: "dp_chartOuter", children: jsxs("div", { className: "dp_hcWrap", children: [
					jsxs("div", { className: "dp_hcGutter", children: [0, 2, 4].map((row) => jsx("span", {
						key: `g${row}`,
						style: { gridRowStart: row + 2 },
						children: row === 0 ? t("hcMon") : row === 2 ? t("hcWed") : t("hcFri"),
					})) }),
					jsxs("div", { className: "dp_hcBody", children: [
						jsxs("div", { className: "dp_hcMonths", style: gridStyle, children: months.map(({ col, label }) => {
							const showYear = label.endsWith("-01");
							return jsx("span", {
								key: `m${col}`,
								style: { gridColumnStart: col + 1 },
								children: showYear ? label : label.slice(5),
							});
						}) }),
						jsxs("div", { className: "dp_hcGrid", role: "img", "aria-label": t("hcAria"), style: gridStyle, children: cells.map((bucket, i) => {
							if (bucket === null) return jsx("span", { key: `f${i}`, className: "dp_hcCell dp_hcFuture" });
							const total = (bucket.input || 0) + (bucket.cacheRead || 0) + (bucket.cacheWrite || 0) + (bucket.output || 0);
							const level = heatmapLevel(total, maxRaw);
							const isToday = bucket.key === today;
							return jsx("button", {
								key: bucket.key,
								type: "button",
								className: `dp_hcCell${level > 0 ? ` dp_hcL${level}` : ""}${isToday ? " dp_hcToday" : ""}`,
								onMouseEnter: () => setHover(i),
								onMouseLeave: () => setHover(null),
								onFocus: () => setHover(i),
								onBlur: () => setHover(null),
								"aria-label": bucket.key,
							});
						}) }),
					] }),
				] }) }),
				jsxs("div", { className: "dp_hcDetail", children: hovered !== null
					? [
						jsx("b", { key: "d", children: hovered.key === today ? `${hovered.key} ${t("today")}` : hovered.key }),
						jsx("span", { key: "i", children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
						jsx("span", { key: "c", children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
						jsx("span", { key: "o", children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) }),
						jsx("span", { key: "s", children: fill(t("tipSessions"), { n: hovered.sessions || 0 }) }),
					]
					: jsx("span", { children: "\u00a0" }) }),
				jsxs("div", { className: "dp_hcScale", children: [
					jsx("span", { children: t("hcLess") }),
					[0, 1, 2, 3, 4].map((level) => jsx("i", { key: level, className: `dp_hcSwatch${level > 0 ? ` dp_hcL${level}` : ""}` })),
					jsx("span", { children: t("hcMore") }),
				] }),
			] });
		}

		/** Searchable dropdown: a button plus a popup with an embedded filter
		 *  input. Closes on select, Escape, or an outside click. */
		function SearchPicker({ value, options, placeholder, displayName, onChange, t }) {
			const [open, setOpen] = useState(false);
			const [query, setQuery] = useState("");
			const rootRef = useRef(null);
			useEffect(() => {
				if (!open) return;
				const onDoc = (e) => {
					if (rootRef.current !== null && !rootRef.current.contains(e.target)) setOpen(false);
				};
				const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
				document.addEventListener("mousedown", onDoc);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("mousedown", onDoc);
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			const q = query.trim().toLowerCase();
			const rows = options.filter((option) => q === "" || option.label.toLowerCase().includes(q));
			const shown = value === "" || value === null || value === undefined
				? placeholder
				: displayName(value);
			return jsx("div", { ref: rootRef, className: "dp_picker", children: [
				jsx("button", {
					type: "button",
					className: "dp_pickerBtn",
					onClick: () => setOpen(!open),
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					title: shown,
					children: [
						jsx("span", { className: "dp_pickerValue", children: shown }),
						jsx("span", { className: "dp_pickerCaret", children: open
							? jsx(primitives.IconChevronUpOutline14, { size: 14 })
							: jsx(primitives.IconChevronDownOutline14, { size: 14 }) }),
					],
				}),
				open && jsxs("div", { className: "dp_pickerMenu", role: "listbox", children: [
					jsx("input", {
						className: "dp_pickerSearch",
						type: "text",
						placeholder: t("searchPlaceholder"),
						value: query,
						autoFocus: true,
						onChange: (e) => setQuery(e.target.value),
					}),
					jsxs("div", { className: "dp_pickerList", children: [
						rows.map((option) => jsx("button", {
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
							children: option.label,
						})),
						rows.length === 0 && jsx("div", { className: "dp_pickerEmpty", children: t("noMatch") }),
					] }),
				] }),
			] });
		}

		/** Intraday line chart for the "today" view: one SVG polyline per token
		 *  class (uncached input / cache read / output) over 24 hours. */
		function HourlyChart({ hours, t }) {
			const [hover, setHover] = useState(null);
			const rows = Array.isArray(hours) ? hours : [];
			const sumOf = (h) => (h.input || 0) + (h.cacheRead || 0) + (h.cacheWrite || 0) + (h.output || 0);
			const total = rows.reduce((m, h) => m + sumOf(h), 0);
			// Dual axes: cache reads own the left axis; uncached input and
			// output share the right axis, so 95%+ hit rates no longer squash
			// the two small series into the floor.
			const cacheMaxRaw = rows.reduce((m, h) => Math.max(m, h.cacheRead || 0), 0);
			const rightMaxRaw = rows.reduce((m, h) => Math.max(m, (h.input || 0) + (h.cacheWrite || 0), h.output || 0), 0);
			const cacheMax = niceMax(cacheMaxRaw);
			const rightMax = niceMax(rightMaxRaw);
			const px = (i) => ((i + 0.5) / 24) * 100;
			const pyCache = (v) => 100 - (v / cacheMax) * 100;
			const pyRight = (v) => 100 - (v / rightMax) * 100;
			const lineCache = rows.map((h, i) => `${px(i)},${pyCache(h.cacheRead || 0)}`).join(" ");
			const lineIn = rows.map((h, i) => `${px(i)},${pyRight((h.input || 0) + (h.cacheWrite || 0))}`).join(" ");
			const lineOut = rows.map((h, i) => `${px(i)},${pyRight(h.output || 0)}`).join(" ");
			const hovered = hover !== null && rows[hover] !== undefined ? rows[hover] : null;
			return jsxs("div", { className: "dp_hourWrap", children: [
				jsx("div", { className: "dp_chartOuter", children: jsxs("div", { className: "dp_hourGrid", children: [
					jsx("div", { key: "g0", className: "dp_gridline", style: { top: "0%" } }),
					jsx("div", { key: "g50", className: "dp_gridline", style: { top: "50%" } }),
					jsx("div", { key: "g100", className: "dp_gridline", style: { top: "100%" } }),
					cacheMaxRaw > 0 && jsx("span", { key: "cl0", className: "dp_gridlabel dp_gridlabelAxisL", style: { top: "0%" }, children: fmtTokens(cacheMax) }),
					cacheMaxRaw > 0 && jsx("span", { key: "cl50", className: "dp_gridlabel dp_gridlabelAxisL", style: { top: "50%" }, children: fmtTokens(cacheMax / 2) }),
					rightMaxRaw > 0 && jsx("span", { key: "rl0", className: "dp_gridlabel", style: { top: "0%" }, children: fmtTokens(rightMax) }),
					rightMaxRaw > 0 && jsx("span", { key: "rl50", className: "dp_gridlabel", style: { top: "50%" }, children: fmtTokens(rightMax / 2) }),
					total === 0 && jsxs("div", { key: "empty", className: "dp_emptyChart", children: [
						jsx(primitives.IconDataOutline16, { size: 20 }),
						jsx("span", { children: t("cacheNa") }),
					] }),
					jsx("svg", {
						key: "plot",
						className: "dp_hourSvg",
						viewBox: "0 0 100 100",
						preserveAspectRatio: "none",
						"aria-hidden": "true",
						children: [
							jsx("polyline", { key: "in", className: "dp_hourLine dp_hourLineIn", points: lineIn }),
							jsx("polyline", { key: "cache", className: "dp_hourLine dp_hourLineCache", points: lineCache }),
							jsx("polyline", { key: "out", className: "dp_hourLine dp_hourLineOut", points: lineOut }),
						],
					}),
					rows.map((h, i) => jsx("div", {
						key: h.key,
						className: "dp_hourHover",
						style: { left: `${(i / 24) * 100}%`, width: `${100 / 24}%` },
						onMouseEnter: () => setHover(i),
						onMouseLeave: () => setHover(null),
					})),
					hovered !== null && jsx("div", {
						key: "cursor",
						className: "dp_hourCursor",
						style: { left: `${px(hover)}%` },
					}),
					hovered !== null && jsx("div", {
						key: "tip",
						className: "dp_tipAnchor",
						style: { left: `${px(hover)}%` },
						children: jsx("div", {
							className: "dp_tip",
							style: hover < 4 ? { left: "0" } : hover >= 20 ? { left: "0", transform: "translateX(-100%)" } : { left: "0", transform: "translateX(-50%)" },
							children: jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
								jsx("b", { children: `${hovered.key}:00` }),
								jsx("span", { children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
								jsx("span", { children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
								jsx("span", { children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) }),
							] }),
						}),
					}),
				] }) }),
				jsxs("div", { className: "dp_hourXlabels", children: ["00", "06", "12", "18", "23"].map((label) => jsx("span", { key: label, children: label })) }),
				jsxs("div", { className: "dp_legend", children: [
					jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendIn" }), t("legendInput")] }),
					jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendCache" }), t("legendCache")] }),
					jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendOut" }), t("legendOutput")] }),
					jsx("span", { className: "dp_axisNote", children: t("axisNote") }),
				] }),
			] });
		}

		/** Donut gauge for the cache hit share of input-side tokens. */
		function CacheRing({ totals, t }) {
			const rate = typeof totals.cacheHitRate === "number" && Number.isFinite(totals.cacheHitRate)
				? Math.max(0, Math.min(1, totals.cacheHitRate)) : null;
			const R = 48;
			const C = 2 * Math.PI * R;
			return jsxs("div", { className: "dp_ringBox", children: [
				jsxs("div", { className: "dp_ringWrap", role: "img", "aria-label": t("chipCache"), children: [
					jsxs("svg", { viewBox: "0 0 116 116", width: "116", height: "116", "aria-hidden": "true", children: [
						jsx("circle", { className: "dp_ringTrack", cx: "58", cy: "58", r: String(R), fill: "none", strokeWidth: "12" }),
						rate !== null && jsx("circle", {
							className: "dp_ringValue", cx: "58", cy: "58", r: String(R), fill: "none", strokeWidth: "12",
							strokeLinecap: "round", strokeDasharray: String(C),
							strokeDashoffset: String(C * (1 - rate)),
							transform: "rotate(-90 58 58)",
						}),
					] }),
					jsxs("div", { className: "dp_ringCenter", children: [
						jsx("span", { className: "dp_ringPct", children: rate === null ? "" : `${Math.round(rate * 100)}%` }),
						jsx("span", { className: "dp_ringLabel", children: t("chipCache") }),
					] }),
				] }),
				jsxs("div", { className: "dp_ringSide", children: [
					jsx("div", { className: "dp_ringSideTitle", children: t("cacheTitle") }),
					jsx("div", { className: "dp_ringSideRow", children: rate === null
						? jsx("span", { children: t("cacheNa") })
						: jsx("span", { children: fill(t("cacheOf"), { hit: fmtTokens(totals.cacheRead), total: fmtTokens((totals.cacheRead || 0) + (totals.input || 0) + (totals.cacheWrite || 0)) }) }) }),
					jsx("div", { className: "dp_ringSideRow", children: jsxs("span", { children: [
						jsx("span", { children: `${t("sideUncached")} ` }),
						jsx("b", { children: fmtTokens((totals.input || 0) + (totals.cacheWrite || 0)) }),
					] }) }),
					jsx("div", { className: "dp_ringSideRow", children: jsxs("span", { children: [
						jsx("span", { children: `${t("sideOutput")} ` }),
						jsx("b", { children: fmtTokens(totals.output || 0) }),
					] }) }),
				] }),
			] });
		}

		/** Horizontal share bars for per-model token splits. */
		function ModelBars({ models, t }) {
			const rows = (Array.isArray(models) ? models : [])
				.filter((m) => (m.input || 0) + (m.output || 0) + (m.cacheRead || 0) + (m.cacheWrite || 0) > 0)
				.slice(0, 6);
			const max = rows.reduce((m, r) => Math.max(m,
				(r.input || 0) + (r.cacheRead || 0) + (r.cacheWrite || 0) + (r.output || 0)), 0) || 1;
			return jsxs("div", { className: "dp_listBox", children: [
				jsx("div", { className: "dp_panelTitle", children: t("modelsTitle") }),
				rows.length === 0 && jsx("div", { className: "dp_ringSideRow", children: jsx("span", { children: t("cacheNa") }) }),
				rows.map((row, i) => {
					const total = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0) + (row.output || 0);
					const inSide = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0);
					return jsxs("div", { className: "dp_barRow", children: [
						jsx("span", { className: "dp_barRowName", title: row.model, children: row.model === "unknown" ? t("unknownModel") : row.model }),
						jsx("span", { className: "dp_barRowTrack", children: jsx("span", {
							className: `dp_barRowFill${i % 2 === 1 ? " dp_barRowFillAlt" : ""}`,
							style: { width: `${(total / max) * 100}%` },
						}) }),
						jsx("span", {
							className: "dp_barRowVal",
							title: `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(row.output || 0) })}`,
							children: fmtTokens(total),
						}),
					] }, row.model);
				}),
			] });
		}

		/** Ranked table of heaviest projects with share bars (row cap from payload `topProjects`). */
		function ProjectTable({ projects, topProjects, t }) {
			const cap = Number(topProjects) > 0 ? Math.floor(Number(topProjects)) : 8;
			const rows = (Array.isArray(projects) ? projects : []).slice(0, cap);
			const max = rows.reduce((m, r) => Math.max(m, r.total || 0), 0) || 1;
			return jsxs("div", { className: "dp_table", children: [
				jsxs("div", { className: "dp_tableRow dp_tableHead", children: [
					jsx("span", { children: t("colRank") }),
					jsx("span", { children: t("colProject") }),
					jsx("span", { style: { textAlign: "right" }, children: t("colSessions") }),
					jsx("span", { style: { textAlign: "right" }, children: t("colTokens") }),
					jsx("span", { children: "" }),
				] }),
				rows.map((row, i) => {
					const total = row.total || 0;
					const inSide = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0);
					const name = row.project === null || row.project === undefined || row.project === ""
						? t("noWorkspace") : row.project;
					return jsxs("div", { className: "dp_tableRow", children: [
						jsx("span", { className: "dp_tableRank", children: String(i + 1) }),
						jsx("span", { className: "dp_tableName", title: name, children: name }),
						jsx("span", { className: "dp_tableNum", children: String(row.sessions || 0) }),
						jsx("span", {
							className: "dp_tableTokens",
							title: `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(row.output || 0) })}`,
							children: fmtTokens(total),
						}),
						jsx("span", { className: "dp_tableTrack", children: jsx("span", { className: "dp_barRowTrack", children: jsx("span", { className: "dp_barRowFill", style: { width: `${(total / max) * 100}%` } }) }) }),
					] }, `${row.project ?? ""}#${i}`);
				}),
			] });
		}
		//#endregion

		//#region toolbar
		/** Range / project / model selector row driving the client-side view.
		 *  Project and model pickers embed a search input for large corpora. */
		function Toolbar({ rangeKey, setRangeKey, custom, setCustom, project, setProject, knownProjects, model, setModel, knownModels, t }) {
			const rangeOptions = [["1", t("range1")], ["7", t("range7")], ["30", t("range30")], ["90", t("range90")], ["365", t("range365")], ["custom", t("rangeCustom")]];
			const projectOptions = useMemo(() => [
				{ value: "", label: t("projectAll") },
				...knownProjects.map((name) => ({ value: name, label: name })),
			], [knownProjects, t]);
			const modelOptions = useMemo(() => [
				{ value: "", label: t("modelAll") },
				...knownModels.map((name) => ({ value: name, label: name === "unknown" ? t("unknownModel") : name })),
			], [knownModels, t]);
			return jsxs("div", { className: "dp_toolbar", children: [
				jsxs("div", { className: "dp_toolbarGroup", children: [
					jsx("span", { className: "dp_toolbarLabel", children: t("rangeLabel") }),
					jsx("div", { className: "dp_seg", role: "group", children: rangeOptions.map(([value, label]) => jsx("button", {
						type: "button",
						className: `dp_segBtn${rangeKey === value ? " dp_segBtnActive" : ""}`,
						onClick: () => setRangeKey(value),
						"aria-pressed": rangeKey === value,
						children: label,
					}, value)) }),
				] }),
				rangeKey === "custom" && jsx("div", { className: "dp_toolbarGroup", children: jsxs("div", { className: "dp_rangeBox", children: [
					jsx("input", {
						type: "date", className: "dp_dateInput", "aria-label": t("rangeFrom"),
						value: custom.from,
						max: custom.to || undefined,
						min: custom.to ? shiftDay(custom.to, -29) : undefined,
						onChange: (e) => setCustom((c) => ({ ...c, from: e.target.value })),
					}),
					jsx("input", {
						type: "date", className: "dp_dateInput", "aria-label": t("rangeToDate"),
						value: custom.to,
						min: custom.from || undefined,
						max: custom.from ? shiftDay(custom.from, 29) : undefined,
						onChange: (e) => setCustom((c) => ({ ...c, to: e.target.value })),
					}),
				] }) }),
				jsxs("div", { className: "dp_toolbarGroup", children: [
					jsx("span", { className: "dp_toolbarLabel", children: t("projectLabel") }),
					jsx(SearchPicker, {
						value: project,
						options: projectOptions,
						placeholder: t("projectAll"),
						displayName: (name) => name,
						onChange: setProject,
						t,
					}),
				] }),
				jsxs("div", { className: "dp_toolbarGroup", children: [
					jsx("span", { className: "dp_toolbarLabel", children: t("modelLabel") }),
					jsx(SearchPicker, {
						value: model,
						options: modelOptions,
						placeholder: t("modelAll"),
						displayName: (name) => (name === "unknown" ? t("unknownModel") : name),
						onChange: setModel,
						t,
					}),
				] }),
			] });
		}
		//#endregion

		//#region dashboard
		/** The full dashboard, shared by every surface (page / card / panel). */
		function PulseDashboard({ t, headerExtra }) {
			const [rangeKey, setRangeKey] = useState("7");
			/** Custom range defaults to the last seven days; the inputs are
			 *  editable and empty bounds fall back to the same defaults. */
			const [custom, setCustom] = useState(() => {
				const today = localDay(Date.now());
				return { from: shiftDay(today, -6), to: today };
			});
			const [project, setProject] = useState("");
			const [model, setModel] = useState("");

			const presetDays = RANGE_PRESETS[rangeKey] ?? 7;
			/** The heatmap presets render a daily GitHub-style grid instead of bars. */
			const heatmap = rangeKey === "90" || rangeKey === "365";
			const range = useMemo(() => {
				const today = localDay(Date.now());
				let from;
				let to;
				if (rangeKey !== "custom") {
					from = shiftDay(today, -(Math.min(1095, presetDays) - 1));
					to = today;
				} else {
					// Custom spans cap at 30 days; clampSpan swaps reversed pairs
					// and trims the start toward the end.
					const clamped = clampSpan(custom.from || shiftDay(today, -6), custom.to || today);
					from = clamped.from;
					to = clamped.to;
				}
				return { from, to };
			}, [rangeKey, custom, presetDays]);

			const stats = usePulseStats(range.from, range.to);
			const data = stats.data;

			const view = useMemo(() => {
				if (data === null) return null;
				let from = range.from;
				let to = range.to;
				if (from < data.fromDay) from = data.fromDay;
				if (to > data.toDay) to = data.toDay;
				return buildView(data.sessions, {
					granularity: "day",
					from,
					to,
					project,
					model,
					pricing: data.pricing,
				});
			}, [data, range, project, model]);

			/** Single-day views render the intraday hourly line chart. */
			const hourly = range.from === range.to;
			const hours = useMemo(() => {
				if (data === null || !hourly) return null;
				return hourlySeries(data.sessions, data.today, { project, model });
			}, [data, hourly, project, model]);

			const header = jsxs("div", { className: "dp_headerRow", children: [
				jsx("span", { className: "dp_title", children: t("title") }),
				jsx("span", { className: "dp_sub", children: data ? fill(t("generatedAt"), { t: fmtClock(data.generatedAt) }) : t("subtitle") }),
				jsx("button", {
					type: "button", className: "dp_iconBtn", onClick: () => stats.reload(),
					"aria-label": t("refresh"), title: t("refresh"), disabled: stats.busy,
					children: jsx(primitives.IconRefreshOutline16, { size: 15 }),
				}),
				headerExtra !== undefined && headerExtra !== null ? headerExtra : null,
			] });

			if (stats.status === "loading") {
				return jsxs("div", { className: "dp_root", children: [
					header,
					jsx("div", { className: "dp_skeleton dp_skeletonShort" }),
					jsx("div", { className: "dp_skeleton", children: jsx("div", { className: "dp_emptyChart", children: jsx("span", { children: t("loading") }) }) }),
				] });
			}
			if (stats.status === "error" && data === null) {
				return jsxs("div", { className: "dp_root", children: [
					header,
					jsxs("div", { className: "dp_stateBox", children: [
						jsx(primitives.IconWarningOutline16, { size: 22, className: "dp_stateIcon" }),
						jsx("span", { className: "dp_stateTitle", children: t("errorTitle") }),
						jsx("span", { className: "dp_stateBody", children: `${t("errorBody")} (${stats.error})` }),
						jsx("div", { className: "dp_retryRow", children: jsx(primitives.Button, { variant: "outline", size: "sm", onClick: () => stats.reload(), children: t("retry") }) }),
					] }),
				] });
			}
			if (data === null || view === null) return null;

			const totals = view.totals;
			const grandTotal = (totals.input || 0) + (totals.output || 0) + (totals.cacheRead || 0) + (totals.cacheWrite || 0);
			const corpusEmpty = (data.sessions ?? []).length === 0;
			if (corpusEmpty) {
				return jsxs("div", { className: "dp_root", children: [
					header,
					jsxs("div", { className: "dp_stateBox", children: [
						jsx(primitives.IconDataOutline16, { size: 22, className: "dp_stateIcon" }),
						jsx("span", { className: "dp_stateTitle", children: t("emptyTitle") }),
						jsx("span", { className: "dp_stateBody", children: t("emptyBody") }),
					] }),
				] });
			}
			if (!view.hasData) {
				return jsxs("div", { className: "dp_root", children: [
					header,
					jsx(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject, knownProjects: view.knownProjects, model, setModel, knownModels: view.knownModels, t }),
					jsxs("div", { className: "dp_stateBox", children: [
						jsx(primitives.IconSearchOutline16, { size: 20, className: "dp_stateIcon" }),
						jsx("span", { className: "dp_stateTitle", children: t("filteredTitle") }),
						jsx("span", { className: "dp_stateBody", children: t("filteredBody") }),
					] }),
				] });
			}

			const cost = view.cost;
			const bucketCount = view.buckets.length;
			return jsxs("div", { className: "dp_root", children: [
				header,
				jsx(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject, knownProjects: view.knownProjects, model, setModel, knownModels: view.knownModels, t }),
				jsxs("div", { className: "dp_chips", children: [
					jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipSessions") }),
						jsx("span", { className: "dp_chipValue", children: String(totals.sessions || 0) }),
						(totals.subagents || 0) > 0 && jsx("span", { className: "dp_chipNote", children: fill(t("chipSubagents"), { n: totals.subagents }) }),
					] }),
					jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipTurns") }),
						jsx("span", { className: "dp_chipValue", children: `${totals.turns || 0} / ${totals.toolCalls || 0}` }),
					] }),
					jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipTokens") }),
						jsx("span", { className: "dp_chipValue", children: fmtTokens(grandTotal) }),
						jsx("span", { className: "dp_chipNote", children: `${fill(t("inOf"), { n: fmtTokens((totals.input || 0) + (totals.cacheRead || 0) + (totals.cacheWrite || 0)) })} / ${fill(t("outOf"), { n: fmtTokens(totals.output || 0) })}` }),
					] }),
					jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipCache") }),
						jsx("span", { className: "dp_chipValue", children: typeof totals.cacheHitRate === "number" ? `${Math.round(totals.cacheHitRate * 100)}%` : t("cacheNa") }),
						jsx("span", { className: "dp_chipNote", children: fill(t("cacheOf"), { hit: fmtTokens(totals.cacheRead || 0), total: fmtTokens((totals.cacheRead || 0) + (totals.input || 0) + (totals.cacheWrite || 0)) }) }),
					] }),
					jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipCost") }),
						cost.configured === true
							? jsx("span", { className: "dp_chipValue dp_costOk", children: `${fmtCost(cost.total ?? 0)} ${cost.currency ?? ""}`.trim() })
							: jsx("span", { className: "dp_chipValue dp_costOff", children: t("costOff") }),
						cost.configured === true && ((cost.unpriced?.input) || 0) + ((cost.unpriced?.output) || 0) > 0
							? jsx("span", { className: "dp_chipNote", children: fill(t("unpriced"), { n: fmtTokens((cost.unpriced.input || 0) + (cost.unpriced.output || 0)) }) })
							: cost.configured !== true && jsx("span", { className: "dp_costNote", children: t("costHint") }),
					] }),
				] }),
				jsxs("div", { children: [
					jsxs("div", { className: "dp_panelTitle", children: [
						jsx("span", { children: t("trendTitle") }),
						jsx("span", { className: "dp_panelCount", children: hourly ? t("hourCount") : fill(t("dailyCount"), { n: bucketCount }) }),
					] }),
					jsx("div", { className: "dp_trendBody", children: hourly
						? jsx(HourlyChart, { hours, t })
						: heatmap
							? jsx(HeatmapChart, { buckets: view.buckets, today: data.today, t })
							: jsxs("div", { children: [
								jsx(BucketChart, { buckets: view.buckets, granularity: "day", today: data.today, t }),
								jsx(BucketXLabels, { buckets: view.buckets, granularity: "day", today: data.today, t }),
								jsxs("div", { className: "dp_legend", children: [
									jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendIn" }), t("legendInput")] }),
									jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendCache" }), t("legendCache")] }),
									jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendOut" }), t("legendOutput")] }),
								] }),
							] }) }),
				] }),
				jsxs("div", { className: "dp_twoCol", children: [
					jsx(CacheRing, { totals, t }),
					jsx(ModelBars, { models: view.models, t }),
				] }),
				jsxs("div", { children: [
					jsx("div", { className: "dp_panelTitle", children: t("projectsTitle") }),
					jsx(ProjectTable, { projects: view.projects, topProjects: data.topProjects, t }),
				] }),
			] });
		}
		//#endregion

		//#region slot components
		/** settings.section page - owner props `{close}`, locale `t` via inject face. */
		function PulseSection({ t }) {
			return jsx("div", { className: "dp_page", children: jsx(PulseDashboard, { t }) });
		}

		/** conversation.chat.commandview row for the `/pulse` command. */
		function PulseCommandCard({ t }) {
			return jsx("div", { className: "dp_card dp_variantCard", children: jsx(PulseDashboard, { t }) });
		}

		/** sidebar.footer.action - icon rail / labeled row that opens the overlay. */
		function PulseFooterAction({ wide, t }) {
			return jsx("button", {
				type: "button",
				className: `dp_footBtn${wide ? "" : " dp_footRail"}`,
				onClick: () => setOverlayOpen(true),
				"aria-label": t("openOverlay"),
				title: t("openOverlay"),
				children: wide
					? [jsx(primitives.IconDataOutline16, { key: "i", size: 16 }), jsx("span", { key: "l", children: t("nav") })]
					: jsx(primitives.IconDataOutline16, { size: 16 }),
			});
		}

		/** shell.overlay - floating pulse panel, closed by default. */
		function PulseOverlay({ t }) {
			const open = useSyncExternalStore(subscribeOverlay, () => overlayOpen);
			useEffect(() => {
				if (!open) return;
				const onKey = (e) => { if (e.key === "Escape") setOverlayOpen(false); };
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [open]);
			if (!open) return null;
			const closeBtn = jsx("button", {
				type: "button", className: "dp_iconBtn",
				onClick: () => setOverlayOpen(false), "aria-label": t("close"), title: t("close"),
				children: jsx(primitives.IconCloseOutline16, { size: 14 }),
			});
			return jsx("div", { className: "dp_overlaySeat", children: jsx("div", { className: "dp_overlayCard", role: "dialog", "aria-label": t("title"), children: jsx(PulseDashboard, { t, headerExtra: closeBtn }) }) });
		}
		//#endregion

		//#region plugin
		/** Required services (cordis fiber inject). */
		const inject = ["slots", "locale"];

		/**
		 * Register the pulse surfaces: a settings page, the `/pulse` chat card,
		 * a sidebar foot action, and the floating overlay it opens.
		 * @param {object} ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-pulse: copy dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section", id: "pulse", order: 25, label: () => t("nav"), inject: () => ({ t }),
			}, PulseSection));
			ctx.slots.inject("conversation.chat.commandview", () => ctx.slots.register({
				name: "conversation.chat.commandview", key: "pulse", inject: () => ({ t }),
			}, PulseCommandCard));
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action", id: "pulse", order: 5, label: () => t("nav"), inject: () => ({ t }),
			}, PulseFooterAction));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay", id: "pulse", order: 10, inject: () => ({ t }),
			}, PulseOverlay));
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
