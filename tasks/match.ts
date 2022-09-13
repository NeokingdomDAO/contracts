import { task } from "hardhat/config";
import { parseEther } from "ethers/lib/utils";
import { loadContract } from "./config";
import { TelediskoToken__factory } from "../typechain";

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
        TelediskoToken__factory,
        "TelediskoToken"
      );

      const tx = await contract.matchOffer(
        fromAddress,
        toAddress,
        parseEther(amount)
      );
      console.log("  Submitted tx", tx.hash);
      const receipt = await tx.wait();
      console.log("  Transaction included in block", receipt.blockNumber);
    }
  );
