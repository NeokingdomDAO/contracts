import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";

import { GovernanceToken__factory } from "../typechain";

import { loadContract } from "../lib/config";

task("match-offer", "Match an offer")
  .addPositionalParam("fromAddress", "From address")
  .addPositionalParam("toAddress", "To address")
  .addPositionalParam("amount", "Amount match")
  .setAction(
    async (
      {
        fromAddress,
        toAddress,
        amount,
      }: { fromAddress: string; toAddress: string; amount: string },
      hre
    ) => {
      const contract = await loadContract(
        hre,
        GovernanceToken__factory,
        "GovernanceToken"
      );

      throw "Not implemented";

      /*
      const tx = await contract.matchOffer(
        fromAddress,
        toAddress,
        parseEther(amount)
      );
      console.log("  Submitted tx", tx.hash);
      const receipt = await tx.wait();
      console.log("  Transaction included in block", receipt.blockNumber);
      */
    }
  );
