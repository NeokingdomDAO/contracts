import { task } from "hardhat/config";

import { ResolutionManager__factory } from "../typechain";

import { loadContract } from "../lib/config";

task("resolution:execute", "Execute a resolution")
  .addPositionalParam("id", "The id of the resolution")
  .setAction(async ({ id }: { id: string }, hre) => {
    const contract = await loadContract(
      hre,
      ResolutionManager__factory,
      "ResolutionManager"
    );

    const tx = await contract.executeResolution(id);
    console.log("  Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("  Transaction included in block", receipt.blockNumber);
  });

task("resolution:get", "Get a resolution")
  .addPositionalParam("id", "The id of the resolution to get")
  .setAction(async ({ id }: { id: string }, hre) => {
    const contract = await loadContract(
      hre,
      ResolutionManager__factory,
      "ResolutionManager"
    );

    const r = await contract.resolutions(id);
    console.log(r);
  });

task("voter-vote", "Get voter details for resolutions ID")
  .addParam("account", "The address")
  .addParam("id", "Resolution ID")
  .setAction(async ({ account, id }: { account: string; id: string }, hre) => {
    const contract = await loadContract(
      hre,
      ResolutionManager__factory,
      "ResolutionManager"
    );
    const result = await contract.getVoterVote(id, account);
    console.log(result);
  });
