import { task } from "hardhat/config";

import { NeokingdomDAO } from "../lib/core";
import {
  DEPLOY_SEQUENCE,
  generateDeployContext,
} from "../lib/sequences/deploy";
import {
  STAGING_SETUP_SEQUENCE,
  generateSetupContext,
} from "../lib/sequences/setup";

task("dev:deploy", "Deploy DAO").setAction(async (_, hre) => {
  const neokingdom = await NeokingdomDAO.initialize(hre);
  await neokingdom.run(generateDeployContext, DEPLOY_SEQUENCE);
});

task("dev:setup", "Set up the DAO").setAction(async (_, hre) => {
  const neokingdom = await NeokingdomDAO.initialize(hre);
  await neokingdom.run(generateSetupContext, STAGING_SETUP_SEQUENCE, true);
});
