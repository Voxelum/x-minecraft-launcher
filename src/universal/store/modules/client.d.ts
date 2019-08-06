

import { Module, Context } from "../store";

export declare namespace ClientModule {
    type ProtocolToVersion = {
        [protocol: string]: string[];
    };
    type PackFormatToVersioRange = {
        [range: string]: string;
    };

    type MinecraftVersion = string;

    interface ResourcePackFormatMapping {
        mcversion: {
            [format: number]: string;
        };
    }
    interface ClientProtocolMapping {
        protocol: {
            [mcversion: string]: number;
        };
        mcversion: {
            [protocol: number]: MinecraftVersion[];
        };
    }

    interface State {
        protocolMapping: ClientProtocolMapping;
        packFormatMapping: ResourcePackFormatMapping;
    }

    interface Getters {
        getAcceptMinecraftRangeByFormat(format: number): string;
        getAcceptMinecraftsByProtocol(protocol: number): string[];
        isResourcePackCompatible(format: number, mcversion: string): boolean;
    }

    interface Mutations {
        packFormatMapping(state: State, mapping: ResourcePackFormatMapping): void;
        protocolMapping(state: State, mapping: ClientProtocolMapping): void;
    }
    type C = Context<State, Getters, Mutations, Actions>;
    interface Actions {
    }
}
export interface ClientModule extends Module<"client", ClientModule.State, ClientModule.Getters, ClientModule.Mutations, ClientModule.Actions> { }

declare const mod: ClientModule;

export default mod;
