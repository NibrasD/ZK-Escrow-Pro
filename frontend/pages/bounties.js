import { useState, useEffect } from 'react';
import Head from 'next/head';
import WalletConnect from '../components/WalletConnect';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { Shield, Target, UserPlus, Eye, Briefcase, Award, ArrowLeft, Terminal, Loader, RefreshCw, Lock, Clock } from 'lucide-react';
import { PROGRAM_ID, ALEO_API } from '../utils/contract_code';
import { getMappingValue, parseLeoStruct } from '../utils/aleo-api-utils';

export default function BountyBoard() {
  const { publicKey, wallet, connected, requestTransaction, requestRecords } = useWallet();
  let activeAddress = null;
  if (publicKey) activeAddress = typeof publicKey === 'string' ? publicKey : publicKey.toString();
  else if (wallet?.adapter?.publicKey) {
    activeAddress = typeof wallet.adapter.publicKey === 'string' ? wallet.adapter.publicKey : wallet.adapter.publicKey.toString();
  }
  const [bounties, setBounties] = useState([]);
  const [isClaiming, setIsClaiming] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [claimAmount, setClaimAmount] = useState({}); // { escrowId: amount }

  // Fetch a single bounty from on-chain mapping by escrow ID
  const fetchBounty = async (escrowId) => {
    let idStr = escrowId.trim();
    if (!idStr.endsWith('field')) idStr += 'field';

    const rawData = await getMappingValue(PROGRAM_ID, 'escrows', idStr);
    if (!rawData) return null;

    const data = parseLeoStruct(rawData);
    
    // Check whitelist if exists
    const whitelistRaw = await getMappingValue(PROGRAM_ID, 'bounty_whitelist', idStr);
    const whitelist = whitelistRaw ? whitelistRaw.replace('.public', '') : null;
    const isRestricted = whitelist && !whitelist.includes('aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc');

    return {
      escrowId: idStr,
      payerHash: data.payer_hash,
      payeeHash: data.payee_hash,
      budget: 'Zero-Knowledge', // Mapping doesn't store budget in V6
      statusNum: parseInt(data.status?.replace('u8', '')) || 0,
      mediatorHash: data.mediator_hash,
      isBounty: data.is_bounty === 'true',
      deadline: parseInt(data.deadline?.replace('u32', '')) || 0,
      whitelist: whitelist,
      isRestricted
    };
  };

  const handleSearchBounty = async () => {
    if (!searchId.trim()) return;
    setIsLoading(true);
    try {
      const bounty = await fetchBounty(searchId);
      if (!bounty) {
        alert('Escrow not found on the blockchain.');
        return;
      }
      if (!bounty.isBounty) {
        alert('This escrow exists but is NOT an open bounty (is_bounty = false).');
        return;
      }
      if (bounty.statusNum !== 0) {
        alert('This bounty has already been claimed or completed (status ≠ 0).');
        return;
      }
      // Avoid duplicates
      if (bounties.some(b => b.escrowId === bounty.escrowId)) {
        alert('This bounty is already in your list.');
        return;
      }
      setBounties(prev => [bounty, ...prev]);
      setSearchId('');
    } catch (err) {
      alert('Error fetching bounty: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimBounty = async (bounty) => {
    if (!activeAddress) { alert("Please connect your wallet first!"); return; }
    setIsClaiming(bounty.escrowId);
    try {
      const amountUnits = Math.floor(parseFloat(claimAmount[bounty.escrowId] || 0) * 1_000_000);
      if (amountUnits <= 0) { alert("Please enter the expected reward amount first."); return; }

      const txId = await requestTransaction({
        address: activeAddress,
        chainId: 'testnetbeta',
        transitions: [{
          program: PROGRAM_ID,
          functionName: 'claim_bounty',
          inputs: [
            bounty.escrowId,
            { private: `${amountUnits}u64` } 
          ],
        }],
        fee: 300_000,
      });
      alert('🚀 Bounty claim submitted! Tx: ' + txId);
      // Mark as claimed in local state
      setBounties(prev => prev.map(b =>
        b.escrowId === bounty.escrowId
          ? { ...b, statusNum: 4, isBounty: false, payee: activeAddress }
          : b
      ));
    } catch (err) {
      alert('Failed to claim bounty: ' + err.message);
    } finally {
      setIsClaiming(null);
    }
  };

  const formatCredits = (mc) => (mc / 1_000_000).toFixed(6);

  return (
    <div className="container">
      <Head>
        <title>Bounty Board | ZK-Escrow Pro</title>
        <meta name="description" content="Claim open bounties on the Aleo blockchain with zero-knowledge proofs." />
      </Head>

      <header>
        <div className="logo">
          <Shield size={28} />
          ZK-Escrow Pro
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <a href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
            <ArrowLeft size={16} /> Dashboard
          </a>
          <WalletConnect />
        </div>
      </header>

      <main>
        <section className="hero" style={{ padding: '3rem 0' }}>
          <div className="badge badge-emerald" style={{ marginBottom: '1.5rem' }}>
            <Award size={14} /> Open Opportunities
          </div>
          <h1>Bounty Board</h1>
          <p>Search for open bounties by Escrow ID and claim them on-chain. Your claim locks in your address as the payee.</p>
        </section>

        {/* Search for bounty by ID */}
        <section className="glass-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={18} color="var(--accent-cyan)" /> Find Bounty by Escrow ID
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Enter escrow ID (e.g. 1234567890field)"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchBounty()}
              style={{
                flex: 1, padding: '0.75rem 1rem', borderRadius: '0.75rem',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)',
                color: 'white', fontSize: '0.9rem', fontFamily: 'JetBrains Mono, monospace',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSearchBounty}
              className="btn-primary"
              disabled={isLoading || !searchId.trim()}
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {isLoading ? <Loader size={16} className="spin-slow" /> : <><RefreshCw size={16} /> Fetch</>}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            The bounty creator should share the Escrow ID with you. The system will verify it's a valid open bounty on-chain.
          </p>
        </section>

        {/* Bounty list */}
        {bounties.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <Briefcase size={40} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>No bounties loaded</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Search for an open bounty by Escrow ID above.</p>
          </div>
        ) : (
          <div className="grid">
            {bounties.map(bounty => (
              <div key={bounty.escrowId} className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div className={`badge ${bounty.statusNum === 0 ? 'badge-emerald' : 'badge-cyan'}`}>
                    <Briefcase size={12} /> {bounty.statusNum === 0 ? 'Open' : 'Claimed'}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {bounty.escrowId.length > 20 ? bounty.escrowId.slice(0, 20) + '...' : bounty.escrowId}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem' }}>
                  {bounty.isBounty ? 'Open Bounty' : 'Claimed Bounty'}
                </h3>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', border: '1px solid var(--border-glass)', borderRadius: '1rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Reward</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-emerald)' }}>
                    {bounty.budget === 'Zero-Knowledge' ? 'Zero-Knowledge 🔐' : formatCredits(bounty.budget) + ' ALEO'}
                  </p>
                </div>

                {bounty.statusNum === 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Expected Amount (ALEO) to verify ZK Proof:</label>
                    <input 
                       type="number" 
                       placeholder="e.g. 10.5" 
                       value={claimAmount[bounty.escrowId] || ''} 
                       onChange={(e) => setClaimAmount(prev => ({ ...prev, [bounty.escrowId]: e.target.value }))}
                       style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem' }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <span>Payer: <code style={{ color: 'var(--tech-code)' }}>{bounty.payerHash?.slice(0, 15)}...</code></span>
                    {bounty.deadline > 0 && <span><Clock size={12}/> {bounty.deadline}</span>}
                  </div>
                  
                  {bounty.isRestricted && (
                    <div style={{ padding: '0.75rem', background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '0.5rem', marginTop: '0.5rem' }}>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Lock size={12}/> Restricted to Specific Address
                      </p>
                      <code style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', wordBreak: 'break-all', marginTop: '0.2rem', display: 'block' }}>
                        {bounty.whitelist}
                      </code>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  {bounty.statusNum === 0 && bounty.isBounty ? (
                    <button
                      onClick={() => handleClaimBounty(bounty)}
                      disabled={isClaiming === bounty.escrowId || !connected}
                      className="btn-primary"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {isClaiming === bounty.escrowId
                        ? <><Loader size={16} className="spin-slow" /> Claiming...</>
                        : <><UserPlus size={16} /> Claim Bounty</>
                      }
                    </button>
                  ) : (
                    <div style={{ flex: 1, textAlign: 'center', padding: '0.8rem', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#38bdf8', fontWeight: '500' }}>
                        ✓ Already Claimed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
