import { useState, useEffect, useRef, jsx, jsxs } from "./react.js";
 "../view.js";
import { fill, useEscape } from "./stores.js";
 "./quota.js";
import { Float, floatReady, primitives } from "./adapter.js";
import { AUX_MODEL_KEY, splitModelKey } from "./../view.js";
		//#region pickers — the two filter pickers and their shared shell
		const noDismiss = () => {};
		function usePickerShell() {
			const [open, setOpen] = useState(false);
			const rootRef = useRef(null);
			const btnRef = useRef(null);
			(primitives.useDismissOnOutsidePointer ?? noDismiss)(rootRef, open && !floatReady(), () => setOpen(false));
			useEscape(open, () => setOpen(false));
			useEffect(() => {
				if (!open || floatReady() || typeof primitives.useDismissOnOutsidePointer === "function") return;
				const onDoc = (e) => {
					if (rootRef.current !== null && !rootRef.current.contains(e.target)) setOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				return () => document.removeEventListener("mousedown", onDoc);
			}, [open]);
			return { open, setOpen, rootRef, btnRef };
		}

		/** The shared picker tail: the portaled Float when the host serves it,
		 *  else the inline menu — exactly one of the two renders the items. */
		function pickerShell({ open, setOpen, rootRef, btnRef, children }) {
			return [
				open && floatReady() && jsx(Float, {
					open,
					onClose: () => setOpen(false),
					rootRef,
					anchorRef: btnRef,
					maxHeight: 320,
					children,
				}),
				open && !floatReady() && jsxs("div", { className: "dp_pickerMenu", role: "listbox", children }),
			];
		}

		/** Searchable dropdown: a button plus a popup with an embedded filter
		 *  input. Closes on select, Escape, or an outside click. */
		export function SearchPicker({ value, options, placeholder, displayName, onChange, t }) {
			const { open, setOpen, rootRef, btnRef } = usePickerShell();
			const [query, setQuery] = useState("");
			const q = query.trim().toLowerCase();
			const rows = options.filter((option) => q === "" || option.label.toLowerCase().includes(q));
			const shown = value === "" || value === null || value === undefined
				? placeholder
				: displayName(value);
			const menuItems = [
				jsx("input", {
					key: "search",
					className: "dp_pickerSearch",
					type: "text",
					placeholder: t("searchPlaceholder"),
					value: query,
					autoFocus: true,
					onChange: (e) => setQuery(e.target.value),
				}),
				jsxs("div", { key: "list", className: "dp_pickerList", children: [
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
			];
			return jsxs("div", { ref: rootRef, className: "dp_picker", children: [
				jsx("button", {
					ref: btnRef,
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
				...pickerShell({ open, setOpen, rootRef, btnRef, children: menuItems }),
			] });
		}

		/**
		 * Multi-select model picker: the full legend-linked filter. A checkbox-
		 * style list over the window's known models (the aux pseudo row among
		 * them); the 全部 entry clears. Selection state lives in the dashboard
		 * (empty = all models) and drives every model-filterable surface, so a
		 * legend click and a picker click are the same operation.
		 */
		export function ModelMultiPicker({ selected, onToggle, onClear, knownModels, names, t }) {
			const { open, setOpen, rootRef, btnRef } = usePickerShell();
			const [query, setQuery] = useState("");
			const label = (key) => {
				const { provider, model } = splitModelKey(key);
				return model === "unknown" ? t("unknownModel") : model === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(provider, model);
			};
			const q = query.trim().toLowerCase();
			const rows = (Array.isArray(knownModels) ? knownModels : []).filter((key) => q === "" || label(key).toLowerCase().includes(q));
			const sel = new Set(Array.isArray(selected) ? selected : []);
			const menuItems = [
				jsx("input", {
					key: "search",
					className: "dp_pickerSearch",
					type: "text",
					placeholder: t("searchPlaceholder"),
					value: query,
					autoFocus: true,
					onChange: (e) => setQuery(e.target.value),
				}),
				jsxs("div", { key: "list", className: "dp_pickerList", children: [
					jsx("button", {
						type: "button",
						role: "option",
						"aria-selected": sel.size === 0,
						className: `dp_pickerItem${sel.size === 0 ? " dp_pickerItemActive" : ""}`,
						onClick: () => { onClear(); setOpen(false); setQuery(""); },
						children: t("modelAll"),
					}),
					rows.map((key) => jsx("button", {
						type: "button",
						role: "option",
						"aria-selected": sel.has(key),
						className: `dp_pickerItem${sel.has(key) ? " dp_pickerItemActive" : ""}`,
						onClick: () => onToggle(key),
						title: label(key),
						children: jsxs("span", { className: "dp_pickerItemMain", children: [
							sel.has(key) && jsx("i", { className: "dp_mselDot" }),
							jsx("span", { className: "dp_ellipsis", children: label(key) }),
						] }),
					}, key)),
					rows.length === 0 && jsx("div", { className: "dp_pickerEmpty", children: t("noMatch") }),
				] }),
			];
			return jsxs("div", { ref: rootRef, className: "dp_picker", children: [
				jsx("button", {
					ref: btnRef,
					type: "button",
					className: "dp_pickerBtn",
					onClick: () => setOpen(!open),
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					title: sel.size === 0 ? t("modelAll") : [...sel].map(label).join(" · "),
					children: [
						jsx("span", { className: "dp_pickerValue", children: sel.size === 0 ? t("modelAll") : fill(t("modelCount"), { n: sel.size }) }),
						jsx("span", { className: "dp_pickerCaret", children: open
							? jsx(primitives.IconChevronUpOutline14, { size: 14 })
							: jsx(primitives.IconChevronDownOutline14, { size: 14 }) }),
					],
				}),
				...pickerShell({ open, setOpen, rootRef, btnRef, children: menuItems }),
			] });
		}
