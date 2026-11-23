import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  processPropertyImage,
  PROPERTY_IMAGE,
  PROPERTY_WATERMARK_TEXT,
  propertyWatermarkLayout,
} from "../src/lib/images/property-image";
import { mediaVariantPath } from "../src/lib/images/media-variant";

const artifacts = resolve("outputs/property-image-verification");

type Sample = {
  name: string;
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp";
  orientation?: number;
};

const samples: Sample[] = [
  { name: "landscape-jpeg", width: 1800, height: 1000, format: "jpeg" },
  { name: "portrait-png", width: 700, height: 1400, format: "png" },
  { name: "square-webp", width: 900, height: 900, format: "webp" },
  { name: "small-jpeg", width: 240, height: 160, format: "jpeg" },
  { name: "exif-rotated-jpeg", width: 800, height: 1200, format: "jpeg", orientation: 6 },
];

async function sampleBuffer(sample: Sample) {
  let pipeline = sharp({
    create: {
      width: sample.width,
      height: sample.height,
      channels: 3,
      background: { r: 178, g: 192, b: 206 },
    },
  });
  if (sample.orientation) pipeline = pipeline.withMetadata({ orientation: sample.orientation });
  if (sample.format === "png") return pipeline.png().toBuffer();
  if (sample.format === "webp") return pipeline.webp({ quality: 90 }).toBuffer();
  return pipeline.jpeg({ quality: 90 }).toBuffer();
}

async function verifyWatermarkPixels(
  data: Buffer,
  width: number,
  height: number
) {
  const layout = propertyWatermarkLayout(width, height);
  assert.ok(layout.left >= 0 && layout.top >= 0);
  assert.ok(layout.left + layout.width < width);
  assert.ok(layout.top + layout.height < height);

  const watermarkRegion = await sharp(data)
    .extract({
      left: layout.left,
      top: layout.top,
      width: layout.width,
      height: layout.height,
    })
    .toBuffer();
  const safeBottomRegion = await sharp(data)
    .extract({
      left: layout.left,
      top: height - Math.max(2, Math.floor((height - layout.top - layout.height) / 2)),
      width: layout.width,
      height: 2,
    })
    .toBuffer();
  const watermarkStats = await sharp(watermarkRegion).stats();
  const safeBottomStats = await sharp(safeBottomRegion).stats();
  const watermarkMean =
    watermarkStats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3;
  const safeMean =
    safeBottomStats.channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / 3;

  assert.ok(watermarkMean < safeMean - 35, "dark watermark panel must be embedded in pixels");
  assert.ok(
    watermarkStats.channels.slice(0, 3).some((channel) => channel.max > 235),
    "white watermark text must be visible in the rendered pixels"
  );
  assert.ok(safeMean > 150, "safe bottom margin must remain outside the watermark");
}

test("property image processor creates independently watermarked 3:2 WebP variants",async()=>{
  await mkdir(artifacts,{recursive:true});
  assert.equal(PROPERTY_WATERMARK_TEXT,"www.ongoleproperty.com , call : 7788998459");

  for(const sample of samples){
    const result=await processPropertyImage(await sampleBuffer(sample));
    assert.deepEqual(
      {width:result.display.width,height:result.display.height,format:result.display.format},
      {width:PROPERTY_IMAGE.display.width,height:PROPERTY_IMAGE.display.height,format:"webp"}
    );
    assert.deepEqual(
      {width:result.thumbnail.width,height:result.thumbnail.height,format:result.thumbnail.format},
      {width:PROPERTY_IMAGE.thumbnail.width,height:PROPERTY_IMAGE.thumbnail.height,format:"webp"}
    );
    assert.equal((await sharp(result.display.data).metadata()).format,"webp");
    assert.equal((await sharp(result.thumbnail.data).metadata()).format,"webp");
    await verifyWatermarkPixels(result.display.data,result.display.width,result.display.height);
    await verifyWatermarkPixels(result.thumbnail.data,result.thumbnail.width,result.thumbnail.height);
    await Promise.all([
      writeFile(resolve(artifacts,`${sample.name}-display.webp`),result.display.data),
      writeFile(resolve(artifacts,`${sample.name}-thumbnail.webp`),result.thumbnail.data),
    ]);
  }
});

test("property image processor rejects undecodable and unsupported content",async()=>{
  await assert.rejects(()=>processPropertyImage(Buffer.from("not an image")),/could not be decoded/);
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="red"/></svg>');
  await assert.rejects(()=>processPropertyImage(svg),/unsupported/);
});

test("two property or PG photographs can be processed together without shared state",async()=>{
  const inputs=await Promise.all([
    sampleBuffer({name:"batch-landscape",width:1600,height:900,format:"jpeg"}),
    sampleBuffer({name:"batch-portrait",width:700,height:1200,format:"png"}),
  ]);
  const results=await Promise.all(inputs.map((input)=>processPropertyImage(input)));
  assert.equal(results.length,2);
  for(const result of results){
    assert.equal(result.display.width,1200);
    assert.equal(result.display.height,800);
    assert.equal(result.thumbnail.width,600);
    assert.equal(result.thumbnail.height,400);
  }
});

test("renderers select processed variants and preserve legacy storage-path fallback",()=>{
  const media={
    storage_path:"owner/property/image.webp",
    variants:{
      display:{path:"owner/property/image-display.webp"},
      thumbnail:{path:"owner/property/image-thumbnail.webp"},
    },
  };
  assert.equal(mediaVariantPath(media,"display"),"owner/property/image-display.webp");
  assert.equal(mediaVariantPath(media,"thumbnail"),"owner/property/image-thumbnail.webp");
  assert.equal(mediaVariantPath({storage_path:"legacy/image.webp"},"thumbnail"),"legacy/image.webp");
});
