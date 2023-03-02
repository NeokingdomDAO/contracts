import { task } from "hardhat/config";

import {
  NeokingdomToken,
  PriceOracle__factory,
  ResolutionManager,
  ShareholderRegistry,
  Voting,
} from "../typechain";

import { exportAddress } from "./config";
import { deployProxy, getWallet } from "./utils";

task("deploy", "Deploy DAO").setAction(async (_, hre) => {
  const deployer = await getWallet(hre);
  const { chainId } = await hre.ethers.provider.getNetwork();

  console.log("Deploy DAO");
  console.log("  Network:", hre.network.name);
  console.log("  ChainId:", chainId);
  console.log("  Deployer address:", deployer.address);
});
