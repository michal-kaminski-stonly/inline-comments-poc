import { Editor } from '@tiptap/core';
import { Node as ProseMirrorNode, ResolvedPos} from 'prosemirror-model';

// Type definitions related to NodePath
export interface NodePathPosition {
    path: string; // CSS-like path
    startOffset: number; // Should be 0 if commenting the entire node
    endOffset: number;   // Should be nodeSize of the node if commenting the entire node
    textFragment?: string; // Optionally, for verification (entire textContent of the node)
}

/**
 * Maps ProseMirror node types to their corresponding HTML tags.
 * @param typeName The name of the ProseMirror node type.
 * @param attrs Attributes of the node, used for types like 'heading'.
 * @returns The HTML tag name as a string.
 */
// TODO: Consider defining a more specific type for attrs if possible,
// while maintaining flexibility for various ProseMirror node types.
export const prosemirrorTypeToTagName = (typeName: string, attrs?: Record<string, unknown>): string => {
    switch (typeName) {
        case 'paragraph': return 'p';
        case 'heading': return `h${attrs?.level || 1}`;
        case 'listItem': return 'li';
        case 'bulletList': return 'ul';
        case 'orderedList': return 'ol';
        case 'blockquote': return 'blockquote';
        // TODO: Consider adding more mappings as needed (e.g., for tables, images, code blocks)
        default: return typeName; // Default to returning the ProseMirror type name (e.g., 'text', 'hardBreak')
    }
};

/**
 * Calculates a path to the parent block/mark-holder node of the given ProseMirror selection 'from' position.
 * The path is constructed from the ProseMirror document structure.
 * @param editor The Tiptap editor instance.
 * @param from The start position of the user's selection in the document.
 * @returns A NodePathPosition object or null if calculation fails.
 */
export const calculateNodePathForProseMirrorSelection = (
    editor: Editor,
    from: number,
    // 'to' parameter is not strictly needed for path calculation to the common ancestor node
    // but could be used for more granular path or validation if selection spans multiple nodes.
    to: number 
): NodePathPosition | null => {
    if (!editor.state || typeof from !== 'number' || typeof to !== 'number') {
        console.error('[NodePathUtils] Invalid arguments for calculateNodePathForProseMirrorSelection.');
        return null;
    }

    const { doc } = editor.state;

    try {
        const $from: ResolvedPos = doc.resolve(from);

        // Determine the target depth for the path.
        // If $from points directly to a text node, we want the path to its parent.
        let targetNodeDepth = $from.depth;
        if (targetNodeDepth > 0 && $from.node(targetNodeDepth).isText) {
            targetNodeDepth = $from.depth - 1; 
        }
        if (targetNodeDepth < 0) targetNodeDepth = 0; // Should not happen with valid doc structure

        const pathSegments: string[] = [];
        // Iterate upwards from the target node's parent to the document root
        for (let d = targetNodeDepth; d > 0; d--) { 
            const nodeAtDepth: ProseMirrorNode = $from.node(d);
            const tagName = prosemirrorTypeToTagName(nodeAtDepth.type.name, nodeAtDepth.attrs);
            const indexInParent = $from.index(d - 1); // index of nodeAtDepth within its parent ($from.node(d-1))
            pathSegments.unshift(`${tagName}:nth-child(${indexInParent + 1})`);
        }
        const finalPathString = pathSegments.join(' > ');

        const targetNode: ProseMirrorNode = $from.node(targetNodeDepth);
        if (!targetNode) {
            console.error('[NodePathUtils] Could not identify target node for path construction.');
            return null;
        }

        const nodePathPosition: NodePathPosition = {
            path: finalPathString,
            startOffset: 0, // Path refers to the entire node, so offset is from its start
            endOffset: targetNode.nodeSize, // and to its end.
            textFragment: targetNode.textContent.trim(), // For verification
        };
        
        return nodePathPosition;

    } catch (error) {
        console.error('[NodePathUtils] Error calculating NodePathPosition:', error);
        return null;
    }
};

/**
 * Tries to restore a Tiptap Mark based on the saved NodePathPosition.
 * The comment will cover the ENTIRE node indicated by `path`.
 */
export const restoreMarkFromNodePath = (
    editor: Editor,
    comment: { id: string; position?: NodePathPosition },
    markName: string
): boolean => {
    if (!editor.state || !comment.position || typeof comment.position.path !== 'string') {
        console.warn(`[NodePathUtils] Missing position or path for comment ID: ${comment.id}`);
        return false;
    }

    const { path, textFragment } = comment.position; 
    const { doc } = editor.state;

    if (path === '') { 
        // Path is empty, implies a comment for the entire document.
        const absoluteFrom = 0;
        // doc.nodeSize includes the <doc> tags, doc.content.size is for the actual content.
        // We should apply mark to content.
        if (absoluteFrom < doc.content.size && doc.content.size > 0) { 
            editor.chain().setTextSelection({ from: absoluteFrom, to: doc.content.size }).setMark(markName, { commentId: comment.id }).run();
            return true;
        } else {
            // console.warn(`[NodePathUtils] Invalid range for entire document comment ${comment.id}`);
            return false;
        }
    }

    try {
        const segments = path.split(' > ');
        let currentNode: ProseMirrorNode | null = doc;
        let currentPosition = 0; // Tracks the start position of `currentNode` in the document

        for (const segment of segments) {
            const match = segment.match(/^([a-zA-Z0-9_-]+):nth-child\\((\\d+)\\)$/); // Adjusted regex for tag names
            if (!match || !currentNode) {
                console.warn(`[NodePathUtils] Invalid path segment '${segment}' or null current node. Comment ID: ${comment.id}.`);
                return false;
            }

            const [, tagName, childIndexStr] = match;
            const childIndex = parseInt(childIndexStr, 10) - 1; 

            if (childIndex < 0 || childIndex >= currentNode.childCount) {
                console.warn(`[NodePathUtils] Child index (${childIndex + 1}) out of range for segment '${segment}'. Node has ${currentNode.childCount} children. Comment ID: ${comment.id}.`);
                return false;
            }
            
            // Calculate offset to the target child.
            // This needs to account for the opening tag of the current node if it's not the doc itself.
            let childNodeStartPosInDoc = currentPosition + (currentNode === doc ? 0 : 1); // Skip current node's opening tag

            for(let i=0; i < childIndex; i++) {
                childNodeStartPosInDoc += currentNode.child(i).nodeSize;
            }
            
            currentNode = currentNode.child(childIndex);
            currentPosition = childNodeStartPosInDoc;


            if (!currentNode) { 
                console.warn(`[NodePathUtils] Could not find child for segment '${segment}'. Comment ID: ${comment.id}.`);
                return false;
            }
            
            const expectedTagName = prosemirrorTypeToTagName(currentNode.type.name, currentNode.attrs);
            if (expectedTagName !== tagName) {
                 console.warn(`[NodePathUtils] Tag mismatch in path segment '${segment}' for comment ${comment.id}. Expected ${expectedTagName}, path has ${tagName}. Node type: ${currentNode.type.name}`);
            }
        }

        const absoluteFrom = currentPosition;
        const absoluteTo = currentPosition + (currentNode?.nodeSize || 0);

        if (!currentNode || absoluteFrom < 0 || absoluteFrom > doc.content.size || absoluteTo > doc.content.size || absoluteFrom >= absoluteTo) {
            console.warn(`[NodePathUtils] Calculated positions [${absoluteFrom}-${absoluteTo}] for path '${path}' (comment ${comment.id}) are invalid or out of document range (${doc.content.size}).`);
            return false;
        }

        if (textFragment) {
            const currentWholeNodeText = currentNode.textContent.trim();
            if (currentWholeNodeText !== textFragment) {
                console.warn(`[NodePathUtils] Text content mismatch for comment ${comment.id} at path '${path}'. Expected: '${textFragment}', Found: '${currentWholeNodeText}'.`);
            }
        }
        
        editor.chain().setTextSelection({ from: absoluteFrom, to: absoluteTo }).setMark(markName, { commentId: comment.id }).run();
        return true;

    } catch (error) {
        console.error(`[NodePathUtils] Error restoring Mark for comment ${comment.id} from path '${path}':`, error);
        return false;
    }
};

/**
 * Iterates over comments and tries to restore Marks for them in the editor using NodePath.
 */
export const restoreCommentMarksInEditorUsingNodePath = (
    editor: Editor,
    commentsToRestore: Array<{ id: string; position?: NodePathPosition }>,
    markName: string
): void => {
    if (!editor.state || !commentsToRestore || commentsToRestore.length === 0) {
        return;
    }
    let restoredCount = 0;
    commentsToRestore.forEach(comment => {
        if (restoreMarkFromNodePath(editor, comment, markName)) {
            restoredCount++;
        }
    });
    console.log(`[NodePathUtils] Successfully restored ${restoredCount} of ${commentsToRestore.length} comment Marks using NodePath.`);
};
