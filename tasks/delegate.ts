import { task } from "hardhat/config";
import { readFile } from "fs/promises";
import { Voting__factory } from "../typechain";

task("delegate", "Delegate an address")
  .addPositionalParam("delegate", "The delegate")
  .setAction(async ({ delegate }, hre) => {
    const network = JSON.parse(
      await readFile("./deployments/networks.json", "utf8")
    );

    const [deployer] = await hre.ethers.getSigners();

    const { chainId } = await hre.ethers.provider.getNetwork();

    const voting = Voting__factory.connect(
      network[chainId]["Voting"],
      deployer
    );

    const tx = await voting.delegate(delegate);
    console.log("Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction included in block", receipt.blockNumber);
  });
