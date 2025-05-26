// src/tiptap-extensions/CommentMark.ts
import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentMarkOptions {
    HTMLAttributes: Record<string, string | number | boolean | undefined>;
}

// Deklaracja, aby TypeScript wiedział o nowym poleceniu
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        commentMark: {
            /**
             * Set a comment mark
             */
            setCommentMark: (attributes: { commentId: string }) => ReturnType;
            /**
             * Toggle a comment mark
             */
            toggleCommentMark: (attributes: { commentId: string }) => ReturnType;
            /**
             * Unset a comment mark
             */
            unsetCommentMark: () => ReturnType;
        };
    }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
    name: 'commentMark',

    defaultOptions: {
        HTMLAttributes: {},
    },

    addAttributes() {
        return {
            commentId: {
                default: null,
                parseHTML: element => element.getAttribute('data-comment-id'),
                renderHTML: attributes => {
                    if (!attributes.commentId) {
                        return {};
                    }
                    return {
                        'data-comment-id': attributes.commentId,
                        'class': 'comment-highlight' // Upewnij się, że ta klasa jest używana
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-comment-id]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        // Tworzy tag <span> z połączonymi atrybutami (w tym tymi z addAttributes)
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setCommentMark: attributes => ({ commands }) => {
                return commands.setMark(this.type, attributes);
            },
            toggleCommentMark: attributes => ({ commands }) => {
                return commands.toggleMark(this.type, attributes);
            },
            unsetCommentMark: () => ({ commands }) => {
                return commands.unsetMark(this.type);
            },
        };
    },
});

export default CommentMark;