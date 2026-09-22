// Cross-method signal shared between the drag heuristic (method 5, writer)
// and the integrity check (method 6, reader). Kept as an explicit accessor
// pair rather than a bare global so the one real cross-detector dependency
// stays grep-able.
let dragMultiDetected = false;

export function recordDragOutOfBounds() {
    dragMultiDetected = true;
}

export function wasDragMultiDetected() {
    return dragMultiDetected;
}
