import { GameSetting, parse } from '@xmcl/gamesetting';
import { readFile } from 'fs-extra';
import { join } from 'path';
import { requireString } from 'universal/utils/asserts';
import Service, { Singleton } from './Service';


/**
 * The service for game setting
 */
export default class InstanceGameSettingService extends Service {
    @Singleton()
    async loadInstanceGameSettings(path: string) {
        requireString(path);

        try {
            let optionsPath = join(path, 'options.txt');
            let result = await readFile(optionsPath, 'utf-8').then(b => b.toString()).then(parse);
            this.commit('instanceCache', { gamesettings: result });
        } catch (e) {
            if (!e.message.startsWith('ENOENT:')) {
                this.warn(`An error ocurrs during parse game options of ${path}.`);
                this.warn(e);
            }
        }
    }

    edit(gameSetting: GameSetting) {
        this.commit('instanceGameSettings', gameSetting);
    }
}
