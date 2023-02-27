import { ethers, network } from "hardhat";

export async function setEVMTimestamp(timestamp: number) {
  await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
}

export async function getEVMTimestamp() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

export async function mineEVMBlock() {
  await network.provider.send("evm_mine");
}

export async function timeTravel(days: number, mineBlock = false) {
  const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const futureTimestamp = currentTimestamp + 60 * 60 * 24 * days;

  await setEVMTimestamp(futureTimestamp);
  if (mineBlock) {
    await mineEVMBlock();
  }
}
