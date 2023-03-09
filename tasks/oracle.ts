import { task } from "hardhat/config";
import { loadContract } from "./config";
import { PriceOracle__factory } from "../typechain";

task("ref", "Get reference data")
  .addPositionalParam("base", "Base symbol")
  .addPositionalParam("quote", "Quote symbol")
  .setAction(async ({ base, quote }: { base: string; quote: string }, hre) => {
    const contract = await loadContract(
      hre,
      PriceOracle__factory,
      "PriceOracle"
    );

    const result = await contract.getReferenceData(base, quote);
    console.log(result);
  });

task("add-relayer", "Add relayer")
  .addPositionalParam("account", "Relayer address")
  .setAction(async ({ account }: { account: string }, hre) => {
    const contract = await loadContract(
      hre,
      PriceOracle__factory,
      "PriceOracle"
    );

    const tx = await contract.grantRole(await contract.RELAYER_ROLE(), account);
    await tx.wait(1);
    console.log("Done");
  });

task("relay", "Add reference data")
  .addParam("symbol", "Symbol")
  .addParam("rate", "Rate")
  .addParam("time", "Resolve time")
  .setAction(
    async (
      { symbol, rate, time }: { symbol: string; rate: number; time: number },
      hre
    ) => {
      const contract = await loadContract(
        hre,
        PriceOracle__factory,
        "PriceOracle"
      );

      console.log("Relyaing");
      console.log(`  Symbols ${symbol}`);
      console.log(`  Rates ${rate}`);
      console.log(`  Times ${time}`);

      const tx = await contract.relay([symbol], [rate], [time]);
      await tx.wait(1);
      console.log("Done");
    }
  );
