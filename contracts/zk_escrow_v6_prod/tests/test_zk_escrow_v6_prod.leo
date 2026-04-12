// The 'test_zk_escrow_v6_prod' test program.
import zk_escrow_v6_prod.aleo;
program test_zk_escrow_v6_prod.aleo {
    @test
    @should_fail
    fn test_main_fails() {
        let result: u32 = zk_escrow_v6_prod.aleo::main(2u32, 3u32);
        assert_eq(result, 3u32);
    }

    @noupgrade
    constructor() {}
}
