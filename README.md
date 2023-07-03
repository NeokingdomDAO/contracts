![Test workflow](https://github.com/NeokingdomDAO/contracts/actions/workflows/node.yml/badge.svg)

# Neokingdom DAO Contracts

Welcome to the Neokingdom DAO Contacts.

## Documentation

- [NEOKingdom DAO Yellow Paper](./docs/yellowpaper/yellowpaper.md) describes why this project exists, and provides high level overview of the structure of the smart contracts.
- [Flow charts](./docs/flowcharts) includes four flow charts:
  - *contributor* shows how new people are added to the DAO as contributors.
  - *proposal* gives an overview of the governance process of the DAO.
  - *tokenomics* explains how tokens are moved from the contributor's wallet to another wallet.
  - *voting* shows how contributors vote to resolutions.
- [Complex flows)(./docs/complex_flows):
  - *voting* elaborates the logic behind the voting power distribution and delegation implemented in the Neokingdom DAO contracts
  - *redemption* elaborates the logic behind the redemption process of Neokingdom DAO
- Integration tests:
  - [Integration](./test/Integration.ts) is a collection of integration tests that touches multiple use cases.
  - [Integration governance+shareholders](./test/IntegrationGovernanceShareholders.ts) tests the invariant that the sum of shares and tokens is equal to the user's voting power
  - [Integration market+redemption](./test/IntegrationInternalMarketRedemptionController.ts) tests that users promoted from investor to contributor have the right voting power.


## Deployments

Neokingdom DAO lives on EVMOS.

- [NeokingdomToken (NEOK)](https://escan.live/address/0x655ecB57432CC1370f65e5dc2309588b71b473A9) `0x655ecB57432CC1370f65e5dc2309588b71b473A9`
- [ShareholderRegistry (NEOS)](https://escan.live/address/0x4706eD7a10064801F260BBf94743f241FCEf815e) `0x4706eD7a10064801F260BBf94743f241FCEf815e`
- [GovernanceToken](https://escan.live/address/0x05d1b2355721903152768F0ec1B105Be1c35BCb4) `0x05d1b2355721903152768F0ec1B105Be1c35BCb4`
- [Voting](https://escan.live/address/0x5DC219C8CaeF7c9ECd0b97372e6Ef4fC5D827975) `0x5DC219C8CaeF7c9ECd0b97372e6Ef4fC5D827975`
- [RedemptionController](https://escan.live/address/0x7045bfaB66B55074C56aBeE34308CDa0916e086C) `0x7045bfaB66B55074C56aBeE34308CDa0916e086C`
- [InternalMarket](https://escan.live/address/0x7687155fB855e24d1416C288CbaC0AFC3B65353c) `0x7687155fB855e24d1416C288CbaC0AFC3B65353c`
- [ResolutionManager](https://escan.live/address/0xE5714C29b7acE2C6a3A80BE511ED7e5b92594204) `0xE5714C29b7acE2C6a3A80BE511ED7e5b92594204`
- [DAORoles](https://escan.live/address/0x6A176C92985430535E738A79749A4137BEC6C4Db) `0x6A176C92985430535E738A79749A4137BEC6C4Db`
- [Operator SAFE on EVMOS](https://safe.evmos.org/evmos:0xd232121c41EF9ad4e4d0251BdCbe60b9F3D20758) `0xd232121c41EF9ad4e4d0251BdCbe60b9F3D20758`

## Commands

```
# Update readme
python scripts/update-readme.py deployments/9001.network.json
```

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
