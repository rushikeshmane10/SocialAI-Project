export type TemplateModel = {
  id: string;
  title: string;
  content: string;
  type?: string | null;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "templateLibrary";

function nowIso() {
  return new Date().toISOString();
}

export function listTemplates(): TemplateModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TemplateModel[];
    // sort by updatedAt desc
    return parsed.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function saveTemplate(template: Omit<TemplateModel, "createdAt" | "updatedAt"> & Partial<Pick<TemplateModel, "createdAt" | "updatedAt">>) {
  const all = listTemplates();
  const now = nowIso();
  const existingIndex = all.findIndex((t) => t.id === template.id);
  const model: TemplateModel = {
    id: template.id,
    title: template.title,
    content: template.content,
    type: (template as any).type || null,
    createdAt: template.createdAt || now,
    updatedAt: template.updatedAt || now,
  };

  if (existingIndex >= 0) {
    all[existingIndex] = { ...all[existingIndex], ...model, updatedAt: now };
  } else {
    all.unshift(model);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return model;
}

export function deleteTemplate(id: string) {
  const all = listTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getTemplate(id: string) {
  return listTemplates().find((t) => t.id === id) || null;
}

export function createTemplate(attrs?: Partial<TemplateModel>) {
  const id = attrs?.id || Math.random().toString(36).slice(2, 9);
  const now = nowIso();
  const tmpl: TemplateModel = {
    id,
    title: attrs?.title || "Untitled template",
    content: attrs?.content || "",
    createdAt: attrs?.createdAt || now,
    updatedAt: attrs?.updatedAt || now,
  };
  saveTemplate(tmpl);
  return tmpl;
}
