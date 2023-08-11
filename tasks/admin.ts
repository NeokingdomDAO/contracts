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

task("admin:exchange:set", "Set market exchange pair")
  .addParam("oracle", "Oracle Address")
  .addParam("usdc", "USDC Address")
  .setAction(
    async ({ oracle, usdc }: { oracle: string; usdc: string }, hre) => {
      const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
      const contracts = await neokingdom.loadContracts();

      const tx = await contracts.internalMarket.setExchangePair(usdc, oracle);
      await tx.wait(1);

      console.log("Done");
    }
  );
