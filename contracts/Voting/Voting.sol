// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./VotingSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";

contract Voting is VotingSnapshot, Initializable, HasRole {
    function initialize(DAORoles roles) public initializer {
        _setRoles(roles);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function snapshot()
        public
        virtual
        override
        onlyRole(Roles.RESOLUTION_ROLE)
        returns (uint256)
    {
        return _snapshot();
    }

    function setToken(
        IERC20Upgradeable token
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        super._setToken(token);
    }

    function beforeRemoveContributor(
        address account
    ) external virtual onlyRole(Roles.SHAREHOLDER_REGISTRY_ROLE) {
        super._beforeRemoveContributor(account);
    }

    function afterAddContributor(
        address account
    ) external virtual onlyRole(Roles.SHAREHOLDER_REGISTRY_ROLE) {
        super._afterAddContributor(account);
    }

    function setShareholderRegistry(
        IShareholderRegistry shareholderRegistry
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        super._setShareholderRegistry(shareholderRegistry);
    }
}
