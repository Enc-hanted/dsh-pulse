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
		const css = `.dp_root{--dp-gap:12px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;display:flex;flex-direction:column;gap:var(--dp-gap);color-scheme:light}body[data-ds-dark-theme] .dp_root{color-scheme:dark}.dp_headerRow{display:flex;align-items:center;gap:6px;min-width:0}.dp_title{font-size:15px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary);flex:none}.dp_sub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.dp_iconBtn{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);background:transparent;border:none;border-radius:999px;cursor:pointer}.dp_iconBtn:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dp_iconBtn:disabled{opacity:.4;cursor:default}.dp_toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}.dp_toolbarGroup{display:flex;align-items:center;gap:6px;min-width:0}.dp_toolbarLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;flex:none}.dp_seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-base)}.dp_segBtn{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;padding:4px 10px;cursor:pointer}.dp_segBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_segBtnActive{background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent);color:var(--dsw-alias-label-primary);font-weight:600}.dp_segBtnActive:hover{background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 24%,transparent)}.dp_dateInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;font-size:12px;line-height:18px;padding:4px 8px;max-width:180px}.dp_rangeBox{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);padding:2px 6px}.dp_rangeBox .dp_dateInput{border:none;background:transparent;padding:2px 2px;max-width:140px}.dp_dateInput{max-width:140px}.dp_chips{display:flex;flex-wrap:wrap;gap:8px}.dp_chip{flex:1 1 150px;min-width:140px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}.dp_chipLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;letter-spacing:.02em}.dp_chipValue{font-size:17px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.dp_chipNote{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.dp_costOk{color:var(--dsw-alias-state-success-primary)}.dp_costOff{color:var(--dsw-alias-label-tertiary);font-weight:500}.dp_panelTitle{display:flex;align-items:baseline;gap:8px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;line-height:18px;margin:2px 0 8px}.dp_panelCount{color:var(--dsw-alias-label-tertiary);font-weight:400}.dp_chartOuter{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:12px 14px 8px}.dp_chartGrid{position:relative;height:168px;margin-top:10px;display:flex;align-items:flex-end;gap:2px}.dp_gridline{position:absolute;left:0;right:0;border-top:1px dashed var(--dsw-alias-border-l2);pointer-events:none}.dp_gridlabel{position:absolute;right:0;transform:translateY(-50%);font-size:10px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-tip);padding:0 3px;pointer-events:none;font-variant-numeric:tabular-nums}.dp_gridlabelAxisL{left:0;right:auto;color:var(--dsw-alias-state-business-tertiary);color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_axisNote{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;margin-left:auto}.dp_col{position:relative;flex:1 1 0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;cursor:default}.dp_colHit{position:absolute;inset:-3px 0 -1px;border-radius:4px;background:transparent}.dp_col:hover .dp_colHit{background:var(--dsw-interactive-bg-hover-accent)}.dp_bar{display:flex;flex-direction:column;justify-content:flex-end;width:100%;min-height:0;border-radius:3px 3px 0 0;overflow:hidden;position:relative;z-index:1}.dp_barNonzero{min-height:2px}.dp_segIn{background:var(--dsw-alias-state-business-primary);width:100%}.dp_segCache{background:var(--dsw-alias-state-business-tertiary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary));width:100%}.dp_segOut{background:var(--dsw-alias-state-success-primary);width:100%}.dp_barToday{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:2px;border-radius:4px 4px 0 0}.dp_xlabels{display:flex;gap:2px;margin-top:6px}.dp_xlabel{flex:1 1 0;text-align:center;font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}.dp_xlabelToday{color:var(--dsw-alias-label-secondary);font-weight:600}.dp_emptyChart{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:12px}.dp_legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.dp_legendDot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:-1px}.dp_legendIn{background:var(--dsw-alias-state-business-primary)}.dp_legendCache{background:var(--dsw-alias-state-business-tertiary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_legendOut{background:var(--dsw-alias-state-success-primary)}.dp_tip{position:absolute;bottom:calc(100% + 6px);z-index:3;pointer-events:none;background:var(--dsw-alias-tooltip-bg);color:var(--dsw-alias-label-primary-inverted);border-radius:8px;padding:8px 10px;font-size:11px;line-height:17px;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.18)}.dp_tipAnchor{position:absolute;top:0;bottom:0;width:0;pointer-events:none}.dp_twoCol{display:grid;grid-template-columns:auto 1fr;gap:var(--dp-gap);align-items:start}@media (max-width:640px){.dp_twoCol{grid-template-columns:1fr}}.dp_ringBox{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:14px 16px;display:flex;align-items:center;gap:16px}.dp_ringWrap{position:relative;width:116px;height:116px;flex:none}.dp_ringTrack{stroke:var(--dsw-alias-border-l2)}.dp_ringValue{stroke:var(--dsw-alias-state-business-primary);transition:stroke-dashoffset .6s cubic-bezier(.25,.7,.3,1)}.dp_ringCenter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}.dp_ringPct{font-size:20px;font-weight:700;line-height:26px;font-variant-numeric:tabular-nums}.dp_ringLabel{font-size:10px;color:var(--dsw-alias-label-tertiary)}.dp_ringSide{display:flex;flex-direction:column;gap:6px;min-width:0}.dp_ringSideTitle{font-weight:600;font-size:12px;line-height:18px}.dp_ringSideRow{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;display:flex;gap:6px;align-items:baseline;font-variant-numeric:tabular-nums}.dp_ringSideRow b{color:var(--dsw-alias-label-secondary);font-weight:600;font-size:12px}.dp_listBox{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:12px 14px;display:flex;flex-direction:column;gap:9px;min-width:0}.dp_barRow{display:grid;grid-template-columns:minmax(64px,1.4fr) 3fr minmax(70px,.8fr);gap:10px;align-items:center;font-size:12px;line-height:17px;min-width:0}.dp_barRowName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}.dp_barRowTrack{position:relative;height:8px;border-radius:4px;background:var(--dsw-alias-bg-skeleton);overflow:hidden}.dp_barRowFill{position:absolute;inset:0 auto 0 0;border-radius:4px;background:var(--dsw-alias-state-business-primary)}.dp_barRowFillAlt{background:var(--dsw-alias-state-success-primary)}.dp_barRowVal{text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}.dp_table{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);overflow:hidden}.dp_tableRow{display:grid;grid-template-columns:28px minmax(80px,1.6fr) minmax(52px,.7fr) minmax(70px,1fr) 3fr;gap:8px;align-items:center;padding:8px 14px;font-size:12px;line-height:17px;min-width:0}.dp_tableRow:nth-child(odd){background:var(--dsw-interactive-bg-hover)}.dp_tableHead{background:transparent!important;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:500}.dp_tableRank{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_tableName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-weight:500}.dp_tableNum{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}.dp_tableTokens{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);white-space:nowrap}.dp_tableTrack{height:6px}.dp_tableTrack .dp_barRowTrack{height:6px;border-radius:3px}.dp_tableTrack .dp_barRowFill{border-radius:3px}.dp_stateBox{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}.dp_stateTitle{font-size:14px;font-weight:600}.dp_stateBody{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;max-width:420px}.dp_stateIcon{color:var(--dsw-alias-label-tertiary)}.dp_skeleton{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);height:220px;position:relative;overflow:hidden}.dp_skeleton::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,var(--dsw-alias-bg-skeleton),transparent);animation:dp_shimmer 1.4s infinite}.dp_skeletonShort{height:56px}@keyframes dp_shimmer{to{transform:translateX(100%)}}.dp_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:12px;padding:14px 16px;max-width:100%}.dp_variantCard{--dp-gap:10px}.dp_page{padding:2px 2px 16px}.dp_overlaySeat{position:fixed;inset:0;pointer-events:none;z-index:60}.dp_overlayCard{position:absolute;right:20px;bottom:20px;width:min(880px,calc(100vw - 48px));max-height:min(78vh,760px);overflow:auto;pointer-events:auto;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.22);padding:16px 18px 20px}.dp_footBtn{display:inline-flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:6px 10px;border:none;background:transparent;border-radius:8px;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer}.dp_footBtn:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dp_footRail{width:40px;min-height:32px;justify-content:center;padding:6px}.dp_costNote{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}.dp_retryRow{display:flex;gap:8px}.dp_hcWrap{display:flex;gap:8px;min-width:0;height:184px}.dp_hcGutter{flex:none;display:grid;grid-template-rows:16px repeat(7,minmax(0,1fr));color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1}.dp_hcGutter>span{display:flex;align-items:center;justify-content:flex-end;padding-right:4px}.dp_hcBody{flex:1;min-width:0;display:flex;flex-direction:column}.dp_hcMonths{flex:none;display:grid;column-gap:2px;height:16px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);overflow:hidden}.dp_hcMonths>span{overflow:visible;white-space:nowrap;min-width:0}.dp_hcGrid{flex:1;min-height:0;display:grid;gap:2px;grid-template-rows:repeat(7,minmax(0,1fr))}.dp_hcCell{appearance:none;border:none;padding:0;margin:0;min-width:0;border-radius:2px;background:var(--dsw-alias-bg-skeleton);cursor:pointer}.dp_hcCell:hover,.dp_hcCell:focus-visible{outline:1px solid var(--dsw-alias-border-l4)}.dp_hcFuture{opacity:.35;cursor:default}.dp_hcToday{outline:1px solid var(--dsw-alias-state-business-primary)}.dp_hcL1{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}.dp_hcL2{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 34%,transparent)}.dp_hcL3{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,transparent)}.dp_hcL4{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 82%,transparent)}.dp_hcDetail{display:flex;align-items:center;gap:10px;min-height:20px;margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}.dp_hcDetail b{font-weight:600;color:var(--dsw-alias-label-primary)}.dp_hcScale{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.dp_hcSwatch{width:10px;height:10px;border-radius:2px;background:var(--dsw-alias-bg-skeleton);display:inline-block}.dp_picker{position:relative;min-width:0}.dp_pickerBtn{display:flex;align-items:center;gap:6px;max-width:200px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;font-size:12px;line-height:18px;padding:4px 8px;cursor:pointer}.dp_pickerBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_pickerValue{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_pickerCaret{color:var(--dsw-alias-label-tertiary);flex:none}.dp_pickerMenu{position:absolute;z-index:30;top:calc(100% + 4px);left:0;width:224px;max-height:280px;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay);box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden}.dp_pickerSearch{margin:8px 8px 0;flex:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;font-size:12px;line-height:18px;padding:4px 8px}.dp_pickerSearch:focus{outline:1px solid var(--dsw-alias-state-business-primary)}.dp_pickerList{overflow-y:auto;padding:4px;margin-top:4px}.dp_pickerItem{display:block;width:100%;text-align:left;border:none;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;padding:4px 8px;border-radius:6px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_pickerItem:hover{background:var(--dsw-interactive-bg-hover)}.dp_pickerItemActive{font-weight:600;background:var(--dsw-interactive-bg-hover);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent)}.dp_pickerEmpty{padding:8px 10px;color:var(--dsw-alias-label-tertiary);font-size:12px}.dp_pickerCaret{display:inline-flex;color:var(--dsw-alias-label-tertiary);flex:none}.dp_trendBody{min-height:204px;display:flex;flex-direction:column}.dp_hourGrid{position:relative;height:168px;margin-top:10px}.dp_hourSvg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.dp_hourLine{fill:none;stroke-width:1.5;vector-effect:non-scaling-stroke}.dp_hourLineIn{stroke:var(--dsw-alias-state-business-primary)}.dp_hourLineCache{stroke:var(--dsw-alias-state-business-tertiary);stroke:color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))}.dp_hourLineOut{stroke:var(--dsw-alias-state-success-primary)}.dp_hourHover{position:absolute;top:0;bottom:0;cursor:crosshair}.dp_hourCursor{position:absolute;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l4);pointer-events:none}.dp_hourXlabels{display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_setPanel{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2)}.dp_setTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}.dp_setSub{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:18px}.dp_setGrid{display:flex;flex-direction:column;gap:8px}.dp_setRow{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}.dp_setField{display:flex;flex-direction:column;gap:4px;min-width:0}.dp_setLabel{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}.dp_setInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:30px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);border-radius:6px;padding:0 8px;min-width:64px;width:100%;box-sizing:border-box}.dp_setInput:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.dp_setModel{min-width:140px;flex:1}.dp_setCurrency{min-width:74px;width:74px}.dp_setActions{display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap}.dp_setMsg{font-size:12px;line-height:16px}.dp_setMsgOk{color:var(--dsw-alias-state-success-primary)}.dp_setMsgErr{color:var(--dsw-alias-label-error)}.dp_setSwitch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--dsw-alias-label-primary)}.dp_setSwitch input{accent-color:var(--dsw-alias-brand-primary)}.dp_setRemove{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:12px;padding:4px 6px;border-radius:6px}.dp_setRemove:hover:not(:disabled){color:var(--dsw-alias-label-error)}.dp_setRemove:disabled{cursor:default;opacity:.5}.dp_pageHead{display:flex;align-items:center;gap:8px}.dp_backBtn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;padding:4px 10px;border-radius:8px;cursor:pointer}.dp_backBtn:hover{background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dp_pageTitle{font-size:15px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary)}.dp_setGroup{display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;line-height:18px}.dp_setGroup::after{content:"";flex:1;border-top:1px solid var(--dsw-alias-border-l1)}.dp_setModelInfo{display:flex;flex-direction:column;gap:1px;min-width:170px;flex:1;justify-content:flex-end;padding-bottom:3px}.dp_modelId{font-size:12px;line-height:17px;color:var(--dsw-alias-label-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_modelName{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dp_setSel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:30px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);border-radius:6px;padding:0 6px;min-width:64px;box-sizing:border-box}.dp_peakSub{margin-top:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:8px}.dp_peakGrid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px}.dp_hourCell{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;line-height:14px;height:24px;padding:0;border-radius:5px;cursor:pointer;font-variant-numeric:tabular-nums}.dp_hourCell:hover:not(:disabled){border-color:var(--dsw-alias-border-l4)}.dp_hourCellOn{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 26%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,transparent);color:var(--dsw-alias-label-primary);font-weight:600}.dp_hourCell:disabled{cursor:default;opacity:.5}.dp_setLink{border:none;background:transparent;color:var(--dsw-alias-state-business-primary);cursor:pointer;font:inherit;font-size:11px;line-height:16px;padding:0}.dp_setLink:hover{text-decoration:underline}.dp_miniBtn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:16px;padding:3px 8px;border-radius:7px;cursor:pointer}.dp_miniBtn:hover:not(:disabled){background:var(--dsw-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dp_miniBtn:disabled{cursor:default;opacity:.5}.dp_miniBtnOn{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);color:var(--dsw-alias-label-primary);font-weight:600}.dp_setFxRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dp_setFxInput{width:74px}.dp_setPreview{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}.dp_chipValueBtn{font:inherit;font-size:17px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-tertiary);background:none;border:none;padding:0;cursor:pointer;text-align:left;text-decoration:underline;text-underline-offset:3px;font-variant-numeric:tabular-nums}.dp_chipValueBtn:hover{color:var(--dsw-alias-label-secondary)}.dp_chipNoteBtn{border:none;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:11px;line-height:16px;padding:0;text-align:left;text-decoration:underline;text-underline-offset:2px}.dp_chipNoteBtn:hover{color:var(--dsw-alias-label-secondary)}@media (max-width:560px){.dp_peakGrid{grid-template-columns:repeat(6,minmax(0,1fr))}}.dp_costLine{fill:none;stroke:var(--dsw-alias-state-business-primary);stroke-width:1.8;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}.dp_costLinePeak{fill:none;stroke:var(--dsw-alias-state-success-primary);stroke-width:1.3;vector-effect:non-scaling-stroke;stroke-linejoin:round}.dp_costArea{fill:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent)}.dp_costDot{position:absolute;width:8px;height:8px;border-radius:50%;border:2px solid var(--dsw-specific-tip);background:var(--dsw-alias-state-business-primary);transform:translate(-50%,-50%);pointer-events:none;z-index:2}.dp_sparkCard{gap:3px}.dp_sparkHead{display:flex;align-items:baseline;gap:8px;min-width:0}.dp_sparkCount{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;font-variant-numeric:tabular-nums;white-space:nowrap}.dp_sparkBody{position:relative;height:54px;margin-top:2px}.dp_balanceBar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);padding:8px 14px}.dp_balanceDot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}.dp_balanceDotOff{background:var(--dsw-alias-label-error)}.dp_balanceLabel{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);letter-spacing:.02em}.dp_balanceTotal{font-size:15px;line-height:22px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}.dp_balanceSub{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_balanceWarn{font-size:11px;line-height:16px;color:var(--dsw-alias-label-error);font-weight:600}.dp_balanceTime{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_costLineActual{fill:none;stroke:var(--dsw-alias-label-error);stroke-width:1.2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}.dp_barRowCost{display:block;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_cmpControls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.dp_cmpControl{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:8px 10px;background:var(--dsw-alias-bg-layer-3)}.dp_cmpLabel{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}.dp_cmpValue{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);font-weight:600}.dp_cmpRow{display:flex;align-items:center;gap:8px}.dp_cmpRange{flex:1;min-width:0;accent-color:var(--dsw-alias-state-business-primary);height:4px}.dp_cmpNum{width:76px;height:30px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;padding:0 6px;font-size:12px;font-variant-numeric:tabular-nums;box-sizing:border-box}.dp_cmpPresets{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.dp_cmpVis{accent-color:var(--dsw-alias-state-business-primary);width:14px;height:14px;flex:none;cursor:pointer;align-self:center}.dp_cmpRate{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;white-space:nowrap;min-width:64px;padding:6px 8px;border:1px solid transparent;border-radius:6px}.dp_cmpRuleTag{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 6px;white-space:nowrap;display:inline-flex}.dp_cmpModelName{display:flex;align-items:baseline;gap:6px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap}.dp_cmpCards{display:flex;flex-direction:column;gap:8px}.dp_cmpCard{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:10px 14px;background:var(--dsw-alias-bg-layer-2)}.dp_cmpBest{border-color:var(--dsw-alias-state-success);background:color-mix(in srgb,var(--dsw-alias-state-success) 8%,transparent)}.dp_cmpCardInfo{display:flex;flex-direction:column;gap:2px;min-width:0}.dp_cmpCardHead{display:flex;align-items:center;gap:8px}.dp_cmpCardName{font-weight:600;font-size:13px}.dp_cmpBadge{background:var(--dsw-alias-state-success);color:#fff;font-size:10px;font-weight:600;padding:1px 8px;border-radius:999px}.dp_cmpCardDetail{display:flex;flex-direction:column;gap:2px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_cmpCardRight{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}.dp_cmpCardCost{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}.dp_cmpCardCost small{font-size:11px;font-weight:400;color:var(--dsw-alias-label-tertiary);margin-left:2px}.dp_cmpBarOuter{width:110px;height:4px;border-radius:2px;background:var(--dsw-interactive-bg-hover);overflow:hidden}.dp_cmpBar{height:100%;border-radius:2px;background:var(--dsw-alias-state-business-primary)}@media (max-width:640px){.dp_cmpControls{grid-template-columns:1fr}}.dp_budgetInput{width:90px;height:26px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;padding:0 8px;font:inherit;font-size:12px;font-variant-numeric:tabular-nums}.dp_budgetInputRow{display:inline-flex;align-items:center;gap:6px}.dp_budgetTrack{flex:1 1 100%;height:6px;border-radius:3px;background:var(--dsw-interactive-bg-hover);overflow:hidden}.dp_budgetFill{height:100%;border-radius:3px;background:var(--dsw-alias-state-business-primary);transition:width .2s}.dp_budgetFillOver{background:var(--dsw-alias-label-error)}.dp_runway{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dp_runwayLow{font-size:11px;line-height:16px;color:var(--dsw-alias-label-error);font-weight:600;font-variant-numeric:tabular-nums}.dp_footBalance{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);border-radius:999px;padding:1px 8px;white-space:nowrap}.dp_dateBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;font:inherit;font-size:12px;font-variant-numeric:tabular-nums;cursor:pointer}.dp_dateBtn:hover{background:var(--dsw-interactive-bg-hover)}.dp_calOverlay{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}.dp_calCard{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;max-width:320px;width:100%}.dp_calHead{display:flex;align-items:center;justify-content:space-between}.dp_calNav{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:14px;line-height:1}.dp_calMonth{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.dp_calGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.dp_calDow{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);text-align:center;padding:2px 0}.dp_calCell{height:30px;border:none;background:transparent;color:var(--dsw-alias-label-primary);border-radius:6px;cursor:pointer;font-size:12px;font-variant-numeric:tabular-nums}.dp_calCell:hover{background:var(--dsw-interactive-bg-hover)}.dp_calEmpty{cursor:default}.dp_calIn{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent)}.dp_calStart,.dp_calEnd{background:var(--dsw-alias-state-business-primary);color:#fff;font-weight:600}.dp_calToday{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}.dp_calFoot{text-align:center}.dp_page > .dp_headerRow{margin-bottom:12px}.dp_panelsGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px 12px}`;
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
			calWeek: "一,二,三,四,五,六,日",
			calPickStart: "选择起始日期",
			calPickEnd: "选择结束日期（早于起点则交换）",
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
			costGoSet: "未配置单价 · 点此定价",
			fxNote: "含 USD 按 {r} 折算",
			unpriced: "{n} token 未定价",
			balanceTitle: "官方余额",
			balanceGranted: "赠送 {v}",
			balanceTopped: "充值 {v}",
			balanceUnavailable: "已欠费",
			balanceAt: "更新于 {t}",
			balanceFailed: "查询失败：{err}",
			actualTip: "官方扣费 {v} CNY",
			actualUnknown: "官方扣费 · 当日有充值，未知",
			trendTitle: "用量走势",
			costTrend: "费用走势",
			costTipPeak: "高峰 {v} CNY",
			costTipOff: "空闲 {v} CNY",
			costTipTotal: "合计 {v} CNY",
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
			costEnabledLabel: "启用费用估算",
			costEnabledHint: "关闭后，仪表盘的费用估算卡片与 /pulse 命令的费用行将隐藏。",
			configure: "定价与费用",
			back: "返回",
			setTitle: "定价与费用",
			setSub: "模型列表取自设置的模型目录，只需填写单价；总额统一按人民币显示。保存立即生效并持久化。",
			setModel: "模型",
			setInput: "输入",
			setCache: "缓存命中",
			setOutput: "输出",
			setPeakIn: "高峰输入",
			setPeakCache: "高峰缓存",
			setPeakOut: "高峰输出",
			setCurrency: "币种",
			setPeakNote: "单价按每百万 token 计（币种在设置页统一管理）；缓存命中价留空表示与输入价相同。",
			setPeakToggle: "峰谷计价",
			setPeakHours: "高峰时段（北京时间，点选小时格）",
			setPeakReset: "恢复官方时段",
			setGroupUsage: "使用中 · 不在模型目录",
			setGroupCustom: "自定义规则",
			setCatalogEmpty: "未读取到模型目录（宿主无 llm 服务）；显示使用中的模型与已保存规则，也可手动添加。",
			setFxLabel: "美元汇率",
			setFxHint: "1 USD 兑 CNY；美元单价模型按此汇率折算进人民币总额。",
			setPreview: "近 {n} 天费用预览",
			setAdd: "手动添加模型",
			setRemove: "删除",
			setSave: "保存",
			setReset: "恢复内置默认",
			setRefresh: "刷新目录",
			setOfficialReset: "恢复官方价",
			setDupModel: "存在重复的模型 ID，请删除重复行后重试",
			setRefold: "高峰时段已变更，正在后台重算历史，首次刷新可能稍慢。",
			setSaved: "已保存，费用估算已更新",
			setFailed: "保存失败：{err}",
			setBadNumber: "存在无效数字，请检查后重试",
			setNotWritable: "当前环境未挂载设置存储，无法从面板修改；可在 profile 的 cordis.patch.yml 中配置 pulse 的 pricing / costEnabled / usdToCny。",
			setLoading: "正在加载设置…",
			setHint: "官方 DeepSeek 价已内置；第三方模型填好单价即可。完全没填的行保存时不会写入。",
			compare: "方案对比",
			cmpSub: "对比不同费率方案在相同用量下的总成本。场景参数可来自真实用量，也可手动调整。",
			cmpInput: "总输入（百万）",
			cmpRatio: "输出 / 输入比例（%）",
			cmpHit: "缓存命中率（%）",
			cmpReal: "真实场景",
			cmpAvg: "经典场景",
			cmpLong: "多输出场景",
			cmpMassive: "高命中场景",
			cmpBased: "基于 {from} ~ {to} 的真实用量",
			cmpNoData: "暂无用量数据",
			cmpName: "方案名称",
			cmpMiss: "未命中输入",
			cmpHitIn: "命中输入",
			cmpOut: "输出",
			cmpAdd: "添加方案",
			cmpBest: "最优",
			cmpDetail: "命中 {hit} · 未命中 {miss} · 输出 {out}",
			cmpHint: "方案来自定价与费用页的有效规则，费率改动自动生效；临时方案只存在本页。单价按每百万 token 计，成本 = 未命中 × 未命中价 + 命中 × 命中价 + 输出 × 输出价。",
			cmpTierOffpeak: "谷时价",
			cmpTierPeak: "高峰价",
			cmpFromRules: "来自定价规则",
			cmpShowAll: "全部显示",
			cmpEmpty: "没有可见的方案",
			cmpManual: "临时方案",
			cmpRates: "费率",
			cmpTierHint: "高峰 / 谷时计价",
			cmpUnit: "CNY",
			panels: "设置",
			panelsSub: "选择在用量观测台中显示哪些面板。",
			panelGroup: "显示面板",
			curLabel: "计价币种",
			curHint: "所有模型统一按此币种计价；USD 单价按汇率折算为 CNY 总额显示。",
			panelChips: "概览统计",
			panelBalance: "官方余额",
			panelTrend: "用量走势",
			panelCache: "缓存命中",
			panelModels: "模型分布",
			panelProjects: "项目排行",
			panelCost: "费用估算与走势",
			panelBudget: "月度预算",
			panelFootBalance: "侧栏按钮显示余额",
			budgetTitle: "月度预算",
			budgetSet: "设置预算",
			budgetUsed: "本月已用",
			budgetForecast: "月底预计",
			budgetAvg: "日均 {v}",
			budgetLeftDays: "剩 {n} 天",
			budgetEmpty: "设置预算后显示进度和月底预测。",
			budgetOver: "已超预算",
			budgetModeAll: "全周",
			budgetModeWeekdays: "工作日",
			budgetModeSingle: "单休",
			runwayDays: "余额预估 {n} 天",
			runwayLow: "余额不足 {n} 天",
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
			calWeek: "Mo,Tu,We,Th,Fr,Sa,Su",
			calPickStart: "Pick a start date",
			calPickEnd: "Pick an end date (earlier picks swap)",
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
			costGoSet: "Rates not set · click to configure",
			fxNote: "incl. USD at {r}",
			unpriced: "{n} tokens unpriced",
			balanceTitle: "Official balance",
			balanceGranted: "granted {v}",
			balanceTopped: "topped up {v}",
			balanceUnavailable: "unavailable",
			balanceAt: "updated {t}",
			balanceFailed: "query failed: {err}",
			actualTip: "Actual spend {v} CNY",
			actualUnknown: "Actual spend · topped up, unknown",
			trendTitle: "Usage trend",
			costTrend: "Cost trend",
			costTipPeak: "Peak {v} CNY",
			costTipOff: "Off-peak {v} CNY",
			costTipTotal: "Total {v} CNY",
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
			setTitle: "Pricing & cost",
			setSub: "Model rows come from the configured model catalog — just fill in rates; totals display in CNY. Saves apply immediately and persist.",
			costEnabledLabel: "Enable cost estimates",
			costEnabledHint: "When off, the dashboard cost chip and the /pulse command cost line are hidden.",
			configure: "Pricing & cost",
			back: "Back",
			setModel: "Model",
			setInput: "Input",
			setCache: "Cache hit",
			setOutput: "Output",
			setPeakIn: "Peak in",
			setPeakCache: "Peak cache",
			setPeakOut: "Peak out",
			setCurrency: "Currency",
			setPeakNote: "Rates are per million tokens (the currency is set on the Settings page); an empty cache-hit rate falls back to the input rate.",
			setPeakToggle: "Peak pricing",
			setPeakHours: "Peak hours (Beijing time — click hour cells)",
			setPeakReset: "Official windows",
			setGroupUsage: "In use · not in the catalog",
			setGroupCustom: "Custom rules",
			setCatalogEmpty: "No model catalog available (no llm service on the host); showing models in use and saved rules — manual add works too.",
			setFxLabel: "USD rate",
			setFxHint: "1 USD in CNY; USD-priced models convert into the CNY total at this rate.",
			setPreview: "Cost preview · last {n} days",
			setAdd: "Add model manually",
			setRemove: "Remove",
			setSave: "Save",
			setReset: "Restore defaults",
			setRefresh: "Refresh catalog",
			setOfficialReset: "Official rates",
			setDupModel: "Duplicate model ids — remove the duplicated rows and retry",
			setRefold: "Peak hours changed — history is re-folding in the background; the first refresh may be slower.",
			setSaved: "Saved — cost estimates updated",
			setFailed: "Save failed: {err}",
			setBadNumber: "Invalid number entered, please fix and retry",
			setNotWritable: "No settings storage in this environment; configure pricing / costEnabled / usdToCny for pulse in the profile cordis.patch.yml instead.",
			setLoading: "Loading settings…",
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
			cmpDetail: "hit {hit} · miss {miss} · out {out}",
			cmpHint: "Plans come from the effective pricing rules and follow rate edits; temporary plans live in this page only. Rates per million tokens; cost = miss × miss rate + hit × hit rate + out × out rate.",
			cmpTierOffpeak: "Off-peak",
			cmpTierPeak: "Peak",
			cmpFromRules: "from pricing rules",
			cmpShowAll: "Show all",
			cmpEmpty: "No visible plans",
			cmpManual: "Temporary plan",
			cmpRates: "rates",
			cmpTierHint: "Peak / off-peak pricing",
			cmpUnit: "CNY",
			panels: "Settings",
			panelsSub: "Choose which panels the observatory shows.",
			panelGroup: "Panels",
			curLabel: "Pricing currency",
			curHint: "All models price in this currency; USD rates convert to the CNY total at the exchange rate.",
			panelChips: "Overview stats",
			panelBalance: "Official balance",
			panelTrend: "Usage trend",
			panelCache: "Cache hit rate",
			panelModels: "Model distribution",
			panelProjects: "Project ranking",
			panelCost: "Cost estimate & trend",
			panelBudget: "Monthly budget",
			panelFootBalance: "Balance on sidebar button",
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

		/** Per-model row: window totals plus the peak/off-peak tier split. */
		const EMPTY_MODEL_ROW = () => ({ ...EMPTY_TOKENS(), peak: EMPTY_TOKENS(), offpeak: EMPTY_TOKENS() });

		function addTokens(bucket, tokens) {
		  bucket.input += tokens.input || 0;
		  bucket.output += tokens.output || 0;
		  bucket.cacheRead += tokens.cacheRead || 0;
		  bucket.cacheWrite += tokens.cacheWrite || 0;
		}

		/** Fold one day's per-model tokens into a model row with its tier split.
		 *  `tier` is the record's `tiersByDay[day][model]` split; a legacy record
		 *  without one prices the whole day at the off-peak rates. */
		function addDayModel(row, tokens, tier) {
		  addTokens(row, tokens);
		  if (tier === null || tier === undefined) {
		    addTokens(row.offpeak, tokens);
		    return;
		  }
		  for (const kind of ["input", "output", "cacheRead", "cacheWrite"]) {
		    row.peak[kind] += tier[kind]?.peak || 0;
		    row.offpeak[kind] += tier[kind]?.offpeak || 0;
		  }
		}

		/**
		 * Fold windowed session records into one dashboard view.
		 *
		 * Records carry per-day maps (`byDay`, `modelsByDay`, `hoursByDay`,
		 * `tiersByDay`, `turnsByDay`, `toolCallsByDay`) - the host slices the
		 * projection state to
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
		 * @param {Array<{model: string, input: number, cacheRead?: number, output: number, currency?: string, peak?: {input?: number, cacheRead?: number, output?: number}}>} [options.pricing]
		 * @param {{usdToCny?: number}} [options.fx] - USD→CNY rate for the unified cost display.
		 * @returns {{buckets: Array, totals: object, models: Array, projects: Array, cost: object, hasData: boolean, knownProjects: string[], knownModels: string[]}}
		 */
		function buildView(sessions, { granularity = "day", from, to, project = "", model = "", pricing = [], fx = {} }) {
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
		          const row = inRangeModels.get(modelName) ?? EMPTY_MODEL_ROW();
		          addDayModel(row, tokens, record.tiersByDay?.[day]?.[modelName]);
		          inRangeModels.set(modelName, row);
		        }
		      } else if (dayModels !== undefined && dayModels[modelFilter] !== undefined) {
		        // Model-filtered: only the selected model's tokens flow anywhere,
		        // so buckets, chips, projects and the cost chip all agree.
		        const filtered = dayModels[modelFilter];
		        addTokens(inRange, filtered);
		        const idx = index.get(bucketOf(granularity, day));
		        if (idx !== undefined) addTokens(buckets[idx], filtered);
		        const row = inRangeModels.get(modelFilter) ?? EMPTY_MODEL_ROW();
		        addDayModel(row, filtered, record.tiersByDay?.[day]?.[modelFilter]);
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
		      // Sum across records: several sessions of one model must accumulate,
		      // not overwrite — the cost chip, ModelBars and the per-model cost all
		      // read this row, and the peak/off-peak splits ride along.
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
		    cost: costOf(modelsArr, pricing, fx),
		    hasData: grandTotal > 0 || totals.sessions > 0,
		    knownProjects: [...seenProjects].filter((p) => p !== "").sort(),
		    knownModels: [...seenModels].sort(),
		  };
		}

		/** Resolved per-rule rates with all defaults applied (cache-hit falls back
		 *  to the miss rate; peak rates fall back to the off-peak rates). */
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

		/** Native-currency cost of one tier's token bucket at the resolved rates
		 *  (per-million scaling included; uncached input = miss + cache write). */
		function priceTier(tokens, rates, tier) {
		  const input = tier === "peak" ? rates.peakInput : rates.offInput;
		  const cache = tier === "peak" ? rates.peakCache : rates.offCache;
		  const output = tier === "peak" ? rates.peakOutput : rates.offOutput;
		  return ((tokens.input + tokens.cacheWrite) * input
		    + tokens.cacheRead * cache
		    + tokens.output * output) / 1e6;
		}

		/** One side of a tier split as a plain token bucket: the split nests each
		 *  side inside every token kind (`{input: {peak, offpeak}, ...}`). */
		const tierSide = (tier, side) => ({
		  input: tier.input?.[side] || 0,
		  output: tier.output?.[side] || 0,
		  cacheRead: tier.cacheRead?.[side] || 0,
		  cacheWrite: tier.cacheWrite?.[side] || 0,
		});

		/**
		 * Cost estimate over per-model token splits, tier-aware, displayed in one
		 * currency: CNY. Rules may price a model in CNY (default) or USD; USD-priced
		 * models are converted through `fx.usdToCny` (default {@link DEFAULT_USD_TO_CNY})
		 * so mixed-currency dashboards still sum to one meaningful number. The
		 * converted portion rides along as `convertedFromUsd` for the display note.
		 *
		 * Each model row may carry a `peak` / `offpeak` split (from the projection's
		 * `tiersByDay`, classified by each rule's Beijing-time peak hours). A row
		 * without a tier split prices wholly at the off-peak rates. Rates are
		 * per-million-token amounts in the rule's currency.
		 *
		 * @param {Array<{model: string, input?: number, cacheRead?: number, cacheWrite?: number, output?: number, peak?: object, offpeak?: object}>} models
		 * @param {Array<{model: string, input: number, cacheRead?: number, output: number, currency?: string, peak?: {input?: number, cacheRead?: number, output?: number}}>} pricing
		 * @param {{usdToCny?: number}} [fx] - USD→CNY conversion rate.
		 * @returns {{configured: boolean, total: number|null, currency: string|null, usdToCny: number, convertedFromUsd: number, unpriced: object}}
		 */
		const DEFAULT_USD_TO_CNY = 6.8;

		function costOf(models, pricing, fx = {}) {
		  const rate = new Map((Array.isArray(pricing) ? pricing : []).map((rule) => [rule.model, rule]));
		  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
		  let total = 0;
		  let converted = 0;
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
		  return configured
		    ? {
		      configured: true,
		      total: Math.round(total * 1e6) / 1e6,
		      currency: "CNY",
		      usdToCny,
		      convertedFromUsd: Math.round(converted * 1e6) / 1e6,
		      unpriced,
		    }
		    : { configured: false, total: null, currency: null, usdToCny, convertedFromUsd: 0, unpriced };
		}

		/**
		 * Per-day cost series (CNY) over the windowed session records, split into
		 * peak / off-peak contributions — the cost trend chart's data source. Folds
		 * each record's `modelsByDay` against `tiersByDay` and the pricing rules
		 * client-side, so it honors the dashboard's project and model filters and
		 * can re-price instantly against edited (unsaved) rules. Days without
		 * priced activity carry zeros; unpriced models contribute nothing (they are
		 * already reported through the cost chip's unpriced note).
		 *
		 * @param {Array<object>} sessions - payload session records.
		 * @param {object} options
		 * @param {string} options.from - inclusive `YYYY-MM-DD`.
		 * @param {string} options.to - inclusive `YYYY-MM-DD`.
		 * @param {string} [options.project] - restrict to one project label ("" = all).
		 * @param {string} [options.model] - restrict to one model id ("" = all).
		 * @param {Array<object>} [options.pricing] - pricing rules.
		 * @param {{usdToCny?: number}} [options.fx] - USD→CNY conversion rate.
		 * @returns {Array<{key: string, peak: number, offpeak: number}>} one entry per day, `total = peak + offpeak`.
		 */
		function costSeries(sessions, { from, to, project = "", model = "", pricing = [], fx = {} }) {
		  const rate = new Map((Array.isArray(pricing) ? pricing : []).map((rule) => [rule.model, rule]));
		  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
		  const keys = rangeKeys("day", from, to);
		  const index = new Map(keys.map((key, i) => [key, i]));
		  const days = keys.map((key) => ({ key, peak: 0, offpeak: 0 }));
		  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);
		  for (const record of Array.isArray(sessions) ? sessions : []) {
		    if (record === null || typeof record !== "object") continue;
		    if (project !== "" && String(record.project ?? "") !== project) continue;
		    for (const [day, dayModels] of Object.entries(record.modelsByDay ?? {})) {
		      const idx = index.get(day);
		      if (idx === undefined || dayModels === null || typeof dayModels !== "object") continue;
		      for (const [modelName, tokens] of Object.entries(dayModels)) {
		        if (modelFilter !== null && modelName !== modelFilter) continue;
		        const rule = rate.get(modelName);
		        if (rule === undefined) continue;
		        const rates = resolveRates(rule);
		        const conv = rule.currency === "USD" ? usdToCny : 1;
		        const tier = record.tiersByDay?.[day]?.[modelName];
		        if (tier === null || tier === undefined) {
		          days[idx].offpeak += priceTier(tokens, rates, "offpeak") * conv;
		        } else {
		          days[idx].peak += priceTier(tierSide(tier, "peak"), rates, "peak") * conv;
		          days[idx].offpeak += priceTier(tierSide(tier, "offpeak"), rates, "offpeak") * conv;
		        }
		      }
		    }
		  }
		  const round = (v) => Math.round(v * 1e6) / 1e6;
		  return days.map((day) => ({ key: day.key, peak: round(day.peak), offpeak: round(day.offpeak) }));
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
		/** Recently fetched windows (LRU, max 4): switching back within a
		 *  minute renders instantly while a background fetch refreshes it.
		 *  Older entries are dropped instead of being flashed as current. */
		const PAYLOAD_CACHE_MS = 60000;
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
			const entry = payloadCache.get(key);
			const cached = entry !== undefined && Date.now() - entry.at < PAYLOAD_CACHE_MS ? entry.payload : undefined;
			if (entry !== undefined && cached === undefined) payloadCache.delete(key);
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
				payloadCache.set(key, { at: Date.now(), payload: data });
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

		/** Official DeepSeek balance (GET /pulse/balance): host-side query with
		 *  a short server cache, so each mount costs at most one refresh. A
		 *  sequence guard keeps a superseded reply from landing state. Pass
		 *  `enabled: false` to skip the request entirely (e.g. the sidebar
		 *  balance indicator switched off). */
		function useBalance(enabled = true) {
			const [state, setState] = useState({ data: null, busy: false, error: null });
			const seq = useRef(0);
			const load = (refresh) => {
				const mine = ++seq.current;
				setState((s) => ({ ...s, busy: true }));
				fetch(`/pulse/balance${refresh === true ? "?refresh=1" : ""}`, {
					credentials: "same-origin",
					headers: { accept: "application/json" },
				}).then(async (res) => {
					if (res.ok !== true) throw new Error(`HTTP ${res.status}`);
					return res.json();
				}).then((data) => {
					if (mine === seq.current) setState({ data, busy: false, error: null });
				}).catch((error) => {
					if (mine === seq.current) setState({ data: null, busy: false, error: String(error?.message ?? error) });
				});
			};
			useEffect(() => { if (enabled) load(); }, [enabled]);
			return { ...state, refresh: () => load(true) };
		}
		//#endregion

		//#region panels store
		/** Per-panel visibility for the observatory surfaces (dashboard panels
		 *  plus the sidebar balance). Local preferences only — nothing here
		 *  touches the host or the persisted pricing rules. */
		const PANELS_STORAGE = "dsh-pulse:panels";
		const PANEL_DEFAULTS = {
			chips: true, balance: true, trend: true, cache: true,
			models: true, projects: true, cost: true, budget: true, footBalance: true,
		};
		function loadPanels() {
			try {
				const raw = localStorage.getItem(PANELS_STORAGE);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (parsed !== null && typeof parsed === "object") return { ...PANEL_DEFAULTS, ...parsed };
				}
			} catch (error) { /* private mode or quota — fall through to defaults */ }
			return { ...PANEL_DEFAULTS };
		}
		function savePanels(panels) {
			try { localStorage.setItem(PANELS_STORAGE, JSON.stringify(panels)); } catch (error) { /* non-fatal */ }
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

		/** Official DeepSeek balance: availability dot, total with the
		 *  granted/topped-up split, last-updated time and a manual refresh.
		 *  Hidden entirely while the host reports no configured credential
		 *  (the card is pure add-on, never a setup nag). */
		function BalanceBar({ balance, series, t }) {
			const data = balance.data;
			if (data === null || data.configured !== true) {
				if (balance.error !== null) return jsxs("div", { className: "dp_balanceBar", children: [
					jsx("i", { className: "dp_balanceDot dp_balanceDotOff" }),
					jsx("span", { className: "dp_balanceLabel", children: t("balanceTitle") }),
					jsx("span", { className: "dp_balanceSub", children: fill(t("balanceFailed"), { err: balance.error }) }),
					jsx("button", { type: "button", className: "dp_miniBtn", onClick: balance.refresh, disabled: balance.busy, children: t("retry") }),
				] });
				return null;
			}
			if (data.ok !== true) return jsxs("div", { className: "dp_balanceBar", children: [
				jsx("i", { className: "dp_balanceDot dp_balanceDotOff" }),
				jsx("span", { className: "dp_balanceLabel", children: t("balanceTitle") }),
				jsx("span", { className: "dp_balanceSub", children: fill(t("balanceFailed"), { err: data.error ?? "?" }) }),
				jsx("button", { type: "button", className: "dp_miniBtn", onClick: balance.refresh, disabled: balance.busy, children: t("retry") }),
			] });
			/** Runway: balance total divided by the average of the most recent
			 *  known daily spends (≤7 days of the official reconciliation
			 *  series). CNY only — a foreign-currency balance can't be compared
			 *  with the CNY spend series. */
			const runway = (() => {
				if (data.currency !== "CNY") return null;
				const total = Number(data.total);
				if (!(total > 0)) return null;
				const spends = (Array.isArray(series) ? series : [])
					.map((row) => (Number.isFinite(row?.spend) && row.spend > 0 ? row.spend : null))
					.filter((v) => v !== null)
					.slice(-7);
				if (spends.length === 0) return null;
				return Math.max(1, Math.floor(total / (spends.reduce((a, b) => a + b, 0) / spends.length)));
			})();
			/** Balance split: only meaningful when a granted portion exists —
			 *  an all-topped-up balance carries nothing to break down. */
			const splitParts = Number(data.granted) > 0
				? [
					fill(t("balanceGranted"), { v: fmtCost(data.granted) }),
					Number(data.topped) > 0 ? fill(t("balanceTopped"), { v: fmtCost(data.topped) }) : "",
				].filter((part) => part !== "")
				: [];
			return jsxs("div", { className: "dp_balanceBar", children: [
				jsx("i", { className: `dp_balanceDot${data.isAvailable === true ? "" : " dp_balanceDotOff"}` }),
				jsx("span", { className: "dp_balanceLabel", children: t("balanceTitle") }),
				jsxs("span", { className: "dp_balanceTotal", children: [
					`${data.currency === "CNY" ? "¥" : ""}${fmtCost(data.total ?? 0)}`,
					data.currency !== "CNY" ? ` ${data.currency}` : "",
				] }),
				splitParts.length > 0 && jsx("span", { className: "dp_balanceSub", children: splitParts.join(" · ") }),
				data.isAvailable !== true && jsx("span", { className: "dp_balanceWarn", children: t("balanceUnavailable") }),
				runway !== null && jsx("span", {
					className: runway < 3 ? "dp_runwayLow" : "dp_runway",
					children: runway < 3 ? fill(t("runwayLow"), { n: runway }) : fill(t("runwayDays"), { n: runway }),
				}),
				jsxs("span", { className: "dp_balanceTime", children: [
					fill(t("balanceAt"), { t: fmtClock(data.fetchedAt) }),
					jsx("button", {
						type: "button", className: "dp_miniBtn", onClick: balance.refresh,
						disabled: balance.busy, title: t("refresh"), "aria-label": t("refresh"),
						children: jsx(primitives.IconRefreshOutline16, { size: 13 }),
					}),
				] }),
			] });
		}

		/**
		 * Compact cost preview: a chip-sized sparkline (daily totals with a
		 * soft area fill; the peak-hours portion as a second thin line) that
		 * sits right after the cost chip and splits the row with it. When the
		 * host serves `balanceSeries`, a third thin line traces the official
		 * day-over-day balance spend (官方扣费) — days with a top-up carry no
		 * point (the spend is unknowable from totals alone). No axes or
		 * gridlines; hover any point for the day's split.
		 */
		function CostSpark({ days, actual, t }) {
			const [hovered, setHovered] = useState(null);
			const list = Array.isArray(days) ? days : [];
			const n = list.length;
			const totals = list.map((d) => (d.peak || 0) + (d.offpeak || 0));
			const peaks = list.map((d) => (d.peak || 0));
			const actualMap = new Map((Array.isArray(actual) ? actual : [])
				.map((row) => [row?.key, Number.isFinite(row?.spend) ? row.spend : null]));
			const actualValues = list.map((d) => actualMap.get(d.key)).filter((v) => Number.isFinite(v));
			const hasActual = actualValues.length > 0;
			if (n < 2) return null;
			const H = 100;
			const max = Math.max(...totals, ...actualValues, 0) || 1;
			const y = (v) => H - (v / max) * H;
			const pts = (values) => values.map((v, i) => `${i},${y(v)}`).join(" L");
			const linePath = `M${pts(totals)}`;
			const areaPath = `${linePath} L${n - 1},${H} L0,${H} Z`;
			const peakPath = `M${pts(peaks)}`;
			// Actual-spend segments: gaps (null spend) break the line instead
			// of plotting a lying zero.
			const segments = [];
			let segment = [];
			list.forEach((d, i) => {
				const v = actualMap.get(d.key);
				if (Number.isFinite(v)) segment.push(`${i},${y(Math.min(v, max))}`);
				else if (segment.length > 1) { segments.push(segment); segment = []; }
				else segment = [];
			});
			if (segment.length > 1) segments.push(segment);
			const hover = hovered !== null && hovered >= 0 && hovered < n ? list[hovered] : null;
			const hoverX = hover !== null ? hovered / (n - 1) : 0;
			const hoverSpend = hover !== null && actualMap.has(hover.key) ? actualMap.get(hover.key) : undefined;
			return jsxs("div", { className: "dp_chip dp_sparkCard", children: [
				jsxs("div", { className: "dp_sparkHead", children: [
					jsx("span", { className: "dp_chipLabel", children: t("costTrend") }),
					jsx("span", { className: "dp_sparkCount", children: fill(t("dailyCount"), { n }) }),
				] }),
				jsxs("div", { className: "dp_sparkBody", children: [
					jsx("svg", {
						className: "dp_hourSvg", viewBox: `0 0 ${n - 1} ${H}`, preserveAspectRatio: "none",
						"aria-hidden": "true",
						children: [
							jsx("path", { className: "dp_costArea", d: areaPath }),
							hasActual && segments.map((seg, i) => jsx("path", { key: i, className: "dp_costLineActual", d: `M${seg.join(" L")}` })),
							jsx("path", { className: "dp_costLinePeak", d: peakPath }),
							jsx("path", { className: "dp_costLine", d: linePath }),
						],
					}),
					jsx("div", {
						className: "dp_hourHover", style: { left: 0, right: 0 },
						onMouseMove: (e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
							setHovered(Math.min(n - 1, Math.round(ratio * (n - 1))));
						},
						onMouseLeave: () => setHovered(null),
					}),
					hover !== null && jsx("span", {
						className: "dp_costDot",
						style: { left: `${hoverX * 100}%`, top: `${y((hover.peak || 0) + (hover.offpeak || 0))}%` },
					}),
					hover !== null && jsx("div", {
						className: "dp_tip",
						style: { left: `${Math.min(80, Math.max(4, hoverX * 100))}%`, transform: "translateX(-50%)" },
						children: jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 1 }, children: [
							jsx("b", { children: hover.key }),
							jsx("span", { children: fill(t("costTipOff"), { v: fmtCost(hover.offpeak || 0) }) }),
							jsx("span", { children: fill(t("costTipPeak"), { v: fmtCost(hover.peak || 0) }) }),
							jsx("span", { children: fill(t("costTipTotal"), { v: fmtCost((hover.peak || 0) + (hover.offpeak || 0)) }) }),
							hoverSpend !== undefined && jsx("span", { children: hoverSpend === null
								? t("actualUnknown")
								: fill(t("actualTip"), { v: fmtCost(hoverSpend) }) }),
						] }),
					}),
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

		/** Horizontal share bars for per-model token splits, each carrying its
		 *  priced cost (CNY) as a secondary value when rates cover it. */
		function ModelBars({ models, pricing = [], fx, costEnabled = false, t }) {
			const rows = (Array.isArray(models) ? models : [])
				.filter((m) => (m.input || 0) + (m.output || 0) + (m.cacheRead || 0) + (m.cacheWrite || 0) > 0)
				.slice(0, 6);
			const max = rows.reduce((m, r) => Math.max(m,
				(r.input || 0) + (r.cacheRead || 0) + (r.cacheWrite || 0) + (r.output || 0)), 0) || 1;
			// One costOf per row (≤6 rows) — cheap, and unpriced rows report
			// configured:false so they simply show no cost line.
			const costs = useMemo(() => rows.map((row) => costOf([row], pricing, fx)), [rows, pricing, fx]);
			return jsxs("div", { className: "dp_listBox", children: [
				jsx("div", { className: "dp_panelTitle", children: t("modelsTitle") }),
				rows.length === 0 && jsx("div", { className: "dp_ringSideRow", children: jsx("span", { children: t("cacheNa") }) }),
				rows.map((row, i) => {
					const total = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0) + (row.output || 0);
					const inSide = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0);
					const cost = costEnabled === true ? costs[i] : null;
					return jsxs("div", { className: "dp_barRow", children: [
						jsx("span", { className: "dp_barRowName", title: row.model, children: row.model === "unknown" ? t("unknownModel") : row.model }),
						jsx("span", { className: "dp_barRowTrack", children: jsx("span", {
							className: `dp_barRowFill${i % 2 === 1 ? " dp_barRowFillAlt" : ""}`,
							style: { width: `${(total / max) * 100}%` },
						}) }),
						jsxs("span", {
							className: "dp_barRowVal",
							title: `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(row.output || 0) })}`,
							children: [
								fmtTokens(total),
								cost !== null && cost.configured === true
									? jsx("span", { className: "dp_barRowCost", children: `${fmtCost(cost.total ?? 0)} CNY` })
									: null,
							],
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
		/** Custom-range calendar: one picker for both bounds — first click
		 *  sets the start, a second click sets the end (an earlier pick
		 *  swaps the pair), and picking again after a complete range starts
		 *  over. Replaces the two date inputs so a custom range takes a
		 *  single interaction. */
		function RangeCalendar({ from, to, onPick, onClose, t }) {
			const [month, setMonth] = useState(() => {
				const anchor = typeof from === "string" && from.length === 10 ? from : localDay(Date.now());
				return anchor.slice(0, 7);
			});
			const [pending, setPending] = useState(null);
			const shiftMonth = (key, delta) => {
				const [y, m] = key.split("-").map(Number);
				const t = y * 12 + (m - 1) + delta;
				return `${String(Math.floor(t / 12)).padStart(4, "0")}-${String((t % 12) + 1).padStart(2, "0")}`;
			};
			const pick = (day) => {
				if (pending === null) { setPending(day); return; }
				let start = pending;
				let end = day;
				if (end < start) { start = day; end = pending; }
				onPick({ from: start, to: end });
			};
			const [y, m] = month.split("-").map(Number);
			const daysInMonth = new Date(y, m, 0).getDate();
			const offset = (new Date(y, m - 1, 1, 12).getDay() + 6) % 7;
			const today = localDay(Date.now());
			const cells = [];
			for (let i = 0; i < offset; i += 1) cells.push(null);
			for (let d = 1; d <= daysInMonth; d += 1) cells.push(localDay(new Date(y, m - 1, d, 12).getTime()));
			const start = pending !== null ? pending : (typeof from === "string" ? from : "");
			const end = pending !== null ? null : (typeof to === "string" ? to : "");
			const isStart = (day) => start !== "" && day === start;
			const isEnd = (day) => end !== null && day === end;
			const inRange = (day) => start !== "" && end !== null && day > start && day < end;
			return jsxs("div", { className: "dp_calOverlay", onClick: onClose, children: [
				jsxs("div", { className: "dp_calCard", onClick: (e) => e.stopPropagation(), children: [
					jsxs("div", { className: "dp_calHead", children: [
						jsx("button", { type: "button", className: "dp_calNav", "aria-label": t("back"), onClick: () => setMonth(shiftMonth(month, -1)), children: "‹" }),
						jsx("span", { className: "dp_calMonth", children: month }),
						jsx("button", { type: "button", className: "dp_calNav", onClick: () => setMonth(shiftMonth(month, 1)), children: "›" }),
					] }),
					jsxs("div", { className: "dp_calGrid", children: [
						t("calWeek").split(",").map((w) => jsx("span", { className: "dp_calDow", children: w }, w)),
						cells.map((day, i) => (day === null
							? jsx("span", { key: `e${i}`, className: "dp_calCell dp_calEmpty" })
							: jsx("button", {
								type: "button", key: day,
								className: `dp_calCell${isStart(day) ? " dp_calStart" : ""}${isEnd(day) ? " dp_calEnd" : ""}${inRange(day) ? " dp_calIn" : ""}${day === today ? " dp_calToday" : ""}`,
								onClick: () => pick(day),
								children: String(Number(day.slice(8))),
							}))),
					] }),
					jsx("div", { className: "dp_calFoot", children: jsx("span", { className: "dp_costNote", children: pending !== null ? t("calPickEnd") : t("calPickStart") }) }),
				] }),
			] });
		}

		function Toolbar({ rangeKey, setRangeKey, custom, setCustom, project, setProject, knownProjects, model, setModel, knownModels, t }) {
			const [calOpen, setCalOpen] = useState(false);
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
				rangeKey === "custom" && jsxs("div", { className: "dp_toolbarGroup", children: [
					jsx("button", {
						type: "button", className: "dp_dateBtn",
						onClick: () => setCalOpen(true),
						children: custom.from && custom.to ? `${custom.from} ~ ${custom.to}` : t("rangeCustom"),
					}),
					calOpen && jsx(RangeCalendar, {
						from: custom.from, to: custom.to,
						onPick: (range) => { setCustom(range); setCalOpen(false); },
						onClose: () => setCalOpen(false),
						t,
					}),
				] }),
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
		/** Monthly budget panel: a CNY budget input with a progress bar, the
		 *  month-to-date estimated spend (its own stats fetch over the month
		 *  window, priced through the payload's own rules — the dashboard's
		 *  shared store stays untouched) and a run-rate month-end forecast.
		 *  The budget is a localStorage preference, like the panel toggles. */
		function BudgetCard({ t }) {
			const [budget, setBudget] = useState(() => {
				try {
					const raw = localStorage.getItem("dsh-pulse:budget");
					const v = raw === null ? null : Number(raw);
					return v !== null && Number.isFinite(v) && v > 0 ? v : null;
				} catch (error) { return null; }
			});
			/** Day-counting mode for the daily average: all days, weekdays
			 *  (no Sat/Sun), or single-off (no Sun). */
			const [mode, setMode] = useState(() => {
				try {
					const raw = localStorage.getItem("dsh-pulse:budget-days-mode");
					return raw === "weekdays" || raw === "single" ? raw : "all";
				} catch (error) { return "all"; }
			});
			const [month, setMonth] = useState({ status: "loading", used: null, from: null, to: null, totalDays: 0, error: null });
			useEffect(() => {
				const today = localDay(Date.now());
				const from = `${today.slice(0, 8)}01`;
				let cancelled = false;
				fetch(`/pulse/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(today)}`, {
					credentials: "same-origin",
					headers: { accept: "application/json" },
				})
					.then(async (res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then((payload) => {
						if (cancelled) return;
						const fromDay = typeof payload?.fromDay === "string" ? payload.fromDay : from;
						const toDay = typeof payload?.toDay === "string" ? payload.toDay : today;
						const view = buildView(Array.isArray(payload?.sessions) ? payload.sessions : [], {
							granularity: "day", from: fromDay, to: toDay,
							pricing: payload.pricing, fx: payload.fx,
						});
						const used = view.cost?.configured === true && Number.isFinite(view.cost.total) ? view.cost.total : null;
						const totalDays = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
						setMonth({ status: "ready", used, from: fromDay, to: toDay, totalDays, error: null });
					})
					.catch((error) => {
						if (!cancelled) setMonth((s) => ({ ...s, status: "error", error: String(error?.message ?? error) }));
					});
				return () => { cancelled = true; };
			}, []);

			const onBudget = (value) => {
				const v = value === "" ? null : Number(value);
				const next = v !== null && Number.isFinite(v) && v > 0 ? v : null;
				setBudget(next);
				try {
					if (next === null) localStorage.removeItem("dsh-pulse:budget");
					else localStorage.setItem("dsh-pulse:budget", String(next));
				} catch (error) { /* non-fatal */ }
			};
			const onMode = (next) => {
				setMode(next);
				try { localStorage.setItem("dsh-pulse:budget-days-mode", next); } catch (error) { /* non-fatal */ }
			};

			/** Effective day count under the mode (Sun = rest under "single"). */
			const isWorkDay = (day) => {
				const [y, m, d] = String(day).split("-").map(Number);
				const dow = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // 0 = Monday
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
			const pct = budget !== null && used !== null && budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
			const workDays = used !== null && month.from !== null ? countWorkDays(month.from, month.to) : 0;
			const avg = used !== null && workDays > 0 ? used / workDays : null;
			const remaining = used !== null && month.to !== null
				? countWorkDays(shiftDay(month.to, 1), `${month.to.slice(0, 8)}${String(month.totalDays).padStart(2, "0")}`)
				: 0;
			const forecast = used !== null && avg !== null ? used + avg * remaining : null;
			const modeBtn = (key, label) => jsx("button", {
				type: "button",
				className: `dp_segBtn${mode === key ? " dp_segBtnActive" : ""}`,
				onClick: () => onMode(key),
				children: label,
			}, key);
			return jsxs("div", { className: "dp_balanceBar dp_budgetBar", children: [
				jsx("span", { className: "dp_balanceLabel", children: t("budgetTitle") }),
				jsxs("div", { className: "dp_budgetInputRow", children: [
					jsx("input", {
						className: "dp_budgetInput", inputMode: "decimal", placeholder: t("budgetSet"),
						value: budget === null ? "" : String(budget),
						onChange: (e) => onBudget(e.target.value),
					}),
					jsx("span", { className: "dp_balanceLabel", children: "CNY" }),
				] }),
				jsxs("div", { className: "dp_seg", children: [
					modeBtn("all", t("budgetModeAll")),
					modeBtn("weekdays", t("budgetModeWeekdays")),
					modeBtn("single", t("budgetModeSingle")),
				] }),
				over && jsx("span", { className: "dp_balanceWarn", children: t("budgetOver") }),
				budget !== null && used !== null && jsx("div", { className: "dp_budgetTrack", children: jsx("div", { className: `dp_budgetFill${over ? " dp_budgetFillOver" : ""}`, style: { width: `${pct}%` } }) }),
				month.status === "error"
					? jsx("span", { className: "dp_balanceSub", children: fill(t("setFailed"), { err: month.error }) })
					: budget === null
						? jsx("span", { className: "dp_balanceSub", children: t("budgetEmpty") })
						: used === null
							? jsx("span", { className: "dp_balanceSub", children: t("costOff") })
							: jsxs("span", { className: "dp_balanceSub", children: [
								`${t("budgetUsed")} ${fmtCost(used)} / ${fmtCost(budget)} (${Math.round(pct)}%)`,
								avg !== null ? ` · ${fill(t("budgetAvg"), { v: fmtCost(avg) })}` : "",
								forecast !== null ? ` · ${t("budgetForecast")} ${fmtCost(forecast)}` : "",
								` · ${fill(t("budgetLeftDays"), { n: remaining })}`,
							] }),
			] });
		}

		/** The full dashboard, shared by every surface (page / card / panel).
		 *  `onConfigure`, when provided (the settings section), makes the cost
		 *  chip's unset/unpriced notes open the pricing editor. */
		function PulseDashboard({ t, headerExtra, onConfigure }) {
			const [panels] = useState(loadPanels);
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
			/** Official balance rides its own endpoint (network-bound, cached
			 *  server-side) so the stats payload stays local and fast. */
			const balance = useBalance();

			/** The rendered window is the PAYLOAD's own (echoed by the host),
			 *  never the toolbar's live selection: while a new window is still
			 *  loading, the old payload keeps rendering its own consistent view
			 *  instead of a mixed old-sessions-cut-to-the-new-window chart. */
			const view = useMemo(() => {
				if (data === null) return null;
				const from = typeof data.fromDay === "string" ? data.fromDay : range.from;
				const to = typeof data.toDay === "string" ? data.toDay : range.to;
				return buildView(data.sessions, {
					granularity: "day",
					from,
					to,
					project,
					model,
					pricing: data.pricing,
					fx: data.fx,
				});
			}, [data, range, project, model]);

			/** Single-day views render the intraday hourly line chart; the
			 *  chart type follows the loaded window, not the toolbar, for the
			 *  same stale-payload consistency. */
			const hourly = data === null ? range.from === range.to : data.fromDay === data.toDay;
			const hours = useMemo(() => {
				if (data === null || !hourly || panels.trend === false) return null;
				return hourlySeries(data.sessions, data.today, { project, model });
			}, [data, hourly, project, model, panels.trend]);
			/** Daily cost series (peak/off-peak, CNY) for the cost sparkline;
			 *  the same pure fold the pricing preview uses, so all cost figures
			 *  agree. Skipped when the cost panel is hidden. */
			const costDays = useMemo(() => {
				if (data === null || hourly || panels.cost === false || data.costEnabled === false) return null;
				return costSeries(data.sessions, {
					from: typeof data.fromDay === "string" ? data.fromDay : range.from,
					to: typeof data.toDay === "string" ? data.toDay : range.to,
					project, model,
					pricing: data.pricing, fx: data.fx,
				});
			}, [data, range, hourly, project, model, panels.cost]);

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

			/** A payload whose window differs from the toolbar's selection is
			 *  a not-yet-replaced leftover from the previous range — render
			 *  the loading treatment, never last window's numbers under the
			 *  new label. Schema-2 payloads can't be verified; they render. */
			const staleWindow = data !== null && data.schema === 3
				&& (data.fromDay !== range.from || data.toDay !== range.to);
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
			if (data === null || stats.status === "loading" || staleWindow) {
				return jsxs("div", { className: "dp_root", children: [
					header,
					// The toolbar stays interactive across switches (retargeting
					// is cheap: the store aborts and re-sequences); only the
					// initial load has no window to source picker options from.
					view !== null
						? jsx(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject, knownProjects: view.knownProjects, model, setModel, knownModels: view.knownModels, t })
						: jsx("div", { className: "dp_skeleton dp_skeletonShort" }),
					jsx("div", { className: "dp_skeleton", children: jsx("div", { className: "dp_emptyChart", children: jsx("span", { children: t("loading") }) }) }),
				] });
			}
			if (view === null) return null;

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
			const costEnabled = data.costEnabled !== false;
			const bucketCount = view.buckets.length;
			const showChips = panels.chips !== false || (panels.cost !== false && costEnabled);
			return jsxs("div", { className: "dp_root", children: [
				header,
				jsx(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject, knownProjects: view.knownProjects, model, setModel, knownModels: view.knownModels, t }),
				showChips && jsxs("div", { className: "dp_chips", children: [
					panels.chips !== false && jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipSessions") }),
						jsx("span", { className: "dp_chipValue", children: String(totals.sessions || 0) }),
						(totals.subagents || 0) > 0 && jsx("span", { className: "dp_chipNote", children: fill(t("chipSubagents"), { n: totals.subagents }) }),
					] }),
					panels.chips !== false && jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipTurns") }),
						jsx("span", { className: "dp_chipValue", children: `${totals.turns || 0} / ${totals.toolCalls || 0}` }),
					] }),
					panels.chips !== false && jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipTokens") }),
						jsx("span", { className: "dp_chipValue", children: fmtTokens(grandTotal) }),
						jsx("span", { className: "dp_chipNote", children: `${fill(t("inOf"), { n: fmtTokens((totals.input || 0) + (totals.cacheRead || 0) + (totals.cacheWrite || 0)) })} / ${fill(t("outOf"), { n: fmtTokens(totals.output || 0) })}` }),
					] }),
					panels.chips !== false && jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipCache") }),
						jsx("span", { className: "dp_chipValue", children: typeof totals.cacheHitRate === "number" ? `${Math.round(totals.cacheHitRate * 100)}%` : t("cacheNa") }),
						jsx("span", { className: "dp_chipNote", children: fill(t("cacheOf"), { hit: fmtTokens(totals.cacheRead || 0), total: fmtTokens((totals.cacheRead || 0) + (totals.input || 0) + (totals.cacheWrite || 0)) }) }),
					] }),
					panels.cost !== false && costEnabled && jsxs("div", { className: "dp_chip", children: [
						jsx("span", { className: "dp_chipLabel", children: t("chipCost") }),
						cost.configured === true
							? jsx("span", { className: "dp_chipValue dp_costOk", children: `${fmtCost(cost.total ?? 0)} CNY` })
							: (onConfigure !== undefined
								? jsx("button", { type: "button", className: "dp_chipValueBtn", onClick: onConfigure, children: t("costGoSet") })
								: jsx("span", { className: "dp_chipValue dp_costOff", children: t("costOff") })),
						cost.configured === true && ((cost.unpriced?.input) || 0) + ((cost.unpriced?.output) || 0) > 0
							? (onConfigure !== undefined
								? jsx("button", { type: "button", className: "dp_chipNoteBtn", onClick: onConfigure, children: fill(t("unpriced"), { n: fmtTokens((cost.unpriced.input || 0) + (cost.unpriced.output || 0)) }) })
								: jsx("span", { className: "dp_chipNote", children: fill(t("unpriced"), { n: fmtTokens((cost.unpriced.input || 0) + (cost.unpriced.output || 0)) }) }))
							: cost.configured === true && (cost.convertedFromUsd || 0) > 0
								? jsx("span", { className: "dp_chipNote", children: fill(t("fxNote"), { r: cost.usdToCny }) })
								: cost.configured !== true && jsx("span", { className: "dp_costNote", children: t("costHint") }),
					] }),
					panels.cost !== false && costEnabled && cost.configured === true && costDays !== null
						&& costDays.some((d) => (d.peak || 0) + (d.offpeak || 0) > 0)
						&& jsx(CostSpark, { days: costDays, actual: Array.isArray(data?.balanceSeries) ? data.balanceSeries : null, t }),
				] }),
				panels.balance !== false && jsx(BalanceBar, { balance, series: Array.isArray(data?.balanceSeries) ? data.balanceSeries : null, t }),
				panels.budget !== false && costEnabled && jsx(BudgetCard, { t }),
				panels.trend !== false && jsxs("div", { children: [
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
				(panels.cache !== false || panels.models !== false) && jsxs("div", { className: "dp_twoCol", children: [
					panels.cache !== false && jsx(CacheRing, { totals, t }),
					panels.models !== false && jsx(ModelBars, { models: view.models, pricing: data.pricing, fx: data.fx, costEnabled, t }),
				] }),
				panels.projects !== false && jsxs("div", { children: [
					jsx("div", { className: "dp_panelTitle", children: t("projectsTitle") }),
					jsx(ProjectTable, { projects: view.projects, topProjects: data.topProjects, t }),
				] }),
			] });
		}
		//#endregion

		//#region settings page
		/** Official default peak hours (Beijing time) — the editor's fallback
		 *  display and the save-side default for rows without a custom window. */
		const OFFICIAL_PEAK_HOURS = [9, 10, 11, 14, 15, 16, 17];

		/**
		 * Build the editor's row list: one row per catalog model (the Models
		 * settings page, served through `GET /pulse/settings`'s `catalog`),
		 * then one per model with usage but no catalog entry, then one per
		 * saved rule matching neither — the fallback path when the host has
		 * no `llm` service or an empty catalog.
		 */
		function buildEditorRows(data, usageModels) {
			const rules = new Map((Array.isArray(data.pricing) ? data.pricing : [])
				.filter((rule) => typeof rule?.model === "string" && rule.model !== "")
				.map((rule) => [rule.model, rule]));
			const rows = [];
			const seen = new Set();
			const push = (model, name, group, origin) => {
				if (seen.has(model)) return;
				seen.add(model);
				const rule = rules.get(model) ?? {};
				rows.push({
					model, name: name ?? "", group, origin,
					input: rule.input ?? "", cacheRead: rule.cacheRead ?? "", output: rule.output ?? "",
					currency: rule.currency === "USD" ? "USD" : "CNY",
					peak: {
						input: rule.peak?.input ?? "", cacheRead: rule.peak?.cacheRead ?? "", output: rule.peak?.output ?? "",
					},
					peakHours: Array.isArray(rule.peakHours) ? [...rule.peakHours] : null,
					expanded: rule.peak !== null && typeof rule.peak === "object",
					removable: origin !== "catalog",
				});
			};
			for (const groupEntry of Array.isArray(data.catalog) ? data.catalog : []) {
				for (const model of Array.isArray(groupEntry.models) ? groupEntry.models : []) {
					if (typeof model?.id !== "string" || model.id === "") continue;
					push(model.id, model.name ?? "", groupEntry.displayName ?? groupEntry.provider ?? "", "catalog");
				}
			}
			for (const model of Array.isArray(usageModels) ? usageModels : []) {
				if (model !== "" && model !== "unknown") push(model, "", "", "usage");
			}
			for (const model of rules.keys()) push(model, "", "", "custom");
			return rows;
		}

		/** Re-apply a fresh server row list over the locally edited one: edited
		 *  rates, currency, peak blocks and windows survive a catalog refresh
		 *  (new catalog rows join, withdrawn rows keep their edits when they
		 *  are manual ones); identity fields always come from the fresh list. */
		function mergeRows(fresh, edited) {
			const byModel = new Map(edited.map((row) => [row.model, row]));
			const out = fresh.map((row) => {
				const prev = byModel.get(row.model);
				return prev === undefined ? row : {
					...row,
					input: prev.input, cacheRead: prev.cacheRead, output: prev.output,
					currency: prev.currency, peak: prev.peak, peakHours: prev.peakHours,
					expanded: prev.expanded,
				};
			});
			const seen = new Set(out.map((row) => row.model));
			for (const row of edited) {
				if (row.origin === "custom" && !seen.has(row.model)) out.push(row);
			}
			return out;
		}

		/** Numeric-field cleaner: ""/null → undefined, finite → number, else NaN. */
		function cleanNum(value) {
			if (value === "" || value === null || value === undefined) return undefined;
			const n = Number(value);
			return Number.isFinite(n) ? n : NaN;
		}

		/**
		 * Pricing & cost editor — the settings section's second-level page.
		 * Reads `/pulse/settings` (effective rules, USD→CNY rate, the model
		 * catalog, the official baseline and writability), edits rows locally,
		 * and persists via `POST /pulse/settings` (or `{reset: true}`). Rows
		 * without any rate are not persisted; duplicate model ids are refused.
		 * Usage-derived fallback rows come from a 90-day stats window (warmed
		 * on open, so removed-from-catalog models still surface). After a save
		 * the shared stats store reloads so every dashboard surface reflects
		 * the new prices at once; when the saved section changed a model's
		 * peak hours the reply says so and the host re-folds history in the
		 * background.
		 */
		function PricingPage({ t }) {
			const [state, setState] = useState({
				status: "loading", costEnabled: true, usdToCny: String(DEFAULT_USD_TO_CNY),
				rows: [], official: [], writable: false, hasCatalog: false,
				saving: false, saved: false, refold: false, error: null,
			});
			const stats = useSyncExternalStore(subscribeStats, () => statsState);
			const load = () => {
				fetch("/pulse/settings", { credentials: "same-origin", headers: { accept: "application/json" } })
					.then(async (res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then((data) => setState((s) => ({
						...s, status: "ready",
						costEnabled: data.costEnabled !== false,
						usdToCny: String(Number(data.fx?.usdToCny) > 0 ? data.fx.usdToCny : DEFAULT_USD_TO_CNY),
						rows: s.status === "ready" ? mergeRows(buildEditorRows(data, statsState.data?.knownModels ?? []), s.rows) : buildEditorRows(data, statsState.data?.knownModels ?? []),
						official: Array.isArray(data.official) ? data.official : [],
						hasCatalog: (Array.isArray(data.catalog) ? data.catalog : []).some((group) => (group.models ?? []).length > 0),
						writable: data.writable === true,
						error: null,
					})))
					.catch((error) => setState((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
			};
			// Warm the shared store with a 90-day window (wider than the
			// dashboard's default 7) so usage-derived fallback rows surface
			// models last used weeks ago; then load settings once data (or a
			// definitive error) exists, so rows never miss the usage list.
			useEffect(() => {
				if (statsState.key === null) {
					const day = localDay(Date.now());
					loadStats(shiftDay(day, -89), day);
				}
			}, []);
			useEffect(() => {
				if ((stats.data !== null || stats.status === "error") && state.status === "loading") load();
			}, [stats.data, stats.status, state.status]);

			const patchRow = (i, fn) => setState((s) => ({
				...s, saved: false, refold: false,
				rows: s.rows.map((row, j) => (j === i ? fn(row) : row)),
			}));
			const patch = (i, key, value) => patchRow(i, (row) => ({ ...row, [key]: value }));
			const patchPeak = (i, key, value) => patchRow(i, (row) => ({ ...row, peak: { ...row.peak, [key]: value } }));
			/** First click on a default (official) strip starts from the
			 *  official set so the edit is "change one hour", not "clear all";
			 *  deselecting every hour is meaningful — explicit flat pricing. */
			const toggleHour = (i, hour) => patchRow(i, (row) => {
				const base = row.peakHours ?? [...OFFICIAL_PEAK_HOURS];
				const next = base.includes(hour) ? base.filter((h) => h !== hour) : [...base, hour].sort((a, b) => a - b);
				return { ...row, peakHours: next };
			});
			const addRow = () => setState((s) => ({
				...s, saved: false, refold: false,
				rows: [...s.rows, {
					model: "", name: "", group: "", origin: "custom",
					input: "", cacheRead: "", output: "", currency: "CNY",
					peak: { input: "", cacheRead: "", output: "" }, peakHours: null, expanded: false, removable: true,
				}],
			}));
			/** Per-row "restore official rates" (official models only): reset
			 *  every editable field to the untouched official baseline. */
			const officialMap = useMemo(() => new Map(state.official.map((rule) => [rule.model, rule])), [state.official]);
			const restoreOfficial = (i) => patchRow(i, (row) => {
				const rule = officialMap.get(row.model);
				if (rule === undefined) return row;
				return {
					...row,
					input: rule.input ?? "", cacheRead: rule.cacheRead ?? "", output: rule.output ?? "",
					currency: rule.currency === "USD" ? "USD" : "CNY",
					peak: {
						input: rule.peak?.input ?? "", cacheRead: rule.peak?.cacheRead ?? "", output: rule.peak?.output ?? "",
					},
					peakHours: null,
					expanded: rule.peak !== null && typeof rule.peak === "object",
				};
			});

			/** Persisted rules from the local rows: only rows with at least one
			 *  finite rate and a non-empty model id survive. */
			const buildRows = () => state.rows
				.map((row) => {
					const model = String(row.model ?? "").trim();
					const input = cleanNum(row.input);
					const cacheRead = cleanNum(row.cacheRead);
					const output = cleanNum(row.output);
					const pi = cleanNum(row.peak?.input);
					const pc = cleanNum(row.peak?.cacheRead);
					const po = cleanNum(row.peak?.output);
					if (model === "") return null;
					if (![input, cacheRead, output, pi, pc, po].some((v) => typeof v === "number" && Number.isFinite(v))) return null;
					const out = { model };
					if (input !== undefined) out.input = input;
					if (cacheRead !== undefined) out.cacheRead = cacheRead;
					if (output !== undefined) out.output = output;
					if (pi !== undefined || pc !== undefined || po !== undefined) {
						out.peak = {};
						if (pi !== undefined) out.peak.input = pi;
						if (pc !== undefined) out.peak.cacheRead = pc;
						if (po !== undefined) out.peak.output = po;
					}
					if (Array.isArray(row.peakHours)) out.peakHours = row.peakHours;
					return out;
				})
				.filter((row) => row !== null);
			const fxNumber = () => cleanNum(state.usdToCny);

			/** Live preview: the loaded stats window priced with the edited
			 *  (unsaved) rules and rate, through the same pure view model the
			 *  dashboard uses — so the number can never disagree with it. */
			const preview = useMemo(() => {
				const data = stats.data;
				if (data === null || state.status !== "ready") return null;
				const rules = buildRows();
				const fx = fxNumber();
				if (rules.length === 0 || typeof fx !== "number" || !Number.isFinite(fx) || fx <= 0) return null;
				return buildView(data.sessions, {
					granularity: "day", from: data.fromDay, to: data.toDay,
					pricing: rules, fx: { usdToCny: fx },
				}).cost;
			}, [stats.data, state.rows, state.usdToCny, state.status]);

			const persist = (payload) => {
				setState((s) => ({ ...s, saving: true, saved: false, refold: false, error: null }));
				fetch("/pulse/settings", {
					method: "POST",
					credentials: "same-origin",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify(payload),
				})
					.then(async (res) => {
						const data = await res.json().catch(() => ({}));
						if (!res.ok || data?.ok !== true) throw new Error(data?.error ?? `HTTP ${res.status}`);
						setState((s) => ({ ...s, saving: false, saved: true, refold: data?.refold === true, error: null }));
						// The dashboard's cached payload is stale now — drop it and
						// reload the current window so the new prices show at once.
						if (statsState.key !== null) {
							payloadCache.delete(statsState.key);
							loadStats(statsState.from, statsState.to);
						}
						load();
					})
					.catch((error) => setState((s) => ({ ...s, saving: false, error: String(error?.message ?? error) })));
			};
			const save = () => {
				const rows = buildRows();
				const ids = rows.map((row) => row.model);
				if (ids.some((id, i) => ids.indexOf(id) !== i)) {
					setState((s) => ({ ...s, error: t("setDupModel") }));
					return;
				}
				const bad = rows.some((row) => [row.input, row.cacheRead, row.output, row.peak?.input, row.peak?.cacheRead, row.peak?.output]
					.some((v) => typeof v === "number" && !Number.isFinite(v)));
				const fx = fxNumber();
				if (bad || typeof fx !== "number" || !Number.isFinite(fx) || fx <= 0) {
					setState((s) => ({ ...s, error: t("setBadNumber") }));
					return;
				}
				persist({ costEnabled: state.costEnabled === true, pricing: rows });
			};
			const reset = () => persist({ reset: true });
			const setField = (label, value, onChange) => jsxs("div", { className: "dp_setField", key: label, children: [
				jsx("span", { className: "dp_setLabel", children: label }),
				jsx("input", {
					className: "dp_setInput", inputMode: "decimal",
					value: value === undefined || value === null ? "" : String(value),
					disabled: !state.writable || state.saving,
					onChange: (e) => onChange(e.target.value),
				}),
			] });

			/** One editor row: identity (read-only catalog rows / editable
			 *  manual rows), three off-peak rates, currency, peak toggle. */
			const rowView = (row, i) => jsxs("div", { children: [
				jsxs("div", { className: "dp_setRow", children: [
					row.origin === "custom"
						? jsxs("div", { className: "dp_setField dp_setModel", children: [
							jsx("span", { className: "dp_setLabel", children: t("setModel") }),
							jsx("input", {
								className: "dp_setInput",
								value: row.model,
								disabled: !state.writable || state.saving,
								onChange: (e) => patch(i, "model", e.target.value),
							}),
						] })
						: jsxs("div", { className: "dp_setModelInfo", children: [
							jsx("span", { className: "dp_modelId", title: row.model, children: row.model }),
							jsxs("span", { className: "dp_modelName", children: [
								row.name !== "" ? row.name : null,
								row.name !== "" && officialMap.has(row.model) ? " · " : null,
								officialMap.has(row.model)
									? jsx("button", {
										type: "button", className: "dp_setLink",
										disabled: !state.writable || state.saving,
										onClick: () => restoreOfficial(i),
										children: t("setOfficialReset"),
									})
									: null,
							] }),
						] }),
					setField(t("setInput"), row.input, (v) => patch(i, "input", v)),
					setField(t("setCache"), row.cacheRead, (v) => patch(i, "cacheRead", v)),
					setField(t("setOutput"), row.output, (v) => patch(i, "output", v)),
					jsx("button", {
						type: "button",
						className: `dp_miniBtn${row.expanded ? " dp_miniBtnOn" : ""}`,
						"aria-expanded": row.expanded,
						disabled: !state.writable || state.saving,
						onClick: () => patch(i, "expanded", !row.expanded),
						children: t("setPeakToggle"),
					}),
					row.removable && jsx("button", {
						type: "button", className: "dp_setRemove",
						disabled: !state.writable || state.saving,
						onClick: () => setState((s) => ({ ...s, saved: false, rows: s.rows.filter((_, j) => j !== i) })),
						children: t("setRemove"),
					}),
				] }),
				row.expanded && jsxs("div", { className: "dp_peakSub", children: [
					jsxs("div", { className: "dp_setRow", children: [
						setField(t("setPeakIn"), row.peak?.input, (v) => patchPeak(i, "input", v)),
						setField(t("setPeakCache"), row.peak?.cacheRead, (v) => patchPeak(i, "cacheRead", v)),
						setField(t("setPeakOut"), row.peak?.output, (v) => patchPeak(i, "output", v)),
					] }),
					jsxs("div", { className: "dp_setField", children: [
						jsxs("span", { className: "dp_setLabel", style: { marginBottom: "6px" }, children: [
							`${t("setPeakHours")} `,
							jsx("button", {
								type: "button", className: "dp_setLink",
								disabled: !state.writable || state.saving,
								onClick: () => patch(i, "peakHours", null),
								children: t("setPeakReset"),
							}),
						] }),
						jsxs("div", { className: "dp_peakGrid", role: "group", "aria-label": t("setPeakHours"), children: [
							Array.from({ length: 24 }, (_, h) => {
								const on = (row.peakHours ?? OFFICIAL_PEAK_HOURS).includes(h);
								return jsx("button", {
									type: "button",
									className: `dp_hourCell${on ? " dp_hourCellOn" : ""}`,
									"aria-pressed": on,
									disabled: !state.writable || state.saving,
									onClick: () => toggleHour(i, h),
									children: String(h).padStart(2, "0"),
								}, h);
							}),
						] }),
					] }),
				] }),
			] }, `${row.origin}:${row.model || "new"}:${i}`);

			/** Interleave group headers with the rows (catalog providers first,
			 *  then the usage and custom fallback groups when present). */
			const rendered = [];
			let lastCatalogGroup = null;
			let usageHeaderDone = false;
			let customHeaderDone = false;
			state.rows.forEach((row, i) => {
				if (row.origin === "catalog") {
					if (row.group !== lastCatalogGroup) {
						rendered.push(jsx("div", { className: "dp_setGroup", key: `g${i}`, children: row.group }));
						lastCatalogGroup = row.group;
					}
				} else if (row.origin === "usage") {
					if (!usageHeaderDone) {
						rendered.push(jsx("div", { className: "dp_setGroup", key: "gu", children: t("setGroupUsage") }));
						usageHeaderDone = true;
					}
				} else if (!customHeaderDone) {
					rendered.push(jsx("div", { className: "dp_setGroup", key: "gc", children: t("setGroupCustom") }));
					customHeaderDone = true;
				}
				rendered.push(rowView(row, i));
			});

			let body;
			if (state.status === "loading") {
				body = jsx("span", { className: "dp_costNote", children: t("setLoading") });
			} else if (state.status === "error") {
				body = jsxs("span", { className: "dp_setMsg dp_setMsgErr", children: [
					fill(t("setFailed"), { err: state.error }),
					" ",
					jsx("button", { type: "button", className: "dp_setRemove", onClick: load, children: t("retry") }),
				] });
			} else {
				body = jsxs("div", { className: "dp_setGrid", children: [
					jsxs("label", { className: "dp_setSwitch", children: [
						jsx("input", {
							type: "checkbox",
							checked: state.costEnabled === true,
							disabled: !state.writable || state.saving,
							onChange: (e) => setState((s) => ({ ...s, costEnabled: e.target.checked, saved: false })),
						}),
						jsx("span", { children: t("costEnabledLabel") }),
					] }),
					jsx("span", { className: "dp_costNote", children: t("costEnabledHint") }),
					!state.hasCatalog && jsx("span", { className: "dp_costNote", children: t("setCatalogEmpty") }),
					jsx("span", { className: "dp_costNote", children: t("setPeakNote") }),
					...rendered,
					jsxs("div", { className: "dp_setActions", children: [
						jsx(primitives.Button, {
							variant: "outline", size: "sm",
							disabled: !state.writable || state.saving,
							onClick: addRow,
							children: t("setAdd"),
						}),
						jsx(primitives.Button, {
							variant: "primary", size: "sm",
							disabled: !state.writable || state.saving,
							onClick: save,
							children: t("setSave"),
						}),
						jsx(primitives.Button, {
							variant: "outline", size: "sm",
							disabled: !state.writable || state.saving,
							onClick: reset,
							children: t("setReset"),
						}),
						jsx(primitives.Button, {
							variant: "outline", size: "sm",
							disabled: state.saving,
							onClick: load,
							title: t("setRefresh"),
							children: t("setRefresh"),
						}),
						state.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
						state.saved && state.refold && jsx("span", { className: "dp_costNote", children: t("setRefold") }),
						state.error !== null && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: state.error }) }),
					] }),
					preview !== null && preview.configured === true && jsxs("div", { className: "dp_setPreview", children: [
						`${fill(t("setPreview"), { n: daysBetween(stats.data.fromDay, stats.data.toDay) })}: ${fmtCost(preview.total ?? 0)} CNY`,
						(preview.convertedFromUsd || 0) > 0 ? ` · ${fill(t("fxNote"), { r: preview.usdToCny })}` : "",
					] }),
					!state.writable && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: t("setNotWritable") }),
					jsx("span", { className: "dp_costNote", children: t("setHint") }),
				] });
			}
			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("setSub") }),
				body,
			] });
		}
		//#endregion

		//#region compare page
		/** Preset usage scenarios (total input in millions, output/input %,
		 *  cache hit %). The real-usage preset is computed from the loaded
		 *  stats window instead of a fixed value. */
		const COMPARE_PRESETS = {
			avg: { input: 100, ratio: 0.57, hit: 98.9 },
			long: { input: 100, ratio: 1.05, hit: 97.38 },
			massive: { input: 100, ratio: 0.32, hit: 99.48 },
		};
		const COMPARE_STATE_KEY = "dsh-pulse:compare-state";
		const clampNum = (v, min, max) => Math.min(max, Math.max(min, v));
		/** One tier's resolved rates for a pricing rule (cache-hit falls back
		 *  to the miss rate; a rule without a `peak` block is flat, so the
		 *  peak tier equals the off-peak one). Mirrors the view model's
		 *  `resolveRates` so the compare page can never disagree with the
		 *  dashboard's cost estimate. */
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
				out: Number(rule.peak.output) || offOutput,
			};
		}
		function loadCompareState() {
			try {
				const raw = localStorage.getItem(COMPARE_STATE_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					return {
						visible: parsed !== null && typeof parsed === "object" && parsed.visible !== null && typeof parsed.visible === "object"
							? parsed.visible
							: {},
						manuals: Array.isArray(parsed?.manuals)
							? parsed.manuals
								.filter((m) => m !== null && typeof m === "object" && typeof m.name === "string")
								.map((m) => ({ id: String(m.id), name: m.name, miss: Number(m.miss) || 0, hit: Number(m.hit) || 0, out: Number(m.out) || 0 }))
							: [],
						tiers: parsed !== null && typeof parsed === "object" && parsed.tiers !== null && typeof parsed.tiers === "object"
							? parsed.tiers
							: {},
					};
				}
			} catch (error) { /* private mode or quota — fall through to defaults */ }
			return { visible: {}, manuals: [], tiers: {} };
		}
		function saveCompareState(state) {
			try { localStorage.setItem(COMPARE_STATE_KEY, JSON.stringify(state)); } catch (error) { /* non-fatal */ }
		}

		/**
		 * Plan compare — the settings section's third-level page. One usage
		 * scenario (total input, output/input ratio, cache hit rate) priced
		 * against rate plans. Plans are the *effective pricing rules* read
		 * through `/pulse/settings` (official defaults merged with the pricing
		 * page's edits), so rate changes show up here automatically; rule rows
		 * cannot be deleted, only hidden. Temporary manual plans can be added
		 * and removed, and live in localStorage alongside the per-plan
		 * visibility toggles. The scenario can be taken from the loaded real
		 * stats window or set by hand.
		 */
		function ComparePage({ t }) {
			const [settings, setSettings] = useState({ status: "loading", pricing: [], catalog: [], fx: null, currency: "CNY", error: null });
			const [params, setParams] = useState({ ...COMPARE_PRESETS.avg });
			const [preset, setPreset] = useState("avg");
			const [state, setState] = useState(loadCompareState);
			const stats = useSyncExternalStore(subscribeStats, () => statsState);

			useEffect(() => {
				fetch("/pulse/settings", { credentials: "same-origin", headers: { accept: "application/json" } })
					.then(async (res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then((data) => setSettings({
						status: "ready",
						pricing: Array.isArray(data.pricing) ? data.pricing : [],
						catalog: Array.isArray(data.catalog) ? data.catalog : [],
						fx: Number(data.fx?.usdToCny) > 0 ? Number(data.fx.usdToCny) : DEFAULT_USD_TO_CNY,
						currency: data.currency === "USD" ? "USD" : "CNY",
						error: null,
					}))
					.catch((error) => setSettings((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
			}, []);
			// Warm the shared store with a 30-day window so the real-usage
			// preset has something to derive from.
			useEffect(() => {
				if (statsState.key === null) {
					const day = localDay(Date.now());
					loadStats(shiftDay(day, -29), day);
				}
			}, []);

			const patchState = (fn) => setState((prev) => { const next = fn(prev); saveCompareState(next); return next; });

			/** Real-usage scenario over the loaded window. Miss input includes
			 *  cache writes (same convention as the cost estimate), hits are
			 *  cache reads, and the ratio is output over the whole input side. */
			const real = useMemo(() => {
				const data = stats.data;
				if (data === null || !Array.isArray(data.sessions)) return null;
				const totals = buildView(data.sessions, { granularity: "day", from: data.fromDay, to: data.toDay }).totals;
				const side = totals.input + totals.cacheRead + totals.cacheWrite;
				if (!(side > 0)) return null;
				const round3 = (v) => Math.round(v * 1000) / 1000;
				return {
					input: round3(side / 1e6),
					ratio: round3((totals.output / side) * 100),
					hit: round3((totals.cacheRead / side) * 100),
					from: data.fromDay,
					to: data.toDay,
				};
			}, [stats.data]);

			/** Catalog display names, so rule rows read as the Models page
			 *  shows them instead of bare ids. */
			const displayNames = useMemo(() => {
				const map = new Map();
				for (const group of settings.catalog) {
					for (const model of Array.isArray(group.models) ? group.models : []) {
						if (typeof model?.id === "string") map.set(model.id, model.name ?? "");
					}
				}
				return map;
			}, [settings.catalog]);

			/** Effective plans: one read-only row per pricing rule (tied to
			 *  the pricing page) plus the temporary manual plans. Each rule
			 *  row prices at its own off-peak/peak tier (rules without a
			 *  `peak` block are flat and carry no switch); manual plans are
			 *  single-tier by definition. */
			const rows = useMemo(() => {
				const ruleRows = settings.pricing
					.filter((rule) => typeof rule?.model === "string" && rule.model !== "")
					.map((rule) => {
						const hasPeak = rule.peak !== null && typeof rule.peak === "object";
						const rowTier = state.tiers[rule.model] === "peak" ? "peak" : "offpeak";
						const rates = rateOf(rule, rowTier);
						const display = displayNames.get(rule.model);
						return {
							key: `rule:${rule.model}`,
							origin: "rule",
							id: rule.model,
							model: rule.model,
							name: typeof display === "string" && display !== "" ? display : rule.model,
							miss: rates.miss, hit: rates.hit, out: rates.out,
							currency: rule.currency === "USD" ? "USD" : "CNY",
							tier: rowTier, hasPeak,
						};
					});
				const manualRows = state.manuals.map((m) => ({
					key: `manual:${m.id}`,
					origin: "manual",
					id: m.id,
					model: "",
					name: m.name,
					miss: m.miss, hit: m.hit, out: m.out,
					currency: settings.currency === "USD" ? "USD" : "CNY",
				}));
				return [...ruleRows, ...manualRows];
			}, [settings.pricing, settings.catalog, settings.currency, state.manuals, state.tiers, displayNames]);

			const isVisible = (key) => state.visible[key] !== false;
			const toggleVisible = (key) => patchState((s) => ({ ...s, visible: { ...s.visible, [key]: s.visible[key] === false } }));
			/** Per-rule peak/off-peak display switch — a row-level option, not
			 *  a page-wide one, because manual plans are single-tier. */
			const toggleTier = (model) => patchState((s) => ({
				...s,
				tiers: { ...s.tiers, [model]: s.tiers[model] === "peak" ? "offpeak" : "peak" },
			}));
			const showAll = () => patchState((s) => {
				const visible = { ...s.visible };
				for (const row of rows) visible[row.key] = true;
				return { ...s, visible };
			});
			const addManual = () => patchState((s) => ({
				...s,
				manuals: [...s.manuals, { id: String(Date.now()), name: `${t("cmpManual")} ${s.manuals.length + 1}`, miss: 1, hit: 0.2, out: 2 }],
			}));
			const patchManual = (id, fn) => patchState((s) => ({
				...s,
				manuals: s.manuals.map((m) => (m.id === id ? fn(m) : m)),
			}));
			const removeManual = (id) => patchState((s) => {
				const visible = { ...s.visible };
				delete visible[`manual:${id}`];
				return { ...s, visible, manuals: s.manuals.filter((m) => m.id !== id) };
			});

			const setParam = (key, value) => { setParams((p) => ({ ...p, [key]: value })); setPreset(""); };
			const applyReal = () => {
				if (real === null) return;
				setParams({
					input: clampNum(real.input, 0.1, 1e9),
					ratio: clampNum(real.ratio, 0, 50),
					hit: clampNum(real.hit, 0, 100),
				});
				setPreset("real");
			};
			const applyPreset = (key) => { setParams({ ...COMPARE_PRESETS[key] }); setPreset(key); };

			const { input, ratio, hit } = params;
			const hitM = input * hit / 100;
			const missM = input * (1 - hit / 100);
			const outM = input * ratio / 100;
			const results = rows
				.filter((r) => isVisible(r.key))
				.map((r) => ({
					...r,
					cost: (missM * r.miss + hitM * r.hit + outM * r.out) * (r.currency === "USD" ? settings.fx : 1),
				}));
			const bestCost = results.length > 1 ? Math.min(...results.map((r) => r.cost)) : null;
			const maxCost = niceMax(Math.max(...results.map((r) => r.cost), 1e-6));

			/** Slider + number input bound to one scenario parameter. The
			 *  slider keeps its range cap for granular dragging; the number
			 *  input accepts larger values when `inputMax` is given (the
			 *  slider just pins at its max). */
			const paramControl = (label, key, sliderMin, sliderMax, step, inputMax) => jsxs("div", { className: "dp_cmpControl", children: [
				jsxs("span", { className: "dp_cmpLabel", children: [
					jsx("span", { children: label }),
					jsx("span", { className: "dp_cmpValue", children: String(params[key].toFixed(step >= 1 ? 1 : 2)) }),
				] }),
				jsxs("div", { className: "dp_cmpRow", children: [
					jsx("input", {
						type: "range", className: "dp_cmpRange", min: sliderMin, max: sliderMax, step,
						value: Math.min(params[key], sliderMax),
						onChange: (e) => setParam(key, Number(e.target.value)),
					}),
					jsx("input", {
						type: "number", className: "dp_cmpNum", min: sliderMin,
						...(inputMax !== undefined ? { max: inputMax } : {}),
						step,
						value: params[key].toFixed(step >= 1 ? 1 : 2),
						onChange: (e) => {
							const v = Number(e.target.value);
							if (Number.isFinite(v)) setParam(key, clampNum(v, sliderMin, inputMax ?? sliderMax));
						},
					}),
				] }),
			] });

			const visCheck = (key, label) => jsx("input", {
				type: "checkbox", className: "dp_cmpVis",
				checked: isVisible(key),
				"aria-label": label,
				title: label,
				onChange: () => toggleVisible(key),
			});

			/** Read-only rule row: model id + catalog name, the row's tier
			 *  rates, a per-row peak/off-peak switch (rules with a `peak`
			 *  block only) and the currency. Deletion is not offered — the
			 *  row follows the pricing page. */
			const ruleRow = (r) => {
				const rateField = (label, value) => jsxs("div", { className: "dp_setField", children: [
					jsx("span", { className: "dp_setLabel", children: label }),
					jsx("span", { className: "dp_cmpRate", children: String(value) }),
				] });
				return jsxs("div", { className: "dp_setRow", children: [
					visCheck(r.key, r.name),
					jsxs("div", { className: "dp_setField", children: [
						jsxs("span", { className: "dp_setLabel", children: [
							jsx("span", { className: "dp_cmpRuleTag", children: t("cmpFromRules") }),
						] }),
						jsx("span", { className: "dp_cmpModelName", title: r.model, children: r.name }),
					] }),
					rateField(t("cmpMiss"), r.miss),
					rateField(t("cmpHitIn"), r.hit),
					rateField(t("cmpOut"), r.out),
					r.hasPeak && jsx("button", {
						type: "button",
						className: `dp_miniBtn${r.tier === "peak" ? " dp_miniBtnOn" : ""}`,
						title: t("cmpTierHint"),
						onClick: () => toggleTier(r.model),
						children: r.tier === "peak" ? t("cmpTierPeak") : t("cmpTierOffpeak"),
					}),
				] }, r.key);
			};

			/** Editable manual row: name, three rates, remove. */
			const manualRow = (m) => {
				const field = (label, key) => jsxs("div", { className: "dp_setField", children: [
					jsx("span", { className: "dp_setLabel", children: label }),
					jsx("input", {
						className: "dp_setInput", inputMode: "decimal",
						value: m[key],
						onChange: (e) => patchManual(m.id, (row) => ({ ...row, [key]: Number(e.target.value) || 0 })),
					}),
				] });
				return jsxs("div", { className: "dp_setRow", children: [
					visCheck(`manual:${m.id}`, m.name),
					jsxs("div", { className: "dp_setField dp_setModel", children: [
						jsx("span", { className: "dp_setLabel", children: t("cmpName") }),
						jsx("input", {
							className: "dp_setInput",
							value: m.name,
							onChange: (e) => patchManual(m.id, (row) => ({ ...row, name: e.target.value })),
						}),
					] }),
					field(t("cmpMiss"), "miss"),
					field(t("cmpHitIn"), "hit"),
					field(t("cmpOut"), "out"),
					jsx("button", {
						type: "button", className: "dp_setRemove",
						onClick: () => removeManual(m.id),
						children: t("setRemove"),
					}),
				] }, `manual:${m.id}`);
			};

			/** One result card: plan name, scenario split, the row's rates
			 *  (with the tier when the rule has one), cost, best badge, bar. */
			const resultCard = (r, i) => {
				const isBest = bestCost !== null && r.cost === bestCost;
				return jsxs("div", { className: `dp_cmpCard${isBest ? " dp_cmpBest" : ""}`, children: [
					jsxs("div", { className: "dp_cmpCardInfo", children: [
						jsxs("div", { className: "dp_cmpCardHead", children: [
							jsx("span", { className: "dp_cmpCardName", children: r.name }),
							isBest && jsx("span", { className: "dp_cmpBadge", children: t("cmpBest") }),
						] }),
						jsxs("div", { className: "dp_cmpCardDetail", children: [
							jsx("span", { children: fill(t("cmpDetail"), { hit: hitM.toFixed(1), miss: missM.toFixed(1), out: outM.toFixed(1) }) }),
							jsx("span", { children: `${t("cmpRates")} ${r.miss} / ${r.hit} / ${r.out}${r.origin === "rule" && r.hasPeak ? ` · ${r.tier === "peak" ? t("cmpTierPeak") : t("cmpTierOffpeak")}` : ""}` }),
						] }),
					] }),
					jsxs("div", { className: "dp_cmpCardRight", children: [
						jsxs("div", { className: "dp_cmpCardCost", children: [
							fmtCost(r.cost),
							jsx("small", { children: t("cmpUnit") }),
						] }),
						jsx("div", { className: "dp_cmpBarOuter", children: jsx("div", { className: "dp_cmpBar", style: { width: `${Math.min(100, (r.cost / maxCost) * 100)}%` } }) }),
					] }),
				] }, `${i}:${r.name}`);
			};

			const presetBtn = (key, label, disabled) => jsx("button", {
				type: "button",
				className: `dp_segBtn${preset === key ? " dp_segBtnActive" : ""}`,
				disabled: disabled === true,
				onClick: () => (key === "real" ? applyReal() : applyPreset(key)),
				children: label,
			}, key);

			const rowView = (r) => (r.origin === "rule" ? ruleRow(r) : manualRow(r));

			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("cmpSub") }),
				jsxs("div", { className: "dp_cmpControls", children: [
					paramControl(t("cmpInput"), "input", 0.1, 1000, 0.1, 1e9),
					paramControl(t("cmpRatio"), "ratio", 0, 50, 0.01),
					paramControl(t("cmpHit"), "hit", 0, 100, 0.01),
				] }),
				jsxs("div", { className: "dp_cmpPresets", children: [
					presetBtn("real", t("cmpReal"), real === null),
					presetBtn("avg", t("cmpAvg")),
					presetBtn("long", t("cmpLong")),
					presetBtn("massive", t("cmpMassive")),
					real === null
						? jsx("span", { className: "dp_costNote", children: t("cmpNoData") })
						: preset === "real" && jsx("span", { className: "dp_costNote", children: fill(t("cmpBased"), { from: real.from, to: real.to }) }),
				] }),
				jsxs("div", { className: "dp_setGrid", children: [
					settings.status === "loading"
						? jsx("span", { className: "dp_costNote", children: t("setLoading") })
						: settings.status === "error"
							? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: settings.error }) })
							: rows.map(rowView),
					jsxs("div", { className: "dp_setActions", children: [
						jsx(primitives.Button, { variant: "outline", size: "sm", onClick: addManual, children: t("cmpAdd") }),
						jsx("button", { type: "button", className: "dp_setLink", onClick: showAll, children: t("cmpShowAll") }),
						jsx("span", { className: "dp_costNote", children: t("cmpHint") }),
					] }),
				] }),
				results.length > 0
					? jsxs("div", { className: "dp_cmpCards", children: results.map(resultCard) })
					: jsx("span", { className: "dp_costNote", children: t("cmpEmpty") }),
			] });
		}
		//#endregion

		//#region panels page
		/** Display settings — which observatory panels render, plus the
		 *  sidebar balance toggle. Local preferences only. */
		const PANEL_ITEMS = (t) => [
			["chips", t("panelChips")],
			["balance", t("panelBalance")],
			["trend", t("panelTrend")],
			["cache", t("panelCache")],
			["models", t("panelModels")],
			["projects", t("panelProjects")],
			["cost", t("panelCost")],
			["budget", t("panelBudget")],
			["footBalance", t("panelFootBalance")],
		];
		function PanelsPage({ t }) {
			const [panels, setPanels] = useState(loadPanels);
			const [currency, setCurrency] = useState({
				status: "loading", code: "CNY", usdToCny: String(DEFAULT_USD_TO_CNY),
				writable: false, saving: false, saved: false, error: null,
			});
			const toggle = (key) => setPanels((prev) => {
				const next = { ...prev, [key]: prev[key] === false };
				savePanels(next);
				return next;
			});
			const loadCurrency = () => {
				fetch("/pulse/settings", { credentials: "same-origin", headers: { accept: "application/json" } })
					.then(async (res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then((data) => setCurrency((s) => ({
						...s, status: "ready",
						code: data.currency === "USD" ? "USD" : "CNY",
						usdToCny: String(Number(data.fx?.usdToCny) > 0 ? data.fx.usdToCny : DEFAULT_USD_TO_CNY),
						writable: data.writable === true,
						error: null,
					})))
					.catch((error) => setCurrency((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
			};
			useEffect(loadCurrency, []);
			const saveCurrency = () => {
				const fx = Number(currency.usdToCny);
				if (!Number.isFinite(fx) || fx <= 0) {
					setCurrency((s) => ({ ...s, error: t("setBadNumber") }));
					return;
				}
				setCurrency((s) => ({ ...s, saving: true, saved: false, error: null }));
				fetch("/pulse/settings", {
					method: "POST", credentials: "same-origin",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ currency: currency.code, usdToCny: fx }),
				})
					.then(async (res) => {
						const data = await res.json().catch(() => ({}));
						if (!res.ok || data?.ok !== true) throw new Error(data?.error ?? `HTTP ${res.status}`);
						setCurrency((s) => ({ ...s, saving: false, saved: true, error: null }));
						// The dashboard's cached payload prices with the old
						// rules/rate — drop it and reload the current window.
						if (statsState.key !== null) {
							payloadCache.delete(statsState.key);
							loadStats(statsState.from, statsState.to);
						}
					})
					.catch((error) => setCurrency((s) => ({ ...s, saving: false, error: String(error?.message ?? error) })));
			};
			const curBtn = (code) => jsx("button", {
				type: "button",
				className: `dp_segBtn${currency.code === code ? " dp_segBtnActive" : ""}`,
				disabled: currency.status !== "ready" || !currency.writable || currency.saving,
				onClick: () => setCurrency((s) => ({ ...s, code, saved: false })),
				children: code,
			}, code);
			return jsxs("div", { className: "dp_setGrid", children: [
				jsxs("div", { className: "dp_setPanel", children: [
					jsx("div", { className: "dp_setSub", children: t("curHint") }),
					jsxs("div", { className: "dp_setRow", children: [
						jsxs("div", { className: "dp_seg", children: [curBtn("CNY"), curBtn("USD")] }),
						jsxs("div", { className: "dp_setField", children: [
							jsx("span", { className: "dp_setLabel", children: `${t("setFxLabel")} 1 USD =` }),
							jsx("input", {
								className: "dp_setInput dp_setFxInput", inputMode: "decimal",
								value: currency.usdToCny,
								disabled: currency.status !== "ready" || !currency.writable || currency.saving,
								onChange: (e) => setCurrency((s) => ({ ...s, usdToCny: e.target.value, saved: false })),
							}),
						] }),
						jsx(primitives.Button, {
							variant: "primary", size: "sm",
							disabled: currency.status !== "ready" || !currency.writable || currency.saving,
							onClick: saveCurrency,
							children: t("setSave"),
						}),
					] }),
					currency.status === "error"
						? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: currency.error }) })
						: !currency.writable && currency.status === "ready"
							? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: t("setNotWritable") })
							: currency.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
				] }),
				jsxs("div", { className: "dp_setPanel", children: [
					jsx("div", { className: "dp_setSub", children: t("panelsSub") }),
					jsxs("div", { className: "dp_panelsGrid", children: PANEL_ITEMS(t).map(([key, label]) => jsxs("label", { className: "dp_setSwitch", children: [
						jsx("input", { type: "checkbox", checked: panels[key] !== false, onChange: () => toggle(key) }),
						jsx("span", { children: label }),
					] }, key)) }),
				] }),
			] });
		}
		//#endregion

		//#region slot components
		/** settings.section page - owner props `{close}`, locale `t` via inject
		 *  face. Four levels of internal state (no shell navigation API): the
		 *  dashboard and the pricing / compare / settings pages. Every second
		 *  level header carries the full tab set (current page highlighted),
		 *  so the pages are reachable from each other without any pairwise
		 *  coupling; a fresh open always lands on the dashboard. */
		function PulseSection({ t }) {
			const [page, setPage] = useState("dashboard");
			/** One source of truth for the section tabs: label + target. */
			const tabs = [
				["pricing", t("setTitle")],
				["compare", t("compare")],
				["panels", t("panels")],
			];
			const tabButtons = tabs.map(([target, label], i) => jsx(primitives.Button, {
				variant: target === page ? "primary" : "outline", size: "sm",
				style: i === 0 ? { marginLeft: "auto" } : undefined,
				onClick: () => setPage(target),
				children: label,
			}, target));
			if (page !== "dashboard") {
				const title = page === "pricing" ? t("setTitle") : page === "compare" ? t("compare") : t("panels");
				const body = page === "pricing"
					? jsx(PricingPage, { t })
					: page === "compare"
						? jsx(ComparePage, { t })
						: jsx(PanelsPage, { t });
				return jsxs("div", { className: "dp_page", children: [
					jsxs("div", { className: "dp_headerRow", children: [
						jsx("button", { type: "button", className: "dp_backBtn", onClick: () => setPage("dashboard"), children: t("back") }),
						jsx("span", { className: "dp_title", children: title }),
						...tabButtons,
					] }),
					body,
				] });
			}
			return jsxs("div", { className: "dp_page", children: [
				jsx(PulseDashboard, {
					t,
					onConfigure: () => setPage("pricing"),
					headerExtra: jsxs("div", { className: "dp_headerRow", children: [
						jsx(primitives.Button, { variant: "outline", size: "sm", onClick: () => setPage("pricing"), children: t("configure") }),
						jsx(primitives.Button, { variant: "outline", size: "sm", onClick: () => setPage("compare"), children: t("compare") }),
						jsx(primitives.Button, { variant: "outline", size: "sm", onClick: () => setPage("panels"), children: t("panels") }),
					] }),
				}),
			] });
		}

		/** conversation.chat.commandview row for the `/pulse` command. */
		function PulseCommandCard({ t }) {
			return jsx("div", { className: "dp_card dp_variantCard", children: jsx(PulseDashboard, { t }) });
		}

		/** sidebar.footer.action - icon rail / labeled row that opens the
		 *  overlay. In the wide (labeled) form, the current official balance
		 *  rides along next to the label when the display setting is on. */
		function PulseFooterAction({ wide, t }) {
			const panels = loadPanels();
			const balance = useBalance(panels.footBalance !== false);
			const showBalance = wide && panels.footBalance !== false
				&& balance.data !== null && balance.data.ok === true;
			return jsx("button", {
				type: "button",
				className: `dp_footBtn${wide ? "" : " dp_footRail"}`,
				onClick: () => setOverlayOpen(true),
				"aria-label": t("openOverlay"),
				title: t("openOverlay"),
				children: wide
					? [jsx(primitives.IconDataOutline16, { key: "i", size: 16 }), jsx("span", { key: "l", children: t("nav") }),
						showBalance && jsx("span", { key: "b", className: "dp_footBalance", children: `¥${fmtCost(balance.data.total ?? 0)}` })]
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
