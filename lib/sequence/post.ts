import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Wallet } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { Sequence, SetupContext } from "../internal/types";
import { ROLES } from "../utils";

const BEN = "0x0a0c93d0f0553ebf7b7bea31be6fc65e38cc9b6e";
const TELEDISKO = "0xff2B49DeD1655bb2bde369cc56437793B6baA8e8";

/*
- NEOK and NEOS:
    - https://ariregister.rik.ee/eng/company/16638166/Neokingdom-DAO-O%C3%9C?active_tab=register 
    - Ben 0x0a0c93d0f0553ebf7b7bea31be6fc65e38cc9b6e
        - mint 30000 Governance NEOK 
        - mint 7999 NEOS
    - TelediskoDAO 0xff2B49DeD1655bb2bde369cc56437793B6baA8e8
        - mint 100000 NEOK
        - mint 123700 Governance NEOK
        - set status to `investor`
        - mint 1 NEOS
    - NeokingdomDAO 0x4706eD7a10064801F260BBf94743f241FCEf815e (ShareholderRegistry)
        - mint 1987 NEOS 
*/

export const SETUP_SEQUENCE_VIGODARZERE: Sequence<SetupContext> = [
  (c) =>
    // mint 30000 NEOKGOV
    c.governanceToken.mint(BEN, parseEther("30000")),
  (c) =>
    // mint 7999 NEOKSHARE
    c.shareholderRegistry.mint(BEN, parseEther("7999")),
  // TelediskoDAO 0xff2B49DeD1655bb2bde369cc56437793B6baA8e8
  (c) =>
    // mint 1 NEOKSHARE
    c.shareholderRegistry.mint(TELEDISKO, parseEther("1")),
  (c) =>
    // set status to `investor`
    c.shareholderRegistry.setStatus(
      c.shareholderRegistry.INVESTOR_STATUS(),
      TELEDISKO
    ),
  (c) =>
    // mint 223700 NEOKGOV
    c.governanceToken.mint(TELEDISKO, parseEther("223700")),
  // NeokingdomDAO 0x4706eD7a10064801F260BBf94743f241FCEf815e (ShareholderRegistry)
  (c) =>
    // mint 1987 NEOKSHARE
    c.shareholderRegistry.mint(
      c.shareholderRegistry.address,
      parseEther("1987")
    ),
];

export function finalizeACL(multisig: string): Sequence<SetupContext> {
  return [
    (c) => c.daoRoles.grantRole(ROLES.DEFAULT_ADMIN_ROLE, multisig),
    (c) => c.daoRoles.grantRole(ROLES.OPERATOR_ROLE, multisig),
    (c) => c.daoRoles.grantRole(ROLES.RESOLUTION_ROLE, multisig),
    (c) => c.proxyAdmin.transferOwnership(multisig),
    (c) => c.daoRoles.revokeRole(ROLES.RESOLUTION_ROLE, c.deployer.address),
    (c) => c.daoRoles.revokeRole(ROLES.OPERATOR_ROLE, c.deployer.address),
    (c) => c.daoRoles.revokeRole(ROLES.DEFAULT_ADMIN_ROLE, c.deployer.address),
  ];
}
