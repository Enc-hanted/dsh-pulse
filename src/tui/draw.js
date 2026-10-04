/**
 * TUI face — terminal drawing primitives (pure, no hooks): display-width
 * measurement, kinsoku-aware wrap, money labels, token abbreviations, heat
 * ramps, sparklines and block bars. Numbers and text → strings only; the
 * day gantt is the one view-model here (drawable cells for tests to pin).
 */

import { tokSum } from "./data.js";
import { moneyCny } from "../view.js";

export function compactTokens(n) {
	if (!Number.isFinite(n) || n <= 0) return "0";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(Math.round(n));
}

/** Space-tight token abbreviation for squeezed table rows: 180.6M → 181M.
 *  Exported for test/tui-test.mjs. */
export function compactTokensTight(n) {
	if (!Number.isFinite(n) || n <= 0) return "0";
	if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
	if (n >= 1000) return `${Math.round(n / 1000)}k`;
	return String(Math.round(n));
}

export function shortSessionId(id) {
	return String(id ?? "").replace(/^session-/, "").slice(0, 8);
}

export function clockOf(ms) {
	const d = new Date(ms);
	if (!Number.isFinite(d.getTime())) return null;
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Display width of a string (CJK and full-width forms count 2) —
 *  String.padEnd counts JS chars and staircase-d any CJK-heavy table.
 *  Exported for test/tui-test.mjs. */
export function displayWidth(s) {
	let w = 0;
	for (const ch of String(s ?? "")) w += ch.charCodeAt(0) > 0xff ? 2 : 1;
	return w;
}

export function padDisplay(text, width) {
	const s = String(text ?? "");
	const w = displayWidth(s);
	return w >= width ? s : s + " ".repeat(width - w);
}

export function padDisplayStart(text, width) {
	const s = String(text ?? "");
	const w = displayWidth(s);
	return w >= width ? s : " ".repeat(width - w) + s;
}

/** Truncate to a display-width budget, then pad to exactly `width`. */
export function fitDisplay(text, width) {
	const s = String(text ?? "");
	let out = "", w = 0;
	for (const ch of s) {
		const cw = ch.charCodeAt(0) > 0xff ? 2 : 1;
		if (w + cw > width) break;
		out += ch;
		w += cw;
	}
	return padDisplay(out, width);
}

/** Closing punctuation that may not START a wrapped line (basic kinsoku) —
 *  the year note once wrapped a lone "）" onto its own line. */
const CANNOT_START = new Set([..."）」』！？。，、：；…%》"]);

/** Display-width-aware greedy wrap. Hand-wrapped because Ink's naive wrap
 *  breaks on raw char counts (staircase) and strands closing punctuation.
 *  Exported for test/tui-test.mjs. */
export function wrapDisplay(text, width) {
	const s = String(text ?? "");
	const w = Math.max(1, width);
	if (displayWidth(s) <= w) return [s];
	const out = [];
	let line = "";
	for (const ch of s) {
		const cw = ch.charCodeAt(0) > 0xff ? 2 : 1;
		if (line !== "" && displayWidth(line) + cw > w) {
			out.push(line);
			line = "";
		}
		line += ch;
	}
	if (line !== "") out.push(line);
	for (let i = 1; i < out.length; i++) {
		while (out[i] !== "" && CANNOT_START.has(out[i][0])) {
			out[i - 1] += out[i][0];
			out[i] = out[i].slice(1);
		}
	}
	return out.filter((l) => l !== "");
}

/** Unified money label: ¥ never omitted, ≈ marks estimate-layer money.
 *  Bare numbers ("3.94" beside "138.5M tok") read as ambiguity — every
 *  amount in the scene goes through this. Exported for test/tui-test.mjs. */
export function money(cost, estimated) {
	const v = Number(cost);
	if (!Number.isFinite(v) || v <= 0) return "¥—";
	return `${estimated ? "≈" : ""}${moneyCny(v)}`;
}

/* ------------------------------------------------------------------ */
/* terminal drawing primitives (pure — no hooks)                       */
/* ------------------------------------------------------------------ */

/** Mix two #rrggbb colors; t=0 → a, t=1 → b. */
export function hexMix(a, b, t) {
	const pa = parseHex(a), pb = parseHex(b);
	if (!pa || !pb) return b ?? a;
	const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
	return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(color) {
	const m = /^#?([0-9a-f]{6})$/i.exec(String(color ?? "").trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Five-step activity ramp: empty tint, then background → accent mixes. */
export function heatRamp(theme) {
	const bg = theme?.background ?? "#000000";
	const accent = theme?.accent ?? "#5f87ff";
	const tint = hexMix(bg, accent, 0.09);
	return [tint, hexMix(bg, accent, 0.3), hexMix(bg, accent, 0.52), hexMix(bg, accent, 0.74), accent];
}

/** Log-ish 0..4 heat level so one heavy day doesn't flatten the month. */
export function heatLevel(value, max) {
	if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0;
	return Math.max(1, Math.min(4, Math.ceil((Math.log1p(value) / Math.log1p(max)) * 4)));
}

const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export function sparkline(values) {
	const max = values.reduce((m, v) => Math.max(m, v), 0);
	if (max <= 0) return SPARK[0].repeat(values.length);
	return values.map((v) => SPARK[Math.min(7, Math.floor((v / max) * 7.999))]).join("");
}

/** Single-row block sparkline, log1p-scaled. The year trend is heavy-tailed
 *  (one 138M day among zeros); linear scaling flattens every quiet week
 *  into the baseline — the braille chart's failure, now replaced.
 *  Exported for test/tui-test.mjs. */
export function sparkTrend(values) {
	const max = values.reduce((m, v) => Math.max(m, v), 0);
	if (max <= 0) return SPARK[0].repeat(values.length);
	const scale = Math.log1p(max);
	return values
		.map((v) => SPARK[v <= 0 ? 0 : Math.min(7, Math.floor((Math.log1p(v) / scale) * 7.999))])
		.join("");
}

/** Month trend as WEEKLY COLUMNS (2 cells per week, sqrt height): 30 daily
 *  points resampled into a dot chart read as noise — 4-6 named bars read
 *  as a chart. `labels` are the week-start day-of-month strings.
 *  Exported for test/tui-test.mjs. */
export function weeklyBars(values, labels, rows = 3) {
	const n = Math.max(values.length, labels.length);
	const max = values.reduce((m, v) => Math.max(m, v), 0);
	const heights = values.map((v) => (v <= 0 || max <= 0 ? 0 : Math.max(1, Math.round(Math.sqrt(v / max) * rows))));
	const lines = [];
	for (let r = rows; r >= 1; r--) {
		lines.push(Array.from({ length: n }, (_, i) => ((heights[i] ?? 0) >= r ? "██" : "  ")).join(" "));
	}
	const labelLine = Array.from({ length: n }, (_, i) => padDisplayStart(labels[i] ?? "", 2)).join(" ");
	let peakIdx = -1, peakVal = 0;
	values.forEach((v, i) => { if (v > peakVal) { peakVal = v; peakIdx = i; } });
	return { lines, heights, labelLine, peakIdx, peakVal };
}

const BLOCKS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];

/** dsh-tui ProgressBar idiom: block ladder, empty stretch as background. */
export function barString(ratio, width) {
	const r = Math.min(1, Math.max(0, ratio));
	const whole = Math.floor(r * width);
	let out = BLOCKS[8].repeat(whole);
	if (whole < width) {
		out += BLOCKS[Math.floor((r * width - whole) * 8)];
		out += BLOCKS[0].repeat(Math.max(0, width - whole - 1));
	}
	return out;
}

/** Responsive model-row budget (exported for tests). The fixed ~70-col row
 *  content staircased at ~61-col right columns — the ladder shrinks the
 *  bar first, then the token number, then %/track, then the name, so the
 *  row NEVER wraps. Each step's exact display width is computed so tests
 *  can pin the layout to the terminal budget. */
const MODEL_ROW_STEPS = [
	{ name: 22, bar: 12, pct: true, tokPad: 7, tight: false, cost: true },
	{ name: 22, bar: 8, pct: true, tokPad: 7, tight: false, cost: true },
	{ name: 22, bar: 8, pct: true, tokPad: 5, tight: true, cost: true },
	{ name: 18, bar: 6, pct: true, tokPad: 5, tight: true, cost: true },
	{ name: 16, bar: 6, pct: false, tokPad: 5, tight: true, cost: true },
	{ name: 14, bar: 0, pct: false, tokPad: 5, tight: true, cost: false },
];

function modelRowWidth(step) {
	return step.name
		+ (step.bar > 0 ? step.bar + 1 : 0)
		+ (step.pct ? 4 : 0)
		+ step.tokPad + 1
		+ 3 // 计价 tag
		+ (step.cost ? 10 : 0); // " ≈¥123.45"
}

/** Exported for test/tui-test.mjs. */
export function modelLayout(rightW) {
	const inner = Math.max(20, rightW - 2);
	for (const step of MODEL_ROW_STEPS) {
		if (modelRowWidth(step) <= inner) return step;
	}
	return MODEL_ROW_STEPS[MODEL_ROW_STEPS.length - 1];
}

/** Day-view 分时 gantt (pure; exported shape for tests): one row per
 *  session, one cell group per hour, ▓ band marking the peak-billing
 *  hours, plus the per-hour totals the old 活跃时段 strip showed.
 *  Exported for test/tui-test.mjs. */
export function ganttRows(sessions, day, width, peakSet) {
	const labelW = 12;
	const colsPerHour = Math.max(1, Math.min(2, Math.floor((Math.max(width, 40) - labelW - 2) / 24)));
	const spanW = colsPerHour * 24;
	const hours = new Array(24).fill(0);
	const rows = sessions.map((s) => {
		const dayHours = s.record?.hoursByDay?.[day] ?? {};
		const cells = [];
		for (let hh = 0; hh < 24; hh++) {
			let sum = 0;
			for (const t of Object.values(dayHours[String(hh)] ?? {})) sum += tokSum(t);
			hours[hh] += sum;
			cells.push((sum > 0 ? "█" : " ").repeat(colsPerHour));
		}
		return { id: s.id, label: fitDisplay(s.title ?? shortSessionId(s.id), labelW), span: cells.join("") };
	});
	let peakHour = 0, peakTok = 0;
	hours.forEach((v, i) => { if (v > peakTok) { peakTok = v; peakHour = i; } });
	const band = Array.from({ length: 24 }, (_, hh) => (peakSet?.has(hh) ? "▓" : " ").repeat(colsPerHour)).join("");
	return { hours, peakHour, spanW, band, rows };
}
