![Test workflow](https://github.com/NeokingdomDAO/contracts/actions/workflows/node.yml/badge.svg)

# Neokingdom DAO Contracts

Welcome to the Neokingdom DAO Contacts.

## Deployments

Neokingdom DAO lives in EVMOS.

### v1

```
Deploy DAO
  Network: evmos
  ChainId: 9001
  Deployer address: 0x2e1af63cd595a6d715e5e2d92151801f0d406a6b


⛏️  Mine contracts
  Voting.sol deployed at 0x312A36442A7199623C91D219Fe981f1899817305
  ShareholderRegistry.sol deployed at 0xB795d74f9C395332D533cC6c1cb2A9437De1fee3
  NeokingdomToken.sol deployed at 0xA31c18929590B87eC11D854d1424b059f1D94732
  ResolutionManager.sol deployed at 0x8ac36631c0C1B630FF50Bb653F5a2edc405873D0
```

- [Voting](https://escan.live/address/0x312a36442a7199623c91d219fe981f1899817305)
- [ShareholderRegistry](https://escan.live/address/0xB795d74f9C395332D533cC6c1cb2A9437De1fee3)
- [NeokingdomToken](https://escan.live/address/0xA31c18929590B87eC11D854d1424b059f1D94732)
- [ResolutionManager](https://escan.live/address/0x8ac36631c0C1B630FF50Bb653F5a2edc405873D0)
- [Operators' Safe](https://safe.evmos.org/evmos:0xd232121c41EF9ad4e4d0251BdCbe60b9F3D20758)

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