
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PgForm } from "@/src/components/pg-posting-workflow";
import { AdminNavigation } from "@/src/components/admin-navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { nearbyPlacesDefaults } from "@/src/lib/properties/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit PG Listing | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPgEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect(`/login?returnTo=/admin/pg/${id}/edit`);
  }

  const { data: canManage } = await supabase.rpc("has_permission", {
    required_permission: "pg.manage",
  });

  if (canManage !== true) {
    redirect("/dashboard");
  }

  const { data: pg, error } = await supabase
    .from("pg_listings")
    .select(`
      *,
      properties!inner(
        id,
        reference_no,
        title,
        description,
        status,
        locality_text,
        city_text,
        district_text,
        state_text,
        latitude,
        longitude,
        deleted_at
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !pg) notFound();

  const property = Array.isArray(pg.properties)
    ? pg.properties[0]
    : pg.properties;

  if (!property || property.deleted_at) notFound();

  const { data: rooms, error: roomsError } = await supabase
    .from("pg_room_types")
    .select("*")
    .eq("pg_listing_id", id)
    .order("sort_order");

  const details =
    pg.details &&
    typeof pg.details === "object" &&
    !Array.isArray(pg.details)
      ? (pg.details as Record<string, unknown>)
      : {};

  const defaults: Record<string, unknown> = {
    ...pg,
    ...nearbyPlacesDefaults(details.nearby_places),
    id,
    description: property.description,
    locality: property.locality_text,
    city: property.city_text,
    district: property.district_text,
    state: property.state_text,
    latitude: property.latitude,
    longitude: property.longitude,
    landmark: details.landmark,
    facing: details.facing,
    rent_basis: details.rent_basis,
    google_maps_url: details.google_maps_url,
    lunch_box_available: details.lunch_box_available,
  };

  const roomNotice =
    query.notice === "room-updated"
      ? "Room details updated."
      : query.notice === "room-added"
        ? "Room added."
        : query.notice === "room-removed"
          ? "Room removed."
          : null;

  return (
    <main className="portal-page admin-portal">
      <div className="shell">
        <AdminNavigation />

        <nav className="breadcrumbs">
          <Link href="/admin/pg">PG listings</Link>
          <span>›</span>
          <Link href={`/admin/pg/${id}`}>Review PG</Link>
          <span>›</span>
          <span>Edit</span>
        </nav>

        <div className="portal-title">
          <div>
            <p className="eyebrow">{property.reference_no}</p>
            <h1>Edit PG Details</h1>
            <p>
              {pg.pg_name} ·{" "}
              <span className={`status status-${property.status}`}>
                {property.status.replaceAll("_", " ")}
              </span>
            </p>
          </div>

          <Link
            className="button button-light"
            href={`/admin/pg/${id}`}
          >
            Back to Review
          </Link>
        </div>

        <section className="portal-section">
          <h2>PG Information</h2>
          <p className="form-note">
            Administrative corrections do not change the listing
            owner or approval status.
          </p>

          <PgForm defaults={defaults} adminMode />
        </section>

        <section className="portal-section">
          <div className="section-heading-row">
            <h2>Room Management</h2>
            <span>{rooms?.length ?? 0} rooms</span>
          </div>

          {roomNotice && (
            <p className="form-message success">{roomNotice}</p>
          )}

          {roomsError ? (
            <p className="form-message error">
              Room details could not be loaded.
            </p>
          ) : rooms?.length ? (
            <div className="admin-table">
              <div className="admin-row admin-head">
                <span>Room</span>
                <span>Sharing</span>
                <span>Beds</span>
                <span>Rent</span>
                <span>Deposit</span>
              </div>

              {rooms.map((room) => (
                <div key={room.id}>
                  <div className="admin-row">
                    <span>
                      <strong>{room.name}</strong>
                    </span>
                    <span>
                      {room.sharing_type.replaceAll("_", " ")}
                    </span>
                    <span>
                      {room.available_beds}/{room.capacity}
                    </span>
                    <span>
                      ₹{Number(room.monthly_rent).toLocaleString("en-IN")}
                    </span>
                    <span>
                      ₹{Number(room.security_deposit ?? 0).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <details
                    style={{
                      padding: "16px",
                      margin: "12px 0 20px",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Edit Room — {room.name}
                    </summary>

                    <form
                      className="submission-form compact-form room-form"
                      action={`/api/pg/${id}/rooms/${room.id}`}
                      method="post"
                      style={{ marginTop: 16 }}
                    >
                      <input
                        type="hidden"
                        name="action"
                        value="update"
                      />

                      <label>
                        Room name
                        <input
                          required
                          name="name"
                          defaultValue={room.name}
                        />
                      </label>

                      <label>
                        Sharing type
                        <select
                          name="sharing_type"
                          defaultValue={room.sharing_type}
                        >
                          <option value="single">Single</option>
                          <option value="double">Double</option>
                          <option value="triple">Triple</option>
                          <option value="four_sharing">Four sharing</option>
                        </select>
                      </label>

                      <label>
                        Capacity
                        <input
                          required
                          name="capacity"
                          type="number"
                          min="1"
                          max="1000"
                          defaultValue={room.capacity}
                        />
                      </label>

                      <label>
                        Available beds
                        <input
                          required
                          name="available_beds"
                          type="number"
                          min="0"
                          max="1000"
                          defaultValue={room.available_beds}
                        />
                      </label>

                      <label>
                        Monthly rent (₹)
                        <input
                          required
                          name="monthly_rent"
                          type="number"
                          min="100"
                          step="1"
                          defaultValue={room.monthly_rent}
                        />
                      </label>

                      <label>
                        Security deposit (₹)
                        <input
                          required
                          name="security_deposit"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={room.security_deposit ?? 0}
                        />
                      </label>

                      <button
                        className="button secondary"
                        type="submit"
                      >
                        Save Room Changes
                      </button>
                    </form>
                  </details>

                  <form
                    action={`/api/pg/${id}/rooms/${room.id}`}
                    method="post"
                  >
                    <button
                      className="danger-link"
                      type="submit"
                      name="action"
                      value="delete"
                    >
                      Remove Room
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <p>No room types added.</p>
            </div>
          )}

          {!roomsError && (
            <>
              <h3>Add New Room</h3>

              <form
                className="submission-form compact-form room-form"
                action={`/api/pg/${id}/rooms`}
                method="post"
              >
                <label>
                  Room name
                  <input
                    required
                    name="name"
                    placeholder="Standard room"
                  />
                </label>

                <label>
                  Sharing type
                  <select name="sharing_type">
                    <option value="single">Single</option>
                    <option value="double">Double</option>
                    <option value="triple">Triple</option>
                    <option value="four_sharing">Four sharing</option>
                  </select>
                </label>

                <label>
                  Capacity
                  <input
                    required
                    name="capacity"
                    type="number"
                    min="1"
                    max="1000"
                  />
                </label>

                <label>
                  Available beds
                  <input
                    required
                    name="available_beds"
                    type="number"
                    min="0"
                    max="1000"
                  />
                </label>

                <label>
                  Monthly rent (₹)
                  <input
                    required
                    name="monthly_rent"
                    type="number"
                    min="100"
                    step="1"
                  />
                </label>

                <label>
                  Security deposit (₹)
                  <input
                    required
                    name="security_deposit"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                  />
                </label>

                <button className="button secondary" type="submit">
                  Add Room
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
