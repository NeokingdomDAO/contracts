import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { task } from "hardhat/config";
import {
  Voting,
  ResolutionManager,
  ShareholderRegistry,
  TelediskoToken,
  ResolutionManager__factory,
  ShareholderRegistry__factory,
  TelediskoToken__factory,
  Voting__factory,
} from "../typechain";
import { exportAddress, ROLES } from "./config";

task("deploy", "Deploy DAO", async (_, hre) => {
  const [deployer] = await hre.ethers.getSigners();

  const resolutionManagerFactory = (await hre.ethers.getContractFactory(
    "ResolutionManager"
  )) as ResolutionManager__factory;
  const votingFactory = (await hre.ethers.getContractFactory(
    "Voting"
  )) as Voting__factory;
  const shareholderRegistryFactory = (await hre.ethers.getContractFactory(
    "ShareholderRegistry"
  )) as ShareholderRegistry__factory;
  const telediskoTokenFactory = (await hre.ethers.getContractFactory(
    "TelediskoToken"
  )) as TelediskoToken__factory;

  console.log("Deploy DAO");
  console.log("  Network:", hre.network.name);

  console.log("  Deploy Voting.sol");
  const votingContract = (await hre.upgrades.deployProxy(votingFactory, {
    initializer: "initialize",
  })) as Voting;
  await votingContract.deployed();
  console.log("    Address:", votingContract.address);

  console.log("  Deploy ShareholderRegistry.sol");
  const shareholderRegistryContract = (await hre.upgrades.deployProxy(
    shareholderRegistryFactory,
    ["Teledisko Share", "TS"],
    {
      initializer: "initialize",
    }
  )) as ShareholderRegistry;
  await shareholderRegistryContract.deployed();
  console.log("    Address:", shareholderRegistryContract.address);

  console.log("  Deploy TelediskoToken.sol");
  const telediskoTokenContract = (await hre.upgrades.deployProxy(
    telediskoTokenFactory,
    ["Teledisko Token", "TT"],
    { initializer: "initialize" }
  )) as TelediskoToken;
  await telediskoTokenContract.deployed();
  console.log("    Address:", telediskoTokenContract.address);

  console.log("  Deploy ResolutionManager.sol");
  const resolutionManagerContract = (await hre.upgrades.deployProxy(
    resolutionManagerFactory,
    [
      shareholderRegistryContract.address,
      telediskoTokenContract.address,
      votingContract.address,
    ],
    {
      initializer: "initialize",
    }
  )) as ResolutionManager;
  await resolutionManagerContract.deployed();
  console.log("    Address:", resolutionManagerContract.address);

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
