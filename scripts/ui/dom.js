export const $ = (id) => document.getElementById(id);

export function setBadge(el, state, label) {
    el.className = "badge " + state;
    el.textContent = label;
}

export function renderCard(badgeId, outId, result) {
    setBadge($(badgeId), result.state, result.label);
    $(outId).textContent = result.text;
    return result;
}
