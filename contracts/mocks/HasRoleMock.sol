// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "../extensions/HasRole.sol";

contract HasRoleMock is Initializable, HasRole {
    function initialize(DAORoles roles) public initializer {
        _setRoles(roles);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function checkOnlyRole(bytes32 role) public onlyRole(role) {}
}
