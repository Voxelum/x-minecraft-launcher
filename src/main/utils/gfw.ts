import inGFW from 'in-gfw';

const inside = inGFW().catch(() => false);

export function gfw() {
    return inside;
}
