import sharp from "sharp";

export const PROPERTY_IMAGE = {
  display: { width: 1200, height: 800, quality: 85 },
  thumbnail: { width: 600, height: 400, quality: 80 },
  maxSourceBytes: 15 * 1024 * 1024,
  maxInputPixels: 40_000_000,
} as const;

export const PROPERTY_WATERMARK_TEXT =
  "www.ongoleproperty.com , call : 7788998459";

const SUPPORTED_DECODED_FORMATS = new Set(["jpeg", "png", "webp"]);

export class PropertyImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyImageError";
  }
}

export type ProcessedPropertyImageVariant = {
  data: Buffer;
  width: number;
  height: number;
  format: "webp";
  byteSize: number;
};

export type ProcessedPropertyImage = {
  display: ProcessedPropertyImageVariant;
  thumbnail: ProcessedPropertyImageVariant;
  source: {
    format: "jpeg" | "png" | "webp";
    width: number;
    height: number;
  };
};

type VariantConfig = {
  width: number;
  height: number;
  quality: number;
};

export function propertyWatermarkLayout(width: number, height: number) {
  const margin = Math.max(10, Math.round(width * 0.02));
  const availableWidth = width - margin * 2;
  const boxWidth = Math.min(availableWidth, Math.round(width * 0.68));
  const boxHeight = Math.min(
    height - margin * 2,
    Math.max(36, Math.round(height * 0.08))
  );
  const horizontalPadding = Math.max(12, Math.round(boxWidth * 0.035));
  const estimatedCharacterWidth = 0.58;
  const fontSize = Math.max(
    11,
    Math.min(
      Math.floor(height * 0.035),
      Math.floor(
        (boxWidth - horizontalPadding * 2) /
          (PROPERTY_WATERMARK_TEXT.length * estimatedCharacterWidth)
      )
    )
  );

  return {
    left: margin,
    top: height - margin - boxHeight,
    width: boxWidth,
    height: boxHeight,
    fontSize,
  };
}

function watermarkSvg(width: number, height: number) {
  const layout = propertyWatermarkLayout(width, height);
  const svg = `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" rx="8" fill="#111827" fill-opacity="0.68"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="${layout.fontSize}" font-weight="700" fill="#ffffff">${PROPERTY_WATERMARK_TEXT}</text>
  </svg>`;
  return { input: Buffer.from(svg), ...layout };
}

async function renderVariant(source: Buffer, config: VariantConfig) {
  const watermark = watermarkSvg(config.width, config.height);
  const data = await sharp(source, {
    failOn: "warning",
    limitInputPixels: PROPERTY_IMAGE.maxInputPixels,
  })
    .rotate()
    .resize({
      width: config.width,
      height: config.height,
      fit: "cover",
      position: "attention",
      withoutEnlargement: false,
    })
    .composite([
      {
        input: watermark.input,
        left: watermark.left,
        top: watermark.top,
      },
    ])
    .webp({ quality: config.quality, effort: 5 })
    .toBuffer();

  const metadata = await sharp(data).metadata();
  if (
    metadata.format !== "webp" ||
    metadata.width !== config.width ||
    metadata.height !== config.height
  ) {
    throw new PropertyImageError("Processed image dimensions are invalid.");
  }

  return {
    data,
    width: metadata.width,
    height: metadata.height,
    format: "webp" as const,
    byteSize: data.byteLength,
  };
}

export async function processPropertyImage(
  source: Buffer
): Promise<ProcessedPropertyImage> {
  if (!source.byteLength || source.byteLength > PROPERTY_IMAGE.maxSourceBytes) {
    throw new PropertyImageError("Image size is invalid.");
  }

  let metadata;
  try {
    metadata = await sharp(source, {
      failOn: "warning",
      limitInputPixels: PROPERTY_IMAGE.maxInputPixels,
    }).metadata();
  } catch {
    throw new PropertyImageError("Image content could not be decoded.");
  }

  if (
    !metadata.format ||
    !SUPPORTED_DECODED_FORMATS.has(metadata.format) ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) !== 1
  ) {
    throw new PropertyImageError("Image content or dimensions are unsupported.");
  }

  const [display, thumbnail] = await Promise.all([
    renderVariant(source, PROPERTY_IMAGE.display),
    renderVariant(source, PROPERTY_IMAGE.thumbnail),
  ]);

  return {
    display,
    thumbnail,
    source: {
      format: metadata.format as "jpeg" | "png" | "webp",
      width: metadata.width,
      height: metadata.height,
    },
  };
}
