import en from 'main/utils/locales/en.json';
import zh from 'main/utils/locales/zh-CN.json';
import { fs } from 'main/utils';
import { join } from 'path';
import { Manager } from '.';

interface LocalNode {
    [key: string]: string | LocalNode;
}

const defaultContent: LocalNode = en;

/**
 * I18n manager on main process. Not shared with the window process i18n!
 */
export default class I18nManager extends Manager {
    private localeCache: { [locale: string]: LocalNode } = { en, zh, 'zh-CN': zh };

    private used: LocalNode = en;

    private usedName = 'en';

    readonly t: (key: string, args?: object) => string;

    constructor() {
        super();
        this.t = (key: string, args?: object) => {
            const queryPath = key.split('.');
            const result = this.find(queryPath, this.used) || this.find(queryPath, defaultContent);
            if (!result) return key;
            const templateString = typeof result === 'object' ? result[''] as string : result;
            return this.format(templateString, args);
        };
    }

    async init() {
        // const localesDir = join(__static, 'locales');
        // const locales = await fs.readdir(localesDir);
    }

    private format(templateString: string, args?: object) {
        if (!args) { return templateString; }
        let result = templateString;
        for (const [k, v] of Object.entries(args)) {
            result = result.replace(`{${k}}`, v.toString());
        }
        return result;
    }

    private find(queryPath: string[], node: LocalNode): string | LocalNode | undefined {
        if (!node) {
            console.error(`The node is null! Cannot query ${queryPath}`);
            console.error(node);
            return undefined;
        }
        let content: LocalNode | string = node;
        for (const p of queryPath) {
            if (typeof content === 'string') return undefined;
            const next: LocalNode | string | undefined = content[p];
            if (!next) return undefined;
            content = next;
        }
        return content;
    }

    getLocaleName(): string {
        return this.usedName;
    }

    getLocale(): LocalNode {
        return this.used;
    }

    async setLocale(locale: string): Promise<LocalNode> {
        if (locale === this.usedName) {
            return this.used;
        }
        if (locale in this.localeCache) {
            this.used = this.localeCache[locale];
            this.usedName = locale;
            return this.used;
        }
        const localeFile = join(__static, 'locales', `${locale}.json`);
        if (await fs.missing(localeFile)) {
            throw new Error(`Cannot find locale named ${locale}!`);
        }
        const data = await fs.readFile(localeFile).then(b => b.toString()).then(JSON.parse);
        this.localeCache[locale] = data;
        this.used = data;
        this.usedName = locale;
        return data;
    }
}
