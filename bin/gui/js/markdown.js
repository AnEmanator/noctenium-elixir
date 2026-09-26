// tiny helper: markdown -> sanitized HTML safe to inject (renderer runs nodeIntegration)
let render = null;

function build() {
    const marked = require('marked');
    let DOMPurify = require('dompurify');
    // dompurify returns a factory when there's no window, an instance when there is
    if (typeof DOMPurify.sanitize !== 'function') DOMPurify = DOMPurify(window);

    return md => {
        if (!md) return '';
        const html = marked.parse(String(md), { gfm: true, breaks: false });
        return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
    };
}

// returns sanitized html, or null if the markdown libs aren't available
function renderMarkdown(md) {
    try {
        if (!render) render = build();
        return render(md);
    } catch (e) {
        console.warn('markdown render failed (marked/dompurify missing?):', e.message);
        return null;
    }
}

module.exports = { renderMarkdown };
