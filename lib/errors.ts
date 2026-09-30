import { ApiError } from "./api";

type Translate = (key: string) => string;

export function errorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.code) {
      const key = `errors.${error.code}`;
      const message = t(key);
      if (message !== key) {
        if (error.retryAfterSec) {
          return `${message} (${error.retryAfterSec}s)`;
        }
        return message;
      }
    }
    if (error.status === 429) return t("errors.otp_resend_cooldown");
    if (error.status >= 500) return t("errors.check_connection");
    return t("errors.generic");
  }
  if (error instanceof Error && error.message === "firebase_signin_failed") {
    return t("errors.firebase_signin_failed");
  }
  return t("errors.check_connection");
}
