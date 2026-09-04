import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PulseWatch | Personal Market Memory',
  description: 'Know what changed while you were away. Your market memory, distilled.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f19] text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
