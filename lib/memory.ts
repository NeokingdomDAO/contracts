import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";

import {
  InternalMarket,
  NeokingdomToken,
  PriceOracle,
  RedemptionController,
  ResolutionManager,
  ShareholderRegistry,
  TokenMock,
  Voting,
} from "../typechain";

import { Config, NeokingdomDAO } from "./core";
import { ContractNames, NeokingdomContracts } from "./types";

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

  async loadContracts() {
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
    switch (contractName) {
      case "InternalMarket":
        this.contracts[contractName] = contract as InternalMarket;
        break;
      case "NeokingdomToken":
        this.contracts[contractName] = contract as NeokingdomToken;
        break;
      case "PriceOracle":
        this.contracts[contractName] = contract as PriceOracle;
        break;
      case "RedemptionController":
        this.contracts[contractName] = contract as RedemptionController;
        break;
      case "ResolutionManager":
        this.contracts[contractName] = contract as ResolutionManager;
        break;
      case "ShareholderRegistry":
        this.contracts[contractName] = contract as ShareholderRegistry;
        break;
      case "TokenMock":
        this.contracts[contractName] = contract as TokenMock;
        break;
      case "Voting":
        this.contracts[contractName] = contract as Voting;
    }
  }
}
