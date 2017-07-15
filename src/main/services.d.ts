export interface Service {
    initialize(): void;
    proxy: any;
    actions: any;
}
declare const services: { [id: string]: Service }
export default services