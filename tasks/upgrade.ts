import { task } from "hardhat/config";

import { ResolutionManager__factory } from "../typechain";

import { NeokingdomDAOHardhat } from "../lib";

task(
  "upgrade-resolution-manager",
  "Upgrade ResolutionManager",
  async (_, hre) => {
    const resolutionFactory = (await hre.ethers.getContractFactory(
      "ResolutionManager"
    )) as ResolutionManager__factory;

    const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
    const contracts = await neokingdom.loadContracts();
    console.log("Upgrade ResolutionManager");
    console.log("  Network:", hre.network.name);

    const resolutionContract = await hre.upgrades.upgradeProxy(
      contracts.resolutionManager.address,
      resolutionFactory
    );
    await resolutionContract.deployed();

    console.log("    Address:", resolutionContract.address);
    console.log("Resolution upgraded");
  }
);
