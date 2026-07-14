import { createFileRoute } from "@tanstack/react-router";
import { GeneratorView } from "@/components/GeneratorView";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Post to X — Social AI" },
      { name: "description", content: "Generate and publish AI-powered social posts." },
    ],
  }),
  component: AuthenticatedHome,
});

function AuthenticatedHome() {
  return <GeneratorView />;
}
