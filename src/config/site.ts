export const siteConfig = {
  name: "OngoleProperty.com",
  legalName: "Kosana Associates LLP",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.ongoleproperty.com",
  since: 2002,
  phone: "+91 77889 98459",
  phoneHref: "tel:+917788998459",
  whatsapp: "+91 99887 67689",
  whatsappHref: "https://wa.me/919988767689",
  email: "admin@ongoleproperty.com",
  nriEmail: "nri@ongoleproperty.com",
  address: "4th Lane, Bhagya Nagar, Ongole, Prakasam District, Andhra Pradesh, India",
  description: "Trusted real estate marketing for verified properties across Ongole and Prakasam District since 2002.",
  social: {
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
    linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL || "",
  },
} as const;

export const featureFlags = {
  membershipsPublic: process.env.NEXT_PUBLIC_FEATURE_MEMBERSHIPS === "true",
  blog: process.env.NEXT_PUBLIC_FEATURE_BLOG !== "false",
  agents: process.env.NEXT_PUBLIC_FEATURE_AGENTS !== "false",
  payingGuest: process.env.NEXT_PUBLIC_FEATURE_PG !== "false",
} as const;
