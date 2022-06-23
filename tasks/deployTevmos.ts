import { task } from "hardhat/config";
import {
  Voting,
  ResolutionManager,
  ShareholderRegistry,
  TelediskoToken,
} from "../typechain";
import { exportAddress, ROLES } from "./config";
import { deployProxy } from "./gasMonkeyPatch";

task("deploy", "Deploy DAO", async (_, hre) => {
  let [deployer] = await hre.ethers.getSigners();
  console.log(process.env.TEVMOS_PRIVATE_KEY);

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

  console.log("  Grant roles");
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
    ROLES.OPERATOR_ROLE,
    deployer.address
  );
  await shareholderRegistryContract.grantRole(
    ROLES.RESOLUTION_ROLE,
    resolutionManagerContract.address
  );

  console.log("    🏅 Grant roles for TelediskoToken");
  await telediskoTokenContract.grantRole(ROLES.OPERATOR_ROLE, deployer.address);
  await telediskoTokenContract.grantRole(
    ROLES.RESOLUTION_ROLE,
    deployer.address
  ); // Fix this, we need to explicitely grant the MANAGER acces to mint
  const txGranting = await telediskoTokenContract.grantRole(
    ROLES.RESOLUTION_ROLE,
    resolutionManagerContract.address
  );
  await txGranting.wait();

  console.log("  Connect contracts");
  console.log("    Voting 🤝 ShareholderRegistry");
  let tx = await votingContract.setShareholderRegistry(
    shareholderRegistryContract.address
  );
  await tx.wait(1);
  console.log("    Voting 🤝 TelediskoToken");
  tx = await votingContract.setToken(telediskoTokenContract.address);
  await tx.wait(1);

  console.log("    TelediskoToken 🤝 ShareholderRegistry");
  tx = await telediskoTokenContract.setShareholderRegistry(
    shareholderRegistryContract.address
  );
  await tx.wait(1);
  console.log("    TelediskoToken 🤝 Voting");
  tx = await telediskoTokenContract.setVoting(votingContract.address);
  await tx.wait(1);

  console.log("    ShareholderRegistry 🤝 Voting");
  tx = await shareholderRegistryContract.setVoting(votingContract.address);
  await tx.wait(1);

  await exportAddress(hre, resolutionManagerContract, "ResolutionManager");
  await exportAddress(hre, telediskoTokenContract, "TelediskoToken");
  await exportAddress(hre, shareholderRegistryContract, "ShareholderRegistry");
  await exportAddress(hre, votingContract, "Voting");
});
