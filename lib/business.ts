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

export type Business = {
  id: string;
  owner_uid: string | null;
  owner_email: string;
  name: string;
  phones: string[];
  email: string | null;
  description: string | null;
  category: BusinessCategory;
  city: string;
  status: "pending_review" | "published" | "rejected" | "suspended";
  address: string;
  timezone: string;
  opening_hours: OpeningHours;
  website: string | null;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  instagram: string | null;
  rejection_reason: string | null;
};

export type BusinessSession = {
  is_ragly_admin: boolean;
  business: Business | null;
};

export type BusinessSubmit = {
  name: string;
  phones: string[];
  email: string | null;
  description: string | null;
  category: BusinessCategory;
  city: string;
  address: string;
  timezone: string;
  opening_hours: OpeningHours;
  website: string | null;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  instagram: string | null;
};
