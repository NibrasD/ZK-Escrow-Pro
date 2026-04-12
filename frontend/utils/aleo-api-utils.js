import { ALEO_API } from './contract_code';

/**
 * Fetches the current latest block height from the Aleo network.
 */
export async function getLatestBlockHeight() {
  try {
    const res = await fetch(`${ALEO_API}/latest/height`);
    if (res.ok) {
      const height = await res.text();
      return parseInt(height);
    }
  } catch (err) {
    console.error("Failed to fetch block height:", err);
  }
  return null;
}

/**
 * Fetches the value of a specific key in a mapping.
 */
export async function getMappingValue(programId, mappingName, key) {
  try {
    const res = await fetch(`${ALEO_API}/program/${programId}/mapping/${mappingName}/${key}`);
    if (res.ok) {
      const value = await res.text();
      return value.replace(/"/g, ''); // Remove quotes
    }
  } catch (err) {
    console.error(`Failed to fetch mapping ${mappingName} for key ${key}:`, err);
  }
  return null;
}

/**
 * Parses a Leo struct string into a Javascript object.
 */
export function parseLeoStruct(structStr) {
  const obj = {};
  // Broad regex to handle both key: value and key = value formats
  const regex = /"?(\w+)"?\s*[:=]\s*"?([a-zA-Z0-9_.]+)"?/g;
  let match;
  while ((match = regex.exec(structStr)) !== null) {
    let val = match[2];
    // Clean up types and visibility
    val = val.replace('.public', '').replace('.private', '');
    obj[match[1]] = val;
  }
  return obj;
}
