import { task } from "hardhat/config";
import { ResolutionManager__factory } from "../typechain";
import { loadContract } from "./config";

task("types", "Add test resolution types").setAction(async ({}, hre) => {
  const contract = await loadContract(
    hre,
    ResolutionManager__factory,
    "ResolutionManager"
  );

  console.log("Adding resolution types");
  const tx = await contract.addResolutionType(
    "30sNotice3mVoting",
    66,
    30,
    60 * 3,
    false
  );

  console.log("  Submitted tx", tx.hash);
  const receipt = await tx.wait();
  console.log("  Transaction included in block", receipt.blockNumber);
});
