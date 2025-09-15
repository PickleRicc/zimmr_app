'use client';

import MobileNavbar from '../components/MobileNavbar';
import { OnboardingMiddleware } from '../middleware';

export default function NotesLayout({ children }) {
  return (
    <OnboardingMiddleware>
      <>
        {children}
        <MobileNavbar />
      </>
    </OnboardingMiddleware>
  );
}
