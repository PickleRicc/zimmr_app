"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthedFetch } from "../../lib/utils/useAuthedFetch";
import Header from "../components/Header";
import { useRequireAuth } from "../../lib/utils/useRequireAuth";

// Accent color used across the app
const ACCENT = "#ffcb00";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const authedFetch = useAuthedFetch();

  /* ---------------- state ---------------- */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    specialty: "",
  });

  const [availabilityHours, setAvailabilityHours] = useState({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  });

  /* ------------- data fetch ------------- */
  useEffect(() => {
    if (authLoading || !user) return;

    (async () => {
      try {
        const res = await authedFetch("/api/profile");
        
        if (!res.ok) {
          // Try to extract error message from standardized response
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.message || `HTTP Error ${res.status}`);
        }
        
        // Handle standardized API response format
        const responseData = await res.json();
        
        // Extract data, supporting both new standardized and legacy formats
        const data = responseData.data !== undefined ? responseData.data : responseData;
        
        // Log any API message
        if (responseData.message) {
          console.log('Profile API Message:', responseData.message);
        }
        
        populate(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load your profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  const populate = (data) => {
    if (!data) return;
    setForm({
      name: data.name || "",
      phone: data.phone || "",
      specialty: data.specialty || "",
    });
    if (data.availability_hours) {
      setAvailabilityHours({
        monday: data.availability_hours.monday || [],
        tuesday: data.availability_hours.tuesday || [],
        wednesday: data.availability_hours.wednesday || [],
        thursday: data.availability_hours.thursday || [],
        friday: data.availability_hours.friday || [],
        saturday: data.availability_hours.saturday || [],
        sunday: data.availability_hours.sunday || [],
      });
    }
  };

  /* ------------- handlers ------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = { ...form, availability_hours: availabilityHours };
      const res = await authedFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        // Try to extract error message from standardized response
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP Error ${res.status}`);
      }
      
      // Handle standardized API response format
      const responseData = await res.json();
      
      // Use API message for success feedback if available
      const successMessage = responseData.message || "Profile saved!";
      setSuccess(successMessage);
      
      // Update profile data if returned in the response
      if (responseData.data) {
        populate(responseData.data);
      }
      
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ------------- UI parts ------------- */
  const TabButton = ({ id, children }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
        activeTab === id ? `bg-[${ACCENT}] text-black` : "text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
        <span className="text-white">Loading…</span>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Profile Settings</h1>

        {/* Tabs */}
        <div className="flex bg-white/5 rounded-lg mb-8 overflow-hidden">
          <TabButton id="details">Details</TabButton>
          <TabButton id="availability">Availability</TabButton>
          <TabButton id="security">Security</TabButton>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/20 text-red-400 rounded">{error}</div>
        )}
        {success && (
          <div className="mb-6 p-3 bg-green-500/20 text-green-400 rounded">{success}</div>
        )}

        {/* --------------- Details Tab --------------- */}
        {activeTab === "details" && (
          <div className="space-y-6 bg-white/5 p-6 rounded-lg border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Display Name" name="name" value={form.name} onChange={handleChange} />
              <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} />
              <Field
                label="Specialty"
                name="specialty"
                value={form.specialty}
                onChange={handleChange}
                className="md:col-span-2"
              />
              <Field label="Email" value={user?.email || ""} disabled />
            </div>
            <div className="text-right">
              <SaveButton onClick={handleSave} saving={saving} />
            </div>
          </div>
        )}

        {/* --------------- Availability Tab --------------- */}
        {activeTab === "availability" && (
          <div className="bg-white/5 p-6 rounded-lg border border-white/10">
            <p className="text-white/70 mb-4">
              Quick JSON editor for now — replace with slot picker later.
            </p>
            <textarea
              className="w-full h-60 p-3 rounded bg-black/50 text-white text-sm font-mono"
              value={JSON.stringify(availabilityHours, null, 2)}
              onChange={(e) => {
                try {
                  const obj = JSON.parse(e.target.value);
                  setAvailabilityHours(obj);
                } catch (_) {}
              }}
            />
            <div className="text-right mt-4">
              <SaveButton onClick={handleSave} saving={saving} />
            </div>
          </div>
        )}

        {/* --------------- Security Tab --------------- */}
        {activeTab === "security" && (
          <div className="bg-white/5 p-6 rounded-lg border border-white/10 space-y-4 text-white/90">
            <p>Use the <span className="text-[${ACCENT}]">Reset Password</span> link on the login page to change your password.</p>
            <button
              className="px-4 py-2 rounded bg-transparent border border-white hover:bg-white/10"
              onClick={() => router.push("/auth/reset-password")}
            >
              Go to Reset Password
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

/* ---------------- Reusable sub-components ---------------- */
function Field({ label, name, value, onChange, disabled = false, className = "" }) {
  return (
    <label className={`space-y-1 block ${className}`}>
      <span className="block text-sm font-medium text-white/80">{label}</span>
      <input
        name={name}
        value={value}
        disabled={disabled}
        onChange={onChange}
        className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00] disabled:opacity-60"
      />
    </label>
  );
}


function SaveButton({ onClick, saving }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-6 py-2 rounded bg-[#ffcb00] text-black font-medium disabled:opacity-50"
    >
      {saving ? "Saving…" : "Save"}
    </button>
  );
}


