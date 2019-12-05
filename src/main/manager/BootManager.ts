import { Manager } from ".";
import { join, resolve } from "path";
import { fs } from "main/utils";
import { app } from "electron";
import { existsSync, mkdirSync, readFileSync } from "fs";

const appData = app.getPath('appData');
const persistRoot = `${appData}/voxelauncher`;
const cfgFile = `${appData}/voxelauncher/launcher.json`;

export default class BootManager extends Manager {
    public root!: string;

    async setup() {
        let root;
        try {
            const buf = readFileSync(cfgFile);
            const cfg = JSON.parse(buf.toString());
            root = cfg.path || join(appData, 'voxelauncher');
        } catch (e) {
            root = join(appData, 'voxelauncher');
        }
        this.setupRoot(root)
        this.root = root;
    }

    private setupRoot(rt: string) {
        try {
            app.setPath('userData', rt);
            if (!existsSync(rt)) {
                mkdirSync(rt, { recursive: true });
            }
            if (!existsSync(persistRoot)) {
                mkdirSync(persistRoot, { recursive: true });
            }
            console.log(`Setup root ${rt}`);
            fs.writeFile(cfgFile, JSON.stringify({ path: rt }));
        } catch (e) {
            console.error('An error occured during setup root');
            console.error(e);
            app.exit(1);
        }
    }
    /**
     * Handle the root change request from cliean.
     * This will restart the launcher.
     */
    async setRoot({ path: newRoot, migrate, clear }: { path: string, migrate: boolean, clear: boolean }) {
        const oldRoot = app.getPath('userData');
        if (oldRoot === newRoot) {
            // event.sender.send('root');
            return;
        }

        console.log(`Start to migrate root, ${oldRoot} -> ${newRoot}`);

        async function remove(file: string) {
            const s = await fs.stat(file).catch((_) => { });
            if (!s) return;
            if (s.isDirectory()) {
                const childs = await fs.readdir(file);
                await Promise.all(childs.map(p => resolve(file, p)).map(p => remove(p)));
                if (file === persistRoot) return;
                await fs.rmdir(file);
            } else {
                if (file === cfgFile) return;
                await fs.unlink(file);
            }
        }

        try {
            if (!existsSync(newRoot)) {
                mkdirSync(newRoot, { recursive: true });
            }

            if (migrate) {
                await fs.copy(oldRoot, newRoot);
            }

            if (clear) {
                await remove(oldRoot);
            }

            await fs.writeFile(cfgFile, JSON.stringify({ path: newRoot }));

            app.setPath('userData', newRoot);
            app.relaunch();
            app.quit();
        } catch (e) {
            console.error(`Error occured during migrating, path: ${newRoot}, migrate: ${migrate}, clear: ${clear}.`);
            console.error(e);
            // event.sender.send('root', e);
        }
    }
}
