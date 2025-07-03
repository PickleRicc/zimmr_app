'use client';

import MobileNavbar from '../components/MobileNavbar'; // assuming MobileNavbar is in this location
import { OnboardingMiddleware } from '../middleware';

export default function AppointmentsLayout({ children }) {
  return (
    <OnboardingMiddleware>
      {children}
      <MobileNavbar />
    </OnboardingMiddleware>
  );
}
