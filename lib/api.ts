import { env } from "./env";

const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  retryAfterSec: number | null;
  code: string | null;

  constructor(
    status: number,
    retryAfterSec: number | null,
    code: string | null,
  ) {
    super(code ?? String(status));
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
    this.code = code;
  }
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${env.apiBaseUrl}${API_PREFIX}${normalized}`;
}

async function parseErrorCode(res: Response): Promise<string | null> {
  try {
    const json = (await res.json()) as { detail?: unknown };
    const detail = json.detail;
    if (
      detail &&
      typeof detail === "object" &&
      "code" in detail &&
      typeof detail.code === "string"
    ) {
      return detail.code;
    }
  } catch {
    return null;
  }
  return null;
}

function retryAfter(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (!raw) return null;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

async function request<T>(
  path: string,
  init: RequestInit,
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(buildUrl(path), { ...init, headers });
  if (!res.ok) {
    throw new ApiError(res.status, retryAfter(res), await parseErrorCode(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiPostPublic<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPost<T>(path: string, token: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) }, token);
}

export function apiGet<T>(path: string, token: string): Promise<T> {
  return request<T>(path, { method: "GET" }, token);
}

export function apiPatch<T>(path: string, token: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, token);
}

export function apiDelete(path: string, token: string): Promise<void> {
  return request<void>(path, { method: "DELETE" }, token);
}

export function apiUpload<T>(path: string, token: string, file: File): Promise<T> {
  const body = new FormData();
  body.append("file", file);
  return request<T>(path, { method: "POST", body }, token);
}

export function apiDeleteJson<T>(path: string, token: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "DELETE", body: JSON.stringify(body) }, token);
}

export type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  auth_provider: "email" | "google";
  email_verified: boolean;
  has_pets: boolean;
};
