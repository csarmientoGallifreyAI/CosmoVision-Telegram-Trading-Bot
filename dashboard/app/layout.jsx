import { Inter } from 'next/font/google';
import { AuthProvider } from '../components/auth-provider';
import '../app/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'CosmoVision Trading Dashboard',
  description: 'AI-powered trading analytics and signals for meme coins',
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body className={`${inter.className} bg-background text-foreground min-h-screen`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
