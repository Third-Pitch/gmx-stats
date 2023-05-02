import fetch from 'cross-fetch';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'

import { ARBITRUM, AVALANCHE, BASE } from './addresses'

const apolloOptions = {
  query: {
    fetchPolicy: 'no-cache'
  },
  watchQuery: {
    fetchPolicy: 'no-cache'
  }
}

const arbitrumStatsClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/gmx-io/gmx-stats', fetch }),
  cache: new InMemoryCache(),
  defaultOptions: apolloOptions
})

const avalancheStatsClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/gmx-io/gmx-avalanche-stats', fetch }),
  cache: new InMemoryCache(),
  defaultOptions: apolloOptions
})

const baseStatsClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.studio.thegraph.com/proxy/45535/test-stats/0.0.1', fetch }),
  cache: new InMemoryCache(),
  defaultOptions: apolloOptions
})



function getStatsClient(chainId) {
  if (chainId === ARBITRUM) {
    return arbitrumStatsClient
  } else if (chainId === AVALANCHE) {
    return avalancheStatsClient
  } else if (chainId === BASE) {
    return baseStatsClient;
  }
  throw new Error(`Invalid chainId ${chainId}`)
}

const arbitrumPricesClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://subgraph.satsuma-prod.com/034a09e5f609/gmx/gmx-arbitrum-prices/api', fetch }),
  cache: new InMemoryCache(),
  defaultOptions: apolloOptions
})

const avalanchePricesClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://subgraph.satsuma-prod.com/034a09e5f609/gmx/gmx-avalanche-prices/api', fetch }),
  cache: new InMemoryCache(),
  defaultOptions: apolloOptions
})

const basePricesClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.studio.thegraph.com/query/45535/test-price/0.0.1', fetch }),
  cache: new InMemoryCache(),
  defaultOptions: apolloOptions
})

function getPricesClient(chainId) {
  if (chainId === ARBITRUM) {
    return arbitrumPricesClient
  } else if (chainId === AVALANCHE) {
    return avalanchePricesClient
  } else if (chainId === BASE) {
    return basePricesClient;
  } else {
    throw new Error(`Invalid chainId ${chainId}`)
  }
}

module.exports = {
  getPricesClient,
  getStatsClient
}
