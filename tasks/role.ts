import { task } from "hardhat/config";
import { ContractName, loadContractByName, ROLES } from "./config";

task(
  "grant-role",
  "Grant a role to an address. Can be called only by OPERATOR_ROLE"
)
  .addParam("contract", "The name of the contract")
  .addParam(
    "role",
    "The role, can be OPERATOR_ROLE, RESOLUTION_ROLE, ESCROW_ROLE, SHAREHOLDER_REGISTRY_ROLE"
  )
  .addParam("account", "The address")
  .setAction(
    async (
      {
        contract,
        role,
        account,
      }: { contract: ContractName; role: keyof typeof ROLES; account: string },
      hre
    ) => {
      const c = await loadContractByName(hre, contract);
      if (!ROLES[role]) {
        console.error(`Cannot find role ${role}`);
        process.exit(1);
      }
      const tx = await c.grantRole(ROLES[role], account);
      console.log("  Submitted tx", tx.hash);
      const receipt = await tx.wait();
      console.log("  Transaction included in block", receipt.blockNumber);
    }
  );
