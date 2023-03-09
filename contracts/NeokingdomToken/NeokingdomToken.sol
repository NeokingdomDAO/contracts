// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./NeokingdomTokenSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";

contract NeokingdomToken is
    Initializable,
    NeokingdomTokenSnapshot,
    AccessControlUpgradeable
{
    function initialize(string memory name, string memory symbol)
        public
        override
        initializer
    {
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

    function setVoting(IVoting voting)
        external
        virtual
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _setVoting(voting);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        virtual
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _setShareholderRegistry(shareholderRegistry);
    }

    function mint(address to, uint256 amount)
        public
        virtual
        onlyRole(Roles.RESOLUTION_ROLE)
    {
        _mint(to, amount);
    }

    function mintVesting(address to, uint256 amount)
        public
        virtual
        onlyRole(Roles.RESOLUTION_ROLE)
    {
        _mintVesting(to, amount);
    }

    function matchOffer(
        address from,
        address to,
        uint256 amount
    ) public virtual onlyRole(Roles.ESCROW_ROLE) {
        _matchOffer(from, to, amount);
    }

    function setVesting(address to, uint256 amount)
        public
        virtual
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _setVesting(to, amount);
    }

    function burn(address account, uint256 amount)
        public
        virtual
        onlyRole(Roles.RESOLUTION_ROLE)
    {
        super._burn(account, amount);
    }
}
