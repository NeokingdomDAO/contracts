import { ethers, network } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { PriceOracle, PriceOracle__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;
let snapshotId: string;

describe("PriceOracle", async () => {
  let priceOracle: PriceOracle;
  let deployer: SignerWithAddress, account: SignerWithAddress;

  before(async () => {
    [deployer, account] = await ethers.getSigners();

    const PriceOracleFactory = (await ethers.getContractFactory(
      "PriceOracle",
      deployer
    )) as PriceOracle__factory;

    priceOracle = await PriceOracleFactory.deploy();
    await priceOracle.deployed();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  describe("relay", async () => {
    it("should fail if not called by a relayer", async () => {
      await expect(
        priceOracle.connect(account).relay(["test"], [42], [43])
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${await priceOracle.RELAYER_ROLE()}`
      );
    });

    it("should fail if rates length doesn't match symbol length", async () => {
      await expect(priceOracle.relay(["test"], [42, 43], [43])).revertedWith(
        "BAD_RATES_LENGTH"
      );
    });

    it("should fail if resolve times length doesn't match symbol length", async () => {
      await expect(priceOracle.relay(["test"], [42], [43, 42])).revertedWith(
        "BAD_RESOLVE_TIMES_LENGTH"
      );
    });

    it("should emit 1 event per element", async () => {
      await expect(priceOracle.relay(["test1", "test2"], [42, 43], [44, 45]))
        .to.emit(priceOracle, "RefDataUpdate")
        .withArgs("test1", 42, 44)
        .to.emit(priceOracle, "RefDataUpdate")
        .withArgs("test2", 43, 45);
    });
  });

  describe("getReferenceDataBulk", async () => {
    it("should fail", async () => {
      await expect(priceOracle.getReferenceDataBulk([], [])).revertedWith(
        "NOT_IMPLEMENTED"
      );
    });
  });

  describe("getReferenceData", async () => {
    it("should fail if called with non saved _base", async () => {
      await priceOracle.relay(["EEUR"], [42], [43]);
      await expect(priceOracle.getReferenceData("FAIL", "EEUR")).revertedWith(
        "REF_DATA_NOT_AVAILABLE"
      );
    });

    it("should fail if called with non saved _quote", async () => {
      await priceOracle.relay(["EEUR"], [42], [43]);
      await expect(priceOracle.getReferenceData("EEUR", "FAIL")).revertedWith(
        "REF_DATA_NOT_AVAILABLE"
      );
    });

    it("should return ratio in reference data", async () => {
      const eeurUsd = parseEther("0.975286");
      const eurUsd = parseEther("1.032572");
      await priceOracle.relay(["EEUR", "EUR"], [eeurUsd, eurUsd], [43, 44]);

      const result = await priceOracle.getReferenceData("EEUR", "EUR");

      expect(result[0]).equal(BigNumber.from("944521060032617580"));
      expect(result[1]).equal(43);
      expect(result[2]).equal(44);
    });

    it("should return same when _quote is USD", async () => {
      const eeurUsd = parseEther("0.975286");
      await priceOracle.relay(["EEUR"], [eeurUsd], [43]);

      const result = await priceOracle.getReferenceData("EEUR", "USD");

      expect(result[0]).equal(BigNumber.from("975286000000000000"));
    });

    it("should return 1 / _quote when _base is USD", async () => {
      const eeurUsd = parseEther("0.975286");
      await priceOracle.relay(["EEUR"], [eeurUsd], [43]);

      const result = await priceOracle.getReferenceData("USD", "EEUR");

      expect(result[0]).equal(BigNumber.from("1025340259165003906"));
    });
  });
});
