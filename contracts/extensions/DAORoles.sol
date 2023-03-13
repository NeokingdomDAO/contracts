// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract DAORoles is AccessControlUpgradeable {
    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}
}
