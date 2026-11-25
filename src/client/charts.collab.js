import { useMemo, jsx, jsxs } from "./react.js";
import { collaborationOf, fmtTokens, splitModelKey, timelineOfWork } from "../view.js";
import { fill } from "./stores.js";
import { Btn, Tag } from "./adapter.js";
	//#region collaboration — CollabPanel

	/** Whole-number percent face for shares. */
	const pct = (v) => `${Math.round(v * 100)}%`;

	/** A session id's readable tail (`session-` prefix dropped). */
	const shortId = (id) => (id === null || id === undefined ? "—" : String(id).replace(/^session-/, "").slice(0, 8));

	/** 协作归因：子代理与团队的用量按家族列出。家族头是发起委派的会话，成员
	 *  行是它（递归）派生的子会话，按各自日志里的 descriptor label 命名——
	 *  子代理的 LLM 标题是委派提示词的片段，fork 来的干脆是父会话的标题。
	 *  再往下是时间线工作行：任务树标题、报告与失败计数。数据全部来自会话
	 *  行的既有折叠，面板不做新的读取；窗口里没有子代理也没有时间线工作时
	 *  整节不渲染。token 只能归到会话粒度——usage 事件不带任务 id——所以
	 *  这里没有按任务的数字。 */
	export function CollabPanel({ groups = [], names, focusSessionId = null, timelineReady = false, onOpenTimeline = null, t }) {
		const families = useMemo(() => collaborationOf(groups), [groups]);
		const timelines = useMemo(() => timelineOfWork(groups), [groups]);
		if (families.length === 0 && timelines.length === 0) return null;
		const modelLabel = (key) => {
			if (key === null || key === undefined || key === "") return "—";
			const { provider, model } = splitModelKey(key);
			return typeof names?.labelOf === "function" ? names.labelOf(provider, model) : model;
		};
		const nameOf = (row) => row.label ?? row.title ?? shortId(row.id);
		/** 家族头：在窗口内的父会话按「工作区 · 名字」；父会话不在窗口内时
		 *  直说，成员仍按它归组。 */
		const headOf = (family) => {
			if (family.absentParent !== null) return fill(t("collabAbsentParent"), { id: shortId(family.absentParent) });
			const name = family.label ?? family.title ?? shortId(family.id);
			return family.project === null ? name : `${family.project} · ${name}`;
		};
		const familyShare = (family) => (family.familyTokens > 0 ? family.memberTokens / family.familyTokens : 0);
		/** 时间线深链只在当前会话的行上出现：宿主对不在屏幕上的会话不做事。 */
		const linkable = (row) => timelineReady === true && focusSessionId !== null && row.id === focusSessionId;
		return jsxs("div", { className: "dp_collab", children: [
			families.length > 0 && jsxs("div", { className: "dp_collabFamilies", children: [
				jsx("div", { className: "dp_collabRow dp_collabRowHead", children: [
					t("collabColMember"), t("stackModel"), t("colTokens"), "", t("collabColOffpeak"), t("collabColShare"),
				].map((cell, i) => jsx("span", { children: cell }, i)) }),
				...families.map((family) => jsxs("div", { className: "dp_collabFamily", children: [
					jsxs("div", { className: "dp_collabHead", children: [
						jsx("span", { className: "dp_collabHeadName", title: headOf(family), children: headOf(family) }),
						jsx("span", { className: "dp_collabHeadMeta", children: fill(t("collabMemberTokens"), {
							n: family.members.length, tokens: fmtTokens(family.memberTokens), pct: pct(familyShare(family)),
						}) }),
						Object.keys(family.teamNames).length > 0 && jsx(Tag, { tone: "info", fallbackClass: "dp_sessBadge", children: fill(t("collabTeam"), { n: Object.keys(family.teamNames).length }) }),
					] }),
					...family.members.map((m) => jsxs("div", { className: "dp_collabRow", style: { "--dp-nest": Math.max(0, m.nest - 1) }, children: [
						jsx("span", { className: "dp_collabName", title: nameOf(m), children: nameOf(m) }),
						jsx("span", { className: "dp_collabModel", title: modelLabel(m.topModel), children: modelLabel(m.topModel) }),
						jsx("span", { className: "dp_collabNum", children: fmtTokens(m.total) }),
						jsx("span", { className: "dp_barRowTrack dp_collabTrack", children: jsx("span", { className: "dp_barRowFill", style: { width: `${Math.max(2, m.share * 100)}%` } }) }),
						jsx("span", { className: "dp_collabPct", title: m.offpeakShare === null ? t("collabOffpeakNone") : undefined, children: m.offpeakShare === null ? "—" : fill(t("collabOffpeak"), { pct: pct(m.offpeakShare) }) }),
						jsx("span", { className: "dp_collabPct", children: pct(m.share) }),
					] }, m.id)),
				] }, family.id ?? `absent\u0000${family.absentParent ?? ""}`)),
			] }),
			timelines.length > 0 && jsxs("div", { className: "dp_collabTimelines", children: [
				jsx("div", { className: "dp_collabSubTitle", children: t("collabTimelineTitle") }),
				...timelines.map((row) => jsxs("div", { className: "dp_collabRow dp_collabRowTl", children: [
					jsx("span", { className: "dp_collabName", title: row.sessionTitle ?? undefined, children: row.title ?? shortId(row.id) }),
					jsx("span", { className: "dp_collabModel", children: row.project ?? "" }),
					jsx("span", { className: "dp_collabPct", children: fill(t("collabReports"), { n: row.reports }) }),
					jsx("span", { className: row.failures > 0 ? "dp_collabPct dp_collabFail" : "dp_collabPct", children: row.failures > 0 ? fill(t("collabFailures"), { n: row.failures }) : "" }),
					jsx("span", { className: "dp_collabLink", children: linkable(row)
						? jsx(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_miniBtn", onClick: () => onOpenTimeline?.(row.id), children: t("collabOpenTimeline") })
						: null }),
				] }, `${row.id ?? "row"}\u0000${row.title ?? ""}`)),
			] }),
		] });
	}
	//#endregion
