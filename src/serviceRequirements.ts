export interface ServiceRequirement {
  documents: string[];
  note: string;
  showVehicleField?: boolean;
}

export const SERVICE_REQUIREMENTS: Record<string, ServiceRequirement> = {
  // Revenue Department
  "Fard / Jamabandi Assistance": {
    documents: [
      "Aadhaar Card of applicant",
      "Previous Fard / Intikhab / Khasra & Khewet details (if available)",
      "Sale deed / registry copy or Mutation reference",
      "Active mobile number for OTP/verification",
    ],
    note: "Village/Tehsil and Khasra/Khata details help speed up record lookup.",
  },
  "Domicile Certificate": {
    documents: [
      "Aadhaar Card",
      "PRC (Permanent Resident Certificate) or Ration Card / Electoral Roll proof",
      "10th Marks Card / Birth Certificate",
      "Passport-size photograph",
    ],
    note: "Requirements vary slightly based on PRC vs. 15-year residency basis.",
  },
  "Income Certificate": {
    documents: [
      "Aadhaar Card of applicant & head of family",
      "Ration Card copy",
      "Salary slip / Employer certificate or Self-declaration affidavit",
      "Passport-size photograph",
    ],
    note: "Tehsil office may require local Patwari/Lambardar report.",
  },

  // Srinagar Municipal Corporation (SMC)
  "Birth & Death Certificate Assistance": {
    documents: [
      "Hospital Discharge Slip / Birth or Death Memo",
      "Parents' Aadhaar Cards (for Birth) or Deceased + Applicant Aadhaar (for Death)",
      "SMC / Municipal Ward details & date of event",
      "Affidavit / Non-Availability Certificate (only for delayed registration)",
    ],
    note: "Digital barcode certificate timelines depend on SMC verification.",
  },

  // RTO & Transport
  "Driving Licence Assistance": {
    documents: [
      "Aadhaar Card (linked with active mobile number)",
      "Learner Licence number (for permanent DL) or Age/Address proof (for LL)",
      "Passport-size photograph & signature",
      "Blood group details (Form 1A medical if age 40+)",
    ],
    note: "Biometric/test slot attendance at RTO Srinagar (JK01) is required.",
    showVehicleField: true,
  },
  "RC-related Services": {
    documents: [
      "Existing RC copy & valid Vehicle Insurance",
      "Valid PUC (Pollution Under Control) certificate",
      "Owner Aadhaar Card & active mobile number",
      "Form 29/30 or NOC (for ownership transfer / hypothecation removal)",
    ],
    note: "Keep the registered mobile number active for Parivahan OTPs.",
    showVehicleField: true,
  },

  // Insurance
  "Motor Insurance": {
    documents: [
      "Vehicle Registration Certificate (RC) copy",
      "Previous year policy copy (if renewing)",
      "Owner Aadhaar / PAN (for KYC compliance)",
      "Active mobile number & email (optional)",
    ],
    note: "We share multi-insurer quotes (Third-Party & Own Damage) before issuing.",
    showVehicleField: true,
  },

  // Central Government Services
  "PAN Card": {
    documents: [
      "Aadhaar Card (with DOB & address)",
      "2 Passport-size photographs",
      "Active mobile number & email ID",
      "Existing PAN copy (if applying for correction / reprint)",
    ],
    note: "Name and date of birth must match Aadhaar for instant e-KYC.",
  },
  "MSME / Udyam Registration": {
    documents: [
      "Proprietor / Partner Aadhaar Card (linked to mobile for OTP)",
      "PAN Card of applicant / business",
      "Bank Account number & IFSC code",
      "Business name, start date & NIC activity details",
    ],
    note: "Registration is Aadhaar-OTP based; never type OTPs into the form.",
  },
};

export const DEFAULT_SERVICE_REQUIREMENT: ServiceRequirement = {
  documents: [
    "Valid Government Photo ID (Aadhaar / PAN / Voter ID)",
    "Active mobile number for updates",
    "Any existing reference number or old certificate copy (if applicable)",
  ],
  note: "Our team will confirm the exact department checklist on WhatsApp or call before filing.",
};

export function getServiceRequirement(serviceName: string): ServiceRequirement {
  const exactMatch = SERVICE_REQUIREMENTS[serviceName];
  if (exactMatch) return exactMatch;

  const normalize = (value: string) =>
    value.toLowerCase().trim().replace(/[^a-z0-9]+/g, " ").trim();
  const normalizedName = normalize(serviceName);
  const matchingEntry = Object.entries(SERVICE_REQUIREMENTS).find(
    ([key]) => normalize(key) === normalizedName,
  );

  return matchingEntry?.[1] ?? DEFAULT_SERVICE_REQUIREMENT;
}
