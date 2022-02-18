import { task } from "hardhat/config";
import { exportAddress } from "./config";

task("deploy", "Deploy contracts", async (_, hre) => {
  console.log("Deploy contract ResolutionManager.sol");
  const factoryResolution = await hre.ethers.getContractFactory(
    "ResolutionManager"
  );
  const factorySnapshottableMock = await hre.ethers.getContractFactory(
    "SnapshottableMock"
  );

  console.log("  Network", hre.network.name);
  const contractSnapshottable1 = await factorySnapshottableMock.deploy();
  await contractSnapshottable1.deployed();
  const contractSnapshottable2 = await factorySnapshottableMock.deploy();
  await contractSnapshottable2.deployed();
  const contractSnapshottable3 = await factorySnapshottableMock.deploy();
  await contractSnapshottable3.deployed();

  const contractResolution = await factoryResolution.deploy(
    contractSnapshottable1.address,
    contractSnapshottable2.address,
    contractSnapshottable3.address
  );
  console.log("  Address", contractResolution.address);
  const receipt = await contractResolution.deployed();
  console.log("  Receipt", receipt.deployTransaction.hash);
  const { chainId } = await hre.ethers.provider.getNetwork();

  if (hre.network.name !== "localhost") {
    await exportAddress(
      chainId,
      "ResolutionManager",
      contractResolution.address
    );
  }
});
