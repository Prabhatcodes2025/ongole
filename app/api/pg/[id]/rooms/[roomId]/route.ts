
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { requestData } from "@/src/lib/request";
import { pgRoomSchema } from "@/src/lib/pg/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  const { id, roomId } = await params;

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
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const raw = await requestData(request);
  const action = raw.action;

  if (action !== "delete" && action !== "update") {
    return NextResponse.json(
      { error: "Invalid room action." },
      { status: 400 }
    );
  }

  const [{ data: pg }, { data: canManage }] = await Promise.all([
    supabase
      .from("pg_listings")
      .select("id,properties!inner(owner_id,status)")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("has_permission", {
      required_permission: "pg.manage",
    }),
  ]);

  const property = Array.isArray(pg?.properties)
    ? pg.properties[0]
    : pg?.properties;

  const status = property?.status;
  const ownerId = property?.owner_id;

  const isAdmin = canManage === true;
  const isOwner = ownerId === auth.user.id;

  if (
    !pg ||
    (!isOwner && !isAdmin) ||
    (!isAdmin && !["draft", "changes_requested"].includes(status || ""))
  ) {
    return NextResponse.json(
      { error: "This PG is locked." },
      { status: 403 }
    );
  }

  // Confirm the room belongs to this PG.
  const { data: existingRoom, error: roomLookupError } = await supabase
    .from("pg_room_types")
    .select("id,name,sharing_type,capacity,available_beds,monthly_rent,security_deposit")
    .eq("id", roomId)
    .eq("pg_listing_id", id)
    .maybeSingle();

  if (roomLookupError || !existingRoom) {
    return NextResponse.json(
      { error: "Room not found." },
      { status: 404 }
    );
  }

  const redirectPath = isAdmin
    ? `/admin/pg/${id}`
    : `/dashboard/pg/${id}`;

  if (action === "delete") {
    const { error } = await supabase
      .from("pg_room_types")
      .delete()
      .eq("id", roomId)
      .eq("pg_listing_id", id);

    if (error) {
      return NextResponse.json(
        { error: "The room could not be removed." },
        { status: 409 }
      );
    }

    await supabase.rpc("record_audit_event", {
      event_action: "pg.room_removed",
      event_type: "pg_listing",
      event_reference: id,
      event_old: {
        room_id: roomId,
        admin_override: isAdmin,
      },
    });

    return NextResponse.redirect(
      new URL(`${redirectPath}?notice=room-removed`, request.url),
      303
    );
  }

  // Validate room updates with the existing room schema.
  const parsed = pgRoomSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid room details.",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { error: updateError, data: updatedRoom } = await supabase
    .from("pg_room_types")
    .update(parsed.data)
    .eq("id", roomId)
    .eq("pg_listing_id", id)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedRoom) {
    return NextResponse.json(
      { error: "Room update failed. Check permissions and database rules." },
      { status: 409 }
    );
  }

  await supabase.rpc("record_audit_event", {
    event_action: "pg.room_updated",
    event_type: "pg_listing",
    event_reference: id,
    event_old: {
      room_id: roomId,
      previous_values: existingRoom,
      admin_override: isAdmin,
    },
  });

  return NextResponse.redirect(
    new URL(`${redirectPath}?notice=room-updated`, request.url),
    303
  );
}
