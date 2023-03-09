import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";

import "solidity-coverage";
import "hardhat-gas-reporter";
import { HardhatUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-etherscan";

import("./tasks").catch((e) => console.log("Cannot load tasks", e.toString()));

const DEFAULT_KEY =
  "0xf893a24ff1986a49fdb290771e729f1219d1e0f0d7c575446bbe584c963684db";

const TEVMOS_PRIVATE_KEY = process.env.TEVMOS_PRIVATE_KEY || DEFAULT_KEY;
const EVMOS_PRIVATE_KEY = process.env.EVMOS_PRIVATE_KEY || DEFAULT_KEY;

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_KEY = process.env.COINMARKETCAP_KEY || "";
const TOKEN = process.env.TOKEN || "EVMOS";
const GASPRICE_API = process.env.GASPRICE_API || "";
const GASREPORT_FILE = process.env.GASREPORT_FILE || "";
const NO_COLORS = process.env.NO_COLORS == "false" || GASREPORT_FILE != "";
const GAS_PRICE = process.env.GAS_PRICE
  ? (process.env.GAS_PRICE as unknown as number)
  : undefined;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    tevmos: {
      url: "https://eth.bd.evmos.dev:8545",
      accounts: [TEVMOS_PRIVATE_KEY],
    },
    evmos: {
      url: "https://eth.bd.evmos.org:8545",
      accounts: [EVMOS_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "evmos",
        chainId: 9001,
        urls: {
          apiURL: "https://escan.live/api",
          browserURL: "https://escan.live",
        },
      },
    ],
  },
  gasReporter: {
    currency: "EUR",
    coinmarketcap: COINMARKETCAP_KEY,
    enabled: process.env.REPORT_GAS ? true : false,
    gasPriceApi: GASPRICE_API,
    token: TOKEN,
    gasPrice: GAS_PRICE,
    outputFile: GASREPORT_FILE,
    noColors: NO_COLORS,
    excludeContracts: [
      "ERC20Mock",
      "ResolutionManagerV2Mock",
      "ShareholderRegistryMock",
      "NeokingdomTokenMock",
      "VotingMock",
    ],
  },
  typechain: {
    outDir: "./typechain",
  },
};

export default config;
