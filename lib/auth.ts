import { signInWithCustomToken, signOut } from "firebase/auth";
import { apiPost, apiPostPublic, type UserProfile } from "./api";
import { auth } from "./firebase";

const PENDING_EMAIL_KEY = "ragly.pendingEmail";
const AUTH_INTENT_KEY = "ragly.authIntent";
const TAB_SIGN_IN_KEY = "ragly.tabSignedIn";

export type AuthIntent = "login" | "register";

export function setPendingAuth(email: string, intent: AuthIntent): void {
  sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  sessionStorage.setItem(AUTH_INTENT_KEY, intent);
}

export function getPendingEmail(): string | null {
  return sessionStorage.getItem(PENDING_EMAIL_KEY);
}

export function getAuthIntent(): AuthIntent {
  return sessionStorage.getItem(AUTH_INTENT_KEY) === "register"
    ? "register"
    : "login";
}

export function clearPendingAuth(): void {
  sessionStorage.removeItem(PENDING_EMAIL_KEY);
  sessionStorage.removeItem(AUTH_INTENT_KEY);
}

export async function sendOtp(email: string, locale: string): Promise<void> {
  await apiPostPublic("/auth/send-otp", { email, locale });
}

export async function resendOtp(email: string, locale: string): Promise<void> {
  await apiPostPublic("/auth/resend-otp", { email, locale });
}

export async function verifyOtpAndSignIn(
  email: string,
  otp: string,
): Promise<UserProfile> {
  const { custom_token } = await apiPostPublic<{ custom_token: string }>(
    "/auth/verify-otp",
    { email, otp },
  );
  await signInWithCustomToken(auth, custom_token);
  sessionStorage.setItem(TAB_SIGN_IN_KEY, "1");
  clearPendingAuth();
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("firebase_signin_failed");
  }
  return apiPost<UserProfile>("/users/me", token, {});
}

export function signedInThisTab(): boolean {
  try {
    return sessionStorage.getItem(TAB_SIGN_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export async function signOutAccount(): Promise<void> {
  try {
    sessionStorage.removeItem(TAB_SIGN_IN_KEY);
  } catch {
    // Private mode can block storage. Signing out of Firebase still ends the session.
  }
  await signOut(auth);
}
