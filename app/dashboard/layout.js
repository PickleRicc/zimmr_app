'use client';

import Header from '../components/Header';
import MobileNavbar from '../components/MobileNavbar';
import { OnboardingMiddleware } from '../middleware';

export default function DashboardLayout({ children }) {
  return (
    <OnboardingMiddleware>
      <>
        <Header />
        {children}
        <MobileNavbar />
      </>
    </OnboardingMiddleware>
  );
}
