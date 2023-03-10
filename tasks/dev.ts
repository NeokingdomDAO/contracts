import { task } from "hardhat/config";

import { DEPLOY_SEQUENCE, NeokingdomDAO, generateDeployContext } from "./core";

task("dev:deploy", "Deploy DAO").setAction(async (_, hre) => {
  const neokingdom = await NeokingdomDAO.initialize(hre);
  await neokingdom.run(generateDeployContext, DEPLOY_SEQUENCE);
});
