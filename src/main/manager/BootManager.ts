import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { copy, ensureFile, readdir, readJson, rmdir, unlink, writeFile } from 'fs-extra';
import { isDirectory } from '@main/util/fs';
import { join, resolve } from 'path';
import { Manager } from '.';

const appData = app.getPath('appData');
const persistRoot = `${appData}/voxelauncher`;
const cfgFile = `${appData}/voxelauncher/launcher.json`;

export default class BootManager extends Manager {
    public root!: string;

    public remainingWindows: string[] = [];

    async setup() {
        let root;
        try {
            const cfg = await readJson(cfgFile);
            root = cfg.path || join(appData, 'voxelauncher');
            this.remainingWindows = cfg.windows || ['builtin://main'];
        } catch (e) {
            root = join(appData, 'voxelauncher');
            this.remainingWindows = ['builtin://main'];
        }
        await this.persistRoot(root);
        this.root = root;
    }

    private async persistRoot(root: string) {
        try {
            this.log(`Setup root ${root}`);
            await ensureFile(cfgFile);
            writeFile(cfgFile, JSON.stringify({ path: root }));
        } catch (e) {
            this.error('An error occured during setup root');
            this.error(e);
            app.exit(1);
        }
    }

    /**
     * Handle the root change request from cliean.
     * This will restart the launcher.
     */
    async setRoot({ path: newRoot, migrate, clear }: { path: string; migrate: boolean; clear: boolean }) {
        const oldRoot = this.root;
        if (oldRoot === newRoot) {
            return;
        }

        this.log(`Start to migrate root, ${oldRoot} -> ${newRoot}`);

        async function remove(file: string) {
            if (await isDirectory(file)) {
                const childs = await readdir(file);
                await Promise.all(childs.map(p => resolve(file, p)).map(p => remove(p)));
                if (file === persistRoot) return;
                await rmdir(file);
            } else {
                if (file === cfgFile) return;
                await unlink(file);
            }
        }

        try {
            if (!existsSync(newRoot)) {
                mkdirSync(newRoot, { recursive: true });
            }

            if (migrate) {
                await copy(oldRoot, newRoot);
            }

            if (clear) {
                await remove(oldRoot);
            }

            await writeFile(cfgFile, JSON.stringify({ path: newRoot }));

            this.root = newRoot;
            app.relaunch();
            app.quit();
        } catch (e) {
            this.error(`Error occured during migrating, path: ${newRoot}, migrate: ${migrate}, clear: ${clear}.`);
            this.error(e);
            // event.sender.send('root', e);
        }
    }
}
