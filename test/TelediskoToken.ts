import { ethers, upgrades } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  NeokingdomToken,
  NeokingdomToken__factory,
  ShareholderRegistryMock,
  ShareholderRegistryMock__factory,
  VotingMock,
  VotingMock__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setEVMTimestamp, getEVMTimestamp, mineEVMBlock } from "./utils/evm";
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

const DAY = 60 * 60 * 24;
const WEEK = DAY * 7;

describe("NeokingdomToken", () => {
  let RESOLUTION_ROLE: string, OPERATOR_ROLE: string, ESCROW_ROLE: string;
  let neokingdomToken: NeokingdomToken;
  let voting: VotingMock;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    account: SignerWithAddress,
    contributor: SignerWithAddress,
    contributor2: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [deployer, account, contributor, contributor2, nonContributor] =
      await ethers.getSigners();

    const NeokingdomTokenFactory = (await ethers.getContractFactory(
      "NeokingdomToken",
      deployer
    )) as NeokingdomToken__factory;

    const VotingMockFactory = (await ethers.getContractFactory(
      "VotingMock",
      deployer
    )) as VotingMock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    neokingdomToken = (await upgrades.deployProxy(
      NeokingdomTokenFactory,
      ["Test", "TEST"],
      { initializer: "initialize" }
    )) as NeokingdomToken;
    await neokingdomToken.deployed();

    voting = (await upgrades.deployProxy(VotingMockFactory)) as VotingMock;
    await voting.deployed();

    RESOLUTION_ROLE = await roles.RESOLUTION_ROLE();
    await neokingdomToken.grantRole(RESOLUTION_ROLE, deployer.address);

    OPERATOR_ROLE = await roles.OPERATOR_ROLE();
    await neokingdomToken.grantRole(OPERATOR_ROLE, deployer.address);

    ESCROW_ROLE = await roles.ESCROW_ROLE();
    await neokingdomToken.grantRole(ESCROW_ROLE, deployer.address);

    shareholderRegistry = (await upgrades.deployProxy(
      ShareholderRegistryMockFactory,
      {
        initializer: "initialize",
      }
    )) as ShareholderRegistryMock;
    await shareholderRegistry.deployed();

    await neokingdomToken.setVoting(voting.address);
    await neokingdomToken.setShareholderRegistry(shareholderRegistry.address);

    const contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    const shareholderStatus = await shareholderRegistry.SHAREHOLDER_STATUS();
    const investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    await setContributor(contributor, true);
    await setContributor(contributor2, true);

    async function setContributor(user: SignerWithAddress, flag: boolean) {
      await shareholderRegistry.mock_isAtLeast(
        contributorStatus,
        user.address,
        flag
      );
      await shareholderRegistry.mock_isAtLeast(
        shareholderStatus,
        user.address,
        flag
      );
      await shareholderRegistry.mock_isAtLeast(
        investorStatus,
        user.address,
        flag
      );
    }
  });

  describe("token transfer logic", async () => {
    it("should call the Voting hook after a minting", async () => {
      await expect(neokingdomToken.mint(account.address, 10))
        .emit(voting, "AfterTokenTransferCalled")
        .withArgs(AddressZero, account.address, 10);
    });

    it("should call the Voting hook after a token transfer", async () => {
      neokingdomToken.mint(account.address, 10);
      await expect(
        neokingdomToken.connect(account).transfer(nonContributor.address, 10)
      )
        .emit(voting, "AfterTokenTransferCalled")
        .withArgs(account.address, nonContributor.address, 10);
    });
  });

  describe("minting", async () => {
    it("should disable transfer when tokens are minted to a contributor", async () => {
      neokingdomToken.mint(contributor.address, 10);
      await expect(
        neokingdomToken.connect(contributor).transfer(contributor2.address, 1)
      ).revertedWith("NeokingdomToken: transfer amount exceeds unlocked tokens");
    });

    it("should allow transfer when tokens are minted to anyone else", async () => {
      neokingdomToken.mint(account.address, 10);
      await expect(
        neokingdomToken.connect(account).transfer(contributor2.address, 1)
      )
        .emit(neokingdomToken, "Transfer")
        .withArgs(account.address, contributor2.address, 1);
    });
  });

  describe("burning", async () => {
    it("should disable burn when tokens are minted to a contributor", async () => {
      neokingdomToken.mint(contributor.address, 10);
      await expect(neokingdomToken.burn(contributor.address, 1)).revertedWith(
        "NeokingdomToken: transfer amount exceeds unlocked tokens"
      );
    });

    it("should allow burn when tokens are minted to anyone else", async () => {
      neokingdomToken.mint(account.address, 10);
      await expect(neokingdomToken.burn(account.address, 1))
        .emit(neokingdomToken, "Transfer")
        .withArgs(account.address, AddressZero, 1);
    });
  });

  describe("vesting", async () => {
    it("should not allow balance in vesting to be transferred", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      await expect(
        neokingdomToken.connect(account).transfer(nonContributor.address, 50)
      ).revertedWith("NeokingdomToken: transfer amount exceeds vesting");
    });

    it("should update the vesting balance", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      expect(await neokingdomToken.vestingBalanceOf(account.address)).equal(100);
      await neokingdomToken.mintVesting(account.address, 10);
      expect(await neokingdomToken.vestingBalanceOf(account.address)).equal(110);
    });

    it("should emit events on update the vesting balance", async () => {
      expect(await neokingdomToken.mintVesting(account.address, 100))
        .emit(neokingdomToken, "VestingSet")
        .withArgs(account.address, 100);
      expect(await neokingdomToken.mintVesting(account.address, 10))
        .emit(neokingdomToken, "VestingSet")
        .withArgs(account.address, 110);
    });

    it("should allow to transfer balance that is not vesting", async () => {
      await neokingdomToken.mint(account.address, 10);
      await neokingdomToken.mintVesting(account.address, 100);
      await expect(
        neokingdomToken.connect(account).transfer(nonContributor.address, 10)
      )
        .emit(neokingdomToken, "Transfer")
        .withArgs(account.address, nonContributor.address, 10);
      await expect(
        neokingdomToken.connect(account).transfer(nonContributor.address, 1)
      ).revertedWith("NeokingdomToken: transfer amount exceeds vesting");
    });

    it("should allow to decrease the vesting balance", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      await neokingdomToken.setVesting(account.address, 90);
      expect(await neokingdomToken.vestingBalanceOf(account.address)).equal(90);
    });

    it("should not allow to increase the vesting balance", async () => {
      await neokingdomToken.mintVesting(account.address, 100);
      await expect(
        neokingdomToken.setVesting(account.address, 110)
      ).revertedWith("NeokingdomToken: vesting can only be decreased");
    });
  });

  describe("offers", async () => {
    describe("create", async () => {
      it("should allow a contributor to create an offer", async () => {
        await neokingdomToken.mint(contributor.address, 100);
        const ts = (await getEVMTimestamp()) + 1;
        await setEVMTimestamp(ts);
        await expect(neokingdomToken.connect(contributor).createOffer(40))
          .emit(neokingdomToken, "OfferCreated")
          .withArgs(0, contributor.address, 40, ts + WEEK);
      });

      it("should allow a contributor with balance currently vesting to create an offer", async () => {
        await neokingdomToken.mintVesting(contributor.address, 100);
        await neokingdomToken.mint(contributor.address, 100);
        const ts = (await getEVMTimestamp()) + 1;
        await setEVMTimestamp(ts);
        await expect(neokingdomToken.connect(contributor).createOffer(50))
          .emit(neokingdomToken, "OfferCreated")
          .withArgs(0, contributor.address, 50, ts + WEEK);
      });
      it("should not allow a non contributor to create an offer", async () => {
        await neokingdomToken.mint(nonContributor.address, 100);
        await expect(
          neokingdomToken.connect(nonContributor).createOffer(40)
        ).revertedWith("NeokingdomToken: not a contributor");
      });

      it("should not allow a contributor to offer more tokens than what they have", async () => {
        await neokingdomToken.mint(contributor.address, 100);
        await expect(
          neokingdomToken.connect(contributor).createOffer(110)
        ).revertedWith("NeokingdomToken: offered amount exceeds balance");
      });

      it("should not allow a contributor to offer more tokens than what they have, including the ones currently vesting", async () => {
        await neokingdomToken.mintVesting(contributor.address, 100);
        await neokingdomToken.mint(contributor.address, 100);
        await expect(
          neokingdomToken.connect(contributor).createOffer(110)
        ).revertedWith("NeokingdomToken: offered amount exceeds balance");
      });
    });

    describe("match", async () => {
      let ts: number;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await neokingdomToken.mintVesting(contributor.address, 1000);
        await neokingdomToken.mint(contributor.address, 100);
        await neokingdomToken.connect(contributor).createOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await neokingdomToken.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await neokingdomToken.connect(contributor).createOffer(35);
      });

      it("should match the oldest active offer", async () => {
        await expect(
          neokingdomToken.matchOffer(
            contributor.address,
            contributor2.address,
            11
          )
        )
          .emit(neokingdomToken, "OfferMatched")
          .withArgs(0, contributor.address, contributor2.address, 11)
          .emit(neokingdomToken, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11);
      });

      it("should match the oldest active offer and ignore the expired ones", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          neokingdomToken.matchOffer(
            contributor.address,
            contributor2.address,
            25
          )
        )
          .emit(neokingdomToken, "OfferExpired")
          .withArgs(0, contributor.address, 11)
          .emit(neokingdomToken, "OfferMatched")
          .withArgs(1, contributor.address, contributor2.address, 25)
          .emit(neokingdomToken, "Transfer")
          .withArgs(contributor.address, contributor2.address, 25);
      });

      it("should match multiple active offers from the old one to the new one", async () => {
        await expect(
          neokingdomToken.matchOffer(
            contributor.address,
            contributor2.address,
            11 + 25 + 1
          )
        )
          .emit(neokingdomToken, "OfferMatched")
          .withArgs(0, contributor.address, contributor2.address, 11)
          .emit(neokingdomToken, "OfferMatched")
          .withArgs(1, contributor.address, contributor2.address, 25)
          .emit(neokingdomToken, "OfferMatched")
          .withArgs(2, contributor.address, contributor2.address, 1)
          .emit(neokingdomToken, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11 + 25 + 1);
      });

      it("should not allow to match more than what's available", async () => {
        await expect(
          neokingdomToken.matchOffer(
            contributor.address,
            contributor2.address,
            11 + 25 + 36
          )
        ).revertedWith("NeokingdomToken: amount exceeds offer");
      });

      it("should not allow to match more than what's available when old offers expire", async () => {
        // Make offer `11` and `15` expire
        await setEVMTimestamp(ts + WEEK + DAY * 3);
        await expect(
          neokingdomToken.matchOffer(
            contributor.address,
            contributor2.address,
            36
          )
        ).revertedWith("NeokingdomToken: amount exceeds offer");
      });
    });

    describe("transfer", async () => {
      let ts: number;
      const DAY = 60 * 60 * 24;
      const WEEK = DAY * 7;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await neokingdomToken.mintVesting(contributor.address, 1000);
        await neokingdomToken.mint(contributor.address, 100);
        await neokingdomToken.connect(contributor).createOffer(11);
        ts = await getEVMTimestamp();

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await neokingdomToken.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await neokingdomToken.connect(contributor).createOffer(35);
      });

      it("should allow to transfer balance from expired offers", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          neokingdomToken.connect(contributor).transfer(contributor2.address, 11)
        )
          .emit(neokingdomToken, "OfferExpired")
          .withArgs(0, contributor.address, 11)
          .emit(neokingdomToken, "Transfer")
          .withArgs(contributor.address, contributor2.address, 11);
      });

      it("should not allow to transfer balance if offer is still standing", async () => {
        // Make offer `11` expire
        await setEVMTimestamp(ts + WEEK + DAY);
        await expect(
          neokingdomToken.connect(contributor).transfer(contributor2.address, 12)
        ).revertedWith(
          "NeokingdomToken: transfer amount exceeds unlocked tokens"
        );
      });
    });

    describe("balances", async () => {
      let ts: number;
      const DAY = 60 * 60 * 24;
      const WEEK = DAY * 7;

      beforeEach(async () => {
        // At the end of this method we have:
        //
        // - An offer made on `ts`
        // - An offer made on `ts + 2 days`
        // - An offer made on `ts + 4 days`
        await neokingdomToken.mintVesting(contributor.address, 1000);
        await neokingdomToken.mint(contributor.address, 100);
        ts = await getEVMTimestamp();
        await neokingdomToken.connect(contributor).createOffer(11);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 2);
        await neokingdomToken.connect(contributor).createOffer(25);

        // Move to the next day and make another offer
        await setEVMTimestamp(ts + DAY * 4);
        await neokingdomToken.connect(contributor).createOffer(35);
      });

      describe("offeredBalanceOf", async () => {
        it("should be equal to the amount of tokens offered", async () => {
          await mineEVMBlock();
          expect(
            await neokingdomToken
              .connect(contributor)
              .offeredBalanceOf(contributor.address)
          ).equal(11 + 25 + 35);
        });

        it("should be equal to the amount of tokens offered minus the expired offers", async () => {
          // Make offer `11` expire
          await setEVMTimestamp(ts + WEEK + DAY);
          await mineEVMBlock();
          expect(
            await neokingdomToken
              .connect(contributor)
              .offeredBalanceOf(contributor.address)
          ).equal(25 + 35);
        });

        it("should be equal to 0 for non contributors", async () => {
          await neokingdomToken.mint(nonContributor.address, 100);
          const result = await neokingdomToken.offeredBalanceOf(
            nonContributor.address
          );

          expect(result).equal(0);
        });
      });

      describe("unlockedBalanceOf", async () => {
        it("should be equal to zero when contributor just started offering their tokens", async () => {
          await mineEVMBlock();
          expect(
            await neokingdomToken
              .connect(contributor)
              .unlockedBalanceOf(contributor.address)
          ).equal(0);
        });

        it("should be equal to the expired offers", async () => {
          // Make offer `11` and `25` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await mineEVMBlock();
          expect(
            await neokingdomToken
              .connect(contributor)
              .unlockedBalanceOf(contributor.address)
          ).equal(11 + 25);
        });

        it("should be equal to balance for non contributors", async () => {
          await neokingdomToken.mint(nonContributor.address, 100);
          const result = await neokingdomToken.unlockedBalanceOf(
            nonContributor.address
          );

          expect(result).equal(100);
        });
      });

      describe("lockedBalanceOf", async () => {
        it("should be equal to owned tokens", async () => {
          await mineEVMBlock();
          expect(
            await neokingdomToken
              .connect(contributor)
              .lockedBalanceOf(contributor.address)
          ).equal(1000 + 100);
        });

        it("should be equal to the owned tokend minus expired offers", async () => {
          // Make offer `11` and `25` expire
          await setEVMTimestamp(ts + WEEK + DAY * 3);
          await mineEVMBlock();
          expect(
            await neokingdomToken
              .connect(contributor)
              .lockedBalanceOf(contributor.address)
          ).equal(1000 + 100 - 11 - 25);
        });

        it("should be equal to 0 for non contributors", async () => {
          await neokingdomToken.mint(nonContributor.address, 100);
          const result = await neokingdomToken.lockedBalanceOf(
            nonContributor.address
          );

          expect(result).equal(0);
        });
      });
    });
  });
});
