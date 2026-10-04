import { useState, useMemo, useRef, jsx, jsxs } from "./react.js";
import { Btn, Float, Input, Seg, floatReady } from "./adapter.js";
import { ModelMultiPicker, SearchPicker } from "./charts.js";
import { fill } from "./stores.js";
import { daysBetween, localDay, shiftDay } from "./../view.js";
		//#region toolbar
		/** Range / project / model selector row driving the client-side view.
		 *  Project and model pickers embed a search input for large corpora. */
		/** Custom-range calendar: one picker for both bounds — first click
		 *  sets the start, a second click sets the end (an earlier pick
		 *  swaps the pair), and picking again after a complete range starts
		 *  over. Replaces the two date inputs so a custom range takes a
		 *  single interaction. */
		export function RangeCalendar({ from, to, onPick, onClose, anchorRef, t }) {
			// Span cap for custom ranges: one year, mirroring the clamp the
			// dashboard applies; the calendar surfaces it visually instead of
			// letting the trim happen silently later.
			const MAX_SPAN = 365;
			const [month, setMonth] = useState(() => {
				const anchor = typeof from === "string" && from.length === 10 ? from : localDay(Date.now());
				return anchor.slice(0, 7);
			});
			const [pending, setPending] = useState(null);
			const [hoverDay, setHoverDay] = useState(null);
			const [ymOpen, setYmOpen] = useState(false);
			const [ymYear, setYmYear] = useState(Number(month.slice(0, 4)));
			/** Draft strings for the two date inputs: Enter parses and applies
			 *  both bounds; an invalid, future or over-cap draft keeps its red
			 *  border and never reaches the applied range. */
			const [draftFrom, setDraftFrom] = useState(typeof from === "string" ? from : "");
			const [draftTo, setDraftTo] = useState(typeof to === "string" ? to : "");
			const [badFrom, setBadFrom] = useState(false);
			const [badTo, setBadTo] = useState(false);
			const today = localDay(Date.now());
			const shiftMonth = (key, delta) => {
				const [y, m] = key.split("-").map(Number);
				const t = y * 12 + (m - 1) + delta;
				return `${String(Math.floor(t / 12)).padStart(4, "0")}-${String((t % 12) + 1).padStart(2, "0")}`;
			};
			const makeDay = (yy, mm, dd) => {
				if (!(Number.isInteger(yy) && Number.isInteger(mm) && Number.isInteger(dd))) return null;
				if (mm < 1 || mm > 12 || dd < 1) return null;
				const probe = new Date(yy, mm - 1, dd, 12);
				if (probe.getMonth() !== mm - 1 || probe.getDate() !== dd) return null;
				return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
			};
			/** Accept 2026-09-24, 2026/9/24, or 09-24 / 9/24 (current year). */
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
				// An empty side keeps the currently applied bound.
				const parsedFrom = fRaw === "" ? (typeof from === "string" && from !== "" ? from : null) : parseDay(fRaw);
				const parsedTo = tRaw === "" ? (typeof to === "string" && to !== "" ? to : null) : parseDay(tRaw);
				if (fRaw !== "" && parsedFrom === null) { setBadFrom(true); return; }
				if (tRaw !== "" && parsedTo === null) { setBadTo(true); return; }
				if (parsedFrom === null || parsedTo === null) { setBadFrom(parsedFrom === null); setBadTo(parsedTo === null); return; }
				let start = parsedFrom;
				let end = parsedTo;
				if (start > end) { const swap = start; start = end; end = swap; }
				if (parsedFrom > today || parsedTo > today) { setBadFrom(parsedFrom > today); setBadTo(parsedTo > today); return; }
				if (daysBetween(start, end) > MAX_SPAN) { setBadFrom(true); setBadTo(true); return; }
				onPick({ from: start, to: end });
			};
			const pick = (day) => {
				setHoverDay(null);
				if (pending === null) { setPending(day); return; }
				let start = pending;
				let end = day;
				if (end < start) { start = day; end = pending; }
				onPick({ from: start, to: end });
			};
			const [y, m] = month.split("-").map(Number);
			const daysInMonth = new Date(y, m, 0).getDate();
			const offset = (new Date(y, m - 1, 1, 12).getDay() + 6) % 7;
			const cells = [];
			for (let i = 0; i < offset; i += 1) cells.push(null);
			for (let d = 1; d <= daysInMonth; d += 1) cells.push(localDay(new Date(y, m - 1, d, 12).getTime()));
			// Disabled days: the future (no data can exist there) and, once a
			// start is chosen, everything past the span cap — the limit shows
			// in the grid instead of being silently trimmed later.
			const capStart = pending !== null ? pending : (typeof from === "string" && from !== "" ? from : null);
			const capEnd = capStart !== null ? shiftDay(capStart, MAX_SPAN - 1) : null;
			const isDayOff = (day) => day > today || (capEnd !== null && day > capEnd);
			// Hover preview: after the start is picked, sliding over the grid
			// highlights the tentative span (an earlier hover swaps the pair,
			// mirroring the click behavior).
			const hoverEnd = pending !== null && typeof hoverDay === "string" && hoverDay !== pending ? hoverDay : "";
			let rangeStart = pending !== null ? pending : (typeof from === "string" ? from : "");
			let rangeEnd = pending !== null ? hoverEnd : (typeof to === "string" ? to : "");
			if (rangeStart !== "" && rangeEnd !== "" && rangeEnd < rangeStart) {
				const swapped = rangeStart;
				rangeStart = rangeEnd;
				rangeEnd = swapped;
			}
			const isStart = (day) => rangeStart !== "" && day === rangeStart;
			const isEnd = (day) => rangeEnd !== "" && day === rangeEnd;
			const inRange = (day) => rangeStart !== "" && rangeEnd !== "" && day > rangeStart && day < rangeEnd;
			// One-click presets inside the calendar, always ending today.
			const quick = [
				[t("range1"), today, today],
				[t("yesterday"), shiftDay(today, -1), shiftDay(today, -1)],
				[t("range7"), shiftDay(today, -6), today],
				[t("range30"), shiftDay(today, -29), today],
			];
			const card = jsxs("div", { className: "dp_calCard", onClick: (e) => e.stopPropagation(), children: [
				jsxs("div", { className: "dp_calQuick", children: quick.map(([quickText, quickFrom, quickTo]) => jsx("button", {
					type: "button",
					className: "dp_segBtn",
					onClick: () => onPick({ from: quickFrom, to: quickTo }),
					children: quickText,
				}, quickText)) }),
				jsxs("div", { className: "dp_calHead", children: [
					jsx(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_calNav", "aria-label": t("back"), onClick: () => setMonth(shiftMonth(month, -1)), children: "‹" }),
					jsx("button", { type: "button", className: "dp_calMonth", title: t("calYMHint"), onClick: () => { setYmYear(Number(month.slice(0, 4))); setYmOpen(!ymOpen); }, children: month }),
					jsx(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_calNav", onClick: () => setMonth(shiftMonth(month, 1)), children: "›" }),
				] }),
				jsxs("div", { className: "dp_calInputs", children: [
					jsx(Input, {
						className: `dp_calInput${badFrom ? " dp_calInputBad" : ""}`,
						type: "text",
						placeholder: t("rangeFrom"),
						"aria-label": t("rangeFrom"),
						value: draftFrom,
						onChange: (e) => { setDraftFrom(e.target.value); setBadFrom(false); },
						onKeyDown: (e) => { if (e.key === "Enter") applyDrafts(); },
					}),
					jsx("span", { className: "dp_calSep", children: "~" }),
					jsx(Input, {
						className: `dp_calInput${badTo ? " dp_calInputBad" : ""}`,
						type: "text",
						placeholder: t("rangeToDate"),
						"aria-label": t("rangeToDate"),
						value: draftTo,
						onChange: (e) => { setDraftTo(e.target.value); setBadTo(false); },
						onKeyDown: (e) => { if (e.key === "Enter") applyDrafts(); },
					}),
				] }),
				ymOpen ? jsxs("div", { className: "dp_calYM", children: [
					jsxs("div", { className: "dp_calHead", children: [
						jsx(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_calNav", "aria-label": t("back"), onClick: () => setYmYear(ymYear - 1), children: "‹" }),
						jsx("span", { className: "dp_calMonth", children: String(ymYear) }),
						jsx(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_calNav", onClick: () => setYmYear(ymYear + 1), children: "›" }),
					] }),
					jsxs("div", { className: "dp_calYMGrid", children: t("calMonths").split(",").map((monthLabel, idx) => jsx("button", {
						type: "button",
						className: `dp_calCell${month === `${ymYear}-${String(idx + 1).padStart(2, "0")}` ? " dp_calStart" : ""}`,
						onClick: () => { setMonth(`${ymYear}-${String(idx + 1).padStart(2, "0")}`); setYmOpen(false); },
						children: monthLabel,
					}, monthLabel)) }),
				] }) : jsxs("div", { className: "dp_calGrid", onMouseLeave: () => setHoverDay(null), children: [
					t("calWeek").split(",").map((w) => jsx("span", { className: "dp_calDow", children: w }, w)),
					cells.map((day, i) => (day === null
						? jsx("span", { key: `e${i}`, className: "dp_calCell dp_calEmpty" })
						: jsx("button", {
							type: "button", key: day,
							className: `dp_calCell${isStart(day) ? " dp_calStart" : ""}${isEnd(day) ? " dp_calEnd" : ""}${inRange(day) ? " dp_calIn" : ""}${day === today ? " dp_calToday" : ""}${isDayOff(day) ? " dp_calOff" : ""}`,
							disabled: isDayOff(day),
							title: isDayOff(day) ? (day > today ? t("calNoFuture") : fill(t("calSpanCap"), { n: MAX_SPAN })) : undefined,
							onClick: () => pick(day),
							onMouseEnter: pending !== null && !isDayOff(day) ? () => setHoverDay(day) : undefined,
							children: String(Number(day.slice(8))),
						}))),
				] }),
				jsx("div", { className: "dp_calFoot", children: jsx("span", { className: "dp_costNote", children: badFrom || badTo
					? t("calBadDate")
					: pending !== null
						? t("calPickEnd")
						: typeof from === "string" && from !== "" && typeof to === "string" && to !== ""
							? `${from} ~ ${to} · ${fill(t("calSpanDays"), { n: daysBetween(from, to) })}`
							: t("calPickStart")
				}) }),
			] });
			// Anchored float (P3) when the host carries the pieces: the card
			// hangs from the date button instead of dimming the whole screen.
			if (floatReady()) {
				return jsx(Float, { open: true, onClose, rootRef: anchorRef, anchorRef, maxHeight: 460, children: card });
			}
			return jsx("div", { className: "dp_calOverlay", onClick: onClose, children: card });
		}

		export function Toolbar({ rangeKey, setRangeKey, custom, setCustom, project, setProject, knownProjects, models, onModelToggle, onModelClear, knownModels, names, t, filterSlot }) {
			const [calOpen, setCalOpen] = useState(false);
			const dateBtnRef = useRef(null);
			const rangeOptions = [["1", t("range1")], ["7", t("range7")], ["30", t("range30")], ["90", t("range90")], ["365", t("range365")], ["custom", t("rangeCustom")]];
			const projectOptions = useMemo(() => [
				{ value: "", label: t("projectAll") },
				...knownProjects.map((name) => ({ value: name, label: name })),
			], [knownProjects, t]);
			return jsxs("div", { className: "dp_toolbar", children: [
				jsxs("div", { className: "dp_toolbarGroup", children: [
					jsx(Seg, {
						id: "pulse-toolbar-range",
						value: rangeKey,
						options: rangeOptions.map(([value, label]) => ({ value, label })),
						onChange: setRangeKey,
						label: t("rangeLabel"),
					}),
				] }),
				rangeKey === "custom" && jsxs("div", { className: "dp_toolbarGroup", children: [
					jsx(Btn, {
						ref: dateBtnRef,
variant: "outline", size: "sm", fallbackClass: "dp_dateBtn",
						onClick: () => setCalOpen(true),
						// A one-day range says so once — "09-28 ~ 09-28" is noise.
						children: custom.from && custom.to ? (custom.from === custom.to ? custom.from : `${custom.from} ~ ${custom.to}`) : t("rangeCustom"),
					}),
					calOpen && jsx(RangeCalendar, {
						from: custom.from, to: custom.to,
						onPick: (range) => { setCustom(range); setCalOpen(false); },
						onClose: () => setCalOpen(false),
						anchorRef: dateBtnRef,
						t,
					}),
				] }),
				jsxs("div", { className: "dp_toolbarGroup", children: [
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
					jsx(ModelMultiPicker, {
						selected: models,
						onToggle: onModelToggle,
						onClear: onModelClear,
						knownModels,
						names,
						t,
					}),
				] }),
				// Extension filters (`pulse.dashboard.filter` list slot): rendered
				// after the built-in project/model pickers.
				typeof filterSlot === "function" && filterSlot("pulse.dashboard.filter", {}),
			] });
		}
		//#endregion

