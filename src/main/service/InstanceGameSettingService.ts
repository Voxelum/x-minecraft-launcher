import { parse, Frame, stringify } from '@xmcl/gamesetting';
import { readFile, writeFile } from 'fs-extra';
import { join } from 'path';
import { requireString } from '@universal/util/assert';
import Service, { Singleton, MutationTrigger } from './Service';

export interface EditGameSettingOptions extends Frame {
}

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

    
    @MutationTrigger('instanceGameSettings')
    async saveInstanceGameSetting() {
        await writeFile(join(this.state.instance.path, 'options.txt'),
            stringify(this.state.instance.settings));
        this.log(`Saved instance gamesettings ${this.state.instance.path}`);
    }

    /**
     * Edit the game setting of current instance
     * @param gameSetting The game setting edit options
     */
    edit(gameSetting: EditGameSettingOptions) {
        let current = this.state.instance.settings;
        let result: Frame = {};
        for (let key of Object.keys(gameSetting)) {
            if (key in current && (current as any)[key] !== (gameSetting as any)[key]) {
                (result as any)[key] = (gameSetting as any)[key];
            }
        }
        if (Object.keys(result).length > 0) {
            this.log(`Edit gamesetting: ${JSON.stringify(result, null, 4)}.`);
            this.commit('instanceGameSettings', result);
        }
    }
}
