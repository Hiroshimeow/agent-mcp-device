import { AsyncLocalStorage } from 'async_hooks';

const uiOriginCallContext = new AsyncLocalStorage<boolean>();

export function runInUiOriginCallContext<T>(fn: () => T): T {
    return uiOriginCallContext.run(true, fn);
}

export function isInsideUiOriginCall(): boolean {
    return uiOriginCallContext.getStore() === true;
}

export function isTelemetryDisabledByEnv(): boolean {
    const raw = process.env.MCP_DEVICE_DISABLE_TELEMETRY;
    if (!raw) return false;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export function sanitizeError(error: any): { message: string, code?: string } {
    let errorMessage = '';
    let errorCode: string | undefined;
    if (error instanceof Error) {
        errorMessage = `${error.name}: ${error.message}`;
        if ('code' in error) errorCode = String((error as any).code);
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        errorMessage = 'Unknown error';
    }
    errorMessage = errorMessage.replace(/(?:\/|\\)[\w\d_.\-\/\\]+/g, '[PATH]');
    errorMessage = errorMessage.replace(/[A-Za-z]:\\[\w\d_.\-\/\\]+/g, '[PATH]');
    return { message: errorMessage, code: errorCode };
}

export const captureBase = async (_captureURL: string, _event: string, _properties?: any) => {};
export const capture = async (_event: string, _properties?: any) => {};
export const capture_call_tool = capture;
export const capture_ui_event = capture;
export const captureRemote = async (_event: string, _properties?: any) => {};
