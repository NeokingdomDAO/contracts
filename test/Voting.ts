import { ethers } from "hardhat";
import { upgrades } from "hardhat";
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
import { roles } from "./utils/roles";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const AddressZero = ethers.constants.AddressZero;

describe("Voting", () => {
  let contributorStatus: string;
  let shareholderStatus: string;
  let investorStatus: string;

  let operatorRole: string;
  let resolutionRole: string;
  let shareholderRegistryRole: string;

  let voting: Voting;
  let token: ERC20Mock;
  let shareholderRegistry: ShareholderRegistryMock;
  let deployer: SignerWithAddress,
    delegator1: SignerWithAddress,
    delegator2: SignerWithAddress,
    delegated1: SignerWithAddress,
    delegated2: SignerWithAddress,
    noDelegate: SignerWithAddress,
    nonContributor: SignerWithAddress;

  beforeEach(async () => {
    [
      deployer,
      delegator1,
      delegator2,
      delegated1,
      delegated2,
      noDelegate,
      nonContributor,
    ] = await ethers.getSigners();
    const VotingFactory = (await ethers.getContractFactory(
      "Voting",
      deployer
    )) as Voting__factory;

    const ERC20MockFactory = (await ethers.getContractFactory(
      "ERC20Mock",
      deployer
    )) as ERC20Mock__factory;

    const ShareholderRegistryMockFactory = (await ethers.getContractFactory(
      "ShareholderRegistryMock",
      deployer
    )) as ShareholderRegistryMock__factory;

    voting = (await upgrades.deployProxy(VotingFactory, {
      initializer: "initialize",
    })) as Voting;
    await voting.deployed();
    token = (await upgrades.deployProxy(ERC20MockFactory, [voting.address], {
      initializer: "initialize",
    })) as ERC20Mock;
    await token.deployed();
    shareholderRegistry = (await upgrades.deployProxy(
      ShareholderRegistryMockFactory,
      {
        initializer: "initialize",
      }
    )) as ShareholderRegistryMock;
    await shareholderRegistry.deployed();

    operatorRole = await roles.OPERATOR_ROLE();
    resolutionRole = await roles.RESOLUTION_ROLE();
    shareholderRegistryRole = await roles.SHAREHOLDER_REGISTRY_ROLE();

    contributorStatus = await shareholderRegistry.CONTRIBUTOR_STATUS();
    shareholderStatus = await shareholderRegistry.SHAREHOLDER_STATUS();
    investorStatus = await shareholderRegistry.INVESTOR_STATUS();

    await voting.grantRole(operatorRole, deployer.address);
    await voting.grantRole(resolutionRole, deployer.address);
    await voting.grantRole(shareholderRegistryRole, deployer.address);

    await voting.setToken(token.address);
    await voting.setShareholderRegistry(shareholderRegistry.address);

    // Set contributors' status to:
    // - contributor
    // - shareholder
    // - investor
    // The mock is dumb so we need to set everything manually
    await Promise.all(
      [delegator1, delegator2, delegated1, delegated2, noDelegate].map(
        async (user) => await setContributor(user, true)
      )
    );

    // Each contributor delegates to themselves.
    await Promise.all(
      [delegator1, delegator2, delegated1, delegated2].map(async (voter) => {
        await voting.connect(voter).delegate(voter.address);
      })
    );
  });

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

  describe("access logic", async () => {
    it("should throw an error when anyone but the Token contract calls afterTokenTransfer", async () => {
      await expect(
        voting.afterTokenTransfer(noDelegate.address, noDelegate.address, 10)
      ).revertedWith("Voting: only Token contract can call this method.");
    });

    it("should throw an error when anyone but the MANAGER calls setToken", async () => {
      let errorMessage = `AccessControl: account ${noDelegate.address.toLowerCase()} is missing role ${operatorRole.toLowerCase()}`;
      await expect(
        voting.connect(noDelegate).setToken(token.address)
      ).revertedWith(errorMessage);

      await voting.grantRole(operatorRole, noDelegate.address);
      await voting.connect(noDelegate).setToken(shareholderRegistry.address);
    });

    it("should throw an error when anyone but the MANAGER calls setShareholderRegistry", async () => {
      let errorMessage = `AccessControl: account ${noDelegate.address.toLowerCase()} is missing role ${operatorRole.toLowerCase()}`;
      await expect(
        voting
          .connect(noDelegate)
          .setShareholderRegistry(shareholderRegistry.address)
      ).revertedWith(errorMessage);

      await voting.grantRole(operatorRole, noDelegate.address);
      await voting
        .connect(noDelegate)
        .setShareholderRegistry(shareholderRegistry.address);
    });

    it("should throw an error when anyone but the SHAREHOLDER REGISTRY calls beforeRemoveContributor", async () => {
      let errorMessage = `AccessControl: account ${noDelegate.address.toLowerCase()} is missing role ${shareholderRegistryRole.toLowerCase()}`;
      await expect(
        voting.connect(noDelegate).beforeRemoveContributor(delegator1.address)
      ).revertedWith(errorMessage);

      await voting.grantRole(shareholderRegistryRole, noDelegate.address);
      await voting
        .connect(noDelegate)
        .beforeRemoveContributor(delegator1.address);
    });

    it("should throw an error when anyone but the SHAREHOLDER REGISTRY calls beforeRemoveContributor", async () => {
      let errorMessage = `AccessControl: account ${noDelegate.address.toLowerCase()} is missing role ${shareholderRegistryRole.toLowerCase()}`;
      await expect(
        voting.connect(noDelegate).afterAddContributor(delegator1.address)
      ).revertedWith(errorMessage);

      await voting.grantRole(shareholderRegistryRole, noDelegate.address);
      await voting.connect(noDelegate).afterAddContributor(noDelegate.address);
    });

    it("should not fail if an address calling 'beforeRemoveContributor' on an address with delegate is not a contributor", async () => {
      await voting.grantRole(shareholderRegistryRole, nonContributor.address);
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting
        .connect(nonContributor)
        .beforeRemoveContributor(delegator1.address);
    });
  });

  describe("total voting power logic", async () => {
    it("should not increase voting power when minting tokens to a contributor without delegate", async () => {
      let votingPowerBefore = await voting.getTotalVotingPower();
      await token.mint(noDelegate.address, 10);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter).equal(votingPowerBefore);
    });

    it("should not increase voting power when minting tokens to a non contributor", async () => {
      let votingPowerBefore = await voting.getTotalVotingPower();
      await token.mint(nonContributor.address, 10);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter).equal(votingPowerBefore);
    });

    it("should not increase voting power when a non contributor transfers tokens to a contributor without delegate", async () => {
      await token.mint(nonContributor.address, 10);
      await token.mint(noDelegate.address, 10);
      let votingPowerBefore = await voting.getTotalVotingPower();
      await token.connect(nonContributor).transfer(noDelegate.address, 10);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter).equal(votingPowerBefore);
    });

    it("should not increase voting power when a contributor with delegate transfers tokens to another contributor with delegate", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegated1.address, 10);
      let votingPowerBefore = await voting.getTotalVotingPower();
      await token.connect(delegator1).transfer(delegated1.address, 10);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter).equal(votingPowerBefore);
    });

    it("should increase voting power when a contributor with tokens creates the first delegate", async () => {
      await token.mint(noDelegate.address, 10);
      let votingPowerBefore = await voting.getTotalVotingPower();
      await voting.connect(noDelegate).delegate(noDelegate.address);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter.toNumber()).equal(
        votingPowerBefore.toNumber() + 10
      );
    });

    it("should increase voting power when a non contributor transfers tokens to a contributor with delegate", async () => {
      await token.mint(nonContributor.address, 10);
      let votingPowerBefore = await voting.getTotalVotingPower();
      await token.connect(nonContributor).transfer(delegator1.address, 10);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter.toNumber()).equal(
        votingPowerBefore.toNumber() + 10
      );
    });

    it("should increase voting power when minting tokens to a contributor with delegate", async () => {
      let votingPowerBefore = await voting.getTotalVotingPower();
      await token.mint(delegator1.address, 10);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter.toNumber()).equal(
        votingPowerBefore.toNumber() + 10
      );
    });

    it("should decrease voting power when a contributor with delegate transfers tokens to a non contributor", async () => {
      await token.mint(delegator1.address, 10);
      let votingPowerBefore = await voting.getTotalVotingPower();
      await token.connect(delegator1).transfer(nonContributor.address, 10);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter.toNumber()).equal(
        votingPowerBefore.toNumber() - 10
      );
    });

    it("should decrease voting power when a contributor with delegate transfers token to a contributor without delegate", async () => {
      await token.mint(delegator1.address, 10);
      let votingPowerBefore = await voting.getTotalVotingPower();
      await token.connect(delegator1).transfer(noDelegate.address, 10);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter.toNumber()).equal(
        votingPowerBefore.toNumber() - 10
      );
    });

    it("should decrease voting power when a contributor is removed", async () => {
      await token.mint(delegator1.address, 10);
      let votingPowerBefore = await voting.getTotalVotingPower();

      await setContributor(delegator1, false);
      await voting.beforeRemoveContributor(delegator1.address);

      let votingPowerAfter = await voting.getTotalVotingPower();

      expect(votingPowerAfter.toNumber()).equal(
        votingPowerBefore.toNumber() - 10
      );
    });
  });

  describe("delegation logic", async () => {
    it("should return address 0x0 when no delegates exist", async () => {
      expect(await voting.getDelegate(noDelegate.address)).equals(
        "0x0000000000000000000000000000000000000000"
      );
    });

    it("should throw an error when first delegate is not the account itself", async () => {
      await expect(
        voting.connect(noDelegate).delegate(delegated1.address)
      ).revertedWith("Voting: first delegate should be self");
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
      ).revertedWith("Voting: new delegate equal to old delegate");
    });

    it("should throw an error when delegating an account that already has delegates (no sub-delegation allowed)", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);

      await expect(
        voting.connect(delegator2).delegate(delegator1.address)
      ).revertedWith("Voting: new delegate is not self delegated");
    });

    it("should throw an error when an already delegated account tries to delegate (no sub-delegation allowed)", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);

      await expect(
        voting.connect(delegated1).delegate(delegated2.address)
      ).revertedWith("Voting: delegator is already delegated");
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

    it("should throw an error when delegating a contributor that has not delegated itself first", async () => {
      await expect(
        voting.connect(delegator1).delegate(noDelegate.address)
      ).revertedWith("Voting: new delegate is not self delegated");
    });

    it("should throw an error when delegating address 0x0", async () => {
      await expect(
        voting.connect(delegator1).delegate(AddressZero)
      ).revertedWith("Voting: only contributors can be delegated.");
    });

    it("should return address 0x0 for a self-delegated account whose contributor status has been removed", async () => {
      await voting.beforeRemoveContributor(delegator1.address);

      expect(await voting.getDelegate(delegator1.address)).equal(AddressZero);
    });

    it("should allow an account to re-delegate itself after delegating another account", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting.connect(delegator1).delegate(delegator1.address);

      expect(await voting.getDelegate(delegator1.address)).equals(
        delegator1.address
      );
    });

    it("should emit an event", async () => {
      await expect(voting.connect(delegator1).delegate(delegated1.address))
        .emit(voting, "DelegateChanged")
        .withArgs(delegator1.address, delegator1.address, delegated1.address);
    });
  });

  describe("voting power transfer logic", async () => {
    it("should have as many votes as the balance of the account if not delegate exists", async () => {
      await token.mint(delegator1.address, 10);

      expect(await voting.getVotingPower(delegator1.address)).equals(10);
    });

    it("should increase voting power after minting new tokens", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegator1.address, 21);

      expect(await voting.getVotingPower(delegator1.address)).equals(31);
    });

    it("should transfer all votes to the delegatee upon delegation", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);

      expect(await voting.getVotingPower(delegated1.address)).equals(10);
    });

    it("should remove all votes from the delegatee upon token transfer", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);
      await token.connect(delegator1).transfer(delegated2.address, 10);

      expect(await voting.getVotingPower(delegated1.address)).equals(0);
    });

    it("should move as many votes as tokens transferred to the existing delegatee if delegator receives new tokens", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(noDelegate.address, 15);
      await voting.connect(delegator1).delegate(delegated1.address);
      await token.connect(noDelegate).transfer(delegator1.address, 15);

      expect(await voting.getVotingPower(delegated1.address)).equals(25);
    });

    it("should have 0 votes after delegating", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);

      expect(await voting.getVotingPower(delegator1.address)).equals(0);
    });

    it("should have as many votes as the balance after retransfering delegation to itself", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting.connect(delegator1).delegate(delegator1.address);

      expect(await voting.getVotingPower(delegator1.address)).equals(10);
    });

    it("should not increase voting power if a contributor sends tokens to a non contributor", async () => {
      await token.mint(delegator1.address, 10);
      await token.connect(delegator1).transfer(nonContributor.address, 10);

      expect(await voting.getVotingPower(nonContributor.address)).equals(0);
    });

    it("should increase voting power if a non contributor sends tokens to a contributor", async () => {
      await token.mint(nonContributor.address, 10);
      await token.connect(nonContributor).transfer(delegator1.address, 10);

      expect(await voting.getVotingPower(delegator1.address)).equals(10);
    });

    it("should not increase voting power if a non contributor is given tokens", async () => {
      await token.mint(nonContributor.address, 10);

      expect(await voting.getVotingPower(nonContributor.address)).equals(0);
    });

    it("should emit 2 events with old and new balances of source and destination addresses", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegator2.address, 11);

      await expect(token.connect(delegator1).transfer(delegator2.address, 9))
        .emit(voting, "DelegateVotesChanged")
        .withArgs(delegator1.address, 10, 1)
        .emit(voting, "DelegateVotesChanged")
        .withArgs(delegator2.address, 11, 20);
    });

    it("should decrease to 0 the voting power of an account when it's removed from contributors", async () => {
      await token.mint(delegator1.address, 10);
      await voting.beforeRemoveContributor(delegator1.address);

      await setContributor(delegator1, false);

      let votingPowerAfter = await voting.getVotingPower(delegator1.address);

      expect(votingPowerAfter.toNumber()).equal(0);
    });

    it("should decrease delegate's voting power when its delegator's contributor status is removed", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);
      let votingPowerBefore = await voting.getVotingPower(delegated1.address);
      await voting.beforeRemoveContributor(delegator1.address);

      await setContributor(delegator1, false);

      let votingPowerAfter = await voting.getVotingPower(delegated1.address);

      expect(votingPowerAfter.toNumber()).equal(
        votingPowerBefore.toNumber() - 10
      );
    });
  });

  describe("canVote", async () => {
    it("should allow voting to accounts that have a delegate", async () => {
      const result = await voting.canVote(delegator1.address);

      expect(result).equal(true);
    });

    it("not should allow voting to accounts that don't have a delegate", async () => {
      const result = await voting.canVote(noDelegate.address);

      expect(result).equal(false);
    });

    it("should not allow voting when contributor removed", async () => {
      await voting.beforeRemoveContributor(delegator1.address);

      const result = await voting.canVote(delegator1.address);

      expect(result).equal(false);
    });
  });

  describe("complex flows", async () => {
    it("when a non self-delegated contributor is removed of its status, its delegate can again delegate someone else", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);
      await expect(
        voting.connect(delegated1).delegate(delegated2.address)
      ).revertedWith("Voting: delegator is already delegated");
      expect(await voting.getDelegate(delegated1.address)).equals(
        delegated1.address
      );

      await voting.beforeRemoveContributor(delegator1.address);

      await setContributor(delegator1, false);

      await voting.connect(delegated1).delegate(delegated2.address);

      expect(await voting.getDelegate(delegated1.address)).equals(
        delegated2.address
      );
    });

    it("should allow an account to re-delegate itself after delegating a multi-delegated account", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting.connect(delegator2).delegate(delegated1.address);
      await voting.connect(delegator2).delegate(delegator2.address);

      expect(await voting.getDelegate(delegator2.address)).equals(
        delegator2.address
      );
    });

    it("when an account is delegated by 2 accounts and then one of these re-takes the delegation, the initially delegated account cannot yet delegate (as one more account is delegating it)", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting.connect(delegator2).delegate(delegated1.address);

      await expect(
        voting.connect(delegated1).delegate(delegated2.address)
      ).revertedWith("Voting: delegator is already delegated");
      expect(await voting.getDelegate(delegated1.address)).equals(
        delegated1.address
      );

      await voting.connect(delegator2).delegate(delegator2.address);

      await expect(
        voting.connect(delegated1).delegate(delegated2.address)
      ).revertedWith("Voting: delegator is already delegated");
      expect(await voting.getDelegate(delegated1.address)).equals(
        delegated1.address
      );
    });

    it("when an account is delegated by 2 accounts and then both re-take the delegation, the initially delegated account can delegate", async () => {
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting.connect(delegator2).delegate(delegated1.address);

      await expect(
        voting.connect(delegated1).delegate(delegated2.address)
      ).revertedWith("Voting: delegator is already delegated");
      expect(await voting.getDelegate(delegated1.address)).equals(
        delegated1.address
      );

      await voting.connect(delegator1).delegate(delegator1.address);
      await voting.connect(delegator2).delegate(delegator2.address);

      await voting.connect(delegated1).delegate(delegated2.address);
      expect(await voting.getDelegate(delegated1.address)).equals(
        delegated2.address
      );
    });

    it("when a delegated account loses its contributor state, its delegator should be able to redelegate itself and have back its voting power", async () => {
      await token.mint(delegator1.address, 10);
      await voting.connect(delegator1).delegate(delegated1.address);
      expect(await voting.getVotingPower(delegator1.address)).equal(0);

      await setContributor(delegated1, false);
      await voting.beforeRemoveContributor(delegated1.address);

      await voting.connect(delegator1).delegate(delegator1.address);
      expect(await voting.getDelegate(delegator1.address)).equal(
        delegator1.address
      );
      expect(await voting.getVotingPower(delegator1.address)).equal(10);
    });

    it("when a account with multiple delegators loses its contributor state, one of the delegators redelegates itself and then the original account regains its contributor status and redelegate itself, its voting power should include the one of the original delegator", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegator2.address, 5);
      await token.mint(delegated1.address, 8);
      await voting.connect(delegator1).delegate(delegated1.address);
      await voting.connect(delegator2).delegate(delegated1.address);

      await voting.beforeRemoveContributor(delegated1.address);

      await setContributor(delegated1, false);
      await voting.connect(delegator1).delegate(delegator1.address);

      await setContributor(delegated1, true);
      await voting.connect(delegated1).delegate(delegated1.address);

      expect(await voting.getVotingPower(delegated1.address)).equal(13);
    });

    it("when a account with a delegators loses its contributor state, transfers all its tokens to an another account, then becomes a contributor again, its voting power should equal the one of the original delegator", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegated1.address, 8);
      await voting.connect(delegator1).delegate(delegated1.address);

      await voting.beforeRemoveContributor(delegated1.address);

      await setContributor(delegated1, false);

      await token.connect(delegated1).transfer(nonContributor.address, 8);

      await setContributor(delegated1, true);
      await voting.connect(delegated1).delegate(delegated1.address);

      expect(await voting.getVotingPower(delegated1.address)).equal(10);
    });

    it("when a account with a delegator loses its contributor state, transfers all its tokens to the original delegator, then becomes a contributor again, its voting power should equal initial one", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegated1.address, 8);
      await voting.connect(delegator1).delegate(delegated1.address);

      await voting.beforeRemoveContributor(delegated1.address);

      await setContributor(delegated1, false);

      await token.connect(delegated1).transfer(delegator1.address, 8);
      expect(await voting.getVotingPower(delegator1.address)).equal(0);

      await setContributor(delegated1, true);
      await voting.connect(delegated1).delegate(delegated1.address);

      expect(await voting.getVotingPower(delegated1.address)).equal(18);
    });

    it("when A delegates B and then A loses its contributor status, after re-joining as a contributor, B should only have its balance as voting power", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegated1.address, 8);
      await voting.connect(delegator1).delegate(delegated1.address);
      expect(await voting.getVotingPower(delegator1.address)).equal(0);
      expect(await voting.getVotingPower(delegated1.address)).equal(18);

      await voting.beforeRemoveContributor(delegator1.address);

      await setContributor(delegator1, false);

      await setContributor(delegator1, true);
      await voting.connect(delegator1).delegate(delegator1.address);

      expect(await voting.getVotingPower(delegator1.address)).equal(10);
      expect(await voting.getVotingPower(delegated1.address)).equal(8);
    });

    it("when A delegates B and then B loses its contributor status, then the DAO mints new tokens to A, the total voting power should be the original one minus B plus the new tokens", async () => {
      await token.mint(delegator1.address, 10);
      await token.mint(delegated1.address, 8);
      await voting.connect(delegator1).delegate(delegated1.address);
      expect(await voting.getTotalVotingPower()).equal(18);

      await voting.beforeRemoveContributor(delegated1.address);

      await setContributor(delegated1, false);
      expect(await voting.getTotalVotingPower()).equal(10);

      await token.mint(delegator1.address, 2);
      expect(await voting.getTotalVotingPower()).equal(12);

      await setContributor(delegated1, true);
      await voting.connect(delegated1).delegate(delegated1.address);
      expect(await voting.getTotalVotingPower()).equal(20);
    });
  });
});
