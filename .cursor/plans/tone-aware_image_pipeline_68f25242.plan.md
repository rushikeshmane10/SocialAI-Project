---
name: Tone-Aware Image Pipeline
overview: Integrate Pollinations-based tone-aware image generation into the existing async text generation pipeline and propagate `image_base64` end-to-end from Python generation through Node persistence/publish and frontend variation rendering.
todos:
  - id: py-image-module
    content: Add Pollinations httpx image module and dependency in ai-service.
    status: completed
  - id: py-chain-wiring
    content: Switch visual prompt input to generated_text+tone and wire image_base64 into _generate_one/_run_generate_job.
    status: completed
  - id: node-validation-persist
    content: Update callback validation and preserve image_base64 in generated_text variations JSON.
    status: completed
  - id: node-migration-selection
    content: Add 008 migration and persist selected_image_base64 during selectVariation.
    status: completed
  - id: node-composio-linkedin
    content: Use selected_image_base64 in LinkedIn publish path with text-only fallback.
    status: completed
  - id: frontend-variation-image
    content: Add image_base64 typing and render image/placeholder in variation cards.
    status: completed
  - id: end-to-end-verify
    content: Run focused verification for callback, persistence, selection, publish, and UI rendering behaviors.
    status: completed
isProject: false
---

# Tone-Aware Image Pipeline Plan

## Scope and invariants
- Keep current async orchestration semantics unchanged: two tones run sequentially, and each tone executes text -> visual prompt -> image sequentially.
- Preserve existing Composio-only publishing integration and keep `executePost(userId, platform, text)` signature unchanged.
- Treat image generation as best-effort: failures produce `image_base64 = null` and never fail successful text generation.

## Architecture flow to implement
```mermaid
flowchart LR
  topicInput[TopicForm] --> generatorPage[GeneratorPage]
  generatorPage --> apiGenerate[POST /ai/generate]
  apiGenerate --> pyText[tweet_chain(topic,tone)]
  pyText --> pyVisual[visual_prompt_chain(generated_text,tone)]
  pyVisual --> pyImage[pollinations_httpx_get]
  pyImage --> pyCallback[Python callback variations image_base64]
  pyCallback --> nodeValidate[Node callback validation]
  nodeValidate --> nodePersist[persist generated_text JSON]
  nodePersist --> socketEmit[generation_lifecycle socket]
  socketEmit --> modalRender[VariationPickerModal image+text]
  modalRender --> selectVariation[POST /posts/:id/select-variation]
  selectVariation --> promoteImage[selected_image_base64 column]
  promoteImage --> executePost[executePost]
  executePost --> composioUpload[COMPOSIO_REMOTE_WORKBENCH]
  executePost --> textOnly[text_only_fallback]
```

## File-by-file implementation
- **Python dependency and image module**
  - Update [D:/Ai CodeBase/course/sociaAI/ai-service/requirements.txt](D:/Ai CodeBase/course/sociaAI/ai-service/requirements.txt) to ensure `httpx>=0.27.0` exists.
  - Add [D:/Ai CodeBase/course/sociaAI/ai-service/app/core/image_gen.py](D:/Ai CodeBase/course/sociaAI/ai-service/app/core/image_gen.py) with `generate_image_base64(prompt, tone)`:
    - tone-style suffix mapping exactly as specified
    - URL-encode final prompt
    - async GET `https://image.pollinations.ai/prompt/{encoded}` with required params
    - timeout(connect=10, read=60), redirects enabled
    - return base64 string on `200`, else `None`
    - warning logs with tone + short prompt preview; no raised exception

- **Python chain and schemas**
  - Update visual prompt LCEL chain in [D:/Ai CodeBase/course/sociaAI/ai-service/app/core/chains.py](D:/Ai CodeBase/course/sociaAI/ai-service/app/core/chains.py):
    - change prompt input from topic/post-context usage to `{generated_text, tone}`
    - keep structured output model `VisualPromptOutput` unchanged
  - Update variation output model in [D:/Ai CodeBase/course/sociaAI/ai-service/app/schemas/response_schema.py](D:/Ai CodeBase/course/sociaAI/ai-service/app/schemas/response_schema.py):
    - add `image_base64: Optional[str] = None` in the variation/pipeline response structure used by `_generate_one`

- **Python generation orchestration wiring**
  - Modify [D:/Ai CodeBase/course/sociaAI/ai-service/app/routes/generate.py](D:/Ai CodeBase/course/sociaAI/ai-service/app/routes/generate.py):
    - `_generate_one(...)` sequence:
      1) tweet chain -> generated text payload
      2) visual prompt chain with `{generated_text, tone}`
      3) `generate_image_base64(visual_prompt, tone)`
    - keep sequential awaits (no `gather`)
    - include `image_base64` in `_generate_one` return dict/model
    - ensure `_run_generate_job(...)` callback `result.variations[]` includes `image_base64` for both tone entries

- **Node callback validation and persistence**
  - Update callback schema in [D:/Ai CodeBase/course/sociaAI/backend/src/validations/ai.validations.js](D:/Ai CodeBase/course/sociaAI/backend/src/validations/ai.validations.js) using Zod equivalent of requested Joi rule:
    - variation field `image_base64: z.string().optional().nullable()`
    - keep optional/non-required semantics
  - Update [D:/Ai CodeBase/course/sociaAI/backend/src/services/posts.service.js](D:/Ai CodeBase/course/sociaAI/backend/src/services/posts.service.js):
    - `persistGeneratedFromCallback` must preserve `image_base64` in each variation inside `generated_text` JSON blob

- **Node migration and selected image promotion**
  - Add migration [D:/Ai CodeBase/course/sociaAI/backend/migrations/008_selected_image_base64.sql](D:/Ai CodeBase/course/sociaAI/backend/migrations/008_selected_image_base64.sql):
    - `ALTER TABLE posts ADD COLUMN IF NOT EXISTS selected_image_base64 TEXT;`
  - Ensure migration execution follows existing startup pattern (current migrator loads in lexical order, so new file is auto-applied).
  - Update `selectVariation` in [D:/Ai CodeBase/course/sociaAI/backend/src/services/posts.service.js](D:/Ai CodeBase/course/sociaAI/backend/src/services/posts.service.js):
    - parse `generated_text`
    - locate selected variation by `variation_id`
    - extract `image_base64`
    - write `selected_image_base64` alongside existing selected fields

- **Node publishing flow (LinkedIn only)**
  - Update [D:/Ai CodeBase/course/sociaAI/backend/src/services/composio.service.js](D:/Ai CodeBase/course/sociaAI/backend/src/services/composio.service.js):
    - remove static hardcoded test image dependency in LinkedIn publish path
    - use `post.selected_image_base64` as upload source when present
    - keep existing `COMPOSIO_REMOTE_WORKBENCH` upload + `##S3KEY##` extraction path unchanged
    - if `selected_image_base64` is null, skip upload and publish text-only via existing LinkedIn create-post action
    - do not modify Twitter flow and do not change `executePost` signature

- **Frontend typing + variation rendering**
  - Update variation type in [D:/Ai CodeBase/course/sociaAI/frontend/src/types/generate.ts](D:/Ai CodeBase/course/sociaAI/frontend/src/types/generate.ts) to include `image_base64?: string | null`.
  - Update variation card rendering in [D:/Ai CodeBase/course/sociaAI/frontend/src/components/VariationPickerModal.tsx](D:/Ai CodeBase/course/sociaAI/frontend/src/components/VariationPickerModal.tsx):
    - render image above text using `data:image/jpeg;base64,${variation.image_base64}` when present
    - render placeholder "Image unavailable" when null/empty
    - keep selection state, post id, and variation id behavior unchanged
  - If needed, normalize socket payload mapping in [D:/Ai CodeBase/course/sociaAI/frontend/src/pages/GeneratorPage.tsx](D:/Ai CodeBase/course/sociaAI/frontend/src/pages/GeneratorPage.tsx) so `image_base64` flows through to modal props.

## Validation and rollout checks
- Verify Python callback payload includes `image_base64` per variation even on image failure (`null`).
- Verify backend callback passes schema validation and persisted `generated_text` retains `image_base64` values.
- Verify selecting each variation stores `selected_image_base64` correctly.
- Verify LinkedIn publish path:
  - with image: performs upload and uses returned S3 key
  - without image: publishes text-only successfully
- Verify frontend cards render image when available and placeholder otherwise without crashes.

## Notes aligned to your constraints
- No direct LinkedIn API calls; Composio SDK remains the only publish mechanism.
- No local ML/image model dependencies; Pollinations HTTP only.
- No change to `executePost(userId, platform, text)` signature.
- No new DB column for per-variation image in callback persistence; only `selected_image_base64` is flattened at selection stage.