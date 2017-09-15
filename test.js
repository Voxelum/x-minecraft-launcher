const parser = require('fast-html-parser')

function convert(node) {
    let text = '';
    if (node instanceof parser.TextNode) {
        text += node.rawText;
    } else if (node instanceof parser.HTMLElement) {
        const attrs = node.rawAttrs === '' ? '' : ` ${node.rawAttrs}`
        if (node.tagName !== null) text += `<${node.tagName}${attrs}>`
        if (node.childNodes.length !== 0) for (const c of node.childNodes) text += convert(c)
        if (node.tagName !== null) text += `</${node.tagName}>`
    } else throw new Error('Unsupported type');
    return text
}

const parsed = parser.parse(`
<label class="form-control header-search-wrapper js-chromeless-input-container">
<a href="/InfinityStudio/ILauncher" class="header-search-scope no-underline">This repository</a>
<input type="text"
class="form-control header-search-input js-site-search-focus js-site-search-field is-clearable"
data-hotkey="s"
name="q"
value=""
placeholder="Search"
aria-label="Search this repository"
data-unscoped-placeholder="Search GitHub"
data-scoped-placeholder="Search"
autocapitalize="off">
<input type="hidden" class="js-site-search-type-field" name="type" >
</label>`)
console.log(parsed)
console.log()
console.log(convert(parsed))
