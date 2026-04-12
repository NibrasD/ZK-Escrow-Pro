# ZK-Escrow Pro

**A Privacy-First Payment Settlement Layer for Trustless Work Agreements**

ZK-Escrow Pro is a decentralized, zero-knowledge escrow service built natively on the Aleo blockchain. By leveraging Aleo's core execution environment and UTXO (Unspent Transaction Output) model, ZK-Escrow Pro facilitates secure, multi-party financial agreements where sensitive parameters—such as the identities of the payer, payee, and mediator—are completely shielded from public view.

Unlike traditional smart contracts where shared state mappings expose transactional relationships to the entire network, ZK-Escrow Pro establishes localized, record-based authorization tokens (Tickets) that mathematically prove the rights of execution while adhering to strict privacy bounds.

## Key Features

- **True ZK Privacy**: Integrates deeply with Aleo's native `credits.aleo` program. Uses `transfer_private_to_public` for funding and `transfer_public_to_private` for shielded payouts, ensuring that the destination address for gig payouts is never revealed on-chain.
- **Identity Concealment**: The Payer, Payee, and even the Escrow Mediator are never stored in plaintext on the public block state. Identities are securely reduced to `BHP256` hashes, rendering network graph analysis impossible.
- **Role-Based UTXO Tickets**: Creates `PayerTicket` and `PayeeTicket` records. These act as persistent, zero-knowledge authorization keys passed between transitions.
- **Trustless Delivery Verification**: Supports off-chain delivery workflows coupled with an on-chain delivery cryptographic hash proof to prove the timeline of work completion without revealing intellectual property.
- **Auto-Release & Auto-Refund triggers**: Enforces smart deadlines (block height limits) to protect parties against unresponsiveness. Auto-releases can be triggered if delivery proofs are on-chain, and auto-refunds if the deadline breached with no delivery.
- **Partial Payments & Flexible Dispute Resolution**: Supports dynamic payout percentages during escrow execution and provides mediators mathematical boundaries limiting payout destinations exclusively to the payer or payee.

## How It Works (Brief Overview)

1. **Funding (Shielded)**: The Payer utilizes private `credits.record` to fund the escrow agreement. 
2. **Ticket Issuance**: The compiler locally mints a `PayerTicket` (kept by the payer) and `PayeeTicket` (issued to the freelancer). The on-chain state only recognizes the hash of the identities mapping to an escrow ID.
3. **Execution**: Transitions such as `submit_delivery`, `release_payment`, or `claim_bounty` are invoked by consuming an authorization ticket.
4. **Resolution**: Funds are distributed seamlessly directly into the private, shielded balance of the resulting winner.

## ⚠️ Aleo Network Constraints & ZK-Privacy Trade-offs

A core value of ZK-Escrow Pro is transparency about what is **Hidden** vs. **Verifiable**.

In the current Aleo network architecture, smart contracts (Programs) do NOT possess private keys. As a result, contracts cannot hold native `credits.aleo` records in a completely shielded state. To securely lock funds within a trustless contract mapping, ZK-Escrow Pro utilizes the `transfer_private_to_public` function.

**What this means:**
- **Public TVL (Verifiable):** The Aleo Explorer will show the exact *Amount* of ALEO transferred into the Escrow contract's public balance. This enables public accountability and Total Value Locked (TVL) tracking.
- **Perfect Anonymity (Hidden):** Despite the amount being visible, **EVERYTHING ELSE is cryptographically shielded**. The network cannot see:
  - Who funded the escrow (Payer)
  - Who will receive the funds (Payee)
  - Who the mediator is
  - The conditions, deliverable hashes, or job titles.

All of these interactions are confined locally to the `PayeeTicket` and `PayerTicket` Unspent Transaction Outputs (UTXOs) resting within the participants' wallets!

## 🧩 Advanced Frontend Cryptography
- **Shield Wallet Auto-Decrypt Shim**: Integrates an advanced local proxy to handle raw network Ciphertexts emitted by Provable's Shield Wallet. It intercepts encrypted records, queries the wallet's local `decrypt` module, and pipes the plaintext natively into the app without relying on caching servers.
- **Auto-Hasher**: Allows users to input standard text (e.g. "Done" or "Website Link") during Delivery submission, which is instantly converted into an Aleo-compatible scalar field securely using collision-resistant Bit-Shifting algorithms before being verified on-chain.

## Local Setup & Deployment

### Prerequisites
- [Leo (v4.0.0+)](https://developer.aleo.org/leo/installation)
- Aleo Wallet / Shielded Setup

### Compilation
```bash
cd contracts/zk_escrow_v6_prod
leo build
```

### Deployment to Testnet
You can easily deploy the contract directly using the provided deployment script.
```bash
./deploy.bat
```
Follow the prompt to insert your testnet Beta private key. The script will securely deploy using the Provable testnet endpoint.

## Project Structure
- `/contracts/zk_escrow_v6_prod`: Core Aleo smart contracts fully compliant with V4 network upgrades.
- `/frontend`: Client-facing web dashboard optimized for Wallet Adapter handling of local Aleo records.
