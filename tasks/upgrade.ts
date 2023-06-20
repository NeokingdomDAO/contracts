import { task } from "hardhat/config";

import {
  GovernanceTokenV2Mock__factory,
  InternalMarket__factory,
  ProxyAdmin,
  ProxyAdmin__factory,
  ResolutionManager__factory,
} from "../typechain";

import { NeokingdomDAOHardhat } from "../lib";

task("upgrade:resolution", "Upgrade ResolutionManager", async (_, hre) => {
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
});

task("upgrade:market", "Upgrade Internal Market", async (_, hre) => {
  const internalMarketFactory = (await hre.ethers.getContractFactory(
    "InternalMarket"
  )) as InternalMarket__factory;

  const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
  const contracts = await neokingdom.loadContracts();
  console.log("Upgrade InternalMarket");
  console.log("  Network:", hre.network.name);

  const internalMarketContract = await hre.upgrades.upgradeProxy(
    contracts.internalMarket.address,
    internalMarketFactory
  );
  await internalMarketContract.deployed();

  console.log("    Address:", internalMarketContract.address);
  console.log("InternalMarket upgraded");
});

task("upgrade:governance", "Upgrade Governance Token", async (_, hre) => {
  const governanceTokenFactory = (await hre.ethers.getContractFactory(
    "GovernanceToken"
  )) as GovernanceTokenV2Mock__factory;

  const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
  const contracts = await neokingdom.loadContracts();
  console.log("Upgrade GovernanceToken");
  console.log("  Network:", hre.network.name);

  const governanceTokenContract = await hre.upgrades.upgradeProxy(
    contracts.governanceToken.address,
    governanceTokenFactory
  );
  await governanceTokenContract.deployed();

  console.log("    Address:", governanceTokenContract.address);
  console.log("GovernanceToken upgraded");
});

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
