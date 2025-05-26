import React from 'react';
import {InlineComment} from "@/types/comment.types";

interface CommentListDisplayProps {
    comments: InlineComment[];
    onDeleteComment: (commentId: string) => void;
}

const CommentListDisplay: React.FC<CommentListDisplayProps> = ({ comments, onDeleteComment }) => {
    if (comments.length === 0) {
        return null;
    }

    return (
        <div className="comments-list">
            <h3>Comments ({comments.length}):</h3>
    {comments.map(comment => (
        <div key={comment.id} className="comment-item">
    <div className="comment-item-content">
        <p><strong>ID:</strong> {comment.id.substring(0, 15)}...</p>
    <p><strong>Author:</strong> {comment.author}</p>
    <p><strong>Content:</strong> {comment.text}</p>
        {comment.position && typeof comment.position.textFragment === 'string' && (
            <p><em>(Associated text: "{comment.position.textFragment.substring(0,50)}{comment.position.textFragment.length > 50 ? '...' : ''}")</em></p>
        )}
        {comment.position && typeof comment.position.from === 'number' && typeof comment.position.to === 'number' && (
            <p><small>Position (offsets): {comment.position.from}-{comment.position.to}</small></p>
        )}
        <small>Date: {comment.createdAt.toLocaleString()}</small>
    </div>
    <button
        onClick={() => onDeleteComment(comment.id)}
        className="comment-delete-button"
            >
            Delete
            </button>
            </div>
    ))}
    </div>
);
};

export default CommentListDisplay;