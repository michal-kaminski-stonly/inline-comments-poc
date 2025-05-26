'use client';

import React, { useState, useEffect } from 'react';
import InlineCommentsWithContentSpan from "@/components/InlineCommentsWithContentSpan/InlineCommentsWithContentSpan";
import InlineCommentsWithOffset from "@/components/InlineCommentsWithOffset/InlineCommentsWithOffset";
import InlineCommentsWithNodePath from "@/components/InlineCommentsWithNodePatch/InlineCommentsWithNodePatch";

enum EditorVariant {
  CommentWithNodePath = 'CommentWithNodePath',
  CommentWithStaticSpan = 'CommentWithStaticSpan',
  CommentsWithOffset = 'CommentsWithOffset',
}

const tabButtonBaseStyle = "px-4 py-2 mr-2 rounded-t-lg focus:outline-none";
const tabButtonActiveStyle = "bg-blue-500 text-white";
const tabButtonInactiveStyle = "bg-gray-200 hover:bg-gray-300";

export default function InlineCommentsPocPage() {
  const [activeTab, setActiveTabState] = useState<EditorVariant>(EditorVariant.CommentsWithOffset);

  useEffect(() => {
    const storedTab = window.localStorage.getItem('lastActiveTab');
    if (storedTab && Object.values(EditorVariant).includes(storedTab as EditorVariant)) {
      const isValidVariant = Object.values(EditorVariant).some(variant => variant === storedTab);
      if (isValidVariant) {
        setActiveTabState(storedTab as EditorVariant);
      } else {
        console.warn(`Invalid tab value found in localStorage: ${storedTab}`);
      }
    }
  }, []);

  const setActiveTab =  (tab: EditorVariant) => {
    localStorage.setItem('lastActiveTab', tab);
    setActiveTabState(tab)
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1 className="text-2xl font-bold mb-4">Proof of Concept: Inline Comments</h1>

      <div className="mb-4 border-b border-gray-300">
        <button
            className={`${tabButtonBaseStyle} ${activeTab === EditorVariant.CommentWithNodePath ? tabButtonActiveStyle : tabButtonInactiveStyle}`}
            onClick={() => setActiveTab(EditorVariant.CommentWithNodePath)}
        >
          Node Path Tracking
        </button>

        <button
            className={`${tabButtonBaseStyle} ${activeTab === EditorVariant.CommentsWithOffset ? tabButtonActiveStyle : tabButtonInactiveStyle}`}
            onClick={() => setActiveTab(EditorVariant.CommentsWithOffset)}
        >
          Offset Calculation
        </button>

        <button
          className={`${tabButtonBaseStyle} ${activeTab === EditorVariant.CommentWithStaticSpan ? tabButtonActiveStyle : tabButtonInactiveStyle}`}
          onClick={() => setActiveTab(EditorVariant.CommentWithStaticSpan)}
        >
          Static Span in Content
        </button>

      </div>

      <div>
        <section style={{ display: activeTab === EditorVariant.CommentWithNodePath ? 'block' : 'none' }}>
          <h2 className="text-xl mb-2">Node Path Tracking</h2>
          <p className="text-sm mb-4">
            The comment position is saved as a path to the node in the document structure. Paths should be updated upon editor changes.
          </p>
          <InlineCommentsWithNodePath />
        </section>

        <section style={{ display: activeTab === EditorVariant.CommentsWithOffset ? 'block' : 'none' }}>
          <h2 className="text-xl mb-2">Offset Calculation</h2>
          <p className="text-sm mb-4">
            Comments are identified by numerical offsets (positions) in the text. Positions are recalculated after each content modification to maintain consistency.
          </p>
          <p className="text-sm mb-4">Deleting the commented text results in the removal of the offset and the comment's reference to the content.</p>
          <InlineCommentsWithOffset />
        </section>

        <section style={{ display: activeTab === EditorVariant.CommentWithStaticSpan ? 'block' : 'none' }}>
          <h2 className="text-xl mb-2">Static Span in Content</h2>
          <p className="text-sm mb-4">
            Comments are embedded as special tags directly in the HTML. The persistence of the comment depends on maintaining these tags in the content.
          </p>
          <InlineCommentsWithContentSpan />
        </section>
      </div>
      <div className="mt-4 flex justify-end">
        <button
            className="action-button delete-all"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
        >
          Clear local storage
        </button>
      </div>
    </main>
  );
}
