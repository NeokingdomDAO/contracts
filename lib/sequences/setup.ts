import { parseEther } from "ethers/lib/utils";

import contributors from "../../dev-wallets.json";
import { expandable } from "../core";
import { ContextGenerator, ContractContext, Sequence } from "../types";
import { NeokingdomContracts } from "../utils";

export type SetupContext = ContractContext & {
  contributors: typeof contributors.contributors;
};

export const generateSetupContext: ContextGenerator<SetupContext> =
  async function (n) {
    const contracts = (await n.loadContracts()) as NeokingdomContracts;
    const context: SetupContext = {
      ...contracts,
      contributors: contributors.contributors,
    };
    return context;
  };

export const STAGING_SETUP_SEQUENCE: Sequence<SetupContext> = [
  // Give to each address one share
  expandable((c: SetupContext) =>
    c.contributors.map(
      (x) => (e: typeof c) => e.registry.mint(x.address, parseEther("1"))
    )
  ),

  // Set each address to contributor
  expandable((c: SetupContext) =>
    c.contributors.map((x) => async (e: typeof c) => {
      if (x.status === "contributor") {
        return e.registry.setStatus(
          await e.registry.CONTRIBUTOR_STATUS(),
          x.address
        );
      }
      if (x.status === "board") {
        return e.registry.setStatus(
          await e.registry.MANAGING_BOARD_STATUS(),
          x.address
        );
      }
      throw new Error("Unknown status for " + x);
    })
  ),

  // Give to each contributor tokens
  expandable((c: SetupContext) =>
    c.contributors.map(
      (x) => (e: typeof c) =>
        e.token.mint(x.address, parseEther(x.tokens.toString()))
    )
  ),
];
