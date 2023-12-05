import { FakeContract, MockContract, smock } from "@defi-wonderland/smock";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import { parseEther } from "ethers/lib/utils";
import { ethers, network, upgrades } from "hardhat";

import {
  DAORoles,
  DAORoles__factory,
  ERC20,
  IGovernanceToken,
  IRedemptionController,
  InternalMarket,
  InternalMarket__factory,
  ShareholderRegistry,
} from "../typechain";
import { IDIAOracleV2 } from "../typechain/contracts/InternalMarket/IDIAOracleV2";

import { getEVMTimestamp, mineEVMBlock, setEVMTimestamp } from "./utils/evm";
import { roles } from "./utils/roles";

chai.use(smock.matchers);
chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const DAY = 60 * 60 * 24;
const WEEK = DAY * 7;

describe("InternalMarket", async () => {
  let snapshotId: string;

  let RESOLUTION_ROLE: string;
  let daoRoles: MockContract<DAORoles>;
  let governanceToken: FakeContract<IGovernanceToken>;
  let registry: FakeContract<ShareholderRegistry>;
  let internalMarket: InternalMarket;
  let redemption: FakeContract<IRedemptionController>;
  let oracle: FakeContract<IDIAOracleV2>;
  let usdc: FakeContract<ERC20>;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let reserve: SignerWithAddress;
  let offerDuration: number;

  before(async () => {
    [deployer, alice, bob, carol, reserve] = await ethers.getSigners();

    governanceToken = await smock.fake("IGovernanceToken");

    usdc = await smock.fake("ERC20");
    usdc.decimals.returns(6);

    const DAORolesFactory = await smock.mock<DAORoles__factory>("DAORoles");
    daoRoles = await DAORolesFactory.deploy();

    const InternalMarketFactory = (await ethers.getContractFactory(
      "InternalMarket",
      deployer
    )) as InternalMarket__factory;

    internalMarket = (await upgrades.deployProxy(InternalMarketFactory, [
      daoRoles.address,
      governanceToken.address,
    ])) as InternalMarket;

    redemption = await smock.fake("IRedemptionController");
    oracle = await smock.fake("IDIAOracleV2");
    registry = await smock.fake("ShareholderRegistry");

    RESOLUTION_ROLE = await roles.RESOLUTION_ROLE();

    daoRoles.hasRole
      .whenCalledWith(RESOLUTION_ROLE, deployer.address)
      .returns(true);
    await internalMarket.setRedemptionController(redemption.address);
    await internalMarket.setExchangePair(usdc.address, oracle.address);
    await internalMarket.setReserve(reserve.address);
    await internalMarket.setShareholderRegistry(registry.address);

    offerDuration = (await internalMarket.offerDuration()).toNumber();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
    governanceToken.transfer.reset();
    governanceToken.transferFrom.reset();
    governanceToken.unwrap.reset();
    usdc.transfer.reset();
    usdc.transferFrom.reset();
    oracle.getValue.reset();
    registry.isAtLeast.returns(true);

    // make transferFrom always succeed
    governanceToken.transferFrom.returns(true);

    // Exchange rate is always 1
    oracle.getValue.returns({
      value: parseEther("1"),
      timestamp: parseEther("0"),
    });
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
    daoRoles.hasRole.reset();
    registry.isAtLeast.reset();
  });

  function parseUSDC(usdc: number) {
    return usdc * 10 ** 6;
  }

  describe("setExchangePair", async () => {
    it("should allow a resolution to set token and oracle addresses", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      await internalMarket.setExchangePair(alice.address, alice.address);
      expect(await internalMarket.exchangeToken()).equal(alice.address);
      expect(await internalMarket.priceOracle()).equal(alice.address);
    });

    it("should revert if anyone else tries to set the token address", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      await expect(
        internalMarket
          .connect(alice)
          .setExchangePair(alice.address, alice.address)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE}`
      );
    });
  });

  describe("setTokenInternal", async () => {
    it("should allow a resolution to set token and oracle addresses", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      daoRoles.hasRole
        .whenCalledWith(RESOLUTION_ROLE, deployer.address)
        .returns(true);
      await internalMarket.setTokenInternal(alice.address);
      expect(await internalMarket.tokenInternal()).equal(alice.address);
    });

    it("should revert if anyone else tries to set the token address", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      await expect(
        internalMarket.connect(alice).setTokenInternal(alice.address)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE}`
      );
    });
  });

  describe("setOfferDuration", async () => {
    it("should allow a resolution to set duration of an offer", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      daoRoles.hasRole
        .whenCalledWith(RESOLUTION_ROLE, deployer.address)
        .returns(true);
      await internalMarket.setOfferDuration(DAY);
      expect(await internalMarket.offerDuration()).equal(DAY);
    });

    it("should revert if anyone else tries to set the duration of an offer", async () => {
      // Alice is not a token, but it's a valid address, so we use it to test this function
      await expect(
        internalMarket.connect(alice).setOfferDuration(DAY)
      ).revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${RESOLUTION_ROLE}`
      );
    });
  });

  describe("makeOffer", async () => {
    beforeEach(async () => {
      governanceToken.transferFrom.returns(true);
      governanceToken.transfer.returns(true);
      usdc.transferFrom.returns(true);
    });

    it("should emit an OfferCreated event", async () => {
      await expect(internalMarket.makeOffer(1000))
        .to.emit(internalMarket, "OfferCreated")
        .withArgs(
          0,
          deployer.address,
          1000,
          (await getEVMTimestamp()) + offerDuration
        );
    });

    it("should transfer the given amount of token from the erc20", async () => {
      await internalMarket.makeOffer(1000);
      expect(governanceToken.transferFrom).calledWith(
        deployer.address,
        internalMarket.address,
        1000
      );
    });

    it("should revert when called by a non-contributor", async () => {
      registry.isAtLeast.returns(false);
      await expect(internalMarket.makeOffer(1000)).revertedWith(
        "InternalMarket: only contributors can make offers"
      );
    });

    describe("redeem", async () => {
      describe("with some unlocked tokens", async () => {
        beforeEach(async () => {
          await internalMarket.connect(alice).makeOffer(parseEther("11"));
          let ts = await getEVMTimestamp();

          await setEVMTimestamp(ts + DAY * 7);
          await mineEVMBlock();
        });
        it("should call afterRedeem on redemptionController", async () => {
          await internalMarket.connect(alice).redeem(50);

          expect(redemption.afterRedeem).calledWith(alice.address, 50);
        });

        describe("when the exchange rate is 1/1", async () => {
          beforeEach(async () => {
            oracle.getValue.whenCalledWith("EUR/USD").returns({
              value: parseEther("1"),
              timestamp: parseEther("0"),
            });
            oracle.getValue.whenCalledWith("USDC/USD").returns({
              value: parseEther("1"),
              timestamp: parseEther("0"),
            });
          });

          it("should burn the 10 DAO tokens for 10 USDC of the reserve", async () => {
            await internalMarket.connect(alice).redeem(parseEther("10"));
            expect(governanceToken.burn).calledWith(
              internalMarket.address,
              parseEther("10")
            );
            expect(usdc.transferFrom).calledWith(
              reserve.address,
              alice.address,
              parseUSDC(10)
            );
          });
        });

        describe("when the exchange rate is 1/2", async () => {
          beforeEach(async () => {
            oracle.getValue.whenCalledWith("EUR/USD").returns({
              value: parseEther("2"),
              timestamp: parseEther("0"),
            });
            oracle.getValue.whenCalledWith("USDC/USD").returns({
              value: parseEther("1"),
              timestamp: parseEther("0"),
            });
          });

          it("should burn 10 DAO token for 20 USDC", async () => {
            await internalMarket.connect(alice).redeem(parseEther("10"));

            expect(governanceToken.burn).calledWith(
              internalMarket.address,
              parseEther("10")
            );
            expect(usdc.transferFrom).calledWith(
              reserve.address,
              alice.address,
              parseUSDC(20)
            );
          });
        });

        describe("when the exchange rate is 1.12 eur/usd and 0.998 usdc/usd", async () => {
          beforeEach(async () => {
            oracle.getValue.whenCalledWith("EUR/USD").returns({
              value: parseEther("1.12"),
              timestamp: parseEther("0"),
            });
            oracle.getValue.whenCalledWith("USDC/USD").returns({
              value: parseEther("0.998"),
              timestamp: parseEther("0"),
            });
          });

          it("should burn the 10 DAO tokens for 11.222444 USDC", async () => {
            await internalMarket.connect(alice).redeem(parseEther("10"));
            expect(governanceToken.burn).calledWith(
              internalMarket.address,
              parseEther("10")
            );
            expect(usdc.transferFrom).calledWith(
              reserve.address,
              alice.address,
              parseUSDC(11.222444)
            );
          });
        });

        describe("when the exchange rate is 2/1", async () => {
          beforeEach(async () => {
            oracle.getValue.whenCalledWith("EUR/USD").returns({
              value: parseEther("1"),
              timestamp: parseEther("0"),
            });
            oracle.getValue.whenCalledWith("USDC/USD").returns({
              value: parseEther("2"),
              timestamp: parseEther("0"),
            });
          });

          it("should burn the 11 DAO tokens for 5.5 USDC", async () => {
            await internalMarket.connect(alice).redeem(parseEther("11"));
            expect(governanceToken.burn).calledWith(
              internalMarket.address,
              parseEther("11")
            );
            expect(usdc.transferFrom).calledWith(
              reserve.address,
              alice.address,
              parseUSDC(5.5)
            );
          });

          it("should exchange the 1 DAO token sat for 0 USDC sats", async () => {
            await internalMarket.connect(alice).redeem(1);
            expect(governanceToken.burn).calledWith(internalMarket.address, 1);
            expect(usdc.transferFrom).calledWith(
              reserve.address,
              alice.address,
              0
            );
          });
        });
      });

      describe("with 50 unlocked tokens and 100 locked tokens", async () => {
        beforeEach(async () => {
          await internalMarket.connect(alice).makeOffer(parseEther("50"));
          let ts = await getEVMTimestamp();

          // Unlock 50 tokens
          await setEVMTimestamp(ts + DAY * 7);

          // Lock 100 tokens
          await internalMarket.connect(alice).makeOffer(parseEther("100"));
        });

        describe("and no tokens in the user wallet", async () => {
          it("should fail when the user redeems 70 tokens", async () => {
            governanceToken.burn
              // 50 tokens are withdrawable, so redeeming 70 should burn the
              // missing 20 from Alice, but she doesn't have tokens left.
              .whenCalledWith(alice.address, parseEther("20"))
              .reverts("ERC20: burn amount exceeds balance");
            // smock2 bug causes this error rather than the faked one
            await expect(
              internalMarket.connect(alice).redeem(parseEther("70"))
            ).revertedWith("function returned an unexpected amount of data");
          });

          it("should fail when the user redeems 60 tokens", async () => {
            governanceToken.burn
              // 50 tokens are withdrawable, so redeeming 60 should take the
              // missing 10 from Alice, but she doesn't have tokens left.
              .whenCalledWith(alice.address, parseEther("10"))
              .reverts("ERC20: burn amount exceeds balance");
            await expect(
              internalMarket.connect(alice).redeem(parseEther("60"))
            ).revertedWith("function returned an unexpected amount of data");
          });

          describe("when user redeems 50 tokens", async () => {
            beforeEach(async () => {
              await internalMarket.connect(alice).redeem(parseEther("50"));
            });

            it("should burn 50 tokens from market", async () => {
              expect(governanceToken.burn).calledWith(
                internalMarket.address,
                parseEther("50")
              );
            });

            it("should transfer 50 usdc from reserve to alice", async () => {
              expect(usdc.transferFrom).calledWith(
                reserve.address,
                alice.address,
                parseUSDC(50)
              );
            });
          });
        });

        describe("and 10 tokens in the user wallet", async () => {
          beforeEach(async () => {
            governanceToken.burn.reset();
            governanceToken.burn
              .whenCalledWith(alice.address, parseEther("20"))
              .reverts("ERC20: burn amount exceeds balance");
          });

          it("should fail when the user redeems 70 tokens", async () => {
            await expect(
              internalMarket.connect(alice).redeem(parseEther("70"))
            ).revertedWith("function returned an unexpected amount of data");
          });

          describe("when the user redeems 60 tokens", async () => {
            beforeEach(async () => {
              await internalMarket.connect(alice).redeem(parseEther("60"));
            });

            it("should burn 10 tokens from alice", async () => {
              expect(governanceToken.burn).calledWith(
                alice.address,
                parseEther("10")
              );
            });

            it("should burn 50 tokens from market", async () => {
              expect(governanceToken.burn).calledWith(
                internalMarket.address,
                parseEther("50")
              );
            });

            it("should transfer 60 usdc from reserve to alice", async () => {
              expect(usdc.transferFrom).calledWith(
                reserve.address,
                alice.address,
                parseUSDC(60)
              );
            });
          });

          describe("when the user redeems 50 tokens", async () => {
            beforeEach(async () => {
              await internalMarket.connect(alice).redeem(parseEther("50"));
            });

            it("should not burn 10 tokens from alice", async () => {
              expect(governanceToken.burn).not.calledWith(
                alice.address,
                parseEther("10")
              );
            });

            it("should burn 50 tokens from market", async () => {
              expect(governanceToken.burn).calledWith(
                internalMarket.address,
                parseEther("50")
              );
            });

            it("should transfer 50 usdc from reserve to alice", async () => {
              expect(usdc.transferFrom).calledWith(
                reserve.address,
                alice.address,
                parseUSDC(50)
              );
            });
          });
        });
      });
    });

    describe("matchOffer", async () => {
      let ts: number;

      describe("standard flow", async () => {
        beforeEach(async () => {
          // At the end of this method we have:
          //
          // - An offer made on `ts`
          // - An offer made on `ts + 2 days`
          // - An offer made on `ts + 4 days`
          await internalMarket.connect(alice).makeOffer(11);
          ts = await getEVMTimestamp();

          // Move to the next day and make another offer
          await setEVMTimestamp(ts + DAY * 2);
          await internalMarket.connect(alice).makeOffer(25);

          // Move to the next day and make another offer
          await setEVMTimestamp(ts + DAY * 4);
          await internalMarket.connect(alice).makeOffer(35);
        });

        it("should match the oldest active offer", async () => {
          await expect(
            internalMarket.connect(bob).matchOffer(alice.address, 11)
          )
            .emit(internalMarket, "OfferMatched")
            .withArgs(0, alice.address, bob.address, 11);
          expect(governanceToken.transfer).calledWith(bob.address, 11);
        });

        it("should match the oldest active offer and ignore the expired ones", async () => {
          // Make offer `11` expire
          await setEVMTimestamp(ts + WEEK + DAY);
          await expect(
            internalMarket.connect(bob).matchOffer(alice.address, 25)
          )
            .emit(internalMarket, "OfferMatched")
            .withArgs(1, alice.address, bob.address, 25);
          expect(governanceToken.transfer).calledWith(bob.address, 25);
        });

        it("should match multiple active offers from the old one to the new one", async () => {
          await expect(
            internalMarket.connect(bob).matchOffer(alice.address, 11 + 25 + 1)
          )
            .emit(internalMarket, "OfferMatched")
            .withArgs(0, alice.address, bob.address, 11)
            .emit(internalMarket, "OfferMatched")
            .withArgs(1, alice.address, bob.address, 25)
            .emit(internalMarket, "OfferMatched");
          expect(governanceToken.transfer).calledWith(bob.address, 11 + 25 + 1);
        });

        it("should not allow to match more than what's available", async () => {
          await expect(
            internalMarket.connect(bob).matchOffer(alice.address, 11 + 25 + 36)
          ).revertedWith("InternalMarket: amount exceeds offer");
        });

        it("should not allow to match more than what's available when old offers expire", async () => {
          // Make offer `11` and `15` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await expect(
            internalMarket.connect(bob).matchOffer(alice.address, 36)
          ).revertedWith("InternalMarket: amount exceeds offer");
        });
      });

      it("should not allow matching already expired offers", async () => {
        // Offer1 10
        await internalMarket.connect(alice).makeOffer(10);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);

        // Offer2 1000
        await internalMarket.connect(alice).makeOffer(10);

        // Offer1 expires
        await setEVMTimestamp(ts + DAY * 7);

        // User tries to match 1000
        await internalMarket.connect(bob).matchOffer(alice.address, 10);

        // User tries to match 1000 and fails
        await expect(
          internalMarket.connect(bob).matchOffer(alice.address, 10)
        ).revertedWith("InternalMarket: amount exceeds offer");
      });

      describe("when the exchange rate is 1/1", async () => {
        beforeEach(async () => {
          oracle.getValue.whenCalledWith("EUR/USD").returns({
            value: parseEther("1"),
            timestamp: parseEther("0"),
          });
          oracle.getValue.whenCalledWith("USDC/USD").returns({
            value: parseEther("1"),
            timestamp: parseEther("0"),
          });
        });

        it("should exchange the 10 DAO tokens for 10 USDC", async () => {
          await internalMarket.connect(alice).makeOffer(parseEther("10"));

          await internalMarket
            .connect(bob)
            .matchOffer(alice.address, parseEther("10"));
          expect(governanceToken.transfer).calledWith(
            bob.address,
            parseEther("10")
          );
          expect(usdc.transferFrom).calledWith(
            bob.address,
            alice.address,
            parseUSDC(10)
          );
        });
      });

      describe("when the exchange rate is 1/2", async () => {
        beforeEach(async () => {
          oracle.getValue.whenCalledWith("EUR/USD").returns({
            value: parseEther("2"),
            timestamp: parseEther("0"),
          });
          oracle.getValue.whenCalledWith("USDC/USD").returns({
            value: parseEther("1"),
            timestamp: parseEther("0"),
          });
        });

        it("should exchange the 10 DAO token for 20 USDC", async () => {
          await internalMarket.connect(alice).makeOffer(parseEther("10"));

          await internalMarket
            .connect(bob)
            .matchOffer(alice.address, parseEther("10"));
          expect(governanceToken.transfer).calledWith(
            bob.address,
            parseEther("10")
          );
          expect(usdc.transferFrom).calledWith(
            bob.address,
            alice.address,
            parseUSDC(20)
          );
        });
      });

      describe("when the exchange rate is 1.12 eur/usd and 0.998 usdc/usd", async () => {
        beforeEach(async () => {
          oracle.getValue.whenCalledWith("EUR/USD").returns({
            value: parseEther("1.12"),
            timestamp: parseEther("0"),
          });
          oracle.getValue.whenCalledWith("USDC/USD").returns({
            value: parseEther("0.998"),
            timestamp: parseEther("0"),
          });
        });

        it("should exchange the 10 DAO tokens for 11.222444 USDC", async () => {
          await internalMarket.connect(alice).makeOffer(parseEther("10"));

          await internalMarket
            .connect(bob)
            .matchOffer(alice.address, parseEther("10"));
          expect(governanceToken.transfer).calledWith(
            bob.address,
            parseEther("10")
          );
          expect(usdc.transferFrom).calledWith(
            bob.address,
            alice.address,
            parseUSDC(11.222444)
          );
        });
      });

      describe("when the exchange rate is 2/1", async () => {
        beforeEach(async () => {
          oracle.getValue.whenCalledWith("EUR/USD").returns({
            value: parseEther("1"),
            timestamp: parseEther("0"),
          });
          oracle.getValue.whenCalledWith("USDC/USD").returns({
            value: parseEther("2"),
            timestamp: parseEther("0"),
          });
        });

        it("should exchange the 11 DAO tokens for 5.5 USDC", async () => {
          await internalMarket.connect(alice).makeOffer(parseEther("11"));

          await internalMarket
            .connect(bob)
            .matchOffer(alice.address, parseEther("11"));
          expect(governanceToken.transfer).calledWith(
            bob.address,
            parseEther("11")
          );
          expect(usdc.transferFrom).calledWith(
            bob.address,
            alice.address,
            parseUSDC(5.5)
          );
        });

        it("should exchange the 1 DAO token sat for 0 USDC sats", async () => {
          await internalMarket.connect(alice).makeOffer(1);
          await internalMarket.connect(bob).matchOffer(alice.address, 1);
          expect(governanceToken.transfer).calledWith(bob.address, 1);
          expect(usdc.transferFrom).calledWith(bob.address, alice.address, 0);
        });
      });
    });

    describe("deposit", async () => {
      it("should call deposit on tokenInternal", async () => {
        await internalMarket.connect(bob).deposit(10);
        expect(governanceToken.wrap).calledWith(bob.address, 10);
      });

      it("should emit a Deposit event", async () => {
        await expect(internalMarket.connect(bob).deposit(10))
          .to.emit(internalMarket, "Deposited")
          .withArgs(bob.address, 10);
      });
    });

    describe("finalizeDeposit", async () => {
      it("should call settle on tokenInternal", async () => {
        await internalMarket.connect(bob).finalizeDeposit();
        expect(governanceToken.settleTokens).calledWith(bob.address);
      });

      it("should emit a Settled event", async () => {
        await expect(internalMarket.connect(bob).finalizeDeposit())
          .to.emit(internalMarket, "Settled")
          .withArgs(bob.address);
      });
    });

    describe("withdraw", async () => {
      let ts: number;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await internalMarket.connect(alice).makeOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await internalMarket.connect(alice).makeOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await internalMarket.connect(alice).makeOffer(35);
      });

      it("should not allow to withdraw if there are no offers", async () => {
        await expect(
          internalMarket.connect(bob).withdraw(bob.address, 10)
        ).revertedWith("InternalMarket: amount exceeds balance");
      });

      it("should not allow to withdraw if there are no expired offers", async () => {
        await expect(
          internalMarket.connect(alice).withdraw(alice.address, 10)
        ).revertedWith("InternalMarket: amount exceeds balance");
      });

      it("should allow to withdraw if caller is not a contributor", async () => {
        registry.isAtLeast.reset();
        registry.isAtLeast
          .whenCalledWith(await registry.CONTRIBUTOR_STATUS(), bob.address)
          .returns(false);

        await internalMarket.connect(bob).withdraw(alice.address, 10);

        expect(governanceToken.unwrap).calledWith(
          bob.address,
          alice.address,
          10
        );
      });

      it("should not allow to withdraw if the amount is bigger than the amount of the expired offers", async () => {
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          internalMarket.connect(alice).withdraw(alice.address, 20)
        ).revertedWith("InternalMarket: amount exceeds balance");
      });

      it("should allow to withdraw if the amount is less than the amount of the expired offers", async () => {
        await setEVMTimestamp(ts + WEEK + DAY);
        await internalMarket.connect(alice).withdraw(bob.address, 5);
        expect(governanceToken.unwrap).calledWith(
          internalMarket.address,
          bob.address,
          5
        );
      });

      it("should allow to withdraw if the amount is equal to the the amount of the expired offers", async () => {
        await setEVMTimestamp(ts + WEEK + DAY);
        await internalMarket.connect(alice).withdraw(bob.address, 11);
        expect(governanceToken.unwrap).calledWith(
          internalMarket.address,
          bob.address,
          11
        );
      });

      it("should allow to withdraw if the amount is equal to the the amount of all expired offers", async () => {
        await setEVMTimestamp(ts + WEEK + DAY * 3);
        await internalMarket.connect(alice).withdraw(bob.address, 11 + 25);
        expect(governanceToken.unwrap).calledWith(
          internalMarket.address,
          bob.address,
          11 + 25
        );
      });

      it("should emit a Withdrawn event", async () => {
        await setEVMTimestamp(ts + WEEK + DAY * 3);
        expect(internalMarket.connect(alice).withdraw(bob.address, 11))
          .to.emit(internalMarket, "Withdrawn")
          .withArgs(alice.address, bob.address, 11);
      });
    });

    describe("match+withdraw", async () => {
      describe("standard flow", async () => {
        let ts: number;
        beforeEach(async () => {
          // At the end of this method we have:
          //
          // - An offer made on `ts`
          // - An offer made on `ts + 2 days`
          // - An offer made on `ts + 4 days`
          await internalMarket.connect(alice).makeOffer(11);
          ts = await getEVMTimestamp();

          // Move to the next day and make another offer
          await setEVMTimestamp(ts + DAY * 2);
          await internalMarket.connect(alice).makeOffer(25);

          // Move to the next day and make another offer
          await setEVMTimestamp(ts + DAY * 4);
          await internalMarket.connect(alice).makeOffer(35);
        });

        it("should not allow to withdraw if an offer has been matched", async () => {
          // Bob matches Alice's offer
          await internalMarket.connect(bob).matchOffer(alice.address, 11);
          // Alice's offer expires
          await setEVMTimestamp(ts + WEEK + DAY);
          await expect(
            internalMarket.connect(alice).withdraw(bob.address, 11)
          ).revertedWith("InternalMarket: amount exceeds balance");
        });

        it("should allow to withdraw a portion of the offered tokens including an expired offer", async () => {
          // Bob matches Alice's offer
          await internalMarket.connect(bob).matchOffer(alice.address, 5);
          // Alice's offer expires
          await setEVMTimestamp(ts + WEEK + DAY);
          await internalMarket.connect(alice).withdraw(carol.address, 6);
          expect(governanceToken.unwrap).calledWith(
            internalMarket.address,
            carol.address,
            6
          );
        });

        it("should allow to withdraw a portion of the offered tokens including expired offers", async () => {
          // Bob matches Alice's offer
          await internalMarket.connect(bob).matchOffer(alice.address, 5);
          // Alice's first two offers expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          // Alice can withdraw 6 + 25 tokens
          await internalMarket.connect(alice).withdraw(carol.address, 6 + 25);
          expect(governanceToken.unwrap).calledWith(
            internalMarket.address,
            carol.address,
            6 + 25
          );
        });
      });

      it("should allow to withdraw tokens from expired offers even after a match of a later offer", async () => {
        // Offer1 10
        await internalMarket.connect(alice).makeOffer(10);
        let ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);

        // Offer2 10
        await internalMarket.connect(alice).makeOffer(10);

        // Offer1 expires
        await setEVMTimestamp(ts + DAY * 7);

        // User matches 10
        await internalMarket.connect(bob).matchOffer(alice.address, 10);

        await internalMarket.connect(alice).withdraw(carol.address, 10);

        expect(governanceToken.unwrap.atCall(0)).calledWith(
          internalMarket.address,
          carol.address,
          10
        );
      });

      it("should allow to match offered tokens after a withdraw of a previously expired offer", async () => {
        // Offer1 10
        await internalMarket.connect(alice).makeOffer(10);
        let ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);

        // Offer2 1000
        await internalMarket.connect(alice).makeOffer(10);

        // Offer1 expires
        await setEVMTimestamp(ts + DAY * 7);

        // User withdraws 1000
        await internalMarket.connect(alice).withdraw(carol.address, 10);

        await internalMarket.connect(bob).matchOffer(alice.address, 10);

        expect(governanceToken.transfer.atCall(0)).calledWith(bob.address, 10);
      });
    });

    describe("balances", async () => {
      describe("standard flow", async () => {
        let ts: number;
        const DAY = 60 * 60 * 24;
        const WEEK = DAY * 7;

        beforeEach(async () => {
          // At the end of this method we have:
          //
          // - An offer made on `ts`
          // - An offer made on `ts + 2 days`
          // - An offer made on `ts + 4 days`
          await internalMarket.connect(alice).makeOffer(11);
          ts = await getEVMTimestamp();

          // Move to the next day and make another offer
          await setEVMTimestamp(ts + DAY * 2);
          await internalMarket.connect(alice).makeOffer(25);

          // Move to the next day and make another offer
          await setEVMTimestamp(ts + DAY * 4);
          await internalMarket.connect(alice).makeOffer(35);
        });

        describe("offeredBalanceOf", async () => {
          it("should be equal to the amount of tokens offered", async () => {
            await mineEVMBlock();
            expect(
              await internalMarket
                .connect(alice)
                .offeredBalanceOf(alice.address)
            ).equal(11 + 25 + 35);
          });

          it("should be equal to the amount of tokens offered minus the expired offers", async () => {
            // Make offer `11` expire
            await setEVMTimestamp(ts + WEEK + DAY);
            await mineEVMBlock();
            expect(
              await internalMarket
                .connect(alice)
                .offeredBalanceOf(alice.address)
            ).equal(25 + 35);
          });

          it("should be equal to 0 for bob", async () => {
            expect(await internalMarket.offeredBalanceOf(bob.address)).equal(0);
          });
        });

        describe("withdrawableBalanceOf", async () => {
          it("should be equal to zero when alice just started offering their tokens", async () => {
            await mineEVMBlock();
            expect(
              await internalMarket
                .connect(alice)
                .withdrawableBalanceOf(alice.address)
            ).equal(0);
          });

          it("should be equal to the expired offers", async () => {
            // Make offer `11` and `25` expire
            await setEVMTimestamp(ts + WEEK + DAY * 3);
            await mineEVMBlock();
            expect(
              await internalMarket
                .connect(alice)
                .withdrawableBalanceOf(alice.address)
            ).equal(11 + 25);
          });

          it("should be equal to balance for bob", async () => {
            expect(
              await internalMarket.withdrawableBalanceOf(bob.address)
            ).equal(0);
          });
        });
      });

      it("should count expired offers, even if there are active offers", async () => {
        // Offer1 10
        await internalMarket.connect(alice).makeOffer(10);
        let ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);

        // Offer2 1000
        await internalMarket.connect(alice).makeOffer(10);

        // Offer1 expires
        await setEVMTimestamp(ts + DAY * 7);

        // User matches 1000
        await internalMarket.connect(bob).matchOffer(alice.address, 10);

        const result = await internalMarket.withdrawableBalanceOf(
          alice.address
        );

        expect(result).equal(10);
      });
    });
  });
});
