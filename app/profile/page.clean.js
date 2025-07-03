"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuthedFetch from "../../lib/utils/useAuthedFetch";
import useRequireAuth from "../../lib/utils/useRequireAuth";

/**
 * Clean, compile-ready replacement for the Profile page.
 * It removes all legacy token / craftsmanId parsing and relies exclusively on:
 *  • useRequireAuth – to gate unauthenticated users
 *  • useAuthedFetch – to hit `/api/profile` with the user JWT attached
 *
 * The UI is intentionally minimal (single form) – replace / extend as needed.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const authedFetch = useAuthedFetch();

  /* ---------------------- state ---------------------- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userDetails, setUserDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    specialty: "",
  });

  // availability_hours structure: { monday: ["09:00","12:00"], ... }
  const [availabilityHours, setAvailabilityHours] = useState({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  });

  /* ------------------ data fetch / populate ------------------ */
  useEffect(() => {
    if (authLoading || !user) return;

    const fetchProfile = async () => {
      try {
        const res = await authedFetch("/api/profile");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        populateProfile(data);
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load your profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [authLoading, user]);

  const populateProfile = (data) => {
    if (!data) return;

    if (data.user) {
      setUserDetails({
        firstName: data.user.first_name || "",
        lastName: data.user.last_name || "",
        email: data.user.email || "",
        phone: data.phone || "",
        specialty: data.specialty || "",
      });
    }

    if (data.availability_hours && Object.keys(data.availability_hours).length > 0) {
      setAvailabilityHours((prev) => ({
        ...prev,
        ...data.availability_hours,
        saturday: data.availability_hours.saturday || [],
        sunday: data.availability_hours.sunday || [],
      }));
    }
  };

  /* ----------------------- handlers ----------------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");
      setLoading(true);

      const payload = {
        phone: userDetails.phone,
        specialty: userDetails.specialty,
        availability_hours: availabilityHours,
      };

      const res = await authedFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      setSuccess("Profile saved!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------- UI ------------------------- */
  if (authLoading || loading) {
    return <p className="p-4">Loading…</p>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>{error}</p>
        <button
          className="underline"
          onClick={() => router.refresh?.() || router.reload?.()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Your Profile</h1>

      {/* --- basic details --- */}
      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium">First Name</span>
          <input
            type="text"
            name="firstName"
            value={userDetails.firstName}
            onChange={handleChange}
            className="input"
            disabled
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Last Name</span>
          <input
            type="text"
            name="lastName"
            value={userDetails.lastName}
            onChange={handleChange}
            className="input"
            disabled
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Email</span>
          <input
            type="email"
            name="email"
            value={userDetails.email}
            onChange={handleChange}
            className="input"
            disabled
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Phone</span>
          <input
            type="tel"
            name="phone"
            value={userDetails.phone}
            onChange={handleChange}
            className="input"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Specialty</span>
          <input
            type="text"
            name="specialty"
            value={userDetails.specialty}
            onChange={handleChange}
            className="input"
          />
        </label>
      </div>

      {/* Availability editing UI stub */}
      <details className="border p-4 rounded">
        <summary className="cursor-pointer">Availability (weekly)</summary>
        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{JSON.stringify(availabilityHours, null, 2)}
        </pre>
        <p className="text-sm text-gray-500 mt-1">
          Editing UI for availability slots can be inserted here.
        </p>
      </details>

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        disabled={loading}
      >
        Save Profile
      </button>

      {success && <p className="text-green-600">{success}</p>}
    </div>
  );
}

/* ------------------ simple Tailwindish input class ------------------ */
// If you are not using Tailwind, swap this with your preferred styling.
const inputClass =
  "mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100";

export const input = inputClass;
