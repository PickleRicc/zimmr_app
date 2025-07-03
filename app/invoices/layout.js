'use client';

import MobileNavbar from '../components/MobileNavbar';
import { OnboardingMiddleware } from '../middleware';

export default function InvoicesLayout({ children }) {
  return (
    <OnboardingMiddleware>
      <>
        {children}
        <MobileNavbar />
      </>
    </OnboardingMiddleware>
  );
}
