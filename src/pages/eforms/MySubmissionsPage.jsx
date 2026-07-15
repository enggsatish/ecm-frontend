/**
 * MySubmissionsPage.jsx
 * Route: /eforms/submissions/mine
 * Shows the current user's form submissions with status and actions.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Undo2, ExternalLink, FileText, Mail, X, Loader2, Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMySubmissions, useWithdrawSubmission, useSubmission, useUploadSignedCopy } from '../../hooks/useEForms';
import { downloadSubmissionPdf } from '../../api/eformsApi';
import StatusBadge from '../../components/eforms/StatusBadge';
import { formatDistanceToNow, format } from 'date-fns';

const TERMINAL_STATUSES = new Set(['APPROVED', 'REJECTED', 'WITHDRAWN', 'COMPLETED', 'SIGN_DECLINED']);

function safeFormat(d) {
  try { return d ? format(new Date(d), 'MMM d, yyyy') : '—'; } catch { return '—'; }
}
function safeRelative(d) {
  try { return d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—'; } catch { return '—'; }
}
function formatFieldValue(field, val) {
  if (val == null || val === '') return null;
  if (Array.isArray(val)) return val.join(', ');
  if (field.type === 'CHECKBOX') return val ? 'Yes' : 'No';
  if (field.type === 'DATE') { try { return new Date(val).toLocaleDateString() } catch { return val } }
  return String(val);
}

// ── Submission detail modal — read-only view of a filled form ─────────────────
function SubmissionDetailModal({ submissionId, onClose }) {
  const { data: sub, isLoading, error } = useSubmission(submissionId);
  const schema = sub?.formSchemaSnapshot;
  const data   = sub?.submissionData || {};
  const [downloading, setDownloading] = useState(false);
  const uploadSignedCopy = useUploadSignedCopy();
  const fileInputRef = useRef(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadSubmissionPdf(sub.id, `${sub.formKey}-${sub.id.slice(0, 8)}.pdf`);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadSignedCopy = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sub) return;
    uploadSignedCopy.mutate({ id: sub.id, file });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{sub?.formKey || 'Submission'}</h3>
            {sub && <StatusBadge status={sub.status} />}
          </div>
          <div className="flex items-center gap-1">
            {sub && (
              <button onClick={handleDownload} disabled={downloading}
                title="Download this form as a PDF"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-500 py-8 text-center">Failed to load submission.</p>
          )}

          {sub && (
            <>
              {/* DocuSign status */}
              {sub.docuSignEnvelopeId && (
                <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 space-y-1">
                  <p className="text-xs font-semibold text-purple-700">DocuSign Envelope</p>
                  <p className="text-[11px] font-mono text-purple-500">{sub.docuSignEnvelopeId}</p>
                  {sub.docuSignSentAt && <p className="text-[11px] text-purple-500">Sent: {safeFormat(sub.docuSignSentAt)}</p>}
                  {sub.docuSignCompletedAt && <p className="text-[11px] text-green-600">Signed: {safeFormat(sub.docuSignCompletedAt)}</p>}
                  {sub.signedDocumentId && (
                    <a href={`/api/documents/${sub.signedDocumentId}/download`} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 underline mt-1">
                      <FileText className="w-3 h-3" /> Download signed PDF
                    </a>
                  )}
                </div>
              )}

              {/* Manual signature upload — print/sign-by-hand/scan alternative to DocuSign */}
              {sub.requiresSignature && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800">Signature Required</p>
                  <p className="text-[11px] text-amber-700">
                    Signed outside DocuSign? Upload a scan of the signed copy here instead.
                  </p>
                  <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={handleUploadSignedCopy} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadSignedCopy.isPending}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-amber-800
                               bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50">
                    {uploadSignedCopy.isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Upload className="w-3.5 h-3.5" />}
                    Upload Signed Copy
                  </button>
                </div>
              )}

              {/* Field summary — per section, matching the fill flow's Review step */}
              {(schema?.sections || []).map((section) => {
                const fields = (section.fields || []).filter(
                  (f) => !['SECTION_HEADER', 'PARAGRAPH', 'DIVIDER', 'LABEL', 'SIGNATURE', 'INITIALS'].includes(f.type)
                );
                if (fields.length === 0) return null;
                return (
                  <div key={section.id} className="rounded-xl border border-gray-200 overflow-hidden">
                    {section.title && (
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{section.title}</p>
                      </div>
                    )}
                    <div className="divide-y divide-gray-100">
                      {fields.map((field) => (
                        <div key={field.id} className="flex items-start gap-4 px-4 py-2.5">
                          <span className="w-36 flex-shrink-0 text-xs font-medium text-gray-500 pt-0.5">{field.label}</span>
                          <span className="text-sm text-gray-800 break-words min-w-0">
                            {formatFieldValue(field, data[field.key]) ?? <span className="text-gray-400 italic">—</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {!schema && (
                <p className="text-xs text-gray-400 italic">No form layout available for this submission.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MySubmissionsPage() {
  const navigate = useNavigate();
  const { data: rawSubmissions, isLoading } = useMySubmissions();
  const withdrawMutation = useWithdrawSubmission();
  const [confirmWithdraw, setConfirmWithdraw] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  // Guard: hooks return T[] but add Array.isArray safety for any edge case
  const submissions = Array.isArray(rawSubmissions) ? rawSubmissions : [];

  const handleWithdraw = (id) => {
    withdrawMutation.mutate(id, { onSuccess: () => setConfirmWithdraw(null) });
  };

  const hasPendingSignature = submissions.some(s => s.status === 'PENDING_SIGNATURE');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Submissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your submitted and drafted forms</p>
        </div>
        <button
          onClick={() => navigate('/eforms')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium
                     rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <FileText className="w-4 h-4" /> Fill a Form
        </button>
      </div>

      {/* Signature-required banner — shown above the card when any submission is awaiting DocuSign */}
      {hasPendingSignature && (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <Mail className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Signature Required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              DocuSign has emailed you a signing request. Open it and click "Review Documents"
              to complete. This page refreshes automatically every 30 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-sm font-medium text-gray-600">No submissions yet</p>
            <p className="text-xs text-gray-400 mt-1">Forms you submit will appear here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Form</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Submitted</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden lg:table-cell">Last Updated</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map((sub) => {
                const isTerminal      = TERMINAL_STATUSES.has(sub.status);
                const isDraft         = sub.status === 'DRAFT';
                const isPendingSig    = sub.status === 'PENDING_SIGNATURE';
                return (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sub.formKey}</p>
                        <p className="text-xs font-mono text-gray-400">{sub.id?.slice(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                      {/* Per-row signing hint — only shown for PENDING_SIGNATURE rows */}
                      {isPendingSig && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span>Check your email to sign</span>
                        </div>
                      )}
                      {/* DocuSign envelope details */}
                      {sub.docuSignEnvelopeId && (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-[10px] font-mono text-gray-400">
                            Envelope: {sub.docuSignEnvelopeId.slice(0, 8)}...
                          </p>
                          {sub.docuSignSentAt && (
                            <p className="text-[10px] text-gray-400">Sent: {safeFormat(sub.docuSignSentAt)}</p>
                          )}
                          {sub.docuSignCompletedAt && (
                            <p className="text-[10px] text-green-600">Signed: {safeFormat(sub.docuSignCompletedAt)}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-500" title={safeFormat(sub.submittedAt)}>
                        {sub.submittedAt ? safeRelative(sub.submittedAt) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{safeRelative(sub.updatedAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Continue draft */}
                        {isDraft && (
                          <button
                            onClick={() => navigate(`/eforms/fill/${sub.formKey}?submission=${sub.id}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600
                                       border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Continue
                          </button>
                        )}

                        {/* View signed document */}
                        {sub.signedDocumentId && (
                          <a href={`/api/documents/${sub.signedDocumentId}/download`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                            title="Download signed PDF">
                            <FileText className="w-3.5 h-3.5" /> Signed
                          </a>
                        )}

                        {/* View */}
                        <button
                          onClick={() => setViewingId(sub.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View submission"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Withdraw — not available for terminal or draft statuses */}
                        {!isTerminal && !isDraft && (
                          <button
                            onClick={() => setConfirmWithdraw(sub.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Withdraw submission"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Withdraw confirmation modal */}
      {confirmWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Withdraw submission?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This action cannot be undone. The submission will be marked as withdrawn.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmWithdraw(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleWithdraw(confirmWithdraw)}
                disabled={withdrawMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission detail modal */}
      {viewingId && (
        <SubmissionDetailModal submissionId={viewingId} onClose={() => setViewingId(null)} />
      )}
    </div>
  );
}