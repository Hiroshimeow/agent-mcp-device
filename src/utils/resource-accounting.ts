export interface ResourceLimits {
    maxBytes: number;
    maxFiles?: number;
    maxProcesses?: number;
}

export interface Reservation {
    bytes: number;
    release: () => void;
}

export class ResourceAccounting {
    private reservedBytes: number = 0;
    private maxBytes: number;

    constructor(limits: ResourceLimits) {
        this.maxBytes = limits.maxBytes;
    }

    reserve(bytes: number): Reservation {
        if (bytes < 0) {
            throw new Error('Cannot reserve negative bytes');
        }
        if (this.reservedBytes + bytes > this.maxBytes) {
            throw new Error(`Resource limit exceeded: requested ${bytes} bytes, currently reserved ${this.reservedBytes}/${this.maxBytes}`);
        }
        this.reservedBytes += bytes;
        let released = false;
        return {
            bytes,
            release: () => {
                if (!released) {
                    this.reservedBytes = Math.max(0, this.reservedBytes - bytes);
                    released = true;
                }
            }
        };
    }

    getReservedBytes(): number {
        return this.reservedBytes;
    }

    getRemainingBytes(): number {
        return Math.max(0, this.maxBytes - this.reservedBytes);
    }
}
