import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { TemplateList } from "@/components/TemplateList";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/template-library")({
  head: () => ({
    meta: [
      { title: "Template Library — Social AI" },
      { name: "description", content: "Manage reusable post reference templates for AI generation." },
    ],
  }),
  component: TemplateLibraryPage,
});

function TemplateLibraryPage() {
  return (
    <>
      <PageHeader title="Template Library" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 lg:px-12">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <TemplateList />
          </motion.div>
        </div>
      </div>
    </>
  );
}
