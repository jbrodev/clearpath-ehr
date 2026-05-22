// Role definitions. Each role has its own home screen route and tone.
// The role is mock-auth for now — stored in localStorage, swappable any time
// from the top nav. Real OAuth-based identity comes when we layer SMART on FHIR.

export type Role = "preop" | "pcp" | "surgeon";

export interface RoleDefinition {
  id: Role;
  label: string;
  tagline: string;
  description: string;
  homePath: string;
  homeHeading: string;
  homeSubheading: string;
}

export const ROLES: Record<Role, RoleDefinition> = {
  preop: {
    id: "preop",
    label: "Pre-Op Nurse",
    tagline: "Surgical coordinator workflow",
    description:
      "Work through a queue of upcoming surgeries. Run clearance, draft letters to PCPs and specialists, track status until each patient is cleared.",
    homePath: "/preop",
    homeHeading: "Upcoming Surgery Queue",
    homeSubheading: "Patients with procedures scheduled, ordered by date.",
  },
  pcp: {
    id: "pcp",
    label: "PCP / Office",
    tagline: "Incoming clearance requests",
    description:
      "Review incoming clearance requests from surgical offices. ClearPath surfaces the patient's risk profile and a draft response so you can sign off or push back quickly.",
    homePath: "/pcp",
    homeHeading: "Inbox: Clearance Requests",
    homeSubheading: "Pre-operative clearance requests pending your review.",
  },
  surgeon: {
    id: "surgeon",
    label: "Surgical Office",
    tagline: "Paperwork-first workflow",
    description:
      "Draft initial clearance request letters to PCPs and specialists. Track which paperwork has been sent and what's still outstanding.",
    homePath: "/surgeon",
    homeHeading: "Scheduled Procedures",
    homeSubheading: "Procedures on the books and their clearance status.",
  },
};

export const ROLE_LIST: RoleDefinition[] = [ROLES.preop, ROLES.pcp, ROLES.surgeon];

export const ROLE_STORAGE_KEY = "clearpath:role";

export function isRole(value: unknown): value is Role {
  return value === "preop" || value === "pcp" || value === "surgeon";
}
