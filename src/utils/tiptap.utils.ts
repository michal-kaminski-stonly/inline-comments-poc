import {Editor} from '@tiptap/react';
import {InlineComment} from '@/types/comment.types';
import CommentMark from '@/tiptap-extensions/CommentMark';
import { Node as ProseMirrorNode, Mark } from 'prosemirror-model';

/**
 * Applies CommentMark to the selected text in the editor.
 */
export const applyCommentMarkToSelection = (editor: Editor, commentId: string): void => {
    const { from, to } = editor.state.selection;
    editor.chain().focus().setTextSelection({ from, to }).setCommentMark({ commentId }).run();
};

/**
 * Removes the CommentMark associated with the given comment ID from the entire editor document.
 * @returns true if the Mark was found and removed, false otherwise.
 */
export const removeCommentMarkFromDocument = (editor: Editor, commentIdToRemove: string): boolean => {
    const { tr, doc } = editor.state;
    const commentMarkType = editor.schema.marks[CommentMark.name];
    if (!commentMarkType) {
        console.error('CommentMark type not found in editor schema.');
        return false;
    }

    let markRemoved = false;
    doc.descendants((node, pos) => {
        if (!node.isText) return; // Marks are usually on text nodes

        const markInstance = node.marks.find(
            mark => mark.type.name === CommentMark.name && mark.attrs.commentId === commentIdToRemove
        );

        if (markInstance) {
            // We remove the specific Mark from the given range (pos to pos + node.nodeSize)
            // Important: tr.removeMark can take a Mark type or the Mark itself to remove.
            // Using commentMarkType is safer if we want to remove all marks of this type from the range.
            // If we want to remove only THIS specific instance, we need to be more precise,
            // but Tiptap doesn't seem to have a simple API to 'remove this specific markInstance'.
            // Usually, we remove all marks of a given type from a range.
            tr.removeMark(pos, pos + node.nodeSize, commentMarkType);
            markRemoved = true;
            return false; // We stop searching for this node if we found and processed it
        }
    });

    if (markRemoved) {
        editor.view.dispatch(tr);
    }
    return markRemoved;
};

/**
 * Removes all instances of CommentMark from the editor document.
 * @returns true if any Marks were removed, false otherwise.
 */
export const removeAllCommentMarksFromDocument = (editor: Editor): boolean => {
    const { tr, doc } = editor.state;
    const commentMarkType = editor.schema.marks[CommentMark.name];

    if (!commentMarkType) {
        console.error('CommentMark type not found in editor schema.');
        return false;
    }

    let marksWerePresent = false;
    doc.descendants((node, pos) => {
        if (node.marks.some(mark => mark.type === commentMarkType)) {
            marksWerePresent = true;
            tr.removeMark(pos, pos + node.nodeSize, commentMarkType);
        }
    });

    if (marksWerePresent) {
        editor.view.dispatch(tr);
    }
    return marksWerePresent;
};

/**
 * Restores CommentMarks in the editor based on saved comments.
 */
export const restoreCommentMarksInEditor = (
    editor: Editor,
    commentsToRestore: InlineComment[],
    commentMarkTypeName: string
): void => {
    if (commentsToRestore.length === 0) {
        console.log('No comments to restore.');
        return;
    }

    const { tr: transaction } = editor.state;
    const commentMarkType = editor.schema.marks[commentMarkTypeName];

    if (!commentMarkType) {
        console.error(`Mark type '${commentMarkTypeName}' not found in editor schema!`);
        return;
    }

    let modified = false;
    const docSize = editor.state.doc.content.size;

    commentsToRestore.forEach(comment => {
        if (comment.position && typeof comment.position.from === 'number' && typeof comment.position.to === 'number') {
            const { from, to } = comment.position;
            if (from >= 0 && to <= docSize && from < to) {
                try {
                    transaction.addMark(from, to, commentMarkType.create({ commentId: comment.id }));
                    modified = true;
                } catch (e) {
                    console.error(`Error restoring Mark for comment ${comment.id}:`, e);
                }
            } else {
                console.warn(
                    `Comment position ${comment.id} [${from},${to}] out of range (doc size: ${docSize}). Skipping.`
                );
            }
        } else {
            console.warn(`Invalid or missing position for comment ${comment.id}. Skipping.`);
        }
    });

    if (modified) {
        editor.view.dispatch(transaction);
        console.log(`Restored ${commentsToRestore.filter(c => c.position && typeof c.position.from === 'number').length} comment Marks.`);
    } else {
        console.log('No Mark modifications were made during restoration.');
    }
};

/**
 * Synchronizes comment positions with the editor state after a document change.
 * This function is separated from the onUpdate logic.
 */
export const syncCommentPositionsWithEditorState = (
    editorDoc: ProseMirrorNode,
    prevComments: InlineComment[],
): { updatedComments: InlineComment[]; commentsStateChanged: boolean } => {
    if (prevComments.length === 0) return { updatedComments: prevComments, commentsStateChanged: false };

    let commentsStateChanged = false;
    const currentMarksInDoc = new Map<string, { from: number; to: number }>();

    editorDoc.descendants((node: ProseMirrorNode, pos: number) => {
        if (node.isText) {
            node.marks.forEach((mark: Mark) => {
                if (mark.type.name === CommentMark.name && mark.attrs.commentId) {
                    const commentId = mark.attrs.commentId;
                    if (typeof commentId === 'string') {
                        const markSegmentFrom = pos;
                        const markSegmentTo = pos + node.nodeSize;

                        const existing = currentMarksInDoc.get(commentId);
                        if (!existing) {
                            currentMarksInDoc.set(commentId, { from: markSegmentFrom, to: markSegmentTo });
                        } else {
                            existing.from = Math.min(existing.from, markSegmentFrom);
                            existing.to = Math.max(existing.to, markSegmentTo);
                        }
                    }
                }
            });
        }
    });

    const updatedComments = prevComments.map(comment => {
        if (!comment.id) return comment;

        const isAlreadyOrphaned = comment.position && typeof comment.position.from !== 'number';
        const newMarkInfo = currentMarksInDoc.get(comment.id);

        if (newMarkInfo) {
            const newTextFragment = editorDoc.textBetween(newMarkInfo.from, newMarkInfo.to, ' ');
            const oldPos = comment.position;

            if (
                isAlreadyOrphaned ||
                !oldPos ||
                newMarkInfo.from !== oldPos.from ||
                newMarkInfo.to !== oldPos.to ||
                newTextFragment !== oldPos.textFragment
            ) {
                commentsStateChanged = true;
                return {
                    ...comment,
                    position: {
                        from: newMarkInfo.from,
                        to: newMarkInfo.to,
                        textFragment: newTextFragment,
                    },
                };
            }
        } else {
            if (!isAlreadyOrphaned && comment.position && typeof comment.position.from === 'number') {
                commentsStateChanged = true;
                console.warn(`Comment ${comment.id} (previous text: '${comment.position.textFragment}') has been orphaned.`);
                return {
                    ...comment,
                    position: {
                        textFragment: `[ORPHANED] ${comment.position.textFragment || 'No original text'}`,
                        from: undefined,
                        to: undefined,
                    },
                };
            }
        }
        return comment;
    });

    return { updatedComments, commentsStateChanged };
};