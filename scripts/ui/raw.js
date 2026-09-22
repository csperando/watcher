import { $ } from "./dom.js";

// ---------- Raw diagnostics ----------
export function renderRawDiagnostics() {
    $("out-raw").textContent = JSON.stringify({
        screen: {
            width: screen.width, height: screen.height,
            availWidth: screen.availWidth, availHeight: screen.availHeight,
            availLeft: screen.availLeft, availTop: screen.availTop,
            isExtended: screen.isExtended ?? "unsupported",
            devicePixelRatio: window.devicePixelRatio
        },
        window: {
            screenX: window.screenX, screenY: window.screenY,
            outerWidth: window.outerWidth, outerHeight: window.outerHeight,
            innerWidth: window.innerWidth, innerHeight: window.innerHeight
        },
        apis: {
            "screen.isExtended": "isExtended" in screen,
            "window.getScreenDetails": "getScreenDetails" in window,
            "navigator.permissions": !!(navigator.permissions && navigator.permissions.query)
        }
    }, null, 2);
}
