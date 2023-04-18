import { task } from "hardhat/config";

import {
  GovernanceToken__factory,
  ResolutionManager__factory,
  ShareholderRegistry__factory,
  Voting__factory,
} from "../typechain";

import { ROLES, loadContract } from "../lib/config";
import { getWallet } from "../lib/utils";

task("setup", "Setup DAO")
  .addParam("adminAddress", "Address of the admin")
  .setAction(async ({ adminAddress }: { adminAddress: string }, hre) => {
    const deployer = await getWallet(hre);
    const { chainId } = await hre.ethers.provider.getNetwork();

    console.log("Setup DAO");
    console.log("  Network:", hre.network.name);
    console.log("  ChainId:", chainId);
    console.log("  Deployer address:", deployer.address);
    console.log("  Admin address:", adminAddress);

    const shareholderRegistryContract = await loadContract(
      hre,
      ShareholderRegistry__factory,
      "ShareholderRegistry"
    );
    const votingContract = await loadContract(hre, Voting__factory, "Voting");
    const resolutionManagerContract = await loadContract(
      hre,
      ResolutionManager__factory,
      "ResolutionManager"
    );
    const governanceTokenContract = await loadContract(
      hre,
      GovernanceToken__factory,
      "GovernanceToken"
    );

    /**
     * Grant roles to contracts and deployer
     */
    console.log("\n\n🏅  Grant roles");

    console.log("  ResolutionManager");
    console.log("    Grant RESOLUTION_ROLE to ResolutionManager");
    await resolutionManagerContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );
    console.log("    Grant OPERATOR_ROLE to deployer");
    await resolutionManagerContract.grantRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );

    console.log("  Voting");
    console.log("    Grant RESOLUTION_ROLE to ResolutionManager");
    await votingContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );
    console.log("    Grant SHAREHOLDER_REGISTRY_ROLE to ShareholderRegistry");
    await votingContract.grantRole(
      ROLES.SHAREHOLDER_REGISTRY_ROLE,
      shareholderRegistryContract.address
    );
    console.log("    Grant OPERATOR_ROLE to deployer");
    await votingContract.grantRole(ROLES.OPERATOR_ROLE, deployer.address);

    console.log("  ShareholderRegistry");
    console.log("    Grant RESOLUTION_ROLE to ResolutionManager");
    await shareholderRegistryContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );
    console.log("    Grant OPERATOR_ROLE to deployer");
    await shareholderRegistryContract.grantRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );

    console.log("  GovernanceToken");
    console.log("    grant RESOLUTION_ROLE to ResolutionManager");
    await governanceTokenContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );

    console.log("    grant OPERATOR_ROLE to deployer");
    let tx = await governanceTokenContract.grantRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );

    // Wait for the roles to be in a block. This allows ethers to estimate gas
    // correctly.
    await tx.wait();

    /**
     * Connect contracts
     */
    console.log("\n\n🤝  Connect contracts");
    console.log("  Voting set ShareholderRegistry");
    await votingContract.setShareholderRegistry(
      shareholderRegistryContract.address
    );
    console.log("  Voting set GovernanceToken");
    await votingContract.setToken(governanceTokenContract.address);
    console.log("  GovernanceToken set ShareholderRegistry");
    await governanceTokenContract.setShareholderRegistry(
      shareholderRegistryContract.address
    );
    console.log("  GovernanceToken set Voting");
    await governanceTokenContract.setVoting(votingContract.address);
    console.log("  ShareholderRegistry set Voting");
    await shareholderRegistryContract.setVoting(votingContract.address);

    /**
     * Grant roles to admin
     */
    console.log("\n\n🏅  Grant roles");

    console.log("  ResolutionManager");
    console.log("    Grant DEFAULT_ADMIN_ROLE to admin");
    await resolutionManagerContract.grantRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      adminAddress
    );
    console.log("    Grant OPERATOR_ROLE to admin");
    await resolutionManagerContract.grantRole(
      ROLES.OPERATOR_ROLE,
      adminAddress
    );
    console.log("    Grant RESOLUTION_ROLE to admin");
    await resolutionManagerContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      adminAddress
    );

    console.log("  Voting");
    console.log("    Grant DEFAULT_ADMIN_ROLE to admin");
    await votingContract.grantRole(ROLES.DEFAULT_ADMIN_ROLE, adminAddress);
    console.log("    Grant OPERATOR_ROLE to admin");
    await votingContract.grantRole(ROLES.OPERATOR_ROLE, adminAddress);
    console.log("    Grant RESOLUTION_ROLE to admin");
    await votingContract.grantRole(ROLES.RESOLUTION_ROLE, adminAddress);

    console.log("  ShareholderRegistry");
    console.log("    Grant DEFAULT_ADMIN_ROLE to admin");
    await shareholderRegistryContract.grantRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      adminAddress
    );
    console.log("    Grant RESOLUTION_ROLE to admin");
    await shareholderRegistryContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      adminAddress
    );

    console.log("  GovernanceToken");
    console.log("    Grant DEFAULT_ADMIN_ROLE to admin");
    await governanceTokenContract.grantRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      adminAddress
    );
    console.log("    Grant OPERATOR_ROLE to admin");
    await governanceTokenContract.grantRole(ROLES.OPERATOR_ROLE, adminAddress);
    console.log("    Grant ESCROW_ROLE to admin");
    await governanceTokenContract.grantRole(ROLES.ESCROW_ROLE, adminAddress);
    console.log("    Grant RESOLUTION_ROLE to admin");
    await governanceTokenContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      adminAddress
    );

    /**
     * Remove roles to deployer
     */
    if (deployer.address.toLowerCase() != adminAddress.toLowerCase()) {
      console.log("\n\n💀  Remove roles");
      console.log("  ResolutionManager");
      console.log("    Remove OPERATOR_ROLE to deployer");
      await resolutionManagerContract.renounceRole(
        ROLES.OPERATOR_ROLE,
        deployer.address
      );
      console.log("    Remove DEFAULT_ADMIN_ROLE to deployer");
      await resolutionManagerContract.renounceRole(
        ROLES.DEFAULT_ADMIN_ROLE,
        deployer.address
      );

      console.log("  Voting");
      console.log("    Remove OPERATOR_ROLE to deployer");
      await votingContract.renounceRole(ROLES.OPERATOR_ROLE, deployer.address);
      console.log("    Remove DEFAULT_ADMIN_ROLE to deployer");
      await votingContract.renounceRole(
        ROLES.DEFAULT_ADMIN_ROLE,
        deployer.address
      );

      console.log("    Remove OPERATOR_ROLE to deployer");
      await shareholderRegistryContract.renounceRole(
        ROLES.OPERATOR_ROLE,
        deployer.address
      );
      console.log("    Remove DEFAULT_ADMIN_ROLE to deployer");
      await shareholderRegistryContract.renounceRole(
        ROLES.DEFAULT_ADMIN_ROLE,
        deployer.address
      );

      console.log("  GovernanceToken");
      console.log("    Remove OPERATOR_ROLE to deployer");
      await governanceTokenContract.renounceRole(
        ROLES.OPERATOR_ROLE,
        deployer.address
      );
      console.log("    Remove DEFAULT_ADMIN_ROLE to deployer");
      tx = await governanceTokenContract.renounceRole(
        ROLES.DEFAULT_ADMIN_ROLE,
        deployer.address
      );
    }
    await tx.wait(1);

    console.log("\n\nWell done 🐯 enjoy your DAO!");
  });
