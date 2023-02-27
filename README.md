![Test workflow](https://github.com/NeokingdomDAO/contracts/actions/workflows/node.yml/badge.svg)

# Neokingdom DAO Contracts

Welcome to the Neokingdom DAO Contacts.

## Deployments

Neokingdom DAO lives on EVMOS.

### v0

```
Deploy DAO
  Network: evmos
  ChainId: 9001
  Deployer address:


⛏️  Mine contracts
  Voting.sol
    - proxy at
    - implementation at

  ShareholderRegistry.sol
    - proxy at
    - implementation at

  NeokingdomToken.sol
    - proxy at
    - implementation at

  ResolutionManager.sol
    - proxy at
    - implementation at
```

- [Voting](https://escan.live/address/0x312A36442A7199623C91D219Fe981f1899817305) `0x312A36442A7199623C91D219Fe981f1899817305`
- [ShareholderRegistry](https://escan.live/address/0xB795d74f9C395332D533cC6c1cb2A9437De1fee3) `0xB795d74f9C395332D533cC6c1cb2A9437De1fee3`
- [NeokingdomToken](https://escan.live/address/0xA31c18929590B87eC11D854d1424b059f1D94732) `0xA31c18929590B87eC11D854d1424b059f1D94732`
- [ResolutionManager](https://escan.live/address/0x8ac36631c0C1B630FF50Bb653F5a2edc405873D0) `0x8ac36631c0C1B630FF50Bb653F5a2edc405873D0`
- [Operator SAFE on EVMOS](https://safe.evmos.org/evmos:0xd232121c41EF9ad4e4d0251BdCbe60b9F3D20758) `0xd232121c41EF9ad4e4d0251BdCbe60b9F3D20758`

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
