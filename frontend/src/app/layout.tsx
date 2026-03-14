import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TurfBook — Elite Cricket & Sports Turf Booking',
  description: 'Book premium cricket turfs and sports facilities near you instantly. Professional pitches, night sessions, and seamless booking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
          <Toaster position="top-right" toastOptions={{
            style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(99,255,99,0.2)' }
          }} />
        </AuthProvider>
      </body>
    </html>
  );
}
