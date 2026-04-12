import { useMemo, useState, useEffect } from 'react';
import { WalletProvider } from '@demox-labs/aleo-wallet-adapter-react';
import { WalletModalProvider } from '@demox-labs/aleo-wallet-adapter-reactui';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import { DecryptPermission, WalletAdapterNetwork } from '@demox-labs/aleo-wallet-adapter-base';

import '@demox-labs/aleo-wallet-adapter-reactui/styles.css';
import '../styles/globals.css';

let OriginalShieldAdapter = null;
try {
  const shieldModule = require('@provablehq/aleo-wallet-adaptor-shield');
  // Check common export paths for ShieldWalletAdapter
  OriginalShieldAdapter = shieldModule.ShieldWalletAdapter || 
                          shieldModule.default?.ShieldWalletAdapter || 
                          shieldModule.default;
  
  if (OriginalShieldAdapter) {
    console.log("✅ Shield Wallet Adapter found");
  } else {
    console.error("❌ Shield Wallet Adapter NOT found in module:", Object.keys(shieldModule));
  }
} catch (e) {
  console.error("❌ Shield Module Load Error:", e);
}

function createFixedShieldAdapter() {
  if (!OriginalShieldAdapter) return null;
  
  const instance = new OriginalShieldAdapter();
  const originalConnect = instance.connect.bind(instance);
  
  instance.connect = async function(decryptPermission, network, programs) {
    const result = await originalConnect(network, decryptPermission, programs);
    
    if (instance._publicKey) {
      instance.publicKey = instance._publicKey;
    } else if (instance.account?.address) {
      instance.publicKey = instance.account.address;
    }
    
    return result;
  };

  const originalRequestRecords = instance.requestRecords?.bind(instance);
  if (originalRequestRecords) {
    instance.requestRecords = async function(program) {
      const records = await originalRequestRecords(program, true); // includePlaintext = true
      
      // SHIELD WALLET FIX: If the wallet ignored the includePlaintext flag, 
      // we must manually decrypt them all using the decrypt function so the app 
      // can actually read what's inside them (e.g., escrow_id, amount).
      if (Array.isArray(records)) {
          for (let i = 0; i < records.length; i++) {
              let r = records[i];
              if (r.recordCiphertext && !r.plaintext && typeof instance.decrypt === 'function') {
                  try {
                      console.log(`🛡️ Auto-decrypting record ${i} for dashboard visibility...`);
                      r.plaintext = await instance.decrypt(r.recordCiphertext);
                  } catch (e) {
                      console.warn(`🛡️ Failed to decrypt record ${i}:`, e);
                  }
              }
          }
      }
      
      console.log("🛡️ Shield Records (with plaintext):", JSON.stringify(records?.slice(0, 2), null, 2));
      return records;
    };
  }

  // Map requestTransaction (Demox standard) to executeTransaction (Provable/Shield standard)
  if (typeof instance.executeTransaction === 'function' && typeof instance.requestTransaction !== 'function') {
    /**
     * Converts any JS value to a proper Aleo-typed input string.
     * Shield's executeTransaction requires inputs: string[] where each string
     * is a valid Aleo literal (e.g. "true", "10000u64", "123field", "aleo1...").
     */
    const toAleoInputString = (input) => {
      // Already a plain string — pass through (e.g. record ciphertext, address, typed literal)
      if (typeof input === 'string') return input;

      // JS boolean → Aleo boolean literal
      if (typeof input === 'boolean') return input ? 'true' : 'false';

      // JS number → Aleo u32 literal (most common for integer params without suffix)
      if (typeof input === 'number') return Number.isInteger(input) ? `${input}u32` : String(input);

      // BigInt
      if (typeof input === 'bigint') return `${input}u128`;

      // Object — extract value from Demox-style wrappers or wallet record objects
      if (typeof input === 'object' && input !== null) {
        // We MUST prioritize plaintext over ciphertext! 
        // Shield expects standard Aleo formatting strings for records natively.
        if (input.plaintext) return String(input.plaintext);
        if (input.recordCiphertext) return input.recordCiphertext;
        // Demox { private: "value" } or { public: "value" } wrappers
        if (input.private !== undefined) return String(input.private);
        if (input.public !== undefined) return String(input.public);
        // Last resort: serialize
        return JSON.stringify(input);
      }

      return String(input);
    };

    instance.requestTransaction = async function(transactionObject) {
       let shieldPayload = transactionObject;
       
       // Demox format uses 'transitions' array; Shield expects flat { program, function, inputs }
       if (transactionObject.transitions && transactionObject.transitions.length > 0) {
         const t = transactionObject.transitions[0];
         
         const formattedInputs = [];
         
         for (let i = 0; i < (t.inputs || []).length; i++) {
           let input = t.inputs[i];
           
           // If the input is a Demox-style record object with a ciphertext but NO plaintext,
           // we MUST decrypt it using the wallet first, because executeTransaction expects 
           // a plaintext structure string, not a ciphertext.
           if (typeof input === 'object' && input !== null && input.recordCiphertext && !input.plaintext) {
             console.log(`🛡️ Found encrypted record at index ${i}, auto-decrypting via Shield...`);
             if (typeof instance.decrypt === 'function') {
               try {
                 const pt = await instance.decrypt(input.recordCiphertext);
                 if (pt) input = pt; // replace record object with plaintext string
               } catch (e) {
                 console.warn(`🛡️ Failed to decrypt record at index ${i}:`, e);
               }
             }
           }
           
           formattedInputs.push(toAleoInputString(input));
         }
         
         shieldPayload = {
           network: instance.network || 'testnet',
           program: t.program,
           function: t.functionName,
           inputs: formattedInputs,
           fee: transactionObject.fee || 500000,
           privateFee: transactionObject.feePrivate || false
         };
       }
       
       console.log("🛡️ Shield Payload:", JSON.stringify(shieldPayload, null, 2));
       const result = await instance.executeTransaction(shieldPayload);
       return result?.transactionId || result;
    };
  }
  
  Object.defineProperty(instance, 'publicKey', {
    get: function() {
      return this._publicKey || this.account?.address || null;
    },
    set: function(val) {
      this._publicKey = val;
    },
    configurable: true,
    enumerable: true,
  });
  
  return instance;
}

export default function App({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const wallets = useMemo(() => {
    const list = [
      new LeoWalletAdapter({ appName: 'ZK Escrow Pro' }),
    ];
    const shield = createFixedShieldAdapter();
    if (shield) list.unshift(shield);
    return list;
  }, []);

  return (
    <WalletProvider
      wallets={wallets}
      decryptPermission={DecryptPermission.AutoDecrypt}
      network={WalletAdapterNetwork.Testnet}
      autoConnect={false}
    >
      <WalletModalProvider>
        {mounted && <Component {...pageProps} />}
      </WalletModalProvider>
    </WalletProvider>
  );
}
