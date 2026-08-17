import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './globals.css';

export const metadata: Metadata = {
  title: 'Luminae — Support Client IA Souverain & Messagerie Pro',
  description:
    'Plateforme de conversation client : assistant IA sans hallucination, boîte de réception collaborative et escalade humaine en direct. Hébergement sécurisé en France / UE.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
