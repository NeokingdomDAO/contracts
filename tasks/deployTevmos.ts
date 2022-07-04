import { task } from "hardhat/config";
import {
  Voting,
  ResolutionManager,
  ShareholderRegistry,
  TelediskoToken,
} from "../typechain";
import { exportAddress, ROLES } from "./config";
import { deployProxy } from "./gasMonkeyPatch";

task("deploy", "Deploy DAO")
  .addParam("adminAddress", "Address of the admin")
  .setAction(async ({ adminAddress }: { adminAddress: string }, hre) => {
    let [deployer] = await hre.ethers.getSigners();

    //const fee = await deployer.provider!.getFeeData();
    //console.log("Gas fee", formatUnits(fee.maxFeePerGas!, "gwei"));

    console.log("Deploy DAO");
    console.log("  Network:", hre.network.name);

    const votingContract = (await deployProxy(hre, "Voting")) as Voting;

    const shareholderRegistryContract = (await deployProxy(
      hre,
      "ShareholderRegistry",
      ["Teledisko Share", "TS"]
    )) as ShareholderRegistry;

    const telediskoTokenContract = (await deployProxy(hre, "TelediskoToken", [
      "Teledisko Token",
      "TT",
    ])) as TelediskoToken;

    const resolutionManagerContract = (await deployProxy(
      hre,
      "ResolutionManager",
      [
        shareholderRegistryContract.address,
        telediskoTokenContract.address,
        votingContract.address,
      ]
    )) as ResolutionManager;

    await exportAddress(hre, resolutionManagerContract, "ResolutionManager");
    await exportAddress(hre, telediskoTokenContract, "TelediskoToken");
    await exportAddress(
      hre,
      shareholderRegistryContract,
      "ShareholderRegistry"
    );
    await exportAddress(hre, votingContract, "Voting");

    console.log("  Grant roles");

    console.log("    🏅 Grant roles for ResolutionManager");
    await resolutionManagerContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );
    await resolutionManagerContract.grantRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );

    console.log("    🏅 Grant roles for Voting");
    await votingContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );
    await votingContract.grantRole(
      ROLES.SHAREHOLDER_REGISTRY_ROLE,
      shareholderRegistryContract.address
    );
    await votingContract.grantRole(ROLES.OPERATOR_ROLE, deployer.address);

    console.log("    🏅 Grant roles for ShareholderRegistry");
    await shareholderRegistryContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );
    await shareholderRegistryContract.grantRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );

    console.log("    🏅 Grant roles for TelediskoToken");
    await telediskoTokenContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      resolutionManagerContract.address
    );
    await telediskoTokenContract.grantRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );

    console.log("  Connect contracts");
    console.log("    Voting 🤝 ShareholderRegistry");
    await votingContract.setShareholderRegistry(
      shareholderRegistryContract.address
    );
    console.log("    Voting 🤝 TelediskoToken");
    await votingContract.setToken(telediskoTokenContract.address);

    console.log("    TelediskoToken 🤝 ShareholderRegistry");
    await telediskoTokenContract.setShareholderRegistry(
      shareholderRegistryContract.address
    );
    console.log("    TelediskoToken 🤝 Voting");
    await telediskoTokenContract.setVoting(votingContract.address);

    console.log("    ShareholderRegistry 🤝 Voting");
    await shareholderRegistryContract.setVoting(votingContract.address);

    console.log("  Grant admin roles");
    await resolutionManagerContract.grantRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      adminAddress
    );
    await resolutionManagerContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      adminAddress
    );
    await resolutionManagerContract.grantRole(
      ROLES.OPERATOR_ROLE,
      adminAddress
    );
    await resolutionManagerContract.renounceRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );
    await resolutionManagerContract.renounceRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      deployer.address
    );

    await votingContract.grantRole(ROLES.DEFAULT_ADMIN_ROLE, adminAddress);
    await votingContract.grantRole(ROLES.RESOLUTION_ROLE, adminAddress);
    await votingContract.grantRole(ROLES.OPERATOR_ROLE, adminAddress);
    await votingContract.renounceRole(ROLES.OPERATOR_ROLE, deployer.address);
    await votingContract.renounceRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      deployer.address
    );

    await shareholderRegistryContract.grantRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      adminAddress
    );
    await shareholderRegistryContract.grantRole(
      ROLES.RESOLUTION_ROLE,
      adminAddress
    );
    await shareholderRegistryContract.grantRole(
      ROLES.OPERATOR_ROLE,
      adminAddress
    );
    await shareholderRegistryContract.renounceRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );
    await shareholderRegistryContract.renounceRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      deployer.address
    );

    await telediskoTokenContract.grantRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      adminAddress
    );
    await telediskoTokenContract.grantRole(ROLES.OPERATOR_ROLE, adminAddress);
    await telediskoTokenContract.grantRole(ROLES.ESCROW_ROLE, adminAddress);
    await telediskoTokenContract.grantRole(ROLES.RESOLUTION_ROLE, adminAddress);
    await telediskoTokenContract.renounceRole(
      ROLES.OPERATOR_ROLE,
      deployer.address
    );
    const finalTx = await telediskoTokenContract.renounceRole(
      ROLES.DEFAULT_ADMIN_ROLE,
      deployer.address
    );
    await finalTx.wait(1);
  });
