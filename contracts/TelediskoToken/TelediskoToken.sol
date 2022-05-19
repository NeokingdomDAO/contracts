// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TelediskoTokenSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";

contract TelediskoToken is TelediskoTokenSnapshot, AccessControl {
    constructor(string memory name, string memory symbol)
        TelediskoTokenSnapshot(name, symbol)
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

    function setVoting(IVoting voting) external onlyRole(Roles.OPERATOR_ROLE) {
        _setVoting(voting);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _setShareholderRegistry(shareholderRegistry);
    }

    function mint(address to, uint256 amount)
        public
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _mint(to, amount);
    }

    function mintVesting(address to, uint256 amount)
        public
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _mintVesting(to, amount);
    }

    function matchOffer(
        address from,
        address to,
        uint256 amount
    ) public onlyRole(Roles.OPERATOR_ROLE) {
        _matchOffer(from, to, amount);
    }

    function setVesting(address to, uint256 amount)
        public
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _setVesting(to, amount);
    }
}
