interface Server extends Profile {
    host: string,
    port: number,
    isLanServer: boolean,
    icon: string,
    status?: ServerStatus,
}