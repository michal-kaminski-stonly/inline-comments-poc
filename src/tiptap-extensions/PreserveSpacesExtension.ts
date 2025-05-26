import { Extension } from '@tiptap/core';
import { Slice, Fragment, Node as ProseMirrorNode, Mark } from 'prosemirror-model';
import { Plugin, PluginKey, Transaction, TextSelection } from 'prosemirror-state';

// Helper function to replace sequences of spaces
// Example: 'a  b' -> 'a\\u00A0\\u00A0b' (where \\u00A0 is the NO-BREAK SPACE character)
// Example: 'a   b' -> 'a\\u00A0\\u00A0\\u00A0b'
// Single spaces remain untouched: 'a b c' -> 'a b c'
function replaceConsecutiveSpacesWithNbsp(text: string): string {
    // Regex: finds two or more consecutive spaces
    // We use the Unicode NO-BREAK SPACE (U+00A0) character instead of the HTML entity '&nbsp;'
    return text.replace(/ {2,}/g, (match) => '\u00A0'.repeat(match.length));
}

export const PreserveSpacesExtension = Extension.create({
    name: 'preserveSpaces',

    addProseMirrorPlugins() {
        return [
            // Plugin to handle pasting content
            new Plugin({
                key: new PluginKey('preserveSpacesOnPastePlugin'),
                props: {
                    handlePaste: (view, event, slice) => {
                        let modifiedSliceContent = false;
                        const { schema } = view.state;

                        // Recursively processes nodes in the pasted fragment (slice)
                        function processNode(node: ProseMirrorNode): ProseMirrorNode {
                            if (node.isText) {
                                const textContent = node.text || '';
                                const newTextContent = replaceConsecutiveSpacesWithNbsp(textContent);
                                if (newTextContent !== textContent) {
                                    modifiedSliceContent = true;
                                    return schema.text(newTextContent, node.marks);
                                }
                                return node;
                            }

                            // If the node has children, process them recursively
                            if (node.content && node.content.size > 0) {
                                const newChildNodes: ProseMirrorNode[] = [];
                                let childrenModified = false;
                                node.content.forEach((childNode) => {
                                    const processedChild = processNode(childNode);
                                    if (processedChild !== childNode) {
                                        childrenModified = true;
                                    }
                                    newChildNodes.push(processedChild);
                                });

                                if (childrenModified) {
                                    modifiedSliceContent = true; // Propagate information about modification upwards
                                    return node.copy(Fragment.fromArray(newChildNodes));
                                }
                            }
                            return node; // Return the original node if there were no changes
                        }

                        const newNodesArray: ProseMirrorNode[] = [];
                        slice.content.forEach(node => {
                            newNodesArray.push(processNode(node));
                        });

                        if (modifiedSliceContent) {
                            const newFragment = Fragment.fromArray(newNodesArray);
                            const newSlice = new Slice(newFragment, slice.openStart, slice.openEnd);
                            // Dispatch a transaction to replace the selection with the modified fragment
                            view.dispatch(view.state.tr.replaceSelection(newSlice));
                            return true; // Informs that pasting has been handled
                        }
                        return false; // Use default paste handling
                    },
                },
            }),

            // MODIFIED Plugin to handle spaces during typing
            new Plugin({
                key: new PluginKey('preserveSpacesOnTypeOrChangePlugin'),
                appendTransaction: (transactions, oldState, newState) => {
                    // We are only interested in transactions that changed the document and are the result of user input
                    const docChangedTransaction = transactions.find(
                        (tr) => tr.docChanged && tr.getMeta('uiEvent') !== 'paste' && tr.steps.length > 0
                    );

                    if (!docChangedTransaction) {
                        return null;
                    }

                    const changes: { pos: number; nodeSize: number; newText: string; marks: readonly Mark[] }[] = [];

                    newState.doc.descendants((node, pos) => {
                        if (!node.isText || !node.text) {
                            return true;
                        }
                        const textContent = node.text;
                        const newTextContent = replaceConsecutiveSpacesWithNbsp(textContent);
                        if (newTextContent !== textContent) {
                            changes.push({
                                pos,
                                nodeSize: node.nodeSize,
                                newText: newTextContent,
                                marks: node.marks,
                            });
                        }
                        return false;
                    });

                    if (changes.length > 0) {
                        let tr = newState.tr; // Start with the newState transaction

                        // Apply changes in reverse order
                        for (let i = changes.length - 1; i >= 0; i--) {
                            const change = changes[i];
                            const from = change.pos;
                            const to = from + change.nodeSize;
                            const newTextNode = newState.schema.text(change.newText, change.marks);

                            tr.replaceWith(from, to, newTextNode);
                        }

                        // If the transaction actually changed something
                        if (tr.docChanged) {
                            // After applying our changes (replacing spaces with nbsp) to the `tr` transaction,
                            // we need to ensure that the selection is correctly updated.
                            // `newState.selection` is the selection that was current *before* our modifications in `tr`.
                            // We map this selection through the changes made in `tr`.
                            const newSelection = newState.selection.map(tr.doc, tr.mapping);
                            // We set this mapped selection as the new transaction selection.
                            tr = tr.setSelection(newSelection);
                            return tr;
                        }
                    }
                    return null;
                },
            }),
        ];
    },
});
