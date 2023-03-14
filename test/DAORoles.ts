import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";

import { DAORoles, DAORoles__factory } from "../typechain";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;
let snapshotId: string;

describe("DAORoles", async () => {
  let daoRoles: DAORoles;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    const DAORolesFactory = (await ethers.getContractFactory(
      "DAORoles",
      deployer
    )) as DAORoles__factory;
    daoRoles = await DAORolesFactory.deploy();
    await daoRoles.deployed();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("constructor", async () => {
    it("should give ADMIN rights to the deployer", async () => {
      expect(
        await daoRoles.hasRole(daoRoles.DEFAULT_ADMIN_ROLE(), deployer.address)
      ).true;
    });
  });
});
