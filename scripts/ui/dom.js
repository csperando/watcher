export const $ = (id) => document.getElementById(id);

export function setBadge(el, state, label) {
    el.className = "badge " + state;
    el.textContent = label;
}
