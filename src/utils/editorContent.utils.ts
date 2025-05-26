import {Editor} from '@tiptap/react';

export const cleanHtmlFromCommentHighlights = (htmlWithMarks: string): string => {
    if (typeof window === 'undefined') return htmlWithMarks;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlWithMarks, 'text/html');
    const commentSpans = doc.body.querySelectorAll('span.comment-highlight');

    commentSpans.forEach(span => {
        const parent = span.parentNode;
        if (parent) {
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
        }
    });
    return doc.body.innerHTML;
};

export const saveCleanEditorContentToStorage = (key: string, editor: Editor | null): void => {
    if (typeof window === 'undefined' || !editor) return;

    const rawHtml = editor.getHTML();
    const cleanHtml = cleanHtmlFromCommentHighlights(rawHtml);
    console.log('[EditorWithoutDataId] saving content without spans:\n', cleanHtml);
    localStorage.setItem(key, cleanHtml);
};
