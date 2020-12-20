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
}

export const JavaSchema: Schema<JavaSchema> = require('./JavaSchema.json');
