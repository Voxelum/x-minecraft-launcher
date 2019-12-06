export interface Java {
    path: string;
    version: string;
    majorVersion: number;
}
export interface JavaConfig {
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
