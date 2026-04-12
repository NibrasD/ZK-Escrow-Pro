import Head from 'next/head';
import { useRouter } from 'next/router';
import { Shield } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center' }}>
      <Head>
        <title>ZK-Escrow Pro | Privacy-first Escrow</title>
        <meta name="description" content="Next-generation privacy-preserving escrow on Aleo" />
      </Head>

      <main style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', animation: "fadeIn 0.8s ease-out" }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '50%', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <Shield size={64} color="#10b981" />
          </div>
        </div>
        
        <h1 style={{ fontSize: '4rem', marginBottom: '1.5rem', lineHeight: '1.1', background: 'linear-gradient(to right, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Uncompromised Privacy for Web3 Freelance
        </h1>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '1.25rem', lineHeight: '1.6' }}>
          ZK-Escrow Pro leverages Aleo's zero-knowledge cryptography to provide truly private escrow contracts. Job details and budgets remain strictly confidential until completion.
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button 
            className="btn-primary" 
            style={{ padding: '1.2rem 3rem', fontSize: '1.1rem', borderRadius: '2rem' }}
            onClick={() => router.push('/dashboard')}
          >
            Launch MVP Dashboard
          </button>
        </div>
      </main>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}
