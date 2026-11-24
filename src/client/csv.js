		import { activeCurrency, displayAmount } from "../view.js";
		import { fill } from "./stores.js";
		//#region csv export
		/** One CSV cell: bare numbers stay unquoted, anything with a comma/
		 *  quote/break gets the RFC-4180 quoting. */
		export function csvCell(value) {
			const s = value === null || value === undefined ? "" : String(value);
			return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		}
		/** Download text as a file (Blob; revoked after the click settles). */
		export function downloadCsv(filename, text) {
			if (typeof document === "undefined" || typeof Blob === "undefined") return;
			const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			document.body.append(anchor);
			anchor.click();
			anchor.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		}
		/** Build the loaded window's daily usage table as UTF-8 CSV text (BOM +
		 *  CRLF, so Excel opens it correctly): a currency title row, one row
		 *  per day with tokens, cache-hit rate, the tier-aware cost estimate
		 *  and the official spend reconciliation, followed by a totals row.
		 *  The money columns follow the display currency — every value rides
		 *  displayAmount, the single conversion exit (the internal CNY sums
		 *  stay CNY and convert only at cell-write time). Pure client-side —
		 *  the payload already carries every number. Split from exportDailyCsv
		 *  so tests can pin the text without a DOM. */
		export function buildDailyCsv({ t, view, costDays, balanceSeries = [], fromDay, toDay }) {
			const costBy = new Map(Array.isArray(costDays) ? costDays.map((d) => [d.key, d]) : []);
			const spendBy = new Map(Array.isArray(balanceSeries) ? balanceSeries.map((d) => [d.key, d]) : []);
			const buckets = Array.isArray(view?.buckets) ? view.buckets : [];
			const cur = activeCurrency();
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
				const spendVal = spend === undefined || spend?.spend === null ? null : spend.spend;
				const searchCalls = bucket.auxSearch || 0;
				const titleCalls = bucket.auxTitle || 0;
				sumSessions += bucket.sessions || 0;
				sumIn += input; sumRead += read; sumWrite += write; sumOut += out;
				sumSearch += searchCalls; sumTitle += titleCalls;
				if (costVal !== null) sumCost += costVal;
				rows.push([
					bucket.key,
					bucket.sessions || 0,
					input, read, write, out, prompt + out,
					prompt > 0 ? `${((read / prompt) * 100).toFixed(1)}%` : "",
					searchCalls > 0 || titleCalls > 0 ? searchCalls : "",
					searchCalls > 0 || titleCalls > 0 ? titleCalls : "",
					costVal === null ? "" : Math.round(displayAmount(costVal) * 1e6) / 1e6,
					spendVal === null ? "" : Math.round(displayAmount(spendVal) * 1e6) / 1e6,
					costVal !== null && spendVal !== null
						? Math.round(displayAmount(spendVal - costVal) * 1e6) / 1e6
						: "",
				]);
			}
			const header = [t("expDate"), t("expSessions"), t("expInput"), t("expCacheRead"),
				t("expCacheWrite"), t("expOutput"), t("expTotal"), t("expHitRate"), t("expSearch"), t("expTitle"),
				fill(t("expCost"), { cur }), fill(t("expSpend"), { cur }), fill(t("expGap"), { cur })];
			const grand = [t("expSum"), sumSessions, sumIn, sumRead, sumWrite, sumOut,
				sumIn + sumRead + sumWrite + sumOut, "", sumSearch, sumTitle,
				Math.round(displayAmount(sumCost) * 1e6) / 1e6, "", ""];
			// The title row names the currency up front, so a spreadsheet that
			// hides its header row still says which unit the money columns use.
			return "\uFEFF" + [[fill(t("expCurrency"), { cur })], header, ...rows, grand]
				.map((row) => row.map(csvCell).join(",")).join("\r\n");
		}
		/** Export buildDailyCsv's text as a file download. */
		export function exportDailyCsv(args) {
			downloadCsv(`pulse-${args.fromDay}_${args.toDay}.csv`, buildDailyCsv(args));
		}
		//#endregion
