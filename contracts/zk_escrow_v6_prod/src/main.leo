import credits.aleo;

program zk_escrow_v6_prod.aleo {

    @noupgrade
    constructor() {}

    struct PublicEscrow {
        status: u8,
        is_bounty: bool,
        deadline: u32,
        mediator_hash: field,
        payer_hash: field,
        payee_hash: field,
        whitelist_hash: field,
        amount_hash: field 
    }

    mapping escrows: field => PublicEscrow;
    mapping total_locked: u8 => u64; 
    mapping deliveries: field => field;

    record PayerTicket {
        owner: address,
        escrow_id: field,
        amount: u64
    }

    record PayeeTicket {
        owner: address,
        escrow_id: field,
        amount: u64
    }

    fn create_escrow(
        input_funds: credits.aleo::credits, 
        private payee: address,
        private budget: u64,
        mediator_hash: field,
        escrow_id: field,
        is_bounty: bool,
        deadline: u32,
        is_restricted: bool,
        private whitelist: address
    ) -> (PayerTicket, PayeeTicket, credits.aleo::credits, Final) {
        
        let caller: address = self.caller;
        let payer_ticket: PayerTicket = PayerTicket {
            owner: caller,
            escrow_id: escrow_id,
            amount: budget
        };

        let payee_ticket: PayeeTicket = PayeeTicket {
            owner: payee,
            escrow_id: escrow_id,
            amount: budget
        };

        let payer_hash: field = BHP256::hash_to_field(caller);
        let payee_hash: field = BHP256::hash_to_field(payee);
        let amount_hash: field = BHP256::hash_to_field(budget);
        
        let zero_addr: address = aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc;
        let final_whitelist: address = is_restricted ? whitelist : zero_addr;
        let whitelist_hash: field = BHP256::hash_to_field(final_whitelist);

        let (change, f): (credits.aleo::credits, Final) = credits.aleo::transfer_private_to_public(
            input_funds,
            zk_escrow_v6_prod.aleo,
            budget
        );

        return (payer_ticket, payee_ticket, change, final {
            f.run();
            let data: PublicEscrow = PublicEscrow {
                status: 0u8,
                is_bounty: is_bounty,
                deadline: deadline,
                mediator_hash: mediator_hash,
                payer_hash: payer_hash,
                payee_hash: payee_hash,
                whitelist_hash: whitelist_hash,
                amount_hash: amount_hash
            };
            escrows.set(escrow_id, data);

            let current_tvl: u64 = total_locked.get_or_use(0u8, 0u64);
            total_locked.set(0u8, current_tvl + budget);
        });
    }

    fn claim_bounty(
        escrow_id: field,
        private amount: u64
    ) -> (PayeeTicket, Final) {
        let claimant: address = self.caller;
        let claimant_hash: field = BHP256::hash_to_field(claimant);
        let amount_hash: field = BHP256::hash_to_field(amount);

        let ticket: PayeeTicket = PayeeTicket {
            owner: claimant,
            escrow_id: escrow_id,
            amount: amount
        };

        return (ticket, final {
            let data: PublicEscrow = escrows.get(escrow_id);
            assert(data.is_bounty);
            assert(data.status == 0u8);
            assert_eq(data.amount_hash, amount_hash);
            
            let open_hash: field = BHP256::hash_to_field(aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc);
            let is_open: bool = (data.whitelist_hash == open_hash);
            let is_whitelisted: bool = (data.whitelist_hash == claimant_hash);
            assert(is_open || is_whitelisted);

            let updated: PublicEscrow = PublicEscrow {
                status: 4u8, 
                is_bounty: false,
                deadline: data.deadline,
                mediator_hash: data.mediator_hash,
                payer_hash: data.payer_hash,
                payee_hash: claimant_hash, 
                whitelist_hash: data.whitelist_hash,
                amount_hash: data.amount_hash
            };
            escrows.set(escrow_id, updated);
        });
    }

    fn submit_delivery(
        ticket: PayeeTicket,
        delivery_hash: field
    ) -> (PayeeTicket, Final) {
        let new_ticket: PayeeTicket = PayeeTicket {
            owner: ticket.owner,
            escrow_id: ticket.escrow_id,
            amount: ticket.amount
        };
        let caller_hash: field = BHP256::hash_to_field(self.caller);
        let ext_escrow_id: field = ticket.escrow_id; 

        return (new_ticket, final {
            let data: PublicEscrow = escrows.get(ext_escrow_id);
            assert_eq(data.payee_hash, caller_hash);
            let is_valid_status: bool = (data.status == 0u8) || (data.status == 4u8);
            assert(is_valid_status);
            deliveries.set(ext_escrow_id, delivery_hash);
        });
    }

    fn release_payment(
        ticket: PayerTicket,
        private payee: address, 
        private release_amount: u64
    ) -> (PayerTicket, credits.aleo::credits, Final) {
        
        let caller_hash: field = BHP256::hash_to_field(self.caller);
        let payee_hash: field = BHP256::hash_to_field(payee);

        let remaining: u64 = ticket.amount - release_amount; 

        let new_ticket: PayerTicket = PayerTicket {
            owner: ticket.owner,
            escrow_id: ticket.escrow_id,
            amount: remaining
        };
        
        let ext_escrow_id: field = ticket.escrow_id;

        let (shielded_funds, f): (credits.aleo::credits, Final) = credits.aleo::transfer_public_to_private(payee, release_amount);

        return (new_ticket, shielded_funds, final {
            f.run();
            let data: PublicEscrow = escrows.get(ext_escrow_id);
            assert_eq(data.payer_hash, caller_hash);
            assert_eq(data.payee_hash, payee_hash); 
            
            let is_valid_status: bool = (data.status == 0u8) || (data.status == 4u8);
            assert(is_valid_status);

            let new_status: u8 = (remaining == 0u64) ? 2u8 : data.status;

            let updated: PublicEscrow = PublicEscrow {
                status: new_status,
                is_bounty: data.is_bounty,
                deadline: data.deadline,
                mediator_hash: data.mediator_hash,
                payer_hash: data.payer_hash,
                payee_hash: data.payee_hash,
                whitelist_hash: data.whitelist_hash,
                amount_hash: data.amount_hash
            };
            escrows.set(ext_escrow_id, updated);

            let current_tvl: u64 = total_locked.get_or_use(0u8, 0u64);
            total_locked.set(0u8, current_tvl - release_amount);
        });
    }

    fn auto_release(
        ticket: PayeeTicket,
        private remaining_amount: u64
    ) -> (PayeeTicket, credits.aleo::credits, Final) {
        let caller: address = self.caller;
        let caller_hash: field = BHP256::hash_to_field(caller);
        let amount_hash: field = BHP256::hash_to_field(remaining_amount);
        
        let new_ticket: PayeeTicket = PayeeTicket {
            owner: ticket.owner,
            escrow_id: ticket.escrow_id,
            amount: 0u64 
        };

        let ext_escrow_id: field = ticket.escrow_id;
        let (shielded_funds, f): (credits.aleo::credits, Final) = credits.aleo::transfer_public_to_private(caller, remaining_amount);
        
        return (new_ticket, shielded_funds, final {
            f.run();
            let data: PublicEscrow = escrows.get(ext_escrow_id);
            assert_eq(data.payee_hash, caller_hash);
            assert_eq(data.amount_hash, amount_hash);
            assert(data.status == 0u8 || data.status == 4u8);
            assert(block.height > data.deadline);
            assert(deliveries.contains(ext_escrow_id));

            let updated: PublicEscrow = PublicEscrow {
                status: 2u8,
                is_bounty: false,
                deadline: data.deadline,
                mediator_hash: data.mediator_hash,
                payer_hash: data.payer_hash,
                payee_hash: data.payee_hash,
                whitelist_hash: data.whitelist_hash,
                amount_hash: data.amount_hash
            };
            escrows.set(ext_escrow_id, updated);

            let current_tvl: u64 = total_locked.get_or_use(0u8, 0u64);
            total_locked.set(0u8, current_tvl - remaining_amount);
        });
    }

    fn refund_payment(
        ticket: PayerTicket,
        private amount: u64
    ) -> (PayerTicket, credits.aleo::credits, Final) {
        let caller: address = self.caller;
        let caller_hash: field = BHP256::hash_to_field(caller);
        let amount_hash: field = BHP256::hash_to_field(amount);

        let new_ticket: PayerTicket = PayerTicket {
            owner: ticket.owner,
            escrow_id: ticket.escrow_id,
            amount: 0u64
        };
        let ext_escrow_id: field = ticket.escrow_id;
        let (shielded_funds, f): (credits.aleo::credits, Final) = credits.aleo::transfer_public_to_private(caller, amount);
        
        return (new_ticket, shielded_funds, final {
            f.run();
            let data: PublicEscrow = escrows.get(ext_escrow_id);
            assert_eq(data.payer_hash, caller_hash);
            assert_eq(data.amount_hash, amount_hash);
            assert(data.status == 0u8);

            let updated: PublicEscrow = PublicEscrow {
                status: 3u8,
                is_bounty: data.is_bounty,
                deadline: data.deadline,
                mediator_hash: data.mediator_hash,
                payer_hash: data.payer_hash,
                payee_hash: data.payee_hash,
                whitelist_hash: data.whitelist_hash,
                amount_hash: data.amount_hash
            };
            escrows.set(ext_escrow_id, updated);

            let current_tvl: u64 = total_locked.get_or_use(0u8, 0u64);
            total_locked.set(0u8, current_tvl - amount);
        });
    }

    fn auto_refund(
        ticket: PayerTicket,
        private amount: u64
    ) -> (PayerTicket, credits.aleo::credits, Final) {
        let caller: address = self.caller;
        let caller_hash: field = BHP256::hash_to_field(caller);
        let amount_hash: field = BHP256::hash_to_field(amount);

        let new_ticket: PayerTicket = PayerTicket {
            owner: ticket.owner,
            escrow_id: ticket.escrow_id,
            amount: 0u64
        };
        let ext_escrow_id: field = ticket.escrow_id;
        let (shielded_funds, f): (credits.aleo::credits, Final) = credits.aleo::transfer_public_to_private(caller, amount);
        
        return (new_ticket, shielded_funds, final {
            f.run();
            let data: PublicEscrow = escrows.get(ext_escrow_id);
            assert_eq(data.payer_hash, caller_hash);
            assert_eq(data.amount_hash, amount_hash);
            assert(data.status == 0u8 || data.status == 4u8);
            assert(block.height > data.deadline);
            assert(!deliveries.contains(ext_escrow_id));

            let updated: PublicEscrow = PublicEscrow {
                status: 3u8,
                is_bounty: data.is_bounty,
                deadline: data.deadline,
                mediator_hash: data.mediator_hash,
                payer_hash: data.payer_hash,
                payee_hash: data.payee_hash,
                whitelist_hash: data.whitelist_hash,
                amount_hash: data.amount_hash
            };
            escrows.set(ext_escrow_id, updated);

            let current_tvl: u64 = total_locked.get_or_use(0u8, 0u64);
            total_locked.set(0u8, current_tvl - amount);
        });
    }

    fn raise_dispute_payer(ticket: PayerTicket) -> (PayerTicket, Final) {
        let caller_hash: field = BHP256::hash_to_field(self.caller);
        let new_ticket: PayerTicket = PayerTicket {
            owner: ticket.owner,
            escrow_id: ticket.escrow_id,
            amount: ticket.amount
        };
        let ext_escrow_id: field = ticket.escrow_id;

        return (new_ticket, final {
            let data: PublicEscrow = escrows.get(ext_escrow_id);
            assert_eq(data.payer_hash, caller_hash);
            assert(data.status == 0u8 || data.status == 4u8);

            let updated: PublicEscrow = PublicEscrow {
                status: 1u8,
                is_bounty: data.is_bounty,
                deadline: data.deadline,
                mediator_hash: data.mediator_hash,
                payer_hash: data.payer_hash,
                payee_hash: data.payee_hash,
                whitelist_hash: data.whitelist_hash,
                amount_hash: data.amount_hash
            };
            escrows.set(ext_escrow_id, updated);
        });
    }

    fn raise_dispute_payee(ticket: PayeeTicket) -> (PayeeTicket, Final) {
        let caller_hash: field = BHP256::hash_to_field(self.caller);
        let new_ticket: PayeeTicket = PayeeTicket {
            owner: ticket.owner,
            escrow_id: ticket.escrow_id,
            amount: ticket.amount
        };
        let ext_escrow_id: field = ticket.escrow_id;

        return (new_ticket, final {
            let data: PublicEscrow = escrows.get(ext_escrow_id);
            assert_eq(data.payee_hash, caller_hash);
            assert(data.status == 0u8 || data.status == 4u8);

            let updated: PublicEscrow = PublicEscrow {
                status: 1u8,
                is_bounty: data.is_bounty,
                deadline: data.deadline,
                mediator_hash: data.mediator_hash,
                payer_hash: data.payer_hash,
                payee_hash: data.payee_hash,
                whitelist_hash: data.whitelist_hash,
                amount_hash: data.amount_hash
            };
            escrows.set(ext_escrow_id, updated);
        });
    }

    fn resolve_dispute(
        escrow_id: field,
        private winner: address,
        private amount: u64
    ) -> (credits.aleo::credits, Final) {
        let caller: address = self.caller;
        let winner_hash: field = BHP256::hash_to_field(winner);
        let amount_hash: field = BHP256::hash_to_field(amount);
        
        let (shielded_funds, f): (credits.aleo::credits, Final) = credits.aleo::transfer_public_to_private(winner, amount);
        
        return (shielded_funds, final {
            f.run();
            let data: PublicEscrow = escrows.get(escrow_id);
            let med_hash: field = BHP256::hash_to_field(caller);
            assert_eq(data.mediator_hash, med_hash);
            assert_eq(data.amount_hash, amount_hash);
            assert(data.status == 1u8);
            
            let is_party: bool = (winner_hash == data.payer_hash) || (winner_hash == data.payee_hash);
            assert(is_party);

            let updated: PublicEscrow = PublicEscrow {
                status: (winner_hash == data.payee_hash) ? 2u8 : 3u8,
                is_bounty: false,
                deadline: data.deadline,
                mediator_hash: data.mediator_hash,
                payer_hash: data.payer_hash,
                payee_hash: data.payee_hash,
                whitelist_hash: data.whitelist_hash,
                amount_hash: data.amount_hash
            };
            escrows.set(escrow_id, updated);

            let current_tvl: u64 = total_locked.get_or_use(0u8, 0u64);
            total_locked.set(0u8, current_tvl - amount);
        });
    }
}
