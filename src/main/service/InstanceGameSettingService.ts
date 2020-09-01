import { exists, missing } from '@main/util/fs';
import { requireString } from '@universal/util/assert';
import { compareRelease, compareSnapshot, isReleaseVersion, isSnapshotPreview } from '@universal/util/version';
import { Frame, parse, stringify } from '@xmcl/gamesetting';
import { readFile, writeFile, FSWatcher } from 'fs-extra';
import watch from 'node-watch';
import { join } from 'path';
import Service, { MutationTrigger, Singleton } from './Service';

export interface EditGameSettingOptions extends Frame {
}

/**
 * The service for game setting
 */
export default class InstanceGameSettingService extends Service {
    private watcher: FSWatcher | undefined;

    private watchingInstance = '';

    private dirty = false;

    async dispose() {
        this.watcher?.close();
    }

    async init() {
        this.loadInstanceGameSettings(this.state.instance.path);
    }

    @MutationTrigger('instanceSelect')
    protected async onInstance(payload: string) {
        this.loadInstanceGameSettings(payload);
    }

    @Singleton()
    async loadInstanceGameSettings(path: string) {
        requireString(path);

        if (this.watchingInstance !== path) {
            this.log(`Start to watch instance options.txt in ${path}`);
            this.watcher = watch(path, (event, file) => {
                if (file.endsWith('options.txt')) {
                    this.dirty = true;
                }
            });
            this.watchingInstance = path;
            this.dirty = true;
        }
        if (this.dirty) {
            try {
                let optionsPath = join(path, 'options.txt');
                this.log(`Load instance options.txt ${optionsPath}`);
                let result = await readFile(optionsPath, 'utf-8').then(parse);
                this.commit('instanceCache', { gamesettings: result });
            } catch (e) {
                if (!e.message.startsWith('ENOENT:')) {
                    this.warn(`An error ocurrs during parse game options of ${path}.`);
                    this.warn(e);
                }
                this.commit('instanceCache', { gamesettings: { resourcePacks: [] } });
            }
            this.dirty = false;
        }
    }


    @MutationTrigger('instanceGameSettings')
    async saveInstanceGameSetting() {
        let optionsTxtPath = join(this.state.instance.path, 'options.txt');
        if (await exists(optionsTxtPath)) {
            let buf = await readFile(optionsTxtPath);
            let content = parse(buf.toString());
            for (let [key, value] of Object.entries(this.state.instance.settings)) {
                if (key in content) {
                    (content as any)[key] = value;
                }
            }
            await writeFile(optionsTxtPath, stringify(content));
        } else {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(this.state.instance.settings)) {
                if (typeof value !== 'undefined') {
                    result[key] = value;
                }
            }
            await writeFile(optionsTxtPath, stringify(result));
        }

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
            if (key === 'resourcePacks') continue;
            if (key in current && (current as any)[key] !== (gameSetting as any)[key]) {
                (result as any)[key] = (gameSetting as any)[key];
            }
        }
        if (gameSetting.resourcePacks) {
            let mcversion = this.getters.instance.runtime.minecraft;
            if ((isReleaseVersion(mcversion) && compareRelease(mcversion, '1.13.0') >= 0)
                || (isSnapshotPreview(mcversion) && compareSnapshot(mcversion, '17w43a') >= 0)) {
                result.resourcePacks = gameSetting.resourcePacks
                    .map(r => (r !== 'vanilla' && !r.startsWith('file/') ? `file/${r}` : r));
                if (result.resourcePacks.every((p) => p !== 'vanilla')) {
                    result.resourcePacks.unshift('vanilla');
                }
            } else {
                result.resourcePacks = gameSetting.resourcePacks.filter(r => r !== 'vanilla')
                    .map(r => (r.startsWith('file/') ? r.substring(5) : r));
            }
        }
        if (Object.keys(result).length > 0) {
            this.log(`Edit gamesetting: ${JSON.stringify(result, null, 4)}`);
            this.commit('instanceGameSettings', result);
        }
    }

    async showInFolder() {
        const optionTxt = join(this.watchingInstance, 'options.txt');
        if (await missing(optionTxt)) {
            this.app.openDirectory(this.watchingInstance);
        } else {
            this.app.showItemInFolder(optionTxt);
        }
    }
}
