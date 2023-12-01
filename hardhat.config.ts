import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import { config as dotEnvConfig } from "dotenv";
import "hardhat-gas-reporter";
import { HardhatUserConfig } from "hardhat/types";
import "solidity-coverage";

dotEnvConfig();

import("./tasks").catch((e) => console.log("Cannot load tasks", e.toString()));

const BLAST_API_KEY = process.env.BLAST_API_KEY || "";
const MUMBAI_PRIVATE_KEY =
  process.env.MUMBAI_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const POLYGON_PRIVATE_KEY =
  process.env.POLYGON_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const TEVMOS_PRIVATE_KEY =
  process.env.TEVMOS_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const EVMOS_PRIVATE_KEY =
  process.env.EVMOS_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const CRONOSCAN_API_KEY = process.env.CRONOSCAN_API_KEY;
const COINMARKETCAP_KEY = process.env.COINMARKETCAP_KEY || "";
const TOKEN = process.env.TOKEN || "CRO";
const GASPRICE_API = {
  MATIC: "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice",
  ETH: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
  CRO: `https://api.cronoscan.com/api?module=proxy&action=eth_gasPrice&apiKey=${CRONOSCAN_API_KEY}`,
}[TOKEN];
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
        version: "0.8.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
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
    mumbai: {
      //url: `https://polygon-testnet.blastapi.io/${BLAST_API_KEY}`,
      url: "https://polygon-mumbai-bor.publicnode.com",
      accounts: [MUMBAI_PRIVATE_KEY],
    },
    polygon: {
      url: "https://polygon-rpc.com/",
      accounts: [POLYGON_PRIVATE_KEY],
    },
    tevmos: {
      url: "https://evmos-testnet.lava.build",
      accounts: [TEVMOS_PRIVATE_KEY],
    },
    evmos: {
      url: "https://evmos-evm.publicnode.com",
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
      {
        network: "tevmos",
        chainId: 9000,
        urls: {
          apiURL: "https://testnet.escan.live/api",
          browserURL: "https://testnet.escan.live",
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
    excludeContracts: ["mocks", "ERC20", "ERC20Upgradeable"],
  },
  typechain: {
    outDir: "./typechain",
  },
  mocha: {
    bail: true,
  },
};

export default config;
