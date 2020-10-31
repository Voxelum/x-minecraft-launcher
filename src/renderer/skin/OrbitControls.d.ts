import { Camera, Vector3 } from 'three';

export declare class OrbitControls {
    public target: Vector3

    public enablePan: boolean

    public enableKeys: boolean

    public maxDistance: number

    public minDistance: number

    public autoRotate: boolean

    public autoRotateSpeed: number

    public zoomSpeed: number

    public enableDamping: boolean

    public dampingFactor: number

    public rotateSpeed: number

    constructor(camera: Camera, domElement: Element);

    update(): void
}
