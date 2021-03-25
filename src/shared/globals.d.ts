/* eslint-disable */

declare module '/@/assets/locales/index.json' {
    type Locale = {
        [range: string]: string;
    };
    const locale: Locale;
    export = locale;
}

declare module '*.png' {
    const value: string;
    export default value;
}
