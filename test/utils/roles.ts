import { ethers } from "hardhat";
import { Roles, Roles__factory } from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export let roles: Roles;

before(async () => {
  let deployer: SignerWithAddress;
  [deployer] = await ethers.getSigners();

  const RolesFactory = (await ethers.getContractFactory(
    "Roles",
    deployer
  )) as Roles__factory;
  roles = await RolesFactory.deploy();
  await roles.deployed();
});
