/**
 * shoot-canvas-matrix.mjs — regenerate the head-canvas harness and re-shoot
 * the acceptance matrix into .shots/canvas/. One command IS the visual
 * acceptance pass: every degradation state the canvas promises (per-width
 * wrap order, every toggle combination — quota-only included, the state
 * that once collapsed) at the widths that matter.
 *
 *   npm run shots              # regenerate harness + shoot all cases
 *   PULSE_CHROME=<path> npm run shots   # override the headless chrome binary
 *
 * Reads v4-canvas.html via file:// (no server needed; container queries
 * work on file URLs).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = join(root, "v4-canvas.html");

const regen = spawnSync(process.execPath, [join(root, "scripts", "build-canvas-demo.mjs")], { stdio: "inherit" });
if (regen.status !== 0) process.exit(regen.status ?? 1);

const CHROME = process.env.PULSE_CHROME ?? join(
	process.env.LOCALAPPDATA ?? "", "ms-playwright",
	"chromium_headless_shell-1228", "chrome-headless-shell-win64", "chrome-headless-shell.exe",
);
if (!existsSync(CHROME)) {
	console.error(`chrome-headless-shell not found at ${CHROME} (set PULSE_CHROME)`);
	process.exit(1);
}

/** [name, stage width, window height, url params] — window width is stage + 24
 *  (bare mode's 12px page padding each side); heights leave the degraded
 *  states headroom. The toggle combos cover both wrap regimes and the
 *  content-floor fixes (quota-only exercises the ledger's max-content floor,
 *  3plans the warm fill). */
const CASES = [
	["1663-all", 1663, 380, ""],
	["1280-all", 1280, 420, ""],
	["1000-all", 1000, 420, ""],
	["850-all", 850, 440, ""],
	["700-all", 700, 460, ""],
	["860-all", 860, 440, ""],
	["800-all", 800, 460, ""],
	["720-all", 720, 480, ""],
	["560-all", 560, 540, ""],
	["1280-noquota", 1280, 420, "quota=0"],
	["1280-nocache", 1280, 420, "cache=0"],
	["1280-nobal", 1280, 420, "bal=0"],
	["1280-quotaonly", 1280, 420, "est=0&bal=0&cache=0"],
	["560-quotaonly", 560, 540, "est=0&bal=0&cache=0"],
	["1280-estbal", 1280, 420, "quota=0&cache=0"],
	["560-estbal", 560, 400, "quota=0&cache=0"],
	["1280-estcache", 1280, 420, "bal=0&quota=0"],
	["1000-estcache", 1000, 420, "bal=0&quota=0"],
	["1280-cacheonly", 1280, 420, "est=0&bal=0&quota=0"],
	["1280-3plans", 1280, 420, "x=1"],
	["1280-balonly", 1280, 420, "est=0"],
	["1280-estwith", 1280, 420, "bal=0"],
	/* 环境变体：夹具与宿主环境解耦——真实英词典 / 美元余额 / 供应商数量
	   （N=1 与 N>3）/ 省略号边界上的超长名字。任何只在这套默认夹具上
	   成立的布局建议，都会在这些变体上当场露馅。 */
	["1280-en-usd", 1280, 420, "lang=en&cur=usd"],
	["850-en", 850, 440, "lang=en"],
	["560-en-usd", 560, 540, "lang=en&cur=usd"],
	["1280-plans1", 1280, 420, "plans=1"],
	["1280-plans4", 1280, 420, "plans=4"],
	["1280-plans6-long", 1280, 440, "plans=6&longnames=1"],
];

for (const [name, w, h, params] of CASES) {
	const url = `${pathToFileURL(page).href}?bare=1&w=${w}${params ? `&${params}` : ""}`;
	const out = join(root, ".shots", "canvas", `${name}.png`);
	const r = spawnSync(CHROME, [
		`--screenshot=${out}`, `--window-size=${w + 24},${h}`, "--hide-scrollbars",
		"--force-device-scale-factor=1", "--disable-gpu", "--no-sandbox",
		"--virtual-time-budget=3000", url,
	], { stdio: "ignore" });
	if (r.status !== 0) {
		console.error(`FAIL ${name} (exit ${r.status}, stderr binary)`);
		process.exit(1);
	}
	console.log(`ok ${name}`);
}
