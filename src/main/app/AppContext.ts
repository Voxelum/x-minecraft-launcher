import { Platform } from '@xmcl/core';

export interface AppContext {
    root: string;
    temperayRoot: string;
    getPath(key: string): string;
    platform: Platform;
}

export interface LoggerFacade {
    log(message: any, ...options: any[]): void;
    warn(message: any, ...options: any[]): void;
    error(message: any, ...options: any[]): void;
}
