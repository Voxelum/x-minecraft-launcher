export declare interface ResourceParser {
    domain: string
    parse: (name: string, data: Buffer, type: string) => any
}
