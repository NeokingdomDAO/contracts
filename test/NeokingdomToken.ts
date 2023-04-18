import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

import { NeokingdomToken, NeokingdomToken__factory } from "../typechain";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

describe("GovernanceToken", () => {
  let snapshotId: string;
  let ADMIN_ROLE: string;
  let MINTER_ROLE: string;

  let deployer: SignerWithAddress;
  let internalMarket: SignerWithAddress;
  let alice: SignerWithAddress;
  let neokingdomToken: NeokingdomToken;

  before(async () => {
    [deployer, internalMarket, alice] = await ethers.getSigners();

    const NeokingdomTokenFactory = (await ethers.getContractFactory(
      "NeokingdomToken",
      deployer
    )) as NeokingdomToken__factory;

    neokingdomToken = await NeokingdomTokenFactory.deploy("Test", "TEST");

    ADMIN_ROLE = await neokingdomToken.DEFAULT_ADMIN_ROLE();
    MINTER_ROLE = await neokingdomToken.MINTER_ROLE();

    await neokingdomToken.grantRole(MINTER_ROLE, internalMarket.address);
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("Roles", async () => {
    it("deployer should have ADMIN role", async () => {
      expect(await neokingdomToken.hasRole(ADMIN_ROLE, deployer.address)).true;
    });

    it("internalMarket should have MINTER_ROLE", async () => {
      expect(await neokingdomToken.hasRole(MINTER_ROLE, internalMarket.address))
        .true;
    });

    it("alice should not have MINTER_ROLE", async () => {
      expect(await neokingdomToken.hasRole(MINTER_ROLE, alice.address)).false;
    });
  });

  describe("Mint", async () => {
    it("should allow MINTER to mint", async () => {
      const initialBalance = await neokingdomToken.balanceOf(alice.address);
      await neokingdomToken
        .connect(internalMarket)
        .mint(alice.address, parseEther("1"));
      const finalBalance = await neokingdomToken.balanceOf(alice.address);
      expect(finalBalance).to.equal(initialBalance.add(parseEther("1")));
    });

    it("should revert if non-MINTER tries to mint", async () => {
      const token = neokingdomToken.connect(alice);
      await expect(token.mint(alice.address, parseEther("1"))).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${MINTER_ROLE}`
      );
    });

    it("should increase recipient balance after minting", async () => {
      const initialBalance = await neokingdomToken.balanceOf(alice.address);
      await neokingdomToken
        .connect(internalMarket)
        .mint(alice.address, parseEther("1"));
      const finalBalance = await neokingdomToken.balanceOf(alice.address);
      expect(finalBalance).to.equal(initialBalance.add(parseEther("1")));
    });

    it("should increase totalSupply after minting", async () => {
      const initialTotalSupply = await neokingdomToken.totalSupply();
      await neokingdomToken
        .connect(internalMarket)
        .mint(alice.address, parseEther("1"));
      const finalTotalSupply = await neokingdomToken.totalSupply();
      expect(finalTotalSupply).to.equal(
        initialTotalSupply.add(parseEther("1"))
      );
    });
  });
});
