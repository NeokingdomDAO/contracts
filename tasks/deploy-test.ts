import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";

import {
  ERC20__factory,
  InternalMarketTest,
  InternalMarketTest__factory,
  NKTest__factory,
  NeokingdomToken,
  PriceOracle__factory,
} from "../typechain";

import { exportAddress, loadContract } from "./config";
import { deployProxy, getWallet } from "./utils";

const usdcAddress = "0x15c3eb3b621d1bff62cba1c9536b7c1ae9149b57";
const oracleAddress = "0x666CDb721838B1b8C0C234DAa0D9Dbc821103aA5";

task("deploy-test", "Deploy Exchange Test").setAction(async (_, hre) => {
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

  const neokingdomTokenContract = (await deployProxy(hre, deployer, "NKTest", [
    "Text Ex",
    "TEX",
  ])) as NeokingdomToken;
  await exportAddress(hre, neokingdomTokenContract, "NKTest");

  const internalMaketContract = (await deployProxy(
    hre,
    deployer,
    "InternalMarketTest",
    [neokingdomTokenContract.address]
  )) as InternalMarketTest;
  await exportAddress(hre, internalMaketContract, "InternalMarketTest");

  const tx = await internalMaketContract.setExchangePair(
    usdcAddress,
    oracleAddress
  );
  await tx.wait(1);

  console.log("\n\nWell done 🐯 time to setup your DAO!");
});

task("mint-test", "Mint test tokens")
  .addParam("amount", "Amount")
  .addParam("to", "To")
  .setAction(
    async (
      {
        amount,
        to,
      }: {
        amount: string;
        to: string;
      },
      hre
    ) => {
      const contract = await loadContract(hre, NKTest__factory, "NKTest");

      console.log(`Current balance ${await contract.balanceOf(to)}`);

      await contract.mint(to, parseEther(amount));
    }
  );

task("offer-test", "Offer test tokens")
  .addParam("amount", "Amount")
  .setAction(
    async (
      {
        amount,
      }: {
        amount: string;
      },
      hre
    ) => {
      const contract = await loadContract(
        hre,
        InternalMarketTest__factory,
        "InternalMarketTest"
      );

      const daoToken = await loadContract(hre, NKTest__factory, "NKTest");
      console.log("Approving");
      const tx = await daoToken.approve(contract.address, parseEther(amount));
      await tx.wait(1);

      console.log(`Offering`);

      await contract.makeOffer(parseEther(amount));
    }
  );

task("tokens-test", "Get test tokens")
  .addParam("of", "Address")
  .setAction(
    async (
      {
        of,
      }: {
        of: string;
      },
      hre
    ) => {
      const daoToken = await loadContract(hre, NKTest__factory, "NKTest");
      console.log(`Tokens ${await daoToken.balanceOf(of)}`);
    }
  );

task("match-test", "Offer test tokens")
  .addParam("amount", "Amount")
  .addParam("from", "From")
  .setAction(
    async (
      {
        amount,
        from,
      }: {
        amount: string;
        from: string;
      },
      hre
    ) => {
      const deployer = await getWallet(hre);
      const market = await loadContract(
        hre,
        InternalMarketTest__factory,
        "InternalMarketTest"
      );

      const usdc = ERC20__factory.connect(usdcAddress, deployer);
      console.log(`Decimals ${await usdc.decimals()}`);
      console.log(`Available USDC: ${await usdc.balanceOf(deployer.address)}`);
      console.log("Approving");
      const oracle = PriceOracle__factory.connect(oracleAddress, deployer);
      const eurUsd = (await oracle.getReferenceData("EUR", "USD")).rate;
      const usdcUsd = (await oracle.getReferenceData("USDC", "USD")).rate;
      const conversion = BigNumber.from(parseEther(amount))
        .mul(eurUsd)
        .div(usdcUsd)
        .div(BigNumber.from(10).pow(18 - (await usdc.decimals())));

      const tx = await usdc.approve(market.address, conversion.mul(amount));
      await tx.wait(2);

      console.log(`Offering`);

      await market.matchOffer(from, parseEther(amount));
    }
  );

task("convert-test", "Offer test tokens")
  .addParam("amount", "Amount")
  .setAction(
    async (
      {
        amount,
      }: {
        amount: string;
      },
      hre
    ) => {
      const deployer = await getWallet(hre);
      const oracle = PriceOracle__factory.connect(oracleAddress, deployer);
      const usdc = ERC20__factory.connect(usdcAddress, deployer);
      console.log(`USDC Decimale ${await usdc.decimals()}`);
      const eurUsd = (await oracle.getReferenceData("EUR", "USD")).rate;
      console.log(`EUR/USD ${eurUsd.toString()}`);
      const usdcUsd = (await oracle.getReferenceData("USDC", "USD")).rate;
      console.log(`USDC/USD ${usdcUsd.toString()}`);
      const conversion = BigNumber.from(parseEther(amount))
        .mul(eurUsd)
        .div(usdcUsd)
        .div(BigNumber.from(10).pow(18 - (await usdc.decimals())));

      console.log(`Conversion ${conversion.toString()}`);
    }
  );
