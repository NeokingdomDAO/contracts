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

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const BLAST_API_KEY = process.env.BLAST_API_KEY || "";
const LOCALHOST_PRIVATE_KEY =
  process.env.LOCALHOST_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const MUMBAI_PRIVATE_KEY =
  process.env.RINKEBY_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const POLYGON_PRIVATE_KEY =
  process.env.POLYGON_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const KOVAN_PRIVATE_KEY =
  process.env.KOVAN_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const TEVMOS_PRIVATE_KEY =
  process.env.TEVMOS_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const EVMOS_PRIVATE_KEY =
  process.env.EVMOS_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const CRONOS_PRIVATE_KEY =
  process.env.CRONOS_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const TCRONOS_PRIVATE_KEY =
  process.env.TCRONOS_PRIVATE_KEY! ||
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
        version: "0.8.19",
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
      accounts: [LOCALHOST_PRIVATE_KEY],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [KOVAN_PRIVATE_KEY],
    },
    mumbai: {
      url: `https://polygon-testnet.blastapi.io/${BLAST_API_KEY}`,
      accounts: [MUMBAI_PRIVATE_KEY],
    },
    polygon: {
      url: "https://polygon-rpc.com/",
      accounts: [POLYGON_PRIVATE_KEY],
    },
    tevmos: {
      url: "https://eth.bd.evmos.dev:8545",
      accounts: [TEVMOS_PRIVATE_KEY],
    },
    evmos: {
      url: "https://eth.bd.evmos.org:8545",
      accounts: [EVMOS_PRIVATE_KEY],
    },
    "cronostestnet_338-3": {
      url: "https://evm-t3.cronos.org/",
      accounts: [TCRONOS_PRIVATE_KEY],
    },
    "cronosmainnet_25-1": {
      url: "https://cronosrpc-1.xstaking.sg/",
      accounts: [CRONOS_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
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
};

export default config;
