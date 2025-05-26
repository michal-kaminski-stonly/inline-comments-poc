import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import CommentMarkExtension from '@/tiptap-extensions/CommentMark';
import { InlineComment } from '@/types/comment.types';
import {
    loadCommentsFromStorage,
    loadEditorContentFromStorage,
    saveCommentsToStorage
} from '@/utils/localStorage.utils';
import { saveCleanEditorContentToStorage } from '@/utils/editorContent.utils';
import {
    calculateNodePathForProseMirrorSelection,
    restoreCommentMarksInEditorUsingNodePath,
} from '@/utils/tiptapNodePath.utils';
import {defaultEditorContent} from '@/components/defaultEditorContent';

const COMMENTS_STORAGE_KEY = 'tiptap-inline-comments-with_nodepath';
const EDITOR_CONTENT_STORAGE_KEY = 'tiptap-editor-content-with_nodepath';
const COMMENT_MARK_NAME = CommentMarkExtension.name || 'comment';

const editorStyles = `
  .tiptap {
    border: 1px solid #ccc;
    padding: 10px;
    min-height: 200px;
    margin-bottom: 1rem;
  }
  .tiptap:focus {
    outline: 2px solid #007bff;
  }
  .comment-highlight {
    background-color: #fff59d !important;
    border-bottom: 2px solid #fdd835 !important;
    cursor: pointer;
  }
  .action-button {
    background-color: #007bff;
    color: white;
    border: none;
    padding: 8px 15px;
    margin-right: 10px;
    margin-bottom: 1rem;
    cursor: pointer;
    border-radius: 4px;
  }
  .action-button:hover {
    background-color: #0056b3;
  }
  .action-button.delete-all {
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
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .comment-item-content {
    flex-grow: 1;
  }
  .comment-item p { margin: 0 0 5px 0; }
  .comment-delete-button {
    background-color: #ffc107;
    color: #212529;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
    border-radius: 4px;
    margin-left: 10px;
  }
  .comment-delete-button:hover {
    background-color: #e0a800;
  }
`;

const InlineCommentsWithNodePath: React.FC = () => {
    const [comments, setComments] = useState<InlineComment[]>([]);
    const [initialContent, setInitialContent] = useState<string | undefined>(undefined);
    const [areCommentsLoaded, setAreCommentsLoaded] = useState<boolean>(false);
    const [isEditorReady, setIsEditorReady] = useState<boolean>(false); // Renamed for clarity

    // Effect to load data from localStorage on initial render
    useEffect(() => {
        console.log('[NodePathPOC] Loading initial data...');
        const loadedComments = loadCommentsFromStorage(COMMENTS_STORAGE_KEY);
        setComments(loadedComments.filter(c => c.type === 'nodePath') || []);
        setAreCommentsLoaded(true);

        const loadedContent = loadEditorContentFromStorage(EDITOR_CONTENT_STORAGE_KEY, defaultEditorContent);
        setInitialContent(loadedContent);
    }, []);

    // Effect to save comments to localStorage when they change
    useEffect(() => {
        if (areCommentsLoaded) { // Save only if initial loading is complete
            saveCommentsToStorage(COMMENTS_STORAGE_KEY, comments);
            console.log('[NodePathPOC] Comments saved to localStorage.');
        }
    }, [comments, areCommentsLoaded]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Optional StarterKit configurations
            }),
            CommentMarkExtension,
        ],
        content: initialContent, // Loaded asynchronously
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none tiptap-editor-styles', // Added class for styles
            },
        },
        onUpdate: ({ editor: currentEditor, transaction }) => {
            if (!currentEditor) return;
            saveCleanEditorContentToStorage(EDITOR_CONTENT_STORAGE_KEY, currentEditor);

            if (transaction && transaction.docChanged) {
                console.log('[NodePathPOC] Document changed. Syncing comment positions (NodePath) - TODO.');
                // TODO: Call `syncCommentNodePathsWithEditorState` and update `comments`
            }
        },
        onCreate: () => {
            console.log(`[NodePathPOC] Editor initialized. Initial content ${initialContent ? 'loaded' : 'default'}.`);
            if (initialContent !== undefined) {
                 setIsEditorReady(true);
            }
        },
    }, [initialContent]); // Dependency on initialContent ensures editor reinitialization when content is ready

    // Effect to restore comment Marks after editor and comments are loaded
    useEffect(() => {
        if (editor && isEditorReady && areCommentsLoaded) {
            console.log('[NodePathPOC] Attempting to restore comment Marks.');
            const commentsToRestore = comments.filter(c => c.position && typeof c.position.path !== 'undefined');
            if (commentsToRestore.length > 0) {
                restoreCommentMarksInEditorUsingNodePath(editor, commentsToRestore, COMMENT_MARK_NAME);
            } else {
                console.log('[NodePathPOC] No comments to restore or no valid positions.');
            }
            // This effect should run only once after conditions are met,
            // so we don't need `areMarksRestored` state if the restoration logic is in `utils`.
        }
    }, [editor, isEditorReady, areCommentsLoaded, comments]); // comments as a dependency to try to restore after any change in comments (e.g., from another source)


    const handleAddComment = useCallback(() => {
        const editorInstance = editor;
        if (!editorInstance || editorInstance.state.selection.empty) {
            alert('Please select a text fragment to add a comment.');
            return;
        }

        const { from, to } = editorInstance.state.selection;
        const selectedText = editorInstance.state.doc.textBetween(from, to, ' ');
        
        const nodePathPosition = calculateNodePathForProseMirrorSelection(editorInstance, from, to);
        if (!nodePathPosition) {
            console.error('[NodePathPOC] Failed to determine NodePath (CSS-like) for selection.');
            alert('Could not add comment - problem with determining path.');
            return;
        }

        const commentId = `comment-nodepath-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        // Apply Mark to the selection
        editorInstance.chain().focus().setTextSelection({ from, to }).setMark(COMMENT_MARK_NAME, { commentId }).run();

        const newComment: InlineComment = {
            id: commentId,
            author: 'user-current',
            text: `Comment (NodePath CSS) to: '${selectedText.substring(0, 30).trim()}${selectedText.length > 30 ? '...' : ''}'`,
            createdAt: new Date(),
            resolved: false,
            type: 'nodePath',
            position: nodePathPosition,
        };

        setComments(prevComments => [...prevComments, newComment]);
    }, [editor]);

    const handleDeleteComment = useCallback((commentIdToDelete: string) => {
        if (!editor) return;

        console.warn(`[NodePathPOC] Mark removal from editor for comment ${commentIdToDelete} is not fully implemented here. Removing from list only.`);

        setComments(prevComments => prevComments.filter(comment => comment.id !== commentIdToDelete));
        editor.commands.focus();
    }, [editor]);

    const handleDeleteAllComments = useCallback(() => {
        if (!editor) return;
        // Remove all comment Marks from the document
        editor.chain().focus().selectAll().unsetMark(COMMENT_MARK_NAME).run();
        setComments([]);
        console.log('[NodePathPOC] Removed all comments and their Marks.');
        editor.commands.focus();
    }, [editor]);

    const isLoading = useMemo(() => {
        return !isEditorReady || !areCommentsLoaded || initialContent === undefined || !editor;
    }, [isEditorReady, areCommentsLoaded, initialContent, editor]);

    if (isLoading) {
        return <div>Loading editor (NodePath POC v2 variant)...</div>;
    }

    return (
        <>
            <style jsx global>{editorStyles}</style>
            <div>
                <button
                    onClick={handleAddComment}
                    className='action-button'
                    disabled={!editor || editor.state.selection.empty}
                >
                    Add Comment
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
            <EditorContent editor={editor} />
            {comments.length > 0 && (
                <div className="comments-list">
                    <h3>Komentarze (NodePath):</h3>
                    {comments.map(comment => (
                        <div key={comment.id} className="comment-item">
                            <div className="comment-item-content">
                                <p><strong>ID:</strong> {comment.id}</p>
                                <p>{comment.text}</p>
                                <p><small>Ścieżka: {comment.position?.path || 'Brak ścieżki'}</small></p>
                                <p><small>Offsety: {comment.position?.startOffset} - {comment.position?.endOffset}</small></p>
                                <p><small>Fragment: {comment.position?.textFragment || 'Brak'}</small></p>
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
            )}
        </>
    );
};

export default InlineCommentsWithNodePath;
