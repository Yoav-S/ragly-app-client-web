export const CATEGORIES = [
  "veterinarian",
  "groomer",
  "pharmacy",
  "pet_friendly",
  "pet_store",
] as const;

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type BusinessCategory = (typeof CATEGORIES)[number];
export type Weekday = (typeof DAYS)[number];
export type AppLocaleCode = "en" | "ro" | "ru" | "he";

export type TimeSlot = { open: string; close: string };

export type SpecialDate = {
  date: string;
  closed: boolean;
  slots: TimeSlot[];
};

export type OpeningHours = {
  /** False when there are no fixed hours to publish. */
  provided: boolean;
  always_open: boolean;
  mon: TimeSlot[];
  tue: TimeSlot[];
  wed: TimeSlot[];
  thu: TimeSlot[];
  fri: TimeSlot[];
  sat: TimeSlot[];
  sun: TimeSlot[];
  special_dates?: SpecialDate[];
};

export function emptyHours(provided = true): OpeningHours {
  return {
    provided,
    always_open: false,
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
    special_dates: [],
  };
}

export function weekdayHours(open = "09:00", close = "18:00"): OpeningHours {
  const hours = emptyHours(true);
  for (const day of ["mon", "tue", "wed", "thu", "fri"] as const) {
    hours[day] = [{ open, close }];
  }
  return hours;
}

export type GeoLocation = {
  type: "Point";
  coordinates: [number, number];
};

export type PlaceRef = { provider: "osm" | "google"; id: string };

export type MemberRole = "owner" | "branch_owner" | "lead" | "worker";

export type BranchStatus = "draft" | "pending_review" | "published" | "rejected";
export type BusinessStatus = BranchStatus | "suspended";
export type OnboardingStep = "description" | "logo" | "phones" | "email" | "website" | "instagram" | "done";

export type Service = {
  id: string;
  category: BusinessCategory;
  opening_hours: OpeningHours;
  phone: string[];
  status: BranchStatus;
  visible: boolean;
};

export type Branch = {
  id: string;
  business_id: string;
  is_main: boolean;
  address: string;
  city: string;
  timezone: string;
  location: GeoLocation | null;
  place_ref: PlaceRef | null;
  services: Service[];
  opening_hours: OpeningHours;
  phone: string[];
  website: string | null;
  instagram: string | null;
  photo: string | null;
  status: BranchStatus;
  visible: boolean;
  hidden_reason: string | null;
  hidden_by: "owner" | "admin" | null;
  rejection_reason: string | null;
  field_errors: Record<string, string>;
  admin_notes: Record<string, string>;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Invitation = {
  id: string;
  business_id: string;
  business_name: string;
  email: string;
  role: MemberRole;
  status: "pending" | "approved" | "declined";
  location_id?: string | null;
};

export type Business = {
  id: string;
  name: string;
  phone: string[];
  email: string | null;
  description: string | null;
  category: BusinessCategory | null;
  categories: BusinessCategory[];
  city: string;
  status: BusinessStatus;
  visible: boolean;
  address: string;
  timezone: string;
  opening_hours: OpeningHours;
  website: string | null;
  location: GeoLocation | null;
  photo: string | null;
  photos: string[];
  owner_uid: string | null;
  owner_email: string | null;
  owned: boolean;
  instagram: string | null;
  locale: AppLocaleCode;
  rejection_reason: string | null;
  field_errors: Record<string, string>;
  admin_notes: Record<string, string>;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  onboarding_step: OnboardingStep;
  invitations: Invitation[];
  locations: Branch[];
};

export type BusinessMembership = {
  business: Business;
  role: MemberRole;
  location_id: string | null;
};

export type BusinessEvent = {
  id: string;
  business_id: string;
  business_name: string;
  location_id: string | null;
  address: string | null;
  kind: string;
  actor_email: string | null;
  audience: "owner" | "admins";
  message: string | null;
  created_at: string;
  unread?: boolean;
};

export type BusinessSession = {
  is_ragly_admin: boolean;
  business: Business | null;
  businesses: BusinessMembership[];
  role: MemberRole | null;
  invitations: Invitation[];
  notices: BusinessEvent[];
  locale: AppLocaleCode;
};

export type NameCheck = {
  available: boolean;
  name_key: string;
  /** Taken and that listing has no owner yet — website offers Contact us. */
  claimable: boolean;
};

/** What onboarding and Edit business send. */
export type BusinessDetailsBody = {
  name: string;
  phone: string[];
  email: string | null;
  description: string | null;
  website: string | null;
  instagram: string | null;
  locale?: AppLocaleCode | null;
  onboarding_step?: OnboardingStep | null;
};

export type ServiceBody = {
  id?: string | null;
  category: BusinessCategory;
  opening_hours: OpeningHours;
  phone: string[];
};

/** What the branch form sends. Everything may be empty on a draft. */
export type BranchBody = {
  address: string;
  city: string;
  location: GeoLocation | null;
  place_ref: PlaceRef | null;
  services: ServiceBody[];
  phone: string[] | null;
  website: string | null;
  instagram: string | null;
  timezone: string | null;
};

export type AdminCreateBody = {
  business: BusinessDetailsBody;
  branch: BranchBody;
  owner_email: string | null;
};

export type PlaceConflict = {
  business_id: string;
  business_name: string;
  address: string;
  distance_m: number;
  same_place_ref: boolean;
};

export type ReviewBranch = {
  branch: Branch;
  conflicts: PlaceConflict[];
};

export type ReviewGroup = {
  business: Business;
  branches: ReviewBranch[];
  first_request: boolean;
  owner_email: string | null;
  owner_since: string | null;
  waiting_since: string | null;
};

export type GeoPlace = {
  label: string;
  address: string;
  city: string;
  country_code: string | null;
  latitude: number;
  longitude: number;
  place_ref: PlaceRef | null;
  timezone: string | null;
};

export type BusinessCounts = {
  total: number;
  pending: number;
  published: number;
  rejected: number;
  deleted: number;
};

export type DirectoryFacets = {
  status: Record<string, number>;
  category: Record<string, number>;
  ownership: Record<string, number>;
};

export type BusinessPage = {
  items: Business[];
  has_more: boolean;
  total: number;
  facets?: DirectoryFacets;
};

export function detailsBody(business: Business): BusinessDetailsBody {
  return {
    name: business.name,
    phone: business.phone,
    email: business.email,
    description: business.description,
    website: business.website,
    instagram: business.instagram,
    locale: business.locale,
  };
}

export function branchBody(branch: Branch): BranchBody {
  return {
    address: branch.address,
    city: branch.city,
    location: branch.location,
    place_ref: branch.place_ref,
    services: branch.services.map((service) => ({
      id: service.id,
      category: service.category,
      opening_hours: { ...service.opening_hours, special_dates: service.opening_hours.special_dates ?? [] },
      phone: service.phone,
    })),
    phone: branch.phone,
    website: branch.website,
    instagram: branch.instagram,
    timezone: branch.timezone,
  };
}

export function emptyBranchBody(): BranchBody {
  return {
    address: "",
    city: "",
    location: null,
    place_ref: null,
    services: [],
    phone: [],
    website: null,
    instagram: null,
    timezone: null,
  };
}

/** The pill a branch shows on the dashboard. */
export type BranchPill = "draft" | "waiting" | "changes" | "active" | "paused";

export function branchPill(branch: Branch): BranchPill {
  if (branch.status === "published") {
    if (!branch.visible) return "paused";
    return branch.services.some((service) => service.status === "pending_review") ? "waiting" : "active";
  }
  if (branch.status === "pending_review") return "waiting";
  if (branch.status === "rejected") return "changes";
  return "draft";
}

export function branchIsLive(branch: Branch): boolean {
  return branch.status === "published" && branch.visible;
}

/** True when a saved branch has anything a pet owner (or a reviewer) would see. */
export function branchHasProgress(branch: Branch): boolean {
  return Boolean(
    branch.address.trim() ||
      branch.city.trim() ||
      branch.location ||
      branch.services.length ||
      branch.phone.length ||
      branch.website ||
      branch.instagram ||
      branch.photo,
  );
}

export const MAX_BUSINESS_IMAGE_BYTES = 5 * 1024 * 1024;

const BUSINESS_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/apng",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const BUSINESS_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "svg",
  "avif",
  "bmp",
  "tif",
  "tiff",
  "ico",
  "heic",
  "heif",
]);

export const BUSINESS_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,image/bmp,image/tiff,image/heic,image/heif,image/x-icon,.jpg,.jpeg,.png,.webp,.gif,.svg,.avif,.bmp,.tif,.tiff,.heic,.heif,.ico";

export function isBusinessImage(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_BUSINESS_IMAGE_BYTES) return false;
  if (BUSINESS_IMAGE_TYPES.has(file.type.toLowerCase())) return true;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BUSINESS_IMAGE_EXTENSIONS.has(extension);
}

export function businessImages(business: { photo: string | null; photos?: string[] }): string[] {
  const photos = (business.photos ?? []).filter((url) => url.startsWith("https://"));
  if (business.photo?.startsWith("https://") && !photos.includes(business.photo)) {
    return [business.photo, ...photos];
  }
  return photos;
}

export function businessLogo(business: {
  photo: string | null;
  photos?: string[];
  locations?: { photo: string | null }[];
}): string | null {
  if (business.photo?.startsWith("https://")) return business.photo;
  const gallery = (business.photos ?? []).find((url) => url.startsWith("https://"));
  if (gallery) return gallery;
  const branch = (business.locations ?? []).find((row) => row.photo?.startsWith("https://"));
  return branch?.photo ?? null;
}

/** Keys the admin can leave a note on, in the order the review card shows them. */
export const BUSINESS_NOTE_FIELDS = ["name", "phone", "email", "description", "website", "instagram", "photo"] as const;
export const BRANCH_NOTE_FIELDS = ["address", "location", "services", "hours", "phone", "website", "instagram", "photo", "general"] as const;

export const FIELD_LABEL_KEY: Record<string, string> = {
  name: "business.name",
  phone: "business.phones",
  email: "business.email",
  description: "business.description",
  category: "business.category",
  city: "business.city",
  address: "business.address",
  timezone: "business.timezone",
  hours: "business.hours",
  website: "business.website",
  location: "branch.map_point",
  photo: "business.photo",
  instagram: "business.instagram",
  services: "branch.services",
  general: "review.general_note",
};

export function fieldLabelKey(field: string): string {
  const base = field.split(":")[0];
  return FIELD_LABEL_KEY[base] ?? base;
}
