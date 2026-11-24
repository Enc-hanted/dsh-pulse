/**
 * 中立注册表：TUI 半区（src/tui/strip.js）与 web 半区（src/index.js）共用的
 * 快显 reader seam。两个半区在 cordis.patch.yml 里互斥（同一入口只会挂其一），
 * 模块级状态必须离开 TUI 目录，否则 web 入口就要反向 import TUI 模块。
 * 目前 TUI 进程里没有 host 半区接线，reader 为 null、快显段不渲染——接线
 * 留待后续版本。
 */
export declare function setQuickReader(fn: any): void;
export declare function quickReaderOf(): any;
