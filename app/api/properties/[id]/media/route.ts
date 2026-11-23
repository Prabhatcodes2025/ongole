
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { requestIp } from "@/src/lib/request";
import { canManagePropertyMedia } from "@/src/lib/properties/media-authorization";
import {
  processPropertyImage,
  PROPERTY_IMAGE,
  PropertyImageError,
} from "@/src/lib/images/property-image";

const ALLOWED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const FORMAT_BY_MIME = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function dashboardUrl(
  request: NextRequest,
  propertyId: string,
  result: string
) {
  if (request.nextUrl.searchParams.get("returnTo") === "admin") {
    return new URL(
      `/admin/properties/${propertyId}/edit?media=${result}`,
      request.url
    );
  }

  const pgId =
    request.nextUrl.searchParams.get("context") === "pg"
      ? request.nextUrl.searchParams.get("pgId")
      : null;

  if (pgId && /^[0-9a-f-]{36}$/i.test(pgId)) {
    return new URL(
      `/dashboard/pg/${pgId}?media=${result}`,
      request.url
    );
  }

  return new URL(
    `/dashboard/properties/${propertyId}?media=${result}`,
    request.url
  );
}

type MediaResult = "uploaded" | "invalid" | "limit" | "failed";

function mediaResponse(
  request: NextRequest,
  propertyId: string,
  result: MediaResult,
  status = 200
) {
  const destination = dashboardUrl(request, propertyId, result);
  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json(
      {
        propertyId,
        result,
        redirectTo: `${destination.pathname}${destination.search}`,
      },
      { status }
    );
  }
  return NextResponse.redirect(destination, 303);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const isPg = request.nextUrl.searchParams.get("context") === "pg";

  const rate = await checkRateLimit(
    `upload:${requestIp(request)}`,
    20,
    60 * 60_000
  );

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Upload limit reached. Try again later." },
      { status: 429 }
    );
  }

  if (!env.isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase storage is not configured." },
      { status: 503 }
    );
  }

  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json(
        {
          error: "Authentication required.",
          redirectTo: `/login?returnTo=${encodeURIComponent(`/dashboard/properties/${id}`)}`,
        },
        { status: 401 }
      );
    }
    return NextResponse.redirect(
      new URL(`/login?returnTo=/dashboard/properties/${id}`, request.url),
      303
    );
  }

  if (!auth.user.email_confirmed_at) {
    return NextResponse.json(
      {
        error:
          "Verify your email address before uploading property images.",
      },
      { status: 403 }
    );
  }

  const { data: ownedProperty } = await supabase
    .from("properties")
    .select("id,status,owner_id")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  let property = ownedProperty;

  let canManage = canManagePropertyMedia({
    isOwner: Boolean(ownedProperty),
    ownerEditable: Boolean(
      ownedProperty &&
        ["draft", "changes_requested"].includes(ownedProperty.status)
    ),
    hasPropertiesManage: false,
    hasPgManage: false,
    isPgListing: false,
    requestedPgContext: isPg,
  });

  // Do not let ownership short-circuit staff permissions. An administrator may
  // also own a listing and must still be evaluated under properties.manage.
  if (!property || !canManage) {
    const [
      { data: adminProperty },
      { data: propertiesManage },
      { data: pgManage },
      { data: pgListing },
    ] = await Promise.all([
      supabase
        .from("properties")
        .select("id,status,owner_id")
        .eq("id", id)
        .maybeSingle(),

      supabase.rpc("has_permission", {
        required_permission: "properties.manage",
      }),

      supabase.rpc("has_permission", {
        required_permission: "pg.manage",
      }),

      supabase
        .from("pg_listings")
        .select("id")
        .eq("property_id", id)
        .maybeSingle(),
    ]);

    canManage = canManagePropertyMedia({
      isOwner: false,
      ownerEditable: false,
      hasPropertiesManage: propertiesManage === true,
      hasPgManage: pgManage === true,
      isPgListing: Boolean(pgListing),
      requestedPgContext: isPg,
    });

    property =
      adminProperty ||
      (pgListing ? { id, status: "", owner_id: "" } : null);
  }

  if (!property || !canManage) {
    return NextResponse.json(
      { error: "This property cannot accept uploads." },
      { status: 403 }
    );
  }

  const form = await request.formData();

  const files = form
    .getAll("image")
    .filter(
      (item): item is File =>
        item instanceof File && item.size > 0
    );

  if (
    !files.length ||
    files.length > 6 ||
    files.some(
      (file) =>
        file.size > PROPERTY_IMAGE.maxSourceBytes ||
        !ALLOWED_INPUT_TYPES.has(file.type)
    )
  ) {
    return mediaResponse(request, id, "invalid", 400);
  }

  const { count } = await supabase
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", id)
    .eq("media_type", "image");

  const limit = 6;

  if ((count ?? 0) + files.length > limit) {
    return mediaResponse(request, id, "limit", 409);
  }

  const storedPaths: string[] = [];
  const storedIds: string[] = [];

  try {
    for (const [index, file] of files.entries()) {
      const source = Buffer.from(await file.arrayBuffer());
      const image = await processPropertyImage(source);
      if (image.source.format !== FORMAT_BY_MIME[file.type as keyof typeof FORMAT_BY_MIME]) {
        throw new PropertyImageError("Declared image type does not match decoded content.");
      }
      const processed = image.display.data;
      const thumbnail = image.thumbnail.data;

      const mediaId = crypto.randomUUID();

      const path =
        `${auth.user.id}/${id}/${mediaId}.webp`;

      const thumbnailPath =
        `${auth.user.id}/${id}/${mediaId}-thumb.webp`;

      // Upload display image.
      const { error: uploadError } = await supabase.storage
        .from("property-media")
        .upload(path, processed, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      storedPaths.push(path);

      // Upload thumbnail.
      const { error: thumbnailUploadError } = await supabase.storage
        .from("property-media")
        .upload(thumbnailPath, thumbnail, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });

      if (thumbnailUploadError) {
        throw thumbnailUploadError;
      }

      storedPaths.push(thumbnailPath);

      // Save image information.
      const { error: recordError } = await supabase
        .from("property_media")
        .insert({
          id: mediaId,
          property_id: id,
          storage_path: path,
          original_filename: file.name.slice(0, 255),
          mime_type: "image/webp",
          byte_size: processed.byteLength,
          width: image.display.width,
          height: image.display.height,
          processing_status: "ready",
          is_cover:
            !isPg && (count ?? 0) === 0 && index === 0,
          sort_order: (count ?? 0) + index,
          variants: {
            display: {
              path,
              width: image.display.width,
              height: image.display.height,
              format: "webp",
              byte_size: image.display.byteSize,
            },
            thumbnail: {
              path: thumbnailPath,
              width: image.thumbnail.width,
              height: image.thumbnail.height,
              format: "webp",
              byte_size: image.thumbnail.byteSize,
            },
          },
        });

      if (recordError) {
        throw recordError;
      }

      storedIds.push(mediaId);
    }

    await supabase.rpc("record_audit_event", {
      event_action: "media.upload",
      event_type: "property_media",
      event_reference: id,
      event_new: {
        media_ids: storedIds,
        count: storedIds.length,
        context: isPg ? "pg" : "property",
      },
    });

    return mediaResponse(request, id, "uploaded");
  } catch (error) {
    if (storedPaths.length) {
      await supabase.storage
        .from("property-media")
        .remove(storedPaths);
    }

    if (storedIds.length) {
      await supabase
        .from("property_media")
        .delete()
        .in("id", storedIds);
    }

    console.error("Property image processing failed", {
      propertyId: id,
      error,
    });

    return error instanceof PropertyImageError
      ? mediaResponse(request, id, "invalid", 400)
      : mediaResponse(request, id, "failed", 500);
  }
}
