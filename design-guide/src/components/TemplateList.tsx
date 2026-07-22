import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "@/components/TemplateEditor";
import { TemplateCard } from "@/components/TemplateCard";
import { listTemplates, saveTemplate, deleteTemplate, createTemplate } from "@/utils/templateStorage";
import type { TemplateModel } from "@/utils/templateStorage";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";

const TYPE_OPTIONS = ["All", "Social Post", "Announcement", "Thread", "Article Intro", "Other"];

export function TemplateList() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateModel[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateModel | null>(null);
  const [filterType, setFilterType] = useState<string>("All");

  // --- Added: search + quick filter + pagination state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "recent" | "drafts" | "shared">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;

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

  function handleSave(payload: { id: string; title: string; content: string; type?: string | null }) {
    saveTemplate({ id: payload.id, title: payload.title, content: payload.content, type: payload.type });
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

  // --- Added: combined filtering (type dropdown + search + quick filter) ---
  const filtered = templates
    .filter((t) => filterType === "All" || (t.type || "") === filterType)
    .filter((t) =>
      searchQuery.trim() === ""
        ? true
        : t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((t) => {
      if (quickFilter === "drafts") return (t.type || "").toLowerCase() === "draft";
      return true; // "recent" and "shared" have no backing data source yet — visual only for now
    })
    .sort((a, b) => {
      if (quickFilter === "recent") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return 0;
    });

  // --- Added: pagination slice ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
      <div className="px-6 py-10">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">Template Library</h1>
              <p className="text-on-surface-variant text-sm mt-1">
                Manage and deploy your high-performance content frameworks.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    id="filter-select"
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="tmpl-select block w-48 px-4 py-2.5 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <ChevronDown className="h-4 w-4 text-outline" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleNew}
                className="tmpl-btn-primary flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold"
              >
                <Plus className="h-5 w-5" />
                New Template
              </button>
            </div>
          </div>

          {/* Search & Quick Filters — added */}
          <div className="mb-6 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <Search className="tmpl-search-icon h-4 w-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search templates..."
                className="tmpl-search-input w-full text-sm"
              />
            </div>

            <button
              onClick={() => {
                setQuickFilter(quickFilter === "recent" ? "all" : "recent");
                setCurrentPage(1);
              }}
              className={quickFilter === "recent" ? "tmpl-pill tmpl-pill-active" : "tmpl-pill"}
            >
              Recently Used
            </button>
            <button
              onClick={() => {
                setQuickFilter(quickFilter === "drafts" ? "all" : "drafts");
                setCurrentPage(1);
              }}
              className={quickFilter === "drafts" ? "tmpl-pill tmpl-pill-active" : "tmpl-pill"}
            >
              Drafts
            </button>
            <button
              onClick={() => {
                setQuickFilter(quickFilter === "shared" ? "all" : "shared");
                setCurrentPage(1);
              }}
              className={quickFilter === "shared" ? "tmpl-pill tmpl-pill-active" : "tmpl-pill"}
            >
              Shared with Me
            </button>
          </div>

          {/* Grid — TemplateCard untouched */}
          {loading ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="tmpl-skeleton h-64 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="tmpl-empty-card p-8 text-center">
              <p className="text-sm text-on-surface-variant">No templates yet. Create your first reference template.</p>
              <div className="mt-4">
                <button
                  onClick={handleNew}
                  className="tmpl-btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold"
                >
                  Create template
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((t) => (
                <TemplateCard key={t.id} template={t} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* Pagination — added */}
          {!loading && filtered.length > 0 && (
            <div className="mt-8 pt-6 border-t border-outline-variant/20 flex flex-col md:flex-row justify-between items-center gap-4">
              <span className="text-xs font-medium text-on-surface-variant">
                Showing {visible.length} of {filtered.length} templates
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="tmpl-page-btn"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={p === safePage ? "tmpl-page-btn tmpl-page-btn-active" : "tmpl-page-btn"}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="tmpl-page-btn"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TemplateEditor
        open={editorOpen}
        onOpenChange={(open) => setEditorOpen(open)}
        initial={editing || undefined}
        onSave={(payload) => handleSave(payload)}
      />
    </div>
  );
}
