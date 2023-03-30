import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";

import {
  DAORoles,
  INeokingdomToken,
  INeokingdomTokenExternal,
  InternalMarket,
  TokenGateway,
  TokenGateway__factory,
} from "../typechain";

import { roles } from "./utils/roles";

chai.use(smock.matchers);
chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;
let snapshotId: string;

describe("TokenGateway", async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let tokenGateway: TokenGateway;
  let daoRoles: FakeContract<DAORoles>;
  let neokingdomTokenExternal: FakeContract<INeokingdomTokenExternal>;
  let neokingdomToken: FakeContract<INeokingdomToken>;
  let internalMarket: FakeContract<InternalMarket>;

  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();

    neokingdomTokenExternal = await smock.fake("INeokingdomTokenExternal");
    neokingdomToken = await smock.fake("INeokingdomToken");
    internalMarket = await smock.fake("InternalMarket");
    daoRoles = await smock.fake("DAORoles");
    daoRoles = await smock.fake("DAORoles");
    daoRoles.hasRole
      .whenCalledWith(await roles.RESOLUTION_ROLE(), deployer.address)
      .returns(true);

    const TokenGatewayFactory = (await ethers.getContractFactory(
      "TokenGateway",
      deployer
    )) as TokenGateway__factory;

    tokenGateway = (await upgrades.deployProxy(
      TokenGatewayFactory,
      [
        daoRoles.address,
        neokingdomTokenExternal.address,
        neokingdomToken.address,
        internalMarket.address,
      ],
      { initializer: "initialize" }
    )) as TokenGateway;

    await tokenGateway.deployed();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("mint", async () => {
    it("should mint external tokens and assign them to the gateway contract", async () => {
      await tokenGateway.mint(alice.address, parseEther("10"));
      expect(neokingdomTokenExternal.mint).calledWith(
        tokenGateway.address,
        parseEther("10")
      );
    });

    it("should mint internal tokens and assign them to the user", async () => {
      await tokenGateway.mint(alice.address, parseEther("10"));
      expect(neokingdomTokenExternal.mint).calledWith(
        tokenGateway.address,
        parseEther("10")
      );
    });
  });

  describe("deposit", async () => {
    it("should transfer external tokens to the gateway contract", async () => {
      await tokenGateway.connect(alice).deposit(parseEther("10"));
      expect(neokingdomTokenExternal.transferFrom).calledWith(
        alice.address,
        tokenGateway.address,
        parseEther("10")
      );
    });

    it("should mint new internal tokens to the depositer", async () => {
      await tokenGateway.connect(alice).deposit(parseEther("10"));
      expect(neokingdomToken.mint).calledWith(alice.address, parseEther("10"));
    });
  });

  describe("withdraw", async () => {
    it("should transfer external tokens to the withdrawer", async () => {
      await tokenGateway
        .connect(alice)
        .withdraw(alice.address, parseEther("10"));
      expect(neokingdomTokenExternal.transfer).calledWith(
        alice.address,
        parseEther("10")
      );
    });

    it("should burn the internal tokens from the withdrawer", async () => {
      await tokenGateway
        .connect(alice)
        .withdraw(alice.address, parseEther("10"));
      expect(neokingdomToken.burn).calledWith(alice.address, parseEther("10"));
    });
  });
});
