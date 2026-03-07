import { useState } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getDocument } from '../../api/documentsApi';

/**
 * Three-tab document viewer:
 *   Preview   — iframe with presigned download URL (PDF/image)
 *   Extracted Fields — key-value pairs from document.extractedFields
 *   Raw Text  — plain text from document.extractedText
 *
 * Only rendered when documentId is set. Parent controls visibility.
 */
export default function DocumentViewerModal({ documentId, onClose }) {
  const [tab, setTab] = useState('preview');

  const { data: doc, isLoading } = useQuery({
    queryKey: ['documents', documentId],
    queryFn: () => getDocument(documentId),
    enabled: !!documentId,
  });

  const fields = (() => {
    if (!doc?.extractedFields) return {};
    if (typeof doc.extractedFields === 'string') {
      try { return JSON.parse(doc.extractedFields); } catch { return {}; }
    }
    return doc.extractedFields;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4
                      flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900 truncate">
            {isLoading ? 'Loading...' : (doc?.name ?? 'Document Viewer')}
          </h3>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 px-4">
          {[['preview','Preview'],['fields','Extracted Fields'],['text','Raw Text']]
            .map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${ 
                tab === k
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{l}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">
              Loading document...</div>
          )}

          {!isLoading && tab === 'preview' && (
            doc?.downloadUrl
              ? <iframe src={doc.downloadUrl}
                  className="w-full h-[60vh] rounded-lg border border-gray-200"
                  title="Document preview" />
              : <Empty text="Preview not available" />
          )}

          {!isLoading && tab === 'fields' && (
            <div className="space-y-2">
              {Object.keys(fields).length === 0
                ? <p className="text-sm text-gray-400">
                    No fields extracted for this document type.</p>
                : Object.entries(fields).map(([k, v]) => (
                    <div key={k}
                      className="flex gap-4 py-2 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500
                        uppercase w-40 flex-shrink-0">
                        {k.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-gray-800">{String(v)}</span>
                    </div>
                  ))
              }
            </div>
          )}

          {!isLoading && tab === 'text' && (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
              {doc?.extractedText || 'No text extracted.'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-gray-400">
      {text}
    </div>
  );
}
