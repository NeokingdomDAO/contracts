import { readFileSync } from "fs";
import { task } from "hardhat/config";

import {
  DEPLOY_SEQUENCE,
  NeokingdomDAOHardhat,
  SETUP_SEQUENCE,
  STAGING_SETUP_SEQUENCE,
  generateDeployContext,
} from "../lib";
import { generateSetupContext } from "../lib/internal/types";
import {
  OWNERSHIP_SEQUENCE_ACL,
  PROXY_OWNERSHIP_SEQUENCE,
  SETUP_SEQUENCE_VIGODARZERE,
} from "../lib/sequence/temp";

task("deploy", "Deploy DAO")
  .addFlag("verify", "Verify contracts")
  .addFlag("restart", "Start a new deployment from scratch")
  .setAction(
    async ({ verify, restart }: { verify: boolean; restart: boolean }, hre) => {
      const neokingdom = await NeokingdomDAOHardhat.initialize(hre, {
        verifyContracts: verify,
        verbose: true,
      });
      await neokingdom.run(generateDeployContext, DEPLOY_SEQUENCE, { restart });
    }
  );

task("setup", "Set up the DAO")
  .addFlag("prod", "Go to prod")
  .setAction(async ({ prod }: { prod: boolean }, hre) => {
    let sequence = STAGING_SETUP_SEQUENCE;
    let contributorsFile = "./dev-wallets.json";
    if (prod) {
      sequence = SETUP_SEQUENCE;
      contributorsFile = "./prod-wallets.json";
    }
    const contributors = JSON.parse(readFileSync(contributorsFile, "utf-8"));

    const neokingdom = await NeokingdomDAOHardhat.initialize(hre, {
      verbose: true,
    });
    await neokingdom.run(generateSetupContext(contributors), sequence);
  });

task("setup-vigodarzere", "Set up the DAO").setAction(async (_, hre) => {
  let sequence = SETUP_SEQUENCE_VIGODARZERE;

  const neokingdom = await NeokingdomDAOHardhat.initialize(hre, {
    verbose: true,
  });
  await neokingdom.run(generateSetupContext([], hre), sequence);
});

task("setup-acl", "Set up the DAO").setAction(async (_, hre) => {
  let sequence = OWNERSHIP_SEQUENCE_ACL;

  const neokingdom = await NeokingdomDAOHardhat.initialize(hre, {
    verbose: true,
  });
  await neokingdom.run(generateSetupContext([], hre), sequence);
});

task("proxy-transfer", "Set up the DAO").setAction(async (_, hre) => {
  let sequence = PROXY_OWNERSHIP_SEQUENCE;

  const neokingdom = await NeokingdomDAOHardhat.initialize(hre, {
    verbose: true,
  });
  await neokingdom.run(generateSetupContext([], hre), sequence);
});
