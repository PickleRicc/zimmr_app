import './globals.css';
import MobileNavbar from './components/MobileNavbar';
import { AuthProvider } from '../contexts/AuthContext';

export const metadata = {
  title: 'Extern App',
  description: 'Extern Application for Craftsmen in Germany',
};

export default function RootLayout({ children }) {
  // MobileNavbar hides itself on /auth routes, so always render here
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
