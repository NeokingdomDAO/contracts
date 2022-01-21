// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ShareholderRegistrySnapshot.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ShareholderRegistry is ShareholderRegistrySnapshot, AccessControl {
    // Benjamin takes all the decisions in first months, assuming the role of
    // the "Resolution", to then delegate to the resolution contract what comes
    // next.
    // This is what zodiac calls "incremental decentralization".
    bytes32 public MANAGER_ROLE = keccak256("MANAGER_ROLE");

    constructor(string memory name, string memory symbol)
        ShareholderRegistrySnapshot(name, symbol)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function setStatus(bytes32 status, address account)
        public
        onlyRole(MANAGER_ROLE)
    {
        _setStatus(status, account);
    }

    function mint(address account, uint256 amount)
        public
        onlyRole(MANAGER_ROLE)
    {
        _mint(account, amount);
    }
}
