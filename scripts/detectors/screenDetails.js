// ---------- 2. getScreenDetails() ----------
export function isScreenDetailsSupported() {
    return "getScreenDetails" in window;
}

export async function requestScreenDetails() {
    return window.getScreenDetails();
}

export function shapeScreens(screens) {
    return screens.map((s) => ({
        label: s.label,
        width: s.width,
        height: s.height,
        left: s.left,
        top: s.top,
        isPrimary: s.isPrimary,
        isInternal: s.isInternal,
        devicePixelRatio: s.devicePixelRatio
    }));
}

export function shapeScreensLive(screens) {
    return screens.map((s) => ({ width: s.width, height: s.height, left: s.left, top: s.top }));
}
