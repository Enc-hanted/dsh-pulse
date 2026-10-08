/**
 * TUI face — terminal drawing primitives (pure, no hooks): display-width
 * measurement, kinsoku-aware wrap, money labels, token abbreviations, heat
 * ramps, sparklines and block bars. Numbers and text → strings only; the
 * day gantt is the one view-model here (drawable cells for tests to pin).
 */

import { tokSum } from "./data.js";
import { clockOf, fmtTokens, moneyCny } from "../view.js";

// One abbreviation across both faces now — fmtTokens carries the B tier the
// TUI ladder lacked (1.5e9 printed 1500.0M here, 1.5B on the web).
export { fmtTokens, clockOf };

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

/** East-Asian Wide/Fullwidth ranges (the string-width convention: ambiguous
 *  codepoints — box drawing, block elements, ▸, ≈, … — count 1, matching
 *  both ink's measurer and terminals). The old `> 0xff → 2` heuristic
 *  over-counted every symbol and staircase-d any row carrying one.
 *  Exported for test/tui-test.mjs. */
const WIDE_RANGES = [
	[0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
	[0x25b6, 0x25b7], [0x25c0, 0x25c1], [0x25fc, 0x25fe],
	[0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1],
	[0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4],
	[0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd],
	[0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e],
	[0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf],
	[0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
	[0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
	[0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3],
	[0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f],
	[0xff00, 0xff60], [0xffe0, 0xffe6],
	[0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e], [0x1f191, 0x1f19a],
	[0x1f200, 0x1f320], [0x1f32d, 0x1f335], [0x1f337, 0x1f37c], [0x1f37e, 0x1f393], [0x1f3a0, 0x1f3ca],
	[0x1f3cf, 0x1f3d3], [0x1f3e0, 0x1f3f0], [0x1f3f4, 0x1f3f4], [0x1f3f8, 0x1f43e], [0x1f440, 0x1f440],
	[0x1f442, 0x1f4fc], [0x1f4ff, 0x1f53d], [0x1f54b, 0x1f54e], [0x1f550, 0x1f567], [0x1f57a, 0x1f57a],
	[0x1f595, 0x1f596], [0x1f5a4, 0x1f5a4], [0x1f5fb, 0x1f64f], [0x1f680, 0x1f6c5], [0x1f6cc, 0x1f6cc],
	[0x1f6d0, 0x1f6d2], [0x1f6d5, 0x1f6d7], [0x1f6eb, 0x1f6ec], [0x1f6f4, 0x1f6fc], [0x1f7e0, 0x1f7eb],
	[0x1f90c, 0x1f93a], [0x1f93c, 0x1f945], [0x1f947, 0x1f978], [0x1f97a, 0x1f9cb], [0x1f9cd, 0x1f9ff],
	[0x1fa70, 0x1fa74], [0x1fa78, 0x1fa7a], [0x1fa80, 0x1fa86], [0x1fa90, 0x1faa8], [0x1fab0, 0x1fab6],
	[0x1fac0, 0x1fac2], [0x1fad0, 0x1fad6],
	[0x20000, 0x2fffd], [0x30000, 0x3fffd],
];

function isWide(code) {
	for (const [lo, hi] of WIDE_RANGES) {
		if (code >= lo && code <= hi) return true;
		if (code < lo) break;
	}
	return false;
}

/** Display width of a string — CJK/fullwidth count 2, symbols count 1.
 *  Exported for test/tui-test.mjs. */
export function displayWidth(s) {
	let w = 0;
	for (const ch of String(s ?? "")) {
		const code = ch.codePointAt(0);
		w += code > 0xff && isWide(code) ? 2 : code > 0xffff ? 2 : 1; // astral surrogates read wide-safe
	}
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
		const cw = displayWidth(ch);
		if (w + cw > width) break;
		out += ch;
		w += cw;
	}
	return padDisplay(out, width);
}

/** fitDisplay, but a cut leaves an ellipsis so mid-word chops ("DSh Pulse
 *  插") don't read as broken wrapping. The result is still exactly `width`
 *  display columns. Exported for test/tui-test.mjs. */
export function truncateDisplay(text, width) {
	const s = String(text ?? "");
	if (displayWidth(s) <= width) return padDisplay(s, width);
	let out = "", w = 0;
	for (const ch of s) {
		const cw = displayWidth(ch);
		if (w + cw > width - 1) break;
		out += ch;
		w += cw;
	}
	return padDisplay(`${out}…`, width);
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
	if (m) {
		const n = parseInt(m[1], 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	// dsh-tui 0.13 palettes carry their colors as ink "rgb(r,g,b)" strings.
	const r = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(String(color ?? "").trim());
	return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : null;
}

/** Year-grid tile colors — the GitHub contribution-graph idiom. The empty
 *  lattice sits just above the terminal-background anchor so the 7×N grid
 *  stays visible on any terminal (the old "vertical bars" regression was the
 *  tile COLOR — a saturated badge fill — not background painting itself);
 *  heat deepens toward accent, with the top step just under it so today's
 *  solid accent tile stays distinguishable. Exported for test/tui-test.mjs. */
export function yearTiles(anchor, accent) {
	const a = accent ?? "#5f87ff";
	return [
		hexMix(anchor ?? "#000000", a, 0.18),
		hexMix(anchor, a, 0.36),
		hexMix(anchor, a, 0.58),
		hexMix(anchor, a, 0.78),
		hexMix(anchor, a, 0.92),
	];
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
 *  hours, plus the per-hour totals the old 活跃时段 strip showed. The label
 *  column and per-hour width scale with the terminal (the old fixed 12/2
 *  was an 80-col budget that stranded half a 148-col row); `total` is the
 *  合计 sparkline drawn at the SAME pitch as the spans so its peaks sit
 *  under the hours they summarize. Exported for test/tui-test.mjs. */
export function ganttRows(sessions, day, width, peakSet) {
	const labelW = Math.min(24, Math.max(12, Math.floor(Math.max(width, 40) * 0.14)));
	const colsPerHour = Math.max(1, Math.min(4, Math.floor((Math.max(width, 40) - labelW - 2) / 24)));
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
		return { id: s.id, label: truncateDisplay(s.title ?? shortSessionId(s.id), labelW), span: cells.join("") };
	});
	let peakHour = 0, peakTok = 0;
	hours.forEach((v, i) => { if (v > peakTok) { peakTok = v; peakHour = i; } });
	const band = Array.from({ length: 24 }, (_, hh) => (peakSet?.has(hh) ? "▓" : " ").repeat(colsPerHour)).join("");
	const total = sparkline(hours.flatMap((v) => Array(colsPerHour).fill(v)));
	return { hours, peakHour, spanW, band, total, labelW, rows };
}
