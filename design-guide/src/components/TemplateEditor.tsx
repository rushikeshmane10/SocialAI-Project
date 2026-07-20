import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { TemplateModel } from "@/utils/templateStorage";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<TemplateModel> | null;
  onSave: (template: { id: string; title: string; content: string }) => void;
};

export function TemplateEditor({ open, onOpenChange, initial, onSave }: Props) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setContent(initial?.content || "");
    }
  }, [open, initial]);

  const charCount = content.length;

  function handleSave() {
    const id = initial?.id || Math.random().toString(36).slice(2, 9);
    onSave({ id, title: title.trim() || "Untitled template", content });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Template" : "New Template"}</DialogTitle>
          <DialogDescription>
            Create a reusable reference template for AI post generation.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-[var(--shadow-sm)]"
              placeholder="Template title"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)]"
              placeholder="Paste or write the template content here"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">{charCount} characters</div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-end gap-3 w-full">
            <DialogClose asChild>
              <button className="h-10 rounded-lg px-4 text-sm font-medium">Cancel</button>
            </DialogClose>
            <button onClick={handleSave} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Save
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
