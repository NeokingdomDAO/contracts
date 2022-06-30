// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./VotingSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";

contract Voting is VotingSnapshot, AccessControl, Initializable {
    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
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

    function setToken(IERC20Upgradeable token)
        external
        virtual
        onlyRole(Roles.OPERATOR_ROLE)
    {
        super._setToken(token);
    }

    function beforeRemoveContributor(address account)
        external
        virtual
        onlyRole(Roles.SHAREHOLDER_REGISTRY_ROLE)
    {
        super._beforeRemoveContributor(account);
    }

    function afterAddContributor(address account)
        external
        virtual
        onlyRole(Roles.SHAREHOLDER_REGISTRY_ROLE)
    {
        super._afterAddContributor(account);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        virtual
        onlyRole(Roles.OPERATOR_ROLE)
    {
        super._setShareholderRegistry(shareholderRegistry);
    }
}
