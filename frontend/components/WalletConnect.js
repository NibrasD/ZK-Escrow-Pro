import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () => import('@demox-labs/aleo-wallet-adapter-reactui').then((res) => res.WalletMultiButton),
  { ssr: false }
);

export default function WalletConnect() {
  return (
    <div className="wallet-connect-wrapper">
      <WalletMultiButton className="wallet-btn" />
    </div>
  );
}
