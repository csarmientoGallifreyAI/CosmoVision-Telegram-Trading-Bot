import './globals.css';
import { AuthProvider } from '../components/auth-provider';

export const metadata = {
  title: 'CosmoVision Trading Dashboard',
  description: 'Advanced meme coin trading dashboard for the CosmoVision bot',
};

export default function RootLayout({ children }) {
  return (
    <html lang='en' className='dark'>
      <body className='cyber-dashboard'>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
