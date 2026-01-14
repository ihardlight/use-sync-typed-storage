export const CLEAR_STORAGE_EVENT = "clear-storage";

export function getCustomEventName(key: string) {
    return `storage-${key}`;
}

export function noop() {
    // no nothing
}
