/**
 * ID Mapper Utility
 * Handles mapping between Supabase UUIDs and numeric database IDs
 */

import { supabase } from './supabase-client';

/**
 * Map of known Supabase user IDs to numeric craftsman IDs
 * This serves as a fallback when the user metadata doesn't contain the mapping
 */
const KNOWN_ID_MAPPINGS = {
  // Add any known mappings here in the format:
  // 'supabase-uuid': numeric_id
  '13f8af8f-367f-447e-b0f2-81abdf48bca0': 18,
  // Add more mappings as needed
};

/**
 * Get the numeric craftsman ID for a Supabase user
 * @param {Object} user - Supabase user object
 * @returns {Promise<number|null>} - Returns numeric craftsman ID or null if not found
 */
export const getNumericCraftsmanId = async (user) => {
  if (!user) return null;
  
  try {
    // First, check if the numeric ID is already in the user metadata
    const numericId = user.user_metadata?.numeric_craftsman_id;
    if (numericId && !isNaN(parseInt(numericId, 10))) {
      console.log('Found numeric craftsman ID in user metadata:', numericId);
      return parseInt(numericId, 10);
    }
    
    // Second, check if there's any craftsman ID in metadata that might be numeric
    const anyId = user.user_metadata?.craftsmanId || user.user_metadata?.craftsman_id;
    if (anyId && !isNaN(parseInt(anyId, 10)) && !String(anyId).includes('-')) {
      console.log('Found potentially numeric craftsman ID in metadata:', anyId);
      const parsedId = parseInt(anyId, 10);
      
      // Store this as the official numeric ID for future use
      await storeNumericCraftsmanId(user, parsedId);
      
      return parsedId;
    }
    
    // Third, check the hardcoded mappings
    if (KNOWN_ID_MAPPINGS[user.id]) {
      console.log('Using known ID mapping for user:', user.id, '->', KNOWN_ID_MAPPINGS[user.id]);
      
      // Store this mapping for future use
      await storeNumericCraftsmanId(user, KNOWN_ID_MAPPINGS[user.id]);
      
      return KNOWN_ID_MAPPINGS[user.id];
    }
    
    // If we reach here, we don't know the numeric ID
    console.error('Could not determine numeric craftsman ID for user:', user.id);
    return null;
  } catch (error) {
    console.error('Error getting numeric craftsman ID:', error);
    return null;
  }
};

/**
 * Store the numeric craftsman ID in the user's metadata
 * @param {Object} user - Supabase user object
 * @param {number} numericId - The numeric craftsman ID
 * @returns {Promise<boolean>} - True if successful, false if failed
 */
export const storeNumericCraftsmanId = async (user, numericId) => {
  if (!user || !numericId) return false;
  
  try {
    // Update user metadata with the numeric craftsman ID
    const { data, error } = await supabase.auth.updateUser({
      data: { numeric_craftsman_id: numericId }
    });
    
    if (error) {
      console.error('Error updating user metadata with numeric ID:', error);
      return false;
    }
    
    console.log('Successfully stored numeric craftsman ID in user metadata:', numericId);
    return true;
  } catch (err) {
    console.error('Exception updating user metadata:', err);
    return false;
  }
};
