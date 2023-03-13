import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";

import { Config, NeokingdomDAO } from "../internal/core";
import {
  ContractNames,
  NeokingdomContracts,
  castContract,
} from "../internal/types";

export class NeokingdomDAOMemory extends NeokingdomDAO {
  contracts: Partial<NeokingdomContracts>;
  nextStep = 0;

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

  async loadContractsPartial() {
    return this.contracts;
  }

  public async setNextStep(n: number) {
    this.nextStep = n;
  }

  public async getNextStep() {
    return this.nextStep;
  }

  async deploy(contractName: ContractNames, args: any[] = []) {
    const Factory = await ethers.getContractFactory(contractName);
    const contract = await Factory.deploy(...args);
    this.storeContract(contractName, contract);
    return await contract.deployed();
  }

  async deployProxy(contractName: ContractNames, args: any[] = []) {
    const Factory = await ethers.getContractFactory(contractName);
    const contract = await upgrades.deployProxy(Factory, args, {
      initializer: "initialize",
    });
    this.storeContract(contractName, contract);
    return await contract.deployed();
  }

  private storeContract(contractName: ContractNames, contract: Contract) {
    // FIXME: I cannot typescript, remove any
    this.contracts[contractName] = castContract(contractName, contract) as any;
  }
}
