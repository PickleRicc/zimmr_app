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

  const [pdfSettings, setPdfSettings] = useState({
    // Company Details
    company_name: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    // Tax Info
    tax_id: "",
    vat_id: "",
    ceo_name: "",
    // Bank Details
    bank_name: "",
    iban: "",
    bic: "",
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
        setError(err.message || "Fehler beim Laden Ihres Profils.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  const populate = (data) => {
    if (!data) return;
    console.log('Populating profile data:', data);
    console.log('PDF Settings from DB:', data.pdf_settings);
    
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
    // Load PDF settings (handle both null and empty object)
    const pdfData = data.pdf_settings || {};
    console.log('Setting PDF state to:', pdfData);
    setPdfSettings({
      company_name: pdfData.company_name || "",
      company_address: pdfData.company_address || "",
      company_phone: pdfData.company_phone || "",
      company_email: pdfData.company_email || "",
      tax_id: pdfData.tax_id || "",
      vat_id: pdfData.vat_id || "",
      ceo_name: pdfData.ceo_name || "",
      bank_name: pdfData.bank_name || "",
      iban: pdfData.iban || "",
      bic: pdfData.bic || "",
    });
  };

  /* ------------- handlers ------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePdfSettingsChange = (e) => {
    const { name, value } = e.target;
    setPdfSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = { 
        ...form, 
        availability_hours: availabilityHours,
        pdf_settings: pdfSettings 
      };
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
      const successMessage = responseData.message || "Profil gespeichert!";
      setSuccess(successMessage);
      
      // Update profile data if returned in the response
      if (responseData.data) {
        populate(responseData.data);
      }
      
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  /* ------------- UI parts ------------- */
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
        <span className="text-white">Lädt…</span>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Profil-Einstellungen</h1>
          <p className="text-white/60 mb-8">Verwalten Sie Ihre persönlichen Daten und PDF-Einstellungen</p>

          {error && (
            <div className="mb-6 p-3 bg-red-500/20 text-red-400 rounded">{error}</div>
          )}
          {success && (
            <div className="mb-6 p-3 bg-green-500/20 text-green-400 rounded">{success}</div>
          )}

          <div className="space-y-6">
            {/* Personal Details Section */}
            <div className="bg-white/5 p-6 rounded-lg border border-white/10">
              <h2 className="text-2xl font-semibold text-white mb-4">Persönliche Daten</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Anzeigename" name="name" value={form.name} onChange={handleChange} />
                <Field label="Telefon" name="phone" value={form.phone} onChange={handleChange} />
                <Field
                  label="Fachgebiet"
                  name="specialty"
                  value={form.specialty}
                  onChange={handleChange}
                  className="md:col-span-2"
                />
                <Field label="E-Mail" value={user?.email || ""} disabled />
              </div>
            </div>

            {/* PDF Settings - Company Details */}
            <div className="bg-white/5 p-6 rounded-lg border border-white/10">
              <h2 className="text-2xl font-semibold text-white mb-2">PDF-Einstellungen</h2>
              <p className="text-white/60 text-sm mb-6">
                Diese Informationen erscheinen auf Ihren Rechnungen und Angeboten
              </p>
              
              <h3 className="text-lg font-semibold text-white mb-4">Firmendetails</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Field 
                  label="Firmenname" 
                  name="company_name" 
                  value={pdfSettings.company_name} 
                  onChange={handlePdfSettingsChange} 
                  className="md:col-span-2"
                />
                <Field 
                  label="Adresse" 
                  name="company_address" 
                  value={pdfSettings.company_address} 
                  onChange={handlePdfSettingsChange} 
                  className="md:col-span-2"
                />
                <Field 
                  label="Telefon" 
                  name="company_phone" 
                  value={pdfSettings.company_phone} 
                  onChange={handlePdfSettingsChange} 
                />
                <Field 
                  label="E-Mail" 
                  name="company_email" 
                  value={pdfSettings.company_email} 
                  onChange={handlePdfSettingsChange} 
                />
              </div>

              <h3 className="text-lg font-semibold text-white mb-4">Steuerinformationen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Field 
                  label="Steuernummer" 
                  name="tax_id" 
                  value={pdfSettings.tax_id} 
                  onChange={handlePdfSettingsChange} 
                />
                <Field 
                  label="USt-IdNr. (optional)" 
                  name="vat_id" 
                  value={pdfSettings.vat_id} 
                  onChange={handlePdfSettingsChange} 
                />
                <Field 
                  label="Geschäftsführer / Inhaber" 
                  name="ceo_name" 
                  value={pdfSettings.ceo_name} 
                  onChange={handlePdfSettingsChange} 
                  className="md:col-span-2"
                />
              </div>

              <h3 className="text-lg font-semibold text-white mb-4">Bankverbindung</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field 
                  label="Bankname" 
                  name="bank_name" 
                  value={pdfSettings.bank_name} 
                  onChange={handlePdfSettingsChange} 
                  className="md:col-span-2"
                />
                <Field 
                  label="IBAN" 
                  name="iban" 
                  value={pdfSettings.iban} 
                  onChange={handlePdfSettingsChange} 
                />
                <Field 
                  label="BIC" 
                  name="bic" 
                  value={pdfSettings.bic} 
                  onChange={handlePdfSettingsChange} 
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <SaveButton onClick={handleSave} saving={saving} />
            </div>
          </div>
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
      {saving ? "Speichern…" : "Speichern"}
    </button>
  );
}


