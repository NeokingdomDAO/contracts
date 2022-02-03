import { ethers } from "hardhat";
import chai from "chai";
import spies from "chai-spies";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  TelediskoTokenBase,
  TelediskoTokenBase__factory,
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  VotingMock,
  VotingMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import exp from "constants";

chai.use(solidity);
chai.use(chaiAsPromised);
chai.use(spies);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

describe("TelediskoToken", () => {
  let telediskoToken: TelediskoTokenBase;
  let voting: VotingMock;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account, nonContributor] = await ethers.getSigners();

    const TelediskoTokenBaseFactory = (await ethers.getContractFactory(
      "TelediskoTokenBase",
      deployer
    )) as TelediskoTokenBase__factory;

    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock",
      deployer
    )) as VotingMock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    telediskoToken = await TelediskoTokenBaseFactory.deploy("Test", "TEST");
    voting = await VotingMockFactory.deploy();
    shareholderRegistry = await ShareholderRegistryMockFactory.deploy();

    await telediskoToken.deployed();
    await voting.deployed();
    await shareholderRegistry.deployed();

    await telediskoToken.setVoting(voting.address);
    await telediskoToken.setShareholderRegistry(shareholderRegistry.address);

    await shareholderRegistry.setNonContributor(nonContributor.address);
  });

  describe("token transfer logic", async () => {
    it("should call the Voting hook after a token transfer", async () => {
      //await chai.spy.on(voting, "afterTokenTransfer");
      //await telediskoToken.mint(account.address, 10);
      //await expect(voting.afterTokenTransfer).to.have.been.called();
    });
  });
});
