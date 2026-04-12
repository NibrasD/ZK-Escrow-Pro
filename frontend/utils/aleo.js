import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter';

let wallet = null;

export const getWallet = () => {
    if (!wallet) {
        wallet = new LeoWalletAdapter();
    }
    return wallet;
};

export const connectWallet = async () => {
    const w = getWallet();
    try {
        await w.connect();
        return w.publicKey;
    } catch (err) {
        console.error(err);
        return null;
    }
};

export const createTransaction = async (functionName, inputs) => {
    const w = getWallet();
    if (!w.connected) await w.connect();

    const contractAddress = 'aleo1...';

    try {
        const tx = await w.requestTransaction({
            programId: 'zk_escrow_pro.aleo',
            functionName: functionName,
            inputs: inputs,
            fee: 100000,
        });
        return tx;
    } catch (err) {
        console.error(err);
        throw err;
    }
};
