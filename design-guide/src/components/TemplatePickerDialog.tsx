import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listTemplates } from "@/utils/templateStorage";
import type { TemplateModel } from "@/utils/templateStorage";
import { Search } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (template: TemplateModel) => void;
};

export function TemplatePickerDialog({ open, onOpenChange, onInsert }: Props) {
  const [templates, setTemplates] = useState<TemplateModel[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) {
      setTemplates(listTemplates());
    }
  }, [open]);

  const filtered = templates.filter((t) => {
    if (!q) return true;
    return `${t.title} ${t.content} ${t.type || ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Insert template</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search templates"
                className="h-9 rounded-lg border border-input bg-background px-10 text-sm text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
            {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates found.</p>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-foreground">{t.title}</h4>
                    {t.type ? <span className="text-xs text-muted-foreground">{t.type}</span> : null}
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{t.content}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onInsert(t);
                      onOpenChange(false);
                    }}
                  >
                    Select
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
