import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PuffPaw User Portal',
  description: 'Access your encrypted vaping data with privacy-first technology',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


