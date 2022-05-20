/*import { task } from "hardhat/config";
import { VotingV2__factory } from "../typechain";
import { exportAddress } from "./config";

task("upgrade", "Upgrade Voting to VotingV2", async (_, hre) => {
  const [deployer] = await hre.ethers.getSigners();
  const votingV2Factory = (await hre.ethers.getContractFactory(
    "VotingV2"
  )) as VotingV2__factory;

  console.log("Upgrade Voting -> VotingV2");
  console.log("  Network:", hre.network.name);

  const votingV2Contract = await hre.upgrades.upgradeProxy(
    "0x55CBc8Fe2C6CC5F8c594709BF9dAef32Ae4Dd8d2",
    votingV2Factory
  );
  await votingV2Contract.deployed();

  console.log("    Address:", votingV2Contract.address);
  console.log("Voting upgraded");

  await exportAddress(hre, votingV2Contract, "VotingV2");
});
*/
