import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { expandable } from "../internal/core";
import { Sequence, SetupContext } from "../internal/types";

export const SETUP_SEQUENCE: Sequence<SetupContext> = [
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
      if (contributor.status === "investor") {
        return c.shareholderRegistry.setStatus(
          await c.shareholderRegistry.INVESTOR_STATUS(),
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
          BigNumber.from(contributor.tokens.toString())
        )
    )
  ),
];

export const SETUP_SEQUENCE_TESTNET: Sequence<SetupContext> = [
  ...SETUP_SEQUENCE,
  // Add testing resolution type
  (c) =>
    c.resolutionManager.addResolutionType(
      "30sNotice3mVoting",
      66,
      30,
      60 * 3,
      false
    ),
  expandable((preprocessContext: SetupContext) =>
    preprocessContext.contributors.map(
      (contributor) => (c) =>
        c.tokenMock.mint(contributor.address, parseEther("10000"))
    )
  ),
];
