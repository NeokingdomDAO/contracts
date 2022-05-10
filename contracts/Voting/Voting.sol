// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./VotingSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";

contract Voting is VotingSnapshot, AccessControl {
    bytes32 private _contributorRole;

    constructor() {
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

    function setToken(IERC20 token) external onlyRole(Roles.OPERATOR_ROLE) {
        super._setToken(token);
    }

    function beforeRemoveContributor(address account)
        external
        onlyRole(Roles.SHAREHOLDER_REGISTRY_ROLE)
    {
        super._beforeRemoveContributor(account);
    }

    function afterAddContributor(address account)
        external
        onlyRole(Roles.SHAREHOLDER_REGISTRY_ROLE)
    {
        super._afterAddContributor(account);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        onlyRole(Roles.OPERATOR_ROLE)
    {
        super._setShareholderRegistry(shareholderRegistry);
    }
}
