import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  ShareholderRegistry,
  ShareholderRegistry__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;
const AddressOne = AddressZero.replace(/.$/, "1");

describe("Shareholder Registry", () => {
  let shareCapital = parseEther("10");
  let managerRole: string;
  enum Type {
    INVESTOR,
    FOUNDER,
    CONTRIBUTOR,
  }
  let registry: ShareholderRegistry;
  let manager: SignerWithAddress,
    founder: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress;

  beforeEach(async () => {
    [manager, founder, alice, bob, carol] = await ethers.getSigners();
    const ShareholderRegistryFactory = (await ethers.getContractFactory(
      "ShareholderRegistry",
      manager
    )) as ShareholderRegistry__factory;
    registry = await ShareholderRegistryFactory.deploy();
    managerRole = await registry.MANAGER_ROLE();
    await registry.deployed();
    await registry.grantRole(managerRole, manager.address);
    await registry.mint(founder.address, shareCapital);
    await registry.connect(founder).approve(manager.address, shareCapital);
  });

  describe("type assignment logic", async () => {
    it("should fail if address is not a shareholder set the given type for an address", async () => {
      await expect(
        registry.setStatus(Type.CONTRIBUTOR, alice.address)
      ).revertedWith("Shareholder: address is not shareholder");
    });

    it("should be callable only by a manager", async () => {
      await expect(
        registry.connect(alice).setStatus(Type.CONTRIBUTOR, alice.address)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${managerRole}`
      );
    });

    it("should say 'false' for all types if Alice does not have shares", async () => {
      expect(await registry.isShareholder(alice.address)).equal(false);
      expect(await registry.isInvestor(alice.address)).equal(false);
      expect(await registry.isContributor(alice.address)).equal(false);
      expect(await registry.isFounder(alice.address)).equal(false);
    });

    it("should return true if Alice is a contributor", async () => {
      await registry.transferFrom(
        founder.address,
        alice.address,
        parseEther("1")
      );
      expect(await registry.isContributor(alice.address)).equal(false);
      await registry.setStatus(Type.CONTRIBUTOR, alice.address);
      expect(await registry.isContributor(alice.address)).equal(true);
    });

    it("should make Alice an investor after a share transfer", async () => {
      expect(await registry.isInvestor(alice.address)).equal(false);
      registry.transferFrom(founder.address, alice.address, parseEther("1"));
      expect(await registry.isInvestor(alice.address)).equal(true);
    });

    it("should make Alice a founder", async () => {
      await registry.transferFrom(
        founder.address,
        alice.address,
        parseEther("1")
      );
      expect(await registry.isFounder(alice.address)).equal(false);
      await registry.setStatus(Type.FOUNDER, alice.address);
      expect(await registry.isFounder(alice.address)).equal(true);
    });
  });
});
