import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useState, useCallback, useEffect } from 'react';
import CommentMark from '@/tiptap-extensions/CommentMark';
import { InlineComment } from '@/types/comment.types';
import {defaultEditorContent} from '@/components/defaultEditorContent'; // Import our comment type

// Use unique localStorage keys for this variant
const COMMENTS_LOCAL_STORAGE_KEY_WITH_ID = 'tiptap-inline-comments_with_span';
const EDITOR_CONTENT_LOCAL_STORAGE_KEY_WITH_ID = 'tiptap-editor-content_with_span';

// Optional: Basic styles for the editor, can be moved to a separate CSS file
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

const InlineCommentsWithContentSpan = () => {
    const [comments, setComments] = useState<InlineComment[]>([]);
    // State for the initial editor content to avoid hydration issues in Next.js
    const [initialContent, setInitialContent] = useState<string | undefined>(undefined);

    // Loading comments and EDITOR CONTENT from localStorage when the component mounts
    useEffect(() => {
        console.log('[WithDataId] Initial load from localStorage.');
        if (typeof window !== 'undefined') {
            // Loading comments
            const storedComments = localStorage.getItem(COMMENTS_LOCAL_STORAGE_KEY_WITH_ID);
            if (storedComments) {
                try {
                    // Użyj zaimportowanej funkcji do ładowania i walidacji komentarzy
                    const parsedComments = JSON.parse(storedComments);
                    if (Array.isArray(parsedComments)) {
                        setComments(parsedComments.map((commentData: unknown) => {
                            // Walidacja i transformacja danych komentarza (uproszczona, można rozbudować jak w localStorage.utils.ts)
                            if (
                                typeof commentData === 'object' &&
                                commentData !== null &&
                                'id' in commentData && typeof commentData.id === 'string' &&
                                ('authorId' in commentData || 'author' in commentData) && // Akceptuj oba na razie
                                ('content' in commentData || 'text' in commentData) && // Akceptuj oba na razie
                                'createdAt' in commentData && (typeof commentData.createdAt === 'string' || typeof commentData.createdAt === 'number')
                            ) {
                                const typedCommentData = commentData as any; // Uproszczenie, docelowo pełna walidacja
                                return {
                                    id: typedCommentData.id,
                                    author: typedCommentData.author || typedCommentData.authorId,
                                    text: typedCommentData.text || typedCommentData.content,
                                    createdAt: new Date(typedCommentData.createdAt),
                                    resolved: typedCommentData.resolved || false,
                                    type: typedCommentData.type || 'contentSpan', // Domyślnie contentSpan
                                    position: typedCommentData.position ? { // Zachowaj pozycję jeśli istnieje
                                        textFragment: typedCommentData.position.textFragment,
                                        from: typedCommentData.position.from,
                                        to: typedCommentData.position.to,
                                        path: typedCommentData.position.path,
                                        startOffset: typedCommentData.position.startOffset,
                                        endOffset: typedCommentData.position.endOffset,
                                    } : { textFragment: typedCommentData.position?.textFragment || '' },
                                } as InlineComment;
                            }
                            console.warn('[WithDataId] Invalid comment data in localStorage:', commentData);
                            return null;
                        }).filter((comment: InlineComment | null): comment is InlineComment => comment !== null)
                        .filter(c => c.type === 'contentSpan')); // Filtruj po typie, jeśli to konieczne
                    } else {
                         console.error('Error parsing comments (WithDataId) from localStorage: Stored data is not an array.');
                         setComments([]);
                    }
                } catch (error) {
                    console.error('Error parsing comments (WithDataId) from localStorage:', error);
                    setComments([]);
                }
            }

            // Loading editor content
            const storedEditorContent = localStorage.getItem(EDITOR_CONTENT_LOCAL_STORAGE_KEY_WITH_ID);
            if (storedEditorContent) {
                setInitialContent(storedEditorContent);
            } else {
                setInitialContent(defaultEditorContent);
            }
        } else {
            // Fallback for SSR or when window is not available (though 'use client' should handle this)
            setInitialContent(defaultEditorContent);
        }
    }, []); // Run only once

    // Saving comments to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(COMMENTS_LOCAL_STORAGE_KEY_WITH_ID, JSON.stringify(comments));
        }
    }, [comments]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({}),
            CommentMark,
        ],
        // Use initialContent when it's available
        content: initialContent, // Key change: dynamic initial content
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none',
            },
        },
        // Saving editor content to localStorage on every update
        onUpdate: ({ editor: currentEditor }) => {
            if (typeof window !== 'undefined') {
                const htmlWithMarks = currentEditor.getHTML();
                console.log('[WithDataId] HTML saved to localStorage:', htmlWithMarks); // This HTML should contain .comment-highlight
                localStorage.setItem(EDITOR_CONTENT_LOCAL_STORAGE_KEY_WITH_ID, htmlWithMarks);
            }
        },
    }, [initialContent]); // Add initialContent as a dependency so the editor reloads when content is ready

    const handleAddComment = useCallback(() => {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        if (empty) {
            alert('Please select a text fragment to add a comment.');
            return;
        }
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        const commentId = `comment-dataid-${Date.now()}`;
        
        const newComment: InlineComment = {
            id: commentId,
            author: 'user-dataid', // Zmieniono z authorId
            text: `Comment (data-id) to: '${selectedText.substring(0, 20)}...'`, // Zmieniono z content
            createdAt: new Date(),
            resolved: false,
            type: 'contentSpan',   // Dodano type
            position: { textFragment: selectedText }, // Position może wymagać dostosowania dla tego typu
        };

        // Apply CommentMark to the selected text
        editor.chain().focus().setTextSelection({ from, to }).setCommentMark({ commentId }).run();
        
        setComments(prevComments => [...prevComments, newComment]);
    }, [editor]);

    const handleDeleteComment = useCallback((commentIdToDelete: string) => {
        if (!editor) return;
        setComments(prevComments => prevComments.filter(comment => comment.id !== commentIdToDelete));

        // Remove CommentMark from the editor
        const { tr, doc } = editor.state;
        const commentMarkType = editor.schema.marks[CommentMark.name]; // Pobierz typ Marka
        let markRemoved = false;

        if (commentMarkType) { // Upewnij się, że typ Marka istnieje
            doc.descendants((node, pos) => {
                if (!node.isText) return;
                const commentMarkInstance = node.marks.find(
                    mark => mark.type.name === CommentMark.name && mark.attrs.commentId === commentIdToDelete
                );
                if (commentMarkInstance) {
                    tr.removeMark(pos, pos + node.nodeSize, commentMarkType); // Użyj typu Marka
                    markRemoved = true;
                    return false; // Zatrzymaj przeszukiwanie po znalezieniu i usunięciu
                }
            });
        } else {
            console.error(`[WithDataId] CommentMark type '${CommentMark.name}' not found in editor schema.`);
        }

        if (markRemoved) {
            editor.view.dispatch(tr);
            // After removing the Mark, the editor's onUpdate should be called,
            // which will save the HTML without this Mark to localStorage.
        }
        editor.commands.focus();
    }, [editor]);

    const handleDeleteAllComments = useCallback(() => {
        if (!editor) return;
        
        // Remove all CommentMarks from the editor
        const { tr, doc } = editor.state;
        const commentMarkType = editor.schema.marks[CommentMark.name];
        if (commentMarkType) {
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
        }
        
        setComments([]); // Remove comments from state
        // The editor's onUpdate should be called after dispatch(tr), saving the clean HTML.
        // If we also want to reset the content to default:
        // editor.commands.setContent(getDefaultEditorContentWithId(), true); 
        // But this will remove all user content. Usually, we just want to remove comments.
        editor.commands.focus();
    }, [editor]);

    // Render the editor only when initialContent is set to avoid flickering / hydration issues
    if (initialContent === undefined || !editor) {
        return <div>Loading editor (variant with data-id)...</div>; // or null, or some spinner
    }

    return (
        <>
            <style jsx global>{editorStyles}</style> {/* Styling specific to Next.js/React */}
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
                        className='action-button delete-all'
                    >
                        Usuń Wszystkie Komentarze ({comments.length})
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 3 }}> {/* Kontener dla edytora */}
                    <EditorContent editor={editor} />
                </div>

                {comments.length > 0 && (
                    <div style={{ flex: 1, maxHeight: '600px', overflowY: 'auto', borderLeft: '1px solid #eee', paddingLeft: '1rem' }}> {/* Kontener dla komentarzy */}
                        <div className="comments-list">
                            <h3>Komentarze ({comments.length}):</h3>
                            {comments.map(comment => (
                                <div key={comment.id} className="comment-item">
                                    <div className="comment-item-content">
                                        <p><strong>ID:</strong> {comment.id}</p>
                                        <p><strong>Treść:</strong> {comment.text}</p>
                                        {/* W tym wariancie nie mamy pozycji from/to, tylko textFragment */}
                                        {comment.position?.textFragment && (
                                            <p style={{fontSize: '0.8em', color: '#555'}}>
                                                Fragment: "{String(comment.position.textFragment).substring(0,50)}..."
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

export default InlineCommentsWithContentSpan;