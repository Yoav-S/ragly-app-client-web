import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { env } from "./env";

const app = getApps().length === 0 ? initializeApp(env.firebase) : getApp();

export const auth = getAuth(app);
