import { task } from "hardhat/config";

import { NeokingdomDAO } from "./core";

task("dev:deploy", "Deploy DAO").setAction(async (_, hre) => {
  const neokingdom = await NeokingdomDAO.initialize(hre);
  await neokingdom.deploy();
});
