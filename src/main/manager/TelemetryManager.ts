import { APP_INSIGHT_KEY, IS_DEV } from '@main/constant';
import { defaultClient, DistributedTracingModes, setup, TelemetryClient } from 'applicationinsights';
import { Manager } from '.';


export default class TelemetryManager extends Manager {
    private client: TelemetryClient = defaultClient;

    setup() {
        if (IS_DEV) {
            return;
        }
        setup(APP_INSIGHT_KEY)
            .setDistributedTracingMode(DistributedTracingModes.AI_AND_W3C)
            .setAutoCollectExceptions(true)
            .setAutoCollectConsole(false)
            .setAutoCollectPerformance(false)
            .setAutoCollectDependencies(false)
            .setAutoCollectRequests(false)
            .start();

        this.app.on('minecraft-start', (options) => {
            this.client.trackEvent({
                name: 'minecraft-start',
                properties: options,
            });
        });
        this.app.on('minecraft-exit', ({ code, signal, crashReport }) => {
            const normalExit = code === 0;
            const crashed = crashReport.length > 0;
            if (normalExit) {
                this.client.trackEvent({
                    name: 'minecraft-exit',
                });
            } else {
                this.client.trackEvent({
                    name: 'minecraft-exit',
                    properties: {
                        code,
                        signal,
                        crashed,
                    },
                });
            }
        });
    }

    storeReady() {
        // this.app.storeManager.store.subscribe((mutation) => {
        //     if (this.app.isParking) {
        //         return;
        //     }
        //     let resources: Resource[];
        //     if (mutation.type === 'resource') {
        //         resources = [mutation.payload];
        //     } else if (mutation.type === 'resources') {
        //         resources = mutation.payload;
        //     } else {
        //         return;
        //     }
        //     resources.filter((r) => r.type === 'forge' && r.source.curseforge)
        //         .forEach((r) => {
        //             r.source.curseforge
        //         });
        //     this.client.trackEvent
        // });
    }
}
