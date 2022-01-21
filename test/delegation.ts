import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { Delegation, Delegation__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;
const AddressOne = AddressZero.replace(/.$/, "1");

describe("Shareholder Registry", () => {
  let delegation: Delegation;
  let deployer: SignerWithAddress,
    delegator1: SignerWithAddress,
    delegator2: SignerWithAddress,
    delegated1: SignerWithAddress,
    delegated2: SignerWithAddress,
    anon: SignerWithAddress;

  beforeEach(async () => {
    [delegator1, delegator2, delegated1, delegated2, anon] = await ethers.getSigners();
    const DelegationFactory = (await ethers.getContractFactory(
      "Delegation",
      deployer
    )) as Delegation__factory;
    delegation = await DelegationFactory.deploy();
    await delegation.deployed();
  });

  describe("delegation logic", async () => {
    it("should return the account itself as a delegate when no delegates exist", async () => {
      expect(
        await delegation.getDelegated(delegator1.address)
      ).equals(delegator1.address);
    });

    it("should return no delegators for an account that has no delegates", async () => {
      expect(
        await delegation.getDelegators(delegator1.address)
      ).eql([]);
    });

    it("should set account's delegate when delegating another account", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)

      expect(
        await delegation.getDelegated(delegator1.address)
      ).equals(delegated1.address);
    });

    it("should return the last delegated account", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      await delegation.connect(delegator1).delegate(delegated2.address)
      
      expect(
        await delegation.getDelegated(delegator1.address)
      ).equals(delegated2.address);
    });

    it("should throw an error when re-delegating the already delegated account", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      
      await expect(delegation.connect(delegator1).delegate(delegated1.address)).revertedWith("Delegation: the proposed delegate is already your delegate.")
    });

    it("should throw an error when an account delegates itself as the first delegator", async () => {
      await expect(delegation.connect(delegator1).delegate(delegator1.address)).revertedWith("Delegation: the proposed delegate is already your delegate.")
    });

    it("should return no delegators when an account changes the delegate to itself", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      await delegation.connect(delegator1).delegate(delegator1.address)

      expect(
        await delegation.getDelegators(delegator1.address)
      ).eql([]);
    });

    it("should throw an error when delegating an account that already has delegates (no sub-delegation allowed)", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      
      await expect(
        delegation.connect(delegator2).delegate(delegator1.address)
      ).revertedWith("Delegation: the proposed delegate already has a delegate.")
    });

    it("should throw an error when an already delegated account tries to delegate (no sub-delegation allowed)", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      
      await expect(
        delegation.connect(delegated1).delegate(delegated2.address)
      ).revertedWith("Delegation: you already have delegators.")
    });

    it("should add the delegator to an account delegators list when that account is set as delegate from the delegator", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)

      expect(await delegation.getDelegators(delegated1.address)).eql([delegator1.address])
    });

    it("should add multiple delegators to an account delegators list when that account is set as delegate from the multiple delegators", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      await delegation.connect(delegator2).delegate(delegated1.address)

      expect(await delegation.getDelegators(delegated1.address)).eql([delegator1.address, delegator2.address])
    });

    it("should remove the delegator from an account delegators list when a different account is set as delegate from the delegator - single delegator case", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      await delegation.connect(delegator1).delegate(delegated2.address)

      expect(await delegation.getDelegators(delegated1.address)).eql([])
    });

    it("should remove the delegator from an account delegators list when a different account is set as delegate from the delegator - multiple delegators case", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      await delegation.connect(delegator2).delegate(delegated1.address)
      
      await delegation.connect(delegator1).delegate(delegated2.address)

      expect(await delegation.getDelegators(delegated1.address)).eql([delegator2.address])
    });

    it("should not add the delegator to an account delegators list when that delegator is the delegate itself", async () => {
      await delegation.connect(delegator1).delegate(delegated1.address)
      await delegation.connect(delegator1).delegate(delegator1.address)

      expect(await delegation.getDelegators(delegator1.address)).eql([])
    });
  });
});
