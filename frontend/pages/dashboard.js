import { useState, useEffect } from 'react';
import Head from 'next/head';
import WalletConnect from '../components/WalletConnect';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { 
  Shield, Lock, Unlock, PlusCircle, Activity, 
  Terminal, ChevronUp, CheckCircle2,
  Cpu, Zap, Globe, Code, 
  FileText, User, ArrowRight, X,
  AlertTriangle, ExternalLink, RefreshCw, Loader,
  Gavel, RotateCcw
} from 'lucide-react';
import { PROGRAM_ID, CONTRACT_ABI, DEPLOY_TX, PROGRAM_ADDRESS, PROGRAM_OWNER, STATUS_CODES, ALEO_API } from '../utils/contract_code';
import { getLatestBlockHeight, getMappingValue, parseLeoStruct } from '../utils/aleo-api-utils';
import { computeAddressHash } from '../utils/aleo-hash';

const STORAGE_KEY = 'zkescrow_v6_jobs';

export default function Dashboard() {
  const { publicKey, wallet, connected, requestTransaction, requestRecords } = useWallet();
  
  // Safely extract the string representation of the address
  let activeAddress = null;
  if (publicKey) activeAddress = typeof publicKey === 'string' ? publicKey : publicKey.toString();
  else if (wallet?.adapter?.publicKey) {
    activeAddress = typeof wallet.adapter.publicKey === 'string' ? wallet.adapter.publicKey : wallet.adapter.publicKey.toString();
  }
  const [jobs, setJobs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [txError, setTxError] = useState('');

  const [activeAddressHash, setActiveAddressHash] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userBalance, setUserBalance] = useState(null);
  const [importId, setImportId] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: '',
    payeeAddress: '',
    mediatorAddress: '',
    isBounty: false,
    deadline: '1000', // Default 1000 blocks
    isRestricted: false,
    whitelistAddress: '',
  });

  const [currentBlockHeight, setCurrentBlockHeight] = useState(0);

  // Compute BHP256 hash of active address for identity verification
  useEffect(() => {
    if (activeAddress) {
      computeAddressHash(activeAddress).then(hash => {
        if (hash) {
           console.log("🛡️ Active Address Hash Computed:", hash);
           setActiveAddressHash(hash);
        }
      });
    } else {
      setActiveAddressHash(null);
    }
  }, [activeAddress]);
  const [showPartialModal, setShowPartialModal] = useState(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [deliveryHashInput, setDeliveryHashInput] = useState('');
  const [showDeliveryModal, setShowDeliveryModal] = useState(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setJobs(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)); } catch {}
  }, [jobs]);

  // Fetch real user balance from Aleo API
  useEffect(() => {
    if (!activeAddress) return;
    const fetchBalance = async () => {
      try {
        const res = await fetch(`${ALEO_API}/program/credits.aleo/mapping/account/${activeAddress}`);
        if (res.ok) {
          const text = await res.text();
          // Response is like "12345u64" — extract the number
          const match = text.replace(/"/g, '').match(/(\d+)/);
          if (match) setUserBalance(parseInt(match[1]));
        }
      } catch {}
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [publicKey]);

  // Fetch block height
  useEffect(() => {
    const updateHeight = async () => {
      const h = await getLatestBlockHeight();
      if (h) setCurrentBlockHeight(h);
    };
    updateHeight();
    const interval = setInterval(updateHeight, 15000);
    return () => clearInterval(interval);
  }, []);

  // Auto-confirm pending txs after 30s
  // Leo wallet returns a UUID request ID (not at1... tx ID),
  // so we can't poll the explorer. Instead, since the wallet
  // already signed & broadcast, we auto-confirm after a delay.
  useEffect(() => {
    const pending = jobs.filter(j => j.status === 'pending');
    if (pending.length === 0) return;

    const timers = pending.map(job => {
      const age = Date.now() - job.id; // id is a timestamp
      const remaining = Math.max(0, 30000 - age);
      return setTimeout(() => {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'locked' } : j));
      }, remaining);
    });

    return () => timers.forEach(clearTimeout);
  }, [jobs]);

  // Sync delivery mapping for all active jobs
  useEffect(() => {
    if (jobs.length === 0) return;
    const syncDeliveries = async () => {
      let changed = false;
      const updatedJobs = await Promise.all(jobs.map(async (job) => {
        if (!job.deliveryHash && (job.status === 'locked' || job.status === 0 || job.status === 4)) {
          const val = await getMappingValue(PROGRAM_ID, 'deliveries', job.escrowId);
          if (val) {
            changed = true;
            return { ...job, deliveryHash: val };
          }
        }
        return job;
      }));
      if (changed) setJobs(updatedJobs);
    };
    syncDeliveries();
    const interval = setInterval(syncDeliveries, 30000);
    return () => clearInterval(interval);
  }, [jobs]);

  const handleSyncRecords = async () => {
    if (!activeAddress) return;
    setIsProcessing(true);
    setTxStatus('scanning_wallet');
    try {
      const records = await requestRecords(PROGRAM_ID);
      let updated = false;
      const newJobs = [...jobs];

      records.forEach(r => {
        if (r.spent) return;
        
        let escrow_id = r.data?.escrow_id || r.escrow_id;
        let amountStr = r.data?.amount || r.amount || '0';

        // Shield Wallet plaintext parsing fallback
        if (!escrow_id && r.plaintext && typeof r.plaintext === 'string') {
          const idMatch = r.plaintext.match(/escrow_id:\s*([\w]+)/);
          if (idMatch) escrow_id = idMatch[1];
          
          const amountMatch = r.plaintext.match(/amount:\s*(\d+)u64/);
          if (amountMatch) amountStr = amountMatch[1];
        }

        if (!escrow_id) return;

        const isPayee = r.recordName === 'PayeeTicket' || r.type === 'PayeeTicket' || r.plaintext?.includes('PayeeTicket');
        const amount = typeof amountStr === 'string' ? parseInt(amountStr.replace('u64','')) : (parseInt(amountStr?.value || '0'));

        const existingJobIndex = newJobs.findIndex(j => (j.escrowId === escrow_id) || (j.id === escrow_id));
        
        if (existingJobIndex >= 0) {
          // Update existing job if needed
          if (newJobs[existingJobIndex].budget === 'Zero-Knowledge' || !newJobs[existingJobIndex].budget) {
            newJobs[existingJobIndex].budget = amount;
            updated = true;
          }
        } else {
          // ADD completely new job from the synced ticket!
          newJobs.push({
            id: escrow_id,
            escrowId: escrow_id,
            title: isPayee ? "Imported Payee Job" : "Imported Escrow",
            description: "Synced securely from your Aleo wallet completely on-chain.",
            budget: amount,
            payer: isPayee ? "Hidden" : activeAddress,
            payee: isPayee ? activeAddress : "Hidden",
            status: 'funded',
            isBounty: false,
            deliveryHash: ''
          });
          updated = true;
        }
      });

      if (updated) setJobs(newJobs);
      alert("✅ Records Synchronized! Your dashboard has been updated based on your private keys.");
    } catch (err) {
      alert("Sync failed: " + err.message);
    } finally {
      setIsProcessing(false);
      setTxStatus('');
    }
  };


  const updateForm = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  // Hash a string into a field value (deterministic, collision-resistant)
  const hashToField = (str) => {
    if (!str) return "0field";
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const combined = (h2 >>> 0) * 4294967296 + (h1 >>> 0);
    return combined + "field";
  };

  // Generate a unique escrow ID (timestamp + high-entropy random)
  const generateEscrowId = () => {
    const ts = BigInt(Date.now());
    const rand = BigInt(Math.floor(Math.random() * 2147483647));
    const id = ts * 10000000000n + rand;
    return id.toString() + "field";
  };

  // ══════════════════════════════════════════════
  // CREATE ESCROW — calls create_escrow() on-chain
  // Inputs map EXACTLY to contract parameters:
  //   r0: payee (address)
  //   r1: description_hash (field)
  //   r2: budget (u64)
  //   r3: token_id (field) — 1field = ALEO
  //   r4: mediator (address)
  //   r5: escrow_id (field)
  //   r6: is_bounty (boolean)
  // ══════════════════════════════════════════════
  const handleCreateEscrow = async (e) => {
    if (e) e.preventDefault();
    if (!connected || !activeAddress) { alert("Please connect your Aleo Wallet!"); return; }
    
    // 🔍 Form Validation
    if (!formData.title) { alert("Please enter a Title for this escrow."); return; }
    if (!formData.budget || parseFloat(formData.budget) <= 0) { alert("Please enter a valid Budget."); return; }
    if (!formData.payeeAddress || !formData.payeeAddress.startsWith('aleo1')) { 
      alert("Please enter a valid Aleo Payee Address."); 
      return; 
    }
    if (formData.isRestricted && (!formData.whitelistAddress || !formData.whitelistAddress.startsWith('aleo1'))) {
      alert("Please enter a valid Whitelist Address for restricted escrows.");
      return;
    }

    setIsProcessing(true);
    setTxStatus('finding_records');
    
    try {
      const records = await requestRecords('credits.aleo'); 
      console.log("Raw Wallet Records:", JSON.stringify(records, null, 2));
      const budgetUnits = Math.floor(parseFloat(formData.budget) * 1_000_000);
      
      const fundingRecord = records.find(r => {
        if (r.spent) return false;
        
        // Try extracting microcredits from multiple possible locations:
        // 1. plaintext string (Shield with includePlaintext=true): "{ owner: aleo1..., microcredits: 5000000u64, ... }"
        // 2. data object (Leo wallet): r.data.microcredits
        // 3. direct field: r.microcredits
        let amountStr = '0';
        
        // Check plaintext string for microcredits (Shield returns this format)
        if (r.plaintext && typeof r.plaintext === 'string') {
          const ptMatch = r.plaintext.match(/microcredits:\s*(\d+)u64/);
          if (ptMatch) amountStr = ptMatch[1];
        }
        
        // Fallback to data object fields
        if (amountStr === '0') {
          amountStr = r.data?.microcredits || r.data?.amount || r.microcredits || '0';
        }
        
        // Handle object-type values
        if (typeof amountStr === 'object') {
           amountStr = amountStr.value || amountStr.toString();
        }
        
        // Clean Aleo types e.g., "5000000u64.private" -> "5000000"
        if (typeof amountStr === 'string') {
          amountStr = amountStr.replace(/u64.*/, '').replace(/[^0-9]/g, '');
        }
        
        const amount = parseInt(amountStr || '0', 10);
        console.log(`Evaluating record: ${r.id || 'unknown'}, amount: ${amount}, needed: ${budgetUnits}, hasPlaintext: ${!!r.plaintext}`);
        
        // If we still can't parse the amount but the record has plaintext or ciphertext, 
        // select it optimistically and let the VM validate
        if (amount === 0 && (r.plaintext || r.recordCiphertext) && !r.spent) {
           console.log("Selecting record optimistically (amount unknown from encrypted data).");
           return true;
        }
        
        return amount >= budgetUnits;
      });
      
      if (!fundingRecord) {
        throw new Error("No shielded credits record found with sufficient balance. Please check the browser console for details or shield more ALEO.");
      }

      setTxStatus('signing');
      const escrowId = generateEscrowId();
      const medHash = hashToField(formData.mediatorAddress || activeAddress);
      const wlAddr = formData.whitelistAddress || "aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc";

      // Build the record input:
      // We pass the full fundingRecord object so the shim can detect it and auto-decrypt it!
      const recordInput = fundingRecord;

      const txId = await requestTransaction({
        address: activeAddress,
        chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: 'create_escrow',
          inputs: [
            recordInput,                                          // r0: credits.record
            formData.payeeAddress,                                // r1: address.private
            `${budgetUnits}u64`,                                  // r2: u64.private
            medHash,                                              // r3: field.private (mediator_hash)
            escrowId,                                             // r4: field.private (escrow_id)
            formData.isBounty ? 'true' : 'false',                // r5: boolean.private
            `${parseInt(formData.deadline || '1000')}u32`,        // r6: u32.private
            formData.isRestricted ? 'true' : 'false',             // r7: boolean.private
            wlAddr                                                // r8: address.private
          ],
        }],
        fee: 500_000,
      });

      if (!txId) {
        throw new Error("Transaction was rejected or failed in the wallet.");
      }

      console.log("✅ Shield Transaction ID:", txId);

      const newJob = {
        id: Date.now(),
        hash: txId,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        title: formData.title,
        description: formData.description,
        budget: budgetUnits,
        releasedAmount: 0,
        payer: activeAddress,
        payee: formData.payeeAddress,
        mediator: formData.mediatorAddress,
        escrowId: escrowId,
        isBounty: formData.isBounty,
        deadline: currentBlockHeight + parseInt(formData.deadline || 1000),
        isRestricted: formData.isRestricted,
        whitelistAddress: wlAddr
      };

      setJobs(prev => [newJob, ...prev]);
      setShowCreateForm(false);
      setTxStatus('done');
      alert("✅ Private Escrow Created via Shield Wallet!");
    } catch (err) {
      setTxError(err.message);
      setTxStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // CLAIM BOUNTY (for Payees/Freelancers)
  const handleClaimBounty = async (job) => {
    if (!activeAddress) { alert("⚠ Please connect your wallet first!"); return; }
    
    let budgetUnits = job.budget;
    if (job.budget === 'Zero-Knowledge' || !job.budget || job.budget === 0) {
      const input = prompt("Enter the bounty amount in ALEO (required for ZK verification):");
      if (!input) return;
      budgetUnits = Math.floor(parseFloat(input) * 1_000_000);
    }
    
    setIsProcessing(true);
    setTxStatus('signing');
    try {
      const txId = await requestTransaction({
        address: activeAddress,
        chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: 'claim_bounty',
          inputs: [
            job.escrowId,
            `${budgetUnits}u64`
          ],
        }],
        fee: 200_000,
      });
      if (!txId) throw new Error("Transaction was rejected or failed in the wallet.");
      alert("🚀 Claim Bounty tx submitted: " + txId);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, isBounty: false, payee: activeAddress, budget: budgetUnits } : j));
      setTxStatus('done');
    } catch (err) {
      alert("Failed to claim bounty: " + err.message);
      setTxStatus('error');
      setTxError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // RELEASE PAYMENT (Supports Partial)
  const handleRelease = async (job, amount) => {
    if (!activeAddress) return;
    setIsProcessing(true);
    setTxStatus('signing');
    try {
      // For V6, we need to find the PayerTicket record
      setTxStatus('finding_tickets');
      const records = await requestRecords(PROGRAM_ID);
      const ticket = findTicketForEscrow(records, job.escrowId);

      if (!ticket) throw new Error("Private PayerTicket not found in your wallet. Sync records?");

      setTxStatus('signing');
      const txId = await requestTransaction({
        address: activeAddress, chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: 'release_payment',
          inputs: [
            ticket,
            job.payee,
            `${amount}u64`
          ],
        }],
        fee: 400_000,
      });
      if (!txId) throw new Error("Transaction was rejected or failed in the wallet.");
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, releasedAmount: (j.releasedAmount || 0) + amount } : j));
      setTxStatus('done');
      setShowPartialModal(null);
    } catch (err) { setTxError(err.message); setTxStatus('error'); }
    finally { setIsProcessing(false); }
  };

  // Helper to reliably find a ticket regardless of wallet adapter format
  const findTicketForEscrow = (records, targetEscrowId) => {
    return records.find(r => {
      if (r.spent) return false;
      let id = r.data?.escrow_id || r.escrow_id;
      if (!id && r.plaintext && typeof r.plaintext === 'string') {
        const match = r.plaintext.match(/escrow_id:\s*([\w]+)/);
        if (match) id = match[1];
      }
      return id === targetEscrowId;
    });
  };

  // SUBMIT DELIVERY
  const handleSubmitDelivery = async (job) => {
    if (!activeAddress) return;
    
    // Auto-hash any plain text input into a valid Aleo field number
    let rawInput = deliveryHashInput.trim();
    let finalHash;
    if (!rawInput) {
      finalHash = hashToField(Date.now().toString());
    } else if (/^\d+field$/.test(rawInput)) {
      finalHash = rawInput; // Already a valid field
    } else {
      finalHash = hashToField(rawInput); // Convert "Done" to "6524...field"
    }
    
    setIsProcessing(true);
    setTxStatus('finding_tickets');
    try {
      const records = await requestRecords(PROGRAM_ID);
      const ticket = findTicketForEscrow(records, job.escrowId);
      if (!ticket) throw new Error("PayeeTicket not found. Have you clicked Sync Private Records?");

      setTxStatus('signing');
      const txId = await requestTransaction({
        address: activeAddress, chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: 'submit_delivery',
          inputs: [ticket, finalHash],
        }],
        fee: 250_000,
      });
      if (!txId) throw new Error("Transaction was rejected or failed in the wallet.");
      setJobs(prev => prev.map(j => j.escrowId === job.escrowId ? { ...j, deliveryHash: finalHash } : j));
      setTxStatus('done');
      setShowDeliveryModal(null);
      alert("🚀 Delivery Proof submitted: " + txId);
    } catch (err) { setTxError(err.message); setTxStatus('error'); }
    finally { setIsProcessing(false); }
  };

  // AUTO RELEASE
  const handleAutoRelease = async (job) => {
    if (!activeAddress) return;
    const remaining = job.budget - (job.releasedAmount || 0);
    setIsProcessing(true);
    setTxStatus('signing');
    try {
      const records = await requestRecords(PROGRAM_ID);
      const ticket = findTicketForEscrow(records, job.escrowId);
      if (!ticket) throw new Error("Ticket not found in your wallet. Sync records?");

      const txId = await requestTransaction({
        address: activeAddress, chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: 'auto_release',
          inputs: [ticket, `${remaining}u64`],
        }],
        fee: 300_000,
      });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'released', releasedAmount: job.budget } : j));
      setTxStatus('done');
    } catch (err) { setTxError(err.message); setTxStatus('error'); }
    finally { setIsProcessing(false); }
  };

  // AUTO REFUND
  const handleAutoRefund = async (job) => {
    if (!activeAddress) return;
    const remaining = job.budget - (job.releasedAmount || 0);
    setIsProcessing(true);
    setTxStatus('signing');
    try {
      const records = await requestRecords(PROGRAM_ID);
      const ticket = findTicketForEscrow(records, job.escrowId);
      if (!ticket) throw new Error("Ticket not found in your wallet. Sync records?");

      const txId = await requestTransaction({
        address: activeAddress, chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: 'auto_refund',
          inputs: [ticket, `${remaining}u64`],
        }],
        fee: 300_000,
      });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'refunded', releasedAmount: job.budget } : j));
      setTxStatus('done');
    } catch (err) { setTxError(err.message); setTxStatus('error'); }
    finally { setIsProcessing(false); }
  };

  // RAISE DISPUTE
  const handleDispute = async (job) => {
    if (!activeAddress) { alert("⚠ Please connect your wallet first!"); return; }
    setIsProcessing(true);
    try {
      setTxStatus('finding_tickets');
      const records = await requestRecords(PROGRAM_ID);
      const isPayer = activeAddress === job.payer;
      const ticket = findTicketForEscrow(records, job.escrowId);
      if (!ticket) throw new Error("Ticket record not found. Please Sync Records.");

      setTxStatus('signing');
      const txId = await requestTransaction({
        address: activeAddress, chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: isPayer ? 'raise_dispute_payer' : 'raise_dispute_payee',
          inputs: [ticket]
        }],
        fee: 250_000,
      });
      alert("⚠️ Dispute tx submitted: " + txId);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'disputed' } : j));
      setTxStatus('done');
    } catch (err) { 
      alert("Failed: " + err.message); 
      setTxStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // REFUND
  const handleRefund = async (job) => {
    if (!activeAddress) { alert("⚠ Please connect your wallet first!"); return; }
    const remaining = job.budget - (job.releasedAmount || 0);
    try {
      setTxStatus('finding_tickets');
      const records = await requestRecords(PROGRAM_ID);
      const ticket = findTicketForEscrow(records, job.escrowId);
      if (!ticket) throw new Error("PayerTicket record not found. Please Sync Records.");

      setTxStatus('signing');
      const txId = await requestTransaction({
        address: activeAddress, chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: 'refund_payment',
          inputs: [ticket, `${remaining}u64`]
        }],
        fee: 250_000,
      });
      alert("💰 Refund tx submitted: " + txId);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'refunded' } : j));
      setTxStatus('done');
    } catch (err) {
      alert("Failed: " + err.message);
      setTxStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // IMPORT ESCROW BY ID FROM BLOCKCHAIN
  const handleImportEscrow = async () => {
    if (!importId.trim()) return;
    setIsImporting(true);
    let idStr = importId.trim();
    if (!idStr.endsWith('field')) idStr += 'field';

    try {
      const rawData = await getMappingValue(PROGRAM_ID, 'escrows', idStr);
      if (!rawData) throw new Error("Not found on testnet.");
      
      const data = parseLeoStruct(rawData);
      console.log("Parsed Data:", data);

      // Attempt to find budget in wallet records if mapping is empty
      let budget = parseInt(data.amount?.replace('u64','')) || 0;
      if (!budget && connected) {
        try {
           const records = await requestRecords(PROGRAM_ID);
           const ticket = records.find(r => r.data.escrow_id === idStr && !r.spent);
           if (ticket) budget = parseInt(ticket.data.amount?.replace('u64','')) || 0;
        } catch {}
      }

      const released = parseInt(data.released_amount?.replace('u64','')) || 0;
      const statusNum = parseInt(data.status?.replace('u8','')) || 0;
      const decHash = data.description_hash;
      const deadline = parseInt(data.deadline?.replace('u32','')) || 0;

      let status = 'locked';
      if (statusNum === 1) status = 'disputed';
      if (statusNum === 2) status = 'released';
      if (statusNum === 3) status = 'refunded';
      if (statusNum === 4) status = 4; // Claimed

      // Robust boolean parsing for Leo mapping return values
      const isBounty = String(data.is_bounty).toLowerCase().includes('true');

      if (jobs.some(j => j.escrowId === idStr)) {
        alert("Escrow already in your list.");
        setIsImporting(false);
        return;
      }

      // Check delivery mapping
      const delHash = await getMappingValue(PROGRAM_ID, 'deliveries', idStr);

      setJobs(prev => [{
        id: Date.now(),
        hash: 'imported_from_network',
        status: status,
        date: new Date().toISOString().split('T')[0],
        title: isBounty ? 'Open Bounty (Network Sync)' : 'Direct Escrow (Network Sync)',
        description: 'Identity is hashed. Privacy-first storage.',
        budget: budget || 'Zero-Knowledge',
        releasedAmount: released || 0,
        payer: data.payer_hash, 
        payee: data.payee_hash,
        mediator: data.mediator_hash,
        escrowId: idStr,
        isBounty: isBounty,
        deadline: deadline || data.deadline, // Fallback to raw if parseInt failed
        deliveryHash: delHash
      }, ...prev]);

      setImportId('');
      alert("✅ Successfully loaded escrow state from the blockchain!");
    } catch (err) {
      alert("Failed to fetch escrow: " + err.message);
    }
    setIsImporting(false);
  };

  const formatCredits = (mc) => (mc / 1_000_000).toFixed(6);

  const getStatusConfig = (s) => ({
    locked: { label: 'Locked (On-Chain)', icon: <Lock size={12} />, cls: 'badge-amber' },
    0: { label: 'Locked (On-Chain)', icon: <Lock size={12} />, cls: 'badge-amber' },
    pending: { label: 'Pending...', icon: <RefreshCw size={12} className="spin-slow" />, cls: 'badge-cyan' },
    released: { label: 'Released', icon: <CheckCircle2 size={12} />, cls: 'badge-emerald' },
    2: { label: 'Released', icon: <CheckCircle2 size={12} />, cls: 'badge-emerald' },
    disputed: { label: 'Disputed', icon: <AlertTriangle size={12} />, cls: 'badge-red' },
    1: { label: 'Disputed', icon: <AlertTriangle size={12} />, cls: 'badge-red' },
    refunded: { label: 'Refunded', icon: <RotateCcw size={12} />, cls: 'badge-cyan' },
    3: { label: 'Refunded', icon: <RotateCcw size={12} />, cls: 'badge-cyan' },
    4: { label: 'Claimed (Reviewing)', icon: <Activity size={12} />, cls: 'badge-cyan' },
  }[s] || { label: s, icon: null, cls: 'badge-cyan' });

  return (
    <div className="container">
      <Head>
        <title>ZK-Escrow Pro — Real Private Escrow on Aleo</title>
        <meta name="description" content="Production ZK escrow with on-chain mappings, access control, and encrypted records. Deployed on Aleo testnet." />
      </Head>

      <header>
        <div className="logo"><Shield size={24} /> ZK-Escrow <span style={{color: 'var(--accent-emerald)'}}>Pro</span></div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={handleSyncRecords} className="btn-tech" style={{ borderColor: 'var(--accent-emerald)', color: 'var(--accent-emerald)' }}>
            <RefreshCw size={14} className={isProcessing && txStatus === 'scanning_wallet' ? 'spin-slow' : ''} /> Sync Private Records
          </button>
          {currentBlockHeight > 0 && (
            <div className="badge badge-cyan" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              Height: {currentBlockHeight.toLocaleString()}
            </div>
          )}
          {userBalance !== null && (
            <div className="badge badge-emerald" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              Balance: {formatCredits(userBalance)} ALEO
            </div>
          )}

          <WalletConnect />
        </div>
      </header>

      <main>
        <section className="hero">
          <h1>Private Escrow<br/>on Aleo</h1>
          <p>Create real on-chain escrow agreements with ZK proofs, access control, and encrypted records.</p>
          {!connected && <p style={{ color: '#fbbf24', fontSize: '0.9rem', marginTop: '1rem' }}>⚠ Connect your Aleo Wallet (Leo or Shield) to start.</p>}
        </section>

        {/* How It Works */}
        <section style={{ marginBottom: '4rem' }}>
          <div className="steps-row">
            <div className="step-item">
              <div className="step-number">1</div>
              <h4>Define & Sign</h4>
              <p>Fill in job details. Your wallet generates a ZK proof and signs the transaction.</p>
            </div>
            <div className="step-connector"><ArrowRight size={20} color="var(--text-secondary)" /></div>
            <div className="step-item">
              <div className="step-number">2</div>
              <h4>On-Chain State</h4>
              <p>Escrow data is stored in an on-chain mapping. A private Job record is created for you.</p>
            </div>
            <div className="step-connector"><ArrowRight size={20} color="var(--text-secondary)" /></div>
            <div className="step-item">
              <div className="step-number">3</div>
              <h4>Release / Dispute</h4>
              <p>Only the payer can release. Only payer/payee can dispute. Only the mediator can resolve.</p>
            </div>
          </div>
        </section>


        {/* Tx Status */}
        {txStatus && (
          <div className="glass-card" style={{
            borderLeft: `4px solid ${txStatus === 'error' ? '#f87171' : txStatus === 'done' ? 'var(--accent-emerald)' : '#fbbf24'}`,
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {txStatus === 'signing' && <><Loader size={18} className="spin-slow" color="#fbbf24" />Waiting for wallet signature...</>}
                {txStatus === 'done' && <><CheckCircle2 size={18} color="var(--accent-emerald)" />Transaction submitted! Waiting for on-chain confirmation.</>}
                {txStatus === 'error' && <><AlertTriangle size={18} color="#f87171" /><span style={{ color: '#f87171' }}>{txError}</span></>}
              </div>
              <button onClick={() => setTxStatus('')} className="btn-icon"><X size={16} /></button>
            </div>
          </div>
        )}

        {/* Create Escrow */}
        <section className="glass-card cta-section">
          {!showCreateForm ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <Zap size={22} color="var(--accent-emerald)" />
                  <h2 style={{ fontSize: '1.5rem' }}>Create Escrow</h2>
                </div>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '500px' }}>
                  Calls <code style={{ color: 'var(--tech-code)' }}>create_escrow()</code> — creates an encrypted Job record and stores escrow state in an on-chain mapping.
                </p>
              </div>
              <button onClick={() => setShowCreateForm(true)} className="btn-primary" disabled={!activeAddress} style={{ padding: '1rem 2rem' }}>
                <PlusCircle size={20} /> {activeAddress ? 'New Escrow' : 'Connect Wallet'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileText size={22} color="var(--accent-emerald)" /> create_escrow() — Parameters
                </h2>
                <button onClick={() => setShowCreateForm(false)} className="btn-icon"><X size={20} /></button>
              </div>

              <div className="form-grid">
                <div className="form-group full-width">
                  <label><FileText size={14} /> Job Title (hashed → description_hash: field)</label>
                  <input type="text" placeholder="e.g. Smart Contract Security Audit" value={formData.title} onChange={(e) => updateForm('title', e.target.value)} />
                </div>
                <div className="form-group full-width">
                  <label>Description (stored locally, hash goes on-chain)</label>
                  <textarea rows={2} placeholder="Deliverables and conditions..." value={formData.description} onChange={(e) => updateForm('description', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Budget (ALEO Credits)</label>
                  <input type="number" min="0.000001" step="any" placeholder="e.g. 5.5" value={formData.budget} onChange={(e) => updateForm('budget', e.target.value)} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {formData.budget && parseFloat(formData.budget) > 0 ? `= Math.floor(${(parseFloat(formData.budget) * 1000000).toLocaleString()}) microcredits on-chain` : 'e.g. 1.5 ALEO'}
                  </span>
                </div>
                {!formData.isBounty && (
                  <div className="form-group">
                    <label><User size={14} /> Payee Address</label>
                    <input type="text" placeholder="aleo1... (defaults to you)" value={formData.payeeAddress} onChange={(e) => updateForm('payeeAddress', e.target.value)} />
                  </div>
                )}
                <div className="form-group">
                  <label><RotateCcw size={14} /> Deadline (Blocks from now)</label>
                  <input type="number" placeholder="e.g. 1000" value={formData.deadline} onChange={(e) => updateForm('deadline', e.target.value)} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Expires at height: ~{(currentBlockHeight + parseInt(formData.deadline || 1000)).toLocaleString()}
                  </span>
                </div>
                <div className="form-group">
                  <label className="toggle-label">
                    <input type="checkbox" checked={formData.isBounty} onChange={(e) => updateForm('isBounty', e.target.checked)} />
                    <span className="toggle-switch"></span>
                    Open Bounty
                  </label>
                </div>
                {formData.isBounty && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                      <label className="toggle-label">
                        <input type="checkbox" checked={formData.isRestricted} onChange={(e) => updateForm('isRestricted', e.target.checked)} />
                        <span className="toggle-switch"></span>
                        Restricted Bounty (Whitelist)
                      </label>
                      {formData.isRestricted && (
                        <input 
                          type="text" 
                          placeholder="Whitelisted Aleo Address" 
                          value={formData.whitelistAddress} 
                          onChange={(e) => updateForm('whitelistAddress', e.target.value)} 
                          style={{ flex: 1, padding: '0.5rem' }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {formData.title && formData.budget && (
                <div className="summary-bar">
                  <div><span>Function:</span> create_escrow()</div>
                  <div><span>Budget:</span> {parseFloat(formData.budget || 0)} ALEO ({Math.floor(parseFloat(formData.budget || 0) * 1000000).toLocaleString()} µcredits)</div>
                  <div><span>Token:</span> 1field (ALEO)</div>
                  <div><span>Tx Fee:</span> ~0.35 credits</div>
                  <div><span>On-Chain:</span> mapping + finalize</div>
                </div>
              )}

                <div className="form-group" style={{ gridColumn: 'span 2', background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.1)', marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Cpu size={14} /> <strong>Shielded Funding Required:</strong> V6 will automatically find a shielded record in your wallet to fund this escrow privately.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button onClick={() => setShowCreateForm(false)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={handleCreateEscrow} className="btn-primary" disabled={isProcessing || !formData.title || !formData.budget} style={{ flex: 2, background: 'linear-gradient(to right, #10b981, #059669)' }}>
                    {isProcessing ? <><Loader size={18} className="spin-slow" /> {txStatus}...</> : <><Shield size={18} /> Deploy Private Escrow</>}
                  </button>
                </div>
            </div>
          )}
        </section>

        {/* Escrow Records */}
        <section style={{ marginTop: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Activity size={22} color="var(--accent-emerald)" /> Escrow Records
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Escrow ID (e.g. 12345field)" 
                value={importId} 
                onChange={(e) => setImportId(e.target.value)}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.85rem' }}
              />
              <button 
                onClick={handleImportEscrow} 
                className="btn-outline" 
                disabled={isImporting || !importId}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                {isImporting ? <Loader size={14} className="spin-slow" /> : 'Find on Chain'}
              </button>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Shield size={40} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
              <h3 style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>No escrows yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Create your first escrow above.</p>
            </div>
          ) : (
            <div className="grid">
              {jobs.map((job) => {
                const st = getStatusConfig(job.status);
                return (
                  <div key={job.id} className="glass-card escrow-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <span className={`badge ${st.cls}`}>{st.icon} {st.label}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{job.date}</span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.5rem' }}>{job.title}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {job.isBounty && <span className="badge badge-cyan">Open Bounty</span>}
                      {job.isRestricted && <span className="badge badge-amber">Restricted</span>}
                      {job.deliveryHash && <span className="badge badge-emerald"><CheckCircle2 size={10}/> Delivered</span>}
                    </div>

                    <div className="code-snippet" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                      <span style={{ fontSize: '0.75rem', color: '#38bdf8', paddingRight: '0.5rem' }}>ID:</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{job.escrowId}</span>
                      <button onClick={() => { 
                        const details = job.escrowId;
                        
                        try {
                          if (navigator.clipboard && window.isSecureContext) {
                            navigator.clipboard.writeText(details);
                          } else {
                            const textArea = document.createElement("textarea");
                            textArea.value = details;
                            textArea.style.position = "fixed";
                            document.body.appendChild(textArea);
                            textArea.focus();
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                          }
                          alert("Escrow ID Copied! " + details); 
                        } catch (err) {
                          alert("Failed to copy. Please manually copy the ID.");
                          console.error('Copy failed', err);
                        }
                      }} className="btn-icon" style={{ marginLeft: '0.5rem' }} title="Copy Escrow ID">
                        <FileText size={14} />
                      </button>
                    </div>
                    {job.hash !== 'imported_from_network' && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'flex', gap: '0.3rem', opacity: 0.6 }}>
                        <span>Wallet Req:</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{job.hash}</span>
                      </div>
                    )}

                    <div className="card-meta-row">
                      <div>
                        <span className="meta-label">Escrow Budget</span>
                        <p className="meta-value">
                          {job.budget === 'Zero-Knowledge' ? 'Zero-Knowledge 🔐' : formatCredits(job.budget) + ' ALEO'}
                        </p>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px' }}>
                          <div style={{ 
                            width: `${job.budget === 'Zero-Knowledge' ? 50 : Math.min(100, ((job.releasedAmount || 0) / job.budget) * 100)}%`, 
                            height: '100%', 
                            background: job.budget === 'Zero-Knowledge' ? 'repeating-linear-gradient(45deg, var(--accent-emerald), var(--accent-emerald) 10px, #065f46 10px, #065f46 20px)' : 'var(--accent-emerald)', 
                            borderRadius: '2px' 
                          }}></div>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                           Released: {formatCredits(job.releasedAmount || 0)} ALEO
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="meta-label">Deadline</span>
                        <p className="meta-value" style={{ fontSize: '0.85rem', color: (job.deadline && job.deadline < currentBlockHeight) ? '#f87171' : 'var(--text-primary)' }}>
                          {(job.deadline && job.deadline !== '0u32') ? (
                            job.deadline > currentBlockHeight 
                              ? `~${(job.deadline - currentBlockHeight).toLocaleString()} blocks left` 
                              : (job.deadline < 1000000 && job.deadline > 0) ? `Block #${job.deadline} (EXPIRED)` : `Expired at block ${job.deadline}`
                          ) : 'No Deadline'}
                        </p>
                      </div>
                    </div>

                    {/* Actions based on status */}
                    {(() => {
                      const isPayer = activeAddress === job.payer || activeAddressHash === job.payer;
                      const isPayee = activeAddress === job.payee || activeAddressHash === job.payee;

                      return (job.status === 'locked' || job.status === 'funded' || job.status === 0 || job.status === 4) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {isPayer ? (
                              <>
                                <button onClick={() => job.isBounty ? {} : setShowPartialModal(job)} className="btn-primary" disabled={job.isBounty} style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem', justifyContent: 'center', opacity: job.isBounty ? 0.5 : 1 }}>
                                  <Unlock size={14} /> Release Payment
                                </button>
                                <button onClick={() => handleRefund(job)} className="btn-outline" style={{ flex: 0.7, padding: '0.6rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                                  <RotateCcw size={14} /> Refund
                                </button>
                              </>
                            ) : (
                              <>
                                {job.isBounty ? (
                                  <button onClick={() => handleClaimBounty(job)} className="btn-primary" disabled={isProcessing} style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                                    {isProcessing ? <Loader size={14} className="spin-slow" /> : <><Activity size={14} /> Claim Bounty</>}
                                  </button>
                                ) : (
                                  isPayee && !job.deliveryHash && (
                                    <button onClick={() => setShowDeliveryModal(job)} className="btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem', justifyContent: 'center', background: 'var(--accent-cyan)' }}>
                                      <Globe size={14} /> Submit Work Proof
                                    </button>
                                  )
                                )}
                              </>
                            )}
                          </div>

                          {/* Trustless Auto-Triggers */}
                          {(job.deadline < currentBlockHeight && !job.isBounty) && (
                            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                               {isPayee && job.deliveryHash && (
                                 <button onClick={() => handleAutoRelease(job)} className="btn-primary" style={{ flex: 1, fontSize: '0.7rem', background: 'linear-gradient(to right, #10b981, #059669)' }}>
                                   Trustless Auto-Release (Final)
                                 </button>
                               )}
                               {isPayer && !job.deliveryHash && (
                                 <button onClick={() => handleAutoRefund(job)} className="btn-primary" style={{ flex: 1, fontSize: '0.7rem', background: 'linear-gradient(to right, #ef4444, #dc2626)' }}>
                                   Trustless Auto-Refund
                                 </button>
                               )}
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => handleDispute(job)} className="btn-outline" disabled={job.isBounty} style={{ width: '100%', padding: '0.4rem', fontSize: '0.7rem', color: '#f87171', borderColor: 'rgba(248,113,113,0.1)', justifyContent: 'center', opacity: job.isBounty ? 0.3 : 1 }}>
                              <AlertTriangle size={12} /> Raise Dispute
                            </button>
                          </div>
                        </div>
                      );
                    })()}


                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Tech Stack */}
        <section style={{ marginTop: '6rem', borderTop: '1px solid var(--border-glass)', paddingTop: '4rem', paddingBottom: '4rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>Technology Stack</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-card tech-card" style={{ borderBottom: '3px solid var(--accent-emerald)' }}>
              <Cpu size={28} color="var(--accent-emerald)" />
              <h4>Leo v4.0.0 + Final Blocks</h4>
              <p>On-chain mappings with atomic finalize. 121 instructions, 7 functions, real access control.</p>
            </div>
            <div className="glass-card tech-card" style={{ borderBottom: '3px solid var(--accent-cyan)' }}>
              <Shield size={28} color="var(--accent-cyan)" />
              <h4>Records = Real Encryption</h4>
              <p>Job & EscrowReceipt records are encrypted by Aleo. Only the owner can decrypt and view contents.</p>
            </div>
            <div className="glass-card tech-card" style={{ borderBottom: '3px solid #8b5cf6' }}>
              <Globe size={28} color="#8b5cf6" />
              <h4>Verifiable On-Chain</h4>
              <p>Escrow state stored in public mappings. TVL tracking. Every transaction verifiable on Aleo Explorer.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Partial Release Modal */}
      {showPartialModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '400px' }}>
            <h3>Release Payment</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
               Enter amount to release to {showPartialModal.payee.slice(0,10)}...
               <br/>Max: {formatCredits(showPartialModal.budget - (showPartialModal.releasedAmount || 0))} ALEO
            </p>
            <input 
              type="number" 
              placeholder="Amount in ALEO" 
              value={partialAmount} 
              onChange={(e) => setPartialAmount(e.target.value)}
              className="form-input"
              style={{ margin: '1.5rem 0' }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowPartialModal(null)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
              <button 
                onClick={() => handleRelease(showPartialModal, Math.floor(parseFloat(partialAmount) * 1000000))} 
                className="btn-primary" 
                disabled={!partialAmount || parseFloat(partialAmount) <= 0 || isProcessing}
                style={{ flex: 1 }}
              >
                {isProcessing ? <Loader size={12} className="spin-slow" /> : 'Confirm Release'}
              </button>
            </div>
            {txStatus === 'error' && txError && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#fca5a5' }}>
                <span style={{ fontWeight: 'bold' }}>Error:</span> {txError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '500px' }}>
            <h3>Submit Work Proof</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
               Provide a cryptographic hash of your delivery or any field value to serve as on-chain proof. 
               This empowers you to use "Auto-Release" if the payer is unresponsive after the deadline.
            </p>
            <input 
              type="text" 
              placeholder="SHA256 Hash or custom ID (e.g. deliverable_v1_field)" 
              value={deliveryHashInput} 
              onChange={(e) => setDeliveryHashInput(e.target.value)}
              className="form-input"
              style={{ margin: '1.5rem 0' }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowDeliveryModal(null)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
              <button 
                onClick={() => handleSubmitDelivery(showDeliveryModal)} 
                className="btn-primary" 
                disabled={isProcessing}
                style={{ flex: 1 }}
              >
                {isProcessing ? <Loader size={12} className="spin-slow" /> : 'Submit On-Chain Proof'}
              </button>
            </div>
            {txStatus === 'error' && txError && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#fca5a5' }}>
                <span style={{ fontWeight: 'bold' }}>Error:</span> {txError}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          padding: 2.5rem;
          width: 90%;
        }
        .form-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.5rem;
          color: white;
          outline: none;
        }
      `}</style>
    </div>
  );
}
