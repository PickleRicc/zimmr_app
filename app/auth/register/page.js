'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { craftsmenAPI } from '../../lib/api';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('craftsman');
  const [name, setName] = useState('');
  const router = useRouter();
  const { signUp } = useAuth();
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [craftsmanId, setCraftsmanId] = useState(null);
  const [token, setToken] = useState('');
  
  // Availability state
  const [availabilityHours, setAvailabilityHours] = useState({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  
  // Time slots for availability selection
  const timeSlots = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', 
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', 
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', 
    '18:00', '18:30', '19:00', '19:30', '20:00'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    // Validate required fields
    if (!firstName || !lastName) {
      setError('Vor- und Nachname sind erforderlich');
      return;
    }

    if (!phone) {
      setError('Telefonnummer ist erforderlich');
      return;
    }

    if (!specialty) {
      setError('Berufstitel ist erforderlich');
      return;
    }

    setLoading(true);

    try {
      // Generate username from first and last name
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
      // Full name for display
      const fullName = `${firstName} ${lastName}`;
      
      // Create user metadata object with all the required fields
      const userData = {
        full_name: fullName,
        username,
        phone,
        role,
        specialty: specialty || undefined,
        company_name: name || undefined
      };
      
      // Use Supabase auth via our context
      const { session, user } = await signUp(email, password, userData);
      
      if (role === 'craftsman') {
        if (session) {
          // User is already confirmed (auto-confirm enabled in Supabase)
          setCraftsmanId(user.id); // Use Supabase user ID directly
          setRegistrationComplete(true);
          setCurrentStep(2);
        } else {
          // Email confirmation needed
          router.push('/auth/login?registered=true&confirmation=required');
        }
      } else {
        // For customers, just redirect to login
        router.push('/auth/login?registered=true');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registrierung fehlgeschlagen. Bitte versuche es später erneut.');
      setLoading(false);
    }
  };
  
  // Availability management functions
  const handleAddTimeSlot = (day) => {
    setAvailabilityHours(prev => ({
      ...prev,
      [day]: [...prev[day], '06:00-20:00']
    }));
  };

  const handleRemoveTimeSlot = (day, index) => {
    setAvailabilityHours(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index)
    }));
  };

  const handleTimeSlotChange = (day, index, type, value) => {
    const updatedSlots = [...availabilityHours[day]];
    const [start, end] = updatedSlots[index].split('-');
    
    if (type === 'start') {
      updatedSlots[index] = `${value}-${end}`;
    } else {
      updatedSlots[index] = `${start}-${value}`;
    }
    
    setAvailabilityHours(prev => ({
      ...prev,
      [day]: updatedSlots
    }));
  };

  const handleSaveAvailability = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await craftsmenAPI.update(craftsmanId, { 
        availability_hours: availabilityHours 
      });
      
      // Mark onboarding as completed and clear the new registration flag
      localStorage.setItem('onboardingCompleted', 'true');
      localStorage.removeItem('isNewRegistration');
      
      setSuccess('Ihre Verfügbarkeit wurde erfolgreich gespeichert!');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Error saving availability:', err);
      setError('Fehler beim Speichern Ihrer Verfügbarkeit. Bitte versuchen Sie es erneut.');
    } finally {
      setSaving(false);
    }
  };
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = {
    monday: 'Montag',
    tuesday: 'Dienstag',
    wednesday: 'Mittwoch',
    thursday: 'Donnerstag',
    friday: 'Freitag',
    saturday: 'Samstag',
    sunday: 'Sonntag'
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#121212] to-[#1a1a1a] px-5 py-10 overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5">
          <div className="absolute top-10 left-10 w-72 h-72 bg-[#ffcb00] rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-[#ffcb00] rounded-full filter blur-3xl"></div>
        </div>
      </div>
      
      <div className="w-full max-w-md z-10 animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="text-[#ffcb00]">ZIMMR</span>
          </h1>
          <p className="text-white text-lg font-light">
            {currentStep === 1 ? 'Konto erstellen' : 'Verfügbarkeit festlegen'}
          </p>
        </div>
        
        <div className="bg-black/70 backdrop-blur-md rounded-2xl shadow-xl border border-[#2a2a2a] overflow-hidden">
          {error && (
            <div className="m-6 p-4 bg-red-100/90 backdrop-blur-sm text-red-700 rounded-xl border border-red-200/50 shadow-lg animate-slide-up">
              {error}
            </div>
          )}
          
          {success && (
            <div className="m-6 p-4 bg-green-100/90 backdrop-blur-sm text-green-700 rounded-xl border border-green-200/50 shadow-lg animate-slide-up">
              {success}
            </div>
          )}
          
          {currentStep === 1 && (
            <div className="p-6 md:p-8">
              <div className="mb-6">
                {/* Customer/Craftsman toggle removed as app is only for Craftsmen */}
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="firstName" className="block text-sm font-medium text-white mb-1">
                      Vorname <span className="text-[#00c2ff]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="block w-full p-3 pl-3 bg-[#2a2a2a]/50 border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                        placeholder="Vorname"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label htmlFor="lastName" className="block text-sm font-medium text-white mb-1">
                      Nachname <span className="text-[#00c2ff]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="block w-full p-3 pl-3 bg-[#2a2a2a]/50 border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                        placeholder="Nachname"
                        required
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="email" className="block text-sm font-medium text-white mb-1">
                    E-Mail <span className="text-[#00c2ff]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-[-1]">
                      <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 bg-[#2a2a2a]/50 border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="phone" className="block text-sm font-medium text-white mb-1">
                    Telefonnummer <span className="text-[#00c2ff]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-[-1]">
                      <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                      </svg>
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 bg-[#2a2a2a]/50 border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                      placeholder="+49 123 456 7890"
                      required
                    />
                  </div>
                </div>
                
                {role === 'craftsman' && (
                  <div className="space-y-1">
                    <label htmlFor="specialty" className="block text-sm font-medium text-white mb-1">
                      Berufstitel <span className="text-[#00c2ff]">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-[-1]">
                        <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                      </div>
                      <input
                        id="specialty"
                        type="text"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="block w-full pl-12 pr-4 py-3.5 bg-[#2a2a2a]/50 border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                        placeholder="Ihr Berufstitel (z.B. Fliesenleger, Elektriker)"
                        required
                      />
                    </div>
                  </div>
                )}
                
                {role === 'customer' && (
                  <div className="space-y-1">
                    <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                      Firmenname (Optional)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-[-1]">
                        <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                        </svg>
                      </div>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full pl-12 pr-4 py-3.5 bg-[#2a2a2a]/50 border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                        placeholder="Ihr Unternehmen (falls zutreffend)"
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-1">
                  <label htmlFor="password" className="block text-sm font-medium text-white mb-1">
                    Passwort <span className="text-[#00c2ff]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-[-1]">
                      <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                      </svg>
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 bg-[#2a2a2a]/50 border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-1">
                    Passwort bestätigen <span className="text-[#00c2ff]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-[-1]">
                      <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                      </svg>
                    </div>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-12 pr-4 py-3.5 bg-[#2a2a2a]/50 border border-[#2a2a2a] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 mt-6 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ffcb00] transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Registrierung...</span>
                    </div>
                  ) : (
                    'Konto erstellen'
                  )}
                </button>
              </form>
            </div>
          )}
          
          {currentStep === 2 && (
            <div className="p-6 md:p-8">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Ihre Arbeitszeiten</h2>
                <p className="text-white text-sm">Legen Sie Ihre regelmäßigen Arbeitszeiten für jeden Wochentag fest.</p>
                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {days.map((day) => (
                    <div key={day} className="bg-white/10 backdrop-blur-sm p-5 rounded-xl border border-white/20 space-y-3 transition-all hover:bg-white/15">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-white">{dayLabels[day]}</h3>
                        <button
                          type="button"
                          onClick={() => handleAddTimeSlot(day)}
                          className="text-[#00c2ff] hover:text-white text-sm flex items-center transition-colors"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                          </svg>
                          Zeitraum hinzufügen
                        </button>
                      </div>
                      
                      {availabilityHours[day].length === 0 ? (
                        <p className="text-white/50 italic text-sm">Nicht verfügbar</p>
                      ) : (
                        availabilityHours[day].map((timeSlot, index) => {
                          const [start, end] = timeSlot.split('-');
                          return (
                            <div key={index} className="flex items-center mb-3 space-x-2 bg-white/10 p-2 rounded-lg">
                              <div className="relative flex-1">
                                <select
                                  value={start}
                                  onChange={(e) => handleTimeSlotChange(day, index, 'start', e.target.value)}
                                  className="w-full p-2 border border-[#2a2a2a] rounded-lg bg-[#2a2a2a]/50 text-white appearance-none pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                                >
                                  {timeSlots.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                  <svg className="h-4 w-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                  </svg>
                                </div>
                              </div>
                              
                              <span className="text-white">bis</span>
                              
                              <div className="relative flex-1">
                                <select
                                  value={end}
                                  onChange={(e) => handleTimeSlotChange(day, index, 'end', e.target.value)}
                                  className="w-full p-2 border border-[#2a2a2a] rounded-lg bg-[#2a2a2a]/50 text-white appearance-none pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-all duration-200 relative z-10"
                                >
                                  {timeSlots.map(time => (
                                    <option key={time} value={time}>{time}</option>
                                  ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                  <svg className="h-4 w-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                  </svg>
                                </div>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => handleRemoveTimeSlot(day, index)}
                                className="text-white/70 hover:text-red-400 p-1 rounded-full hover:bg-white/10 transition-colors"
                                aria-label="Zeitraum entfernen"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between space-x-3 pt-6 mt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-3 border border-white/20 text-white rounded-xl hover:bg-white/10 transition-all duration-200"
                >
                  Später überspringen
                </button>
                <button
                  type="button"
                  onClick={handleSaveAvailability}
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-[#0070f3] to-[#0050d3] hover:from-[#0060df] hover:to-[#0040c0] text-white font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070f3] transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  {saving ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Speichern...</span>
                    </div>
                  ) : (
                    'Registrierung abschließen'
                  )}
                </button>
              </div>
            </div>
          )}
          
          <div className="px-6 md:px-8 pb-6 md:pb-8 pt-2 text-center">
            <p className="text-sm text-white">
              Sie haben bereits ein Konto?{' '}
              <a href="/auth/login" className="text-[#00c2ff] hover:text-white transition-colors font-medium">
                Hier anmelden
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
