// src/types/comment.ts
export interface InlineReply {
    id: string;
    author: string;
    text: string;
    createdAt: Date;
}

export interface InlineComment {
    id: string;
    author: string;
    text: string;
    createdAt: Date;
    resolved: boolean;
    type: 'offset' | 'nodePath' | 'contentSpan';
    position?: {
        textFragment?: string;
        from?: number;
        to?: number;
        path?: string;
        startOffset?: number;
        endOffset?: number;
    };
    replies?: InlineReply[];
}