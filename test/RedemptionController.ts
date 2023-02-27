import { ethers, upgrades, network } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { solidity } from "ethereum-waffle";
import {
  RedemptionController,
  RedemptionController__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { mineEVMBlock, timeTravel } from "./utils/evm";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

describe("RedemptionController", () => {
  let snapshotId: string;

  let redemptionController: RedemptionController;
  let deployer: SignerWithAddress, account: SignerWithAddress;
  let redemptionWindow: number;

  let TOKEN_MANAGER_ROLE: string;

  before(async () => {
    [deployer, account] = await ethers.getSigners();

    const RedemptionControllerFactory = (await ethers.getContractFactory(
      "RedemptionController",
      deployer
    )) as RedemptionController__factory;

    redemptionController = (await upgrades.deployProxy(
      RedemptionControllerFactory
    )) as RedemptionController;
    await redemptionController.deployed();
    await redemptionController.grantRole(
      await redemptionController.TOKEN_MANAGER_ROLE(),
      deployer.address
    );

    redemptionWindow =
      (await redemptionController.redemptionWindow()).toNumber() /
      (60 * 60 * 24);

    TOKEN_MANAGER_ROLE = await redemptionController.TOKEN_MANAGER_ROLE();
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  async function expectBalance(amount: number) {
    const result = await redemptionController.redeemableBalance(
      account.address
    );

    expect(result).equal(amount);
  }

  describe("afterMint", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        redemptionController.connect(account).afterMint(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${TOKEN_MANAGER_ROLE}`
      );
    });
  });

  describe("afterOffer", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        redemptionController.connect(account).afterOffer(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${TOKEN_MANAGER_ROLE}`
      );
    });
  });

  describe("afterRedeem", async () => {
    it("should fail if not called by a TOKEN_MANAGER", async () => {
      await expect(
        redemptionController.connect(account).afterRedeem(account.address, 32)
      ).revertedWith(
        `AccessControl: account ${account.address.toLowerCase()} is missing role ${TOKEN_MANAGER_ROLE}`
      );
    });

    it("should fail if called with more tokens than redeemable", async () => {
      await expect(
        redemptionController.afterRedeem(account.address, 1)
      ).revertedWith(
        "Redemption controller: amount exceeds redeemable balance"
      );
    });
  });

  describe("redeemableBalance", async () => {
    it("returns 0 if no tokens have been minted to the user", async () => {
      await expectBalance(0);
    });

    it("returns 0 if the user did not offer any token", async () => {
      await redemptionController.afterMint(account.address, 10);

      await expectBalance(0);
    });

    describe("when 10 tokens are offered", async () => {
      beforeEach(async () => {
        await redemptionController.afterOffer(account.address, 10);
      });

      it("returns 0 after less than 60 days", async () => {
        await timeTravel(59);
        await mineEVMBlock();

        await expectBalance(0);
      });

      it("returns 0 after 60 days", async () => {
        await timeTravel(60);
        await mineEVMBlock();

        await expectBalance(0);
      });
    });

    describe("when 10 tokens are minted", async () => {
      beforeEach(async () => {
        await redemptionController.afterMint(account.address, 10);
      });

      describe("and no more tokens are minted", async () => {
        describe("and 7 tokens are offered", async () => {
          beforeEach(async () => {
            await redemptionController.afterOffer(account.address, 7);
          });

          it("returns 0 after less than 60 days", async () => {
            await timeTravel(59);
            await mineEVMBlock();

            await expectBalance(0);
          });

          describe("and 60 days pass", async () => {
            beforeEach(async () => {
              await timeTravel(60);
              await mineEVMBlock();
            });

            it("returns 7 if not redeemed", async () => {
              await expectBalance(7);
            });

            it("returns 0 if all 7 are redeemed", async () => {
              await redemptionController.afterRedeem(account.address, 7);

              await expectBalance(0);
            });

            it("returns 2 if 5 are redeemed", async () => {
              await redemptionController.afterRedeem(account.address, 5);

              await expectBalance(2);
            });

            it("returns 0 after the redemption period passed", async () => {
              await timeTravel(redemptionWindow);
              await mineEVMBlock();

              await expectBalance(0);
            });
          });

          describe("and 71 days pass", async () => {
            beforeEach(async () => {
              await timeTravel(71);
              await mineEVMBlock();
            });

            describe("and 5 tokens are offered again and 60 days pass", async () => {
              beforeEach(async () => {
                await redemptionController.afterOffer(account.address, 5);

                await timeTravel(60);
                await mineEVMBlock();
              });

              it("returns 5", async () => {
                await expectBalance(5);
              });

              describe("and 2 tokens are offered again", async () => {
                beforeEach(async () => {
                  await redemptionController.afterOffer(account.address, 2);
                });

                it("returns 2 60 days after redemption", async () => {
                  await redemptionController.afterRedeem(account.address, 5);
                  await timeTravel(60);
                  await mineEVMBlock();

                  await expectBalance(2);
                });
              });

              describe("and 5 tokens are offered again", async () => {
                beforeEach(async () => {
                  await redemptionController.afterOffer(account.address, 2);
                });

                it("returns 2 60 days later", async () => {
                  await timeTravel(60);
                  await mineEVMBlock();

                  await expectBalance(2);
                });
              });
            });
          });

          describe("and 2 more tokens are offered 5 days later", async () => {
            beforeEach(async () => {
              await timeTravel(5);
              await mineEVMBlock();
              await redemptionController.afterOffer(account.address, 2);
            });

            it("returns 7 55 days later", async () => {
              await timeTravel(55);
              await mineEVMBlock();

              await expectBalance(7);
            });

            it("returns 9 60 days later", async () => {
              await timeTravel(60);
              await mineEVMBlock();

              await expectBalance(9);
            });

            it("returns 2 66 days later", async () => {
              await timeTravel(66);
              await mineEVMBlock();

              await expectBalance(2);
            });

            it("returns 0 71 days later", async () => {
              await timeTravel(71);
              await mineEVMBlock();

              await expectBalance(0);
            });
          });
        });
      });

      describe("and 3 more tokens are minted 3 months later", async () => {
        beforeEach(async () => {
          await timeTravel(30 * 3 - 1);
          await mineEVMBlock();
          await redemptionController.afterMint(account.address, 3);
        });

        describe("and 11 tokens are offered and 60 days pass", async () => {
          beforeEach(async () => {
            await redemptionController.afterOffer(account.address, 11);
            await timeTravel(60);
            await mineEVMBlock();
          });

          it("returns 11 if not redeemed", async () => {
            await expectBalance(11);
          });

          it("returns 0 if all tokens (11) are redeemed", async () => {
            await redemptionController.afterRedeem(account.address, 11);

            await expectBalance(0);
          });

          it("returns 6 if 5 (out of 11) is redeemed", async () => {
            await redemptionController.afterRedeem(account.address, 5);

            await expectBalance(6);
          });

          it("returns 0 after the redemption period passed", async () => {
            await timeTravel(redemptionWindow);
            await mineEVMBlock();

            await expectBalance(0);
          });
        });
      });

      describe("and 3 more tokens are minted 4 months later", async () => {
        beforeEach(async () => {
          await timeTravel(30 * 4);
          await mineEVMBlock();
          await redemptionController.afterMint(account.address, 3);
        });

        describe("and 7 tokens are offered and 60 days pass", async () => {
          beforeEach(async () => {
            await redemptionController.afterOffer(account.address, 7);
            await timeTravel(60);
            await mineEVMBlock();
          });

          it("returns 3 if not redeemed", async () => {
            await expectBalance(3);
          });

          it("returns 0 if all tokens (3) are redeemed", async () => {
            await redemptionController.afterRedeem(account.address, 3);

            await expectBalance(0);
          });

          it("returns 2 if 1 (out of 3) is redeemed", async () => {
            await redemptionController.afterRedeem(account.address, 1);

            await expectBalance(2);
          });

          it("returns 0 after the redemption period passed", async () => {
            await timeTravel(redemptionWindow);
            await mineEVMBlock();

            await expectBalance(0);
          });
        });
      });

      describe("and 15 months pass", async () => {
        beforeEach(async () => {
          await timeTravel(15 * 30);
          await mineEVMBlock();
        });

        describe("and 7 tokens are offered", async () => {
          beforeEach(async () => {
            await redemptionController.afterOffer(account.address, 7);
          });

          it("returns 0 after less than 60 days", async () => {
            await timeTravel(59);
            await mineEVMBlock();

            await expectBalance(0);
          });

          it("returns 0 after 60 days", async () => {
            await timeTravel(60);
            await mineEVMBlock();

            await expectBalance(0);
          });
        });
      });
    });
  });

  describe("complex scenarios", async () => {
    it("complex token movement #1", async () => {
      // Mint 500
      await redemptionController.afterMint(account.address, 500);
      // Offer 500
      await redemptionController.afterOffer(account.address, 400);
      // After 60 days, redeems 300
      await timeTravel(60);
      await mineEVMBlock();
      await redemptionController.afterRedeem(account.address, 300);

      // Redeemable 300
      await expectBalance(100);

      // Offer 300
      await redemptionController.afterOffer(account.address, 500);

      // After 5 days, redeemable only 300
      await timeTravel(5);
      await mineEVMBlock();
      await expectBalance(100);

      // After 5 days, redeemable 0
      await timeTravel(5);
      await mineEVMBlock();
      await expectBalance(0);

      // After 50 days, redeem 200
      await timeTravel(50);
      await mineEVMBlock();
      await expectBalance(100);
    });

    it("complex token movement #2", async () => {
      // Mint 500
      await redemptionController.afterMint(account.address, 500);

      // Offer 500
      await redemptionController.afterOffer(account.address, 500);

      // 60 days pass
      await timeTravel(60);
      await mineEVMBlock();

      // Redeem 200
      await redemptionController.afterRedeem(account.address, 200);

      // 10 days pass
      await timeTravel(10);
      await mineEVMBlock();

      // Redeemable 0
      await expectBalance(0);

      // Offer 300
      await redemptionController.afterOffer(account.address, 300);

      // 60 days pass
      await timeTravel(60);
      await mineEVMBlock();

      // Redeemable 300
      await expectBalance(300);

      // 60 days pass
      await timeTravel(60);
      await mineEVMBlock();

      // Mint 500
      await redemptionController.afterMint(account.address, 500);

      // Offer 800
      await redemptionController.afterOffer(account.address, 800);

      // 60 days pass
      await timeTravel(60);
      await mineEVMBlock();

      await expectBalance(500);
    });

    it("complex token movement #3", async () => {
      // Mint 100
      await redemptionController.afterMint(account.address, 100);
      // 1 month
      await timeTravel(30);

      // Mint 100
      await redemptionController.afterMint(account.address, 100);
      // 1 month
      await timeTravel(30);

      // Mint 100
      await redemptionController.afterMint(account.address, 100);
      // 1 month
      await timeTravel(30);

      // Offer 300
      await redemptionController.afterOffer(account.address, 300);
      // Mint 100
      await redemptionController.afterMint(account.address, 100);

      // 1 month
      await timeTravel(30);

      // Offer 100
      await redemptionController.afterOffer(account.address, 100);

      // 1 month
      await timeTravel(30);
      await mineEVMBlock();

      // Redeemable 300
      await expectBalance(300);

      // 1 month
      await timeTravel(30);

      // Offer 300
      await redemptionController.afterOffer(account.address, 300);

      // Redeemable 100
      await expectBalance(100);

      // Redeem 100
      await redemptionController.afterRedeem(account.address, 100);

      // 60 days pass
      await timeTravel(60);
      await mineEVMBlock();

      // Redeemable 200
      await expectBalance(200);
    });

    it("complex token movement #4", async () => {
      // Mint 100
      await redemptionController.afterMint(account.address, 100);
      // 1 month
      await timeTravel(30);

      // Mint 100
      await redemptionController.afterMint(account.address, 100);
      // 1 month
      await timeTravel(30);

      // Mint 100
      await redemptionController.afterMint(account.address, 100);
      // 1 month
      await timeTravel(30);

      // Offer 300
      await redemptionController.afterOffer(account.address, 300);
      // Mint 100
      await redemptionController.afterMint(account.address, 100);

      // 1 month
      await timeTravel(30);

      // Offer 100
      await redemptionController.afterOffer(account.address, 100);

      // 1 month
      await timeTravel(30);
      await mineEVMBlock();

      // Redeemable 300
      await expectBalance(300);

      // 1 month
      await timeTravel(30);
      await mineEVMBlock();

      // Redeemable 100
      await expectBalance(100);

      // 60 days pass
      await timeTravel(redemptionWindow);
      await mineEVMBlock();

      // Offer 300
      await redemptionController.afterOffer(account.address, 300);

      // 60 days pass
      await timeTravel(60);
      await mineEVMBlock();

      // Redeemable 200
      await expectBalance(300);
    });
  });
});
