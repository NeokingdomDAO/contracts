import { formatEther } from "ethers/lib/utils";
import { task } from "hardhat/config";

import { NeokingdomDAOHardhat } from "../lib";

task("tokens:offered", "Offered balance")
  .addPositionalParam("address", "Requested address")
  .setAction(async ({ address }: { address: string }, hre) => {
    const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
    const contracts = await neokingdom.loadContracts();

    const balance = await contracts.internalMarket.offeredBalanceOf(address);

    console.log(`Balance of ${address}: ${formatEther(balance)}`);
  });

task("tokens:withdrawable", "Withdrawable balance")
  .addPositionalParam("address", "Requested address")
  .setAction(async ({ address }: { address: string }, hre) => {
    const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
    const contracts = await neokingdom.loadContracts();

    const balance = await contracts.internalMarket.withdrawableBalanceOf(
      address
    );

    console.log(`Balance of ${address}: ${formatEther(balance)}`);
  });
