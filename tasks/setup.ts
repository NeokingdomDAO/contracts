import { task } from "hardhat/config";
import {
  Voting__factory,
  ShareholderRegistry__factory,
  ResolutionManager__factory,
  NeokingdomToken__factory,
} from "../typechain";
import { loadContract, ROLES } from "./config";
import { getWallet } from "./utils";

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
    const neokingdomTokenContract = await loadContract(
      hre,
      NeokingdomToken__factory,
      "NeokingdomToken"
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

    console.log("  NeokingdomToken");
    console.log("    grant RESOLUTION_ROLE to ResolutionManager");
    await neokingdomTokenContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );

    console.log("    grant OPERATOR_ROLE to deployer");
    let tx = await neokingdomTokenContract.grantRole(
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
    console.log("  Voting set NeokingdomToken");
    await votingContract.setToken(neokingdomTokenContract.address);
    console.log("  NeokingdomToken set ShareholderRegistry");
    await neokingdomTokenContract.setShareholderRegistry(
      shareholderRegistryContract.address
    );
    console.log("  NeokingdomToken set Voting");
    await neokingdomTokenContract.setVoting(votingContract.address);
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

    console.log("  NeokingdomToken");
    console.log("    Grant DEFAULT_ADMIN_ROLE to admin");
    await neokingdomTokenContract.grantRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      adminAddress
    );
    console.log("    Grant OPERATOR_ROLE to admin");
    await neokingdomTokenContract.grantRole(ROLES.OPERATOR_ROLE, adminAddress);
    console.log("    Grant ESCROW_ROLE to admin");
    await neokingdomTokenContract.grantRole(ROLES.ESCROW_ROLE, adminAddress);
    console.log("    Grant RESOLUTION_ROLE to admin");
    await neokingdomTokenContract.grantRole(ROLES.RESOLUTION_ROLE, adminAddress);

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

      console.log("  NeokingdomToken");
      console.log("    Remove OPERATOR_ROLE to deployer");
      await neokingdomTokenContract.renounceRole(
        ROLES.OPERATOR_ROLE,
        deployer.address
      );
      console.log("    Remove DEFAULT_ADMIN_ROLE to deployer");
      tx = await neokingdomTokenContract.renounceRole(
        ROLES.DEFAULT_ADMIN_ROLE,
        deployer.address
      );
    }
    await tx.wait(1);

    console.log("\n\nWell done 🐯 enjoy your DAO!");
  });
