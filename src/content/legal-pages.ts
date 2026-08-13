export type LegalSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};

export type LegalPage = {
  title: string;
  eyebrow: string;
  intro: string;
  canonical: string;
  effectiveDate: string;
  sections: LegalSection[];
};

const contact =
  "For questions, requests, or complaints about this policy, email enquiry@ongoleproperty.com. OngoleProperty.com currently provides online property assistance and professional field services across Ongole and Prakasam District without a customer-facing physical office.";

export const legalPages: Record<string, LegalPage> = {
  "terms-and-conditions": {
    title: "Terms & Conditions",
    eyebrow: "Platform terms",
    intro: "These terms govern access to and use of OngoleProperty.com as a real estate marketing platform and service facilitator.",
    canonical: "/terms-and-conditions",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "Acceptance of terms", paragraphs: ["By accessing or using OngoleProperty.com, you agree to comply with these Terms & Conditions. If you do not agree with any part of these terms, discontinue using the website."] },
      { title: "User registration", paragraphs: ["Users must provide accurate, complete, and current information during registration. Users are responsible for maintaining the confidentiality of their login credentials and for activity performed through their accounts."] },
      { title: "Property listings", paragraphs: ["Property owners and authorised representatives are responsible for the accuracy of submitted information, photographs, prices, and documents.", "OngoleProperty.com may review, approve, reject, edit, suspend, archive, or remove a listing that is inaccurate, unlawful, misleading, expired, duplicated, or contrary to platform policy."] },
      { title: "Property verification", paragraphs: ["We may conduct preliminary verification based on available information before recommending properties. This does not replace independent legal, financial, technical, title, encumbrance, survey, approval, tax, condition, or statutory verification by the user and qualified advisers."] },
      { title: "User responsibilities", paragraphs: ["Users must use the platform lawfully and must not:"], items: ["Submit false or misleading information.", "Upload illegal, offensive, confidential, or infringing content.", "Attempt unauthorised access or interfere with platform security.", "Use the platform for fraud, spam, harassment, or unlawful solicitation."] },
      { title: "Intellectual property and third-party services", paragraphs: ["Website content, design, branding, logos, graphics, text, and platform assets belong to OngoleProperty.com unless otherwise stated. Unauthorised reproduction or distribution is prohibited.", "Links and integrations may lead to third-party services. OngoleProperty.com does not control their content, availability, security, or privacy practices."] },
      { title: "Platform role and limitation of liability", paragraphs: ["OngoleProperty.com acts as a real estate marketing platform and facilitator. It is not a party to agreements between buyers, sellers, landlords, tenants, builders, developers, or other third parties unless expressly agreed in writing.", "To the extent permitted by law, OngoleProperty.com is not responsible for disputes, losses, damages, or claims arising from independent transaction decisions or third-party information."] },
      { title: "Changes and contact", paragraphs: ["These terms may be updated from time to time. The effective date shown on this page identifies the current version. Continued use after an update constitutes acceptance of the revised terms.", contact] },
    ],
  },
  "privacy-policy": {
    title: "Privacy Policy",
    eyebrow: "Your information",
    intro: "This policy explains the personal information OngoleProperty.com collects, why it is used, and the choices available to users.",
    canonical: "/privacy-policy",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "Information we collect", paragraphs: ["Depending on how you use the platform, we may collect:"], items: ["Name, mobile number, email address, and account registration details.", "Property details, location information, images, videos, and documents submitted for a listing.", "Enquiries, communication history, payment references, and customer-support records.", "Security and usage information such as device data, privacy-safe network identifiers, and analytics events."] },
      { title: "How information is used", paragraphs: ["Information may be used to:"], items: ["Create and manage accounts, listings, subscriptions, enquiries, and support requests.", "Review and publish property or PG listings and connect interested parties under the selected contact-visibility rules.", "Process authorised payments, issue transaction records, and administer promotions.", "Send service notifications, maintain security, prevent fraud, and improve platform performance."] },
      { title: "Information sharing", paragraphs: ["OngoleProperty.com does not sell or rent personal information. Information is shared only when needed to provide an authorised service, with the user's direction, with contracted service providers subject to appropriate safeguards, or when required by law.", "Owner contact information is not displayed unless the listing's approved visibility rule and the viewer's eligibility permit it."] },
      { title: "Cookies and third-party services", paragraphs: ["The website may use essential cookies for authentication and security, preference cookies, and consented analytics or third-party integrations. Maps, analytics, communications, and payment services operate under their own privacy terms.", "More information is available in the Cookie Policy."] },
      { title: "Security and retention", paragraphs: ["Appropriate technical and administrative safeguards are used to protect information from unauthorised access, misuse, alteration, or disclosure. No internet service can guarantee absolute security.", "Information is retained only for the period reasonably required for the service, audit, fraud prevention, dispute handling, legal obligations, and legitimate business records."] },
      { title: "Your choices", paragraphs: ["Users may request access, correction, or deletion of account information, subject to identity verification and applicable legal, security, audit, and retention requirements. Users may also manage browser cookies and available notification preferences.", contact] },
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    eyebrow: "Important information",
    intro: "Property information on OngoleProperty.com is provided for general information and professional property marketing purposes.",
    canonical: "/disclaimer",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "Property information", paragraphs: ["Descriptions, prices, dimensions, photographs, amenities, approvals, and related details may be supplied by owners, authorised representatives, builders, developers, or other third parties. Although reasonable efforts are made to review information, completeness and accuracy cannot be guaranteed."] },
      { title: "Independent verification", paragraphs: ["Before any purchase, sale, lease, rental, or investment decision, users must independently verify:"], items: ["Ownership, title documents, encumbrances, and registration records.", "Government approvals, survey details, boundaries, taxes, and statutory requirements.", "Market value, physical condition, access, utilities, and other material property facts."] },
      { title: "Availability and professional advice", paragraphs: ["Property availability, pricing, and specifications may change without notice. A listing does not guarantee continued availability.", "Website information is not legal, financial, taxation, engineering, surveying, or investment advice. Users should consult appropriately qualified professionals."] },
      { title: "Third parties and liability", paragraphs: ["OngoleProperty.com is a marketing platform and service facilitator. It is not responsible for third-party websites or for direct, indirect, incidental, financial, legal, or consequential loss arising from independent negotiations, agreements, transactions, or decisions, to the extent permitted by law.", contact] },
    ],
  },
  "property-listing-policy": {
    title: "Property Listing Policy",
    eyebrow: "Listing standards",
    intro: "This policy sets the minimum standards for property and paying-guest listings submitted to OngoleProperty.com.",
    canonical: "/property-listing-policy",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "Authority and accuracy", paragraphs: ["A listing may be submitted only by an owner or an authorised representative with a genuine right to market it. The submitter must provide accurate, current, and complete information and promptly correct material changes."] },
      { title: "Required content", paragraphs: ["Listings must clearly and truthfully describe:"], items: ["Property type, transaction purpose, location, area, price or rent, and availability.", "Material features, restrictions, amenities, and known conditions relevant to a prospective customer.", "The source and ownership of uploaded photographs, videos, plans, and documents."] },
      { title: "Prohibited listings and content", paragraphs: ["The following may be rejected or removed:"], items: ["Duplicate, fraudulent, unavailable, misleading, speculative, or unlawfully marketed properties.", "Content that infringes privacy, copyright, confidentiality, or other rights.", "Unrelated promotions, hidden charges, manipulated media, abusive language, or unsafe contact instructions."] },
      { title: "Review and lifecycle", paragraphs: ["New listings remain private drafts until submitted. Submitted listings may be approved, rejected, or returned for changes. Approval is a platform-content review and is not a legal-title certification.", "OngoleProperty.com may archive, suspend, soft-delete, restore, or remove listings according to availability, expiry, quality, policy, security, or legal requirements. Material edits may require another review."] },
      { title: "Contact, media, and enquiries", paragraphs: ["Contact visibility follows the approved listing setting and eligible membership rules. Images may be resized, optimised, and watermarked for secure platform display. Enquiries may be routed through OngoleProperty.com for privacy and service coordination.", contact] },
    ],
  },
  "membership-policy": {
    title: "Membership Policy",
    eyebrow: "Plans and subscriptions",
    intro: "This policy explains how free registration, memberships, plan benefits, limits, activation, and expiry operate.",
    canonical: "/membership-policy",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "Registration and eligibility", paragraphs: ["Creating an account does not automatically activate a paid membership. A membership becomes active only after the selected plan and payment or authorised manual activation have been successfully recorded."] },
      { title: "Plan benefits and limits", paragraphs: ["Plan prices, duration, listing limits, image limits, enquiry access, analytics access, promotion allowances, contact access, and other benefits are those displayed and active when the membership is purchased or manually approved.", "Benefits are personal to the subscribed account, subject to reasonable-use and platform-policy controls, and cannot be transferred without written approval."] },
      { title: "Activation, renewal, and expiry", paragraphs: ["Memberships may be activated through an approved online payment, an administrator-reviewed manual payment, or an authorised administrative action. Renewal is not automatic unless explicitly offered and accepted.", "At expiry, paid benefits may stop immediately. Existing listings remain subject to the status and visibility rules configured for the applicable plan and platform."] },
      { title: "Suspension and cancellation", paragraphs: ["A membership may be paused, suspended, or cancelled for payment failure, misuse, fraud, legal requirements, or violation of platform policies. Users may contact support about cancellation or an incorrect activation."] },
      { title: "Payments and refunds", paragraphs: ["Payment records, applicable taxes, refund eligibility, and processing timelines follow the displayed order terms and payment status. A submitted payment proof does not activate benefits until approved.", contact] },
    ],
  },
  "advertisement-policy": {
    title: "Advertisement Policy",
    eyebrow: "Campaign standards",
    intro: "All advertisements displayed on OngoleProperty.com are subject to administrative review and placement controls.",
    canonical: "/advertisement-policy",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "Advertiser responsibility", paragraphs: ["Advertisers are responsible for the legality, accuracy, ownership, offers, claims, destination links, and intellectual-property rights associated with submitted campaigns."] },
      { title: "Review standards", paragraphs: ["OngoleProperty.com may reject, pause, edit, or remove advertisements that are:"], items: ["False, misleading, discriminatory, unlawful, unsafe, offensive, or unrelated to the approved campaign.", "Designed to impersonate platform content or collect information deceptively.", "Linked to malicious, unavailable, insecure, or materially different destinations."] },
      { title: "Scheduling and placement", paragraphs: ["Campaign visibility depends on approved placement, order, status, start and end dates, and available inventory. Submission or payment does not guarantee impressions, clicks, enquiries, or commercial results."] },
      { title: "Data and third-party destinations", paragraphs: ["Advertisement interactions may be measured using privacy-conscious analytics. External destinations are controlled by their operators and are subject to their own terms and privacy practices.", contact] },
    ],
  },
  "cookie-policy": {
    title: "Cookie Policy",
    eyebrow: "Browser storage",
    intro: "This policy explains how cookies and similar browser technologies may be used on OngoleProperty.com.",
    canonical: "/cookie-policy",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "Essential cookies", paragraphs: ["Essential cookies support authentication, session continuity, security, fraud prevention, load balancing, and user-requested features. Disabling them may prevent parts of the website from working."] },
      { title: "Preferences and analytics", paragraphs: ["Preference storage may remember choices such as display or search settings. Analytics may measure pages, listings, searches, and interactions to improve the service. Non-essential technologies should be used only when enabled and permitted."] },
      { title: "Third-party services", paragraphs: ["Maps, videos, analytics, CAPTCHA, communications, and payment services may set or read their own cookies when loaded. Their use is governed by the relevant provider's terms and privacy policy."] },
      { title: "Managing cookies", paragraphs: ["Users may control cookies through available consent controls and browser settings. Blocking cookies may affect sign-in, security, payments, maps, or other requested features.", contact] },
    ],
  },
  "copyright-policy": {
    title: "Copyright Policy",
    eyebrow: "Intellectual property",
    intro: "This policy protects platform content while explaining the rights and responsibilities attached to user-submitted listing media.",
    canonical: "/copyright-policy",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "Copyright notice", paragraphs: ["All content published on OngoleProperty.com, including text, graphics, logos, icons, website design, layouts, databases, documents, videos, and other digital materials, is owned by OngoleProperty.com unless otherwise stated.", "The website and its contents are protected under applicable copyright, trademark, and intellectual-property laws. Unauthorised copying, reproduction, modification, distribution, publication, storage, transmission, or commercial use is prohibited."] },
      { title: "Limited permission", paragraphs: ["Users may access the website for personal, lawful, and non-commercial property-search or property-marketing purposes. No content may be copied or republished without written authorisation."] },
      { title: "Property listing content", paragraphs: ["Submitters remain responsible for photographs, descriptions, and information they provide. By submitting content, they confirm that they have the required rights and grant OngoleProperty.com permission to process, display, promote, and market it through the website and official channels."] },
      { title: "Trademark and reporting infringement", paragraphs: ["The OngoleProperty.com name, logo, brand identity, and associated visual elements may not be copied or imitated without prior written permission.", "To report suspected copyright or intellectual-property infringement, contact enquiry@ongoleproperty.com with the affected work, the disputed location, ownership or authority details, contact information, and a good-faith explanation."] },
    ],
  },
  "contact-grievance-policy": {
    title: "Contact & Grievance Policy",
    eyebrow: "Customer support",
    intro: "OngoleProperty.com provides a documented channel for service requests, privacy concerns, listing complaints, and other grievances.",
    canonical: "/contact-grievance-policy",
    effectiveDate: "30 July 2026",
    sections: [
      { title: "How to contact us", paragraphs: ["Voice call: +91 77889 98459. WhatsApp: +91 99887 67689. General enquiry: enquiry@ongoleproperty.com. Sales and advertising: sales@ongoleproperty.com. NRI services: nri@ongoleproperty.com.", "We currently provide online property assistance and professional field services across Ongole and Prakasam District without a customer-facing physical office. Digital enquiries may be submitted at any time."] },
      { title: "What to include", paragraphs: ["To help us investigate, provide:"], items: ["Your name and a reliable contact method.", "The property, PG, account, payment, advertisement, or enquiry reference when applicable.", "A clear description, relevant dates, and supporting material that you are authorised to share.", "The resolution you are requesting."] },
      { title: "Review process", paragraphs: ["We will acknowledge and review grievances within a reasonable period based on urgency and complexity. Identity or authority may be verified before account, personal-data, payment, or listing information is disclosed or changed.", "Urgent security, fraud, privacy, or unlawful-content reports may be prioritised. Records may be retained for audit, fraud prevention, dispute resolution, and legal obligations."] },
      { title: "Escalation", paragraphs: ["If the initial response does not resolve the concern, reply to the same support correspondence and request escalation, quoting the original reference. This policy does not limit rights or remedies available under applicable law."] },
    ],
  },
};

export const legalAliases: Record<string, keyof typeof legalPages> = {
  privacy: "privacy-policy",
  terms: "terms-and-conditions",
};
