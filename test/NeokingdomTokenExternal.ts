import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

import {
  NeokingdomTokenExternal,
  NeokingdomTokenExternal__factory,
} from "../typechain";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

describe("NeokingdomToken", () => {
  let snapshotId: string;
  let ADMIN_ROLE: string;
  let MINTER_ROLE: string;

  let deployer: SignerWithAddress;
  let internalMarket: SignerWithAddress;
  let alice: SignerWithAddress;
  let neokingdomTokenExternal: NeokingdomTokenExternal;

  before(async () => {
    [deployer, internalMarket, alice] = await ethers.getSigners();

    const NeokingdomTokenExternalFactory = (await ethers.getContractFactory(
      "NeokingdomTokenExternal",
      deployer
    )) as NeokingdomTokenExternal__factory;

    neokingdomTokenExternal = await NeokingdomTokenExternalFactory.deploy(
      "Test",
      "TEST"
    );

    ADMIN_ROLE = await neokingdomTokenExternal.DEFAULT_ADMIN_ROLE();
    MINTER_ROLE = await neokingdomTokenExternal.MINTER_ROLE();

    await neokingdomTokenExternal.grantRole(
      MINTER_ROLE,
      internalMarket.address
    );
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("Roles", async () => {
    it("deployer should have ADMIN role", async () => {
      expect(
        await neokingdomTokenExternal.hasRole(ADMIN_ROLE, deployer.address)
      ).true;
    });

    it("internalMarket should have MINTER_ROLE", async () => {
      expect(
        await neokingdomTokenExternal.hasRole(
          MINTER_ROLE,
          internalMarket.address
        )
      ).true;
    });

    it("alice should not have MINTER_ROLE", async () => {
      expect(await neokingdomTokenExternal.hasRole(MINTER_ROLE, alice.address))
        .false;
    });
  });

  describe("Mint", async () => {
    it("should allow MINTER to mint", async () => {
      const initialBalance = await neokingdomTokenExternal.balanceOf(
        alice.address
      );
      await neokingdomTokenExternal
        .connect(internalMarket)
        .mint(alice.address, parseEther("1"));
      const finalBalance = await neokingdomTokenExternal.balanceOf(
        alice.address
      );
      expect(finalBalance).to.equal(initialBalance.add(parseEther("1")));
    });

    it("should revert if non-MINTER tries to mint", async () => {
      const token = neokingdomTokenExternal.connect(alice);
      await expect(token.mint(alice.address, parseEther("1"))).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${MINTER_ROLE}`
      );
    });

    it("should increase recipient balance after minting", async () => {
      const initialBalance = await neokingdomTokenExternal.balanceOf(
        alice.address
      );
      await neokingdomTokenExternal
        .connect(internalMarket)
        .mint(alice.address, parseEther("1"));
      const finalBalance = await neokingdomTokenExternal.balanceOf(
        alice.address
      );
      expect(finalBalance).to.equal(initialBalance.add(parseEther("1")));
    });

    it("should increase totalSupply after minting", async () => {
      const initialTotalSupply = await neokingdomTokenExternal.totalSupply();
      await neokingdomTokenExternal
        .connect(internalMarket)
        .mint(alice.address, parseEther("1"));
      const finalTotalSupply = await neokingdomTokenExternal.totalSupply();
      expect(finalTotalSupply).to.equal(
        initialTotalSupply.add(parseEther("1"))
      );
    });
  });
});
