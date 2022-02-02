import { task } from "hardhat/config";
import { exportAddress } from "./config";

task("deploy", "Deploy contracts", async (_, hre) => {
  console.log("Deploy contract mocks/Resolution.sol");
  const factory = await hre.ethers.getContractFactory("ResolutionMock");

  console.log("  Network", hre.network.name);
  const contract = await factory.deploy();
  console.log("  Address", contract.address);
  const receipt = await contract.deployed();
  console.log("  Receipt", receipt.deployTransaction.hash);
  const { chainId } = await hre.ethers.provider.getNetwork();

  if (hre.network.name !== "localhost") {
    await exportAddress(chainId, "ResolutionMock", contract.address);
  }
});
