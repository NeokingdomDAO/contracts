// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ShareholderRegistrySnapshot.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import { Roles } from "../extensions/Roles.sol";

contract ShareholderRegistry is ShareholderRegistrySnapshot, AccessControl {
    // Benjamin takes all the decisions in first months, assuming the role of
    // the "Resolution", to then delegate to the resolution contract what comes
    // next.
    // This is what zodiac calls "incremental decentralization".

    constructor(string memory name, string memory symbol)
        ShareholderRegistrySnapshot(name, symbol)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function snapshot()
        public
        override
        onlyRole(Roles.RESOLUTION_ROLE)
        returns (uint256)
    {
        return _snapshot();
    }

    function setStatus(bytes32 status, address account)
        public
        onlyRole(Roles.MANAGER_ROLE)
    {
        _setStatus(status, account);
    }

    function setVoting(IVoting voting) external onlyRole(Roles.MANAGER_ROLE) {
        _setVoting(voting);
    }

    function mint(address account, uint256 amount)
        public
        onlyRole(Roles.MANAGER_ROLE)
    {
        _mint(account, amount);
    }
}
