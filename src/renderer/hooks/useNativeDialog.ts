import { remote } from "electron";

export function useNativeDialog() {
    return remote.dialog;
}
