export type Category = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  is_active?: boolean;
  sort_order?: number;
};

export type ServiceRecord = {
  id: string;
  category_slug: string;
  name: string;
  description: string;
  required_documents: string[];
  eligibility: string;
  application_method: string;
  official_url: string | null;
  official_url_verified: boolean;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
};

export const categories: Category[] = [
  {
    slug: "insurance",
    name: "Insurance",
    description: "Policy enquiries, renewals and documentation assistance.",
    icon: "shield",
  },
  {
    slug: "revenue",
    name: "Revenue Department",
    description: "Certificate and land-record assistance.",
    icon: "landmark",
  },
  {
    slug: "smc",
    name: "Srinagar Municipal Corporation",
    description: "Municipal application and information assistance.",
    icon: "building",
  },
  {
    slug: "labour",
    name: "Labour Department",
    description: "Registration and welfare-application assistance.",
    icon: "briefcase",
  },
  {
    slug: "handloom",
    name: "Handloom & Handicrafts",
    description: "Weaver, artisan and scheme documentation assistance.",
    icon: "scroll",
  },
  {
    slug: "rto",
    name: "RTO & Transport",
    description: "Licence, registration and transport-service assistance.",
    icon: "car",
  },
  {
    slug: "central",
    name: "Central Government Services",
    description: "Public-service application assistance.",
    icon: "globe",
  },
  {
    slug: "education",
    name: "Education Department",
    description: "Education-related public-service assistance.",
    icon: "book",
  },
  {
    slug: "social-welfare",
    name: "Social Welfare Department",
    description: "Social-welfare application assistance.",
    icon: "heart",
  },
  {
    slug: "employment",
    name: "Employment Services",
    description: "Employment and registration assistance.",
    icon: "users",
  },
  {
    slug: "health",
    name: "Health Services",
    description: "Health-service application assistance.",
    icon: "activity",
  },
  {
    slug: "agriculture",
    name: "Agriculture Department",
    description: "Agriculture-related public-service assistance.",
    icon: "sprout",
  },
  {
    slug: "electricity",
    name: "Electricity Services",
    description: "Electricity-service request assistance.",
    icon: "zap",
  },
  {
    slug: "water",
    name: "Water Supply Services",
    description: "Water-supply request assistance.",
    icon: "droplets",
  },
  {
    slug: "banking",
    name: "Banking Assistance",
    description: "Digital banking-form assistance; no banking advice.",
    icon: "landmark",
  },
  {
    slug: "travel",
    name: "Railway & Bus Ticketing",
    description: "Ticketing enquiries and booking assistance.",
    icon: "ticket",
  },
  {
    slug: "other",
    name: "Other Public Services",
    description: "Ask us about a public service not listed here.",
    icon: "more",
  },
];

const serviceNames: Record<string, string[]> = {
  insurance: [
    "Life Insurance",
    "Health Insurance",
    "Motor Insurance",
    "Two-Wheeler Insurance",
    "Four-Wheeler Insurance",
    "Commercial Vehicle Insurance",
    "Personal Accident Insurance",
    "Travel Insurance",
    "Home Insurance",
    "Business Insurance",
    "Renewal Assistance",
    "Insurance Quotation Requests",
    "Policy Documentation Assistance",
    "Claim Assistance",
  ],
  revenue: [
    "Income Certificate",
    "Domicile Certificate",
    "Category Certificate",
    "Residence Certificate",
    "Character Certificate (where applicable)",
    "Land Record Assistance",
    "Fard / Jamabandi Assistance",
    "Mutation Application Assistance",
    "Revenue Record Requests",
  ],
  smc: [
    "Birth Registration Assistance",
    "Death Registration Assistance",
    "Building Permission Assistance",
    "Trade Licence Assistance",
    "Property Tax Assistance",
    "Municipal Complaint Assistance",
    "Sanitation-related Services",
  ],
  labour: [
    "Labour Registration Assistance",
    "Labour Card Application Assistance",
    "Renewal Assistance",
    "Welfare Scheme Application Assistance",
    "Construction Worker Registration Assistance",
  ],
  handloom: [
    "Weaver Registration Assistance",
    "Artisan Registration Assistance",
    "Weaver Card Assistance",
    "Handloom-related Scheme Applications",
    "Handicraft-related Scheme Applications",
    "Artisan Documentation",
    "Registration and Renewal Assistance",
  ],
  rto: [
    "Learner Licence Assistance",
    "Driving Licence Assistance",
    "Licence Renewal",
    "Vehicle Registration Assistance",
    "RC-related Services",
    "NOC Assistance",
    "Permit Assistance",
    "Challan Information Assistance",
  ],
  central: [
    "PAN Card Assistance",
    "ABHA Assistance",
    "MSME / Udyam Assistance",
    "Trademark Application Assistance",
    "Food Licence / FSSAI Assistance",
  ],
};

const descriptions: Record<string, string> = {
  insurance:
    "Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.",
  revenue:
    "Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.",
  smc: "Application and information assistance. Availability and decisions are determined by Srinagar Municipal Corporation.",
  labour:
    "Application and documentation assistance. Eligibility and decisions are determined by the relevant department.",
  handloom:
    "Registration and application assistance. Eligibility and decisions are determined by the relevant department.",
  rto: "Online application assistance. Eligibility, fees and decisions are determined by the transport department.",
  central:
    "Digital application assistance. Eligibility and decisions are determined by the relevant authority.",
};

export const seedServices: ServiceRecord[] = Object.entries(
  serviceNames,
).flatMap(([category_slug, names]) =>
  names.map((name, index) => ({
    id: `${category_slug}-${index + 1}`,
    category_slug,
    name,
    description:
      descriptions[category_slug] ??
      "Information and application assistance. Confirm current eligibility and requirements with the responsible authority.",
    required_documents: [],
    eligibility:
      "Requirements depend on the responsible authority. Please confirm current eligibility before applying.",
    application_method:
      "Assistance is available in person or by enquiry. The responsible authority controls the official application process.",
    official_url: null,
    official_url_verified: false,
    is_active: true,
    is_featured: category_slug === "insurance" && index < 3,
    created_at: "2026-01-01T00:00:00.000Z",
  })),
);

export const statusLabels = [
  "Application Received",
  "Under Review",
  "Documents Required",
  "Processing",
  "Submitted to Department",
  "Approved",
  "Rejected",
  "Completed",
] as const;
export type ApplicationStatus = (typeof statusLabels)[number];

export function categoryName(slug: string) {
  return categories.find((category) => category.slug === slug)?.name ?? slug;
}
