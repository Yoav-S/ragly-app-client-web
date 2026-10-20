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

export type TimeSlot = { open: string; close: string };

export type OpeningHours = {
  /** False when the business has no hours to publish. */
  provided: boolean;
  always_open: boolean;
  mon: TimeSlot[];
  tue: TimeSlot[];
  wed: TimeSlot[];
  thu: TimeSlot[];
  fri: TimeSlot[];
  sat: TimeSlot[];
  sun: TimeSlot[];
};

export type GeoLocation = {
  type: "Point";
  coordinates: [number, number];
};

export type MemberRole = "owner" | "branch_owner" | "lead" | "worker";

export type StoreLocation = {
  id: string;
  business_id: string;
  address: string;
  city: string;
  timezone: string;
  opening_hours: OpeningHours;
  location: GeoLocation;
  phone: string[];
  status?: "pending_review" | "published" | "rejected";
  rejection_reason?: string | null;
  reviewed_at?: string | null;
};

export type StoreReview = {
  id: string;
  business_id: string;
  business_name: string;
  address: string;
  city: string;
  phone: string[];
  opening_hours: OpeningHours;
  status: "pending_review" | "published" | "rejected";
  rejection_reason: string | null;
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
  category: BusinessCategory;
  city: string;
  status: "pending_review" | "published" | "rejected" | "suspended";
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
  rejection_reason: string | null;
  field_errors: Record<string, string>;
  admin_notes?: Record<string, string>;
  reviewed_at?: string | null;
  submitted_at?: string | null;
  invitations: Invitation[];
  locations?: StoreLocation[];
};

export type BusinessMembership = {
  business: Business;
  role: MemberRole;
  location_id: string | null;
};

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

export type BusinessCounts = {
  pending: number;
  published: number;
  rejected: number;
  deleted: number;
};

export type BusinessPage = {
  items: Business[];
  has_more: boolean;
};

export type BusinessSession = {
  is_ragly_admin: boolean;
  business: Business | null;
  businesses?: BusinessMembership[];
  role: MemberRole | null;
  invitations: Invitation[];
};

export type BusinessSubmit = {
  name: string;
  phone: string[];
  email: string | null;
  description: string | null;
  category: BusinessCategory;
  city: string;
  address: string;
  timezone: string;
  opening_hours: OpeningHours;
  website: string | null;
  location: GeoLocation;
  photo: string | null;
  instagram: string | null;
};
