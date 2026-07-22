import { useState } from "react";
import { Edit3, Trash2, Copy, Eye } from "lucide-react";
import type { TemplateModel } from "@/utils/templateStorage";
import { toast } from "sonner";

type Props = {
  template: TemplateModel;
  onEdit: (t: TemplateModel) => void;
  onDelete: (id: string) => void;
};

export function TemplateCard({ template, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleCopy() {
    try {
      navigator.clipboard.writeText(template.content || "");
      toast.success("Template copied to clipboard");
    } catch {
      toast("Failed to copy");
    }
  }

  function handleConfirmDelete() {
    onDelete(template.id);
    toast.success("Template deleted");
    setShowDeleteConfirm(false);
  }

  return (
  <article className="tmpl-card group relative overflow-hidden flex flex-col">
  {/* Header */}
  <header className="tmpl-card-header p-5">
    <div className="flex justify-between items-start gap-3">
      <div className="min-w-0 flex flex-col">
        <h3 className="truncate text-lg font-bold text-on-surface group-hover:text-primary transition-colors">
          {template.title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          {template.type ? (
            <span className="tmpl-badge">{template.type}</span>
          ) : null}
          <time className="text-[11px] font-medium text-on-surface-variant/70 uppercase tracking-wider">
            {new Date(template.updatedAt).toLocaleString()}
          </time>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onEdit(template)} title="Edit" className="tmpl-icon-btn">
          <Edit3 className="h-4 w-4" />
        </button>
        <button onClick={() => setShowDeleteConfirm(true)} title="Delete" className="tmpl-icon-btn-danger">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>

  {/* Body */}
  <div className="p-6 flex flex-col flex-grow">
    <p className={`text-sm leading-relaxed text-on-surface-variant italic ${expanded ? "whitespace-pre-wrap" : "line-clamp-4"}`}>
      {template.content || "—"}
    </p>

    <div className="mt-auto pt-4 flex items-center justify-end gap-2 border-t border-outline-variant/10">
      <button onClick={handleCopy} title="Copy" className="tmpl-icon-btn">
        <Copy className="h-4 w-4" />
      </button>
      <button onClick={() => setExpanded((s) => !s)} title="Preview" className="tmpl-icon-btn">
        <Eye className="h-4 w-4" />
      </button>
    </div>
  </div>

  {/* Delete confirm modal */}
  {showDeleteConfirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-background/40 backdrop-blur-sm p-4">
      <div className="tmpl-card w-full max-w-sm p-6 bg-white">
        <h3 className="text-base font-bold text-on-surface">Delete template?</h3>
        <p className="mt-1 text-sm text-on-surface-variant">This action cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="h-9 rounded-lg border border-outline-variant bg-surface px-4 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            className="h-9 rounded-lg bg-error px-4 text-sm font-semibold text-on-error hover:brightness-110 transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )}
</article>
  );
}