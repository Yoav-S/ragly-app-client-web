import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { auth } from "./firebase";

export async function uploadBusinessPhoto(file: File): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("unauthorized");
  }
  const safeName = file.name.replace(/[^\w.]+/g, "-");
  const storageRef = ref(
    getStorage(),
    `users/${user.uid}/business/${Date.now()}-${safeName}`,
  );
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(storageRef);
}
