import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teaching Agent SMIT — Learn technology intelligently",
  description: "Independent AI learning workspace for tutoring, programming, lessons, quizzes and personal roadmaps.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
