"use client";
import { usePathname } from "next/navigation";
import Navbar from "./layout/Navbar";
import BottomNav from "../components/BottomNav";
import { OnboardingMiddleware } from "../middleware";

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const hideNav = pathname === "/auth/login" || pathname === "/auth/register";
  const isAuthPage = pathname.startsWith('/auth/');

  // Apply middleware only on non-auth pages
  const content = isAuthPage ? children : (
    <OnboardingMiddleware>
      {children}
    </OnboardingMiddleware>
  );

  return (
    <>
      {!hideNav && <Navbar />}
      {content}
      {!hideNav && <BottomNav />}
    </>
  );
}
