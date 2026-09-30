import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Rubik } from "next/font/google";
import { Providers } from "./providers";
import { isLocale, type AppLocale } from "@/lib/locale";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew", "cyrillic"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "Ragly for Business",
  description:
    "Publish your pet business on Ragly. Pet owners find you in the app after review.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const saved = jar.get("ragly_locale")?.value;
  const locale: AppLocale = isLocale(saved) ? saved : "en";

  return (
    <html
      lang={locale}
      dir={locale === "he" ? "rtl" : "ltr"}
      className={`${rubik.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
