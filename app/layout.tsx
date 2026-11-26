import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yeewu Radar — veille médias pour les marques au Sénégal",
  description: "Ce que la presse sénégalaise dit de votre marque et de vos concurrents, chaque jour.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
