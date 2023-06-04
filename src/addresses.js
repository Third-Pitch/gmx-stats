export const BSC = 56
export const __DELETE = 43114

export const BASE = 84531;

export const addresses = {
  
   
    [BASE]: {
        EDDX: '0x24B63ae170152FcCF6a11Cd77ffa2D7F04ed999D',
        BTC: '0x1AcF131de5Bbc72aE96eE5EC7b59dA2f38b19DBd',
        ETH: '0x4200000000000000000000000000000000000006',
        LINK: '0x63bA205dA17003AB46CE0dd78bE8ba8EE3952e5F',
        USDT: '0x8654F060EB1e5533C259cDcBBe39834Bb8141cF4',
        DAI: '0xFE9cdCC77fb826B380D49F53c8cE298B600cB7F0',
        USDC: '0xEcb03BBCF83E863B9053A926932DbB07D837eBbE',
        RewardReader: '0xD3Ac10fBfD8e1484Ac48C7Af408e104a2364B7D1',
        ELP: '0x897Cc73723966a0648E99281986eeff71313E95F',
        ElpManager: '0x1379acfCD7e4AD52A06560F694DCeB5D442EBe1A'
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
