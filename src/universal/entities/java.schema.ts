import { Schema } from './schema';

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface Java {
    path: string;
    version: string;
    majorVersion: number;
}
export interface JavaSchema {
    /**
     * @default []
     */
    all: Java[];
    /**
     * @TJS-type integer
     * @minimum 0
     * @default 0
     */
    default: number;
}

export const JavaSchema: Schema<JavaSchema> = require('./JavaSchema.json');
