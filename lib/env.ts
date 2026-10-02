function setting(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || fallback;
}

/** Public website config. A local env value overrides the live default. */
const publicConfig = {
  apiBaseUrl: "https://petto-server-326582782489.europe-west1.run.app",
  firebase: {
    apiKey: "AIzaSyCLL2nVmqiF8de16mAP4KSNtGwx1fmM5d4",
    authDomain: "petto-494013.firebaseapp.com",
    projectId: "petto-494013",
    storageBucket: "petto-494013.firebasestorage.app",
    messagingSenderId: "326582782489",
    appId: "1:326582782489:web:1fdca225784eb3a2edf888",
  },
};

export const env = {
  apiBaseUrl: setting(
    process.env.NEXT_PUBLIC_API_BASE_URL,
    publicConfig.apiBaseUrl,
  ).replace(/\/$/, ""),
  firebase: {
    apiKey: setting(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      publicConfig.firebase.apiKey,
    ),
    authDomain: setting(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      publicConfig.firebase.authDomain,
    ),
    projectId: setting(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      publicConfig.firebase.projectId,
    ),
    storageBucket: setting(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      publicConfig.firebase.storageBucket,
    ),
    messagingSenderId: setting(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      publicConfig.firebase.messagingSenderId,
    ),
    appId: setting(
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      publicConfig.firebase.appId,
    ),
  },
};
