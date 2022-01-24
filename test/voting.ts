import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  Voting,
  Voting__factory,
  ERC20Mock,
  ERC20Mock__factory,
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

describe("Voting", () => {
  let voting: Voting;
  let token: ERC20Mock;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    delegator1: SignerWithAddress,
    delegator2: SignerWithAddress,
    delegated1: SignerWithAddress,
    delegated2: SignerWithAddress,
    anon: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [delegator1, delegator2, delegated1, delegated2, anon, nonContributor] =
      await ethers.getSigners();
    const VotingFactory = (await ethers.getContractFactory(
      "Voting",
      deployer
    )) as Voting__factory;

    const ERC20MockFactory = (await ethers.getContractFactory(
      "ERC20Mock",
      deployer
    )) as ERC20Mock__factory;

    const ShareholderRegistryFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    voting = await VotingFactory.deploy();
    token = await ERC20MockFactory.deploy(voting.address);
    shareholderRegistry = await ShareholderRegistryFactory.deploy();

    await voting.deployed();
    await token.deployed();
    await shareholderRegistry.deployed();

    await voting.setToken(token.address);
    await voting.setShareholderRegistry(shareholderRegistry.address);

    await shareholderRegistry.setNonContributor(nonContributor.address);

    [delegator1, delegator2, delegated1, delegated2].forEach((voter) => {
      voting.connect(voter).delegate(voter.address);
    });
  });

  describe("delegation logic", async () => {
    it("should return address 0x0 when no delegates exist", async () => {
      expect(await voting.getDelegate(anon.address)).equals(
        "0x0000000000000000000000000000000000000000"
      );
    });

    it("should throw an error when first delegate is not the account itself", async () => {
      await expect(
        voting.connect(anon).delegate(delegated1.address)
      ).revertedWith("Voting: first delegate yourself");
    });

    it("should set account's delegate when delegating another account", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);

      expect(await voting.getDelegate(delegator1.address)).equals(
        delegated1.address
      );
    });

    it("should return the last delegated account", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting.connect(delegator1).delegate(delegated2.address);

      expect(await voting.getDelegate(delegator1.address)).equals(
        delegated2.address
      );
    });

    it("should throw an error when re-delegating the already delegated account", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);

      await expect(
        voting.connect(delegator1).delegate(delegated1.address)
      ).revertedWith("Voting: the proposed delegate is already your delegate.");
    });

    it("should throw an error when delegating an account that already has delegates (no sub-delegation allowed)", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);

      await expect(
        voting.connect(delegator2).delegate(delegator1.address)
      ).revertedWith(
        "Voting: the proposed delegatee has itself a delegate. No sub-delegations allowed."
      );
    });

    it("should throw an error when an already delegated account tries to delegate (no sub-delegation allowed)", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);

      await expect(
        voting.connect(delegated1).delegate(delegated2.address)
      ).revertedWith(
        "Voting: the delegator is delegated. No sub-delegations allowed."
      );
    });

    it("should throw an error when a non contributor tries to delegate", async () => {
      await expect(
        voting.connect(nonContributor).delegate(nonContributor.address)
      ).revertedWith("Voting: only contributors can delegate.");
    });

    it("should throw an error when delegating a non contributor", async () => {
      await expect(
        voting.connect(delegator1).delegate(nonContributor.address)
      ).revertedWith("Voting: only contributors can be delegated.");
    });
  });

  describe("voting power transfer logic", async () => {
    it("should have as many votes as the balance of the account if not delegate exists", async () => {
      await token.mint(delegator1.address, 10);

      expect(await voting.getVotes(delegator1.address)).equals(10);
    });

    it.only("should increase voting power after minting new tokens", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegator1.address, 21);

      expect(await voting.getVotes(delegator1.address)).equals(31);
    });

    it("should transfer all votes to the delegatee upon delegation", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);

      expect(await voting.getVotes(delegated1.address)).equals(10);
    });

    it("should remove all votes from the delegatee upon token transfer", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);
      await token.transfer(delegated2.address, 10);

      expect(await voting.getVotes(delegated1.address)).equals(0);
    });

    it("should move as many votes as tokens transferred to the existing delegatee if delegator receives new tokens", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(anon.address, 15);
      await voting.connect(delegator1).delegate(delegated1.address);
      await token.connect(anon).transfer(delegator1.address, 15);

      expect(await voting.getVotes(delegated1.address)).equals(25);
    });

    it("should have 0 votes after delegating", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);

      expect(await voting.getVotes(delegator1.address)).equals(0);
    });

    it("should have as many votes as the balance after retransfering delegation to itself", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting.connect(delegator1).delegate(delegator1.address);

      expect(await voting.getVotes(delegator1.address)).equals(10);
    });

    it("should not increase voting power if a contributor sends tokens to a non contributor", async () => {
      await token.mint(delegator1.address, 10);
      await token.connect(delegator1).transfer(nonContributor.address, 10);

      expect(await voting.getVotes(nonContributor.address)).equals(0);
    });

    it("should increase voting power if a non contributor sends tokens to a contributor", async () => {
      await token.mint(nonContributor.address, 10);
      await token.connect(nonContributor).transfer(delegator1.address, 10);

      expect(await voting.getVotes(delegator1.address)).equals(10);
    });

    it("should not increase voting power if a non contributor is given tokens", async () => {
      await token.mint(nonContributor.address, 10);

      expect(await voting.getVotes(nonContributor.address)).equals(0);
    });
  });
});
