/**
 * Shared HTTP response helpers for the host half's route handlers.
 */
/** JSON helpers for the settings/balance route responses. */
export declare function json(res: any, status: any, value: any): void;
export declare namespace json {
    var raw: (res: any, req: any, status: any, value: any) => void;
    var err: (res: any, status: any, message: any) => void;
}
