import {EditorContent, useEditor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import CommentMark from '@/tiptap-extensions/CommentMark';
import {InlineComment} from '@/types/comment.types';
import {loadCommentsFromStorage, loadEditorContentFromStorage, saveCommentsToStorage} from "@/utils/localStorage.utils";
import {saveCleanEditorContentToStorage} from "@/utils/editorContent.utils";

import {
    applyCommentMarkToSelection,
    removeAllCommentMarksFromDocument,
    removeCommentMarkFromDocument,
    restoreCommentMarksInEditor,
    syncCommentPositionsWithEditorState
} from "@/utils/tiptap.utils";
import {defaultEditorContent} from "@/components/defaultEditorContent";
import {PreserveSpacesExtension} from "@/tiptap-extensions/PreserveSpacesExtension";

// Use unique localStorage keys for this variant
const COMMENTS_LOCAL_STORAGE_KEY = 'tiptap-inline-comments_with_offset';
const EDITOR_CONTENT_LOCAL_STORAGE_KEY = 'tiptap-editor-content_with_offset';

const editorStyles = `
  .tiptap {
    border: 1px solid #ccc;
    padding: 10px;
    min-height: 200px;
    margin-bottom: 1rem; /* Add margin below the editor */
  }
  .tiptap p {
    margin: 0.5em 0;
  }
  .tiptap:focus {
    outline: 2px solid #007bff;
  }
  /* Style for comment highlight - class name must match the one in CommentMark.ts */
  .comment-highlight {
    background-color: #fff59d !important; /* Light yellow background, !important for certainty */
    border-bottom: 2px solid #fdd835 !important;
    cursor: pointer;
  }
  .action-button { /* Renamed from comment-button for generality */
    background-color: #007bff;
    color: white;
    border: none;
    padding: 8px 15px;
    margin-right: 10px; /* Added margin for multiple buttons */
    margin-bottom: 1rem;
    cursor: pointer;
    border-radius: 4px;
  }
  .action-button:hover {
    background-color: #0056b3;
  }
  .action-button.delete-all { /* Style for delete all button */
    background-color: #dc3545;
  }
  .action-button.delete-all:hover {
    background-color: #c82333;
  }
  .comments-list {
    margin-top: 1rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }
  .comment-item {
    background-color: #f9f9f9;
    border: 1px solid #ddd;
    padding: 10px;
    margin-bottom: 8px;
    border-radius: 4px;
    display: flex; /* Flex for arranging the delete button */
    justify-content: space-between;
    align-items: flex-start;
  }
  .comment-item-content {
    flex-grow: 1;
  }
  .comment-item p {
    margin: 0 0 5px 0;
  }
  .comment-delete-button {
    background-color: #ffc107;
    color: #212529;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
    border-radius: 4px;
    margin-left: 10px; /* Margin from the comment content */
  }
  .comment-delete-button:hover {
    background-color: #e0a800;
  }
`;

const InlineCommentsWithOffset = () => {
    const [comments, setComments] = useState<InlineComment[]>([]);
    const [initialContent, setInitialContent] = useState<string | undefined>(undefined);
    const [areCommentsLoaded, setAreCommentsLoaded] = useState<boolean>(false);
    const [isEditorInitialized, setIsEditorInitialized] = useState<boolean>(false);
    const [areMarksRestored, setAreMarksRestored] = useState<boolean>(false);

    useEffect(() => {
        console.log('[EditorWithoutDataId] Initial loading...');
        const loadedComments = loadCommentsFromStorage(COMMENTS_LOCAL_STORAGE_KEY);
        setComments(loadedComments);
        setAreCommentsLoaded(true);

        const loadedContent = loadEditorContentFromStorage(EDITOR_CONTENT_LOCAL_STORAGE_KEY, defaultEditorContent);
        setInitialContent(loadedContent);
    }, []);

    useEffect(() => {
        if (areCommentsLoaded) {
            saveCommentsToStorage(COMMENTS_LOCAL_STORAGE_KEY, comments);
        }
    }, [comments, areCommentsLoaded]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({}),
            CommentMark,
            PreserveSpacesExtension,
        ],
        content: initialContent,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none',
            },
        },
        onUpdate: ({editor, transaction}) => {
            // Save clean editor content (without comment spans)
            saveCleanEditorContentToStorage(EDITOR_CONTENT_LOCAL_STORAGE_KEY, editor);
            debugger;
            if (transaction.docChanged) {
                setComments(prevComments => {
                    const {updatedComments, commentsStateChanged} = syncCommentPositionsWithEditorState(
                        editor.state.doc,
                        prevComments,
                    );

                    if (commentsStateChanged) {
                        return updatedComments;
                    }
                    return prevComments;
                });
            }
        },
        onCreate: ({editor: createdEditor}) => {
            if (initialContent !== undefined) {
                setIsEditorInitialized(true);
            }
        },
    }, [initialContent]);

    useEffect(() => {
        if (editor && isEditorInitialized && areCommentsLoaded && !areMarksRestored) {
            const commentsToActuallyRestore = comments.filter(c => typeof c.position?.from === 'number' && typeof c.position?.to === 'number');
            if (commentsToActuallyRestore.length > 0) {
                console.log(`[EditorWithoutDataId] Attempting to restore ${commentsToActuallyRestore.length} comment Marks with valid positions.`);
                restoreCommentMarksInEditor(editor, commentsToActuallyRestore, CommentMark.name);
            } else if (comments.length > 0) {
                console.log('[EditorWithoutDataId] Comments exist, but none have valid positions to restore as Marks.');
            } else {
                console.log('[EditorWithoutDataId] No comments to restore.');
            }
            setAreMarksRestored(true);
        }
    }, [editor, isEditorInitialized, areCommentsLoaded, comments, areMarksRestored]);

    const handleAddComment = useCallback(() => {
        if (!editor) return;
        const {from, to, empty} = editor.state.selection;
        if (empty) {
            alert('Please select a text fragment to add a comment.');
            return;
        }
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        const commentId = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        applyCommentMarkToSelection(editor, commentId);

        const newComment: InlineComment = {
            id: commentId,
            author: 'user-current',
            text: `Comment to: '${selectedText.substring(0, 30).trim()}${selectedText.length > 30 ? '...' : ''}'`,
            createdAt: new Date(),
            resolved: false,
            type: 'offset',
            position: {from, to, textFragment: selectedText},
        };

        setComments(prevComments => [...prevComments, newComment]);
    }, [editor]);

    const handleDeleteComment = useCallback((commentIdToDelete: string) => {
        if (!editor) return;

        const markWasRemoved = removeCommentMarkFromDocument(editor, commentIdToDelete);
        if (markWasRemoved) {
            console.log(`[EditorWithoutDataId] Mark for comment ${commentIdToDelete} removed from editor.`);
        } else {
            console.warn(`[EditorWithoutDataId] Mark not found for comment ${commentIdToDelete} in editor.`);
        }

        setComments(prevComments => prevComments.filter(comment => comment.id !== commentIdToDelete));

        editor.commands.focus();
    }, [editor]);

    const handleDeleteAllComments = useCallback(() => {
        if (!editor) return;

        const marksWereRemoved = removeAllCommentMarksFromDocument(editor);
        if (marksWereRemoved) {
            console.log('[EditorWithoutDataId] All comment Marks removed from editor.');
        }

        setComments([]);

        editor.commands.focus();
    }, [editor]);

    const isLoading = useMemo(() => {
        return !isEditorInitialized || !areCommentsLoaded || initialContent === undefined;
    }, [isEditorInitialized, areCommentsLoaded, initialContent]);

    if (isLoading || !editor) {
        return <div>Loading editor (variant without data-id)...</div>;
    }

    return (
        <>
            <style jsx global>{editorStyles}</style>
            <div>
                <button
                    onClick={handleAddComment}
                    className="action-button"
                    disabled={!editor || editor.state.selection.empty}
                >
                    Dodaj Komentarz
                </button>
                {comments.length > 0 && (
                    <button
                        onClick={handleDeleteAllComments}
                        className="action-button delete-all"
                    >
                        Usuń Wszystkie Komentarze ({comments.length})
                    </button>
                )}
            </div>

            <div style={{display: 'flex', gap: '1rem'}}>
                <div style={{flex: 3}}> {/* Kontener dla edytora */}
                    <EditorContent editor={editor}/>
                </div>
                {comments.length > 0 && (
                    <div style={{
                        flex: 1,
                        maxHeight: '600px',
                        overflowY: 'auto',
                        borderLeft: '1px solid #eee',
                        paddingLeft: '1rem'
                    }}> {/* Kontener dla komentarzy */}
                        <div className="comments-list">
                            <h3>Komentarze ({comments.length}):</h3>
                            {comments.map(comment => (
                                <div key={comment.id} className="comment-item"
                                     style={(typeof comment.position?.from !== 'number' || typeof comment.position?.to !== 'number') ? {
                                         opacity: 0.6,
                                         borderLeft: '3px solid orange'
                                     } : {}}>
                                    <div className="comment-item-content">
                                        <p><strong>ID:</strong> {comment.id.substring(0, 15)}...</p>
                                        <p><strong>Treść:</strong> {comment.text}</p>
                                        {comment.position && (
                                            <p style={{fontSize: '0.8em', color: '#555'}}>
                                                Fragment: "{String(comment.position.textFragment).substring(0, 50)}..."
                                                {(typeof comment.position.from === 'number' && typeof comment.position.to === 'number')
                                                    ? ` (poz: ${comment.position.from}-${comment.position.to})`
                                                    : ` (pozycja nieznana)`
                                                }
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="comment-delete-button"
                                    >
                                        Usuń
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default InlineCommentsWithOffset;