// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./ShareholderRegistrySnapshot.sol";
import { Roles } from "../extensions/Roles.sol";

contract ShareholderRegistry is
    Initializable,
    ShareholderRegistrySnapshot,
    AccessControlUpgradeable
{
    // Benjamin takes all the decisions in first months, assuming the role of
    // the "Resolution", to then delegate to the resolution contract what comes
    // next.
    // This is what zodiac calls "incremental decentralization".

    function initialize(
        string memory name,
        string memory symbol
    ) public override initializer {
        super.initialize(name, symbol);
        __AccessControl_init();
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

    function setStatus(
        bytes32 status,
        address account
    ) public virtual onlyRole(Roles.RESOLUTION_ROLE) {
        _setStatus(status, account);
    }

    function setVoting(
        IVoting voting
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setVoting(voting);
    }

    function mint(
        address account,
        uint256 amount
    ) public virtual onlyRole(Roles.RESOLUTION_ROLE) {
        _mint(account, amount);
    }

    function burn(
        address account,
        uint256 amount
    ) external virtual onlyRole(Roles.RESOLUTION_ROLE) {
        _burn(account, amount);
    }

    function batchTransferFromDAO(
        address[] memory recipients
    ) public virtual onlyRole(Roles.RESOLUTION_ROLE) {
        super._batchTransferFromDAO(recipients);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override onlyRole(Roles.RESOLUTION_ROLE) returns (bool) {
        _transfer(from, to, amount);
        return true;
    }

    function transfer(
        address to,
        uint256 amount
    ) public virtual override onlyRole(Roles.RESOLUTION_ROLE) returns (bool) {
        return super.transfer(to, amount);
    }
}
