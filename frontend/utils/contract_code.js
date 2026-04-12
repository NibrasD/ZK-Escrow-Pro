// ═══════════════════════════════════════════════════════════════
// Compiled Aleo Instructions for zk_escrow_v6_prod.aleo
// ═══════════════════════════════════════════════════════════════

export const PROGRAM_ID = 'zk_escrow_v6_prod.aleo';
export const PROGRAM_ADDRESS = 'aleo1cu2uvaqqswzw4uy2mj4zlzphvl9dy2n3la9uwm348mtjlnmjfuyspmztxd';
export const PROGRAM_OWNER = 'aleo1n42us3qjpyn678a8yggs6fg8ququ6ka070qgz0cjg4ckkenx0sgs29rek2';
export const DEPLOY_TX = 'at10ssc2jee2jg8fdmhyn636dzyvry3v82r7hlh760u4mjfl3s7ncxq6kvma0';
export const OWNER_SIGNATURE = 'sign1wxgxw5xvgq4g6zc9qtvgfeazwykkyfqm0p7hpq4r3da9grkpvcphedtdf89yd05vmcutw596sedt6vs33kttvugcta3c5u23yp68jq86qn3zr8ljyvdwppy5rtpnkwh3te68znzs8zu05z2vxgc5wdcrpq3aw8ct8ug2q9056eq2ladcn5r4693cqqndpkkr9jlhz89mxu9q640k4t2';

export const ALEO_API = 'https://api.explorer.provable.com/v1/testnet';

export const STATUS_CODES = {
  0: 'locked',
  1: 'disputed',
  2: 'released',
  3: 'refunded',
  4: 'claimed',
};

// ABI — structured for both display and programmatic use
export const CONTRACT_ABI = {
  compiler: 'Leo v4.0.0',
  network: 'testnet',
  records: ['PayerTicket', 'PayeeTicket'],
  mappings: ['escrows', 'total_locked', 'deliveries'],
  structs: ['PublicEscrow'],
  functions: {
    create_escrow: {
      inputs: [
        { name: 'input_funds', type: 'credits.record' },
        { name: 'payee', type: 'address.private' },
        { name: 'budget', type: 'u64.private' },
        { name: 'mediator_hash', type: 'field.public' },
        { name: 'escrow_id', type: 'field.public' },
        { name: 'is_bounty', type: 'boolean.public' },
        { name: 'deadline', type: 'u32.public' },
        { name: 'is_restricted', type: 'boolean.public' },
        { name: 'whitelist', type: 'address.private' }
      ],
      description: 'Lock real ALEO credits into a private record-based escrow.',
    },
    claim_bounty: {
      inputs: [
        { name: 'escrow_id', type: 'field.private' },
        { name: 'amount', type: 'u64.private' }
      ],
      description: 'Claim an open bounty with ZK amount verification.',
    },
    release_payment: {
      inputs: [
        { name: 'ticket', type: 'PayerTicket.record' },
        { name: 'payee', type: 'address.private' },
        { name: 'amount', type: 'u64.private' },
      ],
      description: 'Payer releases funds to payee privately.',
    },
    refund_payment: {
      inputs: [
        { name: 'ticket', type: 'PayerTicket.record' },
        { name: 'amount', type: 'u64.private' },
      ],
      description: 'Payer refunds funds to self (direct).',
    },
    auto_refund: {
      inputs: [
        { name: 'ticket', type: 'PayerTicket.record' },
        { name: 'amount', type: 'u64.private' },
      ],
      description: 'Payer reclaims funds if deadline passed and no delivery submitted.',
    },
  },
};

// The actual compiled bytecode (matches build/main.aleo exactly)
export const CONTRACT_CODE = `import credits.aleo;
program zk_escrow_v6_prod.aleo;

record PayerTicket:
    owner as address.private;
    escrow_id as field.private;
    amount as u64.private;

record PayeeTicket:
    owner as address.private;
    escrow_id as field.private;
    amount as u64.private;

struct PublicEscrow:
    status as u8;
    is_bounty as boolean;
    deadline as u32;
    mediator_hash as field;
    payer_hash as field;
    payee_hash as field;
    whitelist_hash as field;
    amount_hash as field;

mapping escrows:
    key as field.public;
    value as PublicEscrow.public;

mapping total_locked:
    key as u8.public;
    value as u64.public;

mapping deliveries:
    key as field.public;
    value as field.public;

function create_escrow:
    input r0 as credits.aleo/credits.record;
    input r1 as address.private;
    input r2 as u64.private;
    input r3 as field.private;
    input r4 as field.private;
    input r5 as boolean.private;
    input r6 as u32.private;
    input r7 as boolean.private;
    input r8 as address.private;
    cast self.caller r4 r2 into r9 as PayerTicket.record;
    cast r1 r4 r2 into r10 as PayeeTicket.record;
    hash.bhp256 self.caller into r11 as field;
    hash.bhp256 r1 into r12 as field;
    hash.bhp256 r2 into r13 as field;
    ternary r7 r8 aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc into r14;
    hash.bhp256 r14 into r15 as field;
    call credits.aleo/transfer_private_to_public r0 zk_escrow_v6_prod.aleo r2 into r16 r17;
    async create_escrow r17 r5 r6 r3 r11 r12 r15 r13 r4 r2 into r18;
    output r9 as PayerTicket.record;
    output r10 as PayeeTicket.record;
    output r16 as credits.aleo/credits.record;
    output r18 as zk_escrow_v6_prod.aleo/create_escrow.future;

finalize create_escrow:
    input r0 as credits.aleo/transfer_private_to_public.future;
    input r1 as boolean.public;
    input r2 as u32.public;
    input r3 as field.public;
    input r4 as field.public;
    input r5 as field.public;
    input r6 as field.public;
    input r7 as field.public;
    input r8 as field.public;
    input r9 as u64.public;
    await r0;
    cast 0u8 r1 r2 r3 r4 r5 r6 r7 into r10 as PublicEscrow;
    set r10 into escrows[r8];
    get.or_use total_locked[0u8] 0u64 into r11;
    add r11 r9 into r12;
    set r12 into total_locked[0u8];

function claim_bounty:
    input r0 as field.private;
    input r1 as u64.private;
    hash.bhp256 self.caller into r2 as field;
    hash.bhp256 r1 into r3 as field;
    cast self.caller r0 r1 into r4 as PayeeTicket.record;
    async claim_bounty r0 r3 r2 into r5;
    output r4 as PayeeTicket.record;
    output r5 as zk_escrow_v6_prod.aleo/claim_bounty.future;

finalize claim_bounty:
    input r0 as field.public;
    input r1 as field.public;
    input r2 as field.public;
    get escrows[r0] into r3;
    assert.eq r3.is_bounty true;
    is.eq r3.status 0u8 into r4;
    assert.eq r4 true;
    assert.eq r3.amount_hash r1;
    is.eq r3.whitelist_hash 7833185298839889869212594806745334335817950658667461917749505843801426271110field into r5;
    is.eq r3.whitelist_hash r2 into r6;
    or r5 r6 into r7;
    assert.eq r7 true;
    cast 4u8 false r3.deadline r3.mediator_hash r3.payer_hash r2 r3.whitelist_hash r3.amount_hash into r8 as PublicEscrow;
    set r8 into escrows[r0];

function submit_delivery:
    input r0 as PayeeTicket.record;
    input r1 as field.private;
    cast r0.owner r0.escrow_id r0.amount into r2 as PayeeTicket.record;
    hash.bhp256 self.caller into r3 as field;
    async submit_delivery r0.escrow_id r3 r1 into r4;
    output r2 as PayeeTicket.record;
    output r4 as zk_escrow_v6_prod.aleo/submit_delivery.future;

finalize submit_delivery:
    input r0 as field.public;
    input r1 as field.public;
    input r2 as field.public;
    get escrows[r0] into r3;
    assert.eq r3.payee_hash r1;
    is.eq r3.status 0u8 into r4;
    is.eq r3.status 4u8 into r5;
    or r4 r5 into r6;
    assert.eq r6 true;
    set r2 into deliveries[r0];

function release_payment:
    input r0 as PayerTicket.record;
    input r1 as address.private;
    input r2 as u64.private;
    hash.bhp256 self.caller into r3 as field;
    hash.bhp256 r1 into r4 as field;
    sub r0.amount r2 into r5;
    cast r0.owner r0.escrow_id r5 into r6 as PayerTicket.record;
    call credits.aleo/transfer_public_to_private r1 r2 into r7 r8;
    async release_payment r8 r0.escrow_id r3 r4 r5 r2 into r9;
    output r6 as PayerTicket.record;
    output r7 as credits.aleo/credits.record;
    output r9 as zk_escrow_v6_prod.aleo/release_payment.future;

finalize release_payment:
    input r0 as credits.aleo/transfer_public_to_private.future;
    input r1 as field.public;
    input r2 as field.public;
    input r3 as field.public;
    input r4 as u64.public;
    input r5 as u64.public;
    await r0;
    get escrows[r1] into r6;
    assert.eq r6.payer_hash r2;
    assert.eq r6.payee_hash r3;
    is.eq r6.status 0u8 into r7;
    is.eq r6.status 4u8 into r8;
    or r7 r8 into r9;
    assert.eq r9 true;
    is.eq r4 0u64 into r10;
    ternary r10 2u8 r6.status into r11;
    cast r11 r6.is_bounty r6.deadline r6.mediator_hash r6.payer_hash r6.payee_hash r6.whitelist_hash r6.amount_hash into r12 as PublicEscrow;
    set r12 into escrows[r1];
    get.or_use total_locked[0u8] 0u64 into r13;
    sub r13 r5 into r14;
    set r14 into total_locked[0u8];

function auto_release:
    input r0 as PayeeTicket.record;
    input r1 as u64.private;
    hash.bhp256 self.caller into r2 as field;
    hash.bhp256 r1 into r3 as field;
    cast r0.owner r0.escrow_id 0u64 into r4 as PayeeTicket.record;
    call credits.aleo/transfer_public_to_private self.caller r1 into r5 r6;
    async auto_release r6 r0.escrow_id r2 r3 r1 into r7;
    output r4 as PayeeTicket.record;
    output r5 as credits.aleo/credits.record;
    output r7 as zk_escrow_v6_prod.aleo/auto_release.future;

finalize auto_release:
    input r0 as credits.aleo/transfer_public_to_private.future;
    input r1 as field.public;
    input r2 as field.public;
    input r3 as field.public;
    input r4 as u64.public;
    await r0;
    get escrows[r1] into r5;
    assert.eq r5.payee_hash r2;
    assert.eq r5.amount_hash r3;
    is.eq r5.status 0u8 into r6;
    is.eq r5.status 4u8 into r7;
    or r6 r7 into r8;
    assert.eq r8 true;
    gt block.height r5.deadline into r9;
    assert.eq r9 true;
    contains deliveries[r1] into r10;
    assert.eq r10 true;
    cast 2u8 false r5.deadline r5.mediator_hash r5.payer_hash r5.payee_hash r5.whitelist_hash r5.amount_hash into r11 as PublicEscrow;
    set r11 into escrows[r1];
    get.or_use total_locked[0u8] 0u64 into r12;
    sub r12 r4 into r13;
    set r13 into total_locked[0u8];

function refund_payment:
    input r0 as PayerTicket.record;
    input r1 as u64.private;
    hash.bhp256 self.caller into r2 as field;
    hash.bhp256 r1 into r3 as field;
    cast r0.owner r0.escrow_id 0u64 into r4 as PayerTicket.record;
    call credits.aleo/transfer_public_to_private self.caller r1 into r5 r6;
    async refund_payment r6 r0.escrow_id r2 r3 r1 into r7;
    output r4 as PayerTicket.record;
    output r5 as credits.aleo/credits.record;
    output r7 as zk_escrow_v6_prod.aleo/refund_payment.future;

finalize refund_payment:
    input r0 as credits.aleo/transfer_public_to_private.future;
    input r1 as field.public;
    input r2 as field.public;
    input r3 as field.public;
    input r4 as u64.public;
    await r0;
    get escrows[r1] into r5;
    assert.eq r5.payer_hash r2;
    assert.eq r5.amount_hash r3;
    is.eq r5.status 0u8 into r6;
    assert.eq r6 true;
    cast 3u8 r5.is_bounty r5.deadline r5.mediator_hash r5.payer_hash r5.payee_hash r5.whitelist_hash r5.amount_hash into r7 as PublicEscrow;
    set r7 into escrows[r1];
    get.or_use total_locked[0u8] 0u64 into r8;
    sub r8 r4 into r9;
    set r9 into total_locked[0u8];

function auto_refund:
    input r0 as PayerTicket.record;
    input r1 as u64.private;
    hash.bhp256 self.caller into r2 as field;
    hash.bhp256 r1 into r3 as field;
    cast r0.owner r0.escrow_id 0u64 into r4 as PayerTicket.record;
    call credits.aleo/transfer_public_to_private self.caller r1 into r5 r6;
    async auto_refund r6 r0.escrow_id r2 r3 r1 into r7;
    output r4 as PayerTicket.record;
    output r5 as credits.aleo/credits.record;
    output r7 as zk_escrow_v6_prod.aleo/auto_refund.future;

finalize auto_refund:
    input r0 as credits.aleo/transfer_public_to_private.future;
    input r1 as field.public;
    input r2 as field.public;
    input r3 as field.public;
    input r4 as u64.public;
    await r0;
    get escrows[r1] into r5;
    assert.eq r5.payer_hash r2;
    assert.eq r5.amount_hash r3;
    is.eq r5.status 0u8 into r6;
    is.eq r5.status 4u8 into r7;
    or r6 r7 into r8;
    assert.eq r8 true;
    gt block.height r5.deadline into r9;
    assert.eq r9 true;
    contains deliveries[r1] into r10;
    not r10 into r11;
    assert.eq r11 true;
    cast 3u8 r5.is_bounty r5.deadline r5.mediator_hash r5.payer_hash r5.payee_hash r5.whitelist_hash r5.amount_hash into r12 as PublicEscrow;
    set r12 into escrows[r1];
    get.or_use total_locked[0u8] 0u64 into r13;
    sub r13 r4 into r14;
    set r14 into total_locked[0u8];

function raise_dispute_payer:
    input r0 as PayerTicket.record;
    hash.bhp256 self.caller into r1 as field;
    cast r0.owner r0.escrow_id r0.amount into r2 as PayerTicket.record;
    async raise_dispute_payer r0.escrow_id r1 into r3;
    output r2 as PayerTicket.record;
    output r3 as zk_escrow_v6_prod.aleo/raise_dispute_payer.future;

finalize raise_dispute_payer:
    input r0 as field.public;
    input r1 as field.public;
    get escrows[r0] into r2;
    assert.eq r2.payer_hash r1;
    is.eq r2.status 0u8 into r3;
    is.eq r2.status 4u8 into r4;
    or r3 r4 into r5;
    assert.eq r5 true;
    cast 1u8 r2.is_bounty r2.deadline r2.mediator_hash r2.payer_hash r2.payee_hash r2.whitelist_hash r2.amount_hash into r6 as PublicEscrow;
    set r6 into escrows[r0];

function raise_dispute_payee:
    input r0 as PayeeTicket.record;
    hash.bhp256 self.caller into r1 as field;
    cast r0.owner r0.escrow_id r0.amount into r2 as PayeeTicket.record;
    async raise_dispute_payee r0.escrow_id r1 into r3;
    output r2 as PayeeTicket.record;
    output r3 as zk_escrow_v6_prod.aleo/raise_dispute_payee.future;

finalize raise_dispute_payee:
    input r0 as field.public;
    input r1 as field.public;
    get escrows[r0] into r2;
    assert.eq r2.payee_hash r1;
    is.eq r2.status 0u8 into r3;
    is.eq r2.status 4u8 into r4;
    or r3 r4 into r5;
    assert.eq r5 true;
    cast 1u8 r2.is_bounty r2.deadline r2.mediator_hash r2.payer_hash r2.payee_hash r2.whitelist_hash r2.amount_hash into r6 as PublicEscrow;
    set r6 into escrows[r0];

function resolve_dispute:
    input r0 as field.private;
    input r1 as address.private;
    input r2 as u64.private;
    hash.bhp256 r1 into r3 as field;
    hash.bhp256 r2 into r4 as field;
    call credits.aleo/transfer_public_to_private r1 r2 into r5 r6;
    async resolve_dispute r6 r0 self.caller r4 r3 r2 into r7;
    output r5 as credits.aleo/credits.record;
    output r7 as zk_escrow_v6_prod.aleo/resolve_dispute.future;

finalize resolve_dispute:
    input r0 as credits.aleo/transfer_public_to_private.future;
    input r1 as field.public;
    input r2 as address.public;
    input r3 as field.public;
    input r4 as field.public;
    input r5 as u64.public;
    await r0;
    get escrows[r1] into r6;
    hash.bhp256 r2 into r7 as field;
    assert.eq r6.mediator_hash r7;
    assert.eq r6.amount_hash r3;
    is.eq r6.status 1u8 into r8;
    assert.eq r8 true;
    is.eq r4 r6.payer_hash into r9;
    is.eq r4 r6.payee_hash into r10;
    or r9 r10 into r11;
    assert.eq r11 true;
    is.eq r4 r6.payee_hash into r12;
    ternary r12 2u8 3u8 into r13;
    cast r13 false r6.deadline r6.mediator_hash r6.payer_hash r6.payee_hash r6.whitelist_hash r6.amount_hash into r14 as PublicEscrow;
    set r14 into escrows[r1];
    get.or_use total_locked[0u8] 0u64 into r15;
    sub r15 r5 into r16;
    set r16 into total_locked[0u8];

constructor:
    assert.eq edition 0u16;

`;
