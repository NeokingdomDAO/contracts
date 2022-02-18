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
