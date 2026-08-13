import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './globals.css';

export const metadata: Metadata = {
  title: 'Luminae — Support client intelligent',
  description:
    'Plateforme de conversation client : bot RAG, escalade humaine, boîte de réception agent. Données hébergées en Union Européenne.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
