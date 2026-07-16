const reserved = new Set(["admin","api","auth","login","register","property","properties","robots","sitemap","static"]);

export function slugify(value: string) {
  const slug = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  return reserved.has(slug) ? `${slug}-listing` : slug;
}

export function propertySlug(input: { title: string; transactionType: string; locality: string; city: string }) {
  return slugify(`${input.title} for ${input.transactionType} ${input.locality} ${input.city}`).slice(0, 110).replace(/-+$/g, "");
}
