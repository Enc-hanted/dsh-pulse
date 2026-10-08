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
		/** Export the loaded window's daily usage table as UTF-8 CSV (BOM +
		 *  CRLF, so Excel opens it correctly): one row per day with tokens,
		 *  cache-hit rate, the tier-aware cost estimate and the official spend
		 *  reconciliation, followed by a totals row. Pure client-side — the
		 *  payload already carries every number. */
		export function exportDailyCsv({ t, view, costDays, balanceSeries = [], fromDay, toDay }) {
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
					costVal === null ? "" : Math.round(costVal * 1e6) / 1e6,
					spendVal === null ? "" : spendVal,
					costVal !== null && spendVal !== null
						? Math.round((spendVal - costVal) * 1e6) / 1e6
						: "",
				]);
			}
			const header = [t("expDate"), t("expSessions"), t("expInput"), t("expCacheRead"),
				t("expCacheWrite"), t("expOutput"), t("expTotal"), t("expHitRate"), t("expSearch"), t("expTitle"),
				t("expCost"), t("expSpend"), t("expGap")];
			const grand = [t("expSum"), sumSessions, sumIn, sumRead, sumWrite, sumOut,
				sumIn + sumRead + sumWrite + sumOut, "", sumSearch, sumTitle,
				Math.round(sumCost * 1e6) / 1e6, "", ""];
			const csv = "\uFEFF" + [header, ...rows, grand].map((row) => row.map(csvCell).join(",")).join("\r\n");
			downloadCsv(`pulse-${fromDay}_${toDay}.csv`, csv);
		}
		//#endregion
