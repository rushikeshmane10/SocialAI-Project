import { useMemo, useState } from "react";
import { generateMockPosts, selectPostVariation } from "../api/generate";
import { postJson } from "../api/client";
import { AppNavRail } from "../components/AppNavRail";
import { SatisfactionPrompt } from "../components/SatisfactionPrompt";
import { ThemeToggle } from "../components/ThemeToggle";
import { TopicForm } from "../components/TopicForm";
import { VariationPickerModal } from "../components/VariationPickerModal";
import { StatusBanner } from "../components/StatusBanner";
import { TweetPreview } from "../components/TweetPreview";
import { DUMMY_TWEET_TEXT } from "../config/dummyTweet";
import type { PostVariation } from "../types/generate";

type PostResponse = { tweetId: string; url: string };

type PostPhase = "idle" | "posting" | "done";

export function GeneratorPage() {
  const [draft, setDraft] = useState(DUMMY_TWEET_TEXT);
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
  const [pickBusy, setPickBusy] = useState(false);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const [pickOk, setPickOk] = useState<string | null>(null);
  const [surveyPostId, setSurveyPostId] = useState<string | null>(null);
  const [reworkBusy, setReworkBusy] = useState(false);

  const loading = phase === "posting";

  const canPost = useMemo(() => {
    if (!draft.trim()) return false;
    return [...draft].length <= 280;
  }, [draft]);

  function closeVariationModal() {
    setVariationModalOpen(false);
    setVariations([]);
    setPostId(null);
    setPickErr(null);
    setPickBusy(false);
  }

  async function onGenerateAi() {
    setGenErr(null);
    setPickOk(null);
    setPickErr(null);
    setSurveyPostId(null);
    setReadyToPost(false);
    setVariationModalOpen(false);
    setGenBusy(true);
    try {
      const topic = aiTopic.trim();
      const selectedTones = aiTones.slice(0, 2);
      const toneRequests = selectedTones.length > 0 ? selectedTones : [""];

      const settled = await Promise.allSettled(
        toneRequests.map((tone) => generateMockPosts({ topic, tone })),
      );
      const fulfilled = settled
        .map((item, idx) => ({ item, tone: toneRequests[idx] }))
        .filter((x): x is { item: PromiseFulfilledResult<Awaited<ReturnType<typeof generateMockPosts>>>; tone: string } =>
          x.item.status === "fulfilled",
        );

      if (fulfilled.length === 0) {
        const firstRejected = settled.find(
          (x): x is PromiseRejectedResult => x.status === "rejected",
        );
        throw (
          firstRejected?.reason ??
          new Error("Generate failed for all selected tones")
        );
      }

      const nextVariations: PostVariation[] =
        toneRequests.length === 1
          ? fulfilled[0].item.value.variations.map((v) => ({
              ...v,
              sourcePostId: fulfilled[0].item.value.postId,
              sourceVariationId: v.variation_id === 2 ? 2 : 1,
            }))
          : fulfilled.slice(0, 2).map(({ item, tone }, idx) => {
              const preferred = item.value.variations.find((v) => v.variation_id === 1) ?? item.value.variations[0];
              return {
                ...preferred,
                variation_id: idx + 1,
                tone_applied: tone,
                sourcePostId: item.value.postId,
                sourceVariationId: preferred.variation_id === 2 ? 2 : 1,
              };
            });

      setVariations(nextVariations);
      setPostId(toneRequests.length === 1 ? fulfilled[0].item.value.postId : null);
      if (nextVariations.length > 0) {
        setVariationModalOpen(true);
      }
      if (toneRequests.length > 1 && fulfilled.length < toneRequests.length) {
        setGenErr("Some tones failed to generate. Showing the drafts that succeeded.");
      } else if (!nextVariations.some((v) => Boolean(v.sourcePostId ?? null))) {
        setGenErr("Drafts are not saved without a database. You can still read the variations below.");
      }
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "Generate failed");
      setVariations([]);
      setPostId(null);
      setVariationModalOpen(false);
    } finally {
      setGenBusy(false);
    }
  }

  async function onReworkVariation(v: PostVariation, instructions: string) {
    setGenErr(null);
    setPickErr(null);
    setReworkBusy(true);
    const sourcePostId = postId ?? undefined;
    try {
      const res = await generateMockPosts({
        topic: aiTopic.trim(),
        tone: v.tone_applied?.trim() ?? "",
        reworkBaseText: v.text,
        reworkInstructions: instructions,
        sourcePostId: v.sourcePostId ?? sourcePostId,
        sourceVariationId: v.sourceVariationId ?? (v.variation_id === 2 ? 2 : 1),
      });
      setVariations(
        res.variations.map((next) => ({
          ...next,
          sourcePostId: res.postId,
          sourceVariationId: next.variation_id === 2 ? 2 : 1,
        })),
      );
      setPostId(res.postId);
      if (!res.postId) {
        setGenErr("Drafts are not saved without a database. You can still read the variations below.");
      }
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "Rework failed");
    } finally {
      setReworkBusy(false);
    }
  }

  async function onPickVariation(v: PostVariation) {
    const sourcePostId = v.sourcePostId ?? postId;
    const sourceVariationId = v.sourceVariationId ?? (v.variation_id === 2 ? 2 : 1);
    if (!sourcePostId) {
      setDraft(v.text.trim());
      setReadyToPost(true);
      setVariationModalOpen(false);
      setPickOk("Variation loaded. You can edit below, then post to X.");
      setAiTopic("");
      setAiTones([]);
      setVariations([]);
      return;
    }
    setPickErr(null);
    setPickOk(null);
    setSurveyPostId(null);
    setPickBusy(true);
    try {
      const res = await selectPostVariation(sourcePostId, {
        variation_id: sourceVariationId,
        selected_text: v.text,
      });
      setDraft(v.text.trim());
      setReadyToPost(true);
      setVariationModalOpen(false);
      setSurveyPostId(res.postId);
      setPickOk("Variation saved. You can edit below, then post to X.");
      setAiTopic("");
      setAiTones([]);
      setVariations([]);
      setPostId(null);
    } catch (e) {
      setPickErr(e instanceof Error ? e.message : "Could not save pick");
    } finally {
      setPickBusy(false);
    }
  }

  async function onPost() {
    setError(null);
    setSuccessUrl(null);
    setPhase("posting");
    try {
      const res = await postJson<PostResponse>("/post/tweet", { text: draft.trim() });
      setSuccessUrl(res.url);
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Post failed");
    }
  }

  function onReset() {
    setDraft(DUMMY_TWEET_TEXT);
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
  }

  return (
    <div className="app-shell">
      <AppNavRail />

      <div className="main">
        <header className="page-header">
          <h1 className="page-title">Post to X</h1>
          <div className="row end">
            <ThemeToggle />
            <button type="button" className="btn muted" disabled={loading} onClick={onReset}>
              Reset
            </button>
          </div>
        </header>

        <p className="compose-lead">
          Generate two mock drafts (one per selected tone) — a dialog opens so you can compare variants with a preview image, pick one, then
          edit and post. Post to X stays locked until you confirm a variant.
        </p>

        <div className="compose-box">
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
          {surveyPostId ? (
            <SatisfactionPrompt
              postId={surveyPostId}
              onDone={() => setSurveyPostId(null)}
            />
          ) : null}
          {pickErr && !variationModalOpen ? (
            <p className="banner error banner--spaced" role="alert">
              {pickErr}
            </p>
          ) : null}

          <TopicForm
            topic={aiTopic}
            tones={aiTones}
            disabled={genBusy || pickBusy}
            isGenerating={genBusy}
            onTopicChange={setAiTopic}
            onTonesChange={setAiTones}
            onGenerate={() => void onGenerateAi()}
          />
        </div>

        <VariationPickerModal
          open={variationModalOpen}
          variations={variations}
          canPersist={variations.some((v) => Boolean(v.sourcePostId ?? postId))}
          busy={pickBusy}
          reworkBusy={reworkBusy}
          error={variationModalOpen ? pickErr : null}
          onClose={closeVariationModal}
          onSelect={(v) => void onPickVariation(v)}
          onRework={(v, instr) => void onReworkVariation(v, instr)}
        />

        <hr className="divider" />

        <div className="compose-box">
          <label className="label" htmlFor="tweet-draft">
            Tweet text
          </label>
          {!readyToPost ? (
            <p className="form-hint">
              Post to X is locked until you pick a variant in the dialog after generate.
            </p>
          ) : null}
          <textarea
            id="tweet-draft"
            className="input-ghost"
            rows={5}
            value={draft}
            disabled={loading}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Tweet text"
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
                disabled={!readyToPost || !canPost || loading}
                title={!readyToPost ? "Pick a variant first" : undefined}
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
