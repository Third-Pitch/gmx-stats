import { useMemo, useState, useEffect } from 'react'
import { ApolloClient, InMemoryCache, gql, HttpLink } from '@apollo/client'
import { chain, sumBy, sortBy, maxBy, minBy } from 'lodash'
import fetch from 'cross-fetch';
import * as ethers from 'ethers'

import { getAddress, BASE } from './addresses'

const BigNumber = ethers.BigNumber
const formatUnits = ethers.utils.formatUnits
const { JsonRpcProvider } = ethers.providers

import RewardReader from '../abis/RewardReader.json'
import ElpManager from '../abis/ElpManager.json'
import Token from '../abis/v1/Token.json'

const providers = {
  arbitrum: new JsonRpcProvider('https://arb1.arbitrum.io/rpc'),
  avalanche: new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc'),
  base: new JsonRpcProvider('https://goerli.base.org')
}

function getProvider(chainName) {
  if (!(chainName in providers)) {
    throw new Error(`Unknown chain ${chainName}`)
  }
  return providers[chainName]
}

function getChainId(chainName) {
  const chainId = {
    base: BASE
  }[chainName]
  if (!chainId) {
    throw new Error(`Unknown chain ${chainName}`)
  }
  return chainId
}

const NOW_TS = parseInt(Date.now() / 1000)
const FIRST_DATE_TS = parseInt(+(new Date(2021, 7, 31)) / 1000)

function fillNa(arr) {
  const prevValues = {}
  let keys
  if (arr.length > 0) {
    keys = Object.keys(arr[0])
    delete keys.timestamp
    delete keys.id
  }

  for (const el of arr) {
    for (const key of keys) {
      if (!el[key]) {
        if (prevValues[key]) {
          el[key] = prevValues[key]
        }
      } else {
        prevValues[key] = el[key]
      }
    }
  }
  return arr
}

export async function queryEarnData(chainName, account) {
  const provider = getProvider(chainName)
  const chainId = getChainId(chainName)
  const rewardReader = new ethers.Contract(getAddress(chainId, 'RewardReader'), RewardReader.abi, provider)
  const elpContract = new ethers.Contract(getAddress(chainId, 'ELP'), Token.abi, provider)
  const elpManager = new ethers.Contract(getAddress(chainId, 'ElpManager'), ElpManager.abi, provider)

  let depositTokens
  let rewardTrackersForDepositBalances
  let rewardTrackersForStakingInfo


  depositTokens = [
    '0x24B63ae170152FcCF6a11Cd77ffa2D7F04ed999D',// EDDX
    '0x2DF1E0dBEC080a3Db97a19Cf955b9589EE511cfd',// esEDDX
    '0x420ddA6D4D2384d2dBa3e392143A487517C79bE1',// stakedEddxTracker sEDDX
    '0x67798B0f94378528318a5739C2d17a4652cF9A1A', //bonusEddxTracker sbEDDX
    '0xcE3929B081c1924c936dE2AB47E7e093F985f266', //bnEDDX
    '0x897Cc73723966a0648E99281986eeff71313E95F'] //ELP
  rewardTrackersForDepositBalances = [
    '0x420ddA6D4D2384d2dBa3e392143A487517C79bE1',//stakedEddxTracker
    '0x420ddA6D4D2384d2dBa3e392143A487517C79bE1',//stakedEddxTracker
    '0x67798B0f94378528318a5739C2d17a4652cF9A1A',//bonusEddxTracker
    '0x6a1B048373267BC49EEBF3915C4E72F667AcC8aC',// feeEddxTracker
    '0x6a1B048373267BC49EEBF3915C4E72F667AcC8aC',// feeEddxTracker
    '0xDb0bdACf2C8A928756D86034B133bb7F2191Ca91']//feeElpTracker
  rewardTrackersForStakingInfo = [
    '0x420ddA6D4D2384d2dBa3e392143A487517C79bE1',//stakedEddxTracker
    '0x67798B0f94378528318a5739C2d17a4652cF9A1A',//bonusEddxTracker
    '0x6a1B048373267BC49EEBF3915C4E72F667AcC8aC',// feeEddxTracker
    '0x357C8A51981237bF34759871B9a62993A77E634A',//stakedElpTracker
    '0xDb0bdACf2C8A928756D86034B133bb7F2191Ca91']//feeElpTracker

  const [
    balances,
    stakingInfo,
    elpTotalSupply,
    elpAum,
    eddxPrice
  ] = await Promise.all([
    rewardReader.getDepositBalances(account, depositTokens, rewardTrackersForDepositBalances),
    rewardReader.getStakingInfo(account, rewardTrackersForStakingInfo).then(info => {
      return rewardTrackersForStakingInfo.map((_, i) => {
        return info.slice(i * 5, (i + 1) * 5)
      })
    }),
    elpContract.totalSupply(),
    elpManager.getAumInUsdg(true),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=eddx&vs_currencies=usd').then(async res => {
      const j = await res.json()
      return j['eddx']['usd']
    })
  ])

  const elpPrice = (elpAum / 1e18) / (elpTotalSupply / 1e18)
  const now = new Date()

  return {
    ELP: {
      stakedELP: balances[5] / 1e18,
      pendingETH: stakingInfo[4][0] / 1e18,
      pendingEsEDDX: stakingInfo[3][0] / 1e18,
      elpPrice
    },
    EDDX: {
      stakedEDDX: balances[0] / 1e18,
      stakedEsEDDX: balances[1] / 1e18,
      pendingETH: stakingInfo[2][0] / 1e18,
      pendingEsEDDX: stakingInfo[0][0] / 1e18,
      eddxPrice
    },
    timestamp: parseInt(now / 1000),
    datetime: now.toISOString()
  }
}

export const tokenDecimals = {
  "0x4200000000000000000000000000000000000006": 18, // WETH
  "0x1AcF131de5Bbc72aE96eE5EC7b59dA2f38b19DBd": 18, // BTC
  "0xEcb03BBCF83E863B9053A926932DbB07D837eBbE": 18, // USDC
  "0x8654F060EB1e5533C259cDcBBe39834Bb8141cF4": 18, // USDT
  "0x63bA205dA17003AB46CE0dd78bE8ba8EE3952e5F": 18, // LINK
  "0xFE9cdCC77fb826B380D49F53c8cE298B600cB7F0": 18, // DAI
}

export const tokenSymbols = {
  // Arbitrum
  '0x1AcF131de5Bbc72aE96eE5EC7b59dA2f38b19DBd': 'BTC',
  '0x4200000000000000000000000000000000000006': 'ETH',
  '0x63bA205dA17003AB46CE0dd78bE8ba8EE3952e5F': 'LINK',
  '0xEcb03BBCF83E863B9053A926932DbB07D837eBbE': 'USDC',
  '0x8654F060EB1e5533C259cDcBBe39834Bb8141cF4': 'USDT',
  '0xFE9cdCC77fb826B380D49F53c8cE298B600cB7F0': 'DAI',
}

function getTokenDecimals(token) {
  return tokenDecimals[token] || 18
}

const knownSwapSources = {
  arbitrum: {
    '0xabbc5f99639c9b6bcb58544ddf04efa6802f4064': 'EDDX Router', // Router
    '0x09f77e8a13de9a35a7231028187e9fd5db8a2acb': 'EDDX OrderBook', // Orderbook
    '0x98a00666cfcb2ba5a405415c2bf6547c63bf5491': 'EDDX PositionManager A', // PositionManager old
    '0x87a4088bd721f83b6c2e5102e2fa47022cb1c831': 'EDDX PositionManager B', // PositionManager
    '0x75e42e6f01baf1d6022bea862a28774a9f8a4a0c': 'EDDX PositionManager C', // PositionManager 12 oct 2022
    '0xb87a436b93ffe9d75c5cfa7bacfff96430b09868': 'EDDX PositionRouter C', // PositionRouter 12 oct 2022
    '0x7257ac5d0a0aac04aa7ba2ac0a6eb742e332c3fb': 'EDDX OrderExecutor', // OrderExecutor
    '0x1a0ad27350cccd6f7f168e052100b4960efdb774': 'EDDX FastPriceFeed A', // FastPriceFeed
    '0x11d62807dae812a0f1571243460bf94325f43bb7': 'EDDX PositionExecutor', // Position Executor
    '0x3b6067d4caa8a14c63fdbe6318f27a0bbc9f9237': 'Dodo',
    '0x11111112542d85b3ef69ae05771c2dccff4faa26': '1inch',
    '0x6352a56caadc4f1e25cd6c75970fa768a3304e64': 'OpenOcean', // OpenOceanExchangeProxy
    '0x4775af8fef4809fe10bf05867d2b038a4b5b2146': 'Gelato',
    '0x5a9fd7c39a6c488e715437d7b1f3c823d5596ed1': 'LiFiDiamond',
    '0x1d838be5d58cc131ae4a23359bc6ad2dddb8b75a': 'Vovo', // Vovo BTC UP USDC (vbuUSDC)
    '0xc4bed5eeeccbe84780c44c5472e800d3a5053454': 'Vovo', // Vovo ETH UP USDC (veuUSDC)
    '0xe40beb54ba00838abe076f6448b27528dd45e4f0': 'Vovo', // Vovo BTC UP USDC (vbuUSDC)
    '0x9ba57a1d3f6c61ff500f598f16b97007eb02e346': 'Vovo', // Vovo ETH UP USDC (veuUSDC)
    '0xfa82f1ba00b0697227e2ad6c668abb4c50ca0b1f': 'JonesDAO',
    '0x226cb17a52709034e2ec6abe0d2f0a9ebcec1059': 'WardenSwap',
    '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch',
    '0x6d7a3177f3500bea64914642a49d0b5c0a7dae6d': 'deBridge',
    '0xc30141b657f4216252dc59af2e7cdb9d8792e1b0': 'socket.tech',
    '0xdd94018f54e565dbfc939f7c44a16e163faab331': 'Odos Router'
  },
  base: {
    '0xf925098c0fb905D7256a61FfA388940f8E8Be853': 'EDDX Router', // Router
    '0x9Aee9917A0E7D6fCe32751D7F93e9fB1658dD16D': 'EDDX OrderBook', // Orderbook
    '0x8475Fbe5BcCF02c66c386dD8AAf251005e4b0cC8': 'EDDX PositionManager', // PositionManager old
    '0x43Ba508844BAB522Fe17d3a063316C52f57463e8': 'EDDX OrderExecutor', // OrderExecutor
    '0x1aC4d5F83ef11bEA355bAad28AfeA0EF50250aaC': 'EDDX FastPriceFeed A', // FastPriceFeed
    '0x3b6067d4caa8a14c63fdbe6318f27a0bbc9f9237': 'Dodo',
    '0x11111112542d85b3ef69ae05771c2dccff4faa26': '1inch',
    '0x6352a56caadc4f1e25cd6c75970fa768a3304e64': 'OpenOcean', // OpenOceanExchangeProxy
    '0x4775af8fef4809fe10bf05867d2b038a4b5b2146': 'Gelato',
    '0x5a9fd7c39a6c488e715437d7b1f3c823d5596ed1': 'LiFiDiamond',
    '0x1d838be5d58cc131ae4a23359bc6ad2dddb8b75a': 'Vovo', // Vovo BTC UP USDC (vbuUSDC)
    '0xc4bed5eeeccbe84780c44c5472e800d3a5053454': 'Vovo', // Vovo ETH UP USDC (veuUSDC)
    '0xe40beb54ba00838abe076f6448b27528dd45e4f0': 'Vovo', // Vovo BTC UP USDC (vbuUSDC)
    '0x9ba57a1d3f6c61ff500f598f16b97007eb02e346': 'Vovo', // Vovo ETH UP USDC (veuUSDC)
    '0xfa82f1ba00b0697227e2ad6c668abb4c50ca0b1f': 'JonesDAO',
    '0x226cb17a52709034e2ec6abe0d2f0a9ebcec1059': 'WardenSwap',
    '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch',
    '0x6d7a3177f3500bea64914642a49d0b5c0a7dae6d': 'deBridge',
    '0xc30141b657f4216252dc59af2e7cdb9d8792e1b0': 'socket.tech',
    '0xdd94018f54e565dbfc939f7c44a16e163faab331': 'Odos Router'
  },
  avalanche: {
    '0x4296e307f108b2f583ff2f7b7270ee7831574ae5': 'EDDX OrderBook',
    '0x5f719c2f1095f7b9fc68a68e35b51194f4b6abe8': 'EDDX Router',
    '0x7d9d108445f7e59a67da7c16a2ceb08c85b76a35': 'EDDX FastPriceFeed', // FastPriceFeed
    '0xf2ec2e52c3b5f8b8bd5a3f93945d05628a233216': 'EDDX PositionManager', // PositionManager
    '0xa21b83e579f4315951ba658654c371520bdcb866': 'EDDX PositionManager C',
    '0xfff6d276bc37c61a23f06410dce4a400f66420f8': 'EDDX PositionRouter C',
    '0xc4729e56b831d74bbc18797e0e17a295fa77488c': 'Yak',
    '0x409e377a7affb1fd3369cfc24880ad58895d1dd9': 'Dodo',
    '0x6352a56caadc4f1e25cd6c75970fa768a3304e64': 'OpenOcean',
    '0x7c5c4af1618220c090a6863175de47afb20fa9df': 'Gelato',
    '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch',
    '0xdef171fe48cf0115b1d80b88dc8eab59176fee57': 'ParaSwap',
    '0x2ecf2a2e74b19aab2a62312167aff4b78e93b6c5': 'ParaSwap',
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x',
    '0xe547cadbe081749e5b3dc53cb792dfaea2d02fd2': 'EDDX PositionExecutor' // Position Executor
  }
}

const defaultFetcher = url => fetch(url).then(res => res.json())
export function useRequest(url, defaultValue, fetcher = defaultFetcher) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState()
  const [data, setData] = useState(defaultValue)

  useEffect(async () => {
    try {
      setLoading(true)
      const data = await fetcher(url)
      setData(data)
    } catch (ex) {
      console.error(ex)
      setError(ex)
    }
    setLoading(false)
  }, [url])

  return [data, loading, error]
}

export function useCoingeckoPrices(symbol, { from = FIRST_DATE_TS } = {}) {
  // token ids https://api.coingecko.com/api/v3/coins
  const _symbol = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    LINK: 'chainlink',
    UNI: 'uniswap',
    AVAX: 'avalanche-2'
  }[symbol]

  const now = Date.now() / 1000
  const days = Math.ceil(now / 86400) - Math.ceil(from / 86400) - 1

  const url = `https://api.coingecko.com/api/v3/coins/${_symbol}/market_chart?vs_currency=usd&days=${days}&interval=daily`

  const [res, loading, error] = useRequest(url)

  const data = useMemo(() => {
    if (!res || res.length === 0) {
      return null
    }

    const ret = res.prices.map(item => {
      // -1 is for shifting to previous day
      // because CG uses first price of the day, but for ELP we store last price of the day
      const timestamp = item[0] - 1
      const groupTs = parseInt(timestamp / 1000 / 86400) * 86400
      return {
        timestamp: groupTs,
        value: item[1]
      }
    })
    return ret
  }, [res])

  return [data, loading, error]
}

function getImpermanentLoss(change) {
  return 2 * Math.sqrt(change) / (1 + change) - 1
}

function getChainSubgraph(chainName) {
  return chainName === "arbitrum" ? "eddx-io/eddx-stats" : "eddx-io/eddx-avalanche-stats"
}

export function useGraph(querySource, { subgraph = null, subgraphUrl = null, chainName = "arbitrum" } = {}) {
  const query = gql(querySource)

  if (!subgraphUrl) {
    if (!subgraph) {
      subgraph = getChainSubgraph(chainName)
    }
    subgraphUrl = `https://api.thegraph.com/subgraphs/name/${subgraph}`;
  }

  subgraphUrl = `https://api.studio.thegraph.com/query/45535/test-stats/version/latest`;

  const client = new ApolloClient({
    link: new HttpLink({ uri: subgraphUrl, fetch }),
    cache: new InMemoryCache()
  })
  const [data, setData] = useState()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
  }, [querySource, setLoading])

  useEffect(() => {
    client.query({ query }).then(res => {
      setData(res.data)
      setLoading(false)
    }).catch(ex => {
      console.warn('Subgraph request failed error: %s subgraphUrl: %s', ex.message, subgraphUrl)
      setError(ex)
      setLoading(false)
    })
  }, [querySource, setData, setError, setLoading])

  return [data, loading, error]
}

export function useLastBlock(chainName = "arbitrum") {
  const [data, setData] = useState()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    providers[chainName].getBlock()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  return [data, loading, error]
}

export function useLastSubgraphBlock(chainName = "arbitrum") {
  const [data, loading, error] = useGraph(`{
    _meta {
      block {
        number
      }
    }
  }`, { chainName })
  const [block, setBlock] = useState(null)

  useEffect(() => {
    if (!data) {
      return
    }

    providers[chainName].getBlock(data._meta.block.number).then(block => {
      setBlock(block)
    })
  }, [data, setBlock])

  return [block, loading, error]
}

export function useTradersData({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const [closedPositionsData, loading, error] = useGraph(`{
    tradingStats(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { period: "daily", timestamp_gte: ${from}, timestamp_lte: ${to} }
      subgraphError: allow
    ) {
      timestamp
      profit
      loss
      profitCumulative
      lossCumulative
      longOpenInterest
      shortOpenInterest
    }
  }`, { chainName })
  const [feesData] = useFeesData({ from, to, chainName })
  const marginFeesByTs = useMemo(() => {
    if (!feesData) {
      return {}
    }

    let feesCumulative = 0
    return feesData.reduce((memo, { timestamp, margin: fees }) => {
      feesCumulative += fees
      memo[timestamp] = {
        fees,
        feesCumulative
      }
      return memo
    }, {})
  }, [feesData])

  let ret = null
  let currentPnlCumulative = 0;
  let currentProfitCumulative = 0;
  let currentLossCumulative = 0;
  const data = closedPositionsData ? sortBy(closedPositionsData.tradingStats, i => i.timestamp).map(dataItem => {
    const longOpenInterest = dataItem.longOpenInterest / 1e30
    const shortOpenInterest = dataItem.shortOpenInterest / 1e30
    const openInterest = longOpenInterest + shortOpenInterest

    // const fees = (marginFeesByTs[dataItem.timestamp]?.fees || 0)
    // const feesCumulative = (marginFeesByTs[dataItem.timestamp]?.feesCumulative || 0)

    const profit = dataItem.profit / 1e30
    const loss = dataItem.loss / 1e30
    const profitCumulative = dataItem.profitCumulative / 1e30
    const lossCumulative = dataItem.lossCumulative / 1e30
    const pnlCumulative = profitCumulative - lossCumulative
    const pnl = profit - loss
    currentProfitCumulative += profit
    currentLossCumulative -= loss
    currentPnlCumulative += pnl
    return {
      longOpenInterest,
      shortOpenInterest,
      openInterest,
      profit,
      loss: -loss,
      profitCumulative,
      lossCumulative: -lossCumulative,
      pnl,
      pnlCumulative,
      timestamp: dataItem.timestamp,
      currentPnlCumulative,
      currentLossCumulative,
      currentProfitCumulative
    }
  }) : null

  if (data) {
    const maxProfit = maxBy(data, item => item.profit).profit
    const maxLoss = minBy(data, item => item.loss).loss
    const maxProfitLoss = Math.max(maxProfit, -maxLoss)

    const maxPnl = maxBy(data, item => item.pnl).pnl
    const minPnl = minBy(data, item => item.pnl).pnl
    const maxCurrentCumulativePnl = maxBy(data, item => item.currentPnlCumulative).currentPnlCumulative
    const minCurrentCumulativePnl = minBy(data, item => item.currentPnlCumulative).currentPnlCumulative

    const currentProfitCumulative = data[data.length - 1].currentProfitCumulative
    const currentLossCumulative = data[data.length - 1].currentLossCumulative
    const stats = {
      maxProfit,
      maxLoss,
      maxProfitLoss,
      currentProfitCumulative,
      currentLossCumulative,
      maxCurrentCumulativeProfitLoss: Math.max(currentProfitCumulative, -currentLossCumulative),

      maxAbsPnl: Math.max(
        Math.abs(maxPnl),
        Math.abs(minPnl),
      ),
      maxAbsCumulativePnl: Math.max(
        Math.abs(maxCurrentCumulativePnl),
        Math.abs(minCurrentCumulativePnl)
      ),

    }

    ret = {
      data,
      stats
    }
  }

  return [ret, loading]
}

function getSwapSourcesFragment(skip = 0, from, to) {
  return `
    hourlyVolumeBySources(
      first: 1000
      skip: ${skip}
      orderBy: timestamp
      orderDirection: desc
      where: { timestamp_gte: ${from}, timestamp_lte: ${to} }
      subgraphError: allow
    ) {
      timestamp
      source
      swap
    }
  `
}
export function useSwapSources({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const query = `{
    a: ${getSwapSourcesFragment(0, from, to)}
    b: ${getSwapSourcesFragment(1000, from, to)}
    c: ${getSwapSourcesFragment(2000, from, to)}
    d: ${getSwapSourcesFragment(3000, from, to)}
    e: ${getSwapSourcesFragment(4000, from, to)}
  }`
  const [graphData, loading, error] = useGraph(query, { chainName })

  let data = useMemo(() => {
    if (!graphData) {
      return null
    }

    const { a, b, c, d, e } = graphData
    const all = [...a, ...b, ...c, ...d, ...e]

    const totalVolumeBySource = a.reduce((acc, item) => {
      const source = knownSwapSources[chainName][item.source] || item.source
      if (!acc[source]) {
        acc[source] = 0
      }
      acc[source] += item.swap / 1e30
      return acc
    }, {})
    const topVolumeSources = new Set(
      Object.entries(totalVolumeBySource).sort((a, b) => b[1] - a[1]).map(item => item[0]).slice(0, 30)
    )

    let ret = chain(all)
      .groupBy(item => parseInt(item.timestamp / 86400) * 86400)
      .map((values, timestamp) => {
        let all = 0
        const retItem = {
          timestamp: Number(timestamp),
          ...values.reduce((memo, item) => {
            let source = knownSwapSources[chainName][item.source] || item.source
            if (!topVolumeSources.has(source)) {
              source = 'Other'
            }
            if (item.swap != 0) {
              const volume = item.swap / 1e30
              memo[source] = memo[source] || 0
              memo[source] += volume
              all += volume
            }
            return memo
          }, {})
        }

        retItem.all = all

        return retItem
      })
      .sortBy(item => item.timestamp)
      .value()

    return ret
  }, [graphData])

  return [data, loading, error]
}

export function useTotalVolumeFromServer() {
  const [data, loading] = useRequest('http://127.0.0.1:3123/api/total_volume')
  return useMemo(() => {
    if (!data) {
      return [data, loading]
    }

    const total = data.reduce((memo, item) => {
      return memo + parseInt(item.data.volume) / 1e30
    }, 0)
    return [total, loading]
  }, [data, loading])
}

function getServerHostname(chainName) {
  return '127.0.0.1:3123/api'
}

export function useVolumeDataRequest(url, defaultValue, from, to, fetcher = defaultFetcher) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState()
  const [data, setData] = useState(defaultValue)

  useEffect(async () => {
    try {
      setLoading(true)
      const data = await fetcher(url)
      setData(data)
    } catch (ex) {
      console.error(ex)
      setError(ex)
    }
    setLoading(false)
  }, [url, from, to])

  return [data, loading, error]
}

export function useVolumeDataFromServer({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const PROPS = 'margin liquidation swap mint burn'.split(' ')
  const [data, loading] = useVolumeDataRequest(`http://${getServerHostname(chainName)}/daily_volume`, null, from, to, async url => {
    let after
    const ret = []
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await (await fetch(url + (after ? `?after=${after}` : ''))).json()
      if (res.length === 0) return ret
      for (const item of res) {
        if (item.data.timestamp < from) {
          return ret
        }
        ret.push(item)
      }
      after = res[res.length - 1].id
    }
  })

  const ret = useMemo(() => {
    if (!data) {
      return null
    }

    const tmp = data.reduce((memo, item) => {
      const timestamp = item.data.timestamp
      if (timestamp < from || timestamp > to) {
        return memo
      }

      let type
      if (item.data.action === 'Swap') {
        type = 'swap'
      } else if (item.data.action === 'SellUSDG') {
        type = 'burn'
      } else if (item.data.action === 'BuyUSDG') {
        type = 'mint'
      } else if (item.data.action.includes('LiquidatePosition')) {
        type = 'liquidation'
      } else {
        type = 'margin'
      }
      const volume = Number(item.data.volume) / 1e30
      memo[timestamp] = memo[timestamp] || {}
      memo[timestamp][type] = memo[timestamp][type] || 0
      memo[timestamp][type] += volume
      return memo
    }, {})

    let cumulative = 0
    const cumulativeByTs = {}
    return Object.keys(tmp).sort().map(timestamp => {
      const item = tmp[timestamp]
      let all = 0

      let movingAverageAll
      const movingAverageTs = timestamp - MOVING_AVERAGE_PERIOD
      if (movingAverageTs in cumulativeByTs) {
        movingAverageAll = (cumulative - cumulativeByTs[movingAverageTs]) / MOVING_AVERAGE_DAYS
      }

      PROPS.forEach(prop => {
        if (item[prop]) all += item[prop]
      })
      cumulative += all
      cumulativeByTs[timestamp] = cumulative
      return {
        timestamp,
        all,
        cumulative,
        movingAverageAll,
        ...item
      }
    })
  }, [data, from, to])

  return [ret, loading]
}

export function useUsersData({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const query = `{
    userStats(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { period: "daily", timestamp_gte: ${from}, timestamp_lte: ${to} }
      subgraphError: allow
    ) {
      uniqueCount
      uniqueSwapCount
      uniqueMarginCount
      uniqueMintBurnCount
      uniqueCountCumulative
      uniqueSwapCountCumulative
      uniqueMarginCountCumulative
      uniqueMintBurnCountCumulative
      actionCount
      actionSwapCount
      actionMarginCount
      actionMintBurnCount
      timestamp
    }
  }`
  const [graphData, loading, error] = useGraph(query, { chainName })

  const prevUniqueCountCumulative = {}
  let cumulativeNewUserCount = 0;
  const data = graphData ? sortBy(graphData.userStats, 'timestamp').map(item => {
    const newCountData = ['', 'Swap', 'Margin', 'MintBurn'].reduce((memo, type) => {
      memo[`new${type}Count`] = prevUniqueCountCumulative[type]
        ? item[`unique${type}CountCumulative`] - prevUniqueCountCumulative[type]
        : item[`unique${type}Count`]
      prevUniqueCountCumulative[type] = item[`unique${type}CountCumulative`]
      return memo
    }, {})
    cumulativeNewUserCount += newCountData.newCount;
    const oldCount = item.uniqueCount - newCountData.newCount
    const oldPercent = (oldCount / item.uniqueCount * 100).toFixed(1)
    return {
      all: item.uniqueCount,
      uniqueSum: item.uniqueSwapCount + item.uniqueMarginCount + item.uniqueMintBurnCount,
      oldCount,
      oldPercent,
      cumulativeNewUserCount,
      ...newCountData,
      ...item
    }
  }) : null

  return [data, loading, error]
}

export function useFundingRateData({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const query = `{
    fundingRates(
      first: 1000,
      orderBy: timestamp,
      orderDirection: desc,
      where: { period: "daily", id_gte: ${from}, id_lte: ${to} }
      subgraphError: allow
    ) {
      id,
      token,
      timestamp,
      startFundingRate,
      startTimestamp,
      endFundingRate,
      endTimestamp
    }
  }`
  const [graphData, loading, error] = useGraph(query, { chainName })


  const data = useMemo(() => {
    if (!graphData) {
      return null
    }

    const groups = graphData.fundingRates.reduce((memo, item) => {
      const symbol = tokenSymbols[item.token]
      if (symbol === 'MIM') {
        return memo
      }
      memo[item.timestamp] = memo[item.timestamp] || {
        timestamp: item.timestamp
      }
      const group = memo[item.timestamp]
      const timeDelta = parseInt((item.endTimestamp - item.startTimestamp) / 3600) * 3600

      let fundingRate = 0
      if (item.endFundingRate && item.startFundingRate) {
        const fundingDelta = item.endFundingRate - item.startFundingRate
        const divisor = timeDelta / 86400
        fundingRate = fundingDelta / divisor / 10000 * 365
      }
      group[symbol] = fundingRate
      return memo
    }, {})

    return fillNa(sortBy(Object.values(groups), 'timestamp'))
  }, [graphData])

  return [data, loading, error]
}

const MOVING_AVERAGE_DAYS = 7
const MOVING_AVERAGE_PERIOD = 86400 * MOVING_AVERAGE_DAYS

export function useVolumeData({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const PROPS = 'margin liquidation swap mint burn'.split(' ')
  const timestampProp = chainName === "arbitrum" ? "id" : "timestamp"
  const query = `{
    volumeStats(
      first: 1000,
      orderBy: ${timestampProp},
      orderDirection: desc
      where: { period: daily, ${timestampProp}_gte: ${from}, ${timestampProp}_lte: ${to} }
      subgraphError: allow
    ) {
      ${timestampProp}
      ${PROPS.join('\n')}
    }
  }`
  const [graphData, loading, error] = useGraph(query, { chainName })

  const data = useMemo(() => {
    if (!graphData) {
      return null
    }

    let ret = sortBy(graphData.volumeStats, timestampProp).map(item => {
      const ret = { timestamp: item[timestampProp] };
      let all = 0;
      PROPS.forEach(prop => {
        ret[prop] = item[prop] / 1e30
        all += ret[prop]
      })
      ret.all = all
      return ret
    })

    let cumulative = 0
    const cumulativeByTs = {}
    return ret.map(item => {
      cumulative += item.all

      let movingAverageAll
      const movingAverageTs = item.timestamp - MOVING_AVERAGE_PERIOD
      if (movingAverageTs in cumulativeByTs) {
        movingAverageAll = (cumulative - cumulativeByTs[movingAverageTs]) / MOVING_AVERAGE_DAYS
      }

      return {
        movingAverageAll,
        cumulative,
        ...item
      }
    })
  }, [graphData])

  return [data, loading, error]
}

export function useFeesData({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const PROPS = 'margin liquidation swap mint burn'.split(' ')
  const feesQuery = `{
    feeStats(
      first: 1000
      orderBy: id
      orderDirection: desc
      where: { period: daily, id_gte: ${from}, id_lte: ${to} }
      subgraphError: allow
    ) {
      id
      margin
      marginAndLiquidation
      swap
      mint
      burn
      ${chainName === "avalanche" ? "timestamp" : ""}
    }
  }`
  let [feesData, loading, error] = useGraph(feesQuery, {
    chainName
  })

  const feesChartData = useMemo(() => {
    if (!feesData) {
      return null
    }

    let chartData = sortBy(feesData.feeStats, 'id').map(item => {
      const ret = { timestamp: item.timestamp || item.id };

      PROPS.forEach(prop => {
        if (item[prop]) {
          ret[prop] = item[prop] / 1e30
        }
      })

      ret.liquidation = item.marginAndLiquidation / 1e30 - item.margin / 1e30
      ret.all = PROPS.reduce((memo, prop) => memo + ret[prop], 0)
      return ret
    })

    let cumulative = 0
    const cumulativeByTs = {}
    return chain(chartData)
      .groupBy(item => item.timestamp)
      .map((values, timestamp) => {
        const all = sumBy(values, 'all')
        cumulative += all

        let movingAverageAll
        const movingAverageTs = timestamp - MOVING_AVERAGE_PERIOD
        if (movingAverageTs in cumulativeByTs) {
          movingAverageAll = (cumulative - cumulativeByTs[movingAverageTs]) / MOVING_AVERAGE_DAYS
        }

        const ret = {
          timestamp: Number(timestamp),
          all,
          cumulative,
          movingAverageAll
        }
        PROPS.forEach(prop => {
          ret[prop] = sumBy(values, prop)
        })
        cumulativeByTs[timestamp] = cumulative
        return ret
      })
      .value()
      .filter(item => item.timestamp >= from)
  }, [feesData])

  return [feesChartData, loading, error]
}

export function useAumPerformanceData({ from = FIRST_DATE_TS, to = NOW_TS, groupPeriod }) {
  const [feesData, feesLoading] = useFeesData({ from, to, groupPeriod })
  const [elpData, elpLoading] = useElpData({ from, to, groupPeriod })
  const [volumeData, volumeLoading] = useVolumeData({ from, to, groupPeriod })

  const dailyCoef = 86400 / groupPeriod

  const data = useMemo(() => {
    if (!feesData || !elpData || !volumeData) {
      return null
    }

    const ret = feesData.map((feeItem, i) => {
      const elpItem = elpData[i]
      const volumeItem = volumeData[i]
      let apr = (feeItem?.all && elpItem?.aum) ? feeItem.all / elpItem.aum * 100 * 365 * dailyCoef : null
      if (apr > 10000) {
        apr = null
      }
      let usage = (volumeItem?.all && elpItem?.aum) ? volumeItem.all / elpItem.aum * 100 * dailyCoef : null
      if (usage > 10000) {
        usage = null
      }

      return {
        timestamp: feeItem.timestamp,
        apr,
        usage
      }
    })
    const averageApr = ret.reduce((memo, item) => item.apr + memo, 0) / ret.length
    ret.forEach(item => item.averageApr = averageApr)
    const averageUsage = ret.reduce((memo, item) => item.usage + memo, 0) / ret.length
    ret.forEach(item => item.averageUsage = averageUsage)
    return ret
  }, [feesData, elpData, volumeData])

  return [data, feesLoading || elpLoading || volumeLoading]
}

export function useElpData({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const timestampProp = chainName === 'arbitrum' ? 'id' : 'timestamp'
  const query = `{
    elpStats(
      first: 1000
      orderBy: ${timestampProp}
      orderDirection: desc
      where: {
        period: daily
        ${timestampProp}_gte: ${from}
        ${timestampProp}_lte: ${to}
      }
      subgraphError: allow
    ) {
      ${timestampProp}
      aumInUsdg
      elpSupply
      distributedUsd
      distributedEth
    }
  }`
  let [data, loading, error] = useGraph(query, { chainName })

  let cumulativeDistributedUsdPerElp = 0
  let cumulativeDistributedEthPerElp = 0
  const elpChartData = useMemo(() => {
    if (!data) {
      return null
    }

    let prevElpSupply
    let prevAum

    let ret = sortBy(data.elpStats, item => item[timestampProp]).filter(item => item[timestampProp] % 86400 === 0).reduce((memo, item) => {
      const last = memo[memo.length - 1]

      const aum = Number(item.aumInUsdg) / 1e18
      const elpSupply = Number(item.elpSupply) / 1e18

      const distributedUsd = Number(item.distributedUsd) / 1e30
      const distributedUsdPerElp = (distributedUsd / elpSupply) || 0
      cumulativeDistributedUsdPerElp += distributedUsdPerElp

      const distributedEth = Number(item.distributedEth) / 1e18
      const distributedEthPerElp = (distributedEth / elpSupply) || 0
      cumulativeDistributedEthPerElp += distributedEthPerElp

      const elpPrice = aum / elpSupply
      const timestamp = parseInt(item[timestampProp])

      const newItem = {
        timestamp,
        aum,
        elpSupply,
        elpPrice,
        cumulativeDistributedEthPerElp,
        cumulativeDistributedUsdPerElp,
        distributedUsdPerElp,
        distributedEthPerElp
      }

      if (last && last.timestamp === timestamp) {
        memo[memo.length - 1] = newItem
      } else {
        memo.push(newItem)
      }

      return memo
    }, []).map(item => {
      let { elpSupply, aum } = item
      if (!elpSupply) {
        elpSupply = prevElpSupply
      }
      if (!aum) {
        aum = prevAum
      }
      item.elpSupplyChange = prevElpSupply ? (elpSupply - prevElpSupply) / prevElpSupply * 100 : 0
      if (item.elpSupplyChange > 1000) {
        item.elpSupplyChange = 0
      }
      item.aumChange = prevAum ? (aum - prevAum) / prevAum * 100 : 0
      if (item.aumChange > 1000) {
        item.aumChange = 0
      }
      prevElpSupply = elpSupply
      prevAum = aum
      return item
    })

    ret = fillNa(ret)
    return ret
  }, [data])

  return [elpChartData, loading, error]
}

export function useElpPerformanceData(elpData, feesData, { from = FIRST_DATE_TS, chainName = "arbitrum" } = {}) {
  const [btcPrices] = useCoingeckoPrices('BTC', { from })
  const [ethPrices] = useCoingeckoPrices('ETH', { from })
  const [avaxPrices] = useCoingeckoPrices('AVAX', { from })

  const elpPerformanceChartData = useMemo(() => {
    if (!btcPrices || !ethPrices || !avaxPrices || !elpData || !feesData) {
      return null
    }

    const elpDataById = elpData.reduce((memo, item) => {
      memo[item.timestamp] = item
      return memo
    }, {})

    const feesDataById = feesData.reduce((memo, item) => {
      memo[item.timestamp] = item
      return memo
    })

    let BTC_WEIGHT = 0
    let ETH_WEIGHT = 0
    let AVAX_WEIGHT = 0

    if (chainName === "avalanche") {
      BTC_WEIGHT = 0.166
      ETH_WEIGHT = 0.166
      AVAX_WEIGHT = 0.166
    } else {
      BTC_WEIGHT = 0.25
      ETH_WEIGHT = 0.25
    }

    const STABLE_WEIGHT = 1 - BTC_WEIGHT - ETH_WEIGHT - AVAX_WEIGHT
    const ELP_START_PRICE = elpDataById[btcPrices[0].timestamp]?.elpPrice || 1.19

    const btcFirstPrice = btcPrices[0]?.value
    const ethFirstPrice = ethPrices[0]?.value
    const avaxFirstPrice = avaxPrices[0]?.value

    let indexBtcCount = ELP_START_PRICE * BTC_WEIGHT / btcFirstPrice
    let indexEthCount = ELP_START_PRICE * ETH_WEIGHT / ethFirstPrice
    let indexAvaxCount = ELP_START_PRICE * AVAX_WEIGHT / avaxFirstPrice
    let indexStableCount = ELP_START_PRICE * STABLE_WEIGHT

    const lpBtcCount = ELP_START_PRICE * 0.5 / btcFirstPrice
    const lpEthCount = ELP_START_PRICE * 0.5 / ethFirstPrice
    const lpAvaxCount = ELP_START_PRICE * 0.5 / avaxFirstPrice

    const ret = []
    let cumulativeFeesPerElp = 0
    let lastElpItem
    let lastFeesItem

    let prevEthPrice = 3400
    let prevAvaxPrice = 1000
    for (let i = 0; i < btcPrices.length; i++) {
      const btcPrice = btcPrices[i].value
      const ethPrice = ethPrices[i]?.value || prevEthPrice
      const avaxPrice = avaxPrices[i]?.value || prevAvaxPrice
      prevAvaxPrice = avaxPrice
      prevEthPrice = ethPrice

      const timestampGroup = parseInt(btcPrices[i].timestamp / 86400) * 86400
      const elpItem = elpDataById[timestampGroup] || lastElpItem
      lastElpItem = elpItem

      const elpPrice = elpItem?.elpPrice
      const elpSupply = elpItem?.elpSupply

      const feesItem = feesDataById[timestampGroup] || lastFeesItem
      lastFeesItem = feesItem

      const dailyFees = feesItem?.all

      const syntheticPrice = (
        indexBtcCount * btcPrice
        + indexEthCount * ethPrice
        + indexAvaxCount * avaxPrice
        + indexStableCount
      )

      // rebalance each day. can rebalance each X days
      if (i % 1 == 0) {
        indexBtcCount = syntheticPrice * BTC_WEIGHT / btcPrice
        indexEthCount = syntheticPrice * ETH_WEIGHT / ethPrice
        indexAvaxCount = syntheticPrice * AVAX_WEIGHT / avaxPrice
        indexStableCount = syntheticPrice * STABLE_WEIGHT
      }

      const lpBtcPrice = (lpBtcCount * btcPrice + ELP_START_PRICE / 2) * (1 + getImpermanentLoss(btcPrice / btcFirstPrice))
      const lpEthPrice = (lpEthCount * ethPrice + ELP_START_PRICE / 2) * (1 + getImpermanentLoss(ethPrice / ethFirstPrice))
      const lpAvaxPrice = (lpAvaxCount * avaxPrice + ELP_START_PRICE / 2) * (1 + getImpermanentLoss(avaxPrice / avaxFirstPrice))

      if (dailyFees && elpSupply) {
        const INCREASED_ELP_REWARDS_TIMESTAMP = 1635714000
        const ELP_REWARDS_SHARE = timestampGroup >= INCREASED_ELP_REWARDS_TIMESTAMP ? 0.7 : 0.5
        const collectedFeesPerElp = dailyFees / elpSupply * ELP_REWARDS_SHARE
        cumulativeFeesPerElp += collectedFeesPerElp
      }

      let elpPlusFees = elpPrice
      if (elpPrice && elpSupply && cumulativeFeesPerElp) {
        elpPlusFees = elpPrice + cumulativeFeesPerElp
      }

      let elpApr
      let elpPlusDistributedUsd
      let elpPlusDistributedEth
      if (elpItem) {
        if (elpItem.cumulativeDistributedUsdPerElp) {
          elpPlusDistributedUsd = elpPrice + elpItem.cumulativeDistributedUsdPerElp
          // elpApr = elpItem.distributedUsdPerElp / elpPrice * 365 * 100 // incorrect?
        }
        if (elpItem.cumulativeDistributedEthPerElp) {
          elpPlusDistributedEth = elpPrice + elpItem.cumulativeDistributedEthPerElp * ethPrice
        }
      }

      ret.push({
        timestamp: btcPrices[i].timestamp,
        syntheticPrice,
        lpBtcPrice,
        lpEthPrice,
        lpAvaxPrice,
        elpPrice,
        btcPrice,
        ethPrice,
        elpPlusFees,
        elpPlusDistributedUsd,
        elpPlusDistributedEth,

        indexBtcCount,
        indexEthCount,
        indexAvaxCount,
        indexStableCount,

        BTC_WEIGHT,
        ETH_WEIGHT,
        AVAX_WEIGHT,
        STABLE_WEIGHT,

        performanceLpEth: (elpPrice / lpEthPrice * 100).toFixed(2),
        performanceLpEthCollectedFees: (elpPlusFees / lpEthPrice * 100).toFixed(2),
        performanceLpEthDistributedUsd: (elpPlusDistributedUsd / lpEthPrice * 100).toFixed(2),
        performanceLpEthDistributedEth: (elpPlusDistributedEth / lpEthPrice * 100).toFixed(2),

        performanceLpBtcCollectedFees: (elpPlusFees / lpBtcPrice * 100).toFixed(2),

        performanceLpAvaxCollectedFees: (elpPlusFees / lpAvaxPrice * 100).toFixed(2),

        performanceSynthetic: (elpPrice / syntheticPrice * 100).toFixed(2),
        performanceSyntheticCollectedFees: (elpPlusFees / syntheticPrice * 100).toFixed(2),
        performanceSyntheticDistributedUsd: (elpPlusDistributedUsd / syntheticPrice * 100).toFixed(2),
        performanceSyntheticDistributedEth: (elpPlusDistributedEth / syntheticPrice * 100).toFixed(2),

        elpApr
      })
    }

    return ret
  }, [btcPrices, ethPrices, elpData, feesData])

  return [elpPerformanceChartData]
}

export function useTokenStats({
  from = FIRST_DATE_TS,
  to = NOW_TS,
  period = 'daily',
  chainName = "arbitrum"
} = {}) {

  const getTokenStatsFragment = ({ skip = 0 } = {}) => `
    tokenStats(
      first: 1000,
      skip: ${skip},
      orderBy: timestamp,
      orderDirection: desc,
      where: { period: ${period}, timestamp_gte: ${from}, timestamp_lte: ${to} }
      subgraphError: allow
    ) {
      poolAmountUsd
      timestamp
      token
    }
  `

  // Request more than 1000 records to retrieve maximum stats for period
  const query = `{
    a: ${getTokenStatsFragment()}
    b: ${getTokenStatsFragment({ skip: 1000 })},
    c: ${getTokenStatsFragment({ skip: 2000 })},
    d: ${getTokenStatsFragment({ skip: 3000 })},
    e: ${getTokenStatsFragment({ skip: 4000 })},
    f: ${getTokenStatsFragment({ skip: 5000 })},
  }`

  const [graphData, loading, error] = useGraph(query, { chainName })

  const data = useMemo(() => {
    if (loading || !graphData) {
      return null;
    }

    const fullData = Object.values(graphData).reduce((memo, records) => {
      memo.push(...records);
      return memo;
    }, []);

    const retrievedTokens = new Set();

    const timestampGroups = fullData.reduce((memo, item) => {
      const { timestamp, token, ...stats } = item;

      const symbol = tokenSymbols[token] || token;

      retrievedTokens.add(symbol);

      memo[timestamp] = memo[timestamp || 0] || {};

      memo[timestamp][symbol] = {
        poolAmountUsd: parseInt(stats.poolAmountUsd) / 1e30,
      };

      return memo;
    }, {});

    const poolAmountUsdRecords = [];

    Object.entries(timestampGroups).forEach(([timestamp, dataItem]) => {
      const poolAmountUsdRecord = Object.entries(dataItem).reduce((memo, [token, stats]) => {
        memo.all += stats.poolAmountUsd;
        memo[token] = stats.poolAmountUsd;
        memo.timestamp = timestamp;

        return memo;
      }, { all: 0 });

      poolAmountUsdRecords.push(poolAmountUsdRecord);
    })

    return {
      poolAmountUsd: poolAmountUsdRecords,
      tokenSymbols: Array.from(retrievedTokens),
    };
  }, [graphData, loading])

  return [data, loading, error]
}

export function useReferralsData({ from = FIRST_DATE_TS, to = NOW_TS, chainName = "arbitrum" } = {}) {
  const query = `{
    globalStats(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { period: "daily", timestamp_gte: ${from}, timestamp_lte: ${to} }
      subgraphError: allow
    ) {
      volume
      volumeCumulative
      totalRebateUsd
      totalRebateUsdCumulative
      discountUsd
      discountUsdCumulative
      referrersCount
      referrersCountCumulative
      referralCodesCount
      referralCodesCountCumulative
      referralsCount
      referralsCountCumulative
      timestamp
    }
  }`
  const subgraph = chainName === "arbitrum"
    ? "eddx-io/eddx-arbitrum-referrals"
    : "eddx-io/eddx-avalanche-referrals"
  const [graphData, loading, error] = useGraph(query, { subgraph })

  const data = graphData ? sortBy(graphData.globalStats, 'timestamp').map(item => {
    const totalRebateUsd = item.totalRebateUsd / 1e30
    const discountUsd = item.discountUsd / 1e30
    return {
      ...item,
      volume: item.volume / 1e30,
      volumeCumulative: item.volumeCumulative / 1e30,
      totalRebateUsd,
      totalRebateUsdCumulative: item.totalRebateUsdCumulative / 1e30,
      discountUsd,
      referrerRebateUsd: totalRebateUsd - discountUsd,
      discountUsdCumulative: item.discountUsdCumulative / 1e30,
      referralCodesCount: parseInt(item.referralCodesCount),
      referralCodesCountCumulative: parseInt(item.referralCodesCountCumulative),
      referrersCount: parseInt(item.referrersCount),
      referrersCountCumulative: parseInt(item.referrersCountCumulative),
      referralsCount: parseInt(item.referralsCount),
      referralsCountCumulative: parseInt(item.referralsCountCumulative),
    }
  }) : null

  return [data, loading, error]
}
