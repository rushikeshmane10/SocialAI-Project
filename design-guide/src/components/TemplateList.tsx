import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "@/components/TemplateEditor";
import { TemplateCard } from "@/components/TemplateCard";
import { listTemplates, saveTemplate, deleteTemplate, createTemplate } from "@/utils/templateStorage";
import type { TemplateModel } from "@/utils/templateStorage";
import { toast } from "sonner";

export function TemplateList() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateModel[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateModel | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const all = listTemplates();
      setTemplates(all);
    } finally {
      setLoading(false);
    }
  }, []);

  function refresh() {
    setTemplates(listTemplates());
  }

  function handleNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function handleSave(payload: { id: string; title: string; content: string }) {
    saveTemplate({ id: payload.id, title: payload.title, content: payload.content });
    toast.success("Template saved");
    refresh();
  }

  function handleEdit(t: TemplateModel) {
    setEditing(t);
    setEditorOpen(true);
  }

  function handleDelete(id: string) {
    deleteTemplate(id);
    refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Template Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Save your favorite post structures or copy templates from LinkedIn, X, Medium, etc. Use them later as AI reference.</p>
        </div>
        <div>
          <Button onClick={handleNew}>New Template</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-lg border border-border bg-muted/20" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No templates yet. Create your first reference template.</p>
          <div className="mt-4">
            <Button onClick={handleNew}>Create template</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <TemplateEditor
        open={editorOpen}
        onOpenChange={(open) => setEditorOpen(open)}
        initial={editing || undefined}
        onSave={(payload) => handleSave(payload)}
      />
    </div>
  );
}
