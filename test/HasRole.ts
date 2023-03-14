import { FakeContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { ethers, network, upgrades } from "hardhat";

import { DAORoles, HasRoleMock, HasRoleMock__factory } from "../typechain";

import { ROLES } from "../lib/config";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;
let snapshotId: string;

describe("HasRole", async () => {
  let daoRoles: FakeContract<DAORoles>;
  let hasRole: HasRoleMock;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    daoRoles = await smock.fake("DAORoles");

    const HasRoleMockFactory = (await ethers.getContractFactory(
      "HasRoleMock",
      deployer
    )) as HasRoleMock__factory;

    hasRole = (await upgrades.deployProxy(HasRoleMockFactory, [
      daoRoles.address,
    ])) as HasRoleMock;

    await hasRole.deployed();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
    daoRoles.hasRole.reset();
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("constructor", async () => {
    it("should initialize the internal state", async () => {
      expect(await hasRole.getRoles()).equal(daoRoles.address);
    });
  });

  describe("setRoles", async () => {
    it("should fail if account is not an OPERATOR", async () => {
      await expect(hasRole.connect(alice).setRoles(alice.address)).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${
          ROLES.OPERATOR_ROLE
        }`
      );
    });

    it("should allow an OPERATOR to set the address of DAORoles", async () => {
      // Bob isn't a contract, but that's fine it's just for testing the setter.
      const newAddress = bob.address;
      daoRoles.hasRole
        .whenCalledWith(ROLES.OPERATOR_ROLE, alice.address)
        .returns(true);
      expect(await hasRole.connect(alice).setRoles(newAddress));
      expect(await hasRole.getRoles()).equal(newAddress);
    });
  });

  describe("onlyRole modifier", async () => {
    it("should fail if account doesn't have role", async () => {
      await expect(
        hasRole.connect(alice).checkOnlyRole(ROLES.OPERATOR_ROLE)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${
          ROLES.OPERATOR_ROLE
        }`
      );
    });
  });
});
