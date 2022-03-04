import { task } from "hardhat/config";
import { Voting__factory } from "../typechain";
import { loadContract } from "./config";

task("delegate", "Delegate an address")
  .addPositionalParam("delegate", "The delegate")
  .setAction(async ({ delegate }, hre) => {
    const contract = await loadContract(hre, Voting__factory, "Voting");
    const tx = await contract.delegate(delegate);
    console.log("  Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("  Transaction included in block", receipt.blockNumber);
  });
