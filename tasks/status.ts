import { task } from "hardhat/config";
import { keccak256, parseEther, toUtf8Bytes } from "ethers/lib/utils";
import { loadContract } from "./config";
import {
  ShareholderRegistry__factory,
  TelediskoToken__factory,
} from "../typechain";
import { readFileSync } from "fs";

task("mint-share", "Mint a share to an address")
  .addPositionalParam("account", "The address")
  .addPositionalParam("amount", "Amount to mint")
  .setAction(
    async ({ account, amount }: { account: string; amount: string }, hre) => {
      const contract = await loadContract(
        hre,
        ShareholderRegistry__factory,
        "ShareholderRegistry"
      );

      const tx = await contract.mint(account, parseEther(amount));
      console.log("  Submitted tx", tx.hash);
      const receipt = await tx.wait();
      console.log("  Transaction included in block", receipt.blockNumber);
    }
  );

task(
  "transfer-shares-batch",
  "Transfer shares from DAO to multiple addresses address"
)
  .addPositionalParam("accountFile", "The addresses file")
  .setAction(async ({ accountFile }: { accountFile: string }, hre) => {
    const contract = await loadContract(
      hre,
      ShareholderRegistry__factory,
      "ShareholderRegistry"
    );

    const accounts = readFileSync(accountFile, "utf-8").split("\n");

    const tx = await contract.batchTransferFromDAO(accounts);
    console.log("  Submitted tx", tx.hash);
    const receipt = await tx.wait();
    console.log("  Transaction included in block", receipt.blockNumber);
  });

task("set", "Set the status of an address")
  .addParam("status", "shareholder, investor, contributor, managing_board")
  .addParam("account", "The account address")
  .setAction(
    async (
      {
        status,
        account,
      }: {
        status: "shareholder" | "investor" | "contributor" | "managing_board";
        account: string;
      },
      hre
    ) => {
      const contract = await loadContract(
        hre,
        ShareholderRegistry__factory,
        "ShareholderRegistry"
      );
      const role = `${status.toUpperCase()}_STATUS`;
      const tx = await contract.setStatus(
        keccak256(toUtf8Bytes(role)),
        account
      );
      console.log("  Submitted tx", tx.hash);
      const receipt = await tx.wait();
      console.log("  Transaction included in block", receipt.blockNumber);
    }
  );

task("mint", "Mint teledisko tokens to an address")
  .addParam("account", "The address")
  .addParam("amount", "How many tokens")
  .setAction(
    async ({ account, amount }: { account: string; amount: string }, hre) => {
      const contract = await loadContract(
        hre,
        TelediskoToken__factory,
        "TelediskoToken"
      );
      const tx = await contract.mint(account, parseEther(amount));
      console.log("  Submitted tx", tx.hash);
      const receipt = await tx.wait();
      console.log("  Transaction included in block", receipt.blockNumber);
    }
  );

task("mint-vesting", "Mint teledisko tokens to an address, vesting")
  .addParam("account", "The address")
  .addParam("amount", "How many tokens")
  .setAction(
    async ({ account, amount }: { account: string; amount: string }, hre) => {
      const contract = await loadContract(
        hre,
        TelediskoToken__factory,
        "TelediskoToken"
      );
      const tx = await contract.mintVesting(account, parseEther(amount));
      console.log("  Submitted tx", tx.hash);
      const receipt = await tx.wait();
      console.log("  Transaction included in block", receipt.blockNumber);
    }
  );
