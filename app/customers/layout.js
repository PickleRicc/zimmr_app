'use client';

import MobileNavbar from '../components/MobileNavbar';
import { OnboardingMiddleware } from '../middleware';

export default function CustomersLayout({ children }) {
  return (
    <OnboardingMiddleware>
      <>
        {children}
        <MobileNavbar />
      </>
    </OnboardingMiddleware>
  );
}
