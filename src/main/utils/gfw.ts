import inGFW from 'in-gfw';

const inside = inGFW().catch(_ => false);

export function gfw() {
    return inside;
}
