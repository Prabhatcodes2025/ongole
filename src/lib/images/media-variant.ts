type MediaWithVariants = {
  storage_path: string;
  variants?: unknown;
};

export function mediaVariantPath(
  media: MediaWithVariants,
  variant: "display" | "thumbnail"
) {
  if (
    media.variants &&
    typeof media.variants === "object" &&
    !Array.isArray(media.variants)
  ) {
    const candidate = (media.variants as Record<string, unknown>)[variant];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const path = (candidate as Record<string, unknown>).path;
      if (typeof path === "string" && path.length > 0) return path;
    }
  }
  return media.storage_path;
}
