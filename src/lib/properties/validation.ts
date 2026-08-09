const prohibitedPublicContent=/(?:\b[6-9]\d{9}\b|\b\d{3}[-\s]\d{3}[-\s]\d{4}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|www\.|(?:^|\s)@[a-z0-9_.]+)/i;
export function propertyDescriptionIsPublicSafe(value:string){return!prohibitedPublicContent.test(value)}
export function propertyTypeSlug(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}
