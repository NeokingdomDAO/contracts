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

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const BLAST_API_KEY = process.env.BLAST_API_KEY || "";
const RINKEBY_PRIVATE_KEY =
  process.env.RINKEBY_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const MUMBAI_PRIVATE_KEY =
  process.env.RINKEBY_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const KOVAN_PRIVATE_KEY =
  process.env.KOVAN_PRIVATE_KEY! ||
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3"; // well known private key
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_KEY = process.env.COINMARKETCAP_KEY || "";
const TOKEN = process.env.TOKEN || "MATIC";
const GASPRICE_API =
  TOKEN == "MATIC"
    ? "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice"
    : "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice";
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
        version: "0.8.11",
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
    localhost: {},
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [KOVAN_PRIVATE_KEY],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [RINKEBY_PRIVATE_KEY],
    },
    mumbai: {
      url: `https://polygon-testnet.blastapi.io/${BLAST_API_KEY}`,
      accounts: [MUMBAI_PRIVATE_KEY],
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
    excludeContracts: [
      "ERC20Mock",
      "ResolutionManagerV2Mock",
      "ShareholderRegistryMock",
      "TelediskoTokenMock",
      "VotingMock",
    ],
  },
  typechain: {
    outDir: "./typechain",
  },
};

export default config;
