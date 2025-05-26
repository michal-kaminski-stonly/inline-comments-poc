import { InlineComment } from '@/types/comment.types';

export const loadCommentsFromStorage = (key: string): InlineComment[] => {
    if (typeof window === 'undefined') return [];
    const storedComments = localStorage.getItem(key);
    if (storedComments) {
        try {
            const parsedComments = JSON.parse(storedComments);
            if (Array.isArray(parsedComments)) {
                return parsedComments.map((commentData: unknown) => {
                    // Walidacja i transformacja danych komentarza
                    if (
                        typeof commentData === 'object' &&
                        commentData !== null &&
                        'id' in commentData && typeof commentData.id === 'string' &&
                        'author' in commentData && typeof commentData.author === 'string' &&
                        'text' in commentData && typeof commentData.text === 'string' &&
                        'createdAt' in commentData && (typeof commentData.createdAt === 'string' || typeof commentData.createdAt === 'number') &&
                        // Opcjonalne pole position
                        (!('position' in commentData) || 
                         (typeof commentData.position === 'object' && commentData.position !== null &&
                          (!('from' in commentData.position) || typeof commentData.position.from === 'number') &&
                          (!('to' in commentData.position) || typeof commentData.position.to === 'number') &&
                          (!('textFragment' in commentData.position) || typeof commentData.position.textFragment === 'string') &&
                          (!('path' in commentData.position) || typeof commentData.position.path === 'string') &&
                          (!('startOffset' in commentData.position) || typeof commentData.position.startOffset === 'number') &&
                          (!('endOffset' in commentData.position) || typeof commentData.position.endOffset === 'number')
                         )
                        )
                    ) {
                        const typedCommentData = commentData as Partial<InlineComment> & { createdAt: string | number };
                        return {
                            id: typedCommentData.id!,
                            author: typedCommentData.author!,
                            text: typedCommentData.text!,
                            createdAt: new Date(typedCommentData.createdAt),
                            position: typedCommentData.position ? {
                                from: typedCommentData.position.from,
                                to: typedCommentData.position.to,
                                textFragment: typedCommentData.position.textFragment,
                                path: typedCommentData.position.path,
                                startOffset: typedCommentData.position.startOffset,
                                endOffset: typedCommentData.position.endOffset,
                            } : undefined,
                        } as InlineComment;
                    }
                    console.warn('Invalid comment data in localStorage:', commentData);
                    return null; 
                }).filter((comment: InlineComment | null): comment is InlineComment => comment !== null);
            }
            console.error(`Stored data for key ${key} is not an array:`, parsedComments);
            return [];
        } catch (error) {
            console.error(`Error parsing comments from localStorage (key: ${key}):`, error);
            return [];
        }
    }
    return [];
};

export const loadEditorContentFromStorage = (key: string, defaultValue: string): string => {
    if (typeof window === 'undefined') return defaultValue;
    return localStorage.getItem(key) || defaultValue;
};

export const saveCommentsToStorage = (key: string, comments: InlineComment[]): void => {
    if (typeof window === 'undefined') return;
    if (comments.length > 0) {
        localStorage.setItem(key, JSON.stringify(comments));
    } else {
        localStorage.removeItem(key);
    }
};