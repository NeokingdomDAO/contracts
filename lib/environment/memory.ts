import { Contract } from "ethers";
import { ethers, upgrades } from "hardhat";

import {
  DAORoles,
  DIAOracleV2Mock,
  GovernanceToken,
  InternalMarket,
  NeokingdomToken,
  ProxyAdmin,
  RedemptionController,
  ResolutionManager,
  ShareholderRegistry,
  TokenMock,
  Voting,
} from "../../typechain";
import { Config, NeokingdomDAO } from "../internal/core";
import { ContractNames, NeokingdomContracts } from "../internal/types";

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
    await contract.deployed();
    return contract.deployTransaction;
  }

  async deployProxy(contractName: ContractNames, args: any[] = []) {
    const Factory = await ethers.getContractFactory(contractName);
    const contract = await upgrades.deployProxy(Factory, args, {
      initializer: "initialize",
    });
    this.storeContract(contractName, contract);
    await contract.deployed();
    return contract.deployTransaction;
  }

  private storeContract(contractName: ContractNames, contract: Contract) {
    // FIXME: I cannot typescript, I guess this can be done much better.
    switch (contractName) {
      case "DAORoles":
        this.contracts.daoRoles = contract as DAORoles;
        break;
      case "InternalMarket":
        this.contracts.internalMarket = contract as InternalMarket;
        break;
      case "GovernanceToken":
        this.contracts.governanceToken = contract as GovernanceToken;
        break;
      case "NeokingdomToken":
        this.contracts.neokingdomToken = contract as NeokingdomToken;
        break;
      case "RedemptionController":
        this.contracts.redemptionController = contract as RedemptionController;
        break;
      case "ResolutionManager":
        this.contracts.resolutionManager = contract as ResolutionManager;
        break;
      case "ShareholderRegistry":
        this.contracts.shareholderRegistry = contract as ShareholderRegistry;
        break;
      case "TokenMock":
        this.contracts.tokenMock = contract as TokenMock;
        break;
      case "Voting":
        this.contracts.voting = contract as Voting;
        break;
      case "ProxyAdmin":
        this.contracts.proxyAdmin = contract as ProxyAdmin;
        break;
      case "DIAOracleV2Mock":
        this.contracts.diaOracleV2Mock = contract as DIAOracleV2Mock;
    }
  }
}
