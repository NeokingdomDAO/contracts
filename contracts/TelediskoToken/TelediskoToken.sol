// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TelediskoTokenSnapshot.sol";

contract TelediskoToken is TelediskoTokenSnapshot, AccessControl {
    bytes32 public MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public RESOLUTION_ROLE = keccak256("RESOLUTION_ROLE");

    constructor(string memory name, string memory symbol)
        TelediskoTokenSnapshot(name, symbol)
    {}

    function setVoting(IVoting voting)
        external
        override
        onlyRole(MANAGER_ROLE)
    {
        _setVoting(voting);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        override
        onlyRole(MANAGER_ROLE)
    {
        _setShareholderRegistry(shareholderRegistry);
    }

    function mint(address to, uint256 amount) public override onlyRole(RESOLUTION_ROLE) {
        _mint(to, amount);
    }
}
