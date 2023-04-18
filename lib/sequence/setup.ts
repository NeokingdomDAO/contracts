import { parseEther } from "ethers/lib/utils";

import contributors from "../../dev-wallets.json";
import { expandable } from "../internal/core";
import {
  ContextGenerator,
  ContractContext,
  NeokingdomContracts,
  Sequence,
} from "../internal/types";

export type SetupContext = ContractContext & {
  contributors: typeof contributors.contributors;
};

export const generateSetupContext: ContextGenerator<SetupContext> =
  async function (n) {
    const contracts = (await n.loadContractsPartial()) as NeokingdomContracts;
    const context: SetupContext = {
      ...contracts,
      contributors: contributors.contributors,
    };
    return context;
  };

export const STAGING_SETUP_SEQUENCE: Sequence<SetupContext> = [
  // Give each address one share
  expandable((preprocessContext: SetupContext) =>
    preprocessContext.contributors.map(
      (contributor) => (c) =>
        c.shareholderRegistry.mint(contributor.address, parseEther("1"))
    )
  ),

  // Set each address to contributor
  expandable((preprocessContext: SetupContext) =>
    preprocessContext.contributors.map((contributor) => async (c) => {
      if (contributor.status === "contributor") {
        return c.shareholderRegistry.setStatus(
          await c.shareholderRegistry.CONTRIBUTOR_STATUS(),
          contributor.address
        );
      }
      if (contributor.status === "board") {
        return c.shareholderRegistry.setStatus(
          await c.shareholderRegistry.MANAGING_BOARD_STATUS(),
          contributor.address
        );
      }
      throw new Error("Unknown status for " + contributor);
    })
  ),

  // Give each contributor tokens
  expandable((preprocessContext: SetupContext) =>
    preprocessContext.contributors.map(
      (contributor) => (c) =>
        c.governanceToken.mint(
          contributor.address,
          parseEther(contributor.tokens.toString())
        )
    )
  ),

  // Add testing resolution type
  (c) =>
    c.resolutionManager.addResolutionType(
      "30sNotice3mVoting",
      66,
      30,
      60 * 3,
      false
    ),
];
