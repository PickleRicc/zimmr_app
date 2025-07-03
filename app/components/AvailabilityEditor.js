import React, { useState } from "react";

const defaultHours = [
  "9:00-17:00"
];

const daysOfWeek = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

export default function AvailabilityEditor({ availability, onChange }) {
  const [localAvailability, setLocalAvailability] = useState(
    availability || {
      monday: [...defaultHours],
      tuesday: [...defaultHours],
      wednesday: [...defaultHours],
      thursday: [...defaultHours],
      friday: [...defaultHours],
      saturday: [],
      sunday: []
    }
  );

  const handleInputChange = (day, idx, value) => {
    const updated = { ...localAvailability };
    updated[day][idx] = value;
    setLocalAvailability(updated);
    onChange && onChange(updated);
  };

  const handleAddSlot = (day) => {
    const updated = { ...localAvailability };
    updated[day] = [...updated[day], ""];
    setLocalAvailability(updated);
    onChange && onChange(updated);
  };

  const handleRemoveSlot = (day, idx) => {
    const updated = { ...localAvailability };
    updated[day] = updated[day].filter((_, i) => i !== idx);
    setLocalAvailability(updated);
    onChange && onChange(updated);
  };

  return (
    <div className="space-y-6 mt-4">
      {daysOfWeek.map((day) => (
        <div key={day} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="font-semibold capitalize mb-2">{day}</div>
          {localAvailability[day].length === 0 && (
            <div className="text-gray-400 text-sm mb-2">No availability</div>
          )}
          {localAvailability[day].map((slot, idx) => (
            <div key={idx} className="flex items-center mb-2">
              <input
                type="text"
                className="w-32 px-2 py-1 rounded border border-gray-300 mr-2"
                value={slot}
                onChange={e => handleInputChange(day, idx, e.target.value)}
                placeholder="e.g. 9:00-12:00"
              />
              <button
                type="button"
                className="text-[#ffcb00] text-xs px-2 py-1 hover:underline"
                onClick={() => handleRemoveSlot(day, idx)}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="mt-2 text-[#ffcb00] hover:underline text-xs"
            onClick={() => handleAddSlot(day)}
          >
            Add time slot
          </button>
        </div>
      ))}
    </div>
  );
}
