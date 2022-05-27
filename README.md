![Test workflow](https://github.com/vrde/hardhat-typescript-template/actions/workflows/node.yml/badge.svg)

# HardHat TypeScript Template

```bash
npx degit https://github.com/vrde/hardhat-typescript-template\#main contracts
```

## What's included

- CI with GitHub actions.
- TypeScript configuration.
- Sample `Storage` contract and tests.
- Tasks:
  - `deploy`
  - `store` to store a value
  - `retrieve` to retrieve the current value

## Run it

If you just want to run tests, then `npm test` is your friend.

If you want to play with the tasks, run your favorite Ethereum development node (mine is [ethnode](https://github.com/vrde/ethnode/), give it a try).

When the node is running, try the following commands

- `npx hardhat --network localhost deploy` to deploy the contract in your local node.
- `npx hardhat --network localhost store 666` to store a new value in the contract.
- `npx hardhat --network localhost retrieve` to retrieve the current value.
- `npx hardhat --network localhost retrieve --hex` to retrieve the current value in hex.

# Generate gas reports

The gas report script will generate 8 reports:

- 4 reports for Ethereum Mainnet
- 4 reports for Polygon Mainnet
  For each network, the tool calculates the EUR price for all public functions and deployment, using as gas fee
- the min and max of the average of 2022 for the given network
- the min and max of the median of 2022 for the given network
  Execute:
  `./generate_gas_report.sh <reports folder or empy>`
