import { TextComponent } from 'ts-minecraft'

const colorCode = [];
for (let i = 0; i < 32; i += 1) {
    const j = ((i >> 3) & 1) * 85;  // eslint-disable-line no-bitwise
    let k = (((i >> 2) & 1) * 170) + j; // eslint-disable-line no-bitwise
    let l = (((i >> 1) & 1) * 170) + j; // eslint-disable-line no-bitwise
    let i1 = ((i & 1) * 170) + j; // eslint-disable-line no-bitwise
    if (i === 6) k += 85;
    if (i >= 16) {
        k /= 4;
        l /= 4;
        i1 /= 4;
    }
    colorCode[i] =
        ((k & 255) << 16) | ((l & 255) << 8) | (i1 & 255); // eslint-disable-line no-bitwise
}

export default {
    render(createElement) {
        const arr = []
        if (!this.source) return createElement('div')
        if (typeof this.source === 'string') return createElement('p', this.source)
        if (this.source.iterator) {
            for (const component of this.source.iterator) {
                let styleString = ''
                if (component.style.bold) styleString += 'font-weight:bold;';
                if (component.style.underlined) styleString += 'text-decoration: underline;';
                if (component.style.italic) styleString += 'font-style: italic;';
                if (component.style.strikethrough) styleString += 'text-decoration:line-through;';
                if (component.style.color) {
                    const code = colorCode[component.style.color.colorIndex];
                    const r = (code >> 16) / 255.0 // eslint-disable-line no-bitwise
                    const g = ((code >> 8) & 255) / 255.0 // eslint-disable-line no-bitwise
                    const b = (code & 255) / 255.0 // eslint-disable-line no-bitwise
                    styleString += `color: (${r}, ${g}, ${b})`
                }
                arr.push(createElement('p', { text: component.unformatted, style: styleString }))
            }
        }
        return createElement('div', arr)
    },
    props: { source: TextComponent },
}
