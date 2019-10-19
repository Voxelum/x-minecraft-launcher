import locales from 'static/locales';

interface LocalNode {
    [key: string]: LocalNode | string;
}

const defaultLocaleContent = locales['en'];
let usingLocale = 'en';
let usingLocaleContent: LocalNode = defaultLocaleContent;


function onLocaleChange(newLocale: string) {
    usingLocale = newLocale;
    usingLocaleContent = locales[newLocale]
}

function format(templateString: string, args?: object) {
    if (!args) { return templateString; }
    let result = templateString;
    for (const [k, v] of Object.entries(args)) {
        result = result.replace(`{${k}}`, v.toString());
    }
    return result;
}

function find(queryPath: string[], node: LocalNode): string | LocalNode | undefined {
    let content: LocalNode | string = node;
    for (const p of queryPath) {
        if (typeof content === 'string') return undefined;
        const next: LocalNode | string | undefined = content[p];
        if (!next) return undefined;
        content = next;
    }
    return content;
}

export function t(key: string, args?: object) {
    const queryPath = key.split('.');
    const result = find(queryPath, usingLocaleContent) || find(queryPath, defaultLocaleContent);
    if (!result) return key;
    const templateString = typeof result === 'object' ? result[''] as string : result;
    return format(templateString, args);
}

