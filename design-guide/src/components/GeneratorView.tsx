import { PageHeader } from "@/components/PageHeader";
import { TopicForm } from "@/components/TopicForm";
import { LinkedInContextCard } from "@/components/LinkedInContextCard";
import { VariationPickerModal } from "@/components/VariationPickerModal";
import { SatisfactionPrompt } from "@/components/SatisfactionPrompt";
import { TweetPreview } from "@/components/TweetPreview";
import { SelectedPostDevicePreview } from "@/components/SelectedPostDevicePreview";
import { StatusBanner } from "@/components/StatusBanner";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { publishPost } from "@/api/client";
import { generateMockPosts, selectPostVariation } from "@/api/generate";
import { useGenerationSocket } from "@/hooks/useGenerationSocket";
import type { GenerationLifecycleEvent, PostVariation } from "@/types/generate";
import { DEFAULT_LLM_SELECTION, labelForLlmSelection, type LlmSelection } from "@/config/llmModels";
import { useLoading } from "@/components/LoadingOverlay";

type PostPhase = "idle" | "posting" | "done";

function previewImageSrc(imageBase64?: string | null): string | null {
  const base64Image = typeof imageBase64 === "string" ? imageBase64.trim() : "";
  if (base64Image.length === 0) return null;
  return base64Image.startsWith("data:image/")
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;
}

export function GeneratorView() {
  const { withLoader } = useLoading();
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<PostPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const [aiTopic, setAiTopic] = useState("");
  const [aiTones, setAiTones] = useState<string[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [variations, setVariations] = useState<PostVariation[]>([]);
  const [variationModalOpen, setVariationModalOpen] = useState(false);
  const [readyToPost, setReadyToPost] = useState(false);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const [pickOk, setPickOk] = useState<string | null>(null);
  const [surveyPostId, setSurveyPostId] = useState<string | null>(null);
  const [reworkBusy, setReworkBusy] = useState(false);
  const [pickBusy, setPickBusy] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [waitingForGeneration, setWaitingForGeneration] = useState(false);
  const [llmSelection, setLlmSelection] = useState<LlmSelection>(DEFAULT_LLM_SELECTION);
  /** Shown on the preview device after picking a variation (matches selected draft). */
  const [selectedToneLabel, setSelectedToneLabel] = useState<string | null>(null);
  /** Preview-only image for the selected variant (not persisted). */
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

  const loading = phase === "posting";

  const onSocketError = useCallback((message: string) => {
    setWaitingForGeneration(false);
    setPendingRequestId(null);
    setPickErr(message);
  }, []);

  const onGenerationEvent = useCallback((payload: GenerationLifecycleEvent) => {
    setWaitingForGeneration(false);
    setPendingRequestId(null);
    if (payload.status === "failed") {
      setPickErr(payload.error.message || "Generation failed");
      return;
    }
    const nextVariations = Array.isArray(payload.result?.variations)
      ? payload.result.variations
      : [];
    if (nextVariations.length < 2) {
      setPickErr("Generation completed but variations were missing.");
      return;
    }
    const sourcePostId = payload.result.postId ?? null;
    if (!sourcePostId) {
      setPickErr("Draft persistence is not ready yet. Please wait and try again.");
    }
    setVariations(
      nextVariations.slice(0, 2).map((v) => ({
        ...v,
        sourcePostId,
        sourceVariationId: v.variation_id,
      })),
    );
    setPostId(sourcePostId);
    setVariationModalOpen(true);
    setPickOk(
      sourcePostId
        ? "Two drafts generated. Pick one option to load into the composer."
        : "Two drafts generated. Waiting for persisted post id before selection is allowed.",
    );
  }, []);

  useGenerationSocket({
    requestId: pendingRequestId,
    onEvent: onGenerationEvent,
    onSocketError,
  });

  useEffect(() => {
    if (!waitingForGeneration || !pendingRequestId) return;
    const timer = setTimeout(() => {
      setWaitingForGeneration(false);
      setPendingRequestId(null);
      setPickErr("Generation timeout: no response from server after 5 minutes.");
    }, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [waitingForGeneration, pendingRequestId]);

  async function onGenerateAi() {
    setGenErr(null);
    setPickErr(null);
    setPickOk(null);
    setSurveyPostId(null);
    setReadyToPost(false);
    setSelectedToneLabel(null);
    setSelectedImageSrc(null);
    setGenBusy(true);
    try {
      const topic = aiTopic.trim();
      const tones = aiTones
        .slice(0, 2)
        .map((t) => t.trim())
        .filter(Boolean);
      if (tones.length !== 2) {
        throw new Error("Please select exactly 2 tones to generate two drafts.");
      }
      const res = await withLoader(() =>
        generateMockPosts({
          topic,
          tones: [tones[0], tones[1]] as [string, string],
          modelProvider: llmSelection.modelProvider,
          modelName: llmSelection.modelName,
        }),
      );
      setVariations([]);
      setPostId(null);
      setVariationModalOpen(false);
      setPickOk(`${res.message} Request id: ${res.requestId}`);
      setPendingRequestId(res.requestId);
      setWaitingForGeneration(true);
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenBusy(false);
    }
  }

  async function onReworkVariation(v: PostVariation, instructions: string) {
    setGenErr(null);
    setPickErr(null);
    setSelectedToneLabel(null);
    setSelectedImageSrc(null);
    setReworkBusy(true);
    try {
      const tones =
        aiTones.length >= 2
          ? [aiTones[0], aiTones[1]]
          : variations
              .slice(0, 2)
              .map((x) => x.tone_applied)
              .filter(Boolean);
      if (tones.length !== 2) {
        throw new Error("Please keep two tones selected before regenerating.");
      }
      const res = await withLoader(() =>
        generateMockPosts({
          topic: aiTopic.trim(),
          tones: [tones[0], tones[1]] as [string, string],
          reworkBaseText: v.text,
          reworkInstructions: instructions,
          sourcePostId: v.sourcePostId ?? postId ?? undefined,
          sourceVariationId: v.variation_id,
          modelProvider: llmSelection.modelProvider,
          modelName: llmSelection.modelName,
        }),
      );
      setVariations([]);
      setPostId(null);
      setVariationModalOpen(false);
      setPickOk(`${res.message} Request id: ${res.requestId}`);
      setPendingRequestId(res.requestId);
      setWaitingForGeneration(true);
    } catch (e) {
      setPickErr(e instanceof Error ? e.message : "Rework failed");
    } finally {
      setReworkBusy(false);
    }
  }

  async function onPickVariation(v: PostVariation) {
    setPickErr(null);
    setPickOk(null);
    setPickBusy(true);
    try {
      const sourceId = v.sourcePostId ?? postId ?? null;
      if (!sourceId) {
        throw new Error("Generated post id is missing. Regenerate and try again.");
      }
      await withLoader(() =>
        selectPostVariation(sourceId, {
          variation_id: v.variation_id,
          selected_text: v.text.trim(),
        }),
      );
      setDraft(v.text.trim());
      setSelectedToneLabel(v.tone_applied?.trim() || null);
      setSelectedImageSrc(previewImageSrc(v.image_base64));
      setReadyToPost(true);
      setVariationModalOpen(false);
      setSurveyPostId(sourceId);
      setPickOk(`Loaded ${v.tone_applied} option. Selection saved. You can now post.`);
      setVariations([]);
      setPostId(sourceId);
    } catch (e) {
      setReadyToPost(false);
      setPickErr(e instanceof Error ? e.message : "Could not save selected variation");
    } finally {
      setPickBusy(false);
    }
  }

  async function onPost() {
    setError(null);
    if (!readyToPost || !postId) {
      setError("Select an AI variation first before posting.");
      return;
    }
    setPhase("posting");
    try {
      await withLoader(() => publishPost(postId, "linkedin"));
      setPickOk("Posted to social media");
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Post failed");
    }
  }

  function onReset() {
    setDraft("");
    setError(null);
    setPhase("idle");
    setAiTopic("");
    setAiTones([]);
    setGenErr(null);
    setPickErr(null);
    setPickOk(null);
    setSurveyPostId(null);
    setVariations([]);
    setPostId(null);
    setVariationModalOpen(false);
    setReadyToPost(false);
    setPendingRequestId(null);
    setWaitingForGeneration(false);
    setSelectedToneLabel(null);
    setSelectedImageSrc(null);
  }

  return (
    <>
      <PageHeader title="Post to social media">
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-5">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-6 lg:col-span-3"
            >
              <StatusBanner type="error" message={error ?? ""} visible={Boolean(error)} />

              {genErr ? (
                <p
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {genErr}
                </p>
              ) : null}
              {pickOk ? (
                <p
                  className="rounded-lg border border-border bg-accent px-3 py-2 text-sm text-accent-foreground"
                  role="status"
                >
                  {pickOk}
                </p>
              ) : null}
              {pickErr && !variationModalOpen ? (
                <p
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {pickErr}
                </p>
              ) : null}

              {surveyPostId ? (
                <SatisfactionPrompt postId={surveyPostId} onDone={() => setSurveyPostId(null)} />
              ) : null}

              <LinkedInContextCard />

              <TopicForm
                topic={aiTopic}
                tones={aiTones}
                llmSelection={llmSelection}
                onLlmSelectionChange={setLlmSelection}
                disabled={genBusy || waitingForGeneration}
                isGenerating={genBusy || waitingForGeneration}
                onTopicChange={setAiTopic}
                onTonesChange={setAiTones}
                onGenerate={() => void onGenerateAi()}
              />

              {/* <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <label
                  className="mb-2 block text-sm font-semibold text-foreground"
                  htmlFor="tweet-draft"
                >
                  Your post
                </label>
                <textarea
                  id="tweet-draft"
                  value={draft}
                  disabled={loading}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write your post…"
                  rows={5}
                  aria-label="Post text"
                  className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground shadow-[var(--shadow-sm)] placeholder:text-muted-foreground/40 transition-all duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:opacity-50"
                />
              </motion.div> */}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="lg:col-span-2"
            >
              <div className="lg:sticky lg:top-8">
                {readyToPost && draft.trim() ? (
                  <SelectedPostDevicePreview
                    text={draft}
                    toneLabel={selectedToneLabel}
                    imageSrc={selectedImageSrc}
                    loading={loading}
                    onSubmit={() => void onPost()}
                  />
                ) : (
                  <TweetPreview
                    text={draft}
                    actions={
                      <button
                        type="button"
                        disabled={loading || !readyToPost || !postId}
                        title={!readyToPost || !postId ? "Pick a generated variant first" : undefined}
                        onClick={() => void onPost()}
                        className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-all duration-150 hover:shadow-[var(--shadow-elevated)] hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
                      >
                        {loading ? "···" : "Post to social media →"}
                      </button>
                    }
                  />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <VariationPickerModal
        open={variationModalOpen || waitingForGeneration}
        loading={waitingForGeneration}
        modelLabel={labelForLlmSelection(llmSelection)}
        variations={variations}
        canPersist={Boolean(postId)}
        busy={pickBusy}
        reworkBusy={reworkBusy}
        error={variationModalOpen && !waitingForGeneration ? pickErr : null}
        onClose={() => {
          setVariationModalOpen(false);
          if (waitingForGeneration) {
            setWaitingForGeneration(false);
            setPendingRequestId(null);
          }
        }}
        onSelect={(v) => void onPickVariation(v)}
        onRework={(v, instr) => void onReworkVariation(v, instr)}
      />
    </>
  );
}
