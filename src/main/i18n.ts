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

export function t(key: string, args?: object) {
    const content = usingLocaleContent;
    const result = content[key] || defaultLocaleContent[key];
    if (!result) return key;
    const templateString = typeof result === 'object' ? (result as any)[''] : result;
    return format(templateString, args);
}

