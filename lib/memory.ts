import { ContractFactory } from "ethers";
import { upgrades } from "hardhat";

import { Config, NeokingdomDAO } from "./core";
import { ContractNames, FACTORIES, NeokingdomContracts } from "./utils";

export class NeokingdomDAOMemory extends NeokingdomDAO {
  contracts: Partial<NeokingdomContracts>;

  constructor(config: Config) {
    super(config);
    this.contracts = {};
  }

  static async initialize(config: Partial<Config> = {}) {
    const newConfig = this._mergeWithDefaultConfig({
      ...config,
    });

    return new NeokingdomDAOMemory(newConfig);
  }

  async loadContracts() {
    return this.contracts;
  }

  /*
  async deploy(contractName: ContractNames, args: any[] = []) {
    const Factory = FACTORIES[contractName];
  }
  */

  async deployProxy(contractName: ContractNames, args: any[] = []) {
    const Factory = FACTORIES[contractName];
    const contract = await upgrades.deployProxy(Factory, args, {
      initializer: "initialize",
    });

    return await contract.deployed();
  }
}
