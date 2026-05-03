import { useCallback, useState } from "react";
import { publishPost } from "../api/client";
import { generateMockPosts, selectPostVariation } from "../api/generate";
import { AppNavRail } from "../components/AppNavRail";
import { SatisfactionPrompt } from "../components/SatisfactionPrompt";
import { ThemeToggle } from "../components/ThemeToggle";
import { TopicForm } from "../components/TopicForm";
import { VariationPickerModal } from "../components/VariationPickerModal";
import { StatusBanner } from "../components/StatusBanner";
import { TweetPreview } from "../components/TweetPreview";
import { useGenerationSocket } from "../hooks/useGenerationSocket";
import type { GenerationLifecycleEvent, PostVariation } from "../types/generate";
import { DEFAULT_LLM_SELECTION, labelForLlmSelection, type LlmSelection } from "../config/llmModels";

type PostPhase = "idle" | "posting" | "done";

export function GeneratorPage() {
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<PostPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

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
    const nextVariations = Array.isArray(payload.result?.variations) ? payload.result.variations : [];
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

  async function onGenerateAi() {
    setGenErr(null);
    setPickErr(null);
    setPickOk(null);
    setSurveyPostId(null);
    setReadyToPost(false);
    setGenBusy(true);
    try {
      const topic = aiTopic.trim();
      const tones = aiTones.slice(0, 2).map((t) => t.trim()).filter(Boolean);
      if (tones.length !== 2) {
        throw new Error("Please select exactly 2 tones to generate two drafts.");
      }
      const res = await generateMockPosts({
        topic,
        tones: [tones[0], tones[1]],
        modelProvider: llmSelection.modelProvider,
        modelName: llmSelection.modelName,
      });
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
      const res = await generateMockPosts({
        topic: aiTopic.trim(),
        tones: [tones[0], tones[1]],
        reworkBaseText: v.text,
        reworkInstructions: instructions,
        sourcePostId: v.sourcePostId ?? postId ?? undefined,
        sourceVariationId: v.variation_id,
        modelProvider: llmSelection.modelProvider,
        modelName: llmSelection.modelName,
      });
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
      await selectPostVariation(sourceId, {
        variation_id: v.variation_id,
        selected_text: v.text.trim(),
      });
      setDraft(v.text.trim());
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
    setSuccessUrl(null);
    if (!readyToPost || !postId) {
      setError("Select an AI variation first before posting.");
      return;
    }
    setPhase("posting");
    try {
      await publishPost(postId, "linkedin");
      setPickOk("Posted to LinkedIn");
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Post failed");
    }
  }

  function onReset() {
    setDraft("");
    setError(null);
    setSuccessUrl(null);
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
  }

  return (
    <div className="app-shell">
      <AppNavRail />

      <div className="main generator-page">
        <header className="page-header">
          <h1 className="page-title">Post to X</h1>
          <div className="row end">
            <ThemeToggle />
            <button type="button" className="btn muted" disabled={loading} onClick={onReset}>
              Reset
            </button>
          </div>
        </header>

        <div className="compose-box compose-box--first">
          {genErr ? (
            <p className="banner error banner--spaced" role="alert">
              {genErr}
            </p>
          ) : null}
          {pickOk ? (
            <p className="banner banner--spaced" role="status">
              {pickOk}
            </p>
          ) : null}
          {pickErr && !variationModalOpen ? (
            <p className="banner error banner--spaced" role="alert">
              {pickErr}
            </p>
          ) : null}
          {surveyPostId ? (
            <SatisfactionPrompt
              postId={surveyPostId}
              onDone={() => setSurveyPostId(null)}
            />
          ) : null}
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

        <hr className="divider" />

        <div className="compose-box compose-box--draft">
          <textarea
            id="tweet-draft"
            className="input-ghost"
            rows={5}
            value={draft}
            disabled={loading}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your post…"
            aria-label="Post text"
          />
        </div>

        <hr className="divider" />

        <div className="feed">
          <TweetPreview
            draft={draft}
            actions={
              <button
                type="button"
                className="btn primary"
                disabled={loading || !readyToPost || !postId}
                title={!readyToPost || !postId ? "Pick a generated variant first" : undefined}
                onClick={onPost}
              >
                {loading ? "···" : "Post to X →"}
              </button>
            }
          />

          <StatusBanner
            loading={loading}
            phase={phase === "posting" ? "posting" : "idle"}
            error={error}
            successUrl={successUrl}
          />
        </div>
      </div>
    </div>
  );
}
