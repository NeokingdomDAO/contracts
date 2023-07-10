import { task } from "hardhat/config";

import { PriceOracle__factory } from "../typechain";

import { NeokingdomDAOHardhat, generateDeployContext } from "../lib";
import { loadContract } from "../lib/config";
import { DEPLOY_DIA_ORACLE } from "../lib/sequence/deploy";

task("deploy:dia", "Deploy DIA Oracle").setAction(async (_, hre) => {
  const neokingdom = await NeokingdomDAOHardhat.initialize(hre, {
    verifyContracts: false,
    verbose: true,
  });
  await neokingdom.run(generateDeployContext, DEPLOY_DIA_ORACLE);
});

task("ref:dia", "Get reference data")
  .addPositionalParam("ref", "SYMBOL1/SYMBOL2")
  .setAction(async ({ ref }: { ref: string }, hre) => {
    const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
    const contracts = await neokingdom.loadContracts();
    const result = await contracts.diaOracleV2.getValue(ref);
    console.log(result);
  });

task("set:oracle", "Set oracle").setAction(async (_, hre) => {
  const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
  const contracts = await neokingdom.loadContracts();
  const result = await contracts.internalMarket.setExchangePair(
    contracts.tokenMock.address,
    contracts.diaOracleV2.address
  );
  console.log(result);
});

task("conversion", "Convert euros to usdc")
  .addPositionalParam("amount", "EUR amount")
  .setAction(async ({ amount }: { amount: number }, hre) => {
    const neokingdom = await NeokingdomDAOHardhat.initialize(hre);
    const contracts = await neokingdom.loadContracts();
    const result = await contracts.internalMarket.convertToUSDC(amount);
    console.log(result);
  });

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
