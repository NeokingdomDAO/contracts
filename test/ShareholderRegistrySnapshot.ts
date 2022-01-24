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

describe("Shareholder Registry", () => {
  let MANAGER_ROLE: string,
    SHAREHOLDER_STATUS: string,
    INVESTOR_STATUS: string,
    CONTRIBUTOR_STATUS: string,
    FOUNDER_STATUS: string;
  let shareCapital = parseEther("10");
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

    registry = await ShareholderRegistryFactory.deploy("TS", "Teledisko Share");
    await registry.deployed();

    MANAGER_ROLE = await registry.MANAGER_ROLE();

    SHAREHOLDER_STATUS = await registry.SHAREHOLDER_STATUS();
    INVESTOR_STATUS = await registry.INVESTOR_STATUS();
    CONTRIBUTOR_STATUS = await registry.CONTRIBUTOR_STATUS();
    FOUNDER_STATUS = await registry.FOUNDER_STATUS();

    await registry.grantRole(MANAGER_ROLE, manager.address);
    await registry.mint(founder.address, shareCapital);
    await registry.connect(founder).approve(manager.address, shareCapital);
  });

  describe("Status management", () => {
    it("should fail if address is not a shareholder set the given type for an address", async () => {
      await expect(
        registry.setStatus(CONTRIBUTOR_STATUS, alice.address)
      ).revertedWith("Shareholder: address has no tokens");
    });

    it("should be callable only by a manager", async () => {
      await expect(
        registry.connect(alice).setStatus(CONTRIBUTOR_STATUS, alice.address)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${MANAGER_ROLE}`
      );
    });

    it("should say 'false' for all statuses if Alice does not have shares", async () => {
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(CONTRIBUTOR_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(FOUNDER_STATUS, alice.address)).equal(
        false
      );
    });

    it("should make Alice a shareholder and investor after a share transfer", async () => {
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        false
      );
      registry.transferFrom(founder.address, alice.address, parseEther("1"));
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        true
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        true
      );
    });

    it("should make Alice a contributor after a share transfer and status change", async () => {
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        false
      );
      expect(await registry.isAtLeast(CONTRIBUTOR_STATUS, alice.address)).equal(
        false
      );
      registry.transferFrom(founder.address, alice.address, parseEther("1"));
      await registry.setStatus(CONTRIBUTOR_STATUS, alice.address);
      expect(await registry.isAtLeast(SHAREHOLDER_STATUS, alice.address)).equal(
        true
      );
      expect(await registry.isAtLeast(INVESTOR_STATUS, alice.address)).equal(
        true
      );
      expect(await registry.isAtLeast(CONTRIBUTOR_STATUS, alice.address)).equal(
        true
      );
    });
  });

  describe("Status management snapshot", () => {
    describe("balanceOfAt", () => {
      it("reverts with snapshot id of 0", async () => {
        await expect(registry.balanceOfAt(alice.address, 0)).revertedWith(
          "Snapshot: id is 0"
        );
      });
    });
  });
});
