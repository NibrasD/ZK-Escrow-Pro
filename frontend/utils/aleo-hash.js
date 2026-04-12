let aleo = null;
let initPromise = null;

/**
 * Deterministic fallback hash for Aleo addresses
 * Used only if the SDK WASM hashing fails.
 * This matches the logic previously used for local escrows.
 */
function deterministicHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 = Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  const combined = (BigInt(h1 >>> 0) << 32n) | BigInt(h2 >>> 0);
  return combined.toString() + "field";
}

export async function initAleo() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      // Use dynamic import to avoid SSR and top-level await issues
      const aleoSDK = await import('@aleohq/sdk');
      aleo = aleoSDK;
      console.log("✅ Aleo SDK WASM Initialized");
      return aleo;
    } catch (error) {
      console.error("❌ Failed to initialize Aleo SDK:", error);
      return null;
    }
  })();
  
  return initPromise;
}

export async function computeAddressHash(addressStr) {
  if (!addressStr) return null;
  
  await initAleo();
  
  if (!aleo) {
    console.warn("⚠️ SDK not available, using deterministic fallback for", addressStr);
    return deterministicHash(addressStr);
  }

  try {
    const address = aleo.Address.from_string(addressStr);
    
    // Attempt 1: Native to_field if available
    if (typeof address.to_field === 'function') {
      return address.to_field().toString();
    }
    
    // Attempt 2: via Group
    if (typeof address.to_group === 'function') {
      const group = address.to_group();
      if (typeof group.to_field === 'function') {
        return group.to_field().toString();
      }
    }

    // Attempt 3: Native string parsing if it happens to be valid (unlikely but safe)
    try {
        const field = aleo.Field.fromString(addressStr);
        return field.toString();
    } catch(e) {}

    // Fallback: If all SDK methods fail, use the deterministic hash
    // This allows the UI to stay consistent even if WASM versions change.
    console.warn("⚠️ SDK methods missing (to_field/to_group), using deterministic fallback");
    return deterministicHash(addressStr);
  } catch (error) {
    console.error("❌ Hash computation failed:", error);
    return deterministicHash(addressStr);
  }
}
