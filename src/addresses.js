export const BSC = 56
export const __DELETE = 43114

export const BASE = 84531;

export const addresses = {
  
   
    [BASE]: {
        EDDX: '0xF6E6EA5933c3578696e7C0E452ebdDf34eaAB0fb',
        BTC: '0x1AcF131de5Bbc72aE96eE5EC7b59dA2f38b19DBd',
        ETH: '0x4200000000000000000000000000000000000006',
        LINK: '0x63bA205dA17003AB46CE0dd78bE8ba8EE3952e5F',
        USDT: '0x8654F060EB1e5533C259cDcBBe39834Bb8141cF4',
        DAI: '0xFE9cdCC77fb826B380D49F53c8cE298B600cB7F0',
        USDC: '0xEcb03BBCF83E863B9053A926932DbB07D837eBbE',
        RewardReader: '0x23cB653Be8A6A0189021A3FFe8Ce5e810b34cd98',
        ELP: '0x6990421F17Aa900a7c2474e4316fe4C7C0985236',
        ElpManager: '0xC6AB50cF3bDEa07B765c1fBFf3F566Ad7aA399dA'
    },
}

export function getAddress(chainId, key) {
    if (!(chainId) in addresses) {
        throw new Error(`Unknown chain ${chainId}`)
    }
    if (!(key in addresses[chainId])) {
        throw new Error(`Unknown address key ${key}`)
    }
    return addresses[chainId][key]
}
