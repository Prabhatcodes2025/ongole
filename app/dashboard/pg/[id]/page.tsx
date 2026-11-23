
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { PgForm } from "@/src/components/pg-posting-workflow";
import { nearbyPlacesDefaults } from "@/src/lib/properties/validation";
import { mediaVariantPath } from "@/src/lib/images/media-variant";
import { PropertyMediaManager } from "@/src/components/property-media-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage PG listing",
  robots: { index: false, follow: false },
};

const notices: Record<string, string> = {
  created: "PG draft created.",
  updated: "PG details saved.",
  duplicated: "PG draft duplicated.",
  "duplicate-failed": "The PG could not be duplicated. Your original listing was not changed.",
  submitted: "PG submitted for review.",
  "consent-required": "Save the PG information and confirm the mandatory authorization and communication consent before submitting.",
  "room-added": "Room type added.",
  "room-removed": "Room type removed.",
  "room-updated": "Room details updated.",
  uploaded: "Image uploaded.",
  remove: "Image removed.",
  cover: "Cover image updated.",
  up: "Image moved earlier.",
  down: "Image moved later.",
  failed: "The image could not be updated. Please try again.",
  locked: "These images are locked while the listing is under review or published.",
};

export default async function ManagePgPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; media?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect(`/login?returnTo=/dashboard/pg/${id}`);
  }

  const [{ data: pg }, { data: canManage }] = await Promise.all([
    supabase
      .from("pg_listings")
      .select(
        "*,properties!inner(id,owner_id,reference_no,title,description,status,locality_text,city_text,district_text,state_text,latitude,longitude,slug,updated_at,deleted_at,property_media(id,storage_path,variants,original_filename,is_cover,sort_order))"
      )
      .eq("id", id)
      .is("properties.deleted_at", null)
      .maybeSingle(),
    supabase.rpc("has_permission", {
      required_permission: "pg.manage",
    }),
  ]);

  if (!pg) notFound();

  const property = Array.isArray(pg.properties)
    ? pg.properties[0]
    : pg.properties;

  if (!property) notFound();

  const isAdmin =
    canManage === true && property.owner_id !== auth.user.id;

  if (property.owner_id !== auth.user.id && !isAdmin) {
    notFound();
  }

  const [{ data: rooms }, { data: history }] = await Promise.all([
    supabase
      .from("pg_room_types")
      .select("*")
      .eq("pg_listing_id", id)
      .order("sort_order"),
    supabase
      .from("property_status_history")
      .select("id,to_status,reason,created_at")
      .eq("property_id", pg.property_id)
      .order("created_at", { ascending: false }),
  ]);

  const media = [...(property.property_media || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const { data: signed } = media.length
    ? await supabase.storage
        .from("property-media")
        .createSignedUrls(
          media.map((item) => mediaVariantPath(item, "thumbnail")),
          3600
        )
    : { data: [] };

  const editable =
    isAdmin ||
    ["draft", "changes_requested"].includes(property.status);

  const details =
    pg.details &&
    typeof pg.details === "object" &&
    !Array.isArray(pg.details)
      ? (pg.details as Record<string, unknown>)
      : {};

  const consent =
    details.listing_communication_consent &&
    typeof details.listing_communication_consent === "object" &&
    !Array.isArray(details.listing_communication_consent)
      ? (details.listing_communication_consent as Record<string, unknown>)
      : {};

  const hasConsent = consent.accepted === true;

  const defaults = {
    ...pg,
    ...nearbyPlacesDefaults(details.nearby_places),
    id,
    landmark: details.landmark,
    facing: details.facing,
    rent_basis: details.rent_basis,
    google_maps_url: details.google_maps_url,
    description: property.description,
    locality: property.locality_text,
    city: property.city_text,
    district: property.district_text,
    state: property.state_text,
    latitude: property.latitude,
    longitude: property.longitude,
  };

  const notice = notices[query.notice || query.media || ""];

  return (
    <main id="main" className="portal-page">
      <div className="shell">
        <nav className="breadcrumbs">
          <Link href={isAdmin ? "/admin/pg" : "/dashboard/pg"}>
            {isAdmin ? "PG administration" : "PG dashboard"}
          </Link>
          <span>›</span>
          <span>{property.reference_no}</span>
        </nav>

        <div className="portal-title">
          <div>
            <p className="eyebrow">{property.reference_no}</p>
            <h1>{pg.pg_name}</h1>
            <p>
              <span className={`status status-${property.status}`}>
                {property.status.replaceAll("_", " ")}
              </span>
              {" · "}Updated{" "}
              {new Date(property.updated_at).toLocaleDateString("en-IN")}
            </p>
          </div>

          <div className="portal-actions">
            <Link
              className="button button-light"
              href={`/dashboard/pg/${id}/preview`}
            >
              Preview
            </Link>

            {!isAdmin && editable && hasConsent && (
              <form action={`/api/pg/${id}/submit`} method="post">
                <button className="button">
                  Submit for review
                </button>
              </form>
            )}
          </div>
        </div>

        {notice && (
          <p
            className={`form-message ${
              query.notice === "consent-required" || ["failed","locked"].includes(query.media||"")
                ? "error"
                : "success"
            }`}
          >
            {notice}
          </p>
        )}

        {!isAdmin && editable && !hasConsent && (
          <p className="form-message error">
            Confirm the mandatory consent and save the PG
            information to enable submission for review.
          </p>
        )}

        <div className="review-layout owner-manage">
          <div>
            <section className="portal-section">
              <h2>PG information</h2>

              {editable ? (
                <PgForm defaults={defaults} adminMode={isAdmin} />
              ) : (
                <dl className="review-facts">
                  <div>
                    <dt>Category</dt>
                    <dd>{pg.category.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {property.locality_text}, {property.city_text}
                    </dd>
                  </div>
                  <div>
                    <dt>Rent from</dt>
                    <dd>
                      ₹{Number(pg.rent_per_bed).toLocaleString("en-IN")}
                    </dd>
                  </div>
                  <div className="wide">
                    <dt>Description</dt>
                    <dd>{property.description}</dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="portal-section">
              <div className="section-heading-row">
                <h2>Room types</h2>
                <span>{rooms?.length || 0}</span>
              </div>

              {rooms?.length ? (
                <div className="admin-table">
                  <div className="admin-row admin-head">
                    <span>Room</span>
                    <span>Sharing</span>
                    <span>Beds</span>
                    <span>Rent</span>
                    <span>Actions</span>
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
                          {editable && (
                            <form
                              action={`/api/pg/${id}/rooms/${room.id}`}
                              method="post"
                            >
                              <button
                                className="danger-link"
                                name="action"
                                value="delete"
                              >
                                Remove
                              </button>
                            </form>
                          )}
                        </span>
                      </div>

                      {editable && (
                        <details
                          style={{
                            margin: "12px 0 20px",
                            padding: "16px",
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
                              Sharing
                              <select
                                name="sharing_type"
                                defaultValue={room.sharing_type}
                              >
                                <option value="single">Single</option>
                                <option value="double">Double</option>
                                <option value="triple">Triple</option>
                                <option value="four_sharing">
                                  Four sharing
                                </option>
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
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <p>No room types added.</p>
                </div>
              )}

              {editable && (
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
                    Sharing
                    <select name="sharing_type">
                      <option value="single">Single</option>
                      <option value="double">Double</option>
                      <option value="triple">Triple</option>
                      <option value="four_sharing">
                        Four sharing
                      </option>
                    </select>
                  </label>

                  <label>
                    Capacity
                    <input
                      required
                      name="capacity"
                      type="number"
                      min="1"
                    />
                  </label>

                  <label>
                    Available beds
                    <input
                      required
                      name="available_beds"
                      type="number"
                      min="0"
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

                  <button className="button secondary">
                    Add room
                  </button>
                </form>
              )}
            </section>

            <section className="portal-section">
              <div className="section-heading-row">
                <h2>Images</h2>
                <span>{media.length}/6</span>
              </div>

              {editable && (
                <form
                  className="media-upload"
                  action={`/api/properties/${pg.property_id}/media?context=pg&pgId=${id}`}
                  method="post"
                  encType="multipart/form-data"
                >
                  <label>
                    Upload up to 6 images
                    <input
                      required
                      multiple
                      type="file"
                      name="image"
                      accept="image/jpeg,image/png,image/webp"
                    />
                  </label>

                  <p>
                        Images are resized to 1200 × 800, converted to
                        high-quality WebP, thumbnailed and watermarked.
                  </p>

                  <button className="button secondary">
                    Process &amp; upload
                  </button>
                </form>
              )}

              {editable ? (
                <PropertyMediaManager
                  items={media.map((image,index)=>({...image,url:signed?.[index]?.signedUrl||""}))}
                  endpointBase={`/api/properties/${pg.property_id}/media`}
                  query={`?context=pg&pgId=${id}`}
                />
              ) : media.length ? (
                <ul className="activity-list">{media.map(image=><li key={image.id}><strong>{image.original_filename}</strong><span>{image.is_cover?"Cover image":`Position ${image.sort_order+1}`}</span></li>)}</ul>
              ) : (
                <div className="empty-state compact">
                  <p>No images uploaded.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="review-actions">
            <p className="eyebrow">Lifecycle</p>
            <h2>Approval history</h2>

            {history?.length ? (
              <ol className="timeline">
                {history.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.to_status.replaceAll("_", " ")}
                    </strong>
                    <span>
                      {new Date(item.created_at).toLocaleString("en-IN")}
                    </span>
                    {item.reason && <p>{item.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No status changes yet.</p>
            )}

            {!isAdmin && (
              <>
                <hr />

                <form action={`/api/pg/${id}`} method="post">
                  <button
                    className="button button-light"
                    name="action"
                    value="duplicate"
                  >
                    Duplicate PG
                  </button>
                </form>

                {![
                  "pending_review",
                  "approved",
                  "published",
                ].includes(property.status) && (
                  <form action={`/api/pg/${id}`} method="post">
                    <button
                      className="danger-button"
                      name="action"
                      value="delete"
                    >
                      Delete PG
                    </button>
                  </form>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
