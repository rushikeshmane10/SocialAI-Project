import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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

  function handleCopy() {
    try {
      navigator.clipboard.writeText(template.content || "");
      toast.success("Template copied to clipboard");
    } catch {
      toast("Failed to copy");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h4 className="truncate text-sm font-semibold text-foreground">{template.title}</h4>
            <div className="flex items-center gap-2">
              {template.type ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {template.type}
                </span>
              ) : null}
              <div className="text-xs text-muted-foreground">{new Date(template.updatedAt).toLocaleString()}</div>
            </div>
          </div>

          <p className={`mt-2 text-sm text-muted-foreground ${expanded ? "whitespace-pre-wrap" : "line-clamp-3"}`}>
            {template.content || "—"}
          </p>
        </div>

        <div className="ml-2 flex shrink-0 flex-col items-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(template)} title="Edit">
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} title="Copy">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((s) => !s)} title="Preview">
            <Eye className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete template?</AlertDialogTitle>
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </AlertDialogHeader>
              <div className="mt-4 flex justify-end gap-2">
                <AlertDialogCancel asChild>
                  <button className="h-9 rounded-md border border-input bg-background px-3 text-sm">Cancel</button>
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete(template.id);
                    toast.success("Template deleted");
                  }}
                >
                  Delete
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
