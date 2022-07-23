![Test workflow](https://github.com/TelediskoDAO/contracts/actions/workflows/node.yml/badge.svg)

# Teledisko DAO Contracts

Welcome to the Teledisko DAO Contacts.

## Deployments

Teledisko DAO lives in EVMOS.

### v1

```
Deploy DAO
  Network: evmos
  ChainId: 9001
  Deployer address: 0x62817523F3B94182B9DF911a8071764F998f11a4


⛏️  Mine contracts
  Voting.sol deployed at 0x5c91fB736aDf04a1DAd11E0C3c1bD7E1Eb68cf33
  ShareholderRegistry.sol deployed at 0xa516a9AbDBD6bF29DA5B76820465f366146449A3
  TelediskoToken.sol deployed at 0x8Add9613f43786eaD117E73ce6820ecf9b7d0cC3
  ResolutionManager.sol deployed at 0x5F667BDee7b2742003BA0E616Ea3D678F9AF1738
```

## Commands

```
# Clean the build dir, sometimes this is a good idea
npx hardhat clean

# Compile the contracts
npx hardhat compile

# Test the contracts
npx hardhat test

# Deploy to production
npx hardhat deploy --network evmos
```