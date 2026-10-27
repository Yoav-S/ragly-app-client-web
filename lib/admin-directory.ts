import { CATEGORIES, type Business, type BusinessCategory } from "./business";

export type OwnershipFilter = "all" | "owned" | "unowned";
export type StatusFilter = Business["status"] | "all";

export type AdminDirectoryFilters = {
  status: StatusFilter;
  category: BusinessCategory | "all";
  ownership: OwnershipFilter;
  query: string;
  page: number;
};

const KEY = "ragly-admin-directory";

export const EMPTY_ADMIN_DIRECTORY: AdminDirectoryFilters = {
  status: "all",
  category: "all",
  ownership: "all",
  query: "",
  page: 1,
};

function isStatus(value: unknown): value is StatusFilter {
  return (
    value === "all" ||
    value === "draft" ||
    value === "pending_review" ||
    value === "published" ||
    value === "rejected" ||
    value === "suspended"
  );
}

function isCategory(value: unknown): value is BusinessCategory | "all" {
  return value === "all" || (typeof value === "string" && (CATEGORIES as readonly string[]).includes(value));
}

export function readAdminDirectoryFilters(): AdminDirectoryFilters {
  if (typeof window === "undefined") return { ...EMPTY_ADMIN_DIRECTORY };
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_ADMIN_DIRECTORY };
    const parsed = JSON.parse(raw) as Partial<AdminDirectoryFilters>;
    return {
      status: isStatus(parsed.status) ? parsed.status : "all",
      category: isCategory(parsed.category) ? parsed.category : "all",
      ownership: parsed.ownership === "owned" || parsed.ownership === "unowned" ? parsed.ownership : "all",
      query: typeof parsed.query === "string" ? parsed.query : "",
      page: typeof parsed.page === "number" && parsed.page > 0 ? parsed.page : 1,
    };
  } catch {
    return { ...EMPTY_ADMIN_DIRECTORY };
  }
}

export function writeAdminDirectoryFilters(next: Partial<AdminDirectoryFilters>) {
  if (typeof window === "undefined") return;
  const current = readAdminDirectoryFilters();
  window.sessionStorage.setItem(KEY, JSON.stringify({ ...current, ...next }));
}

export function clearAdminDirectoryFilters() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
