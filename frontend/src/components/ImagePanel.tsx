import type { ImageResult } from "../types/generate";

type Props = {
  imageUrl: string | null;
  imagePrompt: string | null;
  image: ImageResult | null;
  /** Shows a skeleton inside the frame while a new image is being prepared. */
  visualLoading?: boolean;
};

export function ImagePanel({ imageUrl, imagePrompt, image, visualLoading = false }: Props) {
  const failed = image?.status === "failed";
  const skipped = image?.status === "skipped";
  const showImg = image?.status === "ok" && imageUrl;

  return (
    <article className="card animate-in">
      <div className="card-label">Visual</div>
      <div className="image-frame" aria-busy={visualLoading || undefined}>
        {visualLoading ? (
          <div className="skeleton" />
        ) : showImg ? (
          <img src={imageUrl!} alt="Generated from your post" loading="lazy" />
        ) : (
          <span>Your generated image will land here.</span>
        )}
      </div>
      {failed && !visualLoading ? (
        <p className="image-failed" role="alert">
          {image?.message ?? "Image could not be generated."}
          {image?.code ? ` (${image.code})` : ""}
        </p>
      ) : null}
      {skipped && !visualLoading && image?.message ? (
        <p className="image-skipped">{image.message}</p>
      ) : null}
      {imagePrompt && !visualLoading ? (
        <details className="image-prompt-details">
          <summary>Image prompt (debug)</summary>
          <pre className="image-prompt-pre">{imagePrompt}</pre>
        </details>
      ) : null}
    </article>
  );
}
