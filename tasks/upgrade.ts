import { task } from "hardhat/config";

import {
  ProxyAdmin,
  ProxyAdmin__factory,
  ResolutionManager__factory,
} from "../typechain";

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

task("impl", "Get Proxy Impl")
  .addParam("admin", "Proxy Admin")
  .addParam("address", "Proxy address")
  .setAction(
    async ({ admin, address }: { admin: string; address: string }, hre) => {
      const [deployer] = await hre.ethers.getSigners();
      const ProxyAdmin = await hre.ethers.getContractFactory("ProxyAdmin");
      const proxyAdmin = ProxyAdmin.attach(admin).connect(
        deployer
      ) as ProxyAdmin;

      console.log(
        "    Address:",
        await proxyAdmin.getProxyImplementation(address)
      );
    }
  );
