import { task } from "hardhat/config";

import { NeokingdomDAOHardhat } from "../lib";

task("admin:transfer", "Transfer ProxyAdmin ownership")
  .addPositionalParam("address", "Requested address")
  .setAction(async ({ address }: { address: string }, hre) => {
    const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
    const contracts = await neokingdom.loadContracts();

    const tx = await contracts.proxyAdmin.transferOwnership(address);
    await tx.wait(1);

    console.log("Done");
  });
