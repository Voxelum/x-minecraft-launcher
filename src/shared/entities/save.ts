import type { GameType } from '@xmcl/world'

export interface InstanceSave {
    path: string;
    instanceName: string;
    name: string;
    icon: string;
}

export interface InstanceSaveMetadata extends InstanceSave {
    levelName: string;
    mode: GameType;
    cheat: boolean;
    gameVersion: string;
    difficulty: number;
    lastPlayed: number;
}
