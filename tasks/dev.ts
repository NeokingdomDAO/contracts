import { task } from "hardhat/config";

import {
  DEPLOY_SEQUENCE,
  NeokingdomDAOHardhat,
  STAGING_SETUP_SEQUENCE,
  generateDeployContext,
  generateSetupContext,
} from "../lib";

task("dev:deploy", "Deploy DAO")
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

task("dev:setup", "Set up the DAO").setAction(async (_, hre) => {
  const neokingdom = await NeokingdomDAOHardhat.initialize(hre, {
    verbose: true,
  });
  await neokingdom.run(generateSetupContext, STAGING_SETUP_SEQUENCE);
});
