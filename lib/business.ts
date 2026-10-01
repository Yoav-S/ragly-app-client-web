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
  owner_uid: string | null;
  owner_email: string | null;
  owned: boolean;
  instagram: string | null;
  rejection_reason: string | null;
};

export type BusinessSession = {
  is_ragly_admin: boolean;
  business: Business | null;
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
