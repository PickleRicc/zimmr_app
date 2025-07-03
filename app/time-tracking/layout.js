'use client';

import MobileNavbar from '../components/MobileNavbar';
import { OnboardingMiddleware } from '../middleware';

// Layout wrapper for the time tracking section that includes auth protection
export default function TimeTrackingLayout({ children }) {
  return (
    <OnboardingMiddleware>
      <main>
        {children}
        <MobileNavbar />
      </main>
    </OnboardingMiddleware>
  );
}
