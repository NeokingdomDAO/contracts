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
  Voting.sol
    - proxy at 0x469EF10604015A07dD4CBca3Ff5baeb80B41bfF4
    - implementation at 0x383f9f442011496c2555084bba160182b77a8a19

  ShareholderRegistry.sol
    - proxy at 0xeB13EBE7613f9FC03A4ac091574Dc04ceb45562f
    - implementation at 0x295a147c13951c9c9b0270355bf580d8dd1eedb0

  TelediskoToken.sol
    - proxy at 0x64Fd2411C9b6c0d2F6F70dAA77Bac63E93D6AB2B
    - implementation at 0x0b63681e44524ebc7632aa86df31094ad0c6c002

  ResolutionManager.sol
    - proxy at 0xA65d12De252c60EBD251b3aE45d6029e9eBCA5E7
    - implementation at 0xa0497e979a05e2c3238a50854409ad3e1487eda3
```

- [Voting](https://evm.evmos.org/address/0x469EF10604015A07dD4CBca3Ff5baeb80B41bfF4)
- [ShareholderRegistry](https://evm.evmos.org/address/0xeB13EBE7613f9FC03A4ac091574Dc04ceb45562f)
- [TelediskoToken](https://evm.evmos.org/address/0x64Fd2411C9b6c0d2F6F70dAA77Bac63E93D6AB2B)
- [ResolutionManager](https://evm.evmos.org/address/0xA65d12De252c60EBD251b3aE45d6029e9eBCA5E7)

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