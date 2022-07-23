import { task } from "hardhat/config";
import {
  Voting,
  ResolutionManager,
  ShareholderRegistry,
  TelediskoToken,
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

  /**
   * Deploy all contracts
   */
  console.log("\n\n⛏️  Mine contracts");
  const votingContract = (await deployProxy(hre, deployer, "Voting")) as Voting;
  await exportAddress(hre, votingContract, "Voting");

  const shareholderRegistryContract = (await deployProxy(
    hre,
    deployer,
    "ShareholderRegistry",
    ["Teledisko Share", "TS"]
  )) as ShareholderRegistry;
  await exportAddress(hre, shareholderRegistryContract, "ShareholderRegistry");

  const telediskoTokenContract = (await deployProxy(
    hre,
    deployer,
    "TelediskoToken",
    ["Teledisko Token", "TT"]
  )) as TelediskoToken;
  await exportAddress(hre, telediskoTokenContract, "TelediskoToken");

  const resolutionManagerContract = (await deployProxy(
    hre,
    deployer,
    "ResolutionManager",
    [
      shareholderRegistryContract.address,
      telediskoTokenContract.address,
      votingContract.address,
    ]
  )) as ResolutionManager;

  await exportAddress(hre, resolutionManagerContract, "ResolutionManager");

  console.log("\n\nWell done 🐯 time to setup your DAO!");
});
